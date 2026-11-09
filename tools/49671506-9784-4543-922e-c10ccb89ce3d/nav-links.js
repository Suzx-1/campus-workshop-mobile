(function(root){
  'use strict';
  // WGS-84（浏览器返回的坐标）→ GCJ-02（高德/腾讯使用）→ BD-09（百度使用）
  const PI=Math.PI,A=6378245.0,EE=0.00669342162296594323,X_PI=PI*3000/180;
  function outOfChina(lat,lng){return lng<72.004||lng>137.8347||lat<0.8293||lat>55.8271;}
  function transformLat(x,y){
    let ret=-100+2*x+3*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    ret+=(20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3;
    ret+=(20*Math.sin(y*PI)+40*Math.sin(y/3*PI))*2/3;
    ret+=(160*Math.sin(y/12*PI)+320*Math.sin(y*PI/30))*2/3;
    return ret;
  }
  function transformLng(x,y){
    let ret=300+x+2*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    ret+=(20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3;
    ret+=(20*Math.sin(x*PI)+40*Math.sin(x/3*PI))*2/3;
    ret+=(150*Math.sin(x/12*PI)+300*Math.sin(x/30*PI))*2/3;
    return ret;
  }
  function wgs84ToGcj02(lat,lng){
    if(!Number.isFinite(lat)||!Number.isFinite(lng))throw Error('坐标无效');
    if(outOfChina(lat,lng))return {lat,lng};
    let dLat=transformLat(lng-105,lat-35),dLng=transformLng(lng-105,lat-35);
    const radLat=lat/180*PI;
    let magic=Math.sin(radLat);magic=1-EE*magic*magic;
    const sqrtMagic=Math.sqrt(magic);
    dLat=(dLat*180)/((A*(1-EE))/(magic*sqrtMagic)*PI);
    dLng=(dLng*180)/(A/sqrtMagic*Math.cos(radLat)*PI);
    return {lat:lat+dLat,lng:lng+dLng};
  }
  function gcj02ToBd09(lat,lng){
    if(!Number.isFinite(lat)||!Number.isFinite(lng))throw Error('坐标无效');
    const z=Math.sqrt(lng*lng+lat*lat)+0.00002*Math.sin(lat*X_PI);
    const theta=Math.atan2(lat,lng)+0.000003*Math.cos(lng*X_PI);
    return {lat:z*Math.sin(theta)+0.006,lng:z*Math.cos(theta)+0.0065};
  }
  const fixed=n=>Number(n).toFixed(6);
  function encode(value){return encodeURIComponent(value||'');}
  // 高德网页版：from 必填，否则移动端只能让用户手动输入起点
  function buildAmapWebUrl({from,to,toName,mode='walk'}={}){
    if(!to)throw Error('缺少终点坐标');
    const parts=[];
    if(from)parts.push(`from=${fixed(from.lng)},${fixed(from.lat)},${encode('我的位置')}`);
    parts.push(`to=${fixed(to.lng)},${fixed(to.lat)},${encode(toName||'停车点')}`);
    parts.push(`mode=${mode==='car'?'car':mode==='bus'?'bus':mode==='ride'?'ride':'walk'}`);
    parts.push('src=campus-parking','callnative=0');
    return `https://uri.amap.com/navigation?${parts.join('&')}`;
  }
  // 高德 App 调起：不含坐标参数时起点自动取设备当前位置
  function buildAmapAppUrl({from,to,toName,mode='walk'}={}){
    if(!to)throw Error('缺少终点坐标');
    const t=mode==='car'?0:mode==='bus'?1:mode==='ride'?3:2;
    const q=[`dlat=${fixed(to.lat)}`,`dlon=${fixed(to.lng)}`,`dname=${encode(toName||'停车点')}`,'dev=0',`t=${t}`];
    if(from)q.push(`slat=${fixed(from.lat)}`,`slon=${fixed(from.lng)}`,`sname=${encode('我的位置')}`);
    return `amapuri://route/plan/?${q.join('&')}`;
  }
  // 百度 direction：坐标需为 BD-09
  function buildBaiduUrl({from,to,toName,mode='walk'}={}){
    if(!to)throw Error('缺少终点坐标');
    const q=[];
    if(from)q.push(`origin=${encode(`latlng:${fixed(from.lat)},${fixed(from.lng)}|name:我的位置`)}`);
    q.push(`destination=${encode(`latlng:${fixed(to.lat)},${fixed(to.lng)}|name:${toName||'停车点'}`)}`);
    q.push(`mode=${mode==='car'?'driving':'walking'}`,'output=html','src=webapp.campus.parking');
    return `https://api.map.baidu.com/direction?${q.join('&')}`;
  }
  const api={outOfChina,wgs84ToGcj02,gcj02ToBd09,buildAmapWebUrl,buildAmapAppUrl,buildBaiduUrl};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);
})(typeof window!=='undefined'?window:globalThis);