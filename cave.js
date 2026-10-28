import { CaveWorld } from './cave-world.js';

const $=selector=>document.querySelector(selector);
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const state={mode:'ripple',x:.5,y:.5,energy:.6,calm:.45,pinch:.45,paused:motionPreference.matches};
const modeCopy={
 ripple:['01 / LIVING CURRENTS','Your presence<br>moves the light.','Move across the cave to push waves through the walls.'],
 portal:['02 / THRESHOLD','Open another<br>layer of space.','Open your pinch to widen the portal, or use the portal slider.'],
 memory:['03 / ECHOES','Leave a trace.<br>Let it become a place.','Draw across the scene. Your light lingers, then slowly fades.']
};
let world=null,currentView='project',inputSource='pointer',disposed=false,xrGeneration=0;
function ensureWorld(){
 if(!world){world=new CaveWorld($('#cave-world'));world.setState(state);$('#render-kind').textContent=world.kind==='webgl'?'LIVE WEBGL / PROCEDURAL CAVE':'LIVE 2D / COMPATIBILITY MODE';
  $('#cave-world').addEventListener('cave-xr-state',e=>{$('#enter-xr').textContent=e.detail.active?'Exit VR ×':'Enter VR ↗';$('#xr-message').textContent=e.detail.active?'Immersive VR session active.':'Experimental WebXR · compatible headset/browser required.';apply({});});
 }
 return world;
}
function updateUI(){
 $('#position-x').textContent=state.x.toFixed(2);$('#position-y').textContent=state.y.toFixed(2);
 $('#world-energy').value=String(Math.round(state.energy*100));$('#energy-value').value=`${Math.round(state.energy*100)}%`;
 $('#world-pinch').value=String(Math.round(state.pinch*100));$('#pinch-value').value=`${Math.round(state.pinch*100)}%`;
 $('#pause-world').textContent=state.paused?'Resume ▷':'Pause Ⅱ';$('#pause-world').setAttribute('aria-pressed',String(state.paused));
 $('#state-inspector').textContent=JSON.stringify({input:inputSource,mode:state.mode,position:{x:+state.x.toFixed(2),y:+state.y.toFixed(2)},energy:+state.energy.toFixed(2),calm:+state.calm.toFixed(2),aperture:+state.pinch.toFixed(2),automaticMotion:!state.paused,memory:'session-local'},null,2);
}
function apply(partial){Object.assign(state,partial);world?.setState({...state,paused:state.paused||currentView!=='future'||(document.hidden&&!world?.xrSession)});updateUI();}
function setMode(mode){
 if(!modeCopy[mode])return;apply({mode});
 for(const button of document.querySelectorAll('[data-world-mode]')){const active=button.dataset.worldMode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 const copy=modeCopy[mode];$('#world-counter').textContent=copy[0];$('#world-title').innerHTML=copy[1];$('#world-instruction').textContent=copy[2];
}
function setView(view,{scroll=false}={}){
 if(!['project','future','how'].includes(view))view='project';currentView=view;
 for(const name of ['project','future','how'])$(`#${name}-panel`).hidden=name!==view;
 for(const link of document.querySelectorAll('[data-tab]')){const active=link.dataset.tab===view;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(view==='future')ensureWorld();else{xrGeneration++;stopCamera();stopSpeech();void world?.exitXR();}
 apply({});if(scroll)window.scrollTo({top:0,behavior:'instant'});
}
for(const link of document.querySelectorAll('[data-tab],[data-open-view]'))link.addEventListener('click',e=>{e.preventDefault();const view=link.dataset.tab||link.dataset.openView;if(location.hash!==`#${view}`)location.hash=view;else setView(view,{scroll:true});});
window.addEventListener('hashchange',()=>setView(location.hash.slice(1),{scroll:true}));
for(const button of document.querySelectorAll('[data-world-mode]'))button.addEventListener('click',()=>setMode(button.dataset.worldMode));
function selectIntent(intent){
 const choices={quiet:{calm:.92,energy:.24},curious:{calm:.45,energy:.6},energised:{calm:.08,energy:.95}};
 if(!choices[intent])return;apply(choices[intent]);
 for(const button of document.querySelectorAll('[data-intent]')){const active=button.dataset.intent===intent;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
}
for(const button of document.querySelectorAll('[data-intent]'))button.addEventListener('click',()=>selectIntent(button.dataset.intent));
$('#world-energy').addEventListener('input',e=>{apply({energy:Number(e.target.value)/100});for(const b of document.querySelectorAll('[data-intent]')){b.classList.remove('active');b.setAttribute('aria-pressed','false');}});
$('#world-pinch').addEventListener('input',e=>apply({pinch:Number(e.target.value)/100}));
$('#pause-world').addEventListener('click',()=>apply({paused:!state.paused}));
motionPreference.addEventListener('change',e=>apply({paused:e.matches}));
$('#clear-memory').addEventListener('click',()=>{world?.clearMemory();$('#command-message').textContent='Local traces cleared.';});
$('#reset-world').addEventListener('click',()=>{stopCamera();stopSpeech();world?.clearMemory();setMode('ripple');selectIntent('curious');apply({x:.5,y:.5,pinch:.45});$('#command-message').textContent='World reset. Your motion preference has been kept.';});

const stage=$('#cave-stage'),canvas=$('#cave-world');
function manualPosition(event){if(inputSource!=='pointer')return;const r=canvas.getBoundingClientRect();apply({x:clamp((event.clientX-r.left)/r.width),y:clamp(1-(event.clientY-r.top)/r.height)});}
canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);manualPosition(event);});
canvas.addEventListener('pointermove',manualPosition);
stage.addEventListener('keydown',event=>{
 if(event.target!==stage)return;
 const actions={ArrowLeft:()=>apply({x:clamp(state.x-.04)}),ArrowRight:()=>apply({x:clamp(state.x+.04)}),ArrowUp:()=>apply({y:clamp(state.y+.04)}),ArrowDown:()=>apply({y:clamp(state.y-.04)}),' ':()=>apply({paused:!state.paused})};
 if(actions[event.key]){event.preventDefault();actions[event.key]();}
});
$('#fullscreen-world').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.requestFullscreen)await stage.requestFullscreen();else $('#command-message').textContent='Fullscreen is not available in this browser. The scene remains interactive.';}catch{$('#command-message').textContent='Fullscreen could not start. The scene remains interactive.';}});

