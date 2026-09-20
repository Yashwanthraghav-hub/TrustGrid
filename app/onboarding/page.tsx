import {requireSession} from "@/lib/auth/session";
import {PublicHeader} from "@/components/layout/public";
import {Profile} from "@/components/layout/profile";
export const dynamic="force-dynamic";
export default async function Onboarding(){const s=await requireSession();return <><PublicHeader/><main id="main" className="public-main" style={{paddingTop:40,paddingBottom:60}}><Profile onboarding org={s.organizationId} profile={s.profile||{}}/></main></>}
