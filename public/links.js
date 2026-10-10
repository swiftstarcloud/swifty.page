const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el};
async function loadLinks(){
 const target=document.querySelector('section[aria-label="My links"]');
 try{
  const response=await fetch('/api/links',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.links)||!Array.isArray(data.fields))throw Error();
  const fragment=document.createDocumentFragment(),groups=new Map();
  for(const entry of data.links){const v=entry.values;if(!v.label||!v.url)continue;let url;try{url=new URL(v.url);if(!['http:','https:'].includes(url.protocol))continue}catch{continue}
   const group=v.group||'Links';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(v);
  }
  let count=1;for(const [group,values]of groups){const label=node('p',undefined,'section-label');label.append(node('span',group),node('span',String(count++).padStart(2,'0')+' / Links'));fragment.append(label);const list=node('div',undefined,'social-list');
   for(const v of values){const a=node('a',undefined,['featured','row','creator','lover'].includes(v.style)?v.style:'row');a.href=v.url;a.target='_blank';a.rel='noopener noreferrer';const icon=node('span',v.symbol||'↗','symbol');icon.setAttribute('aria-hidden','true');const details=node('div');const title=node('div',v.label,'link-title');if(v.adult)title.append(node('span','18+','badge'));details.append(title);if(v.description)details.append(node('div',v.description,'link-desc'));
    for(const field of data.fields.filter(f=>f.key.startsWith('custom_')&&f.is_public)){const value=v[field.key];if(value===undefined||value===null||value==='')continue;details.append(node('div',field.label+': '+(typeof value==='boolean'?(value?'Yes':'No'):String(value)),'link-desc'))}
    const arrow=node('span','↗','arrow');arrow.setAttribute('aria-hidden','true');a.append(icon,details,arrow);list.append(a);
   }fragment.append(list);
  }
  if(!data.links.length)fragment.append(node('p','No links are published yet.','note'));
  if(data.links.some(l=>l.values.adult))fragment.append(node('p','Creator pages are intended for adults 18 and over. Links open in a new tab.','note'));
  target.replaceChildren(fragment);
 }catch{/* The existing links remain visible until the database is connected. */}
}
loadLinks();