// Learned landmark detection runs locally. Scene response is explicit parameter mapping.
let stream=null,detector=null,cameraGeneration=0,cameraActive=false,cameraStarting=false,lastVideo=-1,lastInference=0,lastDetected=0,cameraTimeout=null;
const video=$('#cave-video'),preview=$('.video-preview'),landmarkCanvas=$('#landmarks'),landmarkContext=landmarkCanvas.getContext('2d');
function inputUI(source){
 inputSource=source;for(const b of document.querySelectorAll('[data-input]')){const active=b.dataset.input===source;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 $('#input-source').textContent=source==='pointer'?'POINTER / TOUCH':source==='hand'?'AI HAND / LOCAL':'AI BODY / LOCAL';updateUI();
}
function stopCamera(message='Move the pointer or touch the scene. No camera needed.'){
 cameraGeneration++;clearTimeout(cameraTimeout);cameraStarting=false;cameraActive=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;detector?.close();detector=null;preview.hidden=true;$('#stop-input').hidden=true;$('#camera-message').textContent=message;$('#tracking-quality').textContent='MANUAL CONTROL';landmarkContext?.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);inputUI('pointer');
}
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Model loading timed out')),35000);})]);}finally{clearTimeout(timer);}}
async function startCamera(kind){
 if((cameraActive||cameraStarting)&&inputSource===kind){stopCamera();return;}stopCamera();
 if(!navigator.mediaDevices?.getUserMedia){$('#camera-message').textContent='Camera tracking needs HTTPS or localhost and a supported browser. Pointer controls are available.';return;}
 const generation=++cameraGeneration;cameraStarting=true;inputUI(kind);$('#stop-input').hidden=false;$('#camera-message').textContent='Requesting camera permission…';$('#tracking-quality').textContent='AWAITING CAMERA';
 cameraTimeout=setTimeout(()=>{if(generation===cameraGeneration)stopCamera('Camera request timed out. Pointer controls are available; you can try again.');},45000);
 try{
  const next=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
  if(generation!==cameraGeneration){next.getTracks().forEach(t=>t.stop());return;}stream=next;clearTimeout(cameraTimeout);$('#camera-message').textContent=`Loading the ${kind==='hand'?'hand':'pose'} landmark model…`;
  const visionModule=await bounded(import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'));if(generation!==cameraGeneration)return;
  const files=await bounded(visionModule.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'));if(generation!==cameraGeneration)return;
  const model=kind==='hand'?'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task':'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  const Class=kind==='hand'?visionModule.HandLandmarker:visionModule.PoseLandmarker;
  const options={baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode:'VIDEO',...(kind==='hand'?{numHands:1,minHandDetectionConfidence:.6,minTrackingConfidence:.6}:{numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false})};
  const created=await bounded(Class.createFromOptions(files,options).then(d=>{if(generation!==cameraGeneration){d.close();return null;}return d;}));
  if(!created)return;if(generation!==cameraGeneration){created.close();return;}detector=created;
  video.srcObject=stream;await video.play();if(generation!==cameraGeneration)return;
  cameraStarting=false;cameraActive=true;preview.hidden=false;lastVideo=-1;lastDetected=performance.now();
  $('#camera-message').textContent=kind==='hand'?'Move one hand to steer; separate thumb and index to open the portal.':'Keep your shoulders in view. Upper-body position steers the light.';$('#tracking-quality').textContent='SEARCHING';
 }catch(error){if(generation===cameraGeneration){const text=error?.name==='NotAllowedError'?'Camera permission was not granted. Pointer controls are ready.':error?.name==='NotFoundError'?'No camera was found. Pointer controls are ready.':'Tracking could not start. Check the connection or use pointer controls.';stopCamera(text);}}
}
for(const button of document.querySelectorAll('[data-input]'))button.addEventListener('click',()=>button.dataset.input==='pointer'?stopCamera():void startCamera(button.dataset.input));
$('#stop-input').addEventListener('click',()=>stopCamera());
const handEdges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const bodyEdges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]];
function drawLandmarks(points){
 if(!landmarkContext)return;landmarkCanvas.width=320;landmarkCanvas.height=240;const c=landmarkContext;c.clearRect(0,0,320,240);c.strokeStyle='#91f5ff';c.lineWidth=1.5;c.fillStyle='#fff4cc';
 for(const [a,b] of inputSource==='hand'?handEdges:bodyEdges){if(!points[a]||!points[b])continue;if(inputSource==='body'&&((points[a].visibility??1)<.4||(points[b].visibility??1)<.4))continue;c.beginPath();c.moveTo(points[a].x*320,points[a].y*240);c.lineTo(points[b].x*320,points[b].y*240);c.stroke();}
 for(const p of points){if((p.visibility??1)<.4)continue;c.beginPath();c.arc(p.x*320,p.y*240,2,0,Math.PI*2);c.fill();}
}
function track(now){
 if(!cameraActive||!detector||video.readyState<2||now-lastInference<95||lastVideo===video.currentTime)return;lastInference=now;lastVideo=video.currentTime;
 try{
  const result=detector.detectForVideo(video,now),points=result.landmarks?.[0];
  if(points&&(inputSource==='hand'||((points[11]?.visibility??0)>.45&&(points[12]?.visibility??0)>.45))){
   let x,y,pinch=state.pinch;if(inputSource==='hand'){x=1-points[9].x;y=1-points[9].y;const d=Math.hypot(points[4].x-points[8].x,points[4].y-points[8].y),width=Math.hypot(points[5].x-points[17].x,points[5].y-points[17].y);pinch=clamp((d/Math.max(width,.025)-.15)/1.3);}
   else{x=1-(points[11].x+points[12].x)/2;y=1-(points[11].y+points[12].y)/2;}
   apply({x:state.x*.7+clamp(x)*.3,y:state.y*.7+clamp(y)*.3,pinch:state.pinch*.7+pinch*.3});lastDetected=now;$('#tracking-quality').textContent=inputSource==='hand'?'HAND DETECTED':'UPPER BODY DETECTED';drawLandmarks(points);
  }else{$('#tracking-quality').textContent='NO LANDMARKS / HOLDING POSITION';landmarkContext?.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);if(now-lastDetected>1000)apply({x:state.x*.96+.5*.04,y:state.y*.96+.5*.04});}
 }catch{stopCamera('Tracking stopped. Pointer controls are available.');}
}

