const gallery = document.querySelector("#gallery");
const memoryCount = document.querySelector("#memoryCount");
const addButton = document.querySelector("#addButton");

const viewer = document.querySelector("#viewer");
const viewerBackdrop = document.querySelector(".viewer-backdrop");
const viewerScroll = document.querySelector("#viewerScroll");
const viewerClose = document.querySelector("#viewerClose");
const viewerHint = document.querySelector("#viewerHint");
const viewerChrome = document.querySelector("#viewerChrome");
const viewerBoundary = document.querySelector("#viewerBoundary");

const sharedTransition = document.querySelector("#sharedTransition");
const sharedTransitionImg = document.querySelector("#sharedTransitionImg");

const sheet = document.querySelector("#sheet");
const closeSheet = document.querySelector("#closeSheet");
const cancel = document.querySelector("#cancel");
const photoInput = document.querySelector("#photoInput");
const titleInput = document.querySelector("#titleInput");
const preview = document.querySelector("#preview");
const previewImg = document.querySelector("#previewImg");
const save = document.querySelector("#save");

const memories = [];

const supabaseConfig = window.MEMORY_GALLERY_SUPABASE || {};
const SUPABASE_CONFIGURED =
  typeof window.supabase?.createClient === "function" &&
  /^https:\/\/[^\s]+/.test(supabaseConfig.url || "") &&
  supabaseConfig.publishableKey &&
  !supabaseConfig.publishableKey.startsWith("YOUR_");

const supabaseClient = SUPABASE_CONFIGURED
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : null;

let activeIndex=0;
let viewerOpen=false;
let hintDismissed=false;
let dragStartY=null;
let draggingBoundary=false;
let closing=false;
let quietTimer=null;
let tapStart=0;
let boundaryPull=0;
let previewObjectUrl=null;
let loadingMemories=false;
let savingMemory=false;

function pad(n){return String(n).padStart(2,"0")}

function setLoadingState(isLoading){
  loadingMemories=isLoading;
  addButton.disabled=isLoading;
  addButton.setAttribute("aria-busy",String(isLoading));
}

function showDataError(message){
  console.error(`[Memory Gallery] ${message}`);
}

