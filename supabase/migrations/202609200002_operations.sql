create or replace function public.tg_mutate(p_org uuid,p_action text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); actor_role text; payload_hash text; prior public.idempotency_records; result jsonb; entity uuid; why text:=p_data->>'reason';
 rep public.reports; off public.resource_offers; lot public.inventory_lots; need public.needs; scenario public.allocation_scenarios; res public.reservations; task public.delivery_tasks; vol public.volunteer_profiles; challenge public.handoff_challenges;
 rowdata jsonb; lotdata jsonb; q integer; remaining_q integer; available_q integer; nid uuid; aid uuid; rid uuid; selected_lot uuid; next_state text; unresolved integer; count_value integer;
begin
 if actor is null then raise exception 'AUTH_REQUIRED';end if;
 if p_key is null or length(p_key) not between 8 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY';end if;
 -- Organization row is the first lock for every writer: stable, coarse, correct for this prototype.
 perform 1 from public.organizations where id=p_org for update;
 actor_role:=private.role(p_org); if actor_role is null then raise exception 'FORBIDDEN';end if;
 payload_hash:=encode(pg_catalog.sha256(convert_to(jsonb_build_object('action',p_action,'data',p_data)::text,'UTF8')),'hex');
 select * into prior from public.idempotency_records where organization_id=p_org and actor_id=actor and key=p_key;
 if found then if prior.payload_hash<>payload_hash then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.outcome;end if;
 perform private.expire_org(p_org);
 if p_action in ('report.review','relationship.create','relationship.reverse','need.update','stock.confirm','stock.adjust','stock.reconfirm','reservation.release','scenario.save','allocation.commit','task.create','volunteer.approve','task.resolve','task.close','task.cancel','task.reassign','task.assign','task.assisted-receipt') and actor_role not in ('coordinator','admin') then raise exception 'FORBIDDEN';end if;
 if p_action in ('member.update','note.create','settings.update','export.record') and actor_role<>'admin' then raise exception 'FORBIDDEN';end if;
 if p_action in ('report.review','relationship.create','relationship.reverse','stock.adjust','stock.confirm','task.resolve','task.assisted-receipt','task.cancel','task.reassign','member.update') and coalesce(length(why),0)<3 then raise exception 'REASON_REQUIRED';end if;
 if p_action='profile.update' then
  update public.profiles set display_name=p_data->>'display_name',preferred_language=coalesce(p_data->>'preferred_language','en'),timezone=coalesce(p_data->>'timezone','Asia/Kolkata'),service_area=coalesce(p_data->>'service_area',''),theme=coalesce(p_data->>'theme','system'),onboarded=true,updated_at=now() where id=actor returning to_jsonb(profiles.*) into result;
  if coalesce((p_data->>'volunteer')::boolean,false) then insert into public.volunteer_profiles(organization_id,user_id) values(p_org,actor) on conflict do nothing;end if;
 elsif p_action='report.create' then
  insert into public.reports(organization_id,author_id,original_text,original_language,kind,area,location_precision,latitude,longitude,sku,other_category,quantity,quantity_meaning,urgency,observed_at,people_affected)
  values(p_org,actor,p_data->>'original_text',p_data->>'original_language',p_data->>'kind',nullif(p_data->>'area',''),p_data->>'location_precision',(p_data->>'latitude')::numeric,(p_data->>'longitude')::numeric,p_data->>'sku',p_data->>'other_category',(p_data->>'quantity')::integer,p_data->>'quantity_meaning',p_data->>'urgency',(p_data->>'observed_at')::timestamptz,(p_data->>'people_affected')::integer) returning * into rep;
  if p_data->>'extraction_id' is not null then update public.report_extractions set report_id=rep.id,corrections=p_data where id=(p_data->>'extraction_id')::uuid and organization_id=p_org and author_id=actor and report_id is null;end if;
  entity:=rep.id;result:=to_jsonb(rep);
  insert into public.notifications(organization_id,user_id,message,entity_type,entity_id) values(p_org,actor,'Report received and awaiting review. Submission does not guarantee assistance.','report',entity);
 elsif p_action='extraction.save' then
  insert into public.report_extractions(organization_id,author_id,original_text,draft,model,schema_version) values(p_org,actor,p_data->>'original_text',p_data->'draft',p_data->>'model',p_data->>'schema_version') returning to_jsonb(report_extractions.*),id into result,entity;
 elsif p_action='report.update' then
  select * into rep from public.reports where id=(p_data->>'id')::uuid and organization_id=p_org and author_id=actor for update;
  if not found then raise exception 'NOT_FOUND';end if;if rep.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
  if rep.review_state not in ('awaiting_review','clarification_requested') then raise exception 'REVIEWED_REPORT_REQUIRES_RECONCILIATION';end if;
  update public.reports set original_text=p_data->>'original_text',area=p_data->>'area',sku=p_data->>'sku',quantity=(p_data->>'quantity')::integer,quantity_meaning=p_data->>'quantity_meaning',review_state='awaiting_review',version=version+1,updated_at=now() where id=rep.id returning to_jsonb(reports.*) into result;entity:=rep.id;
 elsif p_action='report.cancel' then
 select * into rep from public.reports where id=(p_data->>'id')::uuid and organization_id=p_org and author_id=actor for update;
 if not found then raise exception 'NOT_FOUND';end if;if rep.version<>(p_data->>'version')::integer or coalesce(length(why),0)<3 then raise exception 'STALE_VERSION';end if;
 insert into public.review_decisions(organization_id,report_id,actor_id,action,reason,previous_state,new_state)values(p_org,rep.id,actor,'cancellation_requested',why,rep.review_state,rep.review_state);
 update public.reports set cancellation_requested=true,version=version+1,updated_at=now() where id=rep.id returning to_jsonb(reports.*) into result;entity:=rep.id;
 elsif p_action='report.review' then
  select * into rep from public.reports where id=(p_data->>'id')::uuid and organization_id=p_org for update;
  if not found then raise exception 'NOT_FOUND';end if;if rep.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
  next_state:=case p_data->>'action' when 'confirm' then 'confirmed' when 'decline' then 'declined' when 'reopen' then 'awaiting_review' else p_data->>'action' end;
  if next_state='confirmed' then
   if coalesce(p_data->>'sku',rep.sku) is null or coalesce(nullif(p_data->>'area',''),rep.area) is null or coalesce(p_data->>'quantity_meaning',rep.quantity_meaning)='unknown' or rep.kind<>'need' then raise exception 'CLARIFICATION_REQUIRED';end if;
   if exists(select 1 from public.need_report_links where report_id=rep.id) then raise exception 'ALREADY_LINKED_REQUIRES_RECONCILIATION';end if;
   insert into public.needs(organization_id,sku,area,recipient_id,target_quantity,external_received,priority) values(p_org,coalesce(p_data->>'sku',rep.sku),coalesce(nullif(p_data->>'area',''),rep.area),coalesce((p_data->>'recipient_id')::uuid,rep.author_id),(p_data->>'target_quantity')::integer,coalesce((p_data->>'external_received')::integer,0),(p_data->>'priority')::integer) returning id into nid;
   insert into public.need_report_links values(p_org,nid,rep.id,actor,now());
  end if;
  update public.reports set review_state=next_state,review_reason=why,version=version+1,updated_at=now() where id=rep.id returning to_jsonb(reports.*) into result;
  insert into public.review_decisions(organization_id,report_id,need_id,actor_id,action,reason,previous_state,new_state) values(p_org,rep.id,nid,actor,p_data->>'action',why,rep.review_state,next_state);
  insert into public.notifications(organization_id,user_id,message,entity_type,entity_id) values(p_org,rep.author_id,'Your report review was updated. Open your request for the coordinator explanation.','report',rep.id);entity:=rep.id;
 elsif p_action='relationship.create' then
  perform 1 from public.reports where id=(p_data->>'source_id')::uuid and organization_id=p_org; if not found then raise exception 'NOT_FOUND';end if;
  perform 1 from public.reports where id=(p_data->>'target_id')::uuid and organization_id=p_org;if not found then raise exception 'NOT_FOUND';end if;
  insert into public.report_relationships(organization_id,source_id,target_id,kind,reason,actor_id) values(p_org,(p_data->>'source_id')::uuid,(p_data->>'target_id')::uuid,p_data->>'kind',why,actor) returning to_jsonb(report_relationships.*),id into result,entity;
  -- A link is evidence only. It never adds quantities or silently merges existing needs.
 elsif p_action='relationship.reverse' then
  update public.report_relationships set reversed_at=now() where id=(p_data->>'id')::uuid and organization_id=p_org and reversed_at is null returning to_jsonb(report_relationships.*),id into result,entity;
  if not found then raise exception 'NOT_FOUND';end if;
 elsif p_action='need.update' then
  select * into need from public.needs where id=(p_data->>'id')::uuid and organization_id=p_org for update;
  if not found then raise exception 'NOT_FOUND';end if;if need.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
  q:=(p_data->>'target_quantity')::integer;
  if q<need.target_quantity-private.need_uncommitted(need.id) then raise exception 'COMMITMENTS_REQUIRE_RECONCILIATION';end if;
  update public.needs set target_quantity=q,priority=(p_data->>'priority')::integer,version=version+1,updated_at=now() where id=need.id returning to_jsonb(needs.*) into result;entity:=need.id;
 elsif p_action='offer.create' then
  if (p_data->>'available_until')::timestamptz<=now() then raise exception 'INVALID_AVAILABILITY';end if;
  insert into public.resource_offers(organization_id,donor_id,sku,quantity,area,available_until) values(p_org,actor,p_data->>'sku',(p_data->>'quantity')::integer,p_data->>'area',(p_data->>'available_until')::timestamptz) returning to_jsonb(resource_offers.*),id into result,entity;
 elsif p_action='offer.update' then
 select * into off from public.resource_offers where id=(p_data->>'id')::uuid and organization_id=p_org and donor_id=actor for update;
 if not found then raise exception 'NOT_FOUND';end if;if off.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
 update public.resource_offers set quantity=(p_data->>'quantity')::integer,area=p_data->>'area',available_until=(p_data->>'available_until')::timestamptz,version=version+1 where id=off.id returning to_jsonb(resource_offers.*) into result;entity:=off.id;
 -- Confirmed physical stock remains unchanged; a coordinator must adjust it explicitly.
 elsif p_action='stock.confirm' then
  select * into off from public.resource_offers where id=(p_data->>'id')::uuid and organization_id=p_org for update;
  if not found then raise exception 'NOT_FOUND';end if;if off.version<>(p_data->>'version')::integer or off.status<>'offered' then raise exception 'STALE_VERSION';end if;
  q:=(p_data->>'quantity')::integer;if q<=0 or q>off.quantity or off.available_until<=now() then raise exception 'INVALID_QUANTITY_OR_EXPIRY';end if;
  insert into public.inventory_lots(organization_id,offer_id,source_id,sku,area,on_hand,fresh_until,expires_at) values(p_org,off.id,off.donor_id,off.sku,off.area,q,least(off.available_until,now()+make_interval(hours=>coalesce((select (settings->>'freshness_hours')::integer from public.organizations where id=p_org),24))),off.available_until) returning * into lot;
  update public.resource_offers set status='confirmed',version=version+1 where id=off.id;
  insert into public.inventory_movements(organization_id,lot_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,actor,'confirm',q,why,p_key);result:=to_jsonb(lot);entity:=lot.id;
 elsif p_action in ('stock.adjust','stock.reconfirm') then
  select * into lot from public.inventory_lots where id=(p_data->>'id')::uuid and organization_id=p_org for update;
  if not found then raise exception 'NOT_FOUND';end if;if lot.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
  if p_action='stock.adjust' then
   q:=(p_data->>'quantity')::integer;if q=0 or abs(q)>1000000 or lot.on_hand+q<coalesce((select sum(remaining) from public.reservations where lot_id=lot.id and state='active'),0) then raise exception 'INVALID_QUANTITY';end if;
   update public.inventory_lots set on_hand=on_hand+q,version=version+1 where id=lot.id;
   insert into public.inventory_movements(organization_id,lot_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,actor,'adjust',q,why,p_key);
  else
   if lot.expires_at<=now() then raise exception 'EXPIRED_STOCK_REQUIRES_NEW_OFFER';end if;
   update public.inventory_lots set confirmed_at=now(),fresh_until=least(expires_at,now()+make_interval(hours=>coalesce((select (settings->>'freshness_hours')::integer from public.organizations where id=p_org),24))),held=coalesce((p_data->>'held')::boolean,false),version=version+1 where id=lot.id;
  end if;
  select to_jsonb(l.*) into result from public.inventory_lots l where id=lot.id;entity:=lot.id;
 elsif p_action='reservation.release' then
 select * into res from public.reservations where id=(p_data->>'id')::uuid and organization_id=p_org for update;
 if not found then raise exception 'NOT_FOUND';end if;if res.version<>(p_data->>'version')::integer or res.state<>'active' then raise exception 'STALE_VERSION';end if;
 q:=res.remaining;if q<=0 or coalesce(length(why),0)<3 then raise exception 'INVALID_QUANTITY_OR_REASON';end if;
 update public.reservations set remaining=0,state='released',version=version+1 where id=res.id;
 update public.delivery_tasks set state='cancelled_before_pickup',version=version+1,updated_at=now() where reservation_id=res.id and picked_up=0 and state in ('awaiting_assignment','accepted');
 update public.inventory_lots set version=version+1 where id=res.lot_id;
 insert into public.inventory_movements(organization_id,lot_id,actor_id,kind,quantity,reason,idempotency_key)values(p_org,res.lot_id,actor,'release',q,why,p_key);
 entity:=res.id;result:=jsonb_build_object('id',res.id,'state','released');
 elsif p_action='scenario.save' then
  if jsonb_array_length(p_data->'input'->'needs') not between 1 and 50 or jsonb_array_length(p_data->'input'->'lots') not between 1 and 50 then raise exception 'INVALID_SCENARIO';end if;
  insert into public.allocation_scenarios(organization_id,author_id,sku,policy,input,result,algorithm_version) values(p_org,actor,p_data->>'sku',p_data->>'policy',p_data->'input',p_data->'result','1.0.0') returning to_jsonb(allocation_scenarios.*),id into result,entity;
 elsif p_action='allocation.commit' then
  select * into scenario from public.allocation_scenarios where id=(p_data->>'scenario_id')::uuid and organization_id=p_org;
  if not found then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from public.allocations where scenario_id=scenario.id) then raise exception 'SCENARIO_ALREADY_APPROVED';end if;
  -- Validate every snapshot before creating any reservation. Organization lock serializes all writers.
  for rowdata in select value from jsonb_array_elements(scenario.input->'needs') loop
   select * into need from public.needs where id=(rowdata->>'id')::uuid and organization_id=p_org and sku=scenario.sku and status='confirmed' for update;
   if not found or need.version<>(rowdata->>'version')::integer or private.need_uncommitted(need.id)<>(rowdata->>'uncommitted')::integer then raise exception 'STALE_SCENARIO';end if;
  end loop;
  for lotdata in select value from jsonb_array_elements(scenario.input->'lots') loop
   select * into lot from public.inventory_lots where id=(lotdata->>'id')::uuid and organization_id=p_org and sku=scenario.sku for update;
   if not found or lot.version<>(lotdata->>'version')::integer or private.lot_available(lot.id)<>(lotdata->>'available')::integer then raise exception 'STALE_SCENARIO';end if;
  end loop;
  for rowdata in select value from jsonb_array_elements(scenario.result->'rows') loop
   q:=(rowdata->>'quantity')::integer;nid:=(rowdata->>'id')::uuid;
   if q<0 or q>1000000 or not exists(select 1 from jsonb_array_elements(scenario.input->'needs') n where (n->>'id')::uuid=nid) then raise exception 'INVALID_ALLOCATION';end if;
   if q=0 then continue;end if;
   if q>private.need_uncommitted(nid) then raise exception 'NEED_OVERCOMMITTED';end if;
   insert into public.allocations(organization_id,scenario_id,need_id,sku,quantity) values(p_org,scenario.id,nid,scenario.sku,q) returning id into aid;remaining_q:=q;
   for lotdata in select value from jsonb_array_elements(scenario.input->'lots') order by value->>'id' loop
    selected_lot:=(lotdata->>'id')::uuid;available_q:=least(remaining_q,private.lot_available(selected_lot));
    if available_q>0 then
     insert into public.reservations(organization_id,allocation_id,lot_id,quantity,remaining,expires_at) values(p_org,aid,selected_lot,available_q,available_q,now()+make_interval(mins=>coalesce((select (settings->>'hold_minutes')::integer from public.organizations where id=p_org),30)));
     insert into public.inventory_movements(organization_id,lot_id,need_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,selected_lot,nid,actor,'reserve',available_q,'Approved allocation',p_key);
     update public.inventory_lots set version=version+1 where id=selected_lot;remaining_q:=remaining_q-available_q;
    end if;exit when remaining_q=0;
   end loop;
   if remaining_q<>0 then raise exception 'INSUFFICIENT_STOCK';end if;
   update public.needs set version=version+1,updated_at=now() where id=nid;
  end loop;
  entity:=scenario.id;result:=jsonb_build_object('scenario_id',entity,'status','reserved');
 elsif p_action='volunteer.update' then
  if (p_data->>'available_until')::timestamptz>now()+interval '24 hours' then raise exception 'AVAILABILITY_MAX_24_HOURS';end if;
  insert into public.volunteer_profiles(organization_id,user_id,skills,areas,capacity,max_tasks,available_until,vehicle) values(p_org,actor,array(select jsonb_array_elements_text(p_data->'skills')),array(select jsonb_array_elements_text(p_data->'areas')),p_data->'capacity',(p_data->>'max_tasks')::integer,(p_data->>'available_until')::timestamptz,coalesce(p_data->>'vehicle','none')) on conflict(organization_id,user_id) do update set skills=excluded.skills,areas=excluded.areas,capacity=excluded.capacity,max_tasks=excluded.max_tasks,available_until=excluded.available_until,vehicle=excluded.vehicle,updated_at=now() returning to_jsonb(volunteer_profiles.*) into result;
  entity:=actor;
 elsif p_action='volunteer.approve' then
  update public.volunteer_profiles set approved=(p_data->>'approved')::boolean,updated_at=now() where organization_id=p_org and user_id=(p_data->>'id')::uuid returning to_jsonb(volunteer_profiles.*) into result;
  if not found then raise exception 'NOT_FOUND';end if;entity:=(p_data->>'id')::uuid;
 update public.organization_members set role=case when (p_data->>'approved')::boolean then 'volunteer' else 'member' end where organization_id=p_org and user_id=entity and role in ('member','volunteer');
 elsif p_action='task.create' then
  select * into res from public.reservations where id=(p_data->>'reservation_id')::uuid and organization_id=p_org and state='active' and expires_at>now() for update;
  if not found then raise exception 'RESERVATION_EXPIRED';end if;
  select * into lot from public.inventory_lots where id=res.lot_id;
  select n.* into need from public.needs n join public.allocations a on a.need_id=n.id where a.id=res.allocation_id;
  q:=(p_data->>'quantity')::integer;
  if q<=0 or q>res.remaining-coalesce((select sum(quantity) from public.delivery_tasks where reservation_id=res.id and picked_up=0 and state in ('awaiting_assignment','accepted')),0) then raise exception 'INVALID_QUANTITY';end if;
  if lot.source_id=need.recipient_id then raise exception 'INDEPENDENT_PARTICIPANTS_REQUIRED';end if;
  insert into public.delivery_tasks(organization_id,reservation_id,source_id,recipient_id,sku,area,quantity,required_skill) values(p_org,res.id,lot.source_id,need.recipient_id,lot.sku,need.area,q,nullif(p_data->>'required_skill','')) returning * into task;result:=to_jsonb(task);entity:=task.id;
 elsif p_action like 'task.%' then
  select * into task from public.delivery_tasks where id=(p_data->>'id')::uuid and organization_id=p_org for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if p_action='task.accept' and task.volunteer_id=actor and task.state='accepted' then result:=to_jsonb(task);
  else
   if task.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
   select * into res from public.reservations where id=task.reservation_id for update;
   select * into lot from public.inventory_lots where id=res.lot_id for update;
   select a.need_id into nid from public.allocations a where id=res.allocation_id;
   unresolved:=task.picked_up-task.received-task.returned-task.lost;
   if p_action='task.accept' then
    select * into vol from public.volunteer_profiles where organization_id=p_org and user_id=actor for update;
    if task.state<>'awaiting_assignment' or (task.proposed_volunteer_id is not null and task.proposed_volunteer_id<>actor) or res.state<>'active' or res.expires_at<=now() then raise exception 'TASK_UNAVAILABLE';end if;
    if not found or not vol.approved or vol.available_until is null or vol.available_until<=now() or not(task.area=any(vol.areas)) or coalesce((vol.capacity->>task.sku)::integer,0)<task.quantity or (task.required_skill is not null and not(task.required_skill=any(vol.skills))) or actor in (task.source_id,task.recipient_id) then raise exception 'VOLUNTEER_INELIGIBLE';end if;
    if (select count(*) from public.delivery_tasks where organization_id=p_org and volunteer_id=actor and state not in ('closed','cancelled_before_pickup'))>=vol.max_tasks then raise exception 'WORKLOAD_CAPACITY';end if;
    update public.delivery_tasks set volunteer_id=actor,state='accepted' where id=task.id;
   elsif p_action='task.decline' then
    if not exists(select 1 from public.volunteer_profiles where organization_id=p_org and user_id=actor and approved) or task.state<>'awaiting_assignment' then raise exception 'FORBIDDEN';end if;
   elsif p_action='task.challenge' then
    if task.volunteer_id is null or task.volunteer_id=actor or res.expires_at<=now() and p_data->>'step'='pickup' then raise exception 'FORBIDDEN';end if;
    q:=(p_data->>'quantity')::integer;
    if p_data->>'step'='pickup' then if actor<>task.source_id or task.state<>'accepted' or q<>task.quantity then raise exception 'FORBIDDEN';end if;
    elsif p_data->>'step'='delivery' then if actor<>task.recipient_id or task.state not in ('dropoff_recorded','exception') or q<=0 or q>unresolved then raise exception 'FORBIDDEN';end if;
    else raise exception 'INVALID_STEP';end if;
    update public.handoff_challenges set consumed_at=now() where task_id=task.id and step=p_data->>'step' and consumed_at is null;
    insert into public.handoff_challenges(organization_id,task_id,step,issuer_id,actor_id,digest,quantity,expires_at) values(p_org,task.id,p_data->>'step',actor,task.volunteer_id,p_data->>'digest',q,now()+interval '10 minutes');
   elsif p_action in ('task.pickup','task.receipt-code') then
    if task.volunteer_id<>actor or actor in (task.source_id,task.recipient_id) then raise exception 'FORBIDDEN';end if;
    select * into challenge from public.handoff_challenges where task_id=task.id and step=case p_action when 'task.pickup' then 'pickup' else 'delivery' end and consumed_at is null order by created_at desc limit 1 for update;
    if not found or challenge.actor_id<>actor or challenge.expires_at<=now() or challenge.attempts>=5 then result:=jsonb_build_object('_error','CHALLENGE_UNAVAILABLE');
    elsif challenge.digest<>p_data->>'digest' then update public.handoff_challenges set attempts=attempts+1 where id=challenge.id;result:=jsonb_build_object('_error','INVALID_CODE');
    else
     q:=challenge.quantity;update public.handoff_challenges set consumed_at=now() where id=challenge.id;
     if p_action='task.pickup' then
      if task.state<>'accepted' or res.expires_at<=now() or res.state<>'active' or lot.held or lot.fresh_until<=now() or lot.expires_at<=now() or q>res.remaining or q>lot.on_hand then raise exception 'PICKUP_UNAVAILABLE';end if;
      update public.inventory_lots set on_hand=on_hand-q,version=version+1 where id=lot.id;
      update public.reservations set remaining=remaining-q,state=case when remaining=q then 'collected' else 'active' end,version=version+1 where id=res.id;
      update public.delivery_tasks set picked_up=q,state='pickup_confirmed' where id=task.id;
      insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,nid,task.id,actor,'pickup',q,'Source participant confirmed pickup',p_key);
     else
      if task.state not in ('dropoff_recorded','exception') or q>unresolved then raise exception 'INVALID_RECEIPT';end if;
      update public.delivery_tasks set received=received+q,state=case when q=unresolved then 'receipt_confirmed' else 'exception' end where id=task.id;
      insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,nid,task.id,actor,'receipt',q,'Recipient-issued participant confirmation',p_key);
     end if;
    end if;
   elsif p_action in ('task.receipt','task.assisted-receipt') then
    if (p_action='task.receipt' and actor<>task.recipient_id) or actor=task.volunteer_id or task.state not in ('dropoff_recorded','exception') then raise exception 'FORBIDDEN';end if;
    q:=(p_data->>'quantity')::integer;if q<=0 or q>unresolved then raise exception 'INVALID_RECEIPT';end if;
    update public.delivery_tasks set received=received+q,state=case when q=unresolved then 'receipt_confirmed' else 'exception' end where id=task.id;
    update public.handoff_challenges set consumed_at=now() where task_id=task.id and step='delivery' and consumed_at is null;
    insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,nid,task.id,actor,'receipt',q,case when p_action='task.receipt' then 'Direct recipient participant confirmation' else 'Assisted coordinator confirmation: '||why end,p_key);
   elsif p_action='task.en-route' then
    if actor<>task.volunteer_id or task.state<>'pickup_confirmed' then raise exception 'FORBIDDEN';end if;update public.delivery_tasks set state='en_route' where id=task.id;
   elsif p_action='task.dropoff' then
    if actor<>task.volunteer_id or task.state<>'en_route' then raise exception 'FORBIDDEN';end if;update public.delivery_tasks set state='dropoff_recorded' where id=task.id;
   elsif p_action='task.exception' then
    if (actor<>task.volunteer_id and actor_role not in ('coordinator','admin')) or task.state in ('closed','cancelled_before_pickup') or coalesce(length(why),0)<3 then raise exception 'FORBIDDEN';end if;update public.delivery_tasks set state='exception' where id=task.id;
   elsif p_action='task.resolve' then
    if task.state<>'exception' then raise exception 'INVALID_STATE';end if;q:=(p_data->>'quantity')::integer;if q<=0 or q>unresolved then raise exception 'INVALID_QUANTITY';end if;
    -- Returns require source-side confirmation; staff may record a loss with a reason, never magic restocking.
    if p_data->>'resolution'<>'loss' then raise exception 'SOURCE_RETURN_CONFIRMATION_REQUIRED';end if;
    update public.delivery_tasks set lost=lost+q where id=task.id;
    insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,nid,task.id,actor,'loss',q,why,p_key);
   elsif p_action='task.return' then
    if actor<>task.source_id or task.state<>'exception' then raise exception 'FORBIDDEN';end if;q:=(p_data->>'quantity')::integer;if q<=0 or q>unresolved or coalesce(length(why),0)<3 then raise exception 'INVALID_QUANTITY';end if;
    update public.delivery_tasks set returned=returned+q where id=task.id;update public.inventory_lots set on_hand=on_hand+q,version=version+1 where id=lot.id;
    insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,nid,task.id,actor,'return',q,'Source-confirmed return: '||why,p_key);
   elsif p_action='task.close' then
    if task.state not in ('receipt_confirmed','exception') or unresolved<>0 then raise exception 'UNRESOLVED_CUSTODY';end if;update public.delivery_tasks set state='closed' where id=task.id;
   elsif p_action='task.cancel' then
    if task.picked_up<>0 or task.state not in ('awaiting_assignment','accepted') then raise exception 'CUSTODY_RESOLUTION_REQUIRED';end if;
    update public.delivery_tasks set state='cancelled_before_pickup' where id=task.id;
    update public.reservations set remaining=remaining-task.quantity,state=case when remaining=task.quantity then 'released' else state end,version=version+1 where id=res.id;
    update public.inventory_lots set version=version+1 where id=lot.id;
    insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,idempotency_key) values(p_org,lot.id,nid,task.id,actor,'release',task.quantity,why,p_key);
   elsif p_action='task.assign' then
 if task.picked_up<>0 or task.state not in ('awaiting_assignment','accepted') or coalesce(length(why),0)<3 then raise exception 'CUSTODY_RESOLUTION_REQUIRED';end if;
 select * into vol from public.volunteer_profiles where organization_id=p_org and user_id=(p_data->>'volunteer_id')::uuid;
 if not found or not vol.approved or vol.available_until is null or vol.available_until<=now() or not(task.area=any(vol.areas)) or coalesce((vol.capacity->>task.sku)::integer,0)<task.quantity then raise exception 'VOLUNTEER_INELIGIBLE';end if;
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=vol.user_id and status='active') or vol.user_id in(task.source_id,task.recipient_id) then raise exception 'VOLUNTEER_INELIGIBLE';end if;
 update public.delivery_tasks set state='awaiting_assignment',volunteer_id=null,proposed_volunteer_id=vol.user_id where id=task.id;
 update public.handoff_challenges set consumed_at=now() where task_id=task.id and consumed_at is null;
 insert into public.notifications(organization_id,user_id,message,entity_type,entity_id)values(p_org,vol.user_id,'A coordinator proposed a task. Review eligibility and accept it to begin.','task',task.id);
 elsif p_action='task.reassign' then
    if task.picked_up<>0 or task.state<>'accepted' then raise exception 'CUSTODY_RESOLUTION_REQUIRED';end if;update public.delivery_tasks set state='awaiting_assignment',volunteer_id=null where id=task.id;
    update public.handoff_challenges set consumed_at=now() where task_id=task.id and consumed_at is null;
   else raise exception 'UNKNOWN_ACTION';end if;
   if result is null or not(result ? '_error') then
    if p_action<>'task.challenge' then update public.delivery_tasks set version=version+1,updated_at=now() where id=task.id;end if;
    insert into public.task_events(organization_id,task_id,actor_id,action,reason,quantity) values(p_org,task.id,actor,p_action,why,q);
    update public.needs set version=version+1,updated_at=now() where id=nid;
    select to_jsonb(t.*) into result from public.delivery_tasks t where id=task.id;
    insert into public.notifications(organization_id,user_id,message,entity_type,entity_id) values(p_org,task.recipient_id,'A delivery task was updated. Open the timeline for details.','task',task.id);
   end if;
  end if;entity:=task.id;
 elsif p_action='notification.read' then
  update public.notifications set read_at=now() where id=(p_data->>'id')::uuid and organization_id=p_org and user_id=actor returning to_jsonb(notifications.*),id into result,entity;
  if not found then raise exception 'NOT_FOUND';end if;
 elsif p_action='member.update' then
  entity:=(p_data->>'id')::uuid;
  if exists(select 1 from public.organization_members where organization_id=p_org and user_id=entity and role='admin' and status='active') and (p_data->>'role'<>'admin' or p_data->>'status'<>'active') and (select count(*) from public.organization_members where organization_id=p_org and role='admin' and status='active')<=1 then raise exception 'LAST_ADMIN';end if;
  update public.organization_members set role=p_data->>'role',status=p_data->>'status',approved_by=actor,updated_at=now() where organization_id=p_org and user_id=entity returning to_jsonb(organization_members.*) into result;if not found then raise exception 'NOT_FOUND';end if;
 elsif p_action='note.create' then
  insert into public.admin_notes(organization_id,subject_id,author_id,body) values(p_org,(p_data->>'subject_id')::uuid,actor,p_data->>'body') returning to_jsonb(admin_notes.*),id into result,entity;
 elsif p_action='settings.update' then
  if (p_data->'settings'->>'hold_minutes')::integer not between 5 and 120 or (p_data->'settings'->>'freshness_hours')::integer not between 1 and 168 then raise exception 'INVALID_SETTINGS';end if;
  update public.organizations set settings=p_data->'settings',service_areas=array(select jsonb_array_elements_text(p_data->'service_areas')) where id=p_org returning to_jsonb(organizations.*) into result;entity:=p_org;
 elsif p_action='export.record' then result:=jsonb_build_object('ok',true);entity:=p_org;
 else raise exception 'UNKNOWN_ACTION';end if;
 -- Redacted audit: never raw reports, contacts, codes, digests, or provider credentials.
 insert into public.audit_events(organization_id,actor_id,action,entity_id,reason,changes,correlation_id) values(p_org,actor,p_action,entity,why,jsonb_build_object('quantity',q,'outcome',case when result ? '_error' then result->>'_error' else 'committed' end),p_key);
 insert into public.idempotency_records values(p_org,actor,p_key,payload_hash,result,now());
 return result;
