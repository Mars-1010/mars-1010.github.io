import { projects } from './content.js';
import { EditorialStudy } from './portfolio-sculpture.js';
import { AssistantPresence } from './assistant-presence.js';
import { initAssistantStudy } from './assistant-study.js';

const $ = s => document.querySelector(s);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
let time = 0, last = performance.now();
const motionButton = $('#motion-toggle');
function updateMotion(){motionButton.textContent=paused?'Resume motion ▷':'Pause motion Ⅱ';motionButton.setAttribute('aria-pressed',String(paused));}
updateMotion();
motionButton.addEventListener('click',()=>{paused=!paused;updateMotion();});
reducedMotion.addEventListener('change',event=>{paused=event.matches;updateMotion();});

const dialog=$('#project-dialog');
let openedFrom=null;
function openProject(p,button){
  openedFrom=button;
  $('#dialog-content').innerHTML=`<span class="eyebrow">SELECTED WORK / ${p.number}</span><h2 id="dialog-title">${p.title}</h2><p class="dialog-lead">${p.lead}</p><div class="dialog-facts"><div><small>WHEN</small><span>${p.date}</span></div><div><small>ROLE</small><span>${p.role}</span></div><div><small>CONTEXT</small><span>${p.context}</span></div></div>${p.sections.map(([h,b])=>`<h3>${h}</h3><p>${b}</p>`).join('')}<p class="project-status">${p.status} / ${p.tags.join(' · ')}</p>`;
  dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden';
}
dialog.addEventListener('close',()=>{document.body.style.overflow='';openedFrom?.focus({preventScroll:true});});
$('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});

// Deterministic point clouds: no project photographs or models are implied.
const TAU=Math.PI*2;
function random(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}
function cloud(scene,count=2200){
  const rnd=random(29), points=[];
  for(let i=0;i<count;i++){
    let x,y,z;
    const u=rnd(),v=rnd(),a=u*TAU;
    if(scene==='knot'){
      const radius=1.15+.3*Math.cos(a*3), tube=v*TAU;
      x=(radius+.32*Math.cos(tube))*Math.cos(a*2);z=(radius+.32*Math.cos(tube))*Math.sin(a*2);y=.6*Math.sin(a*3)+.32*Math.sin(tube);
    }else if(scene==='temple'){
      const tier=Math.floor(rnd()*4),width=1.4-tier*.23;
      if(v<.6){x=(u*2-1)*width;z=(rnd()*2-1)*width*.58;y=.75-tier*.52-Math.pow(Math.abs(x)/width,1.8)*.25+Math.pow(Math.abs(x)/width,7)*.28;}
      else if(v<.87){x=(rnd()>.5?1:-1)*width*.73;z=(rnd()>.5?1:-1)*width*.4;y=.85-tier*.52+rnd()*.43;}
      else{x=(u*2-1)*1.65;z=(rnd()*2-1)*1.1;y=1.25+rnd()*.13;}
      y-=.2;
    }else if(scene==='cave'){
      const depth=u*5;const b=v*TAU;const r=1.1+.12*Math.sin(depth*4+b*5);x=Math.cos(b)*r;y=Math.sin(b)*r;z=depth-2.5;
    }else if(scene==='game'){
      const side=rnd()>.5?1:-1;const t=v*Math.PI;x=side*.78+.36*Math.cos(a)*Math.sin(t);y=.36*Math.cos(t);z=.36*Math.sin(a)*Math.sin(t);
      if(i%4===0){x=(u*2-1)*.65;y=.14*Math.sin(u*10);z=0;}
    }else if(scene==='image'){
      x=(u*2-1)*1.4;y=(v*2-1)*.9;z=.2*Math.sin(x*5)*Math.cos(y*5);if(i%3===0)z+=.35;
    }else{
      const p=Math.acos(2*v-1),r=1.25+.22*Math.sin(a*5+p*4);x=Math.cos(a)*Math.sin(p)*r;y=Math.cos(p)*r;z=Math.sin(a)*Math.sin(p)*r;
    }
    points.push({x,y,z,dx:(rnd()-.5)*3.8,dy:(rnd()-.5)*3.8,dz:(rnd()-.5)*3.8,size:.5+rnd(),tone:rnd()});
  }
  return points;
}
class ParticleWorld{
  constructor(canvas,scene,mode='card'){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.scene=scene;this.mode=mode;this.points=cloud(scene,mode==='hero'?900:mode==='lab'?2700:1200);this.w=1;this.h=1;this.visible=true;this.angle=0;this.pitch=-.15;this.spread=.08;this.pointer={x:0,y:0,active:false};this.resize();
    new ResizeObserver(()=>this.resize()).observe(canvas);
    new IntersectionObserver(es=>{this.visible=es[0].isIntersecting;},{rootMargin:'80px'}).observe(canvas);
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,1.8);this.canvas.width=Math.max(1,Math.round(this.w*d));this.canvas.height=Math.max(1,Math.round(this.h*d));this.ctx?.setTransform(d,0,0,d,0,0);}
  setScene(s){this.scene=s;this.points=cloud(s,2700);}
  draw(t){
    if(!this.visible||!this.ctx||this.w<2)return;
    const c=this.ctx,w=this.w,h=this.h,hero=this.mode==='hero',lab=this.mode==='lab';
    c.clearRect(0,0,w,h);c.fillStyle=hero?'#101117':this.scene==='image'?'#d8dce3':'#101219';c.fillRect(0,0,w,h);
    const cx=hero?(w<650?w*.55:w*.67):w*.5,cy=hero?(w<650?h*.58:h*.51):h*.48;
    const scale=Math.min(w*(hero?.27:.31),h*(hero?.45:.33));
    const glow=c.createRadialGradient(cx,cy,0,cx,cy,scale*2.25);glow.addColorStop(0,this.scene==='image'?'#b4bcc6':hero?'#161845':'#171c35');glow.addColorStop(1,this.scene==='image'?'#d8dce3':'#101219');c.fillStyle=glow;c.fillRect(0,0,w,h);
    const speed=hero?.13:lab?.06:.09,angle=this.angle+t*speed,ca=Math.cos(angle),sa=Math.sin(angle),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),arr=[];
    const spread=this.spread;
    for(const p of this.points){
      let x=p.x+p.dx*spread,y=p.y+p.dy*spread,z=p.z+p.dz*spread;
      if(hero){const wave=Math.sin(t*.5+p.y*2+p.x)*.04;x+=wave;y+=Math.cos(p.z*3+t*.4)*.03;}
      const x1=x*ca-z*sa,z1=x*sa+z*ca,y1=y*cp-z1*sp,z2=y*sp+z1*cp;
      const perspective=4/(4+z2);let sx=cx+x1*scale*perspective,sy=cy+y1*scale*perspective;
      if(hero&&this.pointer.active){const dx=sx-this.pointer.x,dy=sy-this.pointer.y,dist=Math.hypot(dx,dy),f=Math.max(0,1-dist/150);sx+=dx*f*.4;sy+=dy*f*.4;}
      arr.push({sx,sy,z:z2,alpha:Math.max(.12,Math.min(.95,(2.7-z2)/4)),size:p.size*perspective*(hero?1.18:lab?1.05:.95),tone:p.tone});
    }
    arr.sort((a,b)=>b.z-a.z);
    const warm=this.scene==='temple';
    for(const p of arr){c.globalAlpha=p.alpha*(hero?.18:1);c.fillStyle=this.scene==='image'?(p.tone>.8?'#3d3ed7':'#666d81'):warm?(p.tone>.72?'#ffe5b8':'#c8a77e'):p.tone>.9?'#eff2ff':p.tone>.55?'#a4a6ff':'#4148ff';c.beginPath();c.arc(p.sx,p.sy,Math.max(.3,p.size),0,TAU);c.fill();}
    c.globalAlpha=1;
    
    // Sparse coordinate traces preserve a feeling of a navigable volume.
    if(this.scene==='cave'){
      c.strokeStyle='#7785ca30';c.lineWidth=.6;
      for(let i=0;i<14;i++){const z=(i/14+((t*.03)%1))%1;const a=(.12+z*z)*Math.min(w*.55,h*.6);c.beginPath();c.ellipse(w/2,h/2,a,a*.66,-.05,0,TAU);c.stroke();}
    }
  }
}
const worlds=[];
const hero=new AssistantPresence($('#hero-canvas'));worlds.push(hero);
const assistantStudy=initAssistantStudy(hero,{paused:()=>paused,reducedMotion:()=>reducedMotion.matches});
window.addEventListener('pagehide',e=>{if(!e.persisted){assistantStudy.dispose();hero.dispose();}});

