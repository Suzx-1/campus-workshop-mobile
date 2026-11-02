'use strict';
// Loaded only by the independent static build. No server, tokens or shared parking data.
(()=>{
  const BASE=new URL('./',document.currentScript.src),PARKING='49671506-9784-4543-922e-c10ccb89ce3d';
  let database,catalogPromise;
  function db(){return database||(database=new Promise((resolve,reject)=>{const r=indexedDB.open('campus-workshop-device-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('无法使用手机存储，请退出无痕模式并允许网站保存数据'));}));}
  async function transaction(key,change){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('records',change?'readwrite':'readonly'),store=tx.objectStore('records'),r=store.get(key);let result,error;r.onsuccess=()=>{try{result=change?change(r.result):r.result;if(change)store.put(result,key);}catch(e){error=e;tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error||Error('手机存储失败，原有记录未被覆盖，请检查可用空间'));});}
  const preferences=p=>p||{favorites:[],recent:[],theme:'light'};
  const catalog=()=>catalogPromise||(catalogPromise=fetch(new URL('catalog.json',BASE)).then(r=>{if(!r.ok)throw Error('功能目录暂时无法加载，请连接网络重试');return r.json();}).catch(e=>{catalogPromise=null;throw e;}));
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  const snapshot=entry=>({value:entry?.value||null,revision:entry?.revision||'empty',mobileHome:BASE.pathname});
  async function request(url,options={}){
    if(url!=='__campus/storage')return fetch(url,options);
    try{if(options.method==='POST'){const body=JSON.parse(options.body);const entry=await transaction('parking',old=>{if(body.revision!==(old?.revision||'empty'))throw Error('另一个窗口已更新记录，请刷新后再试');if(!validParking(body.value))throw Error('停车记录格式无效');return{value:body.value,revision:crypto.randomUUID()};});return json(snapshot(entry));}return json(snapshot(await transaction('parking')));}catch(e){return json({error:e.message},e.message.startsWith('另一个窗口')?409:400);}
  }
  async function api(route,body){
    if(route==='catalog')return{projects:await catalog(),preferences:preferences(await transaction('preferences'))};
    if(route==='preferences'){
      if(!body)return preferences(await transaction('preferences'));
      if(body.action==='favorite'&&typeof body.favorite==='boolean'&&(await catalog()).some(p=>p.id===body.projectId))return transaction('preferences',old=>{const p=preferences(old);p.favorites=p.favorites.filter(id=>id!==body.projectId);if(body.favorite)p.favorites.push(body.projectId);return p;});
      if(body.action==='theme'&&['light','dark'].includes(body.theme))return transaction('preferences',old=>({...preferences(old),theme:body.theme}));
      throw Error('不支持的设置');
    }
    if(route==='open'&&(await catalog()).some(p=>p.id===body?.projectId)){await transaction('preferences',old=>{const p=preferences(old);p.recent=[{projectId:body.projectId,openedAt:new Date().toISOString()},...p.recent.filter(x=>x.projectId!==body.projectId)].slice(0,30);return p;});return{path:`tools/${body.projectId}/`};}
    throw Error('手机端不支持此操作');
  }
  function validParking(p){return p&&p.version===1&&Array.isArray(p.records)&&Array.isArray(p.places)&&p.records.length<=10000&&p.places.length<=10000&&[...p.records,...p.places].every(r=>r&&typeof r.id==='string'&&typeof r.location==='string'&&Number.isFinite(r.lat)&&Math.abs(r.lat)<=90&&Number.isFinite(r.lng)&&Math.abs(r.lng)<=180);}
  async function backup(){return{format:'campus-mobile-backup',version:1,exportedAt:new Date().toISOString(),preferences:preferences(await transaction('preferences')),parking:await transaction('parking')||null};}
  async function restore(value){
    const p=value?.preferences;
    if(value?.format!=='campus-mobile-backup'||value.version!==1||!p||!Array.isArray(p.favorites)||!p.favorites.every(x=>typeof x==='string')||!Array.isArray(p.recent)||!p.recent.every(x=>x&&typeof x.projectId==='string'&&typeof x.openedAt==='string')||!['light','dark'].includes(p.theme)||(value.parking!==null&&!validParking(value.parking?.value)))throw Error('不是有效的校园工坊手机版备份，原有数据未修改');
    const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('records','readwrite'),s=tx.objectStore('records');s.put(p,'preferences');if(value.parking)s.put({value:value.parking.value,revision:crypto.randomUUID()},'parking');else s.delete('parking');tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('恢复失败，原有数据未修改'));});
  }
  window.CampusDeviceStore={api,request,backup,restore,base:BASE.href,parkingId:PARKING};
})();
