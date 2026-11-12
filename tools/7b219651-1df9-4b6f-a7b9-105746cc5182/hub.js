'use strict';
window.StudyHub=(()=>{
 const H=StudyHubCore;
 let category='',chosen=[],step=1,query='',range='week',kind='keyword',results=null,working=false,requestId=0,connection=null,searchError='';
 let custom=[],showCustom=false,freeType='';
 const selectionNames=()=>[...chosen.map(id=>H.platforms[id].name),...custom.map(p=>p.name)].join('、');
 const standalone=()=>location.pathname.includes('/tools/');
 const btn=(label,action,extra='',cls='primary')=>`<button type="button" class="${cls}" data-hub="${action}" ${extra}>${label}</button>`;
 const go=route=>{if(location.hash==='#'+route)render();else setStudyPage(route);};
 const header=(title,sub)=>heading(title,sub,'ZHIXING · LEARNING STUDIO');
 const profile=()=>H.profile(state.learningProfile||{});
 function home(){return header('让好奇，有处可去。','选择一件想做的事，开启你的学习与探索。')+`<div class="hub-layout"><div><div class="hub-modules"><a class="hub-module hub-feature" href="#integrated"><span class="hub-number">01 / LEARN</span><span class="hub-symbol">知</span><h2>综合性学习</h2><p>与 DeepTutor 一起，把问题变成理解。</p><span class="hub-link">进入学习 →</span></a><a class="hub-module" href="#discover"><span class="hub-number">02 / DISCOVER</span><span class="hub-symbol">↗</span><h2>文献资料查询</h2><p>从专业知识到视频话题、购物信息，逐步找到你需要的来源。</p><span class="hub-link">开始查找 →</span></a><a class="hub-module" href="#modeling"><span class="hub-number">03 / CREATE</span><span class="hub-symbol">◇</span><h2>可视化 3D 交互建模</h2><p>为新的建模工具留好位置。</p><span class="hub-status">待接入插件</span></a></div><p class="hub-foot">持续扩展的学习空间 · 更多工具将在这里生长</p></div><aside class="hub-profile"><span class="eyebrow">YOUR LEARNING PORTRAIT</span><h2>个性化定制</h2><p>一键记录你的学习情况</p><div class="hub-avatar">${state.learningProfile?'已':'＋'}</div><p>${state.learningProfile?E([profile().school,profile().year,profile().major].filter(Boolean).join(' · ')||'学习档案已保存'):'从你的基础、目标和时间出发，让学习更适合你。'}</p>${btn(state.learningProfile?'查看与修改档案':'填写学习档案','profile')}<p class="small">${profile().sync?'已授权向 DeepTutor 同步':'默认只保存在当前设备'}</p></aside></div>`;}
 function integrated(){const p=profile();return header('综合性学习','带着你的问题，进入 DeepTutor。')+`<section class="panel hub-intro"><span class="hub-symbol">知</span><h2>为你而学，从这里开始。</h2><p>对话、解释与学习方案，由本机 DeepTutor 提供。</p><div class="banner">课程背景采用郑州大学公开历史方案与参考目录，不代表全校最新开课表。<a href="#sources">查看来源 →</a></div><p>${p.sync?'本次连接会同步已保存的学习档案，并生成或继续对应学习对话。':'本次仅传送公开课程背景，不发送个人档案。你可先填写档案并授权。'}</p><div class="actions">${btn('进入 DeepTutor ↗','connect',standalone()?'disabled':'')}${btn('个性化定制','profile','','ghost')}</div><p class="small">关闭授权后不会继续发送档案；已同步到 DeepTutor 的历史内容需在那里单独删除。</p><div id="hub-connection" role="status">${standalone()?'手机独立版尚未配置在线 DeepTutor，请在电脑校园工坊使用本机连接。':'需要电脑上的 DeepTutor 与免费模型正在运行。'}</div></section>`;}
 function modeling(){return header('可视化 3D 交互建模','给空间想象，一个可以操作的入口。')+`<section class="panel hub-placeholder"><span class="hub-symbol">◇</span><h2>建模工具，等待接入。</h2><p>这里将接入你选定的建模插件。当前尚未安装新插件。</p><span class="hub-status">待补充工具与功能</span><p class="small">此前的建模草稿与文件仍保留在学习备份中。</p></section>`;}
 function profilePage(){const p=profile();const input=(key,type='text',placeholder='')=>`<label class="field">${E(H.fields[key])}<input name="${key}" type="${type}" maxlength="100" value="${E(p[key])}" placeholder="${E(placeholder)}" ${key==='age'?'min="1" max="120"':''}></label>`;const area=key=>`<label class="field">${E(H.fields[key])}<textarea name="${key}" maxlength="1500" rows="3">${E(p[key])}</textarea></label>`;return header('让我们从认识你开始。','只填写你愿意提供的内容，可随时修改。')+`<form id="hub-profile-form"><section class="panel"><h2>基本情况</h2><div class="fields">${input('school','text','例如：郑州大学')}${input('year','text','例如：大一')}${input('major','text','例如：通信工程')}${input('age','number','选填')}</div></section><section class="panel"><h2>学习方向</h2><div class="fields">${area('subjects')}${area('weak')}${area('goals')}${area('foundation')}</div><div class="fields"><label class="field">每天可投入时间（分钟）<input name="minutes" type="number" min="5" max="720" value="${p.minutes??''}" placeholder="例如：30"></label>${input('deadline','date')}${input('preference','text','例如：可视化、例题、循序渐进')}</div></section><section class="panel hub-consent"><h2>由你决定，信息去哪里。</h2><label class="hub-check"><input type="checkbox" name="sync" ${p.sync?'checked':''}><span>同意一键同步学习档案到其他功能（当前支持 DeepTutor）</span></label><p class="small">仅同步上述档案，不发送笔记和停车记录。保存后会尝试同步；失败可重试。撤销授权仅停止后续发送，不会删除对方已有历史。其他功能接入时另行说明。</p><p class="small">${state.hubSync?'最近同步：'+E(state.hubSync.at)+'（'+(state.hubSync.ok?'成功':'未完成')+'）':'尚未同步'}</p></section><div class="actions"><button class="primary" type="submit">保存学习档案</button><a href="#home" class="button secondary">返回学习首页</a></div><div id="hub-profile-status" role="status"></div></form>`;}
 const manualLinks=()=>chosen.map(id=>{const p=H.platforms[id];return`<a class="button secondary" target="_blank" rel="noopener noreferrer" href="${E(H.searchURL(id,query))}">${E(p.name)}${p.landing?'官网（站内搜索）':'搜索'} ↗</a>`;}).join('')+custom.map(p=>`<a class="button secondary" target="_blank" rel="noopener noreferrer" href="${E(p.url)}">打开${E(p.name)}官网，自行搜索 ↗</a>`).join('')+(category==='general'?`<a class="button secondary" href="https://www.bing.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">通用网页搜索 ↗</a>`:'');
 function resultsHTML(){if(!results)return'';return `<div class="hub-results"><div class="section-head"><h2>检索结果</h2>${btn('导出结果表格','export','','ghost')}</div><p class="small">抓取时间：${E(new Date(results.checkedAt).toLocaleString())} · 不跨平台比较热度 · 不提供未经核实的销量排名</p>${results.groups.map(g=>`<section class="panel"><h3>${E(g.name)}</h3><p class="note">${E(g.basis||g.reason)}</p>${g.status==='ok'?(g.items.length?`<div class="hub-table-wrap"><table class="hub-table"><thead><tr><th>标题 / 内容</th><th>热度依据</th><th>发布信息</th><th>来源</th></tr></thead><tbody>${g.items.map(i=>`<tr><td><strong>${E(i.title)}</strong><p>${E(i.summary)}</p></td><td>${E(i.metric)}</td><td>${E(i.author||'未提供作者')}<br>${i.publishedAt?E(new Date(i.publishedAt).toLocaleDateString()):'未提供时间'}</td><td><a href="${E(i.url)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></td></tr>`).join('')}</tbody></table></div>`:'<p>当前没有匹配结果，可调整条件或自己查询。</p>'):'<span class="hub-status">暂不可自动获取</span>'}<div class="actions"><a class="button secondary" href="${E(g.fallback)}" target="_blank" rel="noopener noreferrer">去${E(g.name)}自己查询 ↗</a></div></section>`).join('')}</div>`;}
 function discover(){
  const head=header('你想查找什么？','一次明确一个条件，让每次检索更接近你的需求。');
  const steps=`<ol class="hub-steps" aria-label="查询步骤">${['资料类型','选择平台','明确需求','获取资料'].map((s,i)=>`<li class="${step===i+1?'current':''}">${i+1}. ${s}</li>`).join('')}</ol>`;
  let content='';
  if(step===1)content=`<div class="hub-categories">${Object.entries(H.categories).map(([id,c])=>`<button class="hub-choice" data-hub="category" data-id="${id}"><span class="hub-symbol">${{academic:'书',media:'▷',shopping:'袋'}[id]}</span><h2>${c.name}</h2><p>${c.description}</p><span>选择此类 →</span></button>`).join('')}</div>`;
  if(step===1)content+=`<section class="panel hub-open-path"><h2>还没有明确方向？</h2><p class="note">不用先选类别，直接说说你想找什么。</p><div class="actions">${btn('还不确定，先描述需求','free-need')}${btn('其他需求，自由填写','other-need','','ghost')}</div></section>`;
  if(step===2)content=`<section class="panel"><h2>${H.categories[category]?.name||'其他需求'} · 选择平台</h2><p class="note">可多选。${category==='academic'?'目前先提供 Nature 自行查询入口，你提供的专业网站以后在此接入。':''}</p><div class="hub-platforms">${H.providers(category).map(p=>`<label class="hub-check hub-platform"><input type="checkbox" data-hub-platform="${p.id}" ${chosen.includes(p.id)?'checked':''}><span>${p.name}${p.auto?'':' · 自动检索待接入'}</span></label>`).join('')}</div><div class="actions">${btn('上一步','back','','ghost')}${btn('下一步：填写需求','platform-next')}${btn('不限平台，使用推荐来源','recommended','','ghost')}${btn('其他平台','custom-toggle','','ghost')}</div></section>`;
  if(step===2)content+=`<div class="panel"><p class="small">推荐仅使用现已配置的来源，并不覆盖全网。自填平台仅提供官网入口，不会自动抓取。</p>${custom.map((p,i)=>`<div class="actions"><span>${E(p.name)} · ${E(p.url)}</span>${btn('移除','custom-remove',`data-index="${i}"`,'ghost')}</div>`).join('')}${showCustom?`<form id="hub-platform-form"><label class="field">平台名称<input name="platformName" maxlength="60" required placeholder="例如：你常用的资料网站"></label><label class="field">平台官网网址<input name="platformURL" type="url" required placeholder="https://…"></label><button class="primary" type="submit">添加此平台</button></form>`:''}</div>`;
  if(step===3)content=`<section class="panel"><h2>这次，你想了解什么？</h2><p class="note">已选 ${selectionNames()||'暂不限定平台'}</p><form id="hub-search-form"><label class="field">查询需求<textarea name="query" maxlength="500" required rows="4" placeholder="例如：微积分可视化讲解；或想了解近期热门话题与视频">${E(query)}</textarea></label>${category==='media'?`<div class="fields"><label class="field">检索内容<select name="kind"><option value="keyword" ${kind==='keyword'?'selected':''}>围绕关键词查找视频</option><option value="hot" ${kind==='hot'?'selected':''}>所选平台的当前热门话题 / 视频</option></select></label><label class="field">时间范围<select name="range"><option value="today" ${range==='today'?'selected':''}>近24小时</option><option value="week" ${range==='week'?'selected':''}>近7天</option><option value="all" ${range==='all'?'selected':''}>不限</option></select></label></div><p class="small">热门榜由平台决定时间范围；关键词搜索仅在接口支持时应用时间条件。</p>`:''}<div class="actions">${btn('上一步','back','','ghost')}<button class="primary" type="submit">下一步：选择查询方式</button>${category==='media'?btn('暂时没关键词，先看看热门','browse-hot','','ghost'):''}</div></form></section>`;
  if(step===4)content=`<section class="panel"><h2>${E(query)}</h2><p class="note">${chosen.map(id=>H.platforms[id].name).join('、')} · ${kind==='hot'?'平台当前热门':'关键词检索'}</p><div class="hub-query-modes"><article><h3>平台自动检索</h3><p>可能造成检索质量不佳。获取公开结果、链接与摘要；访问受限时会分别提示。</p>${btn(working?'正在检索…':'自动检索并展示结果','search',working||standalone()||!chosen.length?'disabled':'')}<p class="small">${standalone()?'手机独立版暂无检索后台，请先使用自己查询。':!chosen.length?'当前尚未选择已接入的平台，可先自己查询，或选择下面的资料方向。':'关键词将发送至已选的内置平台；自填平台只提供手动入口，不自动检索。'}</p></article><article><h3>自己查询</h3><p>打开所选平台的搜索页面，自行查看和搜集资料。可能需要登录或验证。</p><div class="actions">${manualLinks()}</div></article></div><div class="actions">${btn('上一步，调整需求','back','','ghost')}${btn('重新选择资料类型','reset','','ghost')}</div></section><div id="hub-search-status" role="status">${working?'正在检索，请稍候…':E(searchError)}</div>${resultsHTML()}`;
  if(step===4&&category==='general')content=`<section class="panel"><h2>可以继续细化，也可以直接搜索</h2><p class="note">你的需求：${E(query)}。按你希望看到的资料形式选择方向；这里不自动猜测或替你决定。</p><div class="actions">${Object.entries(H.categories).map(([id,c])=>btn(c.name,'guided-category',`data-id="${id}"`,'ghost')).join('')}${btn('我知道想去的网站','general-custom','','ghost')}</div></section>`+content;
  return head+steps+content;
 }
 async function request(action,body){if(standalone())throw Error('当前手机独立版尚未配置联网后台，请在电脑使用或选择自己查询');const r=await fetch('/api/study/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let j;try{j=await r.json();}catch{throw Error('学习后台尚未启用，请重新启动校园工坊后重试');}if(!r.ok)throw Error(j.error||'操作未完成');return j;}
 async function sync(){
  if(!state.hubClientId)await change(s=>s.hubClientId=crypto.randomUUID());
  const p=profile();const payload={clientId:state.hubClientId,consent:p.sync};if(p.sync)payload.profile=p;
  const result=await request('connect',payload);connection=result;
  if(p.sync)await change(s=>s.hubSync={ok:true,at:new Date().toLocaleString(),url:result.url});
  return result;
 }
 document.addEventListener('change',e=>{if(e.target.dataset.hubPlatform){const id=e.target.dataset.hubPlatform;chosen=chosen.filter(x=>x!==id);if(e.target.checked)chosen.push(id);}});
 document.addEventListener('click',e=>{if(e.target.closest('#campus-step-back')&&location.hash==='#discover'&&step>1){e.preventDefault();e.stopImmediatePropagation();step--;requestId++;working=false;render();}},true);
 document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-hub]');if(!el||el.disabled)return;const action=el.dataset.hub;
  try{
   if(action==='profile')return go('profile');
   if(action==='category'){category=el.dataset.id;chosen=[];custom=[];showCustom=false;step=2;results=null;searchError='';kind='keyword';return render();}
   if(action==='platform-next'){if(!chosen.length&&!custom.length)throw Error('请至少选择一个平台');step=3;return render();}
   if(action==='back'){step=category==='general'&&step===3?1:Math.max(1,step-1);requestId++;working=false;return render();}
   if(action==='reset'){step=1;results=null;requestId++;working=false;return render();}
   if(action==='free-need'||action==='other-need'){category='general';freeType=action;chosen=[];custom=[];results=null;searchError='';kind='keyword';step=3;return render();}
   if(action==='recommended'){chosen=H.recommended(category);step=3;toast('使用推荐来源：'+selectionNames());return render();}
   if(action==='custom-toggle'){showCustom=!showCustom;return render();}
   if(action==='custom-remove'){custom.splice(Number(el.dataset.index),1);return render();}
   if(action==='guided-category'){category=el.dataset.id;chosen=[];custom=[];step=2;results=null;return render();}
   if(action==='general-custom'){showCustom=true;step=2;return render();}
   if(action==='browse-hot'){query=String($('#hub-search-form [name=query]').value||'').trim()||'当前热门话题与视频';kind='hot';range='all';step=4;results=null;return render();}
   if(action==='connect'){
    el.disabled=true;const label=el.textContent;el.textContent='正在连接…';
    // Open the window in the user gesture to avoid browser popup blocking.
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    try{const result=await sync();if(tab)tab.location.replace(result.url);const box=$('#hub-connection');if(box)box.innerHTML=`已${result.synced?'同步档案并':''}建立学习对话。<a href="${E(result.url)}" target="_blank" rel="noopener noreferrer">打开 DeepTutor ↗</a>`;}catch(err){tab?.close();throw err;}finally{el.disabled=false;el.textContent=label;}return;
   }
   if(action==='search'){
    working=true;const ticket=++requestId;results=null;searchError='';render();
    try{const result=await request('search',{category,platforms:chosen,query,range,kind});if(ticket===requestId)results=result;}
    catch(err){if(ticket===requestId)searchError=err.message;}
    finally{if(ticket===requestId){working=false;if(location.hash==='#discover')render();}}return;
   }
   if(action==='export'){
    if(!results)return;const cell=s=>'"'+String(s??'').replaceAll('"','""')+'"';
    const rows=[['平台','标题','摘要','热度','来源','检索时间'],...results.groups.flatMap(g=>g.items.map(i=>[g.name,i.title,i.summary,i.metric,i.url,g.checkedAt]))];
    // Protect spreadsheet programs from interpreting third-party text as formulas.
    download('知行检索结果.csv','\uFEFF'+rows.map(row=>row.map(v=>cell(/^[=+@\-\t\r]/.test(String(v))?"'"+v:v)).join(',')).join('\r\n'),'text/csv;charset=utf-8');return;
   }
  }catch(err){toast(err.message,true);const target=$('#hub-search-status')||$('#hub-connection');if(target)target.textContent=err.message;}
 });
 document.addEventListener('submit',async e=>{
  if(!['hub-profile-form','hub-search-form','hub-platform-form'].includes(e.target.id))return;e.preventDefault();const form=e.target,data=new FormData(form);
  try{
   if(form.id==='hub-platform-form'){const p=H.customPlatform(data.get('platformName'),data.get('platformURL'));if(custom.some(x=>x.url===p.url))throw Error('此平台已经添加');if(custom.length>=4)throw Error('一次最多添加4个自选平台');custom.push(p);showCustom=false;return render();}
   if(form.id==='hub-search-form'){query=String(data.get('query')||'').trim();if(!query)throw Error('请填写查询需求');range=String(data.get('range')||'all');kind=String(data.get('kind')||'keyword');step=4;results=null;return render();}
   const p=H.profile({...Object.fromEntries(data),sync:data.has('sync')});const submit=form.querySelector('[type=submit]');submit.disabled=true;
   try{
    await change(s=>{s.learningProfile=p;s.hubSync=undefined;});connection=null;$('#hub-profile-status').textContent='学习档案已保存在当前设备。';toast('学习档案已保存');
    if(p.sync){try{const result=await sync();const box=$('#hub-profile-status');if(box)box.innerHTML=`档案已同步至 DeepTutor，学习对话已保存。<a href="${E(result.url)}" target="_blank" rel="noopener noreferrer">打开学习方案 ↗</a>`;}catch(err){await change(s=>s.hubSync={ok:false,at:new Date().toLocaleString()});const box=$('#hub-profile-status');if(box)box.textContent='档案已本机保存；同步未完成：'+err.message+'。请到综合性学习重试。';}}
   }finally{submit.disabled=false;}
  }catch(err){toast(err.message,true);}
 });
 return{home,integrated,modeling,profile:profilePage,discover};
})();
