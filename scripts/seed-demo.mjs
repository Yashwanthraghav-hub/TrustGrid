import { connect, uuid } from './db.mjs';

const ids = (process.env.DEMO_AUTH_USERS || '').split(',').map(value => value.trim()).filter(Boolean);
if (ids.length < 5) throw new Error('DEMO_AUTH_USERS must contain at least five existing auth UUIDs: admin, two members, and two volunteers.');
ids.forEach((value, index) => uuid(value, `DEMO_AUTH_USERS[${index}]`));

const [admin, northMember, southMember, volunteerA, volunteerB] = ids;
const db = await connect();

try {
  await db.query('begin');
  const found = await db.query('select id from auth.users where id = any($1::uuid[])', [ids]);
  if (found.rowCount !== ids.length) throw new Error('Every DEMO_AUTH_USERS value must be an existing authenticated user. Sign those accounts in first.');

  const existing = await db.query("select id from public.organizations where is_demo and name='TrustGrid Fictional Training' for update");
  if (existing.rowCount) {
    const marker = await db.query("select 1 from public.audit_events where organization_id=$1 and action='demo.seed.v1'", [existing.rows[0].id]);
    if (marker.rowCount) {
      await db.query('rollback');
      console.log(`Demo organization ${existing.rows[0].id} is already seeded; no records changed.`);
      process.exit(0);
    }
    throw new Error('A partially seeded demo organization exists. Inspect it manually; this script will not reset or delete data.');
  }

  const org = (await db.query("insert into public.organizations(name,service_areas,is_demo,joining_policy) values('TrustGrid Fictional Training',array['Sample North','Sample South'],true,'invite') returning id")).rows[0].id;
  const roles = [[admin, 'admin'], [northMember, 'member'], [southMember, 'member'], [volunteerA, 'volunteer'], [volunteerB, 'volunteer']];
  for (const [user, role] of roles) await db.query('insert into public.organization_members(organization_id,user_id,role,approved_by) values($1,$2,$3,$4)', [org, user, role, admin]);

  await db.query("insert into public.volunteer_profiles(organization_id,user_id,approved,skills,areas,capacity,max_tasks,available_until,vehicle) values($1,$2,true,array['lifting'],array['Sample North'],jsonb_build_object('WATER_PACK_6X1L',40),1,now()+interval '8 hours','bicycle'),($1,$3,true,array['lifting','driving'],array['Sample North','Sample South'],jsonb_build_object('WATER_PACK_6X1L',80),2,now()+interval '8 hours','car')", [org, volunteerA, volunteerB]);

  const report = async (author, text, area, quantity, state = 'confirmed') => (await db.query("insert into public.reports(organization_id,author_id,original_text,original_language,kind,area,location_precision,sku,quantity,quantity_meaning,urgency,review_state,review_reason,received_at,updated_at) values($1,$2,$3,'en','need',$4,'area','WATER_PACK_6X1L',$5,'still_needed','urgent',$6,'Fictional training review',now()-interval '3 hours',now()-interval '2 hours') returning id", [org, author, text, area, quantity, state])).rows[0].id;
  const r1 = await report(northMember, 'Sample North hall still needs 50 water packs.', 'Sample North', 50);
  const r2 = await report(northMember, 'The north hall needs fifty packs; this repeats the earlier message.', 'Sample North', 50);
  const conflict = await report(northMember, 'Update says only 35 packs may be needed; please reconfirm.', 'Sample North', 35, 'conflicting');
  const r3 = await report(southMember, 'Sample South school needs 10 water packs.', 'Sample South', 10);
  const northNeed = (await db.query("insert into public.needs(organization_id,sku,area,recipient_id,target_quantity,priority) values($1,'WATER_PACK_6X1L','Sample North',$2,50,5) returning id", [org, northMember])).rows[0].id;
  const southNeed = (await db.query("insert into public.needs(organization_id,sku,area,recipient_id,target_quantity,priority) values($1,'WATER_PACK_6X1L','Sample South',$2,10,3) returning id", [org, southMember])).rows[0].id;
  for (const [need, reportId] of [[northNeed, r1], [northNeed, r2], [northNeed, conflict], [southNeed, r3]]) await db.query('insert into public.need_report_links values($1,$2,$3,$4,now())', [org, need, reportId, admin]);
  await db.query("insert into public.report_relationships(organization_id,source_id,target_id,kind,reason,actor_id) values($1,$2,$3,'duplicate','Same category, area, time window, and normalized quantity',$4),($1,$5,$2,'conflicting','Later self-reported quantity differs and needs reconfirmation',$4)", [org, r2, r1, admin, conflict]);

  const offer = (await db.query("insert into public.resource_offers(organization_id,donor_id,sku,quantity,area,available_until,status,created_at) values($1,$2,'WATER_PACK_6X1L',60,'Sample North',now()+interval '24 hours','confirmed',now()-interval '2 hours') returning id", [org, admin])).rows[0].id;
  const lot = (await db.query("insert into public.inventory_lots(organization_id,offer_id,source_id,sku,area,on_hand,fresh_until,expires_at) values($1,$2,$3,'WATER_PACK_6X1L','Sample North',60,now()+interval '12 hours',now()+interval '24 hours') returning id", [org, offer, admin])).rows[0].id;
  await db.query("insert into public.inventory_movements(organization_id,lot_id,actor_id,kind,quantity,reason,idempotency_key) values($1,$2,$3,'confirm',60,'Fictional training stock confirmed','demo-confirm-v1')", [org, lot, admin]);
  await db.query("insert into public.inventory_lots(organization_id,source_id,sku,area,on_hand,held,confirmed_at,fresh_until,expires_at) values($1,$2,'WATER_PACK_6X1L','Sample South',12,true,now()-interval '30 hours',now()-interval '6 hours',now()+interval '6 hours')", [org, admin]);

  const historicNeed = (await db.query("insert into public.needs(organization_id,sku,area,recipient_id,target_quantity,priority,status,confirmed_at) values($1,'MEAL_KIT','Sample South',$2,10,4,'closed',now()-interval '4 days') returning id", [org, southMember])).rows[0].id;
  const historicLot = (await db.query("insert into public.inventory_lots(organization_id,source_id,sku,area,on_hand,confirmed_at,fresh_until,expires_at) values($1,$2,'MEAL_KIT','Sample South',10,now()-interval '4 days',now()+interval '2 days',now()+interval '2 days') returning id", [org, admin])).rows[0].id;
  const scenario = (await db.query("insert into public.allocation_scenarios(organization_id,author_id,sku,policy,input,result,algorithm_version,created_at) values($1,$2,'MEAL_KIT','minimum_targets',jsonb_build_object('needs',jsonb_build_array(jsonb_build_object('id',$3,'version',1,'uncommitted',10)),'lots',jsonb_build_array(jsonb_build_object('id',$4,'version',1,'available',20))),jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',$3,'quantity',10))),'1.0.0',now()-interval '4 days') returning id", [org, admin, historicNeed, historicLot])).rows[0].id;
  const allocation = (await db.query("insert into public.allocations(organization_id,scenario_id,need_id,sku,quantity,created_at) values($1,$2,$3,'MEAL_KIT',10,now()-interval '4 days') returning id", [org, scenario, historicNeed])).rows[0].id;
  const reservation = (await db.query("insert into public.reservations(organization_id,allocation_id,lot_id,quantity,remaining,expires_at,state,created_at) values($1,$2,$3,10,0,now()-interval '3 days','collected',now()-interval '4 days') returning id", [org, allocation, historicLot])).rows[0].id;
  const task = (await db.query("insert into public.delivery_tasks(organization_id,reservation_id,volunteer_id,source_id,recipient_id,sku,area,quantity,picked_up,received,state,created_at,updated_at) values($1,$2,$3,$4,$5,'MEAL_KIT','Sample South',10,10,10,'closed',now()-interval '4 days',now()-interval '3 days') returning id", [org, reservation, volunteerB, admin, southMember])).rows[0].id;
  await db.query("update public.inventory_lots set on_hand=0 where id=$1", [historicLot]);
  await db.query("insert into public.inventory_movements(organization_id,lot_id,need_id,task_id,actor_id,kind,quantity,reason,created_at) values($1,$2,$3,$4,$5,'confirm',10,'Fictional historical stock',now()-interval '4 days'),($1,$2,$3,$4,$6,'reserve',10,'Fictional approved allocation',now()-interval '4 days'),($1,$2,$3,$4,$7,'pickup',10,'Source participant confirmed pickup',now()-interval '3 days 23 hours'),($1,$2,$3,$4,$5,'receipt',10,'Recipient participant-confirmed receipt',now()-interval '3 days')", [org, historicLot, historicNeed, task, southMember, admin, volunteerB]);
  await db.query("insert into public.task_events(organization_id,task_id,actor_id,action,quantity,created_at) values($1,$2,$3,'task.accept',10,now()-interval '4 days'),($1,$2,$4,'task.pickup',10,now()-interval '3 days 23 hours'),($1,$2,$4,'task.en-route',10,now()-interval '3 days 12 hours'),($1,$2,$5,'task.receipt',10,now()-interval '3 days'),($1,$2,$3,'task.close',10,now()-interval '3 days')", [org, task, admin, volunteerB, southMember]);
  await db.query("insert into public.audit_events(organization_id,actor_id,action,entity_id,reason,changes,correlation_id) values($1,$2,'demo.seed.v1',$1,'Idempotent fictional training dataset',jsonb_build_object('fictional',true),'demo-seed-v1')", [org, admin]);

  await db.query('commit');
  console.log(`Seeded fictional training organization ${org}. No operational organization was changed.`);
} catch (error) {
  await db.query('rollback');
  throw error;
} finally {
  await db.end();
}
