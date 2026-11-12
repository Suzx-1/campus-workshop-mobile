'use strict';
(()=>{
  const CURRENT='e29a1e40b2d708ff',BASE=new URL('./',document.currentScript.src);
  let registration,pending=false,applying=false,checking=false,message='打开时自动检查更新';
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('updates.css',BASE);document.head.append(css);
  const banner=document.createElement('aside');banner.className='campus-update';banner.hidden=true;banner.setAttribute('role','status');banner.innerHTML='<span>新版已准备好，更新后继续使用。</span><button data-campus-update="apply">立即更新</button><button data-campus-update="later">稍后</button>';document.body.append(banner);
  function redraw(){document.querySelectorAll('[data-campus-version]').forEach(el=>{el.querySelector('span').textContent=`版本 ${CURRENT.slice(0,8)} · ${message}`;});}
  function ready(){pending=true;message='发现新版本';banner.hidden=false;redraw();}
  async function check(manual=false){if(checking)return;checking=true;message='正在检查…';redraw();try{
    if(!navigator.onLine)throw Error('当前离线，联网后再检查');
    const response=await fetch(new URL('version.json?t='+Date.now(),BASE),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('暂时无法检查更新，请稍后重试');const release=await response.json();
    if(release.version!==CURRENT){message='正在下载新版本…';redraw();await registration?.update();if(registration?.waiting)ready();else if(!registration?.installing)ready();}
    else{message='已是最新版本';if(manual&&typeof toast==='function')toast(message);}
  }catch(error){message=error.message;if(manual&&typeof toast==='function')toast(message,true);}finally{checking=false;redraw();}}
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-campus-update]');if(!button)return;const action=button.dataset.campusUpdate;if(action==='later'){banner.hidden=true;return;}if(action==='check')return check(true);
    if(action==='apply'){if(typeof busy!=='undefined'&&busy){if(typeof notify==='function')notify('请先完成或取消定位，再更新');return;}button.disabled=true;button.textContent='正在更新…';applying=true;if(registration?.waiting)registration.waiting.postMessage({type:'APPLY_UPDATE'});else location.reload();}
  });
  window.CampusUpdate={version:CURRENT,check,mount(){const settings=document.querySelector('.settings');if(settings&&!document.querySelector('[data-campus-version]')){const item=document.createElement('div');item.className='campus-version';item.dataset.campusVersion='';item.innerHTML='<span></span><button data-campus-update="check">检查更新</button>';settings.after(item);}redraw();}};
  if('serviceWorker' in navigator&&isSecureContext){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();});navigator.serviceWorker.register(new URL('sw.js',BASE),{scope:BASE.pathname,updateViaCache:'none'}).then(reg=>{
    registration=reg;if(reg.waiting)ready();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)ready();if(worker.state==='redundant'){message='新版下载未完成，稍后重试；当前版本仍可用';redraw();}});});check();
  }).catch(()=>{message='暂时无法启用更新，重新联网打开后再试';redraw();});}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('online',()=>check());setInterval(()=>{if(!document.hidden)check();},120000);
})();
