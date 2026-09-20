import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { configured } from '@/lib/env';
export async function serverClient() {
 if(!configured()) throw new Error('BACKEND_NOT_CONFIGURED');
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:values=>{try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Proxy refreshes cookies for Server Components. */}}}});
}
