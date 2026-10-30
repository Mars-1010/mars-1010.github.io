// Original real-time soft sculpture. No third-party artwork or 3D assets.
const vertex = `attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.0,1.0);}`;
const fragment = `
precision highp float;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;
mat2 turn(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float form(vec3 p){
  p.y-=0.08+sin(uTime*.28)*.05;
  p.xz=turn(.45+uTime*.075+uMouse.x*.48)*p.xz;
  p.yz=turn(-.16+uMouse.y*.32)*p.yz;
  p.xy=turn(-.43+sin(uTime*.13)*.12)*p.xy;
  float a=atan(p.y,p.x);
  float radius=1.02+.12*cos(a*3.0+uTime*.18);
  float fold=.28*sin(a*2.0+uTime*.16);
  vec2 section=vec2(length(p.xy)-radius,(p.z-fold)*.9);
  return length(section)-(.255+.055*cos(a*3.0-uTime*.2));
}
vec3 normalAt(vec3 p){vec2 e=vec2(.0015,0.0);return normalize(vec3(form(p+e.xyy)-form(p-e.xyy),form(p+e.yxy)-form(p-e.yxy),form(p+e.yyx)-form(p-e.yyx)));}
vec3 environment(vec3 r){
  vec3 silver=vec3(.86,.85,.89);
  float top=smoothstep(-.1,.7,r.y);
  vec3 col=mix(vec3(.3,.29,.34),vec3(.96,.96,.98),top);
  float band=smoothstep(-.26,-.18,r.y)-smoothstep(.015,.07,r.y);
  col=mix(col,vec3(.035,.035,.05),band*.9);
  float window=pow(max(0.0,dot(r,normalize(vec3(-.8,1.1,.7)))),8.0);
  col+=vec3(.6,.58,.64)*window;
  float violet=pow(max(0.0,dot(r,normalize(vec3(1.0,.1,-.3)))),3.0);
  col=mix(col,vec3(.48,.42,.7),violet*.4);
  return col;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-uResolution*.5)/uResolution.y;
  vec3 bg=mix(vec3(.875,.875,.892),vec3(.934,.932,.933),smoothstep(-.55,.5,uv.y));
  float backdrop=exp(-dot(uv-vec2(.05,.02),uv-vec2(.05,.02))*1.4);
  bg+=vec3(.016,.008,.025)*backdrop;
  vec2 shadowUV=(uv-vec2(.01,-.335))/vec2(.36,.043);
  float shadow=exp(-dot(shadowUV,shadowUV)*1.7)*.17;
  bg-=shadow;
  vec3 ro=vec3(0.0,.1,4.7),rd=normalize(vec3(uv*3.5,-4.0));
  float d=0.0;vec3 p;bool hit=false;
  for(int i=0;i<86;i++){p=ro+rd*d;float h=form(p);if(h<.0015){hit=true;break;}d+=h*.82;if(d>8.0)break;}
  vec3 color=bg;
  if(hit){
    vec3 n=normalAt(p),reflection=reflect(rd,n),light=normalize(vec3(-.5,.9,1.0));
    float diffuse=max(0.0,dot(n,light));
    float rim=pow(1.0-max(0.0,dot(n,-rd)),4.0);
    float ao=clamp(1.0-(.075-form(p+n*.075))*.85-(.2-form(p+n*.2))*.45,.45,1.0);
    vec3 metal=environment(reflection);
    float spec=pow(max(0.0,dot(reflect(-light,n),-rd)),75.0);
    color=metal*(.72+.28*diffuse)*ao+vec3(1.0,.98,1.0)*spec*.35;
    color=mix(color,vec3(.91,.9,.96),rim*.35);
    color=mix(color,bg,clamp((d-3.7)*.035,0.0,.12));
  }
  float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
  color+=grain*.005;
  gl_FragColor=vec4(pow(clamp(color,0.0,1.0),vec3(.96)),1.0);
}`;
export class SoftSculpture {
  constructor(canvas){
    this.canvas=canvas;this.visible=true;this.pointer={x:0,y:0,active:false};this.mouse={x:0,y:0};this.w=1;this.h=1;
    try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});}catch{this.gl=null;}
    if(this.gl){try{this.init();}catch{this.gl.getExtension('WEBGL_lose_context')?.loseContext();this.gl=null;}}
    if(!this.gl)this.initFallback();
    this.resize();
    this.resizer=new ResizeObserver(()=>this.resize());this.resizer.observe(canvas);
    this.observer=new IntersectionObserver(es=>this.visible=es[0].isIntersecting,{rootMargin:'80px'});this.observer.observe(canvas);
  }
  init(){const gl=this.gl;const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Sculpture shader unavailable');return s;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error('Sculpture renderer unavailable');gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(this.program);
    this.uniforms={resolution:gl.getUniformLocation(this.program,'uResolution'),time:gl.getUniformLocation(this.program,'uTime'),mouse:gl.getUniformLocation(this.program,'uMouse')};
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(this.program,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  }
  initFallback(){
    // Keep the input canvas intact. A second, non-interactive canvas avoids
    // requesting 2D from a surface that already owns a failed WebGL context.
    this.fallback=document.createElement('canvas');
    this.fallback.setAttribute('aria-hidden','true');
    Object.assign(this.fallback.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    this.canvas.insertAdjacentElement('afterend',this.fallback);
    this.fallbackCtx=this.fallback.getContext('2d');
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,this.w<700?1:1.25);this.canvas.width=Math.max(1,Math.round(this.w*d));this.canvas.height=Math.max(1,Math.round(this.h*d));this.gl?.viewport(0,0,this.canvas.width,this.canvas.height);if(this.fallback){this.fallback.width=this.canvas.width;this.fallback.height=this.canvas.height;this.fallbackCtx?.setTransform(d,0,0,d,0,0);}}
  drawFallback(t){
    const c=this.fallbackCtx;if(!c)return;
    const w=this.w,h=this.h,cx=w*.5,cy=h*.48,size=Math.min(w*.29,h*.30),tau=Math.PI*2;
    const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#eeeded');bg.addColorStop(1,'#dfdfe5');c.fillStyle=bg;c.fillRect(0,0,w,h);
    c.save();c.translate(cx,h*.82);c.scale(1,.13);const shadow=c.createRadialGradient(0,0,0,0,0,size*1.02);shadow.addColorStop(0,'#6e63713b');shadow.addColorStop(1,'#6e637100');c.fillStyle=shadow;c.fillRect(-size*1.1,-size*1.1,size*2.2,size*2.2);c.restore();
    const ay=.35+t*.075+this.mouse.x*.48,ax=-.2+this.mouse.y*.32,az=-.43+Math.sin(t*.13)*.12;
    const rotate=v=>{const x=v[0]*Math.cos(ay)+v[2]*Math.sin(ay),z=-v[0]*Math.sin(ay)+v[2]*Math.cos(ay),y=v[1]*Math.cos(ax)-z*Math.sin(ax),zz=v[1]*Math.sin(ax)+z*Math.cos(ax);return[x*Math.cos(az)-y*Math.sin(az),x*Math.sin(az)+y*Math.cos(az),zz];};
    const points=[],faces=[],n=120,m=32;
    for(let i=0;i<n;i++){const u=i/n*tau,r=1.02+.12*Math.cos(u*3+t*.18),radius=.255+.055*Math.cos(u*3-t*.2),base=[r*Math.cos(u),r*Math.sin(u),.28*Math.sin(u*2+t*.16)];for(let j=0;j<m;j++){const v=j/m*tau,normal=rotate([Math.cos(u)*Math.cos(v),Math.sin(u)*Math.cos(v),Math.sin(v)]),p=rotate([base[0]+Math.cos(u)*Math.cos(v)*radius,base[1]+Math.sin(u)*Math.cos(v)*radius,base[2]+Math.sin(v)*radius]),perspective=4/(4+p[2]);points.push({x:cx+p[0]*size*perspective,y:cy+p[1]*size*perspective,z:p[2],normal});}}
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){const ids=[i*m+j,((i+1)%n)*m+j,((i+1)%n)*m+(j+1)%m,i*m+(j+1)%m];faces.push({ids,z:ids.reduce((sum,k)=>sum+points[k].z,0)/4});}
    faces.sort((a,b)=>b.z-a.z);
    for(const face of faces){const normal=face.ids.reduce((v,id)=>v.map((x,k)=>x+points[id].normal[k]/4),[0,0,0]);const diffuse=Math.max(0,-normal[0]*.42-normal[1]*.66-normal[2]*.56),spec=Math.pow(Math.max(0,-normal[0]*.28-normal[1]*.48-normal[2]*.83),30),band=Math.exp(-Math.pow((normal[1]+.12)/.2,2))*Math.max(0,-normal[2])*.3,light=.43+diffuse*.43+spec*.9-band;
      const red=Math.min(255,105+light*145),green=Math.min(255,100+light*147),blue=Math.min(255,122+light*140);c.fillStyle=`rgb(${red|0},${green|0},${blue|0})`;c.strokeStyle=c.fillStyle;c.lineWidth=.6;c.beginPath();face.ids.forEach((id,k)=>{const p=points[id];k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.fill();c.stroke();}
  }

  draw(t){if(!this.visible||this.w<2)return;const targetX=this.pointer.active?(this.pointer.x/this.w-.5)*2:0,targetY=this.pointer.active?(this.pointer.y/this.h-.5)*2:0;this.mouse.x+=(targetX-this.mouse.x)*.055;this.mouse.y+=(targetY-this.mouse.y)*.055;
    if(this.gl){const gl=this.gl;gl.useProgram(this.program);gl.uniform2f(this.uniforms.resolution,this.canvas.width,this.canvas.height);gl.uniform1f(this.uniforms.time,t);gl.uniform2f(this.uniforms.mouse,this.mouse.x,this.mouse.y);gl.drawArrays(gl.TRIANGLES,0,6);return;}
    this.drawFallback(t);
  }
}

// Graphic form studies for project covers; not photographs of the projects.
const TAU=Math.PI*2;
export class EditorialStudy {
  constructor(canvas,scene){this.canvas=canvas;this.scene=scene;this.ctx=canvas.getContext('2d');this.visible=true;this.w=1;this.h=1;this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);new IntersectionObserver(es=>this.visible=es[0].isIntersecting,{rootMargin:'100px'}).observe(canvas);}
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.max(1,Math.round(this.w*d));this.canvas.height=Math.max(1,Math.round(this.h*d));this.ctx?.setTransform(d,0,0,d,0,0);}
  draw(t){if(!this.visible||this.w<2||!this.ctx)return;const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);if(this.scene==='temple')this.architecture(c,w,h,t);else if(this.scene==='game')this.companion(c,w,h,t);else this.imageStudy(c,w,h,t);}
  architecture(c,w,h,t){c.fillStyle='#ded9e5';c.fillRect(0,0,w,h);const sz=Math.min(w,h)*.37,cx=w*.5,cy=h*.49,a=.68+Math.sin(t*.08)*.045;const iso=(x,y,z)=>[cx+(x*Math.cos(a)-z*Math.sin(a))*sz,cy+(x*Math.sin(a)+z*Math.cos(a))*sz*.35-y*sz];const line=(points,color,width=1,close=false,fill=null)=>{c.beginPath();points.forEach((p,i)=>{const q=iso(...p);i?c.lineTo(...q):c.moveTo(...q);});if(close)c.closePath();if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=color;c.lineWidth=width;c.stroke();};
    // A light axonometric grid anchors the layered roof profile.
    for(let i=-5;i<=5;i++){let x=i*.25;line([[x,-.85,-1.3],[x,-.85,1.3]],'#b6acbf38',.6);line([[-1.3,-.85,x],[1.3,-.85,x]],'#b6acbf38',.6);}
    const roof=(y,s)=>{const pts=[];for(let i=0;i<=30;i++){let x=(i/30*2-1)*s;pts.push([x,y-.13+.2*Math.pow(Math.abs(x/s),7),-s*.56]);}for(let i=30;i>=0;i--){let x=(i/30*2-1)*s;pts.push([x,y-.13+.2*Math.pow(Math.abs(x/s),7),s*.56]);}line(pts,'#80718c',.8,true,'#e7e3ebcc');for(let i=-5;i<=5;i++){let x=i/5*s;line([[x,y-.13+.2*Math.pow(Math.abs(x/s),7),-s*.56],[x,y+.06,s*.1],[x,y-.13+.2*Math.pow(Math.abs(x/s),7),s*.56]],'#9a8ba44d',.55);}};
    for(let tier=0;tier<3;tier++){const y=-.46+tier*.46,s=1.04-tier*.22;for(const x of[-1,1])for(const z of[-1,1]){const px=x*s*.7,pz=z*s*.35;line([[px,y-.35,pz],[px,y,pz]],'#796782',1.2);line([[px-.1,y-.06,pz],[px+.1,y-.06,pz]],'#796782',1.2);}roof(y+.06,s);}line([[0,.74,-.11],[0,.94,0],[0,.74,.11]],'#85738f',1.1);}
  companion(c,w,h,t){const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#2f2a3c');bg.addColorStop(1,'#17151e');c.fillStyle=bg;c.fillRect(0,0,w,h);const sx=w*.5,sy=h*.5,r=Math.min(w,h)*.205,drift=Math.sin(t*.3)*r*.06;
    c.strokeStyle='#d9c7f238';c.lineWidth=.8;for(let j=0;j<5;j++){c.beginPath();for(let i=0;i<=80;i++){const x=w*.18+i/80*w*.64,y=sy+Math.sin(i/80*TAU*1.5+t*.35+j*.45)*r*.25+j*5; i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
    for(let k=0;k<2;k++){const x=sx+(k?1:-1)*r*.96,y=sy+(k?drift:-drift),rr=r*(k?.85:1);c.save();c.translate(x,y);c.rotate(k?-.25:.2);const halo=c.createRadialGradient(0,0,rr*.2,0,0,rr*1.7);halo.addColorStop(0,'#b099cd16');halo.addColorStop(1,'#b099cd00');c.fillStyle=halo;c.fillRect(-rr*2,-rr*2,rr*4,rr*4);const g=c.createRadialGradient(-rr*.4,-rr*.5,rr*.01,0,0,rr);g.addColorStop(0,k?'#ede6f3':'#e8dbf2');g.addColorStop(.35,k?'#aba0be':'#c0a6d6');g.addColorStop(.75,k?'#675872':'#7c638f');g.addColorStop(1,'#3a3046');c.fillStyle=g;c.beginPath();c.ellipse(0,0,rr*.86,rr,0,0,TAU);c.fill();c.strokeStyle='#ece0ff68';c.lineWidth=.75;c.beginPath();c.ellipse(0,0,rr*.86,rr,0,0,TAU);c.stroke();c.fillStyle='#352a42';for(const ex of[-1,1]){c.beginPath();c.ellipse(ex*rr*.17,rr*.01,rr*.022,rr*.046,0,0,TAU);c.fill();}c.restore();}}
  imageStudy(c,w,h,t){c.fillStyle='#d9dddb';c.fillRect(0,0,w,h);const sz=Math.min(w*.65,h*.8),cx=w*.5,cy=h*.5;for(let k=0;k<4;k++){const o=k-1.5;c.save();c.translate(cx+o*sz*.135,cy-o*sz*.07);c.transform(.94,.16,-.23,.66,0,0);const side=sz*.65,gr=c.createLinearGradient(-side/2,-side/2,side/2,side/2);gr.addColorStop(0,k===3?'#d6d2db':'#edf0ec');gr.addColorStop(.45,k===3?'#918b9f':'#d6dcd5');gr.addColorStop(1,k===3?'#dfe2e1':'#aeb8b1');c.fillStyle=gr;c.shadowColor='#40483f1a';c.shadowBlur=20;c.shadowOffsetY=12;c.fillRect(-side/2,-side/2,side,side);c.shadowBlur=0;c.shadowOffsetY=0;c.strokeStyle='#929d9440';c.lineWidth=.75;c.strokeRect(-side/2,-side/2,side,side);if(k===3){c.save();c.beginPath();c.rect(-side/2,-side/2,side,side);c.clip();for(let j=0;j<27;j++){c.beginPath();for(let i=0;i<=55;i++){const x=-side/2+i/55*side,y=-side/2+j/26*side+Math.sin(i*.13+j*.2+t*.13)*side*.06; i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle=`rgba(246,246,248,${.14+j/90})`;c.lineWidth=.8;c.stroke();}c.restore();}else{c.strokeStyle='#7a887b36';for(let j=1;j<5;j++){c.beginPath();c.moveTo(-side/2,-side/2+j*side/5);c.lineTo(side/2,-side/2+j*side/5);c.stroke();}}c.restore();}}
}
