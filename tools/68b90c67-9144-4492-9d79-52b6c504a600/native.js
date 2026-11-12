'use strict';
if(window.AndroidRecording){
 const pending=new Map();
 window.CampusRecorderNative={call(action,value){return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(Error('手机录音服务未响应，请检查录音通知'));},action==='photo'?600000:30000);pending.set(id,{resolve,reject,timer});AndroidRecording.request(JSON.stringify({id,action,...value}));});}};
 window.onNativeRecordingResult=(id,result)=>{const p=pending.get(id);if(!p)return;clearTimeout(p.timer);pending.delete(id);result.error?p.reject(Error(result.error)):p.resolve(result);};
}
