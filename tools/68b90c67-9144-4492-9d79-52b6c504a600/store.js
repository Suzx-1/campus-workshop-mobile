'use strict';
window.RecordingStore=(()=>{
 let promise;
 function db(){return promise||(promise=new Promise((resolve,reject)=>{const r=indexedDB.open('campus-recordings-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('records',{keyPath:'id'});r.result.createObjectStore('blobs');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('无法保存录音，请允许网站存储并退出无痕模式'));}));}
 async function tx(stores,mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(stores,mode);let result,error;try{fn(t,v=>result=v,e=>{error=e;t.abort();});}catch(e){error=e;t.abort();}t.oncomplete=()=>resolve(result);t.onerror=t.onabort=()=>reject(error||Error('保存失败，请检查空间；已保存的片段仍保留'));});}
 const list=()=>tx(['records'],'readonly',(t,set)=>{const q=t.objectStore('records').getAll();q.onsuccess=()=>set(q.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));});
 const read=id=>tx(['records'],'readonly',(t,set)=>{const q=t.objectStore('records').get(id);q.onsuccess=()=>set(q.result);});
 async function save(r,files=[]){if(!RecordingCore.validRecord(r))throw Error('记录内容无效，未覆盖原记录');let updated;
  await tx(['records','blobs'],'readwrite',(t,set,fail)=>{const s=t.objectStore('records'),q=s.get(r.id);q.onsuccess=()=>{if((q.result?.storageRevision||0)!==(r.storageRevision||0))return fail(Error('另一个窗口修改了记录，请重新打开后再试'));updated={...r,storageRevision:(r.storageRevision||0)+1,updatedAt:new Date().toISOString()};s.put(updated);for(const f of files)t.objectStore('blobs').put(f.blob,f.id);};});Object.assign(r,updated);return r;
 }
 const blob=id=>tx(['blobs'],'readonly',(t,set)=>{const q=t.objectStore('blobs').get(id);q.onsuccess=()=>set(q.result);});
 async function backup(){return tx(['records','blobs'],'readonly',(t,set)=>{const records=t.objectStore('records').getAll(),blobs=t.objectStore('blobs'),files=[];records.onsuccess=()=>{const all=records.result;const ids=all.flatMap(r=>[...r.audio,...r.photos].map(x=>x.id));if(!ids.length)return set({records:all,files});let count=0;for(const id of ids){const q=blobs.get(id);q.onsuccess=()=>{files.push({id,blob:q.result});if(++count===ids.length)set({records:all,files});};}};}).then(async b=>{for(const f of b.files){if(!f.blob)throw Error('缺少录音或照片，无法生成完整备份');f.data=await new Promise((resolve,reject)=>{const x=new FileReader();x.onload=()=>resolve(x.result);x.onerror=reject;x.readAsDataURL(f.blob);});delete f.blob;}return{format:'campus-recording-backup',version:1,...b};});}
 async function restore(b){if(!RecordingCore.validBackup(b))throw Error('备份无效或缺少附件，现有资料未修改');const files=b.files.map(f=>{const [head,data]=f.data.split(','),bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));return{id:f.id,blob:new Blob([bytes],{type:head.slice(5).replace(/;base64$/,'')})};});
  await tx(['records','blobs'],'readwrite',(t,set,fail)=>{const s=t.objectStore('records'),q=s.getAll();q.onsuccess=()=>{if(q.result.some(r=>['recording','paused'].includes(r.status)))return fail(Error('有录音正在进行，请结束后再恢复'));if(b.records.some(r=>q.result.some(x=>x.id===r.id)))return fail(Error('存在同名记录编号，请在其他设备恢复，避免覆盖现有资料'));for(const r of b.records)s.put({...r,storageRevision:1,status:r.status==='recording'||r.status==='paused'?'interrupted':r.status});for(const f of files)t.objectStore('blobs').put(f.blob,f.id);};});
 }
 return{read,list,save,blob,backup,restore};
})();
