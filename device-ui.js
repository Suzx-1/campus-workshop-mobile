'use strict';
(()=>{
  window.CampusDeviceUI=()=>{
    const profile=document.querySelector('.profile p');if(profile)profile.textContent='手机独立版 · 无需电脑在线';
    const settings=document.querySelector('.settings');if(settings&&!settings.querySelector('#device-backup'))settings.insertAdjacentHTML('beforeend','<div class="setting"><span>手机数据备份</span><button id="device-backup" data-device="export">导出备份</button></div><div class="setting"><span>从备份恢复</span><button data-device="import">选择文件</button><input type="file" id="device-import" accept="application/json,.json" hidden></div>');
    const note=document.querySelector('.note');if(note)note.textContent='记录保存在当前手机浏览器，不与电脑或其他手机自动同步。清除网站数据、无痕模式或卸载浏览器可能丢失记录，请定期导出备份。修改代码仍在电脑端完成。';window.CampusUpdate?.mount();
  };
  document.addEventListener('click',async event=>{
    const el=event.target.closest('[data-device],[data-action="about"]');if(!el)return;
    event.stopImmediatePropagation();
    try{
      if(el.dataset.action==='about'){modal('手机独立版', '<p>使用固定 HTTPS 网址，无需电脑开机，也无需临时通道。首次联网打开并缓存完成后，平台与停哪儿可离线打开；地图导航仍需要网络。</p><p>停车记录、收藏与外观设置只保存在当前手机浏览器。不同设备相互独立，不会自动同步，也没有账号登录。可通过备份文件手动迁移。</p><p>旧电脑版记录仍在电脑上，不会公开到网站。请定期导出手机备份，避免清除浏览器数据后丢失。</p>');return;}
      if(el.dataset.device==='import'){document.querySelector('#device-import').click();return;}
      const data=await CampusDeviceStore.backup(),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='校园工坊手机备份-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('备份文件已导出，请妥善保存');
    }catch(e){toast(e.message,true);}
  },true);
  document.addEventListener('change',async event=>{if(event.target.id!=='device-import')return;const file=event.target.files[0];if(!file)return;try{if(file.size>21*1024*1024)throw Error('备份文件过大');const value=JSON.parse(await file.text());if(!confirm('恢复备份会替换当前手机的停车记录和收藏，是否继续？'))return;await CampusDeviceStore.restore(value);await refresh();toast('手机备份已恢复');}catch(e){toast(e.message,true);}finally{event.target.value='';}});
})();
