import {cp,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
await access('.next/standalone/server.js').catch(()=>{throw new Error('Run npm run build before npm start.');});
await cp('.next/static','.next/standalone/.next/static',{recursive:true});await cp('public','.next/standalone/public',{recursive:true});
const server=spawn(process.execPath,['.next/standalone/server.js'],{stdio:'inherit',env:{...process.env,HOSTNAME:process.env.HOSTNAME||'0.0.0.0',PORT:process.env.PORT||'3000'}});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.kill(signal));server.on('exit',code=>process.exit(code??0));
