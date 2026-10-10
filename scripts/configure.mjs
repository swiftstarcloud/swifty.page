import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2);const value=flag=>args[args.indexOf(flag)+1];
if(!args.includes('--database-id')||!args.includes('--worker-name'))throw Error('Usage: node scripts/configure.mjs --worker-name YOUR_EXISTING_WORKER --database-id ACTUAL_D1_UUID');
const id=value('--database-id'),name=value('--worker-name');if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw Error('Use the actual database UUID returned by Cloudflare.');if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name))throw Error('Use the existing Worker name.');
const config=JSON.parse((await readFile('wrangler.jsonc','utf8')).replace(/^\s*\/\/.*$/gm,''));config.name=name;config.d1_databases=[{binding:'DB',database_name:'swifty-page-links',database_id:id,migrations_dir:'migrations'}];await writeFile('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');console.log('Worker and D1 binding configured. No credentials were saved.');
