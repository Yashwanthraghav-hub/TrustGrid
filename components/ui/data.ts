"use client";
import {useQuery,useQueryClient} from "@tanstack/react-query";
export type Row=Record<string,unknown>;
export function value(row:Row,key:string,fallback="—"){const v=row[key];return v===null||v===undefined||v===""?fallback:typeof v==="object"?JSON.stringify(v):String(v)}
export function number(row:Row,key:string){return Number(row[key]||0)}
export function date(v:unknown){if(!v)return "Unknown";const d=new Date(String(v));return Number.isNaN(d.getTime())?"Unknown":new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",timeZoneName:undefined}).format(d)}
export const skuLabels:Record<string,string>={WATER_PACK_6X1L:"Water packs (6 × 1 L)",MEAL_KIT:"Meal kits",BLANKET:"Blankets",HYGIENE_KIT:"Hygiene kits"};
const pendingKeys=new Map<string,string>();
export async function request<T=Row>(path:string,org:string,method="GET",body?:unknown):Promise<T>{const pendingId=JSON.stringify([org,path,method,body]);const key=pendingKeys.get(pendingId)||crypto.randomUUID();if(method!=="GET")pendingKeys.set(pendingId,key);const response=await fetch(`/api/v1${path}`,{method,credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...(org?{"X-Organization-Id":org}:{}),...(method!=="GET"?{"Idempotency-Key":key}:{} )},...(body!==undefined?{body:JSON.stringify(body)}:{})});let result;try{result=await response.json()}catch{throw new Error("The server could not be reached. Your entries are preserved; try again.")}if(!response.ok||result.error)throw new Error(result.error?.message||`Request failed (${response.status}).`);pendingKeys.delete(pendingId);return result.data as T}
export function useRecords(section:string,org:string,params:Record<string,string|number>={}){const query=new URLSearchParams({section,...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)]))});return useQuery<{items:Row[];total:number;page:number}>({queryKey:["workspace",org,section,params],queryFn:()=>request(`/workspace?${query}`,org),enabled:!!org,refetchInterval:45000})}
export function useRefresh(){const client=useQueryClient();return ()=>client.invalidateQueries({queryKey:["workspace"]})}
