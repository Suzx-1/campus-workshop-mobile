(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PhotoCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  function silhouette(rgba,w,h,cols,rows,threshold=150){
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<3||h<3||rgba.length!==w*h*4||![cols,rows].every(n=>Number.isInteger(n)&&n>=2&&n<=12))throw Error('图像或网格尺寸无效');
    const ink=new Uint8Array(w*h),outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
    for(let i=0;i<w*h;i++){const j=i*4,a=rgba[j+3]/255,gray=(rgba[j]*.299+rgba[j+1]*.587+rgba[j+2]*.114)*a+255*(1-a);ink[i]=gray<threshold?1:0;}
    function add(i){if(!ink[i]&&!outside[i]){outside[i]=1;queue[tail++]=i;}}
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
    let minX=w,minY=h,maxX=-1,maxY=-1,inside=0;
    // Require an enclosed white area. A blank sheet or isolated dimension line is not a solid.
    for(let i=0;i<w*h;i++)if(!outside[i]&&!ink[i]){const x=i%w,y=Math.floor(i/w);inside++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const mask=Array.from({length:rows},()=>Array(cols).fill(false));if(inside<4)return mask;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){let filled=0,count=0;const x0=Math.floor(minX+(maxX-minX+1)*col/cols),x1=Math.ceil(minX+(maxX-minX+1)*(col+1)/cols),y0=Math.floor(minY+(maxY-minY+1)*row/rows),y1=Math.ceil(minY+(maxY-minY+1)*(row+1)/rows);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){count++;if(!outside[y*w+x])filled++;}mask[row][col]=filled/count>.35;}
    return mask;
  }
  const axes={front:['x','z'],top:['x','y'],side:['y','z']};
  function reconstruct(viewA,maskA,viewB,maskB,dims){
    if(!axes[viewA]||!axes[viewB]||viewA===viewB)throw Error('请选择两个不同方向的正投影视图');
    if(!['x','y','z'].every(k=>Number.isInteger(dims[k])&&dims[k]>=2&&dims[k]<=12))throw Error('每个轴的格数应为2—12');
    function check(view,mask){const [u,v]=axes[view];if(!Array.isArray(mask)||mask.length!==dims[v]||mask.some(row=>!Array.isArray(row)||row.length!==dims[u]||row.some(n=>typeof n!=='boolean')))throw Error('视图网格与轴尺寸不一致，请重新识别');if(!mask.flat().some(Boolean))throw Error('轮廓为空，请识别或手动补充轮廓');}
    check(viewA,maskA);check(viewB,maskB);const cells=[],seenA=new Set(),seenB=new Set();
    const point=(view,c)=>{const [u,v]=axes[view];return[dims[v]-1-c[v],c[u]];};
    for(let x=0;x<dims.x;x++)for(let y=0;y<dims.y;y++)for(let z=0;z<dims.z;z++){const c={x,y,z},a=point(viewA,c),b=point(viewB,c);if(maskA[a[0]][a[1]]&&maskB[b[0]][b[1]]){cells.push([x,y,z]);seenA.add(a.join(','));seenB.add(b.join(','));}}
    const missing=(mask,seen)=>mask.reduce((n,row,r)=>n+row.filter((on,c)=>on&&!seen.has([r,c].join(','))).length,0),unmatched=missing(maskA,seenA)+missing(maskB,seenB);
    return{cells,consistent:unmatched===0,unmatched,dimensions:{...dims},ambiguous:true};
  }
  function drag(yaw,pitch,dx,dy){const angle=yaw-dx*.012;return{yaw:Math.atan2(Math.sin(angle),Math.cos(angle)),pitch:Math.max(-.8,Math.min(1.4,pitch+dy*.01))};}
  function validDraft(d){try{return d?.version===1&&typeof d.generated==='boolean'&&['x','y','z'].every(k=>Number.isInteger(d.dims[k])&&d.dims[k]>=2&&d.dims[k]<=12)&&Array.isArray(d.views)&&d.views.length===2&&d.views.every(v=>axes[v.type]&&typeof v.name==='string'&&v.name.length<=500&&typeof v.source==='string'&&v.source.length<=3*1024*1024&&(!v.source||/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.source))&&Number.isInteger(v.turn)&&v.turn>=0&&v.turn<4&&Number.isFinite(v.threshold)&&v.threshold>=30&&v.threshold<=230&&['left','right','top','bottom'].every(k=>Number.isFinite(v.crop[k])&&v.crop[k]>=0&&v.crop[k]<=90)&&v.crop.left+v.crop.right<95&&v.crop.top+v.crop.bottom<95&&(v.mask===null||Array.isArray(v.mask)&&v.mask.length===d.dims[axes[v.type][1]]&&v.mask.every(row=>Array.isArray(row)&&row.length===d.dims[axes[v.type][0]]&&row.every(n=>typeof n==='boolean'))));}catch{return false;}}
  function validModel(m){return !!m&&['custom','cube','step','l'].includes(m.kind)&&Number.isInteger(m.size)&&m.size>=2&&m.size<=12&&Number.isFinite(m.yaw)&&Number.isFinite(m.pitch)&&m.pitch>=-.8&&m.pitch<=1.4&&Number.isInteger(m.layer)&&m.layer>=0&&m.layer<m.size&&Array.isArray(m.custom)&&m.custom.length<=1728&&m.custom.every(c=>Array.isArray(c)&&c.length===3&&c.every(n=>Number.isInteger(n)&&n>=0&&n<m.size));}
  return{silhouette,reconstruct,drag,axes,validDraft,validModel};
});
