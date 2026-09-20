import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createHmac} from 'node:crypto';
import sharp from 'sharp';
import {context,requireOrg,staff,body,respond,failure,ApiError,mutate,databaseError,csvCell,type Context} from '@/lib/server/api';
import {reportSchema,offerSchema,profileSchema,reviewSchema,previewSchema,amount,skuSchema} from '@/lib/validation';
import {allocate} from '@/lib/domain/allocation';
import {extractReport} from '@/lib/ai/extract';
import {matchVolunteers,type Volunteer} from '@/lib/domain/matching';
const idSchema=z.string().uuid();
const version=z.number().int().positive();
const reason=z.string().min(3).max(1000);
const tableMap:Record<string,string>={reports:'reports',requests:'reports',needs:'needs',offers:'resource_offers',contributions:'resource_offers',inventory:'inventory_lots',resources:'inventory_lots',allocations:'allocations',scenarios:'allocation_scenarios',reservations:'reservations',movements:'inventory_movements',tasks:'delivery_tasks',deliveries:'delivery_tasks',volunteers:'volunteer_profiles',notifications:'notifications',audit:'audit_events',users:'organization_members',evidence:'report_relationships',relationships:'report_relationships',notes:'admin_notes'};
const adminSections=['users','audit','settings','notes'];
const staffSections=['needs','inventory','resources','allocations','scenarios','reservations','movements','volunteers','evidence','relationships','analytics'];
async function list(c:Context,section:string,request:NextRequest){
 const org=requireOrg(c);if(adminSections.includes(section))staff(c,true);else if(staffSections.includes(section))staff(c);
 if(section==='settings'){const {data,error}=await c.db.from('organizations').select('*').eq('id',org).single();if(error)databaseError(error.message);return{items:data?[data]:[],total:1,page:1};}
 if(section==='analytics'){
  const {data,error}=await c.db.from('inventory_movements').select('kind,sku:inventory_lots(sku),quantity,created_at').eq('organization_id',org).eq('kind','receipt').order('created_at',{ascending:false}).limit(500);
  if(error)databaseError(error.message);return{items:data??[],total:data?.length??0,page:1,definition:'Participant-confirmed receipt events, most recent 500; no inferred impact metrics.'};
 }
 if(section==='history'){
  const [reports,offers,tasks]=await Promise.all([c.db.from('reports').select('id,original_text,review_state,received_at').eq('organization_id',org).eq('author_id',c.user.id).order('received_at',{ascending:false}).limit(50),c.db.from('resource_offers').select('*').eq('organization_id',org).eq('donor_id',c.user.id).order('created_at',{ascending:false}).limit(50),c.db.from('task_events').select('*').eq('organization_id',org).order('created_at',{ascending:false}).limit(50)]);
  for(const result of [reports,offers,tasks])if(result.error)databaseError(result.error.message);
  const items=[...(reports.data??[]).map(r=>({...r,action:'report',created_at:r.received_at})),...(offers.data??[]).map(r=>({...r,action:'offer'})),...(tasks.data??[])].sort((a,b)=>b.created_at.localeCompare(a.created_at));return{items:items.slice(0,50),total:items.length,page:1};
 }
 const table=tableMap[section];if(!table)throw new ApiError(404,'NOT_FOUND','Unknown section.');
 const page=Math.max(1,Math.min(10000,Number(request.nextUrl.searchParams.get('page'))||1));const size=20;
 let query=c.db.from(table).select('*',{count:'exact'}).eq('organization_id',org);
 if(request.nextUrl.searchParams.get('mine')==='true'){if(table==='reports')query=query.eq('author_id',c.user.id);if(table==='resource_offers')query=query.eq('donor_id',c.user.id);}
 const status=request.nextUrl.searchParams.get('status');if(status&&status!=='all')query=query.eq(table==='reports'?'review_state':table==='delivery_tasks'?'state':'status',status);
 const area=request.nextUrl.searchParams.get('area');if(area&&['reports','needs','resource_offers','inventory_lots','delivery_tasks'].includes(table))query=query.eq('area',area);
 const sku=request.nextUrl.searchParams.get('sku');if(sku&&['reports','needs','resource_offers','inventory_lots','delivery_tasks'].includes(table))query=query.eq('sku',skuSchema.parse(sku));
 const search=request.nextUrl.searchParams.get('q')?.slice(0,100);
 if(search&&section==='users'){const safe=search.replace(/[^\p{L}\p{N} @._-]/gu,'');const profiles=await c.db.from('profiles').select('id').or('display_name.ilike.%'+safe+'%,email.ilike.%'+safe+'%').limit(200);const ids=(profiles.data??[]).map(p=>p.id);if(!ids.length)return{items:[],total:0,page};query=query.in('user_id',ids);}
 if(search&&['needs','resource_offers','inventory_lots','delivery_tasks'].includes(table))query=query.ilike('area','%'+search.replace(/[%_]/g,'')+'%');if(search&&table==='reports')query=query.ilike('original_text',`%${search.replace(/[%_]/g,'')}%`);
 const order=table==='reports'?'received_at':table==='inventory_lots'?'confirmed_at':table==='volunteer_profiles'?'updated_at':'created_at';
 const {data,error,count}=await query.order(order,{ascending:false}).order(table==='organization_members'||table==='volunteer_profiles'?'user_id':'id').range((page-1)*size,page*size-1);if(error)databaseError(error.message);
 if(section==='inventory'||section==='resources'||section==='needs'){
  const {data:balances,error:bError}=await c.db.rpc('tg_balances',{p_org:org});if(bError)databaseError(bError.message);
  const values=section==='needs'?balances.needs:balances.lots;
  return {items:(data??[]).map(r=>({...r,...values.find((b:{id:string})=>b.id===r.id)})),total:count??0,page};
 }
 let items=data??[];
 if(section==='users'&&items.length){const profiles=await c.db.from('profiles').select('id,display_name,email,last_login_at').in('id',items.map(r=>r.user_id));items=items.map(r=>({...r,...profiles.data?.find(p=>p.id===r.user_id),id:r.user_id}));}
 if(section==='volunteers')items=items.map(r=>({...r,id:r.user_id,status:r.approved?'approved':'pending'}));
 if(section==='tasks'&&!['coordinator','admin'].includes(c.role??'')){const eligible=await c.db.rpc('tg_eligible_tasks',{p_org:org});if(eligible.error)databaseError(eligible.error.message);const ids=new Set(items.map(i=>i.id));items=[...items,...(eligible.data??[]).filter((i:{id:string})=>!ids.has(i.id))];}
 return{items,total:count??items.length,page};
}
async function detail(c:Context,section:string,id:string){
 const table=tableMap[section];if(!table)throw new ApiError(404,'NOT_FOUND','Unknown record type.');idSchema.parse(id);const org=requireOrg(c);if(adminSections.includes(section))staff(c,true);else if(staffSections.includes(section))staff(c);
 const {data,error}=await c.db.from(table).select('*').eq('organization_id',org).eq(section==='users'?'user_id':'id',id).maybeSingle();if(error)databaseError(error.message);if(!data){if(section==='tasks'){const eligible=await c.db.rpc('tg_eligible_tasks',{p_org:org});const task=eligible.data?.find((r:{id:string})=>r.id===id);if(task)return task;}throw new ApiError(404,'NOT_FOUND','The record is not available to your account.');}
 if(section==='users'){const profile=await c.db.from('profiles').select('display_name,email,last_login_at,created_at').eq('id',id).single();Object.assign(data,profile.data??{}, {id});}
 if(section==='reports'||section==='requests'){
  const [attachments,decisions,extractions,links]=await Promise.all(['report_attachments','review_decisions','report_extractions','need_report_links'].map(t=>c.db.from(t).select('*').eq('organization_id',org).eq('report_id',id)));
  const summary=await c.db.rpc('tg_request_summary',{p_org:org,p_report:id});Object.assign(data,summary.data??{});
  Object.assign(data,{attachments:attachments.data??[],decisions:decisions.data??[],extractions:extractions.data??[],need_links:links.data??[]});
 }
 if(section==='tasks'||section==='deliveries'){const {data:events}=await c.db.from('task_events').select('*').eq('organization_id',org).eq('task_id',id).order('created_at');data.events=events??[];}
 return data;
}
export async function handle(request:NextRequest,path:string[]){const requestId=crypto.randomUUID();try{
 const c=await context(request);let [section,id,action]=path;
 if(section==='settings'){section='admin';id='settings';} if(section==='users'&&action==='role'){section='admin';action=id;id='users';}
 if(request.method==='GET'){
  if(section==='reports'&&action==='attachments'){const {data,error}=await c.db.from('report_attachments').select('*').eq('organization_id',requireOrg(c)).eq('report_id',idSchema.parse(id));if(error)databaseError(error.message);return respond({items:(data??[]).map(a=>({...a,url:'/api/v1/attachments/'+a.id}))},requestId);}
  if(section==='users'&&action){staff(c,true);const subject=idSchema.parse(id);let table='reports',column='author_id';if(action==='contributions'){table='resource_offers';column='donor_id';}if(action==='tasks'){table='delivery_tasks';column='volunteer_id';}if(action==='activity'){table='audit_events';column='actor_id';}if(action==='notes'){table='admin_notes';column='subject_id';}const {data,error}=await c.db.from(table).select('*').eq('organization_id',requireOrg(c)).eq(column,subject).limit(50);if(error)databaseError(error.message);return respond({items:data??[]},requestId);}
  if(section==='me'&&!id){const {data:profile,error}=await c.db.from('profiles').select('*').eq('id',c.user.id).single();if(error)databaseError(error.message);return respond({profile,memberships:c.memberships,organizationId:c.org,role:c.role},requestId);}
  if(section==='me'&&id==='history')return respond(await list(c,'history',request),requestId);
  if(section==='workspace')return respond(await list(c,request.nextUrl.searchParams.get('section')??'reports',request),requestId);
  if(section==='volunteers'&&id==='me'){const {data,error}=await c.db.from('volunteer_profiles').select('*').eq('organization_id',requireOrg(c)).eq('user_id',c.user.id).maybeSingle();if(error)databaseError(error.message);return respond(data,requestId);}
  if(section==='volunteers'&&id==='matches'){
   staff(c);const taskId=idSchema.parse(request.nextUrl.searchParams.get('task_id'));const task=await detail(c,'tasks',taskId);
   const {data:volunteers,error}=await c.db.from('volunteer_profiles').select('*,organization_members(status)').eq('organization_id',c.org!);if(error)databaseError(error.message);
   const {data:tasks}=await c.db.from('delivery_tasks').select('volunteer_id,state').eq('organization_id',c.org!);
   const candidates:Volunteer[]=(volunteers??[]).map(v=>({id:v.user_id,active:v.organization_members?.status==='active',approved:v.approved,availableUntil:v.available_until,skills:v.skills,areas:v.areas,capacity:v.capacity,maxTasks:v.max_tasks,activeTasks:(tasks??[]).filter(t=>t.volunteer_id===v.user_id&&!['closed','cancelled_before_pickup'].includes(t.state)).length,distanceKm:null}));
   return respond(matchVolunteers(candidates,{sku:task.sku,quantity:task.quantity,area:task.area,skill:task.required_skill}),requestId);
  }
  if(section==='attachments'&&id){
   const {data:a,error}=await c.db.from('report_attachments').select('*').eq('organization_id',requireOrg(c)).eq('id',idSchema.parse(id)).single();if(error||!a)throw new ApiError(404,'NOT_FOUND','Attachment not available.');
   const {data:file,error:downloadError}=await c.db.storage.from('report-evidence').download(a.path);if(downloadError||!file)throw new ApiError(404,'NOT_FOUND','Attachment upload is unavailable.');
   const safe=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25_000_000}).rotate().webp().toBuffer();return new NextResponse(new Uint8Array(safe),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(section==='admin'&&id==='export'){staff(c,true);const rows=await list(c,'audit',request);const csv=['action,actor_id,created_at',...rows.items.map(r=>[r.action,r.actor_id,r.created_at].map(csvCell).join(','))].join('\r\n');const exportReq=new NextRequest(request.url,{headers:{'Idempotency-Key':crypto.randomUUID()}});await mutate(c,exportReq,'export.record',{});return new NextResponse(csv,{headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="trustgrid-audit.csv"','Cache-Control':'no-store'}});}
  if(section==='admin')return respond(id==='users'&&action?await detail(c,'users',action):await list(c,id??'users',request),requestId);
  return respond(id?await detail(c,section,id):await list(c,section,request),requestId);
 }
 if(section==='reports'&&id&&action==='attachments'){
  requireOrg(c);const limit=5*1024*1024+16384;if(Number(request.headers.get('content-length')??0)>limit)throw new ApiError(413,'TOO_LARGE','Images must be at most 5 MB.');
  // Bound actual multipart bytes as well as declared length.
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let bytes=0;if(!reader)throw new ApiError(422,'EMPTY_BODY','Choose an image.');while(true){const read=await reader.read();if(read.done)break;bytes+=read.value.length;if(bytes>limit){await reader.cancel();throw new ApiError(413,'TOO_LARGE','Image too large.');}chunks.push(read.value);}
  const parsed=new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')??''},body:Buffer.concat(chunks)});const form=await parsed.formData();const file=form.get('file');if(!(file instanceof File)||file.size>5*1024*1024)throw new ApiError(422,'INVALID_FILE','Choose a JPEG, PNG, or WebP up to 5 MB.');
  const processor=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25_000_000});const meta=await processor.metadata();if(!['jpeg','png','webp'].includes(meta.format??''))throw new ApiError(422,'INVALID_FILE','Actual file contents must be JPEG, PNG, or WebP.');
  const image=await processor.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();if(image.length>5*1024*1024)throw new ApiError(422,'INVALID_FILE','Processed image exceeds size limit.');
  const objectPath=`${c.org}/${idSchema.parse(id)}/${crypto.randomUUID()}.webp`;
  const {data:attachmentId,error}=await c.db.rpc('tg_attachment',{p_org:c.org,p_report:id,p_path:objectPath,p_mime:'image/webp',p_size:image.length});if(error)databaseError(error.message);
  const upload=await c.db.storage.from('report-evidence').upload(objectPath,image,{contentType:'image/webp',upsert:false});if(upload.error)throw new ApiError(503,'UPLOAD_FAILED','The image upload failed. The report is saved; contact your coordinator to retry the attachment.');
  return respond({id:attachmentId,url:`/api/v1/attachments/${attachmentId}`},requestId,201);
 }
 let input=await body(request);
 if(section==='volunteers'&&id==='me'&&action==='availability'){const raw=input as Record<string,unknown>;input={...raw,areas:raw.areas??[raw.service_area]};}
 if(section==='volunteers'&&action==='approval'){const raw=input as Record<string,unknown>;action='approve';input={...raw,approved:raw.approval_status==='approved'};}
 if(section==='me'&&request.method==='PATCH'){
  const data=profileSchema.parse(input);if(c.org)return respond(await mutate(c,request,'profile.update',data),requestId);
  const {data:profile,error}=await c.db.rpc('tg_profile',{p_data:data});if(error)databaseError(error.message);return respond(profile,requestId);
 }
 if(section==='reports'&&id==='extract'){
  const {text}=z.object({text:z.string().min(3).max(4000)}).parse(input);requireOrg(c);const {data:allowed,error}=await c.db.rpc('tg_rate_limit',{p_action:'extract'});if(error)databaseError(error.message);if(!allowed)throw new ApiError(429,'RATE_LIMIT','AI extraction limit reached for this hour. Use the structured form.');
  let extracted:Awaited<ReturnType<typeof extractReport>>;try{extracted=await extractReport(text);}catch{throw new ApiError(503,'AI_UNAVAILABLE','AI extraction is unavailable. Your original text is preserved; continue with the structured form.');}
  const record=await mutate(c,request,'extraction.save',{original_text:text,draft:extracted.draft,model:extracted.model,schema_version:extracted.schema_version});return respond({...extracted,extraction_id:record.id},requestId);
 }
 if(section==='allocations'&&id==='preview'){
  staff(c);const data=previewSchema.parse(input);const {data:balances,error}=await c.db.rpc('tg_balances',{p_org:c.org});if(error)databaseError(error.message);
  type Need={id:string;sku:string;area:string;uncommitted:number;priority:number;confirmed_at:string;version:number};type Lot={id:string;sku:string;available:number;version:number};
  const needs=(balances.needs as Need[]).filter(n=>data.need_ids.includes(n.id)&&n.sku===data.sku),lots=(balances.lots as Lot[]).filter(l=>data.lot_ids.includes(l.id)&&l.sku===data.sku);
  if(needs.length!==new Set(data.need_ids).size||lots.length!==new Set(data.lot_ids).size)throw new ApiError(422,'INVALID_REFERENCE','Select compatible needs and stock in this organization.');
  const result=allocate(data.policy,needs.map(n=>({id:n.id,area:n.area,demand:n.uncommitted,priority:n.priority,confirmedAt:n.confirmed_at})),lots.reduce((sum,l)=>sum+l.available,0),{targets:data.targets,manual:data.manual});
  const scenario=await mutate(c,request,'scenario.save',{sku:data.sku,policy:data.policy,input:{needs,lots,targets:data.targets,manual:data.manual},result});return respond({...scenario,scenario_id:scenario.id,result},requestId);
 }
 let operation:string|undefined;let data:Record<string,unknown>={};
 if(section==='reports'&&!id){operation='report.create';data=reportSchema.parse(input);}
 else if(section==='reports'&&action==='cancel'){operation='report.cancel';data={...z.object({version,reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='reports'&&action==='review'){staff(c);operation='report.review';data={...reviewSchema.parse(input),id:idSchema.parse(id)};}
 else if(section==='reports'&&action==='relationships'){staff(c);operation='relationship.create';data={...z.object({target_id:idSchema,kind:z.enum(['duplicate','update','conflicting']),reason}).parse(input),source_id:idSchema.parse(id)};}
 else if(section==='relationships'&&action==='reverse'){staff(c);operation='relationship.reverse';data={...z.object({reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='reports'&&id&&request.method==='PATCH'){operation='report.update';data={...reportSchema.extend({version}).parse(input),id:idSchema.parse(id)};}
 else if(section==='offers'&&!id){operation='offer.create';data=offerSchema.parse(input);}
 else if(section==='offers'&&id&&request.method==='PATCH'){operation='offer.update';data={...offerSchema.omit({sku:true}).extend({version}).parse(input),id:idSchema.parse(id)};}
 else if(section==='offers'&&action==='confirm-stock'){staff(c);operation='stock.confirm';data={...z.object({quantity:amount,version,reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='inventory'&&['adjust','reconfirm'].includes(action)){staff(c);operation=`stock.${action}`;data={...z.object({version,reason:reason.optional(),quantity:z.number().int().min(-1000000).max(1000000).optional(),held:z.boolean().optional()}).parse(input),id:idSchema.parse(id)};}
 else if(section==='needs'&&id&&request.method==='PATCH'){staff(c);operation='need.update';data={...z.object({version,target_quantity:amount,priority:z.number().int().min(0).max(5),reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='allocations'&&id==='commit'){staff(c);operation='allocation.commit';data=z.object({scenario_id:idSchema}).parse(input);}
 else if(section==='volunteers'&&id==='me'&&action==='availability'){
  operation='volunteer.update';data=z.object({skills:z.array(z.string().max(80)).max(20),areas:z.array(z.string().max(200)).max(20),capacity:z.record(z.string(),z.number().int().min(0).max(1000000)),max_tasks:z.number().int().min(1).max(10),available_until:z.string().datetime().nullable(),vehicle:z.string().max(100).default('none')}).parse(input);
 }
 else if(section==='volunteers'&&action==='approve'){staff(c);operation='volunteer.approve';data={...z.object({approved:z.boolean(),reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='tasks'&&!id){staff(c);operation='task.create';data=z.object({reservation_id:idSchema,quantity:amount,required_skill:z.string().max(80).optional()}).parse(input);}
 else if(section==='tasks'&&id&&action){
  const taskInput=z.object({version,quantity:amount.optional(),reason:reason.optional(),code:z.string().regex(/^\d{8}$/).optional(),step:z.enum(['pickup','delivery']).optional(),resolution:z.literal('loss').optional(),volunteer_id:idSchema.optional()}).parse(input);
  const allowed=['accept','decline','pickup','en-route','dropoff','receipt','receipt-code','exception','resolve-exception','close','cancel','return','assign','reassign','assisted-receipt','handoff-challenges'];if(!allowed.includes(action))throw new ApiError(404,'NOT_FOUND','Unknown task action.');
  if(['resolve-exception','close','cancel','assign','reassign','assisted-receipt'].includes(action))staff(c);
  operation='task.'+({'handoff-challenges':'challenge','resolve-exception':'resolve'}[action]??action);data={...taskInput,id:idSchema.parse(id)};delete data.code;
  if(['handoff-challenges','pickup','receipt-code'].includes(action)){
   const secret=process.env.HANDOFF_HASH_SECRET;if(!secret||secret.length<32)throw new ApiError(503,'HANDOFF_UNAVAILABLE','Handoff confirmation is not configured.');
   const step=action==='pickup'?'pickup':action==='receipt-code'?'delivery':taskInput.step;if(!step)throw new ApiError(422,'INVALID_INPUT','Select the handoff step.');
   const code=action==='handoff-challenges'?String(createHmac('sha256',secret).update('issue:'+c.org+':'+id+':'+step+':'+request.headers.get('Idempotency-Key')).digest().readUInt32BE(0)%100000000).padStart(8,'0'):taskInput.code;if(!code)throw new ApiError(422,'INVALID_CODE','Enter the participant code.');
   data.digest=createHmac('sha256',secret).update(`${c.org}:${id}:${step}:${code}`).digest('hex');
   if(action==='handoff-challenges'){const result=await mutate(c,request,operation,data);return respond({...result,code,expires_in_seconds:600,label:'Participant confirmation code. Share only with the assigned volunteer.'},requestId);}
  }
 }
 else if(section==='reservations'&&action==='release'){staff(c);operation='reservation.release';data={...z.object({version,reason}).parse(input),id:idSchema.parse(id)};}
 else if(section==='users'&&action==='notes'){staff(c,true);operation='note.create';data={...z.object({body:z.string().min(1).max(2000)}).parse(input),subject_id:idSchema.parse(id)};}
 else if(section==='notifications'&&action==='read'){operation='notification.read';data={id:idSchema.parse(id)};}
 else if(section==='admin'&&id==='users'&&action){staff(c,true);operation='member.update';data={...z.object({role:z.enum(['member','volunteer','coordinator','admin']),status:z.enum(['active','suspended']),reason}).parse(input),id:idSchema.parse(action)};}
 else if(section==='admin'&&id==='notes'){staff(c,true);operation='note.create';data=z.object({subject_id:idSchema,body:z.string().min(1).max(2000)}).parse(input);}
 else if(section==='admin'&&id==='settings'){staff(c,true);operation='settings.update';data=z.object({service_areas:z.array(z.string().min(1).max(200)).max(50),settings:z.object({hold_minutes:z.number().int().min(5).max(120),freshness_hours:z.number().int().min(1).max(168),emergency_contact:z.object({number:z.string().max(40),jurisdiction:z.string().max(100),reviewed_by:z.string().max(100)}).optional()})}).parse(input);}
 if(!operation)throw new ApiError(404,'NOT_FOUND','This operation is not available.');
 return respond(await mutate(c,request,operation,data),requestId);
 }catch(error){return failure(error,requestId);}}

