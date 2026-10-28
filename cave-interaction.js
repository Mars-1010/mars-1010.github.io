import { PhotoCaveWorld } from './cave-photo-world.js';
import { BodyAvatar, poseSignals } from './cave-avatar.js';

const $=s=>document.querySelector(s),clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const state={mode:'ripple',memoryStyle:'lotus',x:.5,y:.5,bodyX:.5,bodyY:.15,energy:.6,calm:.45,opening:0,held:false,original:false,photo:'blue',source:'pointer',isActive:false,isTracking:false,wristTracked:false,paused:motionPreference.matches};
let world=null,avatar=null,currentView='project',inputSource='pointer',disposed=false,demo=null,lastPointer=0;
let grip={active:false,anchorX:.5,base:0,side:0,distance:null};
const copies={
 ripple:{counter:'01 / FOLLOW THE LIGHT',title:'让光随你移动'},
 portal:{counter:'02 / GRAB · PULL · REVEAL',title:'捏住石壁，再把它拉开'},
 memory:{counter:'03 / LEAVE A LIGHT MEMORY',title:'你的动作，在这里留下来'}
};
function ensureWorld(){
 if(!world){const w=world=new PhotoCaveWorld($('#cave-world'));w.ready.catch(()=>{if(world===w)$('#camera-message').textContent='项目图片暂未加载，请刷新或检查网络；可切到 Project 查看原图。';});avatar=new BodyAvatar($('#body-avatar'));}
 return world;
}
const memoryStyles={
 lotus:{title:'步步莲花',note:'移动，让莲花沿着路径绽开。'},
 water:{title:'水滴涟漪',note:'移动，在地面漾开一圈圈水波。'},
 fish:{title:'游鱼',note:'缓缓移动，引鱼群靠近；快速划过，鱼会散开。'}
};
function sourceExplanation(){
 const body=inputSource==='body',hand=inputSource==='hand',portal=state.mode==='portal',memory=state.mode==='memory';
 const effect=memoryStyles[state.memoryStyle];
 $('#control-title').textContent=body?'身体控制':hand?'手势控制':'鼠标控制';
 $('#control-instructions').textContent=body?(portal?'后退让肩和双手入镜。张开双臂拉开画面，合拢双臂关闭。':memory?'左右移动身体，小人会同步姿态，地面特效会随位置变化。':'左右移动身体，改变石壁投影的明暗；手腕控制更小的区域。'):hand?(portal?'食指和拇指捏住中央光缝，保持捏合并横向拉动。松开后保留开口。':memory?'把手放入摄像头画面，移动手来控制地面上的路径。':'移动手，改变对应石壁区域的投影明暗。'):(portal?'按住中央光缝，向左或向右拖动。松开后保留开口。':memory?'在画面或小人区域移动鼠标，控制地面上的路径。':'在画面或小人区域移动鼠标，调整对应石壁区域的投影明暗。');
 $('#world-instruction').textContent=state.original?'原画面 · 点击 Interactive 开始互动。':portal?(body?'张开 / 合拢双臂。':hand?'捏住光缝，保持捏合并向外拉。':'按住中央光缝，向外拉开。'):memory?effect.note:(body?'移动身体，让不同区域的投影亮起。':hand?'移动手，调整石壁投影的明暗。':'移动鼠标，调整石壁投影的明暗。');
 $('#actor-source').textContent=demo?'DEMO':body?(state.isTracking?'BODY / LIVE':'BODY / WAITING'):hand?(state.isTracking?'HAND / LIVE':'HAND / WAITING'):'MOUSE';
 $('#actor-status').textContent=body?(state.isTracking?'身体已识别 · 小人同步姿态':'请让肩膀进入画面'):hand?(state.isTracking?'手部已识别':'请把手放入画面'):demo?'自动演示 · 摄像头关闭':'鼠标控制 · 摄像头关闭';
 $('#hand-guide').hidden=!hand;$('#body-avatar').hidden=hand;$('#hand-action-label').textContent=portal?'PINCH · HOLD · PULL':'MOVE YOUR HAND';
 $('#input-source').textContent=demo?'Demo · camera off':body?(state.isTracking?'Body tracked':'Body · waiting'):hand?(state.isTracking?'Hand tracked':'Hand · waiting'):'Mouse · camera off';
 $('#pointer-label').textContent=body?(state.wristTracked?'WRIST / 手腕':'TORSO / 身体'):hand?'HAND / 手':'MOUSE / 鼠标';
 $('#memory-effects').hidden=!memory;
 $('#memory-effect-note').textContent=effect.note;
 for(const b of document.querySelectorAll('[data-memory-style]')){const active=b.dataset.memoryStyle===state.memoryStyle;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 $('#cave-stage').dataset.mode=state.mode;$('#grip-status').hidden=!portal;
 if(memory)$('#world-title').textContent=effect.title;
}
function trackingResponse(){
 if(state.mode==='portal')return inputSource==='body'?'身体已识别：张开或合拢双臂控制画面。':'手已识别：捏住光缝后横向拉动。';
 if(state.mode==='memory')return inputSource==='body'?'身体已识别：移动身体，控制地面特效。':'手已识别：移动手，控制地面特效。';
 return inputSource==='body'?(state.wristTracked?'身体和手腕已识别：移动，调整石壁投影的明暗。':'身体已识别，手腕未入镜：当前由身体控制投影明暗。'):'手已识别：移动，调整石壁投影的明暗。';
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
 $('#render-kind').textContent=state.original?'ORIGINAL / 原画面':'INTERACTIVE / 互动';
 $('#state-inspector').textContent=JSON.stringify({input:inputSource,view:state.original?'original photograph':'proposed interactive enhancement',mode:state.mode,controlPoint:{x:+state.x.toFixed(2),y:+state.y.toFixed(2)},grabbed:state.held,opening:+state.opening.toFixed(2),energy:+state.energy.toFixed(2),bodyPosition:{x:state.bodyX,y:state.bodyY},memoryStyle:state.memoryStyle},null,2);
 if(inputSource==='pointer')avatar?.setState({demo:true,x:state.x,y:1-state.y,leftArm:state.mode==='portal'?state.opening*.8:.12,rightArm:undefined});
 sourceExplanation();
}
function apply(partial){Object.assign(state,partial);world?.setState({...state,paused:state.paused||currentView!=='future'||document.hidden});updateUI();}
function cancelDemo(){demo=null;$('#play-demo').textContent='播放演示 ▷';}
function releaseGrip(message){grip.active=false;apply({held:false});if(message)$('#grip-status').textContent=message;}
function setMode(mode){
 if(!copies[mode])return;cancelDemo();releaseGrip();apply({mode,photo:mode==='memory'?'projection':'blue',original:false,isActive:false,...(mode==='portal'?{opening:0}:{})});
 for(const b of document.querySelectorAll('[data-world-mode]')){const a=b.dataset.worldMode===mode;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}
 const c=copies[mode];$('#world-counter').textContent=c.counter;$('#world-title').textContent=mode==='memory'?memoryStyles[state.memoryStyle].title:c.title;
 $('#grip-status').textContent=mode==='portal'?'先抓住中央光缝，再向外拉开。':mode==='memory'?memoryStyles[state.memoryStyle].note:'移动，观察石壁投影的明暗变化。';
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
$('#clear-memory').addEventListener('click',()=>{world?.clearMemory();$('#command-message').textContent='地面特效已重置。';});
$('#reset-world').addEventListener('click',()=>{cancelDemo();stopCamera();stopSpeech();world?.clearMemory();setMode('ripple');selectIntent('curious');apply({x:.5,y:.5,bodyX:.5,bodyY:.15,opening:0,memoryStyle:'lotus',original:false,isActive:false});$('#command-message').textContent='已重置；可重新选择一种操作。';});

const stage=$('#cave-stage'),canvas=$('#cave-world');
function startGrip(x){
 const edge=.5+(x<.5?-1:1)*state.opening*.34;
 if(Math.min(Math.abs(x-.5),Math.abs(x-edge))>.18){$('#grip-status').textContent='先靠近中央光缝或发光边缘，再抓住它。';return false;}
 grip={active:true,anchorX:x,base:state.opening,side:Math.abs(x-.5)>.04?Math.sign(x-.5):0,distance:null};apply({held:true});$('#grip-status').textContent='已抓住 · 保持捏合 / 按住鼠标，向两侧拉。';return true;
}
function pullGrip(x){if(!grip.active)return;const delta=x-grip.anchorX;if(!grip.side&&Math.abs(delta)>.008)grip.side=Math.sign(delta);apply({opening:clamp(grip.base+delta*(grip.side||1)*2.6),held:true});$('#grip-status').textContent=`正在拉开 ${Math.round(state.opening*100)}% · 松开后保留开口`;}
function pointerPosition(event,element){const r=element.getBoundingClientRect();return{x:clamp((event.clientX-r.left)/r.width),y:clamp(1-(event.clientY-r.top)/r.height)};}
function manualMove(event,element){if(inputSource!=='pointer')return;cancelDemo();const p=pointerPosition(event,element);lastPointer=performance.now();apply({...p,bodyX:p.x,bodyY:.12+(1-p.y)*.3,isActive:true,isTracking:false,source:'pointer'});if(state.mode==='portal'&&grip.active)pullGrip(p.x);}
for(const element of [canvas,$('#body-avatar')]){
 element.addEventListener('pointerdown',e=>{if(inputSource!=='pointer')return;cancelDemo();element.setPointerCapture(e.pointerId);const p=pointerPosition(e,element);if(state.mode==='portal')startGrip(p.x);manualMove(e,element);});
 element.addEventListener('pointermove',e=>manualMove(e,element));
 element.addEventListener('pointerup',()=>{if(grip.active)releaseGrip('已松开 · 可以再次抓住边缘继续拉动，或重置。');});
 element.addEventListener('pointercancel',()=>releaseGrip('动作已结束。'));
}
stage.addEventListener('keydown',e=>{if(e.target!==stage)return;const p={ArrowLeft:{x:clamp(state.x-.04)},ArrowRight:{x:clamp(state.x+.04)},ArrowUp:{y:clamp(state.y+.04)},ArrowDown:{y:clamp(state.y-.04)}};if(p[e.key]){e.preventDefault();cancelDemo();apply({...p[e.key],isActive:true,original:false});lastPointer=performance.now();}else if(e.key===' '){e.preventDefault();apply({paused:!state.paused});}});
$('#fullscreen-world').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{$('#command-message').textContent='此浏览器未能进入全屏；当前画面仍可操作。';}});
$('#play-demo').addEventListener('click',()=>{if(demo){cancelDemo();apply({isActive:false,held:false});return;}stopCamera();apply({original:false,opening:0,isActive:true,paused:false});demo={start:performance.now(),mode:state.mode};$('#play-demo').textContent='停止动作演示 ×';});

