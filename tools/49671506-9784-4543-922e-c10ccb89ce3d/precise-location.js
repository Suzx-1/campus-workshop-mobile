(function(root){
  'use strict';
  function acquirePrecisePosition(options={}){
    const geo=options.geolocation||root.navigator?.geolocation;
    const now=options.now||Date.now;
    const setTimer=options.setTimer||setTimeout,clearTimer=options.clearTimer||clearTimeout;
    return new Promise((resolve,reject)=>{
      if(!geo?.watchPosition){reject(Error('浏览器不支持持续定位，请换用手机系统浏览器。'));return;}
      let finished=false,watchId,timer,best=null;
      const cleanup=()=>{if(watchId!==undefined)geo.clearWatch(watchId);if(timer!==undefined)clearTimer(timer);options.signal?.removeEventListener('abort',abort);};
      const finish=(error,value)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(value);};
      const abort=()=>finish(Error('已取消定位，原停车记录未改变。'));
      if(options.signal?.aborted){abort();return;}
      options.signal?.addEventListener('abort',abort,{once:true});
      timer=setTimer(()=>finish(Error(best?`45 秒内未达到 20 米要求。最佳设备估计误差约 ${Math.ceil(best.accuracy)} 米，本次未保存。请开启精确位置，在室外开阔处重试。`:'未获取到有效实时位置，本次未保存。请开启手机定位和浏览器精确位置权限，在室外重试。')),options.timeoutMs??45000);
      try{
        watchId=geo.watchPosition(position=>{
          if(finished)return;
          const c=position.coords||{};const timestamp=position.timestamp;
          if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||!Number.isFinite(c.accuracy)||c.accuracy<=0||!Number.isFinite(timestamp)||now()-timestamp>10000||timestamp-now()>5000)return;
          const value={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,capturedAt:new Date(timestamp).toISOString()};
          if(!best||value.accuracy<best.accuracy)best=value;
          options.onProgress?.(value,best);
          if(value.accuracy<=20)finish(null,value);
        },error=>{
          if(finished)return;
          if(error.code===1)finish(Error('未获精确定位权限，本次未保存。请在手机和浏览器设置中开启位置权限，并选择“精确位置”。'));
          else options.onProgress?.(null,best);
        },{enableHighAccuracy:true,maximumAge:0,timeout:12000});
        if(finished&&watchId!==undefined)geo.clearWatch(watchId);
      }catch(error){finish(Error('无法启动实时定位：'+error.message));}
    });
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={acquirePrecisePosition};else root.acquirePrecisePosition=acquirePrecisePosition;
})(typeof window!=='undefined'?window:globalThis);
