import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const path=request.nextUrl.pathname;
 if(path.startsWith('/dashboard')||path.startsWith('/admin')||path.startsWith('/api/v1')||path.startsWith('/onboarding')) response.headers.set('Cache-Control','private, no-store, max-age=0');
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return response;
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});response.headers.set('Cache-Control','private, no-store, max-age=0');values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await supabase.auth.getUser();
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|brand/|fonts/).*)']};
