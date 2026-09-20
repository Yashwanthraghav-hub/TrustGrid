import {NextRequest} from 'next/server';
import {handle} from '@/lib/server/handler';
export const dynamic='force-dynamic';
export const runtime='nodejs';
type RouteContext={params:Promise<{path:string[]}>};
export async function GET(request:NextRequest,context:RouteContext){return handle(request,(await context.params).path);}
export async function POST(request:NextRequest,context:RouteContext){return handle(request,(await context.params).path);}
export async function PATCH(request:NextRequest,context:RouteContext){return handle(request,(await context.params).path);}
