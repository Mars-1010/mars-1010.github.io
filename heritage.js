import * as THREE from './vendor/three.module.js';
import {createGeyuan,createDaci,createDougong} from './heritage-models.js';
import {initWindowLab} from './heritage-windows.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
initWindowLab($('#window-lab'));
const canvas=$('#heritage-canvas'),stage=$('#model-stage');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});}catch{stage.classList.add('webgl-fallback');$('#model-loading').textContent='3D is unavailable in this browser. Explore the original project views below.';}
if(renderer) startViewer();
function startViewer(){
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.localClippingEnabled=true;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,180);
 scene.add(new THREE.HemisphereLight(0xf9f6ff,0x7b6b64,2.2));
 const key=new THREE.DirectionalLight(0xffeddb,3);key.position.set(-12,22,14);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-17,right:17,top:20,bottom:-15,near:1,far:70});key.shadow.bias=-.0007;key.shadow.normalBias=.025;scene.add(key);
 const fill=new THREE.DirectionalLight(0xb3b3eb,1.5);fill.position.set(13,10,-9);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-.035;ground.receiveShadow=true;scene.add(ground);
 const models={},state={building:'geyuan',mode:'whole',part:'all',amount:.65,explode:0,yaw:.5,pitch:1.18,distance:28,targetY:3.7,auto:false,pointer:false};
 const orbit={yaw:.5,pitch:1.18,distance:28,targetY:3.7};
 const clip=new THREE.Plane(new THREE.Vector3(0,0,-1),0),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),cursorWorld=new THREE.Vector3(100,100,100),cursorPlane=new THREE.Plane(),scratch=new THREE.Vector3();
 let current=null,frameId=0,last=performance.now(),visible=true,disposed=false,drag=null,touchDistance=null,points=[];
 const lowMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const copy={
  all:['01 / THE WHOLE','A frame beneath the roof.','Drag to turn. Select a layer to see how the building comes together.','拖动旋转，滚轮缩放。点选构件查看。'],
  roof:['02 / ROOF','An extended silhouette.','Curved eaves project beyond the walls. The tiled surfaces, ridge and rafters are separate parts of the roof assembly.','看屋顶轮廓、出檐与椽架的关系。'],
  brackets:['03 / DOUGONG','A layered connection.','Crossing timber arms and bearing blocks project outward beneath the eaves, connecting the roof assembly and column frame.','交错的拱与承托木块逐层出挑，连接屋顶与柱架。'],
  frame:['04 / TIMBER FRAME','Read the clear space.','Columns and horizontal beams define the hall. Lift the roof or move the section plane to look inside.','柱与梁界定殿内空间；剖切后查看内部构架。'],
  walls:['05 / ENCLOSURE','Between the columns.','Lattice panels and wall surfaces enclose the frame. The Geyuan window study below follows the patterns recorded in the survey.','木构之间，是格扇与墙面。向下探索花窗纹样。'],
  base:['06 / PLATFORM','The building meets the ground.','The platform and steps form the base. Daci Pavilion sits on a much taller masonry platform than Wenshu Hall.','对比大慈阁高台基与文殊殿的平台比例。']
 };
 function getModel(name){
  if(models[name])return models[name];
  const m=name==='daci'?createDaci(THREE):name==='dougong'?createDougong(THREE):createGeyuan(THREE);
  m.updateMatrixWorld(true);m.userData.layers ||= [];
  const materialMap=new Map();m.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const cat=o.userData.part||o.userData.category||'frame';o.userData.category=cat;const originals=Array.isArray(o.material)?o.material:[o.material];const mats=originals.map(mat=>{const k=mat.uuid+cat;if(!materialMap.has(k)){const n=mat.clone();n.userData.baseOpacity=n.opacity;n.userData.category=cat;materialMap.set(k,n);}return materialMap.get(k);});o.material=Array.isArray(o.material)?mats:mats[0];});
  m.userData.materials=[...materialMap.values()];
  for(const layer of m.userData.layers){layer.base=layer.group.position.clone();}
  models[name]=m;scene.add(m);return m;
 }
 function updateCopy(part){const detail={all:['01 / DOUGONG','Arms and bearing blocks.','Turn the assembly to follow its crossing members. Separate lifts the layers apart.','旋转查看拱臂交错与承托关系，拆解查看层次。'],roof:['02 / UPPER BEARERS','Above the projecting arms.','Horizontal members sit above the bracket arms in this assembly study.','上层横材与出挑拱臂的承托关系。'],frame:['04 / COLUMN HEAD','Start at the column.','Follow the assembly upward from the column head to the crossing arms.','由柱头向上，查看层叠出挑的构件关系。']};const c=(state.building==='dougong'&&detail[part])||copy[part]||copy.all;$('#part-index').textContent=c[0];$('#part-name').textContent=c[1];$('#part-description').replaceChildren(document.createTextNode(c[2]),document.createElement('br'));const zh=document.createElement('span');zh.lang='zh';zh.textContent=c[3];$('#part-description').append(zh);}
 function selectPart(part){state.part=part;for(const b of $$('[data-part]')){const on=b.dataset.part===part;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);}updateCopy(part);updateMaterials();}
 function updateMaterials(){if(!current)return;for(const m of current.userData.materials){const chosen=state.part==='all'||m.userData.category===state.part;const alpha=state.mode==='points'?0:chosen?1:.1;m.opacity=alpha;m.transparent=alpha<1;m.depthWrite=alpha>=1;m.clippingPlanes=state.mode==='section'&&m.userData.category!=='base'?[clip]:[];m.clipShadows=true;if(m.emissive)m.emissive.set(chosen&&state.part!=='all'?0x28192f:0x000000);m.needsUpdate=true;}for(const p of points){p.visible=state.mode==='points';p.material.uniforms.uAlpha.value=state.part==='all'||p.userData.category===state.part?1:.13;}}
 function showBuilding(name){
  if(current)current.visible=false;points=[];current=getModel(name);current.visible=true;points=current.userData.points||[];for(const layer of current.userData.layers)layer.group.position.copy(layer.base);state.building=name;state.explode=0;state.part='all';
  const isDaci=name==='daci',isDetail=name==='dougong';
  const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3());state.targetY=isDetail?size.y*.5:isDaci?5.8:3.8;state.distance=isDetail?size.length()*2.5:isDaci?34:29;state.yaw=isDetail?.6:.5;state.pitch=isDetail?1.1:1.28;
  orbit.targetY=state.targetY;orbit.distance=state.distance;orbit.yaw=state.yaw;orbit.pitch=state.pitch;
  $('#building-name').textContent=isDetail?'Inside the dougong.':isDaci?'Daci Pavilion.':'Wenshu Hall.';$('#building-cn').textContent=isDetail?'文殊殿 · 斗拱构造关系示意':isDaci?'大慈阁 · 三层楼阁':'阁院寺 · 文殊殿';
  $('#dougong-view').innerHTML=isDetail?'Return to Wenshu Hall <span>↖</span><small>返回文殊殿</small>':'Look closer: dougong <span>↗</span><small>斗拱</small>';
  for(const b of $$('[data-part]')){b.hidden=isDetail&&['walls','base'].includes(b.dataset.part);if(b.dataset.part==='roof')b.innerHTML=isDetail?'Bearers <small>承托</small>':'Roof <small>屋顶</small>';if(b.dataset.part==='frame')b.innerHTML=isDetail?'Column <small>柱头</small>':'Timber <small>梁柱</small>';}
  for(const b of $$('[data-building]')){const on=b.dataset.building===(isDetail?'geyuan':name);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);}
  selectPart('all');setMode('whole');$('#model-loading').hidden=true;
 }
 function setMode(mode){
  state.mode=mode;stage.classList.toggle('particle-view',mode==='points');ground.visible=mode!=='points';for(const b of $$('[data-mode]')){const on=b.dataset.mode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);}
  $('#model-range').hidden=mode==='whole';$('#amount-label').textContent=mode==='section'?'Move the section':mode==='points'?'Particle spread':'Separate the layers';
  if(mode==='points')ensurePoints();
  state.amount=mode==='section'?.5:mode==='points'?.18:.65;$('#model-amount').value=String(state.amount*100);$('#amount-output').textContent=Math.round(state.amount*100)+'%';
  state.distance=state.building==='dougong'?new THREE.Box3().setFromObject(current).getSize(scratch).length()*2.5:state.building==='daci'?34:29;
  if(mode==='explode'){state.targetY=state.building==='daci'?8.5:state.building==='dougong'?3:5.8;state.distance*=1.16;}else state.targetY=state.building==='daci'?5.8:state.building==='dougong'?2:3.8;
  updateMaterials();$('#view-state').textContent=mode==='section'?'SLIDE TO CUT · DRAG TO TURN':mode==='points'?'MOVE OVER THE PARTICLES · DRAG TO TURN':mode==='explode'?'SLIDE TO SEPARATE · DRAG TO TURN':'DRAG TO ROTATE · SCROLL TO ZOOM';
 }
 function ensurePoints(){
  if(current.userData.points){points=current.userData.points;return;}
  const layers=current.userData.layers;
  current.updateMatrixWorld(true);
  for(const layer of layers){
   const tris=[],inverse=new THREE.Matrix4().copy(layer.group.matrixWorld).invert();let area=0;
   layer.group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,idx=g.index,matrix=new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld);const n=idx?idx.count:p.count;for(let i=0;i<n;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(matrix),b=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(matrix),c=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(matrix);const weight=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).length()*.5;if(weight<.00001)continue;area+=weight;tris.push({a,b,c,area,color:(Array.isArray(o.material)?o.material[0]:o.material).color||new THREE.Color('#a38a64')});}});
   if(!tris.length)continue;const count=Math.round(clamp(area*24,600,14000)),pos=[],col=[];let seed=733;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
   for(let i=0;i<count;i++){const sample=random()*area;let lo=0,hi=tris.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(tris[mid].area<sample)lo=mid+1;else hi=mid;}const t=tris[lo],u=Math.sqrt(random()),v=random(),q=t.a.clone().multiplyScalar(1-u).addScaledVector(t.b,u*(1-v)).addScaledVector(t.c,u*v);pos.push(q.x,q.y,q.z);const c=t.color.clone().lerp(new THREE.Color('#e4d1f4'),.42);col.push(c.r,c.g,c.b);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
   const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{uTime:{value:0},uSpread:{value:0},uPointer:{value:cursorWorld},uAlpha:{value:1},uRatio:{value:Math.min(devicePixelRatio,1.8)}},vertexShader:`varying vec3 vColor;uniform float uTime;uniform float uSpread;uniform vec3 uPointer;uniform float uRatio;void main(){vec3 p=position;float n=sin(p.x*5.1+p.y*3.7+p.z*2.3+uTime*.4);p+=vec3(sin(p.z*7.+uTime*.3),n,cos(p.x*4.+uTime*.2))*uSpread*.36;vec4 world=modelMatrix*vec4(p,1.);vec3 delta=world.xyz-uPointer;float d=length(delta);world.xyz+=normalize(delta+vec3(.001))*exp(-d*d*.65)*.32;vec4 mv=viewMatrix*world;gl_Position=projectionMatrix*mv;gl_PointSize=clamp(52.*uRatio/-mv.z,1.5,4.5);vColor=color;}`,fragmentShader:`varying vec3 vColor;uniform float uAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.12,d);gl_FragColor=vec4(vColor*1.75,uAlpha*a*.95);}`});
   const cloud=new THREE.Points(g,mat);cloud.userData.category=layer.id;layer.group.add(cloud);points.push(cloud);
  }
  current.userData.points=points;
 }
 for(const b of $$('[data-building]'))b.addEventListener('click',()=>showBuilding(b.dataset.building));
 for(const b of $$('[data-mode]'))b.addEventListener('click',()=>setMode(b.dataset.mode));
 for(const b of $$('[data-part]'))b.addEventListener('click',()=>selectPart(b.dataset.part));
 $('#model-amount').addEventListener('input',e=>{state.amount=+e.target.value/100;$('#amount-output').textContent=e.target.value+'%';});
 function dougong(){showBuilding(state.building==='dougong'?'geyuan':'dougong');}
 $('#dougong-view').addEventListener('click',dougong);$('#jump-dougong').addEventListener('click',()=>{showBuilding('dougong');$('#explore').scrollIntoView({behavior:lowMotion?'instant':'smooth'});});
 $('#reset-view').addEventListener('click',()=>{const name=state.building;showBuilding(name);setAuto(false);});
 function setAuto(v){state.auto=v;$('#auto-rotate').setAttribute('aria-pressed',v);$('#auto-rotate').textContent=v?'Stop rotation Ⅱ':'Auto rotate ↻';}
 $('#auto-rotate').addEventListener('click',()=>setAuto(!state.auto));
 function point(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);camera.getWorldDirection(scratch);cursorPlane.setFromNormalAndCoplanarPoint(scratch,new THREE.Vector3(0,state.targetY,0));ray.ray.intersectPlane(cursorPlane,cursorWorld);}
 const activePointers=new Map();let multiGesture=false;
 canvas.addEventListener('pointerdown',e=>{if(cameraRunning)return;canvas.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});point(e);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};setAuto(false);if(activePointers.size===2){multiGesture=true;const a=[...activePointers.values()];touchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}});
 canvas.addEventListener('pointermove',e=>{point(e);if(cameraRunning)return;if(activePointers.has(e.pointerId))activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activePointers.size===2){const a=[...activePointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(touchDistance)state.distance=clamp(state.distance*touchDistance/d,7,65);touchDistance=d;return;}if(!drag||!activePointers.size)return;state.yaw-=(e.clientX-drag.x)*.008;state.pitch=clamp(state.pitch+(e.clientY-drag.y)*.005,.3,1.65);drag.x=e.clientX;drag.y=e.clientY;});
 canvas.addEventListener('pointerup',e=>{const isClick=!multiGesture&&drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5&&activePointers.size===1;activePointers.delete(e.pointerId);if(isClick&&state.mode!=='points'){point(e);const hits=ray.intersectObject(current,true).filter(h=>h.object.isMesh&&(state.mode!=='section'||h.object.userData.category==='base'||clip.distanceToPoint(h.point)>=-.0001));if(hits.length)selectPart(hits[0].object.userData.category||'all');}touchDistance=null;if(activePointers.size===1){const q=[...activePointers.values()][0];drag={x:q.x,y:q.y,startX:q.x,startY:q.y};}else{drag=null;multiGesture=false;}});
 canvas.addEventListener('pointercancel',e=>{activePointers.clear();drag=null;touchDistance=null;multiGesture=false;});canvas.addEventListener('pointerleave',()=>cursorWorld.set(100,100,100));
 canvas.addEventListener('wheel',e=>{e.preventDefault();state.distance=clamp(state.distance*Math.exp(e.deltaY*.001),7,65);},{passive:false});
 canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key)){e.preventDefault();setAuto(false);if(e.key==='ArrowLeft')state.yaw-=.12;if(e.key==='ArrowRight')state.yaw+=.12;if(e.key==='ArrowUp')state.pitch=clamp(state.pitch-.1,.3,1.65);if(e.key==='ArrowDown')state.pitch=clamp(state.pitch+.1,.3,1.65);if(e.key==='+'||e.key==='=')state.distance=clamp(state.distance-1,7,65);if(e.key==='-')state.distance=clamp(state.distance+1,7,65);}});
 const resize=new ResizeObserver(()=>{const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();});resize.observe(stage);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible&&(cameraRunning||cameraStarting))stopCamera();},{rootMargin:'100px'});observer.observe(stage);

 let stream=null,detector=null,cameraGeneration=0,cameraRunning=false,cameraStarting=false,lastVideo=-1,lastInference=0,handGrip=null,twoGrip=null,noHandSince=0;
 const video=$('#heritage-video'),preview=$('.hand-preview'),handCanvas=$('#hand-preview'),ctx=handCanvas.getContext('2d');
 const edges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
 function stopCamera(message='Mouse / touch. Camera off.'){
  cameraGeneration++;stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;detector?.close();detector=null;cameraRunning=false;cameraStarting=false;handGrip=null;twoGrip=null;preview.hidden=true;$('#hand-control').setAttribute('aria-pressed','false');$('#hand-control').textContent='Use hand gestures ◉';$('#camera-status').textContent=message;
 }
 async function startCamera(){
  if(cameraRunning||cameraStarting){stopCamera();return;}if(!navigator.mediaDevices?.getUserMedia){$('#camera-status').textContent='Camera unavailable. Use mouse or touch.';return;}
  const gen=++cameraGeneration;cameraStarting=true;$('#hand-control').textContent='Cancel loading ×';$('#camera-status').textContent='Loading hand tracking…';setAuto(false);
  const bounded=p=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('timeout')),22000);p.then(x=>{clearTimeout(timer);resolve(x);},e=>{clearTimeout(timer);reject(e);});});
  try{
   const vision=await bounded(import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'));if(gen!==cameraGeneration)return;
   const files=await bounded(vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'));if(gen!==cameraGeneration)return;
   const pending=vision.HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2});pending.then(d=>{if(gen!==cameraGeneration)d.close();},()=>{});const d=await bounded(pending);if(gen!==cameraGeneration)return;detector=d;
   const media=navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});media.then(s=>{if(gen!==cameraGeneration)s.getTracks().forEach(t=>t.stop());},()=>{});const s=await media;if(gen!==cameraGeneration)return;stream=s;video.srcObject=s;await video.play();if(gen!==cameraGeneration)return;
   cameraRunning=true;cameraStarting=false;lastVideo=-1;preview.hidden=false;$('#hand-control').textContent='Stop camera ×';$('#hand-control').setAttribute('aria-pressed','true');$('#camera-status').textContent='Pinch + move to rotate. Two pinched hands apart separate the layers.';
  }catch{if(gen===cameraGeneration)stopCamera('Hand tracking could not start. Use mouse or touch.');}
 }
 $('#hand-control').addEventListener('click',startCamera);
 function hand(p){const width=Math.max(.03,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y));return{x:1-(p[4].x+p[8].x)*.5,y:(p[4].y+p[8].y)*.5,pinch:Math.hypot(p[4].x-p[8].x,p[4].y-p[8].y)/width<.32};}
 function track(now){
  if(!cameraRunning||!detector||video.readyState<2||video.currentTime===lastVideo||now-lastInference<85)return;lastInference=now;lastVideo=video.currentTime;
  try{const result=detector.detectForVideo(video,now),p=result.landmarks?.[0];ctx.clearRect(0,0,240,180);ctx.save();ctx.translate(240,0);ctx.scale(-1,1);ctx.globalAlpha=.3;ctx.drawImage(video,0,0,240,180);ctx.globalAlpha=1;ctx.strokeStyle='#9f85c8';ctx.lineWidth=1.7;for(const handPoints of result.landmarks||[]){for(const [a,b] of edges){ctx.beginPath();ctx.moveTo(handPoints[a].x*240,handPoints[a].y*180);ctx.lineTo(handPoints[b].x*240,handPoints[b].y*180);ctx.stroke();}ctx.fillStyle='#fff9e9';for(const q of handPoints){ctx.beginPath();ctx.arc(q.x*240,q.y*180,2.4,0,Math.PI*2);ctx.fill();}}ctx.restore();
   if(!p){handGrip=null;twoGrip=null;$('#hand-signal').textContent='Show your hand to the camera';if(!noHandSince)noHandSince=now;if(now-noHandSince>900)$('#camera-status').textContent='Hand not detected. Bring it back into view.';return;}noHandSince=0;const h=hand(p),second=result.landmarks[1]?hand(result.landmarks[1]):null;
   if(h.pinch&&second?.pinch){const distance=Math.abs(h.x-second.x);if(!twoGrip){if(state.mode!=='explode')setMode('explode');twoGrip={distance,amount:state.amount};}state.amount=clamp(twoGrip.amount+(distance-twoGrip.distance)*1.8,0,1);$('#model-amount').value=state.amount*100;$('#amount-output').textContent=Math.round(state.amount*100)+'%';$('#hand-signal').textContent='Two hands → separate layers';handGrip=null;
   }else{twoGrip=null;if(h.pinch){if(!handGrip)handGrip={x:h.x,y:h.y,yaw:state.yaw,pitch:state.pitch};state.yaw=handGrip.yaw+(h.x-handGrip.x)*4;state.pitch=clamp(handGrip.pitch+(h.y-handGrip.y)*2,.3,1.65);$('#hand-signal').textContent='Pinched · move to turn';}else{handGrip=null;$('#hand-signal').textContent='Pinch thumb + index to grab';}}
   $('#camera-status').textContent='Camera on · pinch + move to turn · release to reposition';
  }catch{stopCamera('Hand tracking paused. Use mouse or touch.');}
 }
 function animate(now){
  if(disposed)return;frameId=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
  if(document.hidden||!visible)return;track(now);if(state.auto)state.yaw+=dt*.14;
  const ease=lowMotion?1:1-Math.exp(-dt*8);orbit.yaw+=(state.yaw-orbit.yaw)*ease;orbit.pitch+=(state.pitch-orbit.pitch)*ease;orbit.distance+=(state.distance-orbit.distance)*ease;orbit.targetY+=(state.targetY-orbit.targetY)*ease;
  const narrow=stage.clientWidth<700;const d=orbit.distance*(narrow?2.18:1);camera.position.set(Math.sin(orbit.yaw)*Math.sin(orbit.pitch)*d,Math.cos(orbit.pitch)*d+orbit.targetY,Math.cos(orbit.yaw)*Math.sin(orbit.pitch)*d);camera.lookAt(narrow?0:-.9,orbit.targetY+(narrow?-1.6:0),0);
  state.explode+=((state.mode==='explode'?state.amount:0)-state.explode)*ease;
  for(const layer of current.userData.layers){const v=layer.explode||new THREE.Vector3();layer.group.position.copy(layer.base).addScaledVector(v,state.explode);}
  clip.constant=(state.amount-.5)*(state.building==='daci'?12:17);
  for(const p of points){p.material.uniforms.uTime.value=lowMotion?0:now/1000;p.material.uniforms.uSpread.value=state.amount;}
  renderer.render(scene,camera);
 }
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frameId);stopCamera();resize.disconnect();observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});window.addEventListener('pagehide',dispose);window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopCamera();$('#model-loading').hidden=false;$('#model-loading').textContent='The 3D view paused. Reload to continue.';});
 showBuilding('geyuan');requestAnimationFrame(animate);
}
