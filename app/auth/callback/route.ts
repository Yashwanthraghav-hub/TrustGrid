import {NextRequest,NextResponse} from 'next/server';
import {serverClient} from '@/lib/supabase/server';
import {appOrigin} from '@/lib/env';
import {safeReturnPath} from '@/lib/auth/redirect';
export async function GET(request:NextRequest){
 let origin:string;try{origin=appOrigin();}catch{return NextResponse.json({error:'Application origin is not configured.'},{status:503});}
 const failure=()=>NextResponse.redirect(`${origin}/auth/error?reason=callback`);
 try{const code=request.nextUrl.searchParams.get('code');if(!code||request.nextUrl.searchParams.has('error'))return failure();
 const db=await serverClient();const {error}=await db.auth.exchangeCodeForSession(code);if(error)return failure();
 const {data:{user}}=await db.auth.getUser();if(!user)return failure();const initialized=await db.rpc('tg_session');if(initialized.error)return failure();
 const {data:profile}=await db.from('profiles').select('onboarded').eq('id',user.id).single();
 return NextResponse.redirect(origin+(profile?.onboarded?safeReturnPath(request.nextUrl.searchParams.get('next')):'/onboarding'));
 }catch{return failure();}
}
