import { redirect } from 'next/navigation';
import {cookies} from 'next/headers';
import {configured} from '@/lib/env';
import {serverClient} from '@/lib/supabase/server';
export type Membership={organization_id:string;user_id:string;role:'member'|'volunteer'|'coordinator'|'admin';status:string;organizations:{id:string;name:string;service_areas:string[]}|null};
export async function requireSession(adminOnly=false){
 if(!configured())redirect('/login?error=configuration');
 const db=await serverClient(); const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login?error=session');
 const [{data:profile},{data:memberships}]=await Promise.all([db.from('profiles').select('*').eq('id',user.id).single(),db.from('organization_members').select('*,organizations(id,name,service_areas)').eq('user_id',user.id).eq('status','active')]);
 const members=(memberships??[]) as Membership[];const selected=(await cookies()).get('tg-org')?.value;
 const member=members.find(m=>m.organization_id===selected)??members[0];
 if(adminOnly&&!['admin','coordinator'].includes(member?.role??''))redirect('/dashboard?error=permission');
 return {user,profile,memberships:members,organizationId:member?.organization_id??'',role:member?.role??'member'};
}
