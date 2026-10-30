import { PhotoCaveWorld } from './cave-photo-world.js';
import { BodyAvatar, poseSignals } from './cave-avatar.js';

const $=s=>document.querySelector(s),clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const state={mode:'ripple',memoryStyle:'lotus',x:.5,y:.5,bodyX:.5,bodyY:.15,energy:.6,calm:.45,opening:0,held:false,original:false,photo:'blue',source:'pointer',isActive:false,isTracking:false,wristTracked:false,paused:motionPreference.matches};
let world=null,avatar=null,currentView='project',inputSource='pointer',disposed=false,demo=null,lastPointer=0;
let grip={active:false,anchorX:.5,base:0,side:0,distance:null};
const copies={
 ripple:{counter:'01 / FOLLOW THE LIGHT',title:'Let the light follow you'},
 portal:{counter:'02 / GRAB · PULL · REVEAL',title:'Grab the wall. Pull it open.'},
 memory:{counter:'03 / LEAVE A LIGHT MEMORY',title:'Leave a trace of your movement'}
};
function ensureWorld(){
 if(!world){const w=world=new PhotoCaveWorld($('#cave-world'));w.ready.catch(()=>{if(world===w)$('#camera-message').textContent='The project image could not load. Refresh or check your connection; the original images are also in Project.';});avatar=new BodyAvatar($('#body-avatar'));}
 return world;
}
const memoryStyles={
 lotus:{title:'Lotus trail',note:'Move to leave a trail of blooming lotuses.'},
 water:{title:'Water ripples',note:'Move to send ripples across the floor.'},
 fish:{title:'Koi pond',note:'Move slowly to draw the koi closer. Sweep quickly to scatter them.'}
};
function sourceExplanation(){
 const body=inputSource==='body',hand=inputSource==='hand',portal=state.mode==='portal',memory=state.mode==='memory';
 const effect=memoryStyles[state.memoryStyle];
 $('#control-title').textContent=body?'Body control':hand?'Hand control':'Mouse control';
 $('#control-instructions').textContent=body?(portal?'Step back until both shoulders and hands are visible. Spread your arms to open the scene; bring them together to close it.':memory?'Move from side to side. The avatar mirrors your pose and the floor responds to your position.':'Move from side to side to change projection brightness. Your wrist controls a smaller area.'):hand?(portal?'Pinch the central seam with your thumb and index finger, hold, then pull sideways. Release to keep the opening.':memory?'Keep your hand in the camera view and move it to guide a path across the floor.':'Move your hand to change projection brightness in the corresponding part of the wall.'):(portal?'Hold the central seam and drag left or right. Release to keep the opening.':memory?'Move the pointer across the scene or avatar to guide a path across the floor.':'Move the pointer across the scene or avatar to brighten or dim the corresponding wall area.');
 $('#world-instruction').textContent=state.original?'Original image · choose Interactive to begin.':portal?(body?'Spread your arms to open; bring them together to close.':hand?'Pinch the seam, keep holding and pull outward.':'Hold the central seam and drag outward.'):memory?effect.note:(body?'Move your body to brighten different parts of the projection.':hand?'Move your hand to brighten or dim the stone projections.':'Move the pointer to brighten or dim the stone projections.');
 $('#actor-source').textContent=demo?'DEMO':body?(state.isTracking?'BODY / LIVE':'BODY / WAITING'):hand?(state.isTracking?'HAND / LIVE':'HAND / WAITING'):'MOUSE';
 $('#actor-status').textContent=body?(state.isTracking?'Body tracked · avatar mirrors your pose':'Keep your shoulders in view'):hand?(state.isTracking?'Hand tracked':'Keep your hand in view'):demo?'Demo · camera off':'Mouse control · camera off';
 $('#hand-guide').hidden=!hand;$('#body-avatar').hidden=hand;$('#hand-action-label').textContent=portal?'PINCH · HOLD · PULL':'MOVE YOUR HAND';
 $('#input-source').textContent=demo?'Demo · camera off':body?(state.isTracking?'Body tracked':'Body · waiting'):hand?(state.isTracking?'Hand tracked':'Hand · waiting'):'Mouse · camera off';
 $('#pointer-label').textContent=body?(state.wristTracked?'WRIST':'TORSO'):hand?'HAND':'MOUSE';
 $('#memory-effects').hidden=!memory;
 $('#memory-effect-note').textContent=effect.note;
 for(const b of document.querySelectorAll('[data-memory-style]')){const active=b.dataset.memoryStyle===state.memoryStyle;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 $('#cave-stage').dataset.mode=state.mode;$('#grip-status').hidden=!portal;
 if(memory)$('#world-title').textContent=effect.title;
}
function trackingResponse(){
 if(state.mode==='portal')return inputSource==='body'?'Body tracked. Spread your arms to open the scene; bring them together to close it.':'Hand tracked. Pinch the seam and pull sideways.';
 if(state.mode==='memory')return inputSource==='body'?'Body tracked. Move to guide the floor effects.':'Hand tracked. Move your hand to guide the floor effects.';
 return inputSource==='body'?(state.wristTracked?'Body and wrist tracked. Move to adjust projection brightness.':'Body tracked; wrists are out of view. Your torso now controls projection brightness.'):'Hand tracked. Move to adjust projection brightness.';
}
function updateUI(){
 $('#position-x').textContent=state.x.toFixed(2);$('#position-y').textContent=state.y.toFixed(2);
 $('#world-energy').value=String(Math.round(state.energy*100));$('#energy-value').value=`${Math.round(state.energy*100)}%`;
 $('#world-pinch').value=String(Math.round(state.opening*100));$('#pinch-value').value=`${Math.round(state.opening*100)}%`;
 $('#pause-world').textContent=state.paused?'Resume ▷':'Pause Ⅱ';$('#pause-world').setAttribute('aria-pressed',String(state.paused));
 $('#interaction-pointer').style.left=`${state.x*100}%`;$('#interaction-pointer').style.top=`${(1-state.y)*100}%`;$('#interaction-pointer').hidden=state.original||state.mode!=='portal'||(!state.isTracking&&inputSource!=='pointer');$('#interaction-pointer').classList.toggle('gripping',state.held);
 $('#grip-hint').hidden=state.original||state.mode!=='portal'||state.held||state.opening>.15;
 for(const b of document.querySelectorAll('[data-baseline]')){const a=(b.dataset.baseline==='true')===state.original;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}
 for(const b of document.querySelectorAll('[data-photo]')){const a=b.dataset.photo===state.photo;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}
 $('#render-kind').textContent=state.original?'ORIGINAL':'INTERACTIVE';
 $('#state-inspector').textContent=JSON.stringify({input:inputSource,view:state.original?'original photograph':'proposed interactive enhancement',mode:state.mode,controlPoint:{x:+state.x.toFixed(2),y:+state.y.toFixed(2)},grabbed:state.held,opening:+state.opening.toFixed(2),energy:+state.energy.toFixed(2),bodyPosition:{x:state.bodyX,y:state.bodyY},memoryStyle:state.memoryStyle},null,2);
 if(inputSource==='pointer')avatar?.setState({demo:true,x:state.x,y:1-state.y,leftArm:state.mode==='portal'?state.opening*.8:.12,rightArm:undefined});
 sourceExplanation();
}
function apply(partial){Object.assign(state,partial);world?.setState({...state,paused:state.paused||currentView!=='future'||document.hidden});updateUI();}
function cancelDemo(){demo=null;$('#play-demo').textContent='Play demo ▷';}
function releaseGrip(message){grip.active=false;apply({held:false});if(message)$('#grip-status').textContent=message;}
function setMode(mode){
 if(!copies[mode])return;cancelDemo();releaseGrip();apply({mode,photo:mode==='memory'?'projection':'blue',original:false,isActive:false,...(mode==='portal'?{opening:0}:{})});
 for(const b of document.querySelectorAll('[data-world-mode]')){const a=b.dataset.worldMode===mode;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}
 const c=copies[mode];$('#world-counter').textContent=c.counter;$('#world-title').textContent=mode==='memory'?memoryStyles[state.memoryStyle].title:c.title;
 $('#grip-status').textContent=mode==='portal'?'Grab the central seam, then pull outward.':mode==='memory'?memoryStyles[state.memoryStyle].note:'Move to see the stone projections brighten and dim.';
}
function setView(view,{scroll=false}={}){
 if(!['project','future','how'].includes(view))view='project';currentView=view;
 for(const n of ['project','future','how'])$(`#${n}-panel`).hidden=n!==view;
 for(const a of document.querySelectorAll('[data-tab]')){const yes=a.dataset.tab===view;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 if(view==='future')ensureWorld();else{cancelDemo();stopCamera();stopSpeech();}apply({isActive:false});if(scroll)window.scrollTo({top:0,behavior:'instant'});
}
for(const link of document.querySelectorAll('[data-tab],[data-open-view]'))link.addEventListener('click',e=>{e.preventDefault();const v=link.dataset.tab||link.dataset.openView;if(location.hash!==`#${v}`)location.hash=v;else setView(v,{scroll:true});});
window.addEventListener('hashchange',()=>setView(location.hash.slice(1),{scroll:true}));
for(const b of document.querySelectorAll('[data-world-mode]'))b.addEventListener('click',()=>setMode(b.dataset.worldMode));
function selectMemoryStyle(style){
 if(!memoryStyles[style])return;
 cancelDemo();world?.clearMemory();
 apply({memoryStyle:style,original:false,isActive:false});
 $('#grip-status').textContent=memoryStyles[style].note;
}
for(const b of document.querySelectorAll('[data-memory-style]'))b.addEventListener('click',()=>selectMemoryStyle(b.dataset.memoryStyle));
for(const b of document.querySelectorAll('[data-baseline]'))b.addEventListener('click',()=>{cancelDemo();apply({original:b.dataset.baseline==='true',held:false,isActive:false});grip.active=false;});
for(const b of document.querySelectorAll('[data-photo]'))b.addEventListener('click',()=>{apply({photo:b.dataset.photo});for(const x of document.querySelectorAll('[data-photo]')){const a=x===b;x.classList.toggle('active',a);x.setAttribute('aria-pressed',String(a));}});
function selectIntent(intent){
 const p={quiet:{calm:.92,energy:.24},curious:{calm:.45,energy:.6},energised:{calm:.08,energy:.95}};if(!p[intent])return;apply(p[intent]);
 for(const b of document.querySelectorAll('[data-intent]')){const a=b.dataset.intent===intent;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}
}
for(const b of document.querySelectorAll('[data-intent]'))b.addEventListener('click',()=>selectIntent(b.dataset.intent));
$('#world-energy').addEventListener('input',e=>apply({energy:Number(e.target.value)/100}));
$('#world-pinch').addEventListener('input',e=>{cancelDemo();apply({opening:Number(e.target.value)/100,original:false});});
$('#pause-world').addEventListener('click',()=>apply({paused:!state.paused}));motionPreference.addEventListener('change',e=>apply({paused:e.matches}));
$('#clear-memory').addEventListener('click',()=>{world?.clearMemory();$('#command-message').textContent='Floor effects reset.';});
$('#reset-world').addEventListener('click',()=>{cancelDemo();stopCamera();stopSpeech();world?.clearMemory();setMode('ripple');selectIntent('curious');apply({x:.5,y:.5,bodyX:.5,bodyY:.15,opening:0,memoryStyle:'lotus',original:false,isActive:false});$('#command-message').textContent='Scene reset. Choose an interaction to begin again.';});

const stage=$('#cave-stage'),canvas=$('#cave-world');
function startGrip(x){
 const edge=.5+(x<.5?-1:1)*state.opening*.34;
 if(Math.min(Math.abs(x-.5),Math.abs(x-edge))>.18){$('#grip-status').textContent='Move near the central seam or a glowing edge, then grab it.';return false;}
 grip={active:true,anchorX:x,base:state.opening,side:Math.abs(x-.5)>.04?Math.sign(x-.5):0,distance:null};apply({held:true});$('#grip-status').textContent='Grabbed · keep pinching or holding the mouse button and pull sideways.';return true;
}
function pullGrip(x){if(!grip.active)return;const delta=x-grip.anchorX;if(!grip.side&&Math.abs(delta)>.008)grip.side=Math.sign(delta);apply({opening:clamp(grip.base+delta*(grip.side||1)*2.6),held:true});$('#grip-status').textContent=`Opening ${Math.round(state.opening*100)}% · release to hold it in place`;}
function pointerPosition(event,element){const r=element.getBoundingClientRect();return{x:clamp((event.clientX-r.left)/r.width),y:clamp(1-(event.clientY-r.top)/r.height)};}
function manualMove(event,element){if(inputSource!=='pointer')return;cancelDemo();const p=pointerPosition(event,element);lastPointer=performance.now();apply({...p,bodyX:p.x,bodyY:.12+(1-p.y)*.3,isActive:true,isTracking:false,source:'pointer'});if(state.mode==='portal'&&grip.active)pullGrip(p.x);}
for(const element of [canvas,$('#body-avatar')]){
 element.addEventListener('pointerdown',e=>{if(inputSource!=='pointer')return;cancelDemo();element.setPointerCapture(e.pointerId);const p=pointerPosition(e,element);if(state.mode==='portal')startGrip(p.x);manualMove(e,element);});
 element.addEventListener('pointermove',e=>manualMove(e,element));
 element.addEventListener('pointerup',()=>{if(grip.active)releaseGrip('Released · grab an edge to keep pulling, or reset the scene.');});
 element.addEventListener('pointercancel',()=>releaseGrip('Gesture ended.'));
}
stage.addEventListener('keydown',e=>{if(e.target!==stage)return;const p={ArrowLeft:{x:clamp(state.x-.04)},ArrowRight:{x:clamp(state.x+.04)},ArrowUp:{y:clamp(state.y+.04)},ArrowDown:{y:clamp(state.y-.04)}};if(p[e.key]){e.preventDefault();cancelDemo();apply({...p[e.key],isActive:true,original:false});lastPointer=performance.now();}else if(e.key===' '){e.preventDefault();apply({paused:!state.paused});}});
$('#fullscreen-world').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{$('#command-message').textContent='Fullscreen is unavailable in this browser. You can continue in the current view.';}});
$('#play-demo').addEventListener('click',()=>{if(demo){cancelDemo();apply({isActive:false,held:false});return;}stopCamera();apply({original:false,opening:0,isActive:true,paused:false});demo={start:performance.now(),mode:state.mode};$('#play-demo').textContent='Stop demo ×';});