// This command interpreter is intentionally a bounded prototype, not an LLM.
function command(text){
 const t=text.trim().toLowerCase();if(!t)return;let changes=0;
 if(/安静|平静|quiet|calm|slower|慢/.test(t)){selectIntent('quiet');changes++;}
 if(/探索|好奇|curious/.test(t)){selectIntent('curious');changes++;}
 if(/能量|热闹|兴奋|energ|intense|bright|暖|warm/.test(t)){selectIntent('energised');changes++;}
 if(/深海|ocean|sea|流动|wave|ripple/.test(t)){setMode('ripple');changes++;}
 if(/门|portal|threshold/.test(t)){setMode('portal');apply({pinch:/关|close|shut/.test(t)?0:.95});changes++;}
 if(/记忆|痕迹|光迹|留下|memory|echo|trace/.test(t)){setMode('memory');changes++;}
 if(/清除|擦除|clear|erase/.test(t)){world?.clearMemory();changes++;}
 if(/重置|reset/.test(t)){world?.clearMemory();setMode('ripple');selectIntent('curious');apply({pinch:.45,x:.5,y:.5});changes++;}
 $('#command-message').textContent=changes?`Applied preset mapping → ${state.mode} / energy ${Math.round(state.energy*100)}%. No language model was called.`:'No matching preset. Try “calmer”, “open a portal” or “留下发光的记忆”.';
}
$('#command-form').addEventListener('submit',event=>{event.preventDefault();command($('#scene-command').value);});
for(const button of document.querySelectorAll('[data-command]'))button.addEventListener('click',()=>{$('#scene-command').value=button.dataset.command;command(button.dataset.command);});
let recognition=null,recognising=false;
function stopSpeech(){const wasListening=recognising;if(recognition){recognition.onresult=null;recognition.onend=null;recognition.onerror=null;recognition.abort();recognition=null;}recognising=false;$('#voice-command').textContent='Use browser speech ◉';if(wasListening)$('#command-message').textContent='Speech recognition stopped. You can type a command.';}
$('#voice-command').addEventListener('click',()=>{
 if(recognising){stopSpeech();return;}const API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!API){$('#command-message').textContent='Speech recognition is unavailable in this browser. Type a command instead.';return;}
 recognition=new API();recognition.lang=$('#voice-language').value;recognition.continuous=false;recognition.interimResults=false;recognising=true;$('#voice-command').textContent='Stop listening ×';$('#command-message').textContent='Listening through the browser speech service…';
 recognition.onresult=event=>{const text=event.results[0][0].transcript;$('#scene-command').value=text;command(text);};
 recognition.onend=()=>{recognising=false;recognition=null;$('#voice-command').textContent='Use browser speech ◉';};
 recognition.onerror=()=>{$('#command-message').textContent='Speech recognition did not complete. Type a command instead.';};
 try{recognition.start();}catch{stopSpeech();$('#command-message').textContent='Microphone recognition could not start. Type a command instead.';}
});
$('#enter-xr').addEventListener('click',async()=>{
 const w=ensureWorld(),generation=++xrGeneration;try{if(w.xrSession){await w.exitXR();return;}const supported=await w.isXRSupported();if(generation!==xrGeneration||currentView!=='future')return;if(!supported){$('#xr-message').textContent='Immersive VR is not supported here. Use a compatible WebXR headset/browser; this screen remains interactive.';return;}await w.enterXR();if(generation!==xrGeneration||currentView!=='future')await w.exitXR();}catch(error){if(generation===xrGeneration)$('#xr-message').textContent=error?.message||'VR could not start. The browser view remains available.';}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera('Camera stopped while the page was hidden. You can restart it when ready.');stopSpeech();}apply({});});
window.addEventListener('pagehide',()=>{xrGeneration++;stopCamera();stopSpeech();world?.dispose();world=null;disposed=true;});
window.addEventListener('pageshow',event=>{if(event.persisted){disposed=false;if(currentView==='future')ensureWorld();requestAnimationFrame(frame);}});
function frame(now){if(disposed)return;if(currentView==='future'&&!document.hidden)track(now);requestAnimationFrame(frame);}
setView(location.hash.slice(1)||'project');updateUI();requestAnimationFrame(frame);
