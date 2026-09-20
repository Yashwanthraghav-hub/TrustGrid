import {requireSession} from "@/lib/auth/session";
import {Shell} from "@/components/layout/shell";
export const dynamic="force-dynamic";
export default async function UserLayout({children}:{children:React.ReactNode}){const s=await requireSession();return <Shell session={{profile:s.profile||{},memberships:s.memberships,organizationId:s.organizationId,role:s.role}}>{children}</Shell>}
