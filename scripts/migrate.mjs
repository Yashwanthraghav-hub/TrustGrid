import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {connect} from './db.mjs';
const db=await connect();try{
 await db.query("select pg_advisory_lock(hashtext('trustgrid:migrations'))");
 await db.query('create schema if not exists trustgrid_setup;revoke all on schema trustgrid_setup from public;create table if not exists trustgrid_setup.migrations(name text primary key,hash text not null,applied_at timestamptz default now())');
 for(const name of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile(`supabase/migrations/${name}`,'utf8')).replace(/^\uFEFF/,'');const hash=createHash('sha256').update(sql).digest('hex');const prior=(await db.query('select hash from trustgrid_setup.migrations where name=$1',[name])).rows[0];
  if(prior){if(prior.hash!==hash)throw new Error(`Applied migration changed: ${name}. Create a new migration.`);console.log(`Already applied: ${name}`);continue;}
  await db.query('begin');try{await db.query(sql);await db.query('insert into trustgrid_setup.migrations(name,hash)values($1,$2)',[name,hash]);await db.query('commit');console.log(`Applied: ${name}`);}catch(error){await db.query('rollback');throw error;}
 }
}finally{await db.end();}