const projectYears={immersive:'2023',heritage:'2021',game:'2025',capstone:'2026',boundaries:'2026'};
const coverCaptions={immersive:'DAMO CAVE / NANJING',heritage:'GEYUAN TEMPLE / ORIGINAL RECONSTRUCTION',game:'GALAGA / PROTOTYPE FOOTAGE',capstone:'TEAM PROTOTYPE / IMAGE DETECTION',boundaries:'BOUNDARIES / TRY THE PROTOTYPE'};
for(const p of projects){
  const button=document.createElement(p.href?'a':'button');button.className='project-card reveal';button.dataset.project=p.id;button.setAttribute('aria-label',`Explore ${p.title} — ${p.subtitle}`);if(p.href)button.href=p.href;
  button.innerHTML=`<div class="project-art">${p.image?`<img class="project-reference" src="${p.image}" alt="${p.imageAlt||'Blue projected light across the Damo Cave interior, credited to Fengyuzhu'}" loading="lazy">`:'<canvas aria-hidden="true"></canvas>'}<span class="project-num">${p.number} /</span><span class="art-caption">${coverCaptions[p.id]}</span><span class="project-arrow" aria-hidden="true">↗</span></div><div class="project-meta"><div><h3>${p.title}</h3><p>${p.subtitle}</p></div><span class="project-year">${projectYears[p.id]}</span></div>`;
  $('#project-list').append(button);if(!p.image)worlds.push(new EditorialStudy(button.querySelector('canvas'),p.scene));if(!p.href)button.addEventListener('click',()=>openProject(p,button));
}
const lab=new ParticleWorld($('#lab-canvas'),'temple','lab');lab.spread=.18;worlds.push(lab);
const names={temple:['01 / HERITAGE FORM','Procedural architectural form study'],cave:['02 / IMMERSIVE SPACE','Procedural immersive-space study'],field:['03 / PARTICLE FIELD','Exploring rotation, dispersion and continuous control']};
document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{const s=button.dataset.scene;lab.setScene(s);document.querySelectorAll('[data-scene]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('#scene-label').textContent=names[s][0];$('#scene-caption').textContent=names[s][1];}));
function setSpread(n){const value=Math.max(0,Math.min(1,n));lab.spread=value;$('#dispersion').value=String(Math.round(value*100));$('#dispersion-value').value=`${Math.round(value*100)}%`;}
$('#dispersion').addEventListener('input',e=>setSpread(Number(e.target.value)/100));
$('#reset-lab').addEventListener('click',()=>{lab.angle=0;lab.pitch=-.15;setSpread(.18);});
let dragging=false,point={x:0,y:0};
const labCanvas=$('#lab-canvas');
labCanvas.addEventListener('pointerdown',e=>{dragging=true;point={x:e.clientX,y:e.clientY};labCanvas.setPointerCapture(e.pointerId);});
labCanvas.addEventListener('pointermove',e=>{if(!dragging)return;lab.angle+=(e.clientX-point.x)*.008;lab.pitch=Math.max(-1,Math.min(1,lab.pitch+(e.clientY-point.y)*.005));point={x:e.clientX,y:e.clientY};});
function endDrag(){dragging=false;}
labCanvas.addEventListener('pointerup',endDrag);labCanvas.addEventListener('pointercancel',endDrag);
$('.lab-stage').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();lab.angle+=e.key==='ArrowRight'?.15:-.15;}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setSpread(lab.spread+(e.key==='ArrowUp'?.05:-.05));}});

