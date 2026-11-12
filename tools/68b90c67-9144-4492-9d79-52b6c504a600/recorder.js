'use strict';
window.NoteRecorder=class{
 constructor({onChunk,onState,onError,session}){Object.assign(this,{onChunk,onState,onError,session});this.queue=Promise.resolve();this.elapsed=0;this.active=false;this.paused=false;}
 seconds(){return this.elapsed+(this.active&&!this.paused?(performance.now()-this.since)/1000:0);}
 enqueue(blob,meta){this.queue=this.queue.then(()=>this.onChunk(blob,meta)).catch(e=>{this.onError(e);if(this.active)this.stop().catch(()=>{});throw e;});this.queue.catch(()=>{});}
 async start(){
  if(this.active)throw Error('录音已经开始');
  if(window.CampusRecorderNative){await CampusRecorderNative.call('start',{session:this.session});this.native=true;this.active=true;this.since=performance.now();this.onState('recording');return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('当前环境不支持录音，请使用HTTPS打开或导入系统录音');
  this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  const type=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));this.media=new MediaRecorder(this.stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:48000});
  this.group=RecordingCore.uid();let previous=0;
  this.media.ondataavailable=e=>{if(!e.data.size)return;const end=this.seconds();this.enqueue(e.data,{start:previous,end,group:this.group,chunk:true});previous=end;};
  this.media.onerror=()=>this.onError(Error('麦克风录音中断，请检查已保存片段'));
  this.stream.getAudioTracks()[0].onended=()=>{if(this.active)this.onError(Error('麦克风被系统关闭，录音已中断'));this.stop().catch(()=>{});};
  this.active=true;this.since=performance.now();this.media.start(10000);this.onState('recording');
  try{this.wake=await navigator.wakeLock?.request('screen');}catch{}
 }
 async pause(){if(!this.active||this.paused)return;if(this.native)await CampusRecorderNative.call('pause',{session:this.session});else this.media.pause();this.elapsed=this.seconds();this.paused=true;this.onState('paused');}
 async resume(){if(!this.active||!this.paused)return;if(this.native)await CampusRecorderNative.call('resume',{session:this.session});else this.media.resume();this.paused=false;this.since=performance.now();this.onState('recording');}
 async stop(){if(!this.active)return;const elapsed=this.seconds();
  let interruption;
  if(this.native){
   this.active=false;this.paused=false;this.elapsed=elapsed;
   const result=await CampusRecorderNative.call('stop',{session:this.session});
   for(const a of result.files||[]){const response=await fetch(a.url);if(!response.ok)throw Error('读取原生录音失败，可在重新打开后恢复');await this.onChunk(await response.blob(),{start:a.start,end:a.end,group:a.id,chunk:false,nativeFile:a.name});}
   this.elapsed=result.files?.at(-1)?.end??0;interruption=result.interruption;
  }
  else await new Promise(resolve=>{this.media.addEventListener('stop',resolve,{once:true});this.media.stop();});
  if(!this.native)this.elapsed=elapsed;this.active=false;this.paused=false;this.stream?.getTracks().forEach(t=>t.stop());await this.wake?.release().catch(()=>{});await this.queue;this.onState('ready');if(interruption)this.onError(Error(interruption));return this.elapsed;
 }
};
