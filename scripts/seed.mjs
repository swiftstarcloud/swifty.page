import {writeFile} from 'node:fs/promises';
const fields=[
 ['label','Label','text',true],['url','URL','url',true],['description','Description','text',false],['symbol','Icon / symbol','text',false],['group','Section','text',false],['style','Display style','select',false,['featured','row','creator','lover']],['adult','18+ badge','boolean',false],['published','Published','boolean',false],['position','Sort order','number',false]
].map(([key,label,type,required,options=[]],position)=>({key,label,type,required,is_public:true,options,position}));
const rows=[
 ['telegram','Chat on Telegram','https://t.me/noodboi','Say hi · Feedback · Collaborations','↗',"Let's connect",'featured',false],
 ['instagram','Instagram','https://www.instagram.com/dereknaked','@dereknaked','◎','Follow along','row',false],
 ['bluesky','Bluesky','https://bsky.app/profile/noodboi.com','@noodboi.com','☁','Follow along','row',false],
 ['x','X / Twitter','https://x.com/noodboi','@noodboi','𝕏','Follow along','row',false],
 ['snapchat','Snapchat','https://www.snapchat.com/@dreckr','@dreckr','◌','Follow along','row',false],
 ['jff','JustFor.Fans','https://linktr.ee/noodboi','Find my page via Linktree','Jf.','More of me','creator',true],
 ['darkfans','Darkfans','https://darkfans.com/noodboi','@noodboi','df.','More of me','creator',true],
 ['kellhole','My fiancé & lover','https://kellhole.com','kellhole.com','♡','People I love','lover',false]
].map(([id,label,url,description,symbol,group,style,adult],position)=>({id,values:{label,url,description,symbol,group,style,adult,published:true,position}}));
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=[...fields.map(f=>`INSERT OR IGNORE INTO fields (key,label,type,required,is_public,options_json,builtin,position) VALUES (${q(f.key)},${q(f.label)},${q(f.type)},${+f.required},1,${q(JSON.stringify(f.options))},1,${f.position});`),...rows.map(r=>`INSERT OR IGNORE INTO links (id,values_json) VALUES (${q(r.id)},${q(JSON.stringify(r.values))});`)];
await writeFile('seed.sql',sql.join('\n')+'\n');
