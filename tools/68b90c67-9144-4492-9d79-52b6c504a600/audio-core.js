(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RecordingAudio=api;})(globalThis,()=>{
 'use strict';
 // Conservative playback aid, not a speech-separation or restoration model.
 function enhance(source,rate){
  if(!source||!Number.isFinite(rate)||rate<8000)throw Error('音频采样率无效');
  const samples=new Float32Array(source.length),a=Math.exp(-2*Math.PI*100/rate);let last=0,previous=0,peak=0,energy=0;
  for(let i=0;i<source.length;i++){const x=Number.isFinite(source[i])?source[i]:0;const y=a*(last+x-previous);previous=x;last=y;samples[i]=y;peak=Math.max(peak,Math.abs(y));energy+=y*y;}
  const rms=Math.sqrt(energy/Math.max(1,samples.length));if(rms<1e-8)return{samples,gainDb:0};
  const gain=Math.min(Math.pow(10,30/20),.12/rms,.95/Math.max(1e-9,peak));
  for(let i=0;i<samples.length;i++)samples[i]*=gain;
  return{samples,gainDb:20*Math.log10(gain)};
 }
 return{enhance};
});