let stream=null,detector=null,cameraGeneration=0,cameraActive=false,cameraStarting=false,lastVideo=-1,lastInference=0,lastDetected=0,cameraTimeout=null;
const video=$('#cave-video'),preview=$('.video-preview'),landmarkCanvas=$('#landmarks'),landmarkContext=landmarkCanvas.getContext('2d');
function inputUI(source){inputSource=source;for(const b of document.querySelectorAll('[data-input]')){const a=b.dataset.input===source;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}apply({source,isTracking:false,wristTracked:false,isActive:false});}
function stopCamera(message='Use the mouse, or enable the camera for hand and body tracking.'){
 cameraGeneration++;clearTimeout(cameraTimeout);cameraStarting=false;cameraActive=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;detector?.close();detector=null;preview.hidden=true;$('#stop-input').hidden=true;$('#camera-message').textContent=message;$('#tracking-quality').textContent='Mouse input';$('#shoulder-state').textContent='Shoulders —';$('#wrist-state').textContent='Wrists —';landmarkContext?.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);grip.active=false;inputUI('pointer');apply({held:false});
}
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Model loading timed out')),35000);})]);}finally{clearTimeout(timer);}}
async function startCamera(kind){
 cancelDemo();if((cameraActive||cameraStarting)&&inputSource===kind){stopCamera();return;}stopCamera();if(!navigator.mediaDevices?.getUserMedia){$('#camera-message').textContent='Camera access is unavailable in this browser. Use the mouse or avatar demo instead.';return;}
 const generation=++cameraGeneration;cameraStarting=true;inputUI(kind);if(kind==='body')avatar?.clear();$('#stop-input').hidden=false;$('#camera-message').textContent='Waiting for camera permission…';$('#tracking-quality').textContent='Waiting for camera';
 cameraTimeout=setTimeout(()=>{if(generation===cameraGeneration)stopCamera('Camera access timed out. Try again or use the mouse.');},45000);
 try{
  const next=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});if(generation!==cameraGeneration){next.getTracks().forEach(t=>t.stop());return;}stream=next;clearTimeout(cameraTimeout);$('#camera-message').textContent='Loading the on-device tracking model…';
  const v=await bounded(import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'));if(generation!==cameraGeneration)return;
  const files=await bounded(v.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'));if(generation!==cameraGeneration)return;
  const C=kind==='hand'?v.HandLandmarker:v.PoseLandmarker;
  const model=kind==='hand'?'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task':'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  const opts={baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode:'VIDEO',...(kind==='hand'?{numHands:2,minHandDetectionConfidence:.6,minTrackingConfidence:.6}:{numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false})};
  const d=await bounded(C.createFromOptions(files,opts).then(d=>{if(generation!==cameraGeneration){d.close();return null;}return d;}));if(!d)return;if(generation!==cameraGeneration){d.close();return;}detector=d;
  video.srcObject=stream;await video.play();if(generation!==cameraGeneration)return;cameraActive=true;cameraStarting=false;preview.hidden=false;lastVideo=-1;lastDetected=performance.now();
  $('#camera-message').textContent=kind==='hand'?'Place your hand in view and move it to control the scene.':'Step back until your shoulders and hands are visible. The avatar will mirror your pose.';$('#tracking-quality').textContent='Looking for tracking points';
 }catch(e){if(generation===cameraGeneration)stopCamera(e?.name==='NotAllowedError'?'Camera permission was not granted. Mouse control is still available.':'The camera or tracking model could not start. Check your connection and retry, or use the mouse.');}
}
for(const b of document.querySelectorAll('[data-input]'))b.addEventListener('click',()=>{cancelDemo();b.dataset.input==='pointer'?stopCamera():void startCamera(b.dataset.input);});$('#stop-input').addEventListener('click',()=>stopCamera());
const handEdges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]],bodyEdges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]];
function drawLandmarks(points){if(!landmarkContext)return;landmarkCanvas.width=320;landmarkCanvas.height=240;const c=landmarkContext;c.clearRect(0,0,320,240);c.strokeStyle='#91f5ff';c.fillStyle='#ffce90';c.lineWidth=1.5;for(const[a,b]of inputSource==='hand'?handEdges:bodyEdges){if((points[a]?.visibility??1)<.4||(points[b]?.visibility??1)<.4)continue;c.beginPath();c.moveTo(points[a].x*320,points[a].y*240);c.lineTo(points[b].x*320,points[b].y*240);c.stroke();}for(const p of points){if((p.visibility??1)<.4)continue;c.beginPath();c.arc(p.x*320,p.y*240,2,0,Math.PI*2);c.fill();}}
function handPoint(p){const width=Math.max(.025,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y));return{x:1-(p[4].x+p[8].x)/2,y:1-(p[4].y+p[8].y)/2,pinched:Math.hypot(p[4].x-p[8].x,p[4].y-p[8].y)/width<.32};}
function track(now){
 if(!cameraActive||!detector||video.readyState<2||now-lastInference<95||lastVideo===video.currentTime)return;lastInference=now;lastVideo=video.currentTime;
 try{
  const result=detector.detectForVideo(video,now),p=result.landmarks?.[0];let valid=false;
  if(p&&inputSource==='hand'){
   const h=handPoint(p);apply({x:state.x*.6+h.x*.4,y:state.y*.6+h.y*.4,isActive:true,isTracking:true,wristTracked:true});drawLandmarks(p);valid=true;$('#tracking-quality').textContent=h.pinched?'Hand tracked · pinching':'Hand tracked · open hand';$('#wrist-state').textContent='Hand ✓';$('#shoulder-state').textContent='Hand mode';
   if(state.mode==='portal'){if(h.pinched){if(!grip.active)startGrip(h.x);if(grip.active){const second=result.landmarks[1]?handPoint(result.landmarks[1]):null;if(second?.pinched){const distance=Math.abs(second.x-h.x);if(grip.distance===null){grip.distance=distance;grip.twoBase=state.opening;}apply({opening:clamp(grip.twoBase+(distance-grip.distance)*2.3),held:true});$('#grip-status').textContent='Both hands grabbed · pull apart';}else{if(grip.distance!==null){grip.distance=null;grip.base=state.opening;grip.anchorX=h.x;grip.side=Math.sign(h.x-.5)||1;}pullGrip(h.x);}}}else if(grip.active)releaseGrip('Released · opening held. Grab an edge to continue.');}
  }else if(p&&inputSource==='body'){
   const sig=poseSignals(p,{mirrored:true});if(sig.shouldersVisible){valid=true;avatar?.setPose(p,{source:'camera',mirrored:true});const wrist=sig.leftWristVisible||sig.rightWristVisible;apply({x:state.x*.6+sig.wristX*.4,y:state.y*.6+(1-sig.wristY)*.4,bodyX:sig.torsoX,bodyY:1-sig.torsoY,isActive:true,isTracking:true,wristTracked:wrist,...(state.mode==='portal'&&sig.wristsVisible?{opening:sig.armSpread,held:true}:{held:false})});drawLandmarks(p);$('#tracking-quality').textContent=wrist?'Body / wrist tracked':'Body tracked · keep your wrists in view';$('#shoulder-state').textContent='Shoulders ✓';$('#wrist-state').textContent=sig.wristsVisible?'Both wrists ✓':wrist?'One wrist ✓':'Wrists out of view';$('#grip-status').textContent=state.mode==='portal'?(sig.wristsVisible?'Arms apart → open the scene; arms together → close it':'Keep both wrists in view to open and close the scene with your arms.'):state.mode==='memory'?memoryStyles[state.memoryStyle].note:'Move your body and wrists to adjust projection brightness.';}
  }
  if(valid){lastDetected=now;$('#camera-message').textContent=trackingResponse();}else{landmarkContext?.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);$('#tracking-quality').textContent='Tracking lost · following paused';$('#shoulder-state').textContent='Shoulders not tracked';$('#wrist-state').textContent='Wrists not tracked';if(now-lastDetected>650){if(inputSource==='body')avatar?.clear();releaseGrip();apply({isActive:false,isTracking:false,wristTracked:false});$('#camera-message').textContent=inputSource==='body'?'Shoulders not found. Step back to bring your upper body into view.':'Hand not found. Bring your palm back into view.';}}
 }catch{stopCamera('Tracking paused. You can continue with the mouse.');}
}
function command(text){const t=text.trim().toLowerCase();if(!t)return;cancelDemo();let changed=false;if(/安静|平静|quiet|calm|慢/.test(t)){selectIntent('quiet');changed=true;}if(/兴奋|强|能量|energ|bright/.test(t)){selectIntent('energised');changed=true;}if(/光迹|记忆|留下|莲花|水滴|涟漪|鱼|trace|memory|lotus|water|ripple|fish/.test(t)){setMode('memory');if(/莲花|lotus/.test(t))selectMemoryStyle('lotus');else if(/水滴|涟漪|water|ripple/.test(t))selectMemoryStyle('water');else if(/鱼|fish/.test(t))selectMemoryStyle('fish');changed=true;}if(/打开|拉开|画面|门|portal|open/.test(t)){setMode('portal');apply({opening:/关闭|合上|close/.test(t)?0:.8,original:false});changed=true;}if(/清除|clear|erase/.test(t)){world?.clearMemory();changed=true;}$('#command-message').textContent=changed?'Scene updated. Continue moving the mouse, your hand or your body.':'Try “Make the light calmer”, “Open a portal” or “Leave a light trace”.';}
$('#command-form').addEventListener('submit',e=>{e.preventDefault();command($('#scene-command').value);});for(const b of document.querySelectorAll('[data-command]'))b.addEventListener('click',()=>{$('#scene-command').value=b.dataset.command;command(b.dataset.command);});
let recognition=null,recognising=false;
function stopSpeech(){const was=recognising;if(recognition){recognition.onresult=null;recognition.onend=null;recognition.onerror=null;recognition.abort();recognition=null;}recognising=false;$('#voice-command').textContent='Use browser speech ◉';if(was)$('#command-message').textContent='Speech recognition stopped.';}
$('#voice-command').addEventListener('click',()=>{if(recognising){stopSpeech();return;}const C=window.SpeechRecognition||window.webkitSpeechRecognition;if(!C){$('#command-message').textContent='Speech recognition is unavailable in this browser. Type a command instead.';return;}recognition=new C();recognition.lang=$('#voice-language').value;recognition.continuous=false;recognition.interimResults=false;recognising=true;$('#voice-command').textContent='Stop listening ×';$('#command-message').textContent='Listening through your browser’s speech service…';recognition.onresult=e=>{const t=e.results[0][0].transcript;$('#scene-command').value=t;command(t);};recognition.onend=()=>{recognising=false;recognition=null;$('#voice-command').textContent='Use browser speech ◉';};recognition.onerror=()=>{$('#command-message').textContent='Speech recognition did not finish. You can type a command instead.';};try{recognition.start();}catch{stopSpeech();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDemo();stopCamera();stopSpeech();}apply({isActive:false});});
window.addEventListener('pagehide',()=>{cancelDemo();stopCamera();stopSpeech();world?.dispose();avatar?.dispose();world=null;avatar=null;disposed=true;});window.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;if(currentView==='future')ensureWorld();requestAnimationFrame(frame);}});
function frame(now){
 if(disposed)return;
 if(currentView==='future'&&!document.hidden){
  track(now);
  if(demo){const t=clamp((now-demo.start)/6500),wave=Math.sin(t*Math.PI*4);if(demo.mode==='portal'){const amount=clamp((t-.2)/.6);apply({x:.5+amount*.32,y:.5,opening:amount*.85,held:t>.15&&t<.9,isActive:true,original:false});$('#grip-status').textContent=t<.2?'Demo: approach the central seam':t<.9?'Demo: pinch, hold and pull sideways':'Demo: release to keep the opening';}else apply({x:.13+t*.74,y:.48+wave*.2,bodyX:.13+t*.74,bodyY:.15,isActive:true,original:false});if(t>=1){cancelDemo();apply({held:false,isActive:false});}}
  else if(inputSource==='pointer'&&state.isActive&&now-lastPointer>300)apply({isActive:false});
 }
 requestAnimationFrame(frame);
}
setView(location.hash.slice(1)||'project');setMode('ripple');updateUI();requestAnimationFrame(frame);
