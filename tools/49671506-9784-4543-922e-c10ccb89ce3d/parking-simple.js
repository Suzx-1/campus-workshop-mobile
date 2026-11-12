'use strict';
const $ = s => document.querySelector(s);
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  arrow:'<path d="m3 10 18-7-7 18-3-8z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  pin:'<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15"/>'
};
const setParkingPage=hash=>window.CampusNavigation?CampusNavigation.go(hash):(location.hash=hash);
const I = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
const B = (label, action, icon='', cls='', id='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${id?`data-id="${E(id)}"`:''}>${icon?I(icon):''}${label}</button>`;
const fmt = time => new Date(time).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const hasCoords = r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat)<=90 && Math.abs(r.lng)<=180;
const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
let data = {version:1,records:[],places:[]}, revision = null, busy = false, selectedId = '', query = '', historyStatus = 'all', direction = null, locationController=null;
const sorted = list => [...list].sort((a,b)=>b.parkedAt.localeCompare(a.parkedAt));
const active = () => sorted(data.records.filter(r=>!r.endedAt));
function notify(message,error=false){const el=$('#toast');el.textContent=message;el.className='show'+(error?' error':'');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.className='',error?6500:3500);}
function valid(value){if(!value||value.version!==1||!Array.isArray(value.records)||!Array.isArray(value.places)||[...value.records,...value.places].some(r=>typeof r.id!=='string'||typeof r.location!=='string'))throw Error('停车资料无法读取，请保留备份后检查');return value;}
async function load(){const r=await window.CampusDeviceStore.request('__campus/storage',{cache:'no-store'});const result=await r.json();if(!r.ok)throw Error(result.error||'无法读取手机记录');data=result.value?valid(result.value):{version:1,records:[],places:[]};revision=result.revision;const back=$('#workspace-link');if(result.mobileHome){back.hidden=false;back.href=result.mobileHome;back.target='_self';back.textContent='返回校园工坊';}else if(!['localhost','127.0.0.1'].includes(location.hostname))back.hidden=true;else if(result.workspaceUrl)back.href=result.workspaceUrl;}
async function save(next){const r=await window.CampusDeviceStore.request('__campus/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,value:next})});const result=await r.json();if(!r.ok)throw Error(result.error||'保存失败，请重试');data=next;revision=result.revision;}
function header(title,subtitle){return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div></div>`;}
function empty(title,sub){return `<div class="full-empty">${I('pin')}<h2>${title}</h2><p>${sub}</p></div>`;}
function modal(title,body){$('#dialog-body').innerHTML=`<div class="dialog-head"><h2>${title}</h2><button class="close" data-action="close" aria-label="关闭">×</button></div>${body}`;if(!$('#dialog').open)$('#dialog').showModal();}
function close(){if(busy)return;$('#dialog').close();$('#dialog-body').innerHTML='';}
function confirm(title,body,action,id,label){modal(title,`<p class="dialog-note">${E(body)}</p><div class="form-actions">${B('取消','close')}${B(label,action,'','primary',id)}</div>`);}
function rows(records){return records.map(r=>`<article class="history-item"><span class="location-icon">${I('pin')}</span><div class="grow"><h3>${E(r.location)}</h3><p>${fmt(r.parkedAt)} · ${r.endedAt?(r.endReason==='replaced'?'已更新位置':'已取车'):'正在停车'}</p></div><div class="actions">${B('找车','record-find','arrow','small',r.id)}${B('详情','details','','small',r.id)}</div></article>`).join('');}
function home(){const r=active()[0];return header('停好车，点一下。','位置自动记好，下课直接找车。')+`<section class="simple-hero"><div class="location-orbit" aria-hidden="true">${I('locate')}</div><h2>${r?'再次停车？直接定位就好。':'记住位置，不用填表。'}</h2><p>自动保存当前位置和停车时间</p>${B('直接定位','quick-locate','locate','primary locate-main')}<div id="locate-status" class="simple-status" role="status">仅保存连续多帧一致且设备估计误差 ≤20 米的位置</div></section><div class="simple-links"><a href="#history">${I('clock')}<span>历史记录<small>查看过去的停车位置</small></span><b>↗</b></a><a href="#places">${I('bookmark')}<span>常用地点<small>收藏熟悉的停车点</small></span><b>↗</b></a><a href="#find">${I('arrow')}<span>找车<small>回到最近的停车位置</small></span><b>↗</b></a><a href="#automatic">${I('check')}<span>自动留底<small>课表时段与停车留底</small></span><b>↗</b></a></div>${r?`<section class="simple-current"><div><span class="small-caption">当前停车位置</span><h3>${E(r.location)}</h3><p>${fmt(r.parkedAt)}${r.accuracy?' · 设备估计误差约 '+Math.ceil(r.accuracy)+' 米':''}</p></div><a class="btn green" href="#find">${I('arrow')}找车</a></section>`:''}`;}
function historyResults(){const list=sorted(data.records).filter(r=>(historyStatus==='all'||(historyStatus==='active'?!r.endedAt:!!r.endedAt))&&[r.location,r.notes,r.campus,fmt(r.parkedAt)].some(s=>String(s||'').includes(query)));return list.length?`<div class="history-list">${rows(list)}</div>`:empty('还没有匹配的记录','点一次“直接定位”，停车位置就会保存在这里。');}
function historyPage(){return header('历史记录','每一次停车，都有迹可循。')+`<div class="toolbar"><input id="history-search" type="search" value="${E(query)}" placeholder="搜索地点或日期" aria-label="搜索历史记录"><select id="history-status" aria-label="记录状态"><option value="all" ${historyStatus==='all'?'selected':''}>全部记录</option><option value="active" ${historyStatus==='active'?'selected':''}>正在停车</option><option value="finished" ${historyStatus==='finished'?'selected':''}>已结束</option></select></div><div id="history-results">${historyResults()}</div>`;}
function places(){return header('常用地点','在找车页面收藏位置，下次直接选用。')+(data.places.length?`<div class="place-grid">${data.places.map(p=>`<article class="place"><span class="location-icon">${I('bookmark')}</span><h3>${E(p.location)}</h3>${p.notes?`<p>${E(p.notes)}</p>`:''}<div class="actions">${B('停在这里','use-place','pin','primary small',p.id)}${B('导航','nav-place','arrow','small',p.id)}${B('移除','remove-place','','ghost small',p.id)}</div></article>`).join('')}</div>`:empty('还没有常用地点','直接定位后，在“找车”页面点击“收藏地点”即可。'));}
function distanceHTML(r){const p=direction;if(!p||p.id!==r.id)return '';const rad=v=>v*Math.PI/180,a1=rad(p.lat),a2=rad(r.lat),d=rad(r.lng-p.lng);const h=Math.sin((a2-a1)/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(d/2)**2;const meters=6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));const bearing=(Math.atan2(Math.sin(d)*Math.cos(a2),Math.cos(a1)*Math.sin(a2)-Math.sin(a1)*Math.cos(a2)*Math.cos(d))*180/Math.PI+360)%360;const compass=['北','东北','东','东南','南','西南','西','西北'][Math.round(bearing/45)%8];return `<div class="reference"><h3>车在你的${compass}方向</h3><span class="distance">${meters<1000?Math.round(meters)+' 米':(meters/1000).toFixed(1)+' 公里'}</span><p>直线距离，以正北为基准，不代表步行路线。${meters<((p.accuracy||0)+(r.accuracy||0))?'两点距离小于定位误差，仅供参考。':''}</p></div>`;}
function find(){const list=active();const r=data.records.find(r=>r.id===selectedId)||list[0];return header('找车','打开导航，回到停车的位置。')+(r?`<section class="parking-panel simple-find"><div class="panel-top"><span class="panel-label">${I('pin')}${r.endedAt?'历史停车位置':'当前停车位置'}</span><span class="badge">${r.endedAt?'历史记录':'已记录'}</span></div><div class="current"><h2>${E(r.location)}</h2><div class="current-meta"><span>${I('clock')}${fmt(r.parkedAt)}</span>${r.accuracy?`<span>定位设备估计误差约 ${Math.ceil(r.accuracy)} 米</span>`:''}</div>${r.notes?`<p class="landmark">${E(r.notes)}</p>`:''}${r.photo&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.photo)?`<img class="current-photo" src="${E(r.photo)}" alt="已有停车照片">`:''}${r.accuracy>20?'<p class="position-note">这条旧记录未达到 20 米要求，请回到停车现场重新定位。</p>':''}<div class="actions">${B('导航找车','navigate','arrow','green',r.id)}${hasCoords(r)?B('查看距离和方向','direction','locate','',r.id):''}${!r.endedAt?B('我已取车','finish','check','',r.id):''}</div><div id="direction-result">${distanceHTML(r)}</div><div class="current-secondary">${B('收藏地点','favorite','bookmark','ghost small',r.id)}${B('查看记录','details','','ghost small',r.id)}</div></div></section>${list.filter(x=>x.id!==r.id).length?`<section class="bottom-section"><div class="section-title"><h2>其他未取车辆</h2></div><div class="history-list">${rows(list.filter(x=>x.id!==r.id))}</div></section>`:''}`:empty('还没有当前停车位置','回到首页，点击“直接定位”即可记录。')+`<div class="empty-small"><a class="btn primary" href="#parking">去直接定位</a></div>`);}
function automaticPage(){return header('自动留底','')+`<section class="parking-panel automatic-web"><div class="panel-top"><span class="badge">安卓后台功能</span><button type="button" class="automatic-info" data-action="automatic-help" aria-label="自动留底说明">!</button></div><h2>在校园工坊安卓版中开启</h2><a class="btn primary" href="https://github.com/Suzx-1/campus-workshop-mobile/releases/download/android-v1.1.0/CampusWorkshop-1.1.0.apk">安装校园工坊安卓版</a></section>`;}
function render(){const tab=location.hash.slice(1)||'parking';document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.hash==='#'+tab);if(a.hash==='#'+tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('#app').innerHTML=({history:historyPage,places,find,automatic:automaticPage}[tab]||home)();document.title=({history:'历史记录',places:'常用地点',find:'找车',automatic:'自动留底'}[tab]||'直接定位')+' · 停哪儿';}
async function geo(onProgress){if(!window.isSecureContext)throw Error('请使用 HTTPS 手机网址，当前链接无法获取定位。');locationController=new AbortController();try{return await acquirePrecisePosition({signal:locationController.signal,onProgress});}finally{locationController=null;}}
async function storeParking(position,preset){if(!hasCoords(position)||!Number.isFinite(position.accuracy)||position.accuracy<=0||position.accuracy>20)throw Error('该位置未达到 20 米要求，不会保存。请在现场重新直接定位。');const now=new Date().toISOString();const next=structuredClone(data);for(const r of next.records.filter(r=>!r.endedAt)){r.endedAt=now;r.endReason='replaced';}const record={id:uid(),location:preset?.location||'停车点 · '+fmt(now),campus:preset?.campus||'',notes:preset?.notes||'',vehicle:'other',vehicleName:'',photo:'',lat:position.lat,lng:position.lng,accuracy:position.accuracy,capturedAt:position.capturedAt||preset?.capturedAt||null,parkedAt:now,endedAt:null,endReason:null};next.records.unshift(record);await save(next);selectedId=record.id;direction=null;render();notify('停车位置已保存 · 设备估计误差 '+Math.ceil(position.accuracy)+' 米');}
function quickOrigin(timeoutMs=8000){
  return new Promise(resolve=>{
    let settled=false;
    const done=value=>{if(!settled){settled=true;resolve(value);}};
    if(!window.isSecureContext||!navigator.geolocation){done(null);return;}
    const guard=setTimeout(()=>done(null),timeoutMs+800);
    try{
      navigator.geolocation.getCurrentPosition(p=>{clearTimeout(guard);done({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});},()=>{clearTimeout(guard);done(null);},{enableHighAccuracy:true,maximumAge:30000,timeout:timeoutMs});
    }catch{clearTimeout(guard);done(null);}
  });
}
async function nav(r){
  const name=[r.campus,r.location].filter(Boolean).join(' ');
  const hasTarget=hasCoords(r);
  const note=hasTarget?'打开地图后确认步行路线，校园内小路请结合现场判断。':'这条旧记录没有坐标，会先搜索地点。';
  modal('导航找车',`<p class="dialog-note">${E(name)}</p><div id="nav-state" class="dialog-note">${hasTarget?'正在获取你的当前位置…':'正在准备搜索…'}</div><div class="actions" id="nav-actions"></div><p class="dialog-note">${note}</p>`);
  try{
    if(!hasTarget){
      const state=$('#nav-state'),actions=$('#nav-actions');
      if(!state||!actions)return;
      state.textContent='这条记录没有坐标，将按地点名称搜索。';
      const search=`https://uri.amap.com/search?keyword=${encodeURIComponent(name)}&city=${encodeURIComponent('郑州')}&callnative=0`;
      const baiduSearch=`https://api.map.baidu.com/geocoder?address=${encodeURIComponent(name)}&output=html`;
      actions.innerHTML=`<a class="btn green" href="${E(search)}" target="_blank" rel="noopener noreferrer">高德地图 ↗</a><a class="btn" href="${E(baiduSearch)}" target="_blank" rel="noopener noreferrer">百度地图 ↗</a>`;
      return;
    }
    const origin=await quickOrigin();
    const state=$('#nav-state'),actions=$('#nav-actions');
    if(!state||!actions)return;
    const target=wgs84ToGcj02(r.lat,r.lng);
    const start=origin?wgs84ToGcj02(origin.lat,origin.lng):null;
    const web=buildAmapWebUrl({from:start,to:target,toName:name});
    const app=buildAmapAppUrl({from:start,to:target,toName:name});
    const baidu=buildBaiduUrl({from:start?gcj02ToBd09(start.lat,start.lng):null,to:gcj02ToBd09(target.lat,target.lng),toName:name});
    state.textContent=start?`起点已用当前位置（±${Math.ceil(origin.accuracy)} 米）`:'没能读到当前位置：请在浏览器里允许定位后重试，否则高德会要求手动输入起点。';
    actions.innerHTML=`<a class="btn green" href="${E(web)}" target="_blank" rel="noopener noreferrer">高德地图 ↗</a><a class="btn" href="${E(app)}" rel="noopener noreferrer">高德 App ↗</a><a class="btn" href="${E(baidu)}" target="_blank" rel="noopener noreferrer">百度地图 ↗</a>`;
  }catch(err){notify(err.message,true);}
}
function details(r){modal('停车记录',`<dl class="detail-grid"><dt>位置</dt><dd>${E(r.location)}</dd><dt>停车时间</dt><dd>${fmt(r.parkedAt)}</dd><dt>状态</dt><dd>${r.endedAt?(r.endReason==='replaced'?'已更新位置':'已取车'):'正在停车'}</dd>${hasCoords(r)?`<dt>坐标</dt><dd>${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}</dd>`:''}${r.notes?`<dt>旧记录备注</dt><dd>${E(r.notes)}</dd>`:''}</dl><div class="form-actions">${B('删除记录','delete','trash','danger small',r.id)}${B('找车','record-find','arrow','green',r.id)}</div>`);}
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action,id=el.dataset.id,r=data.records.find(x=>x.id===id),p=data.places.find(x=>x.id===id);if(a==='cancel-location'){locationController?.abort();return;}if(a==='close')return close();if(busy)return;
  try{
    if(a==='automatic-help'){modal('自动留底说明','<p class="dialog-note">手机浏览器在锁屏或关闭页面后可能暂停定位，无法可靠持续识别骑行和停车。请安装校园工坊安卓版，在停哪儿里开启自动留底，并允许定位、运动和后台运行。</p><p class="dialog-note">安装版沿用课表监测时段、自动记录留存和手动记录隔离规则。浏览器与安装版的数据各自保存；安装不会删除原浏览器记录，迁移前请先导出备份。</p>');return;}
    if(a==='retry'){await load();render();return;}
    if(a==='quick-locate'){busy=true;el.disabled=true;el.textContent='正在提高精度…';$('#locate-status').textContent='请保持手机静止，等待连续多帧确认位置（误差 ≤20 米，最多 45 秒）…';$('#locate-status').insertAdjacentHTML('afterend',B('取消定位','cancel-location','','ghost small'));try{const loc=await geo((current,best,recent)=>{if($('#locate-status'))$('#locate-status').textContent=best?`当前设备估计误差 ${Math.ceil((current||best).accuracy)} 米 · 稳定确认 ${Math.min(recent?.length||1,3)}/3 · 目标 ≤20 米`:'等待 GPS 信号，请保持手机静止、页面开启…';});await storeParking(loc);}catch(error){if($('#locate-status'))$('#locate-status').textContent=error.message;throw error;}finally{busy=false;$('[data-action="cancel-location"]')?.remove();const b=$('[data-action="quick-locate"]');if(b){b.disabled=false;b.innerHTML=I('locate')+'直接定位';}}return;}
    if(a==='record-find'){selectedId=id;close();if(location.hash==='#find')render();else setParkingPage('find');return;}
    if(a==='navigate')return nav(r);if(a==='nav-place')return nav(p);if(a==='details')return details(r);
    if(a==='direction'){busy=true;el.disabled=true;el.textContent='正在定位…';try{direction={...await geo(),id};if($('#direction-result'))$('#direction-result').innerHTML=distanceHTML(r);}finally{busy=false;if(el.isConnected){el.disabled=false;el.innerHTML=I('locate')+'更新距离和方向';}}return;}
    if(a==='finish')return confirm('确认取车？','这次记录会留在历史记录中。','confirm-finish',id,'确认取车');
    if(a==='delete')return confirm('删除记录？','这条停车记录将被删除，无法撤销。','confirm-delete',id,'删除记录');
    if(a==='remove-place')return confirm('移除常用地点？','只移除收藏，停车历史会保留。','confirm-remove-place',id,'移除');
    if(a==='use-place')return confirm('停在这个地点？',`将“${p.location}”记为当前停车位置，原位置会保留在历史记录中。`,'confirm-use-place',id,'确认停在这里');
    if(a==='favorite'){if(data.places.some(x=>x.location===r.location&&x.lat===r.lat&&x.lng===r.lng))return notify('这个地点已收藏');modal('收藏地点',`<form id="favorite-form" data-id="${E(id)}"><label class="field"><span>地点名称</span><input name="name" maxlength="100" required value="${E(r.location)}" placeholder="例如：教学楼北侧"></label><div class="form-actions">${B('取消','close')}<button type="submit" class="btn primary">保存收藏</button></div></form>`);return;}
    if(a.startsWith('confirm-')){busy=true;el.disabled=true;try{if(a==='confirm-use-place'){await storeParking({lat:p.lat??null,lng:p.lng??null,accuracy:p.accuracy??null},p);}else{const next=structuredClone(data);if(a==='confirm-finish'){const target=next.records.find(x=>x.id===id);target.endedAt=new Date().toISOString();target.endReason='found';if(selectedId===id)selectedId='';}else if(a==='confirm-delete'){next.records=next.records.filter(x=>x.id!==id);if(selectedId===id)selectedId='';}else if(a==='confirm-remove-place')next.places=next.places.filter(x=>x.id!==id);await save(next);render();notify(a==='confirm-finish'?'已取车，记录已保留':'已更新');}}finally{busy=false;}close();if(a==='confirm-use-place')setParkingPage('find');}
  }catch(err){busy=false;if(el.isConnected)el.disabled=false;notify(err.message,true);}
});
document.addEventListener('submit',async event=>{if(event.target.id!=='favorite-form')return;event.preventDefault();if(busy)return;const form=event.target;const name=new FormData(form).get('name').trim();if(!name)return;const source=data.records.find(r=>r.id===form.dataset.id);const button=form.querySelector('[type="submit"]');busy=true;button.disabled=true;try{const next=structuredClone(data);next.places.unshift({id:uid(),location:name,campus:source.campus||'',notes:source.notes||'',lat:source.lat,lng:source.lng,accuracy:source.accuracy,vehicle:source.vehicle||'other',createdAt:new Date().toISOString()});await save(next);busy=false;close();render();notify('已收藏地点');}catch(err){notify(err.message,true);}finally{busy=false;if(button.isConnected)button.disabled=false;}});
document.addEventListener('input',event=>{if(event.target.id==='history-search'){query=event.target.value;$('#history-results').innerHTML=historyResults();}});
document.addEventListener('change',event=>{if(event.target.id==='history-status'){historyStatus=event.target.value;$('#history-results').innerHTML=historyResults();}});
$('#dialog').addEventListener('cancel',event=>{event.preventDefault();close();});
window.addEventListener('hashchange',()=>{locationController?.abort();render();window.scrollTo(0,0);});
window.addEventListener('pagehide',()=>locationController?.abort());
load().then(render).catch(err=>{$('#app').innerHTML=empty('暂时无法读取停车记录',E(err.message))+`<div class="empty-small">${B('重新连接','retry','','primary')}</div>`;});
