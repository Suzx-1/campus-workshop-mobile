'use strict';
(()=>{
  const mobile=!!window.CampusDeviceStore,href=mobile?'tools/7b219651-1df9-4b6f-a7b9-105746cc5182/':'/study/index.html';
  function mount(){const main=document.querySelector('#main'),nav=document.querySelector('#nav');if(!main)return;
    if(!mobile&&nav&&!nav.querySelector('[data-study-nav]')){const a=document.createElement('a');a.href=href;a.dataset.studyNav='';a.textContent='知行 · 学习中心 ↗';nav.append(a);}
    if(!['','#home'].includes(location.hash)||main.querySelector('#study-entry'))return;
    const section=document.createElement('section');section.className=mobile?'tool':'panel';section.id='study-entry';const h=document.createElement('h2');h.textContent='知行 · 今天想弄懂什么？';const p=document.createElement('p');p.className='note';p.textContent='微积分动态演示、三维与三视图、理论分析、学习计划和笔记。';const form=document.createElement('form');const input=document.createElement('input');input.type='text';input.name='need';input.required=true;input.maxLength=1500;input.placeholder='例如：我想看导数与切线的关系';input.setAttribute('aria-label','学习需求');input.className=mobile?'study-need-input':'';const button=document.createElement('button');button.type='submit';button.className=mobile?'button primary':'btn primary';button.textContent='打开学习辅助 ↗';const link=document.createElement('a');link.href=href;link.className=mobile?'button small':'btn small';link.textContent='浏览课程';form.append(input,button);form.className='study-entry-form';section.append(h,p,form,link);form.addEventListener('submit',e=>{e.preventDefault();location.assign(href+'?need='+encodeURIComponent(input.value));});main.prepend(section);
  }
  const main=document.querySelector('#main'),nav=document.querySelector('#nav');if(main)new MutationObserver(mount).observe(main,{childList:true});if(nav&&!mobile)new MutationObserver(mount).observe(nav,{childList:true});window.addEventListener('hashchange',mount);mount();
})();
