import pg from 'pg';
export async function connect(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing. Obtain the Supabase direct/session-pooler connection string and save it in .env.local. No migration was run.');const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();return c;}
export function uuid(value,name){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value??''))throw new Error(`${name} must be a configured UUID.`);return value;}
