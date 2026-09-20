const required=['APP_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','HANDOFF_HASH_SECRET'];
const optional=['GEMINI_API_KEY','GEMINI_MODEL','DATABASE_URL','SUPABASE_PROJECT_REF','SUPABASE_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET','BOOTSTRAP_ADMIN_USER_ID'];
let missing=false;for(const name of required){const exists=!!process.env[name];console.log(`${name}: ${exists?'configured':'MISSING'}`);missing||=!exists;}
for(const name of optional)console.log(`${name}: ${process.env[name]?'configured':'not configured'}`);
if(process.env.HANDOFF_HASH_SECRET&&process.env.HANDOFF_HASH_SECRET.length<32){console.error('HANDOFF_HASH_SECRET must have at least 32 characters.');missing=true;}
console.log('Google OAuth client secret belongs in Supabase provider settings, never in NEXT_PUBLIC_ variables.');process.exitCode=missing?1:0;
