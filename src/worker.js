const security = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY'};
const types = new Set(['text','url','number','boolean','select']);
const coreKeys = new Set(['label','url','description','symbol','group','style','adult','published','position']);
const styles = new Set(['row','featured','creator','lover']);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const json = (data,status=200) => Response.json(data,{status,headers:{...security,'Cache-Control':'no-store'}});
class Problem extends Error { constructor(message,status=400){super(message);this.status=status} }
function object(value){return value && typeof value==='object' && !Array.isArray(value)}
function httpURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}}
async function authorized(request,env){
 if(!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length<32) return false;
 const provided=request.headers.get('Authorization') || '';
 const bytes=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',bytes.encode(provided)),crypto.subtle.digest('SHA-256',bytes.encode('Bearer '+env.ADMIN_TOKEN))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function body(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Problem('Use application/json.',415);
 const reader=request.body?.getReader();if(!reader)throw new Problem('A JSON body is required.');
 const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Problem('Entry is too large.',413)}chunks.push(value)}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
 try{const value=JSON.parse(new TextDecoder().decode(data));if(!object(value))throw Error();return value}catch{throw new Problem('Enter a valid JSON object.')}
}
async function fields(db){return (await db.prepare('SELECT * FROM fields ORDER BY position, key').all()).results.map(f=>({...f,required:!!f.required,is_public:!!f.is_public,builtin:!!f.builtin,options:JSON.parse(f.options_json)}))}
function validateEntry(input,defs){
 if(!object(input.values))throw new Problem('Entry values are required.');
 const out={};const known=new Set(defs.map(f=>f.key));for(const key of Object.keys(input.values))if(!known.has(key))throw new Problem('Unknown field: '+key);
 for(const f of defs){const v=input.values[f.key];if(v===undefined||v===null||v===''){if(f.required)throw new Problem(f.label+' is required.');continue}
 if(f.type==='number'){if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)throw new Problem(f.label+' must be a finite number.')}
 else if(f.type==='boolean'){if(typeof v!=='boolean')throw new Problem(f.label+' must be true or false.')}
 else{if(typeof v!=='string'||v.length>2000)throw new Problem(f.label+' must be text under 2,000 characters.');if(f.type==='url'&&!httpURL(v))throw new Problem(f.label+' must be an HTTP or HTTPS URL.');if(f.type==='select'&&!f.options.includes(v))throw new Problem('Choose a valid '+f.label+'.')}
 out[f.key]=v;
 }
 if(out.label?.trim()==='')throw new Problem('Label is required.');
 if(out.style&&!styles.has(out.style))throw new Problem('Choose a valid display style.');
 out.published=out.published??false;out.adult=out.adult??false;out.position=out.position??0;out.group=out.group||'Links';out.style=out.style||'row';return out;
}
function validateField(input){
 const {key,label,type}=input;
 if(typeof key!=='string'||!/^custom_[a-z][a-z0-9_]{0,39}$/.test(key))throw new Problem('Field key must start with custom_ and use lowercase letters, numbers, and underscores.');
 if(typeof label!=='string'||!label.trim()||label.length>80)throw new Problem('Field label must be between 1 and 80 characters.');
 if(!types.has(type))throw new Problem('Choose a supported field type.');
 if(typeof input.required!=='boolean'||typeof input.is_public!=='boolean')throw new Problem('Required and public must be true or false.');
 const options=type==='select'?input.options:[];
 if(!Array.isArray(options)||options.length>40||options.some(o=>typeof o!=='string'||!o.trim()||o.length>80)||new Set(options).size!==options.length||(type==='select'&&!options.length))throw new Problem('Dropdown options must be unique nonempty text values (up to 40).');
 return {key,label:label.trim(),type,required:input.required,is_public:input.is_public,options};
}
function publicEntry(row,defs){const values=JSON.parse(row.values_json);const safe={};for(const f of defs)if(f.is_public&&own(values,f.key))safe[f.key]=values[f.key];return {id:row.id,values:safe}}
async function api(request,env,url){
 const path=url.pathname;const admin=path.startsWith('/api/admin/');
 if(!admin&&path!=='/api/links')return json({error:'Not found.'},404);
 if(admin&&!await authorized(request,env))return json({error:env.ADMIN_TOKEN?'Unauthorized.':'Editor has not been configured.'},env.ADMIN_TOKEN?401:503);
 if(!env.DB)return json({error:'Database has not been connected yet.'},503);
 if(request.method!=='GET'){
  if(request.headers.get('Origin')!==url.origin)return json({error:'Use the editor on this site.'},403);
 }
 const defs=await fields(env.DB);
 if(!admin){if(request.method!=='GET')return json({error:'Method not allowed.'},405);const rows=(await env.DB.prepare("SELECT * FROM links WHERE json_extract(values_json, '$.published') = 1 ORDER BY json_extract(values_json, '$.position'), id").all()).results;return json({fields:defs.filter(f=>f.is_public),links:rows.map(r=>publicEntry(r,defs))})}
 if(path==='/api/admin/data'&&request.method==='GET'){const rows=(await env.DB.prepare("SELECT * FROM links ORDER BY json_extract(values_json, '$.position'), id").all()).results;return json({fields:defs,links:rows.map(r=>({id:r.id,values:JSON.parse(r.values_json),updated_at:r.updated_at,revision:r.revision}))})}
 if(path==='/api/admin/links'&&request.method==='POST'){
  const values=validateEntry(await body(request),defs),id=crypto.randomUUID();await env.DB.prepare('INSERT INTO links (id,values_json) VALUES (?,?)').bind(id,JSON.stringify(values)).run();return json({id,values},201);
 }
 const match=path.match(/^\/api\/admin\/links\/([a-zA-Z0-9-]{1,80})$/);
 if(match&&request.method==='PUT'){
  const data=await body(request);const values=validateEntry(data,defs);if(!Number.isInteger(data.revision))throw new Problem('Reload this entry before editing.');
  const result=await env.DB.prepare("UPDATE links SET values_json=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revision=revision+1 WHERE id=? AND revision=?").bind(JSON.stringify(values),match[1],data.revision).run();if(!result.meta.changes)throw new Problem('This link changed in another session. Reload and try again.',409);return json({id:match[1],values});
 }
 // Links are archived by setting published=false; no destructive delete endpoint.
 if(path==='/api/admin/fields'&&request.method==='POST'){
  const f=validateField(await body(request));if(defs.length>=49)throw new Problem('Up to 40 custom fields are supported.');if(defs.some(d=>d.key===f.key))throw new Problem('This field key already exists.',409);
  if(f.required){const existing=await env.DB.prepare('SELECT COUNT(*) AS total FROM links').first();if(existing.total)throw new Problem('Add the field as optional, fill it on existing entries, then mark it required.')}
  await env.DB.prepare('INSERT INTO fields (key,label,type,required,is_public,options_json,builtin,position) VALUES (?,?,?,?,?,?,0,?)').bind(f.key,f.label,f.type,+f.required,+f.is_public,JSON.stringify(f.options),defs.length).run();return json(f,201);
 }
 const fm=path.match(/^\/api\/admin\/fields\/(custom_[a-z][a-z0-9_]{0,39})$/);
 if(fm&&request.method==='PUT'){
  const data=await body(request),f=validateField({...data,key:fm[1]});const existing=defs.find(d=>d.key===f.key);if(!existing)throw new Problem('Field not found.',404);if(existing.type!==f.type)throw new Problem('Field types cannot change after creation. Add a new field instead.');
  const newDefs=defs.map(d=>d.key===f.key?{...d,...f}:d);const rows=(await env.DB.prepare('SELECT values_json FROM links').all()).results;for(const row of rows)validateEntry({values:JSON.parse(row.values_json)},newDefs);
  await env.DB.prepare('UPDATE fields SET label=?,required=?,is_public=?,options_json=? WHERE key=? AND builtin=0').bind(f.label,+f.required,+f.is_public,JSON.stringify(f.options),f.key).run();return json(f);
 }
 return json({error:'Not found.'},404);
}
export default {async fetch(request,env){const url=new URL(request.url);try{if(url.pathname.startsWith('/api/'))return await api(request,env,url);if(['/admin','/admin/'].includes(url.pathname))url.pathname='/admin.html';const response=await env.ASSETS.fetch(new Request(url,request));const headers=new Headers(response.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);return new Response(response.body,{status:response.status,headers})}catch(error){if(error instanceof Problem)return json({error:error.message},error.status);console.error('Link database request failed');return json({error:'Could not complete the request. Check the database configuration and try again.'},503)}}};
