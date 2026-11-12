(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RecordingCore=api;})(globalThis,()=>{
 'use strict';
 const scenes={classroom:'课堂听讲',meeting:'会议交流',general:'通用记录'};
 const uid=()=>globalThis.crypto.randomUUID();
 const finite=n=>Number.isFinite(n)&&n>=0;
 const safe=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(s);
 const time=n=>{n=Math.max(0,Math.floor(Number(n)||0));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].slice(n>=3600?0:1).map(x=>String(x).padStart(2,'0')).join(':');};
 function create(scene){if(!scenes[scene])throw Error('记录场景无效');return{id:uid(),title:scenes[scene]+' · '+new Date().toLocaleString('zh-CN'),scene,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'ready',duration:0,revision:0,storageRevision:0,audio:[],photos:[],marks:[],segments:[],versions:[],interruptions:[]};}
 function windowAt(at,duration){return{start:Math.max(0,at-30),end:Math.min(duration,at+30)};}
 function waveHeader(bytes){
  const h=new Uint8Array(44),v=new DataView(h.buffer);
  for(const [at,value] of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']])h.set([...value].map(c=>c.charCodeAt(0)),at);
  v.setUint32(4,36+bytes,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,bytes,true);return h;
 }
 function editSegment(record,id,text){if(typeof text!=='string'||text.length>10000)throw Error('单段文字过长');const n=structuredClone(record),s=n.segments.find(s=>s.id===id);if(!s)throw Error('段落不存在');s.text=text;n.revision++;n.updatedAt=new Date().toISOString();return n;}
 const stale=(r,v)=>v.revision!==r.revision;
 const teacherEmphasis=text=>/(重点|必须|务必|一定要|考试会考|需要掌握)/.test(text)&&!/(不是|不作为|不算|非|没有|不用|不必|无需).{0,6}(重点|必须|掌握|背|考)/.test(text);
 function validRecord(r){
  if(!r||!safe(r.id)||!scenes[r.scene]||typeof r.title!=='string'||r.title.length>300||!finite(r.duration)||r.duration>24*3600||!Number.isSafeInteger(r.revision)||r.revision<0||!['ready','recording','paused','interrupted'].includes(r.status))return false;
  for(const k of ['audio','photos','marks','segments','versions','interruptions'])if(!Array.isArray(r[k])||r[k].length>20000)return false;
  for(const k of ['audio','photos','marks','segments','versions'])if(r[k].some(x=>!x||!safe(x.id))||new Set(r[k].map(x=>x.id)).size!==r[k].length)return false;
  if(r.audio.some(x=>!finite(x.start)||!finite(x.end)||x.end<x.start||typeof x.mime!=='string'))return false;
  if(r.photos.some(x=>!finite(x.at)||typeof x.name!=='string'||(x.range&&(!finite(x.range.start)||!finite(x.range.end)||x.range.end<x.range.start))))return false;
  if(r.marks.some(x=>!finite(x.at)||!['重点','没听懂'].includes(x.kind)))return false;
  if(r.segments.some(x=>!finite(x.start)||!finite(x.end)||x.end<x.start||typeof x.text!=='string'||x.text.length>10000))return false;
  if(!validVersions(r.versions,r.segments))return false;
  if(r.transcriptHistory!==undefined){
   if(!Array.isArray(r.transcriptHistory)||r.transcriptHistory.length>10)return false;
   for(const h of r.transcriptHistory){
    if(!h||!Array.isArray(h.segments)||h.segments.length>20000||h.segments.some(s=>!s||!safe(s.id)||!finite(s.start)||!finite(s.end)||s.end<s.start||typeof s.text!=='string'||s.text.length>10000)||!validVersions(h.versions,h.segments))return false;
   }
  }
  return true;
 }
 function validVersions(versions,segments){
  const ids=new Set(segments.map(s=>s.id));
  return Array.isArray(versions)&&versions.length<=20000&&versions.every(v=>v&&safe(v.id)&&Number.isSafeInteger(v.revision)&&Array.isArray(v.items)&&v.items.length<=20000&&v.items.every(i=>i&&typeof i.text==='string'&&i.text.length<=10000&&Array.isArray(i.sourceIds)&&i.sourceIds.length<=20000&&i.sourceIds.every(id=>ids.has(id))));
 }
 function validateResult(value,r){
  if(!value||!Array.isArray(value.items)||!value.items.length||value.items.length>300)throw Error('AI 没有返回有效的整理结果，请重试');
  const ids=new Set(r.segments.map(s=>s.id));
  return{items:value.items.map(i=>{if(!i||typeof i.text!=='string'||!i.text.trim()||i.text.length>10000||!Array.isArray(i.sourceIds)||!i.sourceIds.length||i.sourceIds.some(id=>!ids.has(id)))throw Error('AI 返回的内容无法对应原文，请重试');return{text:i.text.trim(),sourceIds:[...new Set(i.sourceIds)],label:['teacher','ai','uncertain','remove'].includes(i.label)?i.label:'ai',heading:typeof i.heading==='string'?i.heading.slice(0,120):''};})};
 }
 function validBackup(b){
  try{if(b?.format!=='campus-recording-backup'||b.version!==1||!Array.isArray(b.records)||b.records.length>500||!b.records.every(validRecord)||!Array.isArray(b.files)||b.files.length>30000)return false;
   if(new Set(b.records.map(r=>r.id)).size!==b.records.length||new Set(b.files.map(f=>f.id)).size!==b.files.length)return false;
   const expected=new Set(b.records.flatMap(r=>[...r.audio,...r.photos].map(x=>x.id)));
   return expected.size===b.files.length&&b.files.every(f=>safe(f.id)&&expected.has(f.id)&&typeof f.data==='string'&&f.data.length<350*1024*1024&&/^data:(audio\/[a-zA-Z0-9.+-]+(?:;codecs=[^;,]+)?|video\/webm|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/]*={0,2}$/.test(f.data));
  }catch{return false;}
 }
 function markdown(r){let out=`# ${r.title}\n\n${scenes[r.scene]} · ${time(r.duration)}\n\n## 原文\n\n`;
  out+=r.segments.map(s=>`[${time(s.start)}–${time(s.end)}] ${s.text}`).join('\n\n');
  if(r.photos.length)out+='\n\n## 图片位置\n\n'+r.photos.map(p=>`- ${time(p.at)} ${p.name}（照片及录音在完整备份中）`).join('\n');
  for(const v of r.versions){out+=`\n\n## ${v.title||v.kind}${stale(r,v)?'（原文已修改，待更新）':''}\n\n`+v.items.map(i=>`${i.heading?'### '+i.heading+'\n\n':''}- ${i.text} [${i.sourceIds.map(id=>time(r.segments.find(s=>s.id===id)?.start)).join(', ')}]`).join('\n\n');}return out;
 }
 return{scenes,uid,time,create,windowAt,waveHeader,editSegment,stale,teacherEmphasis,validRecord,validBackup,validateResult,markdown};
});