let stream=null,detector=null,cameraGeneration=0,cameraActive=false,cameraStarting=false,lastVideo=-1,lastInference=0,lastDetected=0,cameraTimeout=null;
const video=$('#cave-video'),preview=$('.video-preview'),landmarkCanvas=$('#landmarks'),landmarkContext=landmarkCanvas.getContext('2d');
function inputUI(source){inputSource=source;for(const b of document.querySelectorAll('[data-input]')){const a=b.dataset.input===source;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));}apply({source,isTracking:false,wristTracked:false,isActive:false});}
function stopCamera(message='移动鼠标，或开启摄像头使用手势与身体。'){
 cameraGeneration++;clearTimeout(cameraTimeout);cameraStarting=false;cameraActive=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;detector?.close();detector=null;preview.hidden=true;$('#stop-input').hidden=true;$('#camera-message').textContent=message;$('#tracking-quality').textContent='鼠标模拟输入';$('#shoulder-state').textContent='肩部 —';$('#wrist-state').textContent='手腕 —';landmarkContext?.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);grip.active=false;inputUI('pointer');apply({held:false});
}
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Model loading timed out')),35000);})]);}finally{clearTimeout(timer);}}
async function startCamera(kind){
 cancelDemo();if((cameraActive||cameraStarting)&&inputSource===kind){stopCamera();return;}stopCamera();if(!navigator.mediaDevices?.getUserMedia){$('#camera-message').textContent='此浏览器无法启用摄像头。可以先用鼠标和小人演示。';return;}
 const generation=++cameraGeneration;cameraStarting=true;inputUI(kind);if(kind==='body')avatar?.clear();$('#stop-input').hidden=false;$('#camera-message').textContent='等待摄像头权限…';$('#tracking-quality').textContent='等待摄像头';
 cameraTimeout=setTimeout(()=>{if(generation===cameraGeneration)stopCamera('摄像头请求超时，可以重试或先用鼠标。');},45000);
 try{
  const next=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});if(generation!==cameraGeneration){next.getTracks().forEach(t=>t.stop());return;}stream=next;clearTimeout(cameraTimeout);$('#camera-message').textContent='正在加载本地识别模型…';
  const v=await bounded(import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'));if(generation!==cameraGeneration)return;
  const files=await bounded(v.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'));if(generation!==cameraGeneration)return;
  const C=kind==='hand'?v.HandLandmarker:v.PoseLandmarker;
  const model=kind==='hand'?'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task':'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  const opts={baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode:'VIDEO',...(kind==='hand'?{numHands:2,minHandDetectionConfidence:.6,minTrackingConfidence:.6}:{numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false})};
  const d=await bounded(C.createFromOptions(files,opts).then(d=>{if(generation!==cameraGeneration){d.close();return null;}return d;}));if(!d)return;if(generation!==cameraGeneration){d.close();return;}detector=d;
  video.srcObject=stream;await video.play();if(generation!==cameraGeneration)return;cameraActive=true;cameraStarting=false;preview.hidden=false;lastVideo=-1;lastDetected=performance.now();
  $('#camera-message').textContent=kind==='hand'?'把手放入画面，移动手控制互动。':'后退一些，让肩膀和双手入镜。小人会同步你的身体。';$('#tracking-quality').textContent='正在寻找识别点';
 }catch(e){if(generation===cameraGeneration)stopCamera(e?.name==='NotAllowedError'?'未获得摄像头权限。鼠标演示仍可操作。':'摄像头或模型未能启动。可检查网络后重试，或先用鼠标。');}
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
   const h=handPoint(p);apply({x:state.x*.6+h.x*.4,y:state.y*.6+h.y*.4,isActive:true,isTracking:true,wristTracked:true});drawLandmarks(p);valid=true;$('#tracking-quality').textContent=h.pinched?'已识别手 · 捏合中':'已识别手 · 手指张开';$('#wrist-state').textContent='手部 ✓';$('#shoulder-state').textContent='手势模式';
   if(state.mode==='portal'){if(h.pinched){if(!grip.active)startGrip(h.x);if(grip.active){const second=result.landmarks[1]?handPoint(result.landmarks[1]):null;if(second?.pinched){const distance=Math.abs(second.x-h.x);if(grip.distance===null){grip.distance=distance;grip.twoBase=state.opening;}apply({opening:clamp(grip.twoBase+(distance-grip.distance)*2.3),held:true});$('#grip-status').textContent='双手已抓住 · 向两侧拉开';}else{if(grip.distance!==null){grip.distance=null;grip.base=state.opening;grip.anchorX=h.x;grip.side=Math.sign(h.x-.5)||1;}pullGrip(h.x);}}}else if(grip.active)releaseGrip('已松开 · 开口保留，可再次抓住边缘。');}
  }else if(p&&inputSource==='body'){
   const sig=poseSignals(p,{mirrored:true});if(sig.shouldersVisible){valid=true;avatar?.setPose(p,{source:'camera',mirrored:true});const wrist=sig.leftWristVisible||sig.rightWristVisible;apply({x:state.x*.6+sig.wristX*.4,y:state.y*.6+(1-sig.wristY)*.4,bodyX:sig.torsoX,bodyY:1-sig.torsoY,isActive:true,isTracking:true,wristTracked:wrist,...(state.mode==='portal'&&sig.wristsVisible?{opening:sig.armSpread,held:true}:{held:false})});drawLandmarks(p);$('#tracking-quality').textContent=wrist?'身体 / 手腕已识别':'身体已识别 · 请让手腕入镜';$('#shoulder-state').textContent='肩部 ✓';$('#wrist-state').textContent=sig.wristsVisible?'双手腕 ✓':wrist?'单手腕 ✓':'手腕未入镜';$('#grip-status').textContent=state.mode==='portal'?(sig.wristsVisible?'张开双臂 → 拉开画面；合拢双臂 → 关闭':'让双手腕入镜，才能用双臂开合画面。'):state.mode==='memory'?memoryStyles[state.memoryStyle].note:'移动身体与手腕，调整石壁投影的明暗。';}
  }
  if(valid){lastDetected=now;$('#camera-message').textContent=trackingResponse();}else{landmarkContext?.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);$('#tracking-quality').textContent='未检测到 · 暂停跟随';$('#shoulder-state').textContent='肩部未识别';$('#wrist-state').textContent='手腕未识别';if(now-lastDetected>650){if(inputSource==='body')avatar?.clear();releaseGrip();apply({isActive:false,isTracking:false,wristTracked:false});$('#camera-message').textContent=inputSource==='body'?'没有检测到肩膀：后退一些，让上半身进入画面。':'没有检测到手：把手掌放回画面。';}}
 }catch{stopCamera('识别暂停。可以先使用鼠标演示。');}
}
function command(text){const t=text.trim().toLowerCase();if(!t)return;cancelDemo();let changed=false;if(/安静|平静|quiet|calm|慢/.test(t)){selectIntent('quiet');changed=true;}if(/兴奋|强|能量|energ|bright/.test(t)){selectIntent('energised');changed=true;}if(/光迹|记忆|留下|莲花|水滴|涟漪|鱼|trace|memory|lotus|water|ripple|fish/.test(t)){setMode('memory');if(/莲花|lotus/.test(t))selectMemoryStyle('lotus');else if(/水滴|涟漪|water|ripple/.test(t))selectMemoryStyle('water');else if(/鱼|fish/.test(t))selectMemoryStyle('fish');changed=true;}if(/打开|拉开|画面|门|portal|open/.test(t)){setMode('portal');apply({opening:/关闭|合上|close/.test(t)?0:.8,original:false});changed=true;}if(/清除|clear|erase/.test(t)){world?.clearMemory();changed=true;}$('#command-message').textContent=changed?'场景已切换，可以继续移动鼠标、手或身体。':'可试“让光安静一点”“打开另一层画面”“留下发光的记忆”。';}
$('#command-form').addEventListener('submit',e=>{e.preventDefault();command($('#scene-command').value);});for(const b of document.querySelectorAll('[data-command]'))b.addEventListener('click',()=>{$('#scene-command').value=b.dataset.command;command(b.dataset.command);});
let recognition=null,recognising=false;
function stopSpeech(){const was=recognising;if(recognition){recognition.onresult=null;recognition.onend=null;recognition.onerror=null;recognition.abort();recognition=null;}recognising=false;$('#voice-command').textContent='Use browser speech ◉';if(was)$('#command-message').textContent='语音识别已停止。';}
$('#voice-command').addEventListener('click',()=>{if(recognising){stopSpeech();return;}const C=window.SpeechRecognition||window.webkitSpeechRecognition;if(!C){$('#command-message').textContent='此浏览器不支持语音识别，请键盘输入。';return;}recognition=new C();recognition.lang=$('#voice-language').value;recognition.continuous=false;recognition.interimResults=false;recognising=true;$('#voice-command').textContent='Stop listening ×';$('#command-message').textContent='浏览器语音服务正在监听…';recognition.onresult=e=>{const t=e.results[0][0].transcript;$('#scene-command').value=t;command(t);};recognition.onend=()=>{recognising=false;recognition=null;$('#voice-command').textContent='Use browser speech ◉';};recognition.onerror=()=>{$('#command-message').textContent='语音识别未完成，可以键盘输入。';};try{recognition.start();}catch{stopSpeech();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDemo();stopCamera();stopSpeech();}apply({isActive:false});});
window.addEventListener('pagehide',()=>{cancelDemo();stopCamera();stopSpeech();world?.dispose();avatar?.dispose();world=null;avatar=null;disposed=true;});window.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;if(currentView==='future')ensureWorld();requestAnimationFrame(frame);}});
function frame(now){
 if(disposed)return;
 if(currentView==='future'&&!document.hidden){
  track(now);
  if(demo){const t=clamp((now-demo.start)/6500),wave=Math.sin(t*Math.PI*4);if(demo.mode==='portal'){const amount=clamp((t-.2)/.6);apply({x:.5+amount*.32,y:.5,opening:amount*.85,held:t>.15&&t<.9,isActive:true,original:false});$('#grip-status').textContent=t<.2?'动作演示：靠近中央光缝':t<.9?'动作演示：捏住并横向拉开':'动作演示：松开，保留开口';}else apply({x:.13+t*.74,y:.48+wave*.2,bodyX:.13+t*.74,bodyY:.15,isActive:true,original:false});if(t>=1){cancelDemo();apply({held:false,isActive:false});}}
  else if(inputSource==='pointer'&&state.isActive&&now-lastPointer>300)apply({isActive:false});
 }
 requestAnimationFrame(frame);
}
setView(location.hash.slice(1)||'project');setMode('ripple');updateUI();requestAnimationFrame(frame);
