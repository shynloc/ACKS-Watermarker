"use strict";
/* =================================================================
 *  水印工坊 — 纯前端静态应用
 *  架构：状态层(appState) → 渲染层 → IndexedDB 持久化
 *  交互：Pointer Events 统一鼠标/触摸；DOM 叠加编辑 + Canvas 导出
 *  模式：single（单图）/ batch（批量网格）/ adjust（批量中单张微调，复用单图工作区）
 * ================================================================= */

/* ---------- 工具 ---------- */
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const MOBILE_QUERY='(max-width:1050px)';
const RESOURCE_PROFILE=(()=>{
  const mobile=window.matchMedia('(max-width:1050px)').matches;
  const memory=Number(navigator.deviceMemory)||0;
  const constrained=mobile||(memory>0&&memory<=4);
  return constrained
    ?{sourcePixels:24_000_000,exportPixels:24_000_000,repairPixels:3_000_000,batchExportPixels:48_000_000,batchFiles:40,batchBytes:200*1024*1024}
    :{sourcePixels:60_000_000,exportPixels:64_000_000,repairPixels:6_000_000,batchExportPixels:120_000_000,batchFiles:100,batchBytes:500*1024*1024};
})();
const LIMITS={fileBytes:50*1024*1024,canvasSide:16_384,...RESOURCE_PROFILE};
const FONT_REGISTRY={
  system:{label:'系统黑体',group:'系统字体',family:'System Sans',stack:'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',weights:[400,500,600,700]},
  song:{label:'系统宋体',group:'系统字体',family:'System Serif',stack:'"Songti SC","STSong","SimSun",serif',weights:[400,600,700]},
  kai:{label:'系统楷体',group:'系统字体',family:'System Kai',stack:'"Kaiti SC","STKaiti","KaiTi",serif',weights:[400,600,700]},
  inter:{label:'Inter',group:'Google Fonts',family:'Inter',stack:'"Inter",sans-serif',googleFamily:'Inter',weights:[400,500,600,700]},
  roboto:{label:'Roboto',group:'Google Fonts',family:'Roboto',stack:'"Roboto",sans-serif',googleFamily:'Roboto',weights:[400,500,600,700]},
  montserrat:{label:'Montserrat',group:'Google Fonts',family:'Montserrat',stack:'"Montserrat",sans-serif',googleFamily:'Montserrat',weights:[400,500,600,700]},
  poppins:{label:'Poppins',group:'Google Fonts',family:'Poppins',stack:'"Poppins",sans-serif',googleFamily:'Poppins',weights:[400,500,600,700]},
  playfair:{label:'Playfair Display',group:'Google Fonts',family:'Playfair Display',stack:'"Playfair Display",serif',googleFamily:'Playfair Display',weights:[400,500,600,700]},
  merriweather:{label:'Merriweather',group:'Google Fonts',family:'Merriweather',stack:'"Merriweather",serif',googleFamily:'Merriweather',weights:[400,700]},
  bebas:{label:'Bebas Neue',group:'Google Fonts',family:'Bebas Neue',stack:'"Bebas Neue",sans-serif',googleFamily:'Bebas Neue',weights:[400]},
  pacifico:{label:'Pacifico',group:'Google Fonts · 英文手写',family:'Pacifico',stack:'"Pacifico",cursive',googleFamily:'Pacifico',weights:[400]},
  caveat:{label:'Caveat',group:'Google Fonts · 英文手写',family:'Caveat',stack:'"Caveat",cursive',googleFamily:'Caveat',weights:[400,500,600,700]},
  dancingScript:{label:'Dancing Script',group:'Google Fonts · 英文手写',family:'Dancing Script',stack:'"Dancing Script",cursive',googleFamily:'Dancing Script',weights:[400,500,600,700]},
  kalam:{label:'Kalam',group:'Google Fonts · 英文手写',family:'Kalam',stack:'"Kalam",cursive',googleFamily:'Kalam',weights:[300,400,700]},
  patrickHand:{label:'Patrick Hand',group:'Google Fonts · 英文手写',family:'Patrick Hand',stack:'"Patrick Hand",cursive',googleFamily:'Patrick Hand',weights:[400]},
  greatVibes:{label:'Great Vibes',group:'Google Fonts · 英文手写',family:'Great Vibes',stack:'"Great Vibes",cursive',googleFamily:'Great Vibes',weights:[400]},
  indieFlower:{label:'Indie Flower',group:'Google Fonts · 英文手写',family:'Indie Flower',stack:'"Indie Flower",cursive',googleFamily:'Indie Flower',weights:[400]},
  notoSansSC:{label:'Noto Sans SC',group:'Google Fonts · 中文',family:'Noto Sans SC',stack:'"Noto Sans SC","PingFang SC",sans-serif',googleFamily:'Noto Sans SC',weights:[400,500,600,700],textSubset:true},
  notoSerifSC:{label:'Noto Serif SC',group:'Google Fonts · 中文',family:'Noto Serif SC',stack:'"Noto Serif SC","Songti SC",serif',googleFamily:'Noto Serif SC',weights:[400,500,600,700],textSubset:true},
  maShanZheng:{label:'马善政楷书',group:'Google Fonts · 中文手写',family:'Ma Shan Zheng',stack:'"Ma Shan Zheng","Kaiti SC",cursive',googleFamily:'Ma Shan Zheng',weights:[400],textSubset:true},
  zhiMangXing:{label:'志莽行书',group:'Google Fonts · 中文手写',family:'Zhi Mang Xing',stack:'"Zhi Mang Xing","Kaiti SC",cursive',googleFamily:'Zhi Mang Xing',weights:[400],textSubset:true},
  longCang:{label:'龙藏体',group:'Google Fonts · 中文手写',family:'Long Cang',stack:'"Long Cang","Kaiti SC",cursive',googleFamily:'Long Cang',weights:[400],textSubset:true},
  liuJianMaoCao:{label:'刘建毛草',group:'Google Fonts · 中文手写',family:'Liu Jian Mao Cao',stack:'"Liu Jian Mao Cao","Kaiti SC",cursive',googleFamily:'Liu Jian Mao Cao',weights:[400],textSubset:true},
  zcoolKuaiLe:{label:'站酷快乐体',group:'Google Fonts · 中文手写',family:'ZCOOL KuaiLe',stack:'"ZCOOL KuaiLe","Kaiti SC",cursive',googleFamily:'ZCOOL KuaiLe',weights:[400],textSubset:true}
};
const fontLoadPromises=new Map();
let fontTypingTimer=null;
function fontInfo(key){return FONT_REGISTRY[key]||FONT_REGISTRY.system;}
function defaultFontWeight(font){return font.weights.includes(600)?600:(font.weights.includes(400)?400:font.weights[0]);}
function normalizeWm(wm){
  if(wm?.kind==='text'){
    wm.fontKey=FONT_REGISTRY[wm.fontKey]?wm.fontKey:'system';
    const font=fontInfo(wm.fontKey);wm.fontWeight=font.weights.includes(+wm.fontWeight)?+wm.fontWeight:defaultFontWeight(font);
    wm.letterSpacing=Number.isFinite(+wm.letterSpacing)?+wm.letterSpacing:0;
    wm.size=Number.isFinite(+wm.size)?+wm.size:1;
  }
  return wm;
}
function appAssetUrl(path){
  let base=location.pathname||'/';
  if(!base.endsWith('/'))base=/\.[a-z0-9]+$/i.test(base)?base.slice(0,base.lastIndexOf('/')+1):base+'/';
  return new URL(base+path.replace(/^\//,''),location.origin).toString();
}
function populateFontSelect(select){
  select.innerHTML='';const groups=new Map();
  Object.entries(FONT_REGISTRY).forEach(([key,font])=>{
    let group=groups.get(font.group);if(!group){group=document.createElement('optgroup');group.label=font.group;groups.set(font.group,group);select.appendChild(group);}
    const option=document.createElement('option');option.value=key;option.textContent=font.label;option.style.fontFamily=font.stack;group.appendChild(option);
  });
}
function populateWeightSelect(select,fontKey,selected){
  const font=fontInfo(fontKey);select.innerHTML='';font.weights.forEach(weight=>{const option=document.createElement('option');option.value=weight;option.textContent=({300:'细体 300',400:'常规 400',500:'中等 500',600:'半粗 600',700:'粗体 700'})[weight]||String(weight);select.appendChild(option);});
  select.value=font.weights.includes(+selected)?String(selected):String(defaultFontWeight(font));
}
function setFontStatus(el,stateName,message){if(!el)return;el.className='font-status'+(stateName?` ${stateName}`:'');el.textContent=message;}
async function ensureFont(fontKey,text='',weight=600){
  const font=fontInfo(fontKey);if(!font.googleFamily)return true;
  // 中文字体按字重缓存完整的 unicode-range CSS，不把水印文字放进网络查询参数。
  const requestKey=`${fontKey}:${font.textSubset?weight:'all'}`;
  const clearAttempt=()=>{
    fontLoadPromises.delete(requestKey);
    $$('link[data-font-request]').filter(link=>link.dataset.fontRequest===requestKey).forEach(link=>link.remove());
  };
  for(let attempt=0;attempt<2;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,450));
    if(!fontLoadPromises.has(requestKey)){
      const promise=new Promise(resolve=>{
        const link=document.createElement('link');link.rel='stylesheet';link.dataset.googleFont=fontKey;link.dataset.fontRequest=requestKey;
        const requestedWeights=font.textSubset?[weight]:font.weights;const url=new URL(appAssetUrl('google-fonts/css2'));url.searchParams.set('family',`${font.googleFamily}:wght@${requestedWeights.join(';')}`);url.searchParams.set('display','swap');link.href=url;
        const timer=setTimeout(()=>{link.remove();resolve(false);},20000);
        link.onload=()=>{clearTimeout(timer);resolve(true);};link.onerror=()=>{clearTimeout(timer);link.remove();resolve(false);};document.head.appendChild(link);
      });
      fontLoadPromises.set(requestKey,promise);
    }
    const cssReady=await fontLoadPromises.get(requestKey);if(!cssReady){clearAttempt();continue;}
    try{
      const sample=(text||'Watermark').slice(0,200);const faces=await Promise.race([document.fonts.load(`${weight} 48px "${font.family}"`,sample),new Promise((_,reject)=>setTimeout(()=>reject(new Error('字体加载超时')),20000))]);
      if(faces.length>0||document.fonts.check(`${weight} 48px "${font.family}"`,sample))return true;
    }catch(e){}
    clearAttempt();
  }
  return false;
}
function toast(msg){
  const w=$('#toastWrap');const t=document.createElement('div');t.className='toast';t.textContent=msg;
  w.appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},2200);
}
function blobToImage(blob){return new Promise((res,rej)=>{const u=URL.createObjectURL(blob);const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(u);res(img);};
  img.onerror=e=>{URL.revokeObjectURL(u);rej(e);};img.src=u;
});}
function imgToBlob(img,type='image/png',q){return new Promise((res,rej)=>img.toBlob(b=>b?res(b):rej(new Error('图片编码失败')),type,q));}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
function escapeHtml(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function formatBytes(bytes){if(bytes<1024)return bytes+' B';const units=['KB','MB','GB'];let n=bytes/1024,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n>=10?n.toFixed(0):n.toFixed(1)} ${units[i]}`;}
function imageLimitError(img,scale=1){
  const sourceW=img.naturalWidth||img.naturalW,sourceH=img.naturalHeight||img.naturalH;
  const W=sourceW*scale,H=sourceH*scale,pixels=W*H;
  if(sourceW*sourceH>LIMITS.sourcePixels)return `原图像素过大（${sourceW}×${sourceH}）`;
  if(W>LIMITS.canvasSide||H>LIMITS.canvasSide)return `导出边长超过浏览器安全范围（${W}×${H}）`;
  if(pixels>LIMITS.exportPixels)return `导出像素过大（约 ${(pixels/1_000_000).toFixed(0)}MP）`;
  return '';
}
function activateChoice(container,active){
  $$('button',container).forEach(b=>{const on=b===active;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
}
function setButtonBusy(button,busy,label){
  if(!button.dataset.label)button.dataset.label=button.textContent;
  button.disabled=busy;button.textContent=busy?label:button.dataset.label;
}
function releaseBase(){if(state.base?.url)URL.revokeObjectURL(state.base.url);}

/* ---------- IndexedDB ---------- */
const DB={name:'watermarkStudio',ver:1,db:null,available:true,warned:false};
function notifyStorageUnavailable(){
  if(DB.warned)return;DB.warned=true;
  toast('浏览器存储不可用：本次仍可编辑与导出，但刷新后不会自动恢复');
}
function openDB(){return new Promise((res,rej)=>{
  const r=indexedDB.open(DB.name,DB.ver);
  r.onupgradeneeded=e=>{const db=e.target.result;
    if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});
    if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'key'});
    if(!db.objectStoreNames.contains('session'))db.createObjectStore('session',{keyPath:'key'});
  };
  r.onsuccess=()=>{DB.db=r.result;DB.available=true;DB.db.onversionchange=()=>{DB.db.close();DB.db=null;DB.available=false;};res(DB.db);};
  r.onerror=()=>{DB.available=false;rej(r.error);};
  r.onblocked=()=>{DB.available=false;rej(new Error('IndexedDB 被其他页面阻塞'));};
});}
function store(n,mode){return DB.db?.transaction(n,mode).objectStore(n)||null;}
function idbPut(n,v){if(!DB.db)return Promise.resolve(false);return new Promise((res,rej)=>{const r=store(n,'readwrite').put(v);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});}
function idbGetAll(n){if(!DB.db)return Promise.resolve([]);return new Promise((res,rej)=>{const r=store(n,'readonly').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
function idbGet(n,k){if(!DB.db)return Promise.resolve(undefined);return new Promise((res,rej)=>{const r=store(n,'readonly').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function idbDel(n,k){if(!DB.db)return Promise.resolve(false);return new Promise((res,rej)=>{const r=store(n,'readwrite').delete(k);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});}
async function safePut(n,v){try{const ok=await idbPut(n,v);if(!ok)notifyStorageUnavailable();return ok;}catch(e){console.warn(`${n} 保存失败，继续使用内存模式`,e);notifyStorageUnavailable();return false;}}
async function safeDel(n,k){try{return await idbDel(n,k);}catch(e){console.warn(`${n} 删除持久化记录失败`,e);notifyStorageUnavailable();return false;}}

/* ---------- 状态 ---------- */
const state={
  mode:'single',       // 'single' | 'batch' | 'adjust'
  assets:[],          // {id,name,type,blob,url,isTransparent,favorite,useCount,lastUsed,addedAt}
  base:null,          // {blob,url,width,height,naturalW,naturalH,_batchId?}
  wm:[],              // {id,kind:'image'|'text',assetId?,text?,color?,size, x,y,scale,rot,opacity,z}
  sel:null,
  settings:{exportScale:1,fmt:'png',q:0.92,eraser:false},
  batch:{
    images:[],        // {id,blob,name,nW,nH,excluded:false,wm:null,_img,_thumb}
    tplAssetIds:[],   // 用作批量水印的素材 id（按序循环）
    preset:'center',  // center | corners | tile
    template:null,    // {wm:[...比例坐标...]}  null=未配置
    global:{opacity:1,scale:1,rot:0},
    exportScale:1, fmt:'png', q:0.92
  },
  urlCache:new Map(), // id -> objectURL
  imgCache:new Map(), // id -> HTMLImageElement
  eraseStrokes:[],    // [{pts:[{x,y}...]}]  显示坐标(0..1 of layer)
  zTop:1
};
let cancelBatch=false;

/* ---------- 素材库 ---------- */
async function loadAssets(){
  let list=await idbGetAll('assets');
  list=list.map(a=>{a.url=URL.createObjectURL(a.blob);return a;});
  state.assets=list;
  renderAssets();
}
function sortAssets(){
  state.assets.sort((a,b)=>{
    if(a.favorite!==b.favorite)return a.favorite?-1:1;
    const sa=a.useCount*1000+(a.lastUsed||0)/1e8;
    const sb=b.useCount*1000+(b.lastUsed||0)/1e8;
    return sb-sa;
  });
}
function renderAssets(){
  sortAssets();
  const box=$('#assetList');box.innerHTML='';
  if(!state.assets.length){box.innerHTML='<div class="asset-empty">还没有素材<br>点击上方上传</div>';if(state.mode==='batch')renderBatchAssets();return;}
  for(const a of state.assets){
    const card=document.createElement('div');card.className='asset-card';card.dataset.id=a.id;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`使用水印素材 ${a.name}`);
    card.innerHTML=`
      <img src="${a.url}" alt="${escapeHtml(a.name)}">
      <button class="fav ${a.favorite?'on':''}" data-act="fav" aria-label="${a.favorite?'取消收藏':'收藏'} ${escapeHtml(a.name)}">${a.favorite?'★':'☆'}</button>
      <div class="acts">
        ${a.type!=='image/svg+xml'?`<button data-act="bg" title="本地轻量去背景" aria-label="本地轻量去背景">⛏</button>`:''}
        <button data-act="del" title="删除" aria-label="删除素材">✕</button>
      </div>
      <div class="nm">${escapeHtml(a.name)}</div>`;
    card.addEventListener('click',e=>{
      const act=e.target.dataset.act;
      if(act==='fav'){toggleFav(a.id);e.stopPropagation();return;}
      if(act==='del'){delAsset(a.id);e.stopPropagation();return;}
      if(act==='bg'){doBgRemove(a.id);e.stopPropagation();return;}
      // 点击或拖拽均可放置水印
      placeAsset(a.id);if(window.matchMedia(MOBILE_QUERY).matches)closeDrawers();
    });
    card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();placeAsset(a.id);}});
    // 桌面拖拽
    card.draggable=true;
    card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/asset',a.id);e.dataTransfer.effectAllowed='copy';});
    box.appendChild(card);
  }
  // 批量素材选择也一并刷新
  if(state.mode==='batch')renderBatchAssets();
}
async function addAsset(blob,name){
  if(blob.size>LIMITS.fileBytes){toast(`素材过大，单个文件不能超过 ${formatBytes(LIMITS.fileBytes)}`);return;}
  const a={id:uid(),name,type:blob.type,blob,favorite:false,useCount:0,lastUsed:0,addedAt:Date.now(),url:URL.createObjectURL(blob)};
  state.assets.push(a);
  await safePut('assets',a);
  renderAssets();
}
async function toggleFav(id){
  const a=state.assets.find(x=>x.id===id);if(!a)return;a.favorite=!a.favorite;await safePut('assets',a);renderAssets();
}
async function delAsset(id){
  const asset=state.assets.find(x=>x.id===id);if(!asset)return;
  state.assets=state.assets.filter(x=>x.id!==id);await safeDel('assets',id);
  state.batch.tplAssetIds=state.batch.tplAssetIds.filter(x=>x!==id);
  state.wm=state.wm.filter(w=>w.assetId!==id);
  state.batch.images.forEach(im=>{if(im.wm)im.wm=im.wm.filter(w=>w.assetId!==id);});
  if(state.batch.template)state.batch.template.wm=state.batch.template.wm.filter(w=>w.assetId!==id);
  if(asset.url)URL.revokeObjectURL(asset.url);state.imgCache.delete(id);
  renderAssets();renderWm();renderBatchGrid();updateBatchUI();
}
async function useAsset(id){
  const a=state.assets.find(x=>x.id===id);if(!a)return;a.useCount=(a.useCount||0)+1;a.lastUsed=Date.now();await safePut('assets',a);
}

/* 拖放素材到工作区 */
async function getAssetImage(id){
  if(state.imgCache.has(id))return state.imgCache.get(id);
  const a=state.assets.find(x=>x.id===id);if(!a)return null;
  const img=await blobToImage(a.blob);state.imgCache.set(id,img);return img;
}

/* ---------- 轻量去背景（边缘洪水填充 + 容差） ---------- */
function getEdgeColor(data,w,h){
  let r=0,g=0,b=0,n=0;const sample=(x,y)=>{const i=(y*w+x)*4;r+=data[i];g+=data[i+1];b+=data[i+2];n++;};
  for(let x=0;x<w;x+=Math.max(1,(w/20)|0)){sample(x,0);sample(x,h-1);}
  for(let y=0;y<h;y+=Math.max(1,(h/20)|0)){sample(0,y);sample(w-1,y);}
  return [r/n,g/n,b/n];
}
async function removeBgLight(blob,tolerance=34){
  const img=await blobToImage(blob);
  const FW=img.naturalWidth,FH=img.naturalHeight;
  const MAX=1600;const sc=Math.min(1,MAX/Math.max(FW,FH));
  const w=Math.max(1,Math.round(FW*sc)),h=Math.max(1,Math.round(FH*sc));
  const pc=document.createElement('canvas');pc.width=w;pc.height=h;const pctx=pc.getContext('2d',{willReadFrequently:true});
  pctx.drawImage(img,0,0,w,h);
  const d=pctx.getImageData(0,0,w,h);const px=d.data;
  const [br,bg,bb]=getEdgeColor(px,w,h);
  const t2=tolerance*tolerance*3;
  const alpha=new Uint8Array(w*h).fill(255);
  const visited=new Uint8Array(w*h);
  const stack=new Int32Array(w*h*2);let sp=0;
  const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const idx=y*w+x;if(visited[idx])return;visited[idx]=1;
    const i=idx*4;const dr=px[i]-br,dg=px[i+1]-bg,db=px[i+2]-bb;
    if(dr*dr+dg*dg+db*db<=t2){alpha[idx]=0;stack[sp++]=x;stack[sp++]=y;}};
  for(let x=0;x<w;x++){push(x,0);push(x,h-1);}
  for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
  while(sp>0){const y=stack[--sp],x=stack[--sp];push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
  for(let i=0;i<alpha.length;i++)px[i*4+3]=alpha[i];
  pctx.putImageData(d,0,0);
  // 应用到原图
  const out=document.createElement('canvas');out.width=FW;out.height=FH;const octx=out.getContext('2d');
  octx.drawImage(img,0,0);octx.globalCompositeOperation='destination-in';octx.drawImage(pc,0,0,FW,FH);octx.globalCompositeOperation='source-over';
  return await imgToBlob(out,'image/png');
}
async function doBgRemove(id){
  const a=state.assets.find(x=>x.id===id);if(!a)return;
  toast('正在去背景…');
  try{
    const blob=await removeBgLight(a.blob,34);
    const name=a.name.replace(/\.[^.]+$/,'')+'_去背.png';
    await addAsset(blob,name);
    toast('去背景完成');
  }catch(e){console.error(e);toast('去背景失败');}
}
/* ---------- 工作区：底图 ---------- */
function updateExportSummary(){
  const box=$('#exportSummary');if(!box)return '';
  if(!state.base){box.textContent='等待图片信息';box.classList.remove('warn');return '';}
  const sc=Number(state.settings.exportScale)||1;
  const W=state.base.naturalW*sc,H=state.base.naturalH*sc;
  let error=imageLimitError(state.base,sc);
  if(!error&&state.eraseStrokes.length&&W*H>LIMITS.repairPixels)error='局部修复在此倍率下占用过高，请改用 1x';
  box.textContent=error?`${W} × ${H} · ${error}`:`${W} × ${H} · 约 ${(W*H/1_000_000).toFixed(1)}MP · 浏览器本地处理`;
  box.classList.toggle('warn',!!error);
  return error;
}
function setMobileActionLabel(button,text){
  const label=button?.querySelector('.nav-label');if(label)label.textContent=text;
}
function updateMobileFlowGuide(){
  const buttons={image:$('#mobileImageBtn'),asset:$('#mobileAssetBtn'),edit:$('#mobileEditBtn'),export:$('#mobileExportBtn')};
  if(!buttons.image)return;
  const batch=state.mode==='batch';
  const hasImage=batch?state.batch.images.length>0:!!state.base;
  const hasWatermark=batch?batchHasWatermark():state.wm.length>0;
  const rightOpen=$('#rightPanel').classList.contains('open');
  const leftOpen=$('#leftPanel').classList.contains('open');
  let current='image';
  if(hasImage)current=!hasWatermark?'asset':((rightOpen||(!batch&&state.sel))?'edit':'export');
  if(leftOpen)current='asset';
  if(rightOpen)current='edit';
  if(current==='export'&&buttons.export.disabled)current='edit';
  const order=['image','asset','edit','export'],currentIndex=order.indexOf(current);
  order.forEach((key,index)=>{
    const button=buttons[key];
    button.classList.toggle('is-current',key===current);
    button.classList.toggle('is-done',index<currentIndex);
    button.classList.toggle('is-open',(key==='asset'&&leftOpen)||(key==='edit'&&rightOpen));
  });
}
function updateSingleUI(){
  const hasBase=!!state.base;
  $('#singleWelcome').hidden=hasBase;
  $$('[data-requires-base]').forEach(el=>el.hidden=!hasBase);
  const error=updateExportSummary();
  $('#exportBtn').disabled=!hasBase||!!error;
  $('#topExportBtn').disabled=!hasBase||!!error;
  $('#quickRepairBtn').disabled=!hasBase;
  $('#quickFitBtn').disabled=!hasBase;
  $('#mobileExportBtn').disabled=!hasBase||!!error;
  $('#mobileEditBtn').disabled=!hasBase;
  setMobileActionLabel($('#mobileEditBtn'),'编辑');
  $('#mobileEditBtn').setAttribute('aria-label','编辑水印或添加文字');
  setMobileActionLabel($('#mobileImageBtn'),hasBase?'换图':'导入图片');
  $('#mobileImageBtn').setAttribute('aria-label',hasBase?'替换当前图片':'导入图片');
  $('#mobileCanvasMeta').hidden=!hasBase;
  $('#mobileImageMeta').textContent=hasBase?`${state.base.naturalW} × ${state.base.naturalH} · 本地处理`:'本地图片';
  updateRepairUI();
  updateMobileFlowGuide();
}
function updateRepairUI(){
  const on=!!state.settings.eraser,has=state.eraseStrokes.length>0;
  const button=$('#eraserBtn');if(!button)return;
  button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on));button.textContent=on?'关闭修复笔刷':'开启修复笔刷';
  $('#quickRepairBtn').classList.toggle('on',on);$('#quickRepairBtn').setAttribute('aria-pressed',String(on));
  $('#eraseCanvas').classList.toggle('on',on);
  $('#clearRepairBtn').disabled=!has;
  $('#repairHint').textContent=has?`已记录 ${state.eraseStrokes.length} 组修复笔画；导出时会应用。`:'在图片上涂抹后，导出会用邻近像素填补该区域。这不是生成式 AI，复杂背景可能需要多次尝试。';
  if(state.base){const error=updateExportSummary();$('#exportBtn').disabled=!!error;$('#topExportBtn').disabled=!!error;}
}
async function setBaseImage(blob,{persist=true}={}){
  if(blob.size>LIMITS.fileBytes){toast(`图片过大，单个文件不能超过 ${formatBytes(LIMITS.fileBytes)}`);return false;}
  let img;try{img=await blobToImage(blob);}catch(e){toast('无法读取这张图片');return false;}
  const limitError=imageLimitError(img,1);if(limitError){toast(limitError);return false;}
  releaseBase();
  state.eraseStrokes=[];state.settings.eraser=false;
  state.base={blob,url:URL.createObjectURL(blob),width:img.width,height:img.height,naturalW:img.naturalWidth,naturalH:img.naturalHeight};
  $('#baseImg').src=state.base.url;
  $('#imgWrap').hidden=false;$('#stageEmpty').hidden=true;
  $('#replaceImgBtn').hidden=false;$('#clearImgBtn').hidden=false;
  updateSingleUI();
  requestAnimationFrame(()=>{sizeEraseCanvas();renderWm();});
  if(persist)await saveSession();
  return true;
}
async function clearBase(){
  releaseBase();
  state.base=null;state.wm=[];state.sel=null;state.eraseStrokes=[];
  $('#imgWrap').hidden=true;$('#stageEmpty').hidden=false;
  $('#replaceImgBtn').hidden=true;$('#clearImgBtn').hidden=true;
  $('#wmLayer').innerHTML='';clearErase();renderSel();updateSingleUI();
  await safeDel('session','current');
}

/* ---------- 水印放置与渲染 ---------- */
const BASE_W=0.34; // 图片水印默认宽度占图层宽度比例
function placeAsset(id){
  if(!state.base){toast('请先上传图片');return;}
  const a=state.assets.find(x=>x.id===id);if(!a)return;
  const wm={id:uid(),kind:'image',assetId:id,x:0.5,y:0.5,scale:1,rot:0,opacity:1,z:++state.zTop};
  state.wm.push(wm);selectWm(wm.id);renderWm();useAsset(id);saveSession();
}
function addText(){
  if(!state.base){toast('请先上传图片');return;}
  const txt=$('#textInput').value.trim()||' ';
  const fontKey=$('#textFont').value||'system';const font=fontInfo(fontKey);
  const wm=normalizeWm({id:uid(),kind:'text',text:txt,color:$('#textColor').value,size:parseInt($('#textSize').value,10)/100,
            fontKey,fontWeight:+$('#textWeight').value||defaultFontWeight(font),letterSpacing:0,
            x:0.5,y:0.5,scale:1,rot:0,opacity:1,z:++state.zTop});
  state.wm.push(wm);selectWm(wm.id);renderWm();saveSession();
  if(font.googleFamily){setFontStatus($('#textFontStatus'),'loading','正在通过本站加载字体…');ensureFont(fontKey,txt,wm.fontWeight).then(ok=>setFontStatus($('#textFontStatus'),ok?'':'error',ok?'字体已由本站加载':'字体加载失败，请重试或选择系统字体'));}
  if(window.matchMedia(MOBILE_QUERY).matches){closeDrawers();toast('文字已添加，可直接拖动或缩放');}
}
function renderWm(){
  const layer=$('#wmLayer');layer.innerHTML='';
  const sorted=[...state.wm].sort((a,b)=>a.z-b.z);
  for(const wm of sorted){
    const el=document.createElement('div');el.className='wm'+(state.sel===wm.id?' selected':'');el.dataset.id=wm.id;
    el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',wm.kind==='text'?`文字水印 ${wm.text}`:'图片水印');
    if(wm.kind==='image'){
      const img=document.createElement('img');img.src=state.assets.find(a=>a.id===wm.assetId)?.url||'';
      el.style.width=(BASE_W*100)+'%';el.appendChild(img);
    }else{
      const sp=document.createElement('span');sp.className='txt';sp.textContent=wm.text;
      const font=fontInfo(wm.fontKey);sp.style.color=wm.color;sp.style.fontFamily=font.stack;sp.style.fontWeight=wm.fontWeight;sp.style.letterSpacing=`${wm.letterSpacing||0}px`;el.appendChild(sp);
      if(font.googleFamily)ensureFont(wm.fontKey,wm.text,wm.fontWeight).then(ok=>{if(!ok&&state.sel===wm.id)setFontStatus($('#selFontStatus'),'error','字体加载失败，请重试或选择系统字体');});
    }
    const stick=document.createElement('div');stick.className='rot-stick';el.appendChild(stick);
    const h=document.createElement('div');h.className='rot-handle';h.textContent='↻';el.appendChild(h);
    ['tl','tr','bl','br'].forEach(corner=>{const resize=document.createElement('div');resize.className=`resize-handle ${corner}`;resize.setAttribute('aria-hidden','true');el.appendChild(resize);});
    applyWmStyle(el,wm);
    layer.appendChild(el);
    attachWmEvents(el,wm);
  }
}
function applyWmStyle(el,wm){
  const layer=$('#wmLayer');const lw=layer.clientWidth||1,lh=layer.clientHeight||1;
  el.style.left=(wm.x*100)+'%';el.style.top=(wm.y*100)+'%';
  if(wm.kind==='text'){
    const fs=Math.max(8,lw*0.06*wm.size);
    const sp=el.querySelector('.txt');if(sp){sp.style.fontSize=fs+'px';sp.style.letterSpacing=`${(wm.letterSpacing||0)*lw/612}px`;}
  }
  el.style.transform=`translate(-50%,-50%) rotate(${wm.rot}deg) scale(${wm.scale})`;
  el.style.opacity=wm.opacity;
  el.style.zIndex=wm.z;
}
function getWm(id){return state.wm.find(w=>w.id===id);}
function selectWm(id){
  state.sel=id;$$('.wm').forEach(e=>e.classList.toggle('selected',e.dataset.id===id));
  renderSel();
}
function renderSel(){
  const wm=getWm(state.sel);
  const has=!!wm;
  $('#singleControls').classList.toggle('selection-active',has);
  $('#selEmpty').hidden=has;$('#selControls').hidden=!has;
  if(has){
    const text=wm.kind==='text';$('#selTitle').textContent=text?'文字设置':'水印调整';$('#textSelControls').hidden=!text;
    if(text){
      normalizeWm(wm);$('#selTextInput').value=wm.text;$('#selFont').value=wm.fontKey;populateWeightSelect($('#selFontWeight'),wm.fontKey,wm.fontWeight);$('#selTextColor').value=wm.color||'#ffffff';$('#selLetterSpacing').value=wm.letterSpacing||0;$('#selLetterVal').textContent=`${wm.letterSpacing||0}px`;
      const font=fontInfo(wm.fontKey);setFontStatus($('#selFontStatus'),font.googleFamily?'loading':'',font.googleFamily?'正在确认字体…':'系统字体无需联网');
      if(font.googleFamily)ensureFont(wm.fontKey,wm.text,wm.fontWeight).then(ok=>{if(state.sel===wm.id)setFontStatus($('#selFontStatus'),ok?'':'error',ok?'字体已由本站加载':'字体加载失败，请重试或选择系统字体');});
    }
    $('#opacity').value=Math.round(wm.opacity*100);$('#opVal').textContent=Math.round(wm.opacity*100)+'%';
    $('#scale').value=Math.round(wm.scale*100);$('#scVal').textContent=Math.round(wm.scale*100)+'%';
    $('#rotate').value=Math.round(wm.rot);$('#rotVal').textContent=Math.round(wm.rot)+'°';
  }else{$('#selTitle').textContent='水印调整';$('#textSelControls').hidden=true;}
  updateMobileFlowGuide();
}

/* ---------- 水印交互（Pointer Events：拖动 / 滚轮 / 双指 / 旋转手柄） ---------- */
function attachWmEvents(el,wm){
  el.addEventListener('focus',()=>selectWm(wm.id));
  el.addEventListener('keydown',e=>{
    const step=e.shiftKey?0.05:0.01;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();selectWm(wm.id);
      if(e.key==='ArrowLeft')wm.x=clamp(wm.x-step,0,1);
      if(e.key==='ArrowRight')wm.x=clamp(wm.x+step,0,1);
      if(e.key==='ArrowUp')wm.y=clamp(wm.y-step,0,1);
      if(e.key==='ArrowDown')wm.y=clamp(wm.y+step,0,1);
      applyWmStyle(el,wm);saveSession();
    }else if(e.key==='Delete'||e.key==='Backspace'){
      e.preventDefault();state.wm=state.wm.filter(w=>w.id!==wm.id);state.sel=null;renderWm();renderSel();saveSession();
    }
  });
  // 旋转手柄
  el.querySelector('.rot-handle').addEventListener('pointerdown',e=>{
    e.stopPropagation();e.preventDefault();el.setPointerCapture(e.pointerId);
    const layer=$('#wmLayer');const rect=layer.getBoundingClientRect();
    const cx=rect.left+wm.x*rect.width, cy=rect.top+wm.y*rect.height;
    const startAng=Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI;const startRot=wm.rot;
    const move=ev=>{const a=Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI;wm.rot=startRot+(a-startAng);applyWmStyle(el,wm);updateSelFields(wm);};
    const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('lostpointercapture',up);if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);saveSession();};
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);
  });
  // 四角尺寸手柄：按相对水印中心的径向距离等比缩放
  el.querySelectorAll('.resize-handle').forEach(handle=>handle.addEventListener('pointerdown',e=>{
    e.stopPropagation();e.preventDefault();handle.setPointerCapture(e.pointerId);
    const layer=$('#wmLayer'),rect=layer.getBoundingClientRect(),cx=rect.left+wm.x*rect.width,cy=rect.top+wm.y*rect.height,startScale=wm.scale,startDist=Math.max(12,Math.hypot(e.clientX-cx,e.clientY-cy));
    const move=ev=>{const dist=Math.max(6,Math.hypot(ev.clientX-cx,ev.clientY-cy));wm.scale=clamp(startScale*(dist/startDist),0.05,4);applyWmStyle(el,wm);updateSelFields(wm);};
    const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);handle.removeEventListener('lostpointercapture',up);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);saveSession();};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);handle.addEventListener('lostpointercapture',up);
  }));
  // 拖动改由 wmLayer 级统一手势处理（见 setupGestures），此处仅保留旋转手柄与滚轮
  // 滚轮缩放（以光标为锚点）
  el.addEventListener('wheel',e=>{e.preventDefault();
    const layer=$('#wmLayer');const rect=layer.getBoundingClientRect();
    const cx=clamp((e.clientX-rect.left)/rect.width,0,1), cy=clamp((e.clientY-rect.top)/rect.height,0,1);
    const factor=Math.exp(-e.deltaY*0.0015);const ns=clamp(wm.scale*factor,0.05,4);
    // 锚点保持
    wm.x=cx-(cx-wm.x)*(ns/wm.scale);wm.y=cy-(cy-wm.y)*(ns/wm.scale);wm.scale=ns;
    applyWmStyle(el,wm);updateSelFields(wm);saveSession();
  },{passive:false});
}
function updateSelFields(wm){
  if(state.sel!==wm.id)return;
  $('#opacity').value=Math.round(wm.opacity*100);$('#opVal').textContent=Math.round(wm.opacity*100)+'%';
  $('#scale').value=Math.round(wm.scale*100);$('#scVal').textContent=Math.round(wm.scale*100)+'%';
  $('#rotate').value=Math.round(wm.rot);$('#rotVal').textContent=Math.round(wm.rot)+'°';
}

/* 统一手势：拖动 / 双指捏合（在 wmLayer 上监听，针对选中水印） */
(function setupGestures(){
  const layer=$('#wmLayer');
  let pointers=new Map();
  let mode=null;   // 'move' | 'pinch'
  let mv=null, pz=null;
  const rrect=()=>layer.getBoundingClientRect();
  const under=e=>{const el=e.target.closest('.wm');return el?getWm(el.dataset.id):null;};
  layer.addEventListener('pointerdown',e=>{
    if(e.target.classList.contains('rot-handle')||e.target.classList.contains('resize-handle'))return; // 手柄单独处理
    const wm=under(e);
    if(!wm){pointers.clear();selectWm(null);mode=null;mv=null;pz=null;return;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    selectWm(wm.id);
    if(pointers.size===1){
      const r=rrect();const el=layer.querySelector(`.wm[data-id="${wm.id}"]`);
      mv={wm,el,sx:e.clientX,sy:e.clientY,ox:wm.x,oy:wm.y,r};mode='move';
      layer.setPointerCapture(e.pointerId);
    }else if(pointers.size===2){
      const [a,b]=[...pointers.values()];const r=rrect();
      const mx=((a.x+b.x)/2-r.left)/r.width,my=((a.y+b.y)/2-r.top)/r.height;
      pz={wm,s0:wm.scale,r0:wm.rot,dist0:Math.hypot(a.x-b.x,a.y-b.y),ang0:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,mx,my};
      mode='pinch';mv=null;
    }
  });
  layer.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(mode==='move'&&mv){
      const dx=(e.clientX-mv.sx)/mv.r.width,dy=(e.clientY-mv.sy)/mv.r.height;
      mv.wm.x=clamp(mv.ox+dx,0,1);mv.wm.y=clamp(mv.oy+dy,0,1);applyWmStyle(mv.el,mv.wm);
    }else if(mode==='pinch'&&pz){
      const [a,b]=[...pointers.values()];const r=rrect();
      const dist=Math.hypot(a.x-b.x,a.y-b.y),ang=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
      const ns=clamp(pz.s0*(dist/pz.dist0),0.05,4);
      pz.wm.x=pz.mx-(pz.mx-pz.wm.x)*(ns/pz.wm.scale);pz.wm.y=pz.my-(pz.my-pz.wm.y)*(ns/pz.wm.scale);
      pz.wm.scale=ns;pz.wm.rot=pz.r0+(ang-pz.ang0);
      const el=layer.querySelector(`.wm[data-id="${pz.wm.id}"]`);if(el)applyWmStyle(el,pz.wm);updateSelFields(pz.wm);
    }
  });
  const reset=()=>{if(mode==='move')saveSession();pointers.clear();mode=null;pz=null;mv=null;};
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2){if(mode==='move')saveSession();mode=null;pz=null;mv=null;}};
  layer.addEventListener('pointerup',end);layer.addEventListener('pointercancel',end);layer.addEventListener('lostpointercapture',end);
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
})();

/* ---------- 局部修复笔刷 ---------- */
function clearErase(){state.eraseStrokes=[];sizeEraseCanvas();updateRepairUI();}
function sizeEraseCanvas(){const cv=$('#eraseCanvas');const r=cv.getBoundingClientRect();if(r.width<2||r.height<2)return;cv.width=r.width;cv.height=r.height;redrawErase();}
function redrawErase(){const cv=$('#eraseCanvas');const ctx=cv.getContext('2d');const r=cv.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);if(!state.eraseStrokes.length)return;ctx.strokeStyle='rgba(200,40,40,.55)';ctx.lineWidth=Math.max(10,r.width*0.04);ctx.lineCap='round';ctx.lineJoin='round';for(const s of state.eraseStrokes)strokeP(ctx,r,s.pts);}
function strokeP(ctx,r,pts){if(!pts||pts.length<1)return;ctx.beginPath();pts.forEach((p,i)=>{const X=p.x*r.width,Y=p.y*r.height;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});ctx.stroke();}
function setupEraser(){
  const cv=$('#eraseCanvas');let drawing=false,cur=null;
  cv.addEventListener('pointerdown',e=>{if(!state.settings.eraser)return;e.preventDefault();drawing=true;cur={pts:[]};cv.setPointerCapture(e.pointerId);addPt(e);});
  cv.addEventListener('pointermove',e=>{if(!drawing)return;addPt(e);draw(e);});
  const finish=e=>{if(!drawing)return;drawing=false;if(e.type==='pointerup'&&cur&&cur.pts.length)state.eraseStrokes.push(cur);cur=null;if(cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);updateRepairUI();saveSession();};
  cv.addEventListener('pointerup',finish);cv.addEventListener('pointercancel',finish);cv.addEventListener('lostpointercapture',finish);
  function addPt(e){const r=cv.getBoundingClientRect();cur.pts.push({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});}
  function draw(){const ctx=cv.getContext('2d');const r=cv.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);
    ctx.strokeStyle='rgba(200,40,40,.55)';ctx.lineWidth=Math.max(10,r.width*0.04);ctx.lineCap='round';ctx.lineJoin='round';
    for(const s of state.eraseStrokes){stroke(ctx,r,s.pts);} if(cur)stroke(ctx,r,cur.pts);}
  function stroke(ctx,r,pts){if(pts.length<1)return;ctx.beginPath();pts.forEach((p,i)=>{const X=p.x*r.width,Y=p.y*r.height;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});ctx.stroke();}
}
/* 橡皮擦：近似内容感知填充（扩散补全），而非抠成透明洞
   纯前端无 AI inpaint 模型，这里用「从遮罩边界向内扩散最近背景色」的简化算法，
   对文字水印 / 简单背景效果较好；复杂纹理做不到完美消除（诚实边界）。 */
function applyErase(ctx,W,H){
  if(!state.eraseStrokes.length)return;
  // 1. 由涂抹笔画生成擦除遮罩（离屏画布，白色描边=待擦除区域）
  const mask=document.createElement('canvas');mask.width=W;mask.height=H;const mc=mask.getContext('2d');
  mc.strokeStyle='#fff';mc.lineCap='round';mc.lineJoin='round';mc.lineWidth=Math.max(8,W*0.04);
  for(const s of state.eraseStrokes){mc.beginPath();s.pts.forEach((p,i)=>{const X=p.x*W,Y=p.y*H;i?mc.lineTo(X,Y):mc.moveTo(X,Y);});mc.stroke();}
  const mdata=mc.getImageData(0,0,W,H).data;
  const isMask=i=>mdata[i*4+3]>10;
  // 2. 读取主画布像素
  const img=ctx.getImageData(0,0,W,H);const d=img.data;const N=W*H;
  const r=new Float32Array(N),g=new Float32Array(N),b=new Float32Array(N);
  const flag=new Uint8Array(N); // 2=已确定 / 1=待填充
  for(let i=0;i<N;i++){const p=i*4;r[i]=d[p];g[i]=d[p+1];b[i]=d[p+2];flag[i]=isMask(i)?1:2;}
  const nb=[[-1,0],[1,0],[0,-1],[0,1]];const idx=(x,y)=>y*W+x;
  // 3. 波前扩散：从遮罩边界（邻接原图）向内填充最近背景色
  let frontier=[];
  for(let i=0;i<N;i++){if(flag[i]!==1)continue;const x=i%W,y=(i/W)|0;let sr=0,sg=0,sb=0,c=0;
    for(const[dx,dy]of nb){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=idx(nx,ny);if(flag[j]===2){sr+=r[j];sg+=g[j];sb+=b[j];c++;}}
    if(c){r[i]=sr/c;g[i]=sg/c;b[i]=sb/c;flag[i]=2;frontier.push(i);}}
  while(frontier.length){const next=[];
    for(const i of frontier){const x=i%W,y=(i/W)|0;
      for(const[dx,dy]of nb){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=idx(nx,ny);if(flag[j]!==1)continue;
        let sr=0,sg=0,sb=0,c=0;for(const[dx2,dy2]of nb){const mx=x+dx2,my=y+dy2;if(mx<0||my<0||mx>=W||my>=H)continue;const m=idx(mx,my);if(flag[m]===2){sr+=r[m];sg+=g[m];sb+=b[m];c++;}}
        if(c){r[j]=sr/c;g[j]=sg/c;b[j]=sb/c;flag[j]=2;next.push(j);}}}
    frontier=next;}
  // 4. 写回被擦区域（不透明，JPG 也不会变黑）
  for(let i=0;i<N;i++){if(isMask(i)){const p=i*4;d[p]=r[i];d[p+1]=g[i];d[p+2]=b[i];d[p+3]=255;}}
  ctx.putImageData(img,0,0);
}

/* ---------- 公共：水印渲染（单图导出 / 批量导出 / 缩略图 共用） ---------- */
function fillTextWithSpacing(ctx,text,spacing){
  const chars=[...(text||'')];if(!chars.length)return;
  if(!spacing){ctx.textAlign='center';ctx.fillText(text,0,0);return;}
  const widths=chars.map(char=>ctx.measureText(char).width),total=widths.reduce((sum,width)=>sum+width,0)+spacing*(chars.length-1);
  let x=-total/2;ctx.textAlign='left';chars.forEach((char,index)=>{ctx.fillText(char,x,0);x+=widths[index]+spacing;});
}
async function renderWatermarks(ctx,wmList,W,H,{strictFonts=false}={}){
  for(const wm of [...wmList].sort((a,b)=>a.z-b.z)){
    normalizeWm(wm);let exportFont=fontInfo(wm.fontKey);
    if(wm.kind==='text'&&exportFont.googleFamily){const loaded=await ensureFont(wm.fontKey,wm.text,wm.fontWeight);if(!loaded&&strictFonts)throw new Error(`字体「${exportFont.label}」加载失败，请重试或改用系统字体`);if(!loaded)exportFont=FONT_REGISTRY.system;}
    ctx.save();ctx.globalAlpha=wm.opacity;
    const cx=wm.x*W, cy=wm.y*H;
    ctx.translate(cx,cy);ctx.rotate(wm.rot*Math.PI/180);
    if(wm.kind==='image'){
      const im=await getAssetImage(wm.assetId);if(!im){ctx.restore();continue;}
      const wmW=W*BASE_W*wm.scale;
      const ratio=(im.naturalWidth?im.naturalHeight/im.naturalWidth:1);
      ctx.drawImage(im,-wmW/2,-wmW*ratio/2,wmW,wmW*ratio);
    }else{
      const fs=W*0.06*wm.size*wm.scale;
      ctx.font=`${wm.fontWeight} ${fs}px ${exportFont.stack}`;
      ctx.fillStyle=wm.color;ctx.textBaseline='middle';
      fillTextWithSpacing(ctx,wm.text,(wm.letterSpacing||0)*W/612*wm.scale);
    }
    ctx.restore();
  }
}

/* ---------- 单图导出 ---------- */
async function exportImage(){
  if(!state.base){toast('请先上传图片');return;}
  const sc=parseInt(state.settings.exportScale,10);
  const W=state.base.naturalW*sc,H=state.base.naturalH*sc;
  const sizeError=imageLimitError(state.base,sc);
  if(sizeError){toast(sizeError);return;}
  if(state.eraseStrokes.length&&W*H>LIMITS.repairPixels){toast('局部修复在当前分辨率下占用过高，请改用 1x 或较小图片');return;}
  const button=$('#exportBtn'),topButton=$('#topExportBtn');setButtonBusy(button,true,'正在导出…');setButtonBusy(topButton,true,'正在导出…');
  let cv;
  try{
    cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
    if(!ctx)throw new Error('浏览器无法创建导出画布');
    ctx.imageSmoothingQuality='high';
    if(state.settings.fmt==='jpg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);}
    const baseImg=await blobToImage(state.base.blob);
    ctx.drawImage(baseImg,0,0,W,H);
    await renderWatermarks(ctx,state.wm,W,H,{strictFonts:true});
    if(state.eraseStrokes.length)applyErase(ctx,W,H);
    const type=state.settings.fmt==='jpg'?'image/jpeg':'image/png';
    const q=state.settings.fmt==='jpg'?state.settings.q:undefined;
    const blob=await imgToBlob(cv,type,q);
    const baseName=(state.base.blob.name||'image').replace(/\.[^.]+$/,'')||'image';
    const ts=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const ext=state.settings.fmt==='jpg'?'jpg':'png';
    downloadBlob(blob,`watermarked_${baseName}_${ts}.${ext}`);
    toast(`已导出 · ${formatBytes(blob.size)}`);
  }catch(e){console.error(e);toast(e.message||'导出失败');}
  finally{if(cv){cv.width=1;cv.height=1;}setButtonBusy(button,false,'');setButtonBusy(topButton,false,'');updateSingleUI();}
}

/* ---------- 会话持久化（仅单图） ---------- */
async function saveSession(){
  if(!state.base||state.mode!=='single')return;
  await safePut('session',{key:'current',base:state.base.blob,wm:state.wm,erase:state.eraseStrokes,zTop:state.zTop});
}
async function restoreSession(){
  const s=await idbGet('session','current');if(!s||!s.base)return;
  await setBaseImage(s.base,{persist:false});
  state.wm=(s.wm||[]).map(normalizeWm);state.eraseStrokes=s.erase||[];state.zTop=s.zTop||1;
  await saveSession();
  requestAnimationFrame(()=>{renderWm();sizeEraseCanvas();redrawErase();});
}

/* =================================================================
 *  批量模式
 * ================================================================= */
function setMode(mode){
  state.mode=mode;
  const single=mode==='single';
  $('#modeSeg').hidden=false;
  $('#modeSeg button[data-v="single"]').classList.toggle('active',single);
  $('#modeSeg button[data-v="batch"]').classList.toggle('active',!single);
  $('#modeSeg button[data-v="single"]').setAttribute('aria-pressed',String(single));
  $('#modeSeg button[data-v="batch"]').setAttribute('aria-pressed',String(!single));
  $('#singleControls').hidden=!single;
  $('#batchControls').hidden=single;
  $('#singleHeadBtns').hidden=!single;
  $('#batchHeadBtns').hidden=single;
  $('#stage').hidden=!single;
  $('#batchStage').classList.toggle('show',!single);
  if(single){
    $('#topExportBtn').textContent='导出图片';
    $('#backToBatchBtn').hidden=true;$('#setTplBtn').hidden=true;
    if(state.base){$('#imgWrap').hidden=false;$('#stageEmpty').hidden=true;requestAnimationFrame(()=>{renderWm();sizeEraseCanvas();redrawErase();});}
    else{$('#imgWrap').hidden=true;$('#stageEmpty').hidden=false;}
    updateSingleUI();
  }else{
    $('#topExportBtn').textContent='导出 ZIP';
    // 进入批量：单图编辑态收起
    $('#imgWrap').hidden=true;$('#wmLayer').innerHTML='';
    $('#backToBatchBtn').hidden=true;$('#setTplBtn').hidden=true;
    renderBatchGrid();renderBatchAssets();updateBatchUI();
  }
  closeDrawers();
}

/* 添加批量图片 */
async function addBatchImages(fileList){
  const files=[...fileList].filter(f=>f.type.startsWith('image/')).slice(0,Math.max(0,LIMITS.batchFiles-state.batch.images.length));
  if(!files.length){toast('请选择图片文件');return;}
  let currentBytes=state.batch.images.reduce((sum,im)=>sum+im.blob.size,0),added=0,skipped=0;
  for(const f of files){
    if(f.size>LIMITS.fileBytes||currentBytes+f.size>LIMITS.batchBytes){skipped++;continue;}
    const im={id:uid(),blob:f,name:f.name,excluded:false,wm:null};
    try{im._img=await blobToImage(f);}catch(e){skipped++;continue;}
    if(imageLimitError(im._img,1)){skipped++;continue;}
    im.nW=im._img.naturalWidth;im.nH=im._img.naturalHeight;
    state.batch.images.push(im);currentBytes+=f.size;added++;
  }
  renderBatchGrid();
  toast(skipped?`已添加 ${added} 张，跳过 ${skipped} 张超限或不可读取图片`:`已添加 ${added} 张`);
}
function clearBatch(){
  state.batch.images.forEach(im=>{if(im._thumbUrl)URL.revokeObjectURL(im._thumbUrl);});
  state.batch.images=[];renderBatchGrid();updateBatchUI();
}

function updateBatchUI(){
  const total=state.batch.images.length,included=state.batch.images.filter(i=>!i.excluded).length;
  const ready=included>0&&batchHasWatermark();
  $('#clearBatchBtn').disabled=total===0;
  $('#batchSelectAll').disabled=total===0;
  $('#batchDeselectAll').disabled=total===0;
  $('#exportBatchBtn').disabled=!ready;
  if(state.mode==='batch')$('#topExportBtn').disabled=!ready;
  if(state.mode==='batch'){
    $('#mobileExportBtn').disabled=!ready;
    $('#mobileEditBtn').disabled=false;
    setMobileActionLabel($('#mobileEditBtn'),'模板');
    $('#mobileEditBtn').setAttribute('aria-label','设置批量水印模板');
    setMobileActionLabel($('#mobileImageBtn'),total?'加图':'导入图片');
    $('#mobileImageBtn').setAttribute('aria-label',total?'继续添加图片':'导入批量图片');
    updateMobileFlowGuide();
  }
  $('#batchCount').textContent=`${included} / ${total} 张`;
}

/* 批量素材选择 */
function renderBatchAssets(){
  const box=$('#batchAssetList');box.innerHTML='';
  if(!state.assets.length){box.innerHTML='<div class="asset-empty" style="grid-column:1/-1;padding:14px">先在左侧上传水印素材</div>';return;}
  for(const a of state.assets){
    const selected=state.batch.tplAssetIds.includes(a.id);
    const el=document.createElement('div');el.className='ba'+(selected?' on':'');el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-pressed',String(selected));el.setAttribute('aria-label',`批量水印素材 ${a.name}`);
    el.innerHTML=`<img src="${a.url}" alt="${escapeHtml(a.name)}"><div class="chk">✓</div>`;
    // 批量模式下素材可拖拽到某张图上
    el.draggable=true;
    el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/asset',a.id);e.dataTransfer.effectAllowed='copy';});
    el.onclick=()=>{
      const i=state.batch.tplAssetIds.indexOf(a.id);
      if(i>=0)state.batch.tplAssetIds.splice(i,1);else state.batch.tplAssetIds.push(a.id);
      renderBatchAssets();
      if(state.batch.tplAssetIds.length)buildTemplateFromPreset();
      else state.batch.template=null;
      renderBatchGrid();updateBatchUI();
    };
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});
    box.appendChild(el);
  }
}
function buildTemplateFromPreset(){
  const ids=state.batch.tplAssetIds;
  if(!ids.length){toast('请先在右侧选择水印素材');return false;}
  const wm=[];let z=1;
  const mk=(assetId,x,y,scale=1)=>({id:uid(),kind:'image',assetId,x,y,scale,rot:0,opacity:1,z:z++});
  if(state.batch.preset==='center'){
    wm.push(mk(ids[0],0.5,0.5));
  }else if(state.batch.preset==='tl'){
    wm.push(mk(ids[0],0.12,0.12));
  }else if(state.batch.preset==='tr'){
    wm.push(mk(ids[0],0.88,0.12));
  }else if(state.batch.preset==='bl'){
    wm.push(mk(ids[0],0.12,0.88));
  }else if(state.batch.preset==='br'){
    wm.push(mk(ids[0],0.88,0.88));
  }else if(state.batch.preset==='corners'){
    const pos=[[0.12,0.12],[0.88,0.12],[0.12,0.88],[0.88,0.88]];
    pos.forEach((p,i)=>wm.push(mk(ids[i%ids.length],p[0],p[1])));
  }else if(state.batch.preset==='tile'){
    const N=3;for(let r=0;r<N;r++)for(let c=0;c<N;c++){wm.push(mk(ids[(r*N+c)%ids.length],(c+0.5)/N,(r+0.5)/N,0.55));}
  }
  state.batch.template={wm};
  updateBatchUI();
  return true;
}
function setCurrentAsTemplate(){
  if(!state.wm.length){toast('请先在此图放置并摆好水印');return;}
  if(!state.base||!state.base._batchId){toast('请在批量模式下点开某张图后再设为模板');return;}
  state.batch.template={wm:JSON.parse(JSON.stringify(state.wm))};
  state.batch.preset='custom';
  // 将该图也标记，使预览一致
  const im=state.batch.images.find(x=>x.id===state.base._batchId);
  if(im)im.wm=JSON.parse(JSON.stringify(state.wm));
  toast('已用此图布局作批量模板，其余图片将套用');
  renderBatchGrid();
}

/* 全局参数叠加：返回某图实际使用的 wm 列表 */
function getWmForImage(im){
  const src=im.wm&&im.wm.length?im.wm:state.batch.template?state.batch.template.wm:[];
  const g=state.batch.global;
  return src.map(w=>({...w,opacity:clamp(w.opacity*g.opacity,0,1),scale:w.scale*g.scale,rot:w.rot+g.rot}));
}
function batchHasWatermark(){return !!state.batch.template||state.batch.images.some(i=>i.wm&&i.wm.length);}

/* 批量网格预览：串行合并高频更新，避免滑块拖动时并发编码全部缩略图 */
let batchRenderRunning=false,batchRenderPending=false,batchRenderTimer=null,batchRenderPromise=Promise.resolve();
function renderBatchGrid(){
  batchRenderPending=true;
  if(batchRenderRunning)return batchRenderPromise;
  batchRenderRunning=true;
  batchRenderPromise=(async()=>{try{while(batchRenderPending){batchRenderPending=false;await renderBatchGridOnce();}}finally{batchRenderRunning=false;}})();
  return batchRenderPromise;
}
function scheduleBatchGridRender(){clearTimeout(batchRenderTimer);batchRenderTimer=setTimeout(renderBatchGrid,90);}
async function renderBatchGridOnce(){
  const grid=$('#batchGrid');const empty=$('#batchEmpty');
  const imgs=state.batch.images;
  empty.hidden=imgs.length>0;
  grid.hidden=imgs.length===0;
  $('#batchCount').textContent=`${imgs.filter(i=>!i.excluded).length} / ${imgs.length} 张`;
  // 预载图片
  for(const im of imgs){if(!im._img)im._img=await blobToImage(im.blob);}
  grid.innerHTML='';
  for(const im of imgs){
    const card=document.createElement('div');card.className='batch-card'+(im.excluded?' excluded':'');card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`微调 ${im.name}`);
    const cv=document.createElement('canvas');
    const maxW=360;const r=Math.min(1,maxW/im._img.naturalWidth);
    const Wth=Math.max(1,Math.round(im._img.naturalWidth*r)),Hth=Math.max(1,Math.round(im._img.naturalHeight*r));
    cv.width=Wth;cv.height=Hth;const ctx=cv.getContext('2d');
    ctx.drawImage(im._img,0,0,Wth,Hth);
    const wmList=getWmForImage(im);
    if(wmList.length)await renderWatermarks(ctx,wmList,Wth,Hth);
    const thumbBlob=await imgToBlob(cv,'image/png');
    if(im._thumbUrl)URL.revokeObjectURL(im._thumbUrl);
    im._thumbUrl=URL.createObjectURL(thumbBlob);cv.width=1;cv.height=1;
    card.innerHTML=`
      <img class="thumb" src="${im._thumbUrl}" alt="${escapeHtml(im.name)} 预览">
      <button class="ex ${im.excluded?'on':''}" aria-label="${im.excluded?'重新包含':'排除'} ${escapeHtml(im.name)}">${im.excluded?'✓':'✕'}</button>
      ${im.wm&&im.wm.length?'<div class="batch-badge">已微调</div>':''}
      <div class="nm">${escapeHtml(im.name)}</div>`;
    card.addEventListener('click',e=>{
      if(e.target.closest('.ex')){im.excluded=!im.excluded;renderBatchGrid();return;}
      openAdjust(im.id);
    });
    card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.ex')){e.preventDefault();openAdjust(im.id);}});
    // 拖拽素材到该图：落在哪就放哪（写入此图的自定义布局）
    card.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/asset')){e.preventDefault();card.classList.add('drag');}});
    card.addEventListener('dragleave',()=>card.classList.remove('drag'));
    card.addEventListener('drop',e=>{
      const aid=e.dataTransfer.getData('text/asset');if(!aid)return;
      e.preventDefault();card.classList.remove('drag');
      const tr=card.querySelector('.thumb').getBoundingClientRect();
      let x=clamp((e.clientX-tr.left)/tr.width,0.03,0.97), y=clamp((e.clientY-tr.top)/tr.height,0.03,0.97);
      im.wm=[{id:uid(),kind:'image',assetId:aid,x,y,scale:1,rot:0,opacity:1,z:1}];
      renderBatchGrid();
      toast('已放到该图，点击此图可微调位置');
    });
    grid.appendChild(card);
  }
  updateBatchUI();
}

/* 单张微调：复用单图工作区编辑该图，返回时存回 */
async function openAdjust(id){
  const im=state.batch.images.find(x=>x.id===id);if(!im)return;
  if(!im._img)im._img=await blobToImage(im.blob);
  state.mode='adjust';releaseBase();
  state.base={blob:im.blob,url:URL.createObjectURL(im.blob),width:im._img.width,height:im._img.height,
              naturalW:im._img.naturalWidth,naturalH:im._img.naturalHeight,_batchId:id};
  state.wm=(im.wm?JSON.parse(JSON.stringify(im.wm)):(state.batch.template?state.batch.template.wm.map(w=>({...w})):[])).map(normalizeWm);
  state.sel=null;state.eraseStrokes=[];
  $('#baseImg').src=state.base.url;
  $('#imgWrap').hidden=false;$('#stageEmpty').hidden=true;
  $('#stage').hidden=false;$('#batchStage').classList.remove('show');
  $('#backToBatchBtn').hidden=false;
  $('#setTplBtn').hidden=false;
  $('#singleControls').hidden=false;$('#batchControls').hidden=true;
  $('#singleHeadBtns').hidden=true;
  $('#modeSeg').hidden=true;
  renderSel();updateSingleUI();
  requestAnimationFrame(()=>{sizeEraseCanvas();renderWm();});
}
function closeAdjust(){
  const bid=state.base?._batchId;
  const im=state.batch.images.find(x=>x.id===bid);
  if(im){im.wm=JSON.parse(JSON.stringify(state.wm));}
  releaseBase();state.mode='batch';state.base=null;state.wm=[];state.sel=null;state.eraseStrokes=[];
  // 用 setMode 统一恢复「批量」面板的显隐，避免右侧面板卡在单图状态
  setMode('batch');
}

/* 进度条 */
function showProgress(done,total){
  const bar=$('#batchProgress');const i=bar.firstElementChild;
  bar.hidden=false;$('#cancelBatchBtn').hidden=false;
  const progress=total?Math.round(done/total*100):0;i.style.width=progress+'%';bar.setAttribute('aria-valuenow',String(progress));
}
function hideProgress(){const bar=$('#batchProgress');bar.hidden=true;bar.setAttribute('aria-valuenow','0');$('#cancelBatchBtn').hidden=true;bar.firstElementChild.style.width='0';}

/* ---------- 内联 ZIP 编码器（store 模式，零依赖） ---------- */
function makeZip(files){
  const enc=new TextEncoder();
  const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  const crc32=(buf)=>{let c=0xffffffff;for(let i=0;i<buf.length;i++)c=crcTable[(c^buf[i])&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
  const u16=v=>new Uint8Array([v&0xff,(v>>>8)&0xff]);
  const u32=v=>new Uint8Array([v&0xff,(v>>>8)&0xff,(v>>>16)&0xff,(v>>>24)&0xff]);
  const concat=arrs=>{let len=0;for(const a of arrs)len+=a.length;const out=new Uint8Array(len);let p=0;for(const a of arrs){out.set(a,p);p+=a.length;}return out;};
  const chunks=[];const central=[];let offset=0;
  for(const f of files){
    const nameBytes=enc.encode(f.name);
    const data=f.data;const crc=crc32(data);
    const local=concat([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0),nameBytes,data]);
    chunks.push(local);
    const cen=concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nameBytes]);
    central.push(cen);
    offset+=local.length;
  }
  const centralBuf=concat(central);
  const end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBuf.length),u32(offset),u16(0)]);
  return concat([concat(chunks),centralBuf,end]);
}

/* 批量导出 */
async function exportBatch(){
  const imgs=state.batch.images.filter(i=>!i.excluded);
  if(!imgs.length){toast('没有可导出的图片');return;}
  if(!batchHasWatermark()){toast('请先设置水印模板（选素材或在单图摆好）');return;}
  const fmt=state.batch.fmt, sc=state.batch.exportScale;
  let totalPixels=0;
  for(const im of imgs){
    const error=imageLimitError(im._img,sc);if(error){toast(`${im.name}：${error}`);return;}
    totalPixels+=im.nW*im.nH*sc*sc;
  }
  if(totalPixels>LIMITS.batchExportPixels){toast('本批次导出规模过大，请减少图片、降低倍率或分批处理');return;}
  const type=fmt==='jpg'?'image/jpeg':'image/png';
  const files=[];let done=0;const total=imgs.length,names=new Map();
  const button=$('#exportBatchBtn');cancelBatch=false;showProgress(0,total);setButtonBusy(button,true,'正在打包…');
  try{
    for(const im of imgs){
      if(cancelBatch)break;
      const base=im._img||await blobToImage(im.blob);
      const W=base.naturalWidth*sc,H=base.naturalHeight*sc;
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
      if(!ctx)throw new Error('浏览器无法创建批量导出画布');
      if(fmt==='jpg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);}
      ctx.drawImage(base,0,0,W,H);
      await renderWatermarks(ctx,getWmForImage(im),W,H,{strictFonts:true});
      const blob=await imgToBlob(cv,type,fmt==='jpg'?state.batch.q:undefined);cv.width=1;cv.height=1;
      const stem=(im.name.replace(/\.[^.]+$/,'')||'image')+'_watermarked';
      const count=(names.get(stem)||0)+1;names.set(stem,count);
      const name=stem+(count>1?`_${count}`:'')+'.'+(fmt==='jpg'?'jpg':'png');
      files.push({name,data:new Uint8Array(await blob.arrayBuffer())});
      done++;showProgress(done,total);await new Promise(r=>setTimeout(r,0));
    }
    if(cancelBatch){toast('已取消');return;}
    const zip=makeZip(files);
    downloadBlob(new Blob([zip],{type:'application/zip'}),`watermarked_batch_${imgs.length}张.zip`);
    toast(`已导出 ${files.length} 张`);
  }catch(e){console.error(e);toast(e.message||'批量导出失败');}
  finally{cancelBatch=false;hideProgress();setButtonBusy(button,false,'');updateBatchUI();}
}

/* ---------- UI 事件绑定 ---------- */
function bindUI(){
  populateFontSelect($('#textFont'));populateFontSelect($('#selFont'));$('#textFont').value='system';populateWeightSelect($('#textWeight'),'system',600);
  // 素材上传
  $('#uploadAssetBtn').onclick=()=>$('#assetInput').click();
  $('#assetInput').onchange=e=>{for(const f of e.target.files)addAsset(f,f.name);e.target.value='';};
  // 底图上传
  $('#uploadImgBtn').onclick=()=>$('#imgInput').click();
  $('#imgInput').onchange=e=>{if(e.target.files[0])setBaseImage(e.target.files[0]);e.target.value='';};
  $('#replaceImgBtn').onclick=()=>$('#imgInput').click();
  $('#clearImgBtn').onclick=clearBase;
  $('#mobileReplaceBtn').onclick=()=>$('#imgInput').click();
  $('#mobileClearBtn').onclick=clearBase;
  // 拖拽上传底图（单图）
  const stage=$('#stage');
  stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('drag');});
  stage.addEventListener('dragleave',()=>stage.classList.remove('drag'));
  stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('drag');
    const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))setBaseImage(f);
    const aid=e.dataTransfer.getData('text/asset');if(aid)placeAsset(aid);});
  // 文字水印
  $('#addTextBtn').onclick=addText;
  $('#quickTextBtn').onclick=()=>{if(!state.base){$('#imgInput').click();return;}state.sel=null;renderWm();renderSel();$('#textInput').focus();$('#addTextCard').scrollIntoView({block:'nearest'});if(window.matchMedia(MOBILE_QUERY).matches)toggleDrawer('right');};
  $('#quickLogoBtn').onclick=()=>$('#assetInput').click();
  $('#quickRepairBtn').onclick=()=>$('#eraserBtn').click();
  $('#quickFitBtn').onclick=()=>{if(state.base){renderWm();sizeEraseCanvas();toast('画布已适配当前窗口');}};
  $('#mobileEditBtn').onclick=()=>{
    if(state.mode!=='batch'&&!state.base)return;
    toggleDrawer('right');
    requestAnimationFrame(()=>{
      const target=state.mode==='batch'?$('#batchControls'):(state.sel?$('#selCard'):$('#addTextCard'));
      target?.scrollIntoView({block:'start'});
      if(state.mode!=='batch'&&!state.sel)$('#textInput').focus();
    });
  };
  $('#mobileAssetBtn').onclick=()=>toggleDrawer('left');
  $('#mobileImageBtn').onclick=()=>state.mode==='batch'?$('#batchInput').click():$('#imgInput').click();
  $('#mobileExportBtn').onclick=()=>state.mode==='batch'?exportBatch():exportImage();
  $$('[data-close-drawer]').forEach(button=>button.onclick=()=>{
    const finishedEditing=$('#rightPanel').classList.contains('open')&&state.mode!=='batch'&&!!state.sel;
    closeDrawers();
    if(finishedEditing){selectWm(null);renderWm();}
  });
  $('#textSize').oninput=e=>$('#tSizeVal').textContent=e.target.value+'%';
  $('#textFont').onchange=async e=>{
    const key=e.target.value,font=fontInfo(key);populateWeightSelect($('#textWeight'),key,$('#textWeight').value);
    if(!font.googleFamily){setFontStatus($('#textFontStatus'),'','系统字体无需联网');return;}
    setFontStatus($('#textFontStatus'),'loading','正在通过本站加载字体…');const ok=await ensureFont(key,$('#textInput').value,+$('#textWeight').value);setFontStatus($('#textFontStatus'),ok?'':'error',ok?'字体已由本站加载':'字体加载失败，请重试或选择系统字体');
  };
  // 选中水印控制
  $('#selTextInput').oninput=e=>{
    const wm=getWm(state.sel);if(!wm||wm.kind!=='text')return;wm.text=e.target.value||' ';refreshTextWm(wm);saveSession();const font=fontInfo(wm.fontKey);
    if(font.googleFamily&&font.textSubset){clearTimeout(fontTypingTimer);setFontStatus($('#selFontStatus'),'loading','正在加载当前文字字形…');fontTypingTimer=setTimeout(async()=>{const ok=await ensureFont(wm.fontKey,wm.text,wm.fontWeight);if(state.sel===wm.id){refreshTextWm(wm);setFontStatus($('#selFontStatus'),ok?'':'error',ok?'字体已由本站加载':'字体加载失败，请重试或选择系统字体');}},350);}
  };
  $('#selFont').onchange=async e=>{
    const wm=getWm(state.sel);if(!wm||wm.kind!=='text')return;wm.fontKey=e.target.value;const font=fontInfo(wm.fontKey);wm.fontWeight=font.weights.includes(wm.fontWeight)?wm.fontWeight:defaultFontWeight(font);populateWeightSelect($('#selFontWeight'),wm.fontKey,wm.fontWeight);refreshTextWm(wm);saveSession();
    if(!font.googleFamily){setFontStatus($('#selFontStatus'),'','系统字体无需联网');return;}
    setFontStatus($('#selFontStatus'),'loading','正在通过本站加载字体…');const ok=await ensureFont(wm.fontKey,wm.text,wm.fontWeight);if(state.sel===wm.id){refreshTextWm(wm);setFontStatus($('#selFontStatus'),ok?'':'error',ok?'字体已由本站加载':'字体加载失败，请重试或选择系统字体');}
  };
  $('#selFontWeight').onchange=async e=>{const wm=getWm(state.sel);if(!wm||wm.kind!=='text')return;wm.fontWeight=+e.target.value;refreshTextWm(wm);saveSession();const font=fontInfo(wm.fontKey);if(font.googleFamily){setFontStatus($('#selFontStatus'),'loading','正在加载所选字重…');const ok=await ensureFont(wm.fontKey,wm.text,wm.fontWeight);if(state.sel===wm.id)setFontStatus($('#selFontStatus'),ok?'':'error',ok?'字体已由本站加载':'字体加载失败，请重试或选择系统字体');}};
  $('#selTextColor').oninput=e=>{const wm=getWm(state.sel);if(!wm||wm.kind!=='text')return;wm.color=e.target.value;refreshTextWm(wm);saveSession();};
  $('#selLetterSpacing').oninput=e=>{const wm=getWm(state.sel);if(!wm||wm.kind!=='text')return;wm.letterSpacing=+e.target.value;$('#selLetterVal').textContent=`${wm.letterSpacing}px`;refreshTextWm(wm);saveSession();};
  $('#opacity').oninput=e=>{const wm=getWm(state.sel);if(!wm)return;wm.opacity=e.target.value/100;$('#opVal').textContent=e.target.value+'%';const el=layerEl(wm);if(el)applyWmStyle(el,wm);saveSession();};
  $('#scale').oninput=e=>{const wm=getWm(state.sel);if(!wm)return;wm.scale=e.target.value/100;$('#scVal').textContent=e.target.value+'%';const el=layerEl(wm);if(el)applyWmStyle(el,wm);saveSession();};
  $('#rotate').oninput=e=>{const wm=getWm(state.sel);if(!wm)return;wm.rot=+e.target.value;$('#rotVal').textContent=e.target.value+'°';const el=layerEl(wm);if(el)applyWmStyle(el,wm);saveSession();};
  $('#alignControls').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const wm=getWm(state.sel);if(!wm)return;if(b.dataset.axis==='center'){wm.x=.5;wm.y=.5;}else if(b.dataset.axis==='x')wm.x=+b.dataset.value;const el=layerEl(wm);if(el)applyWmStyle(el,wm);saveSession();});
  $('#frontBtn').onclick=()=>{const wm=getWm(state.sel);if(!wm)return;wm.z=++state.zTop;renderWm();saveSession();};
  $('#backBtn').onclick=()=>{const wm=getWm(state.sel);if(!wm)return;const min=Math.min(...state.wm.map(w=>w.z))-1;wm.z=min;renderWm();saveSession();};
  $('#delWmBtn').onclick=()=>{const wm=getWm(state.sel);if(!wm)return;state.wm=state.wm.filter(w=>w!==wm);state.sel=null;renderWm();renderSel();saveSession();};
  // 导出设置（单图）
  $('#scaleSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activateChoice($('#scaleSeg'),b);state.settings.exportScale=+b.dataset.v;updateSingleUI();});
  $('#fmtSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activateChoice($('#fmtSeg'),b);state.settings.fmt=b.dataset.v;$('#jpgQ').hidden=b.dataset.v!=='jpg';});
  $('#quality').oninput=e=>{state.settings.q=e.target.value/100;$('#qVal').textContent=e.target.value+'%';};
  $('#exportBtn').onclick=exportImage;
  $('#topExportBtn').onclick=()=>state.mode==='batch'?exportBatch():exportImage();
  // 局部修复笔刷
  $('#eraserBtn').onclick=()=>{state.settings.eraser=!state.settings.eraser;updateRepairUI();if(state.settings.eraser){if(state.eraseStrokes.length)redrawErase();toast('修复笔刷已开启，在图片上涂抹');}};
  $('#clearRepairBtn').onclick=()=>{clearErase();saveSession();toast('已清除修复笔画');};
  // 重置
  $('#resetBtn').onclick=()=>{state.wm=[];state.sel=null;clearErase();renderWm();renderSel();saveSession();toast('已重置画布');};

  // ===== 模式切换 =====
  $('#modeSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setMode(b.dataset.v);});
  // 批量图片添加
  $('#addBatchBtn').onclick=()=>$('#batchInput').click();
  $('#addBatchBtn2').onclick=()=>$('#batchInput').click();
  $('#batchInput').onchange=e=>{if(e.target.files.length)addBatchImages(e.target.files);e.target.value='';};
  $('#clearBatchBtn').onclick=clearBatch;
  $('#batchSelectAll').onclick=()=>{state.batch.images.forEach(i=>i.excluded=false);renderBatchGrid();};
  $('#batchDeselectAll').onclick=()=>{state.batch.images.forEach(i=>i.excluded=true);renderBatchGrid();};
  // 批量模板
  $('#presetSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activateChoice($('#presetSeg'),b);state.batch.preset=b.dataset.v;if(state.batch.tplAssetIds.length)buildTemplateFromPreset();renderBatchGrid();});
  $('#setTplBtn').onclick=setCurrentAsTemplate;
  // 批量全局参数
  $('#bOpacity').oninput=e=>{state.batch.global.opacity=e.target.value/100;$('#bOpVal').textContent=e.target.value+'%';scheduleBatchGridRender();};
  $('#bScale').oninput=e=>{state.batch.global.scale=e.target.value/100;$('#bScVal').textContent=e.target.value+'%';scheduleBatchGridRender();};
  $('#bRotate').oninput=e=>{state.batch.global.rot=+e.target.value;$('#bRotVal').textContent=e.target.value+'°';scheduleBatchGridRender();};
  // 批量导出设置
  $('#bFmtSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activateChoice($('#bFmtSeg'),b);state.batch.fmt=b.dataset.v;$('#bJpgQ').hidden=b.dataset.v!=='jpg';});
  $('#bScaleSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activateChoice($('#bScaleSeg'),b);state.batch.exportScale=+b.dataset.v;});
  $('#bQuality').oninput=e=>{state.batch.q=e.target.value/100;$('#bQVal').textContent=e.target.value+'%';};
  $('#exportBatchBtn').onclick=exportBatch;
  $('#cancelBatchBtn').onclick=()=>{cancelBatch=true;};
  // 微调返回
  $('#backToBatchBtn').onclick=closeAdjust;

  // 移动端抽屉
  $('#openLeft').onclick=()=>toggleDrawer('left');
  $('#openRight').onclick=()=>toggleDrawer('right');
  $('#backdrop').onclick=closeDrawers;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$$('.panel.open').length){closeDrawers();}});
  // 窗口尺寸变化重算位置
  window.addEventListener('resize',()=>{syncDrawerA11y();if(state.base&&state.mode!=='batch'){renderWm();sizeEraseCanvas();}});
}
function layerEl(wm){return $('#wmLayer').querySelector(`.wm[data-id="${wm.id}"]`);}
function refreshTextWm(wm){
  const el=layerEl(wm);if(!el)return;normalizeWm(wm);const sp=el.querySelector('.txt'),font=fontInfo(wm.fontKey);
  if(sp){sp.textContent=wm.text;sp.style.color=wm.color;sp.style.fontFamily=font.stack;sp.style.fontWeight=wm.fontWeight;sp.style.letterSpacing=`${wm.letterSpacing}px`;}
  el.setAttribute('aria-label',`文字水印 ${wm.text}`);applyWmStyle(el,wm);
}
function syncDrawerA11y(){
  const mobile=window.matchMedia(MOBILE_QUERY).matches;
  [['left',$('#leftPanel'),$('#openLeft')],['right',$('#rightPanel'),$('#openRight')]].forEach(([side,p,b])=>{
    const open=p.classList.contains('open');b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?`关闭${side==='left'?'素材库':'设置'}`:`打开${side==='left'?'素材库':'设置'}`);
    if(mobile&&!open){p.inert=true;p.setAttribute('aria-hidden','true');}else{p.inert=false;p.removeAttribute('aria-hidden');}
  });
}
function toggleDrawer(side){const p=side==='left'?$('#leftPanel'):$('#rightPanel');const open=p.classList.contains('open');
  $$('.panel').forEach(x=>x.classList.remove('open'));$('#backdrop').classList.remove('show');
  if(!open){p.classList.add('open');$('#backdrop').classList.add('show');}
  syncDrawerA11y();updateMobileFlowGuide();if(!open)requestAnimationFrame(()=>p.querySelector('button,input,[tabindex="0"]')?.focus());
}
function closeDrawers(){$$('.panel').forEach(p=>p.classList.remove('open'));$('#backdrop').classList.remove('show');syncDrawerA11y();updateMobileFlowGuide();}

/* ---------- 启动 ---------- */
(async function init(){
  let storageError=null;try{await openDB();}catch(e){DB.available=false;storageError=e;console.warn('DB 失败，使用内存模式',e);}
  setupEraser();
  bindUI();
  if(storageError)notifyStorageUnavailable();
  try{await loadAssets();}catch(e){console.warn('素材加载失败（内存模式）',e);}
  try{await restoreSession();}catch(e){console.warn('会话恢复失败',e);}
  setMode('single');
  updateSingleUI();updateBatchUI();syncDrawerA11y();
  console.log('水印工坊 ready');
})();
