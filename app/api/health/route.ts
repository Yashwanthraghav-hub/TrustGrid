import {NextResponse} from 'next/server';
export function GET(){return NextResponse.json({status:'ok',service:'TrustGrid',version:'1.0.0'},{headers:{'Cache-Control':'no-store'}});}
