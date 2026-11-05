(function(root){
  'use strict';
  const EARTH_RADIUS=6371000;
  const DEFAULTS=Object.freeze({
    timeoutMs:45000,      // 最长等待时间
    targetAccuracy:20,    // 目标精度（米）
    confirmSamples:3,     // 需要连续多少帧互相印证才采用
    clusterRadius:25,     // 这些帧之间最大允许相距（米）
    historySize:10,       // 保留的最近帧数
    maxAgeMs:10000,       // 比这更旧的帧丢弃
    maxFutureMs:5000      // 比现在晚太多的帧丢弃
  });
  const latOf=p=>p.lat??p.latitude,lngOf=p=>p.lng??p.longitude;
  function metresBetween(a,b){
    const rad=v=>v*Math.PI/180;
    const aLat=latOf(a),aLng=lngOf(a),bLat=latOf(b),bLng=lngOf(b);
    const dLat=rad(bLat-aLat),dLng=rad(bLng-aLng);
    const h=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLng/2)**2;
    return 2*EARTH_RADIUS*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
  }
  // 多帧按 1/accuracy² 加权平均：越可信的帧权重越大，粗定位帧几乎不影响结果
  function merge(samples){
    let weight=0,lat=0,lng=0,best=samples[0];
    for(const s of samples){
      const w=1/(s.accuracy*s.accuracy);
      weight+=w;lat+=s.lat*w;lng+=s.lng*w;
      if(s.accuracy<best.accuracy)best=s;
    }
    return {lat:lat/weight,lng:lng/weight,accuracy:best.accuracy,capturedAt:best.capturedAt};
  }
  function acquirePrecisePosition(options={}){
    const geo=options.geolocation||root.navigator?.geolocation;
    const now=options.now||Date.now;
    const setTimer=options.setTimer||setTimeout,clearTimer=options.clearTimer||clearTimeout;
    const cfg={...DEFAULTS};
    for(const key of Object.keys(DEFAULTS))if(options[key]!==undefined)cfg[key]=options[key];
    return new Promise((resolve,reject)=>{
      if(!geo?.watchPosition){reject(Error('浏览器不支持持续定位，请换用手机系统浏览器。'));return;}
      let finished=false,watchId,timer,best=null;
      const samples=[];
      const cleanup=()=>{if(watchId!==undefined)geo.clearWatch(watchId);if(timer!==undefined)clearTimer(timer);options.signal?.removeEventListener('abort',abort);};
      const finish=(error,value)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(value);};
      const abort=()=>finish(Error('已取消定位，原停车记录未改变。'));
      if(options.signal?.aborted){abort();return;}
      options.signal?.addEventListener('abort',abort,{once:true});
      timer=setTimer(()=>finish(Error(best?`${Math.round(cfg.timeoutMs/1000)} 秒内未达到 ${cfg.targetAccuracy} 米要求。最佳设备估计误差约 ${Math.ceil(best.accuracy)} 米，本次未保存。请开启精确位置，在室外开阔处重试。`:'未获取到有效实时位置，本次未保存。请开启手机定位和浏览器精确位置权限，在室外重试。')),cfg.timeoutMs);
      // 只有连续 confirmSamples 帧彼此足够接近、且其中最好一帧达到目标精度时，才采用
      const acceptIfStable=()=>{
        const recent=samples.slice(-cfg.confirmSamples);
        if(recent.length<cfg.confirmSamples)return;
        for(let i=0;i<recent.length;i++)for(let j=i+1;j<recent.length;j++)if(metresBetween(recent[i],recent[j])>cfg.clusterRadius)return;
        const finest=recent.reduce((a,b)=>a.accuracy<=b.accuracy?a:b);
        if(finest.accuracy>cfg.targetAccuracy)return;
        finish(null,merge(recent));
      };
      const isValid=position=>{
        const c=position?.coords||{},timestamp=position?.timestamp;
        if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return null;
        if(Math.abs(c.latitude)>90||Math.abs(c.longitude)>180)return null;
        if(!Number.isFinite(c.accuracy)||c.accuracy<=0)return null;
        if(!Number.isFinite(timestamp))return null;
        const age=now()-timestamp;
        if(age>cfg.maxAgeMs||age<-cfg.maxFutureMs)return null;
        return {lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,capturedAt:new Date(timestamp).toISOString()};
      };
      try{
        watchId=geo.watchPosition(position=>{
          if(finished)return;
          const value=isValid(position);
          if(!value)return;
          samples.push(value);if(samples.length>cfg.historySize)samples.shift();
          if(!best||value.accuracy<best.accuracy)best=value;
          options.onProgress?.(value,best,samples.slice(-cfg.confirmSamples));
          acceptIfStable();
        },error=>{
          if(finished)return;
          if(error?.code===1)finish(Error('未获精确定位权限，本次未保存。请在手机和浏览器设置中开启位置权限，并选择“精确位置”。'));
          else options.onProgress?.(null,best);
        },{enableHighAccuracy:true,maximumAge:0,timeout:12000});
        if(finished&&watchId!==undefined)geo.clearWatch(watchId);
      }catch(error){finish(Error('无法启动实时定位：'+error.message));}
    });
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={acquirePrecisePosition,metresBetween};else root.acquirePrecisePosition=acquirePrecisePosition;
})(typeof window!=='undefined'?window:globalThis);