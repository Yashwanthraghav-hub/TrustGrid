import fs from 'node:fs';
const p='lib/server/handler.ts';let s=fs.readFileSync(p,'utf8');
s=s.replace("evidence:'report_relationships'","evidence:'report_relationships',relationships:'report_relationships'");
s=s.replace("'evidence','analytics'","'evidence','relationships','analytics'");
s=s.replace("const [section,id,action]=path;","let [section,id,action]=path;\n if(section==='settings'){section='admin';id='settings';} if(section==='users'&&action==='role'){section='admin';action=id;id='users';}");
s=s.replace("if(section==='me'&&!id)",`if(section==='reports'&&action==='attachments'){const {data,error}=await c.db.from('report_attachments').select('*').eq('organization_id',requireOrg(c)).eq('report_id',idSchema.parse(id));if(error)databaseError(error.message);return respond({items:(data??[]).map(a=>({...a,url:'/api/v1/attachments/'+a.id}))},requestId);}
  if(section==='users'&&action){staff(c,true);const subject=idSchema.parse(id);let table='reports',column='author_id';if(action==='contributions'){table='resource_offers';column='donor_id';}if(action==='tasks'){table='delivery_tasks';column='volunteer_id';}if(action==='activity'){table='audit_events';column='actor_id';}if(action==='notes'){table='admin_notes';column='subject_id';}const {data,error}=await c.db.from(table).select('*').eq('organization_id',requireOrg(c)).eq(column,subject).limit(50);if(error)databaseError(error.message);return respond({items:data??[]},requestId);}
  if(section==='me'&&!id)`);
s=s.replace("if(!data)throw new ApiError(404,'NOT_FOUND','The record is not available to your account.');",`if(!data){if(section==='tasks'){const eligible=await c.db.rpc('tg_eligible_tasks',{p_org:org});const task=eligible.data?.find((r:{id:string})=>r.id===id);if(task)return task;}throw new ApiError(404,'NOT_FOUND','The record is not available to your account.');}
 if(section==='users'){const profile=await c.db.from('profiles').select('display_name,email,last_login_at,created_at').eq('id',id).single();Object.assign(data,profile.data??{}, {id});}`);
s=s.replace("let items=data??[];",`let items=data??[];
 if(section==='users'&&items.length){const profiles=await c.db.from('profiles').select('id,display_name,email,last_login_at').in('id',items.map(r=>r.user_id));items=items.map(r=>({...r,...profiles.data?.find(p=>p.id===r.user_id),id:r.user_id}));}
 if(section==='volunteers')items=items.map(r=>({...r,id:r.user_id,status:r.approved?'approved':'pending'}));`);
s=s.replace("const input=await body(request);","let input=await body(request);\n if(section==='volunteers'&&id==='me'&&action==='availability'){const raw=input as Record<string,unknown>;input={...raw,areas:raw.areas??[raw.service_area]};}\n if(section==='volunteers'&&action==='approval'){const raw=input as Record<string,unknown>;action='approve';input={...raw,approved:raw.approval_status==='approved'};}");
s=s.replace("else if(section==='notifications'&&action==='read')",`else if(section==='reservations'&&action==='release'){staff(c);operation='reservation.release';data={...z.object({version,reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='users'&&action==='notes'){staff(c,true);operation='note.create';data={...z.object({body:z.string().min(1).max(2000)}).parse(input),subject_id:idSchema.parse(id)};}
 else if(section==='notifications'&&action==='read')`);
