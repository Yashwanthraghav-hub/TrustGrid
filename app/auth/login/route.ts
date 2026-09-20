import {NextRequest,NextResponse} from 'next/server';
import {serverClient} from '@/lib/supabase/server';
import {appOrigin,configured} from '@/lib/env';
import {safeReturnPath} from '@/lib/auth/redirect';
export async function GET(request:NextRequest){
 const fallback=new URL('/auth/error',request.url);
 if(!configured()){fallback.searchParams.set('reason','configuration');return NextResponse.redirect(fallback);}
 try {const origin=appOrigin();const db=await serverClient();const next=safeReturnPath(request.nextUrl.searchParams.get('next'));
 const {data,error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${origin}/auth/callback?next=${encodeURIComponent(next)}`,scopes:'openid email profile',queryParams:{access_type:'online'}}});
 if(error||!data.url)throw new Error('provider');return NextResponse.redirect(data.url);
 }catch{return NextResponse.redirect(fallback);}
}
