import {NextRequest,NextResponse} from 'next/server';
import {appOrigin} from '@/lib/env';
import {serverClient} from '@/lib/supabase/server';
export async function POST(request:NextRequest){const origin=appOrigin();if(request.headers.get('origin')!==origin)return NextResponse.json({error:'Invalid origin'},{status:403});await(await serverClient()).auth.signOut();const response=NextResponse.redirect(`${origin}/login`,303);response.cookies.delete('tg-org');response.headers.set('Cache-Control','no-store');response.headers.set('Clear-Site-Data','"cache"');return response;}