s=s.replace("resolution:z.literal('loss').optional()","resolution:z.literal('loss').optional(),volunteer_id:idSchema.optional()");
s=s.replace("'return','reassign','assisted-receipt'","'return','assign','reassign','assisted-receipt'");
s=s.replace("['resolve-exception','close','cancel','reassign'","['resolve-exception','close','cancel','assign','reassign'");
s=s.replace("String(randomInt(0,100000000)).padStart(8,'0')","String(createHmac('sha256',secret).update('issue:'+c.org+':'+id+':'+step+':'+request.headers.get('Idempotency-Key')).digest().readUInt32BE(0)%100000000).padStart(8,'0')");
s=s.replace('randomInt,createHmac','createHmac');
fs.writeFileSync(p,s.replace(/^\uFEFF/,''));
const sqlp='supabase/migrations/202609200002_operations.sql';let sql=fs.readFileSync(sqlp,'utf8');
sql=sql.replaceAll("'stock.reconfirm','scenario.save'","'stock.reconfirm','reservation.release','scenario.save'");sql=sql.replaceAll("'task.reassign','task.assisted-receipt'","'task.reassign','task.assign','task.assisted-receipt'");
sql=sql.replace("elsif p_action='scenario.save' then",`elsif p_action='reservation.release' then
 select * into res from public.reservations where id=(p_data->>'id')::uuid and organization_id=p_org for update;
 if not found then raise exception 'NOT_FOUND';end if;if res.version<>(p_data->>'version')::integer or res.state<>'active' then raise exception 'STALE_VERSION';end if;
 q:=res.remaining;if q<=0 or coalesce(length(why),0)<3 then raise exception 'INVALID_QUANTITY_OR_REASON';end if;
 update public.reservations set remaining=0,state='released',version=version+1 where id=res.id;
 update public.delivery_tasks set state='cancelled_before_pickup',version=version+1,updated_at=now() where reservation_id=res.id and picked_up=0 and state in ('awaiting_assignment','accepted');
 update public.inventory_lots set version=version+1 where id=res.lot_id;
 insert into public.inventory_movements(organization_id,lot_id,actor_id,kind,quantity,reason,idempotency_key)values(p_org,res.lot_id,actor,'release',q,why,p_key);
 entity:=res.id;result:=jsonb_build_object('id',res.id,'state','released');
 elsif p_action='scenario.save' then`);
sql=sql.replace("if not found then raise exception 'NOT_FOUND';end if;entity:=(p_data->>'id')::uuid;",`if not found then raise exception 'NOT_FOUND';end if;entity:=(p_data->>'id')::uuid;
 update public.organization_members set role=case when (p_data->>'approved')::boolean then 'volunteer' else 'member' end where organization_id=p_org and user_id=entity and role in ('member','volunteer');`);
sql=sql.replace("elsif p_action='task.reassign' then",`elsif p_action='task.assign' then
 if task.picked_up<>0 or task.state not in ('awaiting_assignment','accepted') or coalesce(length(why),0)<3 then raise exception 'CUSTODY_RESOLUTION_REQUIRED';end if;
 select * into vol from public.volunteer_profiles where organization_id=p_org and user_id=(p_data->>'volunteer_id')::uuid;
 if not found or not vol.approved or vol.available_until is null or vol.available_until<=now() or not(task.area=any(vol.areas)) or coalesce((vol.capacity->>task.sku)::integer,0)<task.quantity then raise exception 'VOLUNTEER_INELIGIBLE';end if;
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=vol.user_id and status='active') or vol.user_id in(task.source_id,task.recipient_id) then raise exception 'VOLUNTEER_INELIGIBLE';end if;
 update public.delivery_tasks set state='awaiting_assignment',volunteer_id=null,proposed_volunteer_id=vol.user_id where id=task.id;
 update public.handoff_challenges set consumed_at=now() where task_id=task.id and consumed_at is null;
 insert into public.notifications(organization_id,user_id,message,entity_type,entity_id)values(p_org,vol.user_id,'A coordinator proposed a task. Review eligibility and accept it to begin.','task',task.id);
 elsif p_action='task.reassign' then`);
sql=sql.replace("if task.state<>'awaiting_assignment' or res.state<>'active'", "if task.state<>'awaiting_assignment' or (task.proposed_volunteer_id is not null and task.proposed_volunteer_id<>actor) or res.state<>'active'");
fs.writeFileSync(sqlp,sql.replace(/^\uFEFF/,''));
const schema='supabase/migrations/202609200001_schema.sql';let first=fs.readFileSync(schema,'utf8').replace('volunteer_id uuid,source_id uuid','volunteer_id uuid,proposed_volunteer_id uuid,source_id uuid');first=first.replace('foreign key(organization_id,volunteer_id) references','foreign key(organization_id,proposed_volunteer_id) references organization_members(organization_id,user_id),foreign key(organization_id,volunteer_id) references');fs.writeFileSync(schema,first.replace(/^\uFEFF/,''));
