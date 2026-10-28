const film=document.querySelector('#capstone-demo');
const source=film.querySelector('source');
const status=document.querySelector('#demo-status');
const chapters=[...document.querySelectorAll('[data-seek]')];
const mediaURL=new URL(source.dataset.src||source.getAttribute('src'),document.baseURI);
let objectURL;

// A local Blob makes this short recording seekable even on hosts without Range support.
async function loadRecording(){
 try{
  const response=await fetch(mediaURL,{credentials:'same-origin'});
  if(!response.ok)throw new Error('Video unavailable');
  const bytes=await response.blob();
  objectURL=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
  await new Promise((resolve,reject)=>{
   const clear=()=>{film.removeEventListener('loadedmetadata',ready);film.removeEventListener('error',failed);clearTimeout(timer);};
   const ready=()=>{clear();resolve();};
   const failed=()=>{clear();reject(new Error('Video could not decode'));};
   const timer=setTimeout(failed,15000);
   film.addEventListener('loadedmetadata',ready,{once:true});
   film.addEventListener('error',failed,{once:true});
   source.src=objectURL;film.load();
  });
  for(const button of chapters)button.disabled=false;
  if(status)status.hidden=true;
 }catch{
  source.src=mediaURL.href;film.load();
  if(status)status.textContent='Chapter selection is unavailable. You can watch the video from the beginning.';
 }finally{film.setAttribute('aria-busy','false');}
}
loadRecording();

for(const button of chapters)button.addEventListener('click',()=>{
 const seek=Number(button.dataset.seek);
 film.currentTime=Math.min(seek,Math.max(0,film.duration-.1));
 film.play().catch(()=>{});
 film.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
 film.focus({preventScroll:true});
});
film.addEventListener('timeupdate',()=>{
 const current=chapters.filter(button=>film.currentTime>=Number(button.dataset.seek)).at(-1);
 for(const button of chapters){const active=button===current;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)film.pause();});
window.addEventListener('pagehide',event=>{if(!event.persisted&&objectURL)URL.revokeObjectURL(objectURL);});
