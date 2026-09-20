import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {serverClient} from '@/lib/supabase/server';
import {appOrigin,configured} from '@/lib/env';
export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export function respond(data:unknown,requestId:string,status=200){return NextResponse.json({data,error:null,requestId},{status,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});}
export function failure(error:unknown,requestId:string){
 let status=500,code='SERVER_ERROR',message='The request could not be completed. Your inputs have been preserved.';let fields:unknown=undefined;
 if(error instanceof ApiError){status=error.status;code=error.code;message=error.message;}
 else if(error instanceof z.ZodError){status=422;code='INVALID_INPUT';message='Check the highlighted fields.';fields=error.flatten().fieldErrors;}
 return NextResponse.json({data:null,error:{code,message,fields},requestId},{status,headers:{'Cache-Control':'private, no-store'}});
}
export async function context(request:NextRequest){
 if(!configured())throw new ApiError(503,'BACKEND_NOT_CONFIGURED','The organization database is not connected yet. You can explore the read-only demo.');
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==appOrigin())throw new ApiError(403,'INVALID_ORIGIN','Refresh the application on its configured domain and try again.');
 const db=await serverClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new ApiError(401,'AUTH_REQUIRED','Sign in again to continue.');
 const {data:memberships,error:membershipError}=await db.from('organization_members').select('*,organizations(id,name,service_areas,settings)').eq('user_id',user.id).eq('status','active');
 if(membershipError)throw new ApiError(503,'DATABASE_UNAVAILABLE','Memberships could not be loaded. Try again.');
 const requested=request.headers.get('X-Organization-Id')??request.cookies.get('tg-org')?.value;
 const membership=requested?memberships?.find(m=>m.organization_id===requested):memberships?.[0];
 if(requested&&!membership)throw new ApiError(403,'FORBIDDEN','This organization is not available to your account.');
 return {db,user,memberships:memberships??[],org:membership?.organization_id as string|undefined,role:membership?.role as string|undefined};
}
export type Context=Awaited<ReturnType<typeof context>>;
export function requireOrg(c:Context){if(!c.org)throw new ApiError(403,'NO_MEMBERSHIP','Your account is ready. An organization administrator must invite you or configure a public joining workspace.');return c.org;}
export function staff(c:Context,admin=false){requireOrg(c);if(!(admin?['admin']:['admin','coordinator']).includes(c.role??''))throw new ApiError(403,'FORBIDDEN','This action needs an authorized organization '+(admin?'admin.':'coordinator.'));}
export async function body(request:NextRequest,max=32768){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(422,'JSON_REQUIRED','Send a JSON request.');
 const reader=request.body?.getReader();if(!reader)throw new ApiError(422,'EMPTY_BODY','Request data is missing.');let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ApiError(413,'TOO_LARGE','Request is too large.');}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new ApiError(422,'INVALID_JSON','Invalid JSON data.');}
}
export function databaseError(message:string):never {
 const rules:[RegExp,number,string,string][]=[[/AUTH_REQUIRED/,401,'AUTH_REQUIRED','Sign in again.'],[/FORBIDDEN|INELIGIBLE|WORKLOAD|INDEPENDENT/,403,'FORBIDDEN','Your role, availability, participant identity, or capacity does not permit this action.'],[/NOT_FOUND/,404,'NOT_FOUND','The record was not found.'],[/STALE|CONFLICT|ALREADY|OVERCOMMITTED|INSUFFICIENT|UNAVAILABLE|EXPIRED|RECONCILIATION/,409,'CONFLICT','The inputs or eligibility changed. Refresh and review before retrying.'],[/CHALLENGE|INVALID_CODE/,422,'INVALID_CODE','The code is invalid, expired, consumed, or has too many attempts. Ask the authorized participant for a new code.'],[/LAST_ADMIN/,409,'LAST_ADMIN','At least one active organization admin is required.'],[/INVALID|REQUIRED|CUSTODY|QUANTITY|constraint|violates/,422,'INVALID_INPUT','Check quantities, required fields, state, and related organization records.']];
 for(const [regex,status,code,text] of rules)if(regex.test(message))throw new ApiError(status,code,text);
 throw new ApiError(500,'DATABASE_ERROR','The operation could not be committed. No success has been recorded.');
}
export async function mutate(c:Context,request:NextRequest,action:string,data:unknown){
 const org=requireOrg(c),key=request.headers.get('Idempotency-Key');if(!key||key.length<8||key.length>128)throw new ApiError(422,'IDEMPOTENCY_REQUIRED','Supply an Idempotency-Key of 8–128 characters.');
 const {data:allowed,error:rateError}=await c.db.rpc('tg_rate_limit',{p_action:'mutate'});if(rateError)databaseError(rateError.message);if(!allowed)throw new ApiError(429,'RATE_LIMIT','Too many requests. Try again in the next hour.');
 const {data:result,error}=await c.db.rpc('tg_mutate',{p_org:org,p_action:action,p_data:data,p_key:key});if(error)databaseError(error.message);if(result?._error)databaseError(String(result._error));return result;
}
export function csvCell(value:unknown){const text=String(value??'');return '"'+(/^[=+@\-\t\r\n]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';}
