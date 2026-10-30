// Direct manipulation of the motion study. No scripted chat or model replies.
export function initAssistantStudy(form,{paused=()=>false}={}){
 const stage=document.querySelector('#assistant'),canvas=document.querySelector('#hero-canvas'),status=document.querySelector('#presence-status'),hint=document.querySelector('#presence-instructions span');
 const events=new AbortController(),options={signal:events.signal};
 let point={x:.5,y:.5},held=false,disposed=false;
 function locate(e){stage.classList.remove('using-keys');const r=canvas.getBoundingClientRect();point={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};form.setPointer(point.x,point.y,true);}
 function hold(value){if(disposed)return;held=value;form.setHeld(value);stage.classList.toggle('is-held',value);hint.textContent=value?'Release to unfold.':'Hold to gather.';status.textContent=value?'The form gathers toward your pointer.':'The form opens and settles.';}
 canvas.addEventListener('pointermove',locate,options);
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;locate(e);canvas.setPointerCapture(e.pointerId);hold(true);},options);
 canvas.addEventListener('pointerup',e=>{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);hold(false);},options);
 canvas.addEventListener('pointercancel',()=>hold(false),options);
 canvas.addEventListener('lostpointercapture',()=>{if(held)hold(false);},options);
 canvas.addEventListener('pointerleave',()=>{if(!held)form.setPointer(.5,.5,false);},options);
 stage.addEventListener('keydown',e=>{if(e.target!==stage)return;stage.classList.add('using-keys');if(e.code==='Space'){e.preventDefault();if(!e.repeat)hold(true);return;}const directions={ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,-.08],ArrowDown:[0,.08]};const step=directions[e.key];if(step){e.preventDefault();point.x=Math.max(0,Math.min(1,point.x+step[0]));point.y=Math.max(0,Math.min(1,point.y+step[1]));form.setPointer(point.x,point.y,true);}},options);
 stage.addEventListener('keyup',e=>{if(e.code==='Space'&&held){e.preventDefault();hold(false);}},options);
 stage.addEventListener('focusout',()=>{if(held)hold(false);},options);
 document.querySelector('#presence-reform').addEventListener('click',()=>{hold(false);form.excite();status.textContent='A wave moves through the form.';},options);
 window.addEventListener('blur',()=>{if(held)hold(false);form.setPointer(.5,.5,false);},options);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(held)hold(false);form.setPointer(.5,.5,false);}},options);
 return{update(){form.setPaused?.(paused());},dispose(){disposed=true;events.abort();}};
}