end$$;
revoke all on function public.tg_mutate(uuid,text,jsonb,text) from public,anon;
grant execute on function public.tg_mutate(uuid,text,jsonb,text) to authenticated;
create or replace function public.tg_eligible_tasks(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare v public.volunteer_profiles;begin
 if private.role(p_org) is null then raise exception 'FORBIDDEN';end if;
 select * into v from public.volunteer_profiles where organization_id=p_org and user_id=auth.uid() and approved and available_until>now();if not found then return '[]';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'area',t.area,'sku',t.sku,'quantity',t.quantity,'required_skill',t.required_skill,'state',t.state,'version',t.version,'expires_at',r.expires_at)),'[]') from public.delivery_tasks t join public.reservations r on r.id=t.reservation_id where t.organization_id=p_org and t.state='awaiting_assignment' and r.state='active' and r.expires_at>now() and t.area=any(v.areas) and coalesce((v.capacity->>t.sku)::integer,0)>=t.quantity and (t.required_skill is null or t.required_skill=any(v.skills)) and auth.uid() not in(t.source_id,t.recipient_id));end$$;
revoke all on function public.tg_eligible_tasks(uuid) from public,anon;
grant execute on function public.tg_eligible_tasks(uuid) to authenticated;
create or replace function public.tg_expire_all() returns integer language plpgsql security definer set search_path='' as $$declare o record;n integer:=0;begin for o in select id from public.organizations order by id for update loop n:=n+private.expire_org(o.id);end loop;return n;end$$;
revoke all on function public.tg_expire_all() from public,anon,authenticated;
grant execute on function public.tg_expire_all() to service_role;

