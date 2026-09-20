import {connect} from './db.mjs';
const db=await connect();try{const {rows}=await db.query('select tg_expire_all() as expired');console.log(`Expired holds: ${rows[0].expired}`);}finally{await db.end();}
