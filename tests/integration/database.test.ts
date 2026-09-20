import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {createDatabase,seed,asUser,mutate,ids} from './database-harness';
let db:PGlite;let report:Record<string,unknown>;let needId:string;let lot:Record<string,unknown>;
const reportData={original_text:'30 water packs still needed at fictional Hall',original_language:'en',kind:'need',area:'Hall',location_precision:'area',sku:'WATER_PACK_6X1L',quantity:30,quantity_meaning:'still_needed',urgency:'normal'};
beforeAll(async()=>{db=await createDatabase();await seed(db);});afterAll(async()=>{await db?.close();});
describe('SQL migrations and authorization on embedded PostgreSQL',()=>{
 it('creates reports idempotently and rejects a changed payload under the same key',async()=>{const key=crypto.randomUUID();report=await mutate(db,ids.member,'report.create',reportData,key);expect((await mutate(db,ids.member,'report.create',reportData,key)).id).toBe(report.id);await expect(mutate(db,ids.member,'report.create',{...reportData,quantity:31},key)).rejects.toThrow('IDEMPOTENCY_CONFLICT');});
 it('RLS hides private records and rejects direct writes',async()=>{expect(await asUser(db,ids.source,'select * from reports')).toHaveLength(0);await expect(asUser(db,ids.member,"update reports set review_state='confirmed' where id=$1",[report.id])).rejects.toThrow();await expect(mutate(db,ids.member,'report.review',{id:report.id,version:1,action:'confirm',reason:'Reviewed',priority:3,target_quantity:30})).rejects.toThrow('FORBIDDEN');});
 it('admin cannot demote the final admin; cross-org references fail',async()=>{await expect(mutate(db,ids.admin,'member.update',{id:ids.admin,role:'member',status:'active',reason:'Test demotion'})).rejects.toThrow('LAST_ADMIN');await expect(asUser(db,ids.member,'select tg_mutate($1,$2,$3,$4)',[ids.other,'report.create',JSON.stringify(reportData),crypto.randomUUID()])).rejects.toThrow('FORBIDDEN');});
 it('review creates one need; repeated confirmation cannot double demand',async()=>{await mutate(db,ids.admin,'report.review',{id:report.id,version:1,action:'confirm',reason:'Reviewed exact quantity',priority:3,target_quantity:30});needId=(await db.query<{id:string}>('select id from needs')).rows[0].id;await expect(mutate(db,ids.admin,'report.review',{id:report.id,version:2,action:'confirm',reason:'Repeat review',priority:3,target_quantity:30})).rejects.toThrow('ALREADY_LINKED');expect((await db.query('select * from needs')).rows).toHaveLength(1);});
 it('stock is separate from an offer and only staff can confirm it',async()=>{const offer=await mutate(db,ids.source,'offer.create',{sku:'WATER_PACK_6X1L',quantity:10,area:'Hall',available_until:'2030-01-01T00:00:00Z'});expect((await db.query('select * from inventory_lots')).rows).toHaveLength(0);lot=await mutate(db,ids.admin,'stock.confirm',{id:offer.id,version:1,quantity:10,reason:'Physical units counted'});expect(lot.on_hand).toBe(10);});
 it('stale scenarios cannot reserve the final stock twice',async()=>{
  const input={needs:[{id:needId,version:1,uncommitted:30}],lots:[{id:lot.id,version:1,available:10}]};const payload={sku:'WATER_PACK_6X1L',policy:'manual',input,result:{rows:[{id:needId,quantity:10}]}};
  const a=await mutate(db,ids.admin,'scenario.save',payload);const b=await mutate(db,ids.admin,'scenario.save',payload);await mutate(db,ids.admin,'allocation.commit',{scenario_id:a.id});await expect(mutate(db,ids.admin,'allocation.commit',{scenario_id:b.id})).rejects.toThrow('STALE_SCENARIO');expect((await db.query<{q:number}>('select sum(remaining)::integer q from reservations')).rows[0].q).toBe(10);
 });
 it('enforces volunteer capacity, actor-bound codes, attempts, partial receipt and custody',async()=>{
  const reservation=(await db.query<{id:string}>('select id from reservations')).rows[0].id;
  const t=await mutate(db,ids.admin,'task.create',{reservation_id:reservation,quantity:10});
  await mutate(db,ids.volunteer,'volunteer.update',{skills:[],areas:['Hall'],capacity:{WATER_PACK_6X1L:20},max_tasks:1,available_until:new Date(Date.now()+3600000).toISOString(),vehicle:'cycle'});
  await expect(mutate(db,ids.volunteer,'task.accept',{id:t.id,version:1})).rejects.toThrow('INELIGIBLE');await mutate(db,ids.admin,'volunteer.approve',{id:ids.volunteer,approved:true});
  await mutate(db,ids.volunteer,'task.accept',{id:t.id,version:1});
  await expect(mutate(db,ids.volunteer,'task.challenge',{id:t.id,version:2,step:'pickup',quantity:10,digest:'secret'})).rejects.toThrow('FORBIDDEN');
  await mutate(db,ids.source,'task.challenge',{id:t.id,version:2,step:'pickup',quantity:10,digest:'secret'});
  expect((await mutate(db,ids.volunteer,'task.pickup',{id:t.id,version:2,digest:'wrong'}))._error).toBe('INVALID_CODE');expect((await db.query<{attempts:number}>('select attempts from handoff_challenges')).rows[0].attempts).toBe(1);
  await mutate(db,ids.volunteer,'task.pickup',{id:t.id,version:2,digest:'secret'});
  expect((await db.query<{on_hand:number}>('select on_hand from inventory_lots')).rows[0].on_hand).toBe(0);
  await expect(mutate(db,ids.volunteer,'task.pickup',{id:t.id,version:2,digest:'secret'})).rejects.toThrow('STALE_VERSION');
  await mutate(db,ids.volunteer,'task.en-route',{id:t.id,version:3});await mutate(db,ids.volunteer,'task.dropoff',{id:t.id,version:4});
  const partial=await mutate(db,ids.member,'task.receipt',{id:t.id,version:5,quantity:6});expect(partial.state).toBe('exception');
  await expect(mutate(db,ids.admin,'task.close',{id:t.id,version:6})).rejects.toThrow('UNRESOLVED_CUSTODY');
  await mutate(db,ids.source,'task.return',{id:t.id,version:6,quantity:4,reason:'Source counted returned packs'});
  await mutate(db,ids.admin,'task.close',{id:t.id,version:7});expect((await db.query<{on_hand:number}>('select on_hand from inventory_lots')).rows[0].on_hand).toBe(4);
  expect((await db.query<{q:number}>("select sum(quantity)::integer q from inventory_movements where kind='receipt'")).rows[0].q).toBe(6);
 });
 it('suspended old sessions cannot mutate or read organization records',async()=>{await mutate(db,ids.admin,'member.update',{id:ids.member,role:'member',status:'suspended',reason:'Test suspension'});await expect(mutate(db,ids.member,'report.create',reportData)).rejects.toThrow('FORBIDDEN');expect(await asUser(db,ids.member,'select * from reports')).toHaveLength(0);});
});

