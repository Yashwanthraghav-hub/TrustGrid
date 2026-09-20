import fs from 'node:fs';
let s=fs.readFileSync('lib/validation/index.ts','utf8');s=s.replace("recipient_id:z.string().uuid().optional()","recipient_id:z.string().uuid().optional(),sku:skuSchema.optional(),area:z.string().trim().min(2).max(200).optional(),quantity_meaning:z.enum(['total','still_needed','unknown']).optional()");fs.writeFileSync('lib/validation/index.ts',s.replace(/^\uFEFF/,''));
let sql=fs.readFileSync('supabase/migrations/202609200002_operations.sql','utf8');
sql=sql.replace("if rep.sku is null or rep.area is null or rep.quantity_meaning='unknown'", "if coalesce(p_data->>'sku',rep.sku) is null or coalesce(nullif(p_data->>'area',''),rep.area) is null or coalesce(p_data->>'quantity_meaning',rep.quantity_meaning)='unknown'");
sql=sql.replace("values(p_org,rep.sku,rep.area,coalesce((p_data->>'recipient_id')", "values(p_org,coalesce(p_data->>'sku',rep.sku),coalesce(nullif(p_data->>'area',''),rep.area),coalesce((p_data->>'recipient_id')");
sql=sql.replace("elsif p_action='report.review' then",`elsif p_action='report.cancel' then
 select * into rep from public.reports where id=(p_data->>'id')::uuid and organization_id=p_org and author_id=actor for update;
 if not found then raise exception 'NOT_FOUND';end if;if rep.version<>(p_data->>'version')::integer or coalesce(length(why),0)<3 then raise exception 'STALE_VERSION';end if;
 insert into public.review_decisions(organization_id,report_id,actor_id,action,reason,previous_state,new_state)values(p_org,rep.id,actor,'cancellation_requested',why,rep.review_state,rep.review_state);
 update public.reports set cancellation_requested=true,version=version+1,updated_at=now() where id=rep.id returning to_jsonb(reports.*) into result;entity:=rep.id;
 elsif p_action='report.review' then`);
sql=sql.replace("elsif p_action='stock.confirm' then",`elsif p_action='offer.update' then
 select * into off from public.resource_offers where id=(p_data->>'id')::uuid and organization_id=p_org and donor_id=actor for update;
 if not found then raise exception 'NOT_FOUND';end if;if off.version<>(p_data->>'version')::integer then raise exception 'STALE_VERSION';end if;
 update public.resource_offers set quantity=(p_data->>'quantity')::integer,area=p_data->>'area',available_until=(p_data->>'available_until')::timestamptz,version=version+1 where id=off.id returning to_jsonb(resource_offers.*) into result;entity:=off.id;
 -- Confirmed physical stock remains unchanged; a coordinator must adjust it explicitly.
 elsif p_action='stock.confirm' then`);
fs.writeFileSync('supabase/migrations/202609200002_operations.sql',sql);
let schema=fs.readFileSync('supabase/migrations/202609200001_schema.sql','utf8').replace("review_reason text,version integer","review_reason text,cancellation_requested boolean not null default false,version integer");fs.writeFileSync('supabase/migrations/202609200001_schema.sql',schema);
let h=fs.readFileSync('lib/server/handler.ts','utf8');
h=h.replace("else if(section==='reports'&&action==='review')",`else if(section==='reports'&&action==='cancel'){operation='report.cancel';data={...z.object({version,reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='reports'&&action==='review')`);
h=h.replace("else if(section==='offers'&&action==='confirm-stock')",`else if(section==='offers'&&id&&request.method==='PATCH'){operation='offer.update';data={...offerSchema.omit({sku:true}).extend({version}).parse(input),id:idSchema.parse(id)};}
 else if(section==='offers'&&action==='confirm-stock')`);
h=h.replace("const search=request.nextUrl.searchParams.get('q')?.slice(0,100);",`const search=request.nextUrl.searchParams.get('q')?.slice(0,100);
 if(search&&section==='users'){const safe=search.replace(/[^\\p{L}\\p{N} @._-]/gu,'');const profiles=await c.db.from('profiles').select('id').or('display_name.ilike.%'+safe+'%,email.ilike.%'+safe+'%').limit(200);const ids=(profiles.data??[]).map(p=>p.id);if(!ids.length)return{items:[],total:0,page};query=query.in('user_id',ids);}
 if(search&&['needs','resource_offers','inventory_lots','delivery_tasks'].includes(table))query=query.ilike('area','%'+search.replace(/[%_]/g,'')+'%');`);
h=h.replace("const values=section==='needs'?balances.needs:balances.lots;", "const values=section==='needs'?balances.needs:balances.lots;");
h=h.replace("Object.assign(data,{attachments:","const summary=await c.db.rpc('tg_request_summary',{p_org:org,p_report:id});Object.assign(data,summary.data??{});\n  Object.assign(data,{attachments:");
fs.writeFileSync('lib/server/handler.ts',h);
