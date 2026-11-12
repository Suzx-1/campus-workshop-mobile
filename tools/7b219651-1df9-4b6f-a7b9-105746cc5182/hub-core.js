(function(root){
 'use strict';
 const categories={academic:{name:'专业知识',description:'论文、研究成果与专业资料'},media:{name:'多媒体数据',description:'话题、视频与创作趋势'},shopping:{name:'购物信息',description:'商品、口碑与选购线索'}};
 const platforms={
  nature:{name:'Nature',category:'academic',url:q=>'https://www.nature.com/search?q='+q,auto:false},
  bilibili:{name:'哔哩哔哩',category:'media',url:q=>'https://search.bilibili.com/all?keyword='+q,auto:true},
  douyin:{name:'抖音',category:'media',url:q=>'https://www.douyin.com/search/'+q,auto:true},
  kuaishou:{name:'快手',category:'media',url:q=>'https://www.kuaishou.com/search/video?searchKey='+q,auto:false},
  xiaohongshu:{name:'小红书',category:'media',url:q=>'https://www.xiaohongshu.com/search_result?keyword='+q,auto:false},
  taobao:{name:'淘宝',category:'shopping',url:q=>'https://s.taobao.com/search?q='+q,auto:false},
  jd:{name:'京东',category:'shopping',url:q=>'https://search.jd.com/Search?keyword='+q,auto:false},
  pdd:{name:'拼多多',category:'shopping',url:q=>'https://mobile.yangkeduo.com/search_result.html?search_key='+q,auto:false},
  dewu:{name:'得物',category:'shopping',url:q=>'https://www.dewu.com/',auto:false,landing:true}
 };
 const fields={school:'学校',year:'年级',age:'年龄',major:'专业',subjects:'主要学习科目',weak:'薄弱科目与内容',goals:'想学知识与目标',foundation:'目前基础',deadline:'目标日期',preference:'学习偏好'};
 function profile(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('档案格式无效');
  const p={};for(const [key,label] of Object.entries(fields)){const value=input[key]??'';if(typeof value!=='string'||value.length>(['goals','weak','foundation','subjects'].includes(key)?1500:100))throw Error(label+'内容过长或格式无效');p[key]=value.trim();}
  if(p.age&&!/^\d{1,3}$/.test(p.age))throw Error('年龄请填写数字');
  if(p.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(p.deadline))throw Error('目标日期格式无效');
  p.minutes=input.minutes===''||input.minutes==null?null:Number(input.minutes);
  if(p.minutes!==null&&(!Number.isInteger(p.minutes)||p.minutes<5||p.minutes>720))throw Error('每天学习时间需在5至720分钟之间');
  if(input.sync!==undefined&&typeof input.sync!=='boolean')throw Error('同步授权格式无效');
  p.sync=input.sync===true;return p;
 }
 function validProfile(p){try{profile(p);return true;}catch{return false;}}
 function customPlatform(name,url){
  name=String(name||'').trim();if(!name||name.length>60)throw Error('请填写60字以内的平台名称');
  let u;try{u=new URL(url);}catch{throw Error('请填写完整的 HTTPS 平台网址');}
  if(u.protocol!=='https:'||u.username||u.password)throw Error('平台网址需使用 HTTPS，且不能包含账号密码');
  return{name,url:u.href};
 }
 const recommended=category=>({academic:['nature'],media:['bilibili','douyin'],shopping:['taobao','jd']}[category]||[]).slice();
 function courseContext(c){
  return ['郑州大学课程参考（核验日期 '+c.checkedAt+'）','历史专业培养方案与通用课程目录，不代表2026级全校实际开课或任何学生的必修课。请先向学生核实实际课表。',
   '历史通信工程参考课程：'+c.priority.map(p=>p[0]).join('、'),
   '以下是通用学科课程，郑州大学具体开设情况未核实：'+Object.entries(c.broad).map(([g,names])=>g+'：'+names.join('、')).join('\n'),
   '来源：'+c.sources.filter(s=>s.id.startsWith('zzu')).map(s=>s.title+' '+s.url+' '+s.note).join('\n')].join('\n\n');
 }
 const api={categories,platforms,fields,profile,validProfile,courseContext,customPlatform,recommended,providers:category=>Object.entries(platforms).filter(([,p])=>p.category===category).map(([id,p])=>({id,...p})),searchURL:(id,q)=>platforms[id]?.url(encodeURIComponent(q))||null};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudyHubCore=api;
})(typeof window==='undefined'?globalThis:window);