function publicImageUrl(storagePath){
  const {data}=supabaseClient.storage.from(supabaseConfig.bucket).getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

function renderGallery(){
  gallery.innerHTML="";
  memoryCount.textContent=`${pad(memories.length)} / 24`;
  const emptyState=document.querySelector("#emptyState");
  if(emptyState) emptyState.hidden=memories.length>0;

  memories.forEach((memory,index)=>{
    const button=document.createElement("button");
    button.className="tile";
    button.type="button";
    button.setAttribute("aria-label",`Open ${memory.title||"memory"}`);
    button.addEventListener("click",()=>openViewer(index,button));

    const img=document.createElement("img");
    img.src=memory.src;
    img.alt=memory.title||"Memory";
    img.loading="lazy";
    img.decoding="async";
    button.append(img);
    gallery.append(button);
  });
}

function buildViewer(){
  viewerScroll.innerHTML="";
  memories.forEach((memory,index)=>{
    const card=document.createElement("article");
    card.className="viewer-card";
    card.dataset.index=index;

    const wrap=document.createElement("div");
    wrap.className="viewer-photo-wrap";

    const img=document.createElement("img");
    img.className="viewer-photo";
    img.src=memory.src;
    img.alt=memory.title||"Memory";
    img.decoding="async";

    wrap.append(img);

    if(memory.title){
      card.classList.add("has-caption");

      const fade=document.createElement("div");
      fade.className="viewer-caption-fade";
      wrap.append(fade);

      const caption=document.createElement("div");
      caption.className="viewer-title";
      caption.textContent=memory.title;
      wrap.append(caption);
    }

    card.append(wrap);
    viewerScroll.append(card);
  });
  setBackdrop(activeIndex);
}

function setBackdrop(index){
  const memory=memories[index];
  if(!memory)return;
  viewerBackdrop.style.backgroundImage=`url("${memory.src}")`;
}

function updateViewerFromScroll(){
  const cards=[...viewerScroll.querySelectorAll(".viewer-card")];
  if(!cards.length)return;

  const center=viewerScroll.scrollTop+viewerScroll.clientHeight/2;
  let nearest=0, distance=Infinity;
  cards.forEach((card,index)=>{
    const cardCenter=card.offsetTop+card.offsetHeight/2;
    const d=Math.abs(center-cardCenter);
    if(d<distance){distance=d;nearest=index;}
  });

  if(nearest!==activeIndex){
    activeIndex=nearest;
    setActiveCard(activeIndex);
    setBackdrop(activeIndex);
    hintDismissed=true;
    viewer.classList.add("has-scrolled");
  }

  if(viewerScroll.scrollTop>30 && !hintDismissed){
    hintDismissed=true;
    viewer.classList.add("has-scrolled");
  }
}

function sharedOpenTransition(tile, index){
  const img=tile.querySelector("img");
  if(!img)return Promise.resolve();

  const rect=img.getBoundingClientRect();
  sharedTransitionImg.src=memories[index].src;

  Object.assign(sharedTransition.style,{
    left:`${rect.left}px`,
    top:`${rect.top}px`,
    width:`${rect.width}px`,
    height:`${rect.height}px`,
    opacity:"1"
  });
  sharedTransition.classList.add("active");

  return new Promise(resolve=>{
    requestAnimationFrame(()=>{
      const targetImg=viewerScroll.querySelectorAll(".viewer-card")[index]?.querySelector(".viewer-photo");
      if(!targetImg){resolve();return;}
      const before=targetImg.getBoundingClientRect();
      Object.assign(sharedTransition.style,{
        left:`${before.left}px`,
        top:`${before.top}px`,
        width:`${before.width}px`,
        height:`${before.height}px`
      });
      setTimeout(resolve,650);
    });
  });
}

function clearSharedTransition(){
  sharedTransition.classList.remove("active");
  sharedTransition.style.opacity="0";
}

function showViewerChrome(){
  viewer.classList.remove("is-quiet");
  clearTimeout(quietTimer);
  quietTimer=setTimeout(()=>viewer.classList.add("is-quiet"),3200);
}

function toggleViewerChrome(){
  if(viewer.classList.contains("is-quiet")){
    showViewerChrome();
  }else{
    viewer.classList.add("is-quiet");
    clearTimeout(quietTimer);
  }
}

function setActiveCard(index){
  viewerScroll.querySelectorAll(".viewer-card").forEach((card,i)=>{
    card.classList.toggle("is-active",i===index);
  });
}

async function openViewer(index, tile){
  activeIndex=index;
  viewerOpen=true;
  hintDismissed=false;
  viewer.classList.remove("has-scrolled","is-quiet");
  closing=false;
  showViewerChrome();

  buildViewer();
  setActiveCard(activeIndex);
  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";

  requestAnimationFrame(()=>{
    viewerScroll.querySelectorAll(".viewer-card")[index]?.scrollIntoView({block:"start"});
  });

  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await sharedOpenTransition(tile,index);
  clearSharedTransition();
}

async function closeViewer(){
  if(!viewerOpen || closing)return;
  closing=true;

  const cards=[...viewerScroll.querySelectorAll(".viewer-card")];
  const activeCard=cards[activeIndex];
  const activeImg=activeCard?.querySelector(".viewer-photo");
  const tile=gallery.querySelectorAll(".tile")[activeIndex];

  if(activeImg && tile){
    const from=activeImg.getBoundingClientRect();
    const to=tile.querySelector("img").getBoundingClientRect();

    sharedTransitionImg.src=memories[activeIndex].src;
    Object.assign(sharedTransition.style,{
      left:`${from.left}px`,top:`${from.top}px`,
      width:`${from.width}px`,height:`${from.height}px`,opacity:"1"
    });
    sharedTransition.classList.add("active");

    viewer.classList.remove("open");
    await new Promise(resolve=>{
      requestAnimationFrame(()=>{
        Object.assign(sharedTransition.style,{
          left:`${to.left}px`,top:`${to.top}px`,
          width:`${to.width}px`,height:`${to.height}px`
        });
        setTimeout(resolve,620);
      });
    });
  }else{
    viewer.classList.remove("open");
  }

  clearSharedTransition();
  viewer.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  viewerOpen=false;
  closing=false;
}

async function loadMemories(){
  if(!SUPABASE_CONFIGURED){
    renderGallery();
    showDataError("Supabase is not configured. Edit supabase-config.js with your project URL and Publishable key.");
    return;
  }

  setLoadingState(true);
  try{
    const {data,error}=await supabaseClient
      .from(supabaseConfig.table)
      .select("id,title,storage_path,created_at")
      .order("created_at",{ascending:true})
      .order("id",{ascending:true});

    if(error)throw error;

    memories.length=0;
    (data||[]).forEach(row=>{
      const src=publicImageUrl(row.storage_path);
      if(src){
        memories.push({
          id:row.id,
          title:row.title?.trim() || "",
          storagePath:row.storage_path,
          createdAt:row.created_at,
          src
        });
      }
    });
    renderGallery();
  }catch(error){
    showDataError(`Could not load memories: ${error.message || error}`);
    renderGallery();
  }finally{
    setLoadingState(false);
  }
}

function makeStoragePath(file){
  const mimeExtension={
    "image/jpeg":"jpg",
    "image/png":"png",
    "image/webp":"webp",
    "image/gif":"gif",
    "image/heic":"heic",
    "image/heif":"heif",
    "image/avif":"avif",
    "image/bmp":"bmp",
    "image/tiff":"tiff"
  };
  const originalExtension=(file.name?.split(".").pop()||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const extension=mimeExtension[file.type] || originalExtension || "jpg";
  const id=crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${id}.${extension}`;
}

async function saveMemoryToSupabase(file,title){
  if(!SUPABASE_CONFIGURED){
    throw new Error("Supabase is not configured. Add your project URL and Publishable key to supabase-config.js first.");
  }

  const storagePath=makeStoragePath(file);

  const {error:uploadError}=await supabaseClient.storage
    .from(supabaseConfig.bucket)
    .upload(storagePath,file,{
      contentType:file.type || undefined,
      cacheControl:"31536000",
      upsert:false
    });

  if(uploadError)throw uploadError;

  const {data,error:insertError}=await supabaseClient
    .from(supabaseConfig.table)
    .insert({
      title:title || null,
      storage_path:storagePath
    })
    .select("id,title,storage_path,created_at")
    .single();

  if(insertError)throw insertError;

  return {
    id:data.id,
    title:data.title?.trim() || "",
    storagePath:data.storage_path,
    createdAt:data.created_at,
    src:publicImageUrl(data.storage_path)
  };
}

viewerScroll.addEventListener("scroll",updateViewerFromScroll,{passive:true});
viewerClose.addEventListener("click",closeViewer);
viewerBackdrop.addEventListener("click",closeViewer);

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    if(viewerOpen)closeViewer();
    else if(sheet.classList.contains("open"))close();
  }
  if(viewerOpen && (e.key==="ArrowDown"||e.key==="ArrowRight")){
    viewerScroll.querySelectorAll(".viewer-card")[Math.min(memories.length-1,activeIndex+1)]?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  if(viewerOpen && (e.key==="ArrowUp"||e.key==="ArrowLeft")){
    viewerScroll.querySelectorAll(".viewer-card")[Math.max(0,activeIndex-1)]?.scrollIntoView({behavior:"smooth",block:"start"});
  }
});

function startBoundaryDrag(clientY){
  if(!viewerOpen)return;
  const atTop=activeIndex===0 && viewerScroll.scrollTop<=2;
  const atBottom=activeIndex===memories.length-1 &&
    Math.ceil(viewerScroll.scrollTop+viewerScroll.clientHeight)>=viewerScroll.scrollHeight-2;
  if(!atTop && !atBottom)return;
  dragStartY=clientY;
  draggingBoundary=true;
}
function updateBoundaryDrag(clientY){
  if(!draggingBoundary || dragStartY==null)return;
  const delta=clientY-dragStartY;
  const atTop=activeIndex===0;
  const pull=atTop ? Math.max(0,delta) : Math.max(0,-delta);
  if(pull>8){
    viewerBoundary.classList.toggle("visible",pull>55);
    viewerBoundary.style.transform=`translate(-50%, -50%) scale(${Math.min(1.06, .94+pull/400)})`;
  }
}
async function endBoundaryDrag(clientY){
  if(!draggingBoundary)return;
  const atTop=activeIndex===0;
  const delta=clientY-dragStartY;
  const pull=atTop ? Math.max(0,delta) : Math.max(0,-delta);

  dragStartY=null;
  draggingBoundary=false;
  viewerBoundary.classList.remove("visible");
  viewerBoundary.style.transform="translate(-50%,-50%) scale(.94)";

  if(pull>90){
    await closeViewer();
  }
}

function openSheet(){
  if(loadingMemories || savingMemory)return;
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function close(){
  if(savingMemory)return;
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  photoInput.value="";
  titleInput.value="";
  preview.hidden=true;
  if(previewObjectUrl){
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl=null;
  }
  previewImg.removeAttribute("src");
}
addButton.addEventListener("click",openSheet);
closeSheet.addEventListener("click",close);
cancel.addEventListener("click",close);
sheet.querySelector(".sheet-scrim").addEventListener("click",close);

photoInput.addEventListener("change",()=>{
  const file=photoInput.files?.[0];
  if(!file)return;
  if(!file.type.startsWith("image/")){
    photoInput.value="";
    showDataError("Please choose an image file.");
    return;
  }
  if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl=URL.createObjectURL(file);
  previewImg.src=previewObjectUrl;
  preview.hidden=false;
});

save.addEventListener("click",async()=>{
  const file=photoInput.files?.[0];
  if(!file){photoInput.click();return}
  if(savingMemory)return;

  savingMemory=true;
  save.disabled=true;
  save.setAttribute("aria-busy","true");

  try{
    const title=titleInput.value.trim();
    const memory=await saveMemoryToSupabase(file,title);
    memories.push(memory);
    memories.sort((a,b)=>{
      const timeA=Date.parse(a.createdAt)||0;
      const timeB=Date.parse(b.createdAt)||0;
      return timeA-timeB || String(a.id).localeCompare(String(b.id));
    });
    renderGallery();
    savingMemory=false;
    save.disabled=false;
    save.setAttribute("aria-busy","false");
    close();
    return;
  }catch(error){
    showDataError(`Could not save memory: ${error.message || error}`);
  }finally{
    savingMemory=false;
    save.disabled=false;
    save.setAttribute("aria-busy","false");
  }
});

viewer.addEventListener("click",(event)=>{
  if(!viewerOpen)return;
  if(event.target.closest(".viewer-close"))return;
  toggleViewerChrome();
});

function setPullClass(direction,pull){
  viewerScroll.classList.toggle("is-pulling-top",direction==="top" && pull>8);
  viewerScroll.classList.toggle("is-pulling-bottom",direction==="bottom" && pull>8);
  viewerBoundary.classList.toggle("visible",pull>55);
  viewerBoundary.style.transform=`translate(-50%,-50%) scale(${Math.min(1.06,.94+pull/400)})`;
}

function resetPullClass(){
  viewerScroll.classList.remove("is-pulling-top","is-pulling-bottom");
  viewerBoundary.classList.remove("visible");
  viewerBoundary.style.transform="translate(-50%,-50%) scale(.94)";
}

viewerScroll.addEventListener("touchstart",(e)=>{
  tapStart=Date.now();
  startBoundaryDrag(e.touches[0].clientY);
},{passive:true});

viewerScroll.addEventListener("touchmove",(e)=>{
  updateBoundaryDrag(e.touches[0].clientY);
  if(draggingBoundary && dragStartY!=null){
    const delta=e.touches[0].clientY-dragStartY;
    const atTop=activeIndex===0;
    const pull=atTop ? Math.max(0,delta) : Math.max(0,-delta);
    boundaryPull=pull;
    setPullClass(atTop?"top":"bottom",pull);
  }
},{passive:true});

viewerScroll.addEventListener("touchend",(e)=>{
  endBoundaryDrag(e.changedTouches[0].clientY);
  boundaryPull=0;
  resetPullClass();
},{passive:true});

viewer.addEventListener("mousemove",()=>{
  if(viewerOpen)showViewerChrome();
},{passive:true});

renderGallery();
loadMemories();
