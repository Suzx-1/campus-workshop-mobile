'use strict';
(()=>{
  const script=document.currentScript,tool=script.dataset.campusTool,base=new URL('./',script.src),home=new URL('#library',base).href;
  let current=location.hash||(tool==='parking'?'#parking':'#home'),trail=[],moving=false,approvedExit=false;
  const BACK='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M14.5 4.5 7 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const bar=document.createElement('div');bar.className='campus-navigation';bar.innerHTML=`<button type="button" id="campus-step-back" aria-label="返回上一级">${BACK}</button>${tool?'<span>逐层返回</span><a id="campus-exit-tool" href="'+home+'">退出工具</a>':''}`;
  if(tool){document.body.prepend(bar);const old=document.querySelector('#workshop-back');if(old)old.hidden=true;const oldParking=document.querySelector('#workspace-link');if(oldParking)oldParking.hidden=true;}
  else document.querySelector('.header')?.prepend(bar);
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('tool-navigation.css',base);document.head.append(style);
  function canLeave(){const event=new Event('campus:before-exit',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented;}
  function finishExit(){location.replace(home);}
  function exit(){if(!canLeave())return;approvedExit=true;if(history.state?.campusGuard)history.back();else finishExit();}
  function go(hash,back=false){hash=hash.startsWith('#')?hash:'#'+hash;if(hash===current)return true;const previous=current;moving=true;history.replaceState(history.state,'',hash);window.dispatchEvent(new HashChangeEvent('hashchange'));moving=false;if(location.hash===hash){if(back)trail.pop();else trail.push(previous);current=hash;}return true;}
  window.CampusNavigation={go,exit};
  bar.querySelector('button').addEventListener('click',()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return;}if(trail.length)go(trail.at(-1),true);else if(tool){const route=location.hash.slice(1);if(route==='lab'){go('#courses');}else if(route&&route!=='home'&&route!=='parking')go(tool==='study'?'#home':'#parking');else exit();}else if(location.hash&&location.hash!=='#home')go('#home');});
  bar.querySelector('a')?.addEventListener('click',event=>{event.preventDefault();exit();});
  document.addEventListener('click',event=>{if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const a=event.target.closest('a[href]');if(!a||a.target==='_blank'||a.download)return;const url=new URL(a.href);if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search&&url.hash){event.preventDefault();go(url.hash);}else if(tool&&url.href===home){event.preventDefault();exit();}},true);
  window.addEventListener('hashchange',()=>{if(moving)return;const hash=location.hash;if(hash!==current){trail.push(current);current=hash;}});
  if(tool){
    if(!history.state?.campusGuard){history.replaceState({campusBase:true},'',location.href);history.pushState({campusGuard:true},'',location.href);}
    window.addEventListener('popstate',()=>{if(approvedExit||canLeave()){approvedExit=true;finishExit();}else history.pushState({campusGuard:true},'',location.href);});
    const parking=document.querySelector('#workspace-link');if(parking)new MutationObserver(()=>{if(!parking.hidden)parking.hidden=true;}).observe(parking,{attributes:true,attributeFilter:['hidden']});
  }
})();