// Camera starts only from a visitor action. Frames never leave this page.
let stream=null,detector=null,cameraStarting=false,cameraActive=false,cameraGeneration=0,lastVideo=-1,lastInference=0;
const cameraButton=$('#camera-toggle'),status=$('#camera-status'),video=$('#camera-preview');
function stopCamera(message='Camera off · pointer and keyboard ready'){
  cameraGeneration++;cameraActive=false;cameraStarting=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;video.hidden=true;detector?.close();detector=null;cameraButton.innerHTML='Start camera <span>↗</span>';cameraButton.disabled=false;status.textContent=message;$('#input-label').textContent='POINTER INPUT';
}
async function timed(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Loading timeout')),30000);})]);}finally{clearTimeout(timer);}}
async function startCamera(){
  if(cameraStarting||cameraActive){stopCamera();return;}
  if(!navigator.mediaDevices?.getUserMedia){status.textContent='Camera needs HTTPS or localhost and a supported browser. Pointer controls are ready.';return;}
  cameraStarting=true;const generation=++cameraGeneration;cameraButton.innerHTML='Cancel camera <span>×</span>';status.textContent='Requesting camera access…';
  try{
    const next=await navigator.mediaDevices.getUserMedia({video:{width:480,height:360,facingMode:'user'},audio:false});
    if(generation!==cameraGeneration){next.getTracks().forEach(t=>t.stop());return;}
    stream=next;status.textContent='Loading hand tracking model…';
    const {HandLandmarker,FilesetResolver}=await timed(import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'));
    if(generation!==cameraGeneration)return;
    const vision=await timed(FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'));
    if(generation!==cameraGeneration)return;
    const nextDetector=await timed(HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minTrackingConfidence:.6}).then(created=>{if(generation!==cameraGeneration){created.close();return null;}return created;}));
    if(!nextDetector)return;
    if(generation!==cameraGeneration){nextDetector.close();return;}detector=nextDetector;
    video.srcObject=stream;await video.play();
    if(generation!==cameraGeneration)return;
    video.hidden=false;cameraActive=true;lastVideo=-1;
    cameraButton.innerHTML='Stop camera <span>×</span>';status.textContent='Ready · hold one hand in view';$('#input-label').textContent='HAND INPUT';
  }catch(error){if(generation===cameraGeneration){const reason=error?.name==='NotAllowedError'?'Camera permission was not granted. You can still use the pointer.':error?.name==='NotFoundError'?'No camera found. You can still use the pointer.':'Hand tracking could not load. Check your connection or use the pointer.';stopCamera(reason);}}
  finally{if(generation===cameraGeneration){cameraStarting=false;cameraButton.disabled=false;}}
}
cameraButton.addEventListener('click',startCamera);
function trackHand(now){
  if(!cameraActive||!detector||video.readyState<2||now-lastInference<80||lastVideo===video.currentTime)return;
  lastVideo=video.currentTime;lastInference=now;
  try{
    const result=detector.detectForVideo(video,now),hand=result.landmarks[0];
    if(hand){const palm=hand[9];lab.angle+=( (1-palm.x-.5)*4-lab.angle)*.12;lab.pitch+=((palm.y-.5)*1.8-lab.pitch)*.12;const pinch=Math.hypot(hand[4].x-hand[8].x,hand[4].y-hand[8].y),width=Math.hypot(hand[5].x-hand[17].x,hand[5].y-hand[17].y);setSpread(lab.spread*.75+Math.max(0,Math.min(.85,(pinch/Math.max(.02,width)-.12)*.55))*.25);status.textContent='Hand detected · move to rotate, pinch to gather';}
    else{status.textContent='Looking for one hand · keep your palm in view';}
  }catch{stopCamera('Tracking stopped. Pointer controls are ready.');}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(cameraActive||cameraStarting))stopCamera('Camera stopped while the page was hidden. Start again when ready.');});
window.addEventListener('pagehide',()=>stopCamera());

const observer=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.remove('waiting');observer.unobserve(e.target);}},{threshold:.07});
if(!reducedMotion.matches)document.querySelectorAll('.reveal').forEach(e=>{e.classList.add('waiting');observer.observe(e);});
let lastDraw=0;
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)time+=dt;if(!document.hidden&&now-lastDraw>32){lastDraw=now;assistantStudy.update(time);for(const world of worlds)world.draw(time);trackHand(now);}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
