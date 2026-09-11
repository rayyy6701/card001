/* Holo Card Studio's spectrum/overlay/angular foil, extended with independent
   background, subject and foreground planes and five combinable finishes. */
(() => {
'use strict';
const $=id=>document.getElementById(id),card=$('card'),canvas=$('holo');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const effectButtons=[...document.querySelectorAll('[data-effect]')];
const effects=new Set(['rainbow','stars']),cache=new Map();
let cards=[],active=null,activeLayers=null,selection=0,gl=null,program=null,ready=false;
let x=3,y=-9,tx=x,ty=y,flipped=false,auto=false,drag=null,foil=.65,depth=.8;
let frame=0,last=0,lastDraw=0,elapsed=0,movingLight=!reduced.matches;
let locations={},textures=[];
$('animate-light').checked=movingLight;
const vertex=`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment=`precision mediump float;
varying vec2 vUv;uniform sampler2D uBackground,uSubject,uForeground;uniform vec2 uView;
uniform float uFoil,uDepth,uTime,uPearl;uniform vec4 uEffects;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec3 spectrum(float t){return .55+.45*cos(6.283*(t+vec3(0.,.33,.67)));}
vec3 overlay(vec3 b,vec3 f){return mix(2.*b*f,1.-2.*(1.-b)*(1.-f),step(vec3(.5),b));}
float inside(vec2 p){return step(0.,p.x)*step(0.,p.y)*step(p.x,1.)*step(p.y,1.);}
vec4 layer(sampler2D tex,vec2 uv){vec4 c=texture2D(tex,clamp(uv,.002,.998));c.a*=inside(uv);return c;}
float stars(vec2 uv){vec2 p=uv*vec2(14.,21.),id=floor(p),f=fract(p)-.5;float seed=hash(id);f-=vec2(hash(id+2.),hash(id+5.))*.35-.175;float cross=exp(-abs(f.x)*95.-abs(f.y)*9.)+exp(-abs(f.x)*9.-abs(f.y)*95.);float pulse=pow(.5+.5*sin(uTime*1.5+seed*31.+uView.x*4.+uView.y*3.),5.);return cross*step(.74,seed)*pulse;}
float glitter(vec2 uv){vec2 p=uv*vec2(120.,180.),id=floor(p),f=fract(p)-.5;float seed=hash(id);float fleck=1.-smoothstep(.06,.31,length(f));float pulse=pow(.5+.5*sin(seed*50.+uTime*.8+uView.x*9.+uView.y*7.),9.);return fleck*step(.76,seed)*pulse;}
void main(){vec2 uv=vUv;
 vec2 b=(uv-.5)/1.16+.5+uView*uDepth*.025;
 vec2 s=(uv-.5)/.94+.5-uView*uDepth*.048;
 vec2 f=(uv-.5)/1.08+.5-uView*uDepth*.10;
 vec3 bg=texture2D(uBackground,clamp(b,.002,.998)).rgb;
 vec4 animal=layer(uSubject,s),plants=layer(uForeground,f);
 float shadow=layer(uSubject,s+vec2(.014,.014)).a*(1.-animal.a)*.12;
 vec3 col=mix(bg*(1.-shadow),animal.rgb,animal.a);col=mix(col,plants.rgb,plants.a);
 float protect=1.-animal.a*.56;
 float angle=uView.x*.8+uView.y*.45;
 float sweep=pow(.5+.5*sin((uv.x*.8+uv.y*.38+angle)*6.283),12.);
 vec3 rainbow=spectrum(uv.x*.45+uv.y*.3+angle+noise(uv*4.)*.12);
 col=mix(col,overlay(col,rainbow),uEffects.x*uFoil*.30*protect);
 col+=rainbow*sweep*uEffects.x*uFoil*.17*protect;
 col+=vec3(.82,.94,1.)*stars(uv+uView*.025)*uEffects.y*uFoil*.8*protect;
 float gold=glitter(uv+uView*.015);col+=vec3(1.,.73,.23)*gold*uEffects.z*uFoil*.88;
 col=mix(col,overlay(col,vec3(.95,.71,.34)),uEffects.z*uFoil*.06*sweep);
 float ribbon=exp(-pow((uv.y-.53-sin(uv.x*5.+angle*3.+uTime*.12)*.18-uView.y*.18)*13.,2.));
 vec3 aurora=mix(vec3(.22,1.,.72),vec3(.66,.42,1.),.5+.5*sin(uv.x*6.+angle*4.));
 col+=aurora*ribbon*uEffects.w*uFoil*.24*protect;
 float sheen=pow(.5+.5*cos((uv.x+uv.y*.48+angle)*5.),5.);
 vec3 pearl=mix(vec3(.8,.94,1.),vec3(1.,.81,.94),uv.x);
 col=mix(col,pearl,uPearl*uFoil*sheen*.24*protect);
 gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function initGL(){try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 textures=[];['uBackground','uSubject','uForeground'].forEach((name,i)=>{gl.activeTexture(gl.TEXTURE0+i);const texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,name),i);});
 for(const name of ['uView','uFoil','uDepth','uTime','uEffects','uPearl'])locations[name]=gl.getUniformLocation(program,name);
 canvas.width=660;canvas.height=990;gl.viewport(0,0,660,990);ready=true;if(activeLayers)upload(activeLayers);return true;
 }catch(e){console.error(e);ready=false;canvas.style.opacity='0';$('status').textContent='光の描画が使えないため、立体レイヤーで表示しています。ドラッグと奥行き調整は使えます。';return false;}}
function upload(layers){if(!ready)return;layers.forEach((layer,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,layer);});canvas.style.opacity='1';wake();}
// The generated atlas separates three paintings. Key the flat magenta backing
// into real alpha once, retaining the existing alpha when the asset has it.
function splitAtlas(image){const layers=[];const panel=image.naturalWidth/3;
 for(let i=0;i<3;i++){const c=document.createElement('canvas');c.width=590;c.height=885;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,i*panel+2,0,panel-4,image.naturalHeight,0,0,c.width,c.height);
  if(i>0){const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;for(let j=0;j<d.length;j+=4){if(!d[j+3])continue;const excess=Math.min(d[j],d[j+2])-d[j+1];const key=Math.max(0,Math.min(1,(excess-65)/100));if(key>0){d[j+3]=Math.round(d[j+3]*(1-key));if(key<1){d[j]=Math.min(d[j],d[j+1]+90);d[j+2]=Math.min(d[j+2],d[j+1]+90);}}}ctx.putImageData(pixels,0,0);}
  layers.push(c);
 }return layers;}
function prepare(item){if(cache.has(item.id))return cache.get(item.id);const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{resolve(splitAtlas(img));}catch(e){reject(e);}};img.onerror=()=>reject(Error('画像の読み込みに失敗しました'));img.src=item.atlas;});cache.set(item.id,promise);promise.catch(()=>cache.delete(item.id));return promise;}
function fallback(layers){$('fallback').replaceChildren(...layers);layers.forEach((layer,i)=>{layer.dataset.layer=String(i);});}
function updateEffects(){effectButtons.forEach(button=>button.setAttribute('aria-pressed',String(effects.has(button.dataset.effect))));wake();}
function applyDefaults(){foil=.65;depth=.8;effects.clear();(active?.effects||['rainbow','stars']).forEach(e=>effects.add(e));$('foil').value='65';$('foil-value').value='65%';$('depth').value='80';$('depth-value').value='80%';updateEffects();}
function updateFace(){$('flip').textContent=flipped?'↻ 表を見る':'↻ 裏を見る';$('face-label').textContent=flipped?'BACK · '+(active?.number||'001'):String(cards.indexOf(active)+1).padStart(2,'0')+' / 03';$('hint').textContent=flipped?'裏面 · ドラッグして傾ける':'ドラッグして、奥行きと光を楽しむ';}
async function select(item){const token=++selection;$('loading').hidden=false;$('loading').textContent='カードを準備しています…';try{const layers=await prepare(item);if(token!==selection)return;active=item;activeLayers=layers;document.body.style.setProperty('--scene',item.color);for(const id of ['printed-title','back-title','info-title'])$(id).textContent=item.title;for(const id of ['printed-number','back-number','info-number'])$(id).textContent=item.number;$('description').textContent=item.description;$('collection-label').textContent=item.collection;$('back-collection').textContent=item.collection;$('card-collection').textContent=item.collection.split(' ')[0];$('footer-title').textContent=item.title+' · '+item.number;document.title=item.title+' | Holo Card';card.setAttribute('aria-label',item.title+'、番号'+item.number+'。ドラッグまたは矢印キーで傾けられます。');document.querySelectorAll('[data-card]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.card===item.id)));setAuto(false);flipped=false;tx=3;ty=-9;applyDefaults();updateFace();fallback(layers);upload(layers);$('loading').hidden=true;wake();}catch(e){if(token!==selection)return;console.error(e);$('loading').textContent='読み込めませんでした。カードをもう一度選んでください。';}}
function gallery(){for(const item of cards){const b=document.createElement('button');b.type='button';b.dataset.card=item.id;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',item.number+' '+item.title);const thumb=document.createElement('span');thumb.className='thumb';const label=document.createElement('span');label.className='label';const number=document.createElement('small');number.textContent=item.number;const title=document.createElement('strong');title.textContent=item.title;label.append(number,title);b.append(thumb,label);b.onclick=()=>select(item);$('gallery').append(b);prepare(item).then(layers=>{const c=document.createElement('canvas');c.width=118;c.height=177;const ctx=c.getContext('2d');layers.forEach(layer=>ctx.drawImage(layer,0,0,118,177));thumb.append(c);}).catch(()=>{thumb.textContent='✧';});}}
function draw(){if(!activeLayers)return;const vx=Math.sin((y-(flipped?180:0))*Math.PI/180)*1.7,vy=-Math.sin(x*Math.PI/180)*1.7;
 if(!ready){const scales=[1.16,.94,1.08],factors=[-.025,.048,.10];activeLayers.forEach((layer,i)=>{layer.style.transform=`translate(${vx*depth*factors[i]*100}%,${-vy*depth*factors[i]*100}%) scale(${scales[i]})`;});return;}
 gl.uniform2f(locations.uView,vx,vy);gl.uniform1f(locations.uFoil,foil);gl.uniform1f(locations.uDepth,depth);gl.uniform1f(locations.uTime,elapsed);gl.uniform4f(locations.uEffects,+effects.has('rainbow'),+effects.has('stars'),+effects.has('gold'),+effects.has('aurora'));gl.uniform1f(locations.uPearl,+effects.has('pearl'));gl.drawArrays(gl.TRIANGLES,0,6);}
function animate(now){frame=0;const dt=Math.min((now-last)/1000,.05)||.016;last=now;if(movingLight)elapsed+=dt;if(auto){tx=Math.sin(now*.00085)*10;ty=Math.sin(now*.00065)*25;}const ease=reduced.matches?1:1-Math.exp(-dt*10);x+=(tx-x)*ease;y+=(ty-y)*ease;card.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;if(now-lastDraw>=30){draw();lastDraw=now;}
 if(!document.hidden&&(auto||drag||Math.abs(x-tx)>.01||Math.abs(y-ty)>.01||(movingLight&&ready&&!flipped&&foil>0&&effects.size)))wake();else draw();}
function wake(){if(!frame&&!document.hidden)frame=requestAnimationFrame(animate);}
function setAuto(v){auto=v;$('auto').setAttribute('aria-pressed',String(v));$('auto').textContent=v?'Ⅱ 自動を止める':'▷ 自動で傾ける';wake();}
function turn(){setAuto(false);flipped=!flipped;tx=0;ty=flipped?180:0;updateFace();wake();}
function reset(){setAuto(false);flipped=false;tx=3;ty=-9;movingLight=!reduced.matches;$('animate-light').checked=movingLight;applyDefaults();updateFace();wake();}
function clamp(){tx=Math.max(-25,Math.min(25,tx));const base=flipped?180:0;ty=Math.max(base-35,Math.min(base+35,ty));}
card.addEventListener('pointerdown',e=>{if(e.button!==0)return;setAuto(false);drag={id:e.pointerId,x:e.clientX,y:e.clientY};card.setPointerCapture(e.pointerId);card.focus({preventScroll:true});});card.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;ty+=(e.clientX-drag.x)*.22;tx-=(e.clientY-drag.y)*.16;drag.x=e.clientX;drag.y=e.clientY;clamp();wake();});for(const event of ['pointerup','pointercancel','lostpointercapture'])card.addEventListener(event,()=>{drag=null;});
card.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(!['arrowleft','arrowright','arrowup','arrowdown','f','r'].includes(key))return;e.preventDefault();setAuto(false);if(key==='f'){turn();return;}if(key==='r'){reset();return;}if(key==='arrowleft')ty-=5;if(key==='arrowright')ty+=5;if(key==='arrowup')tx+=5;if(key==='arrowdown')tx-=5;clamp();wake();});
$('auto').onclick=()=>{if(flipped){flipped=false;updateFace();tx=0;ty=0;}setAuto(!auto);};$('flip').onclick=turn;$('reset').onclick=reset;
effectButtons.forEach(button=>button.onclick=()=>{const effect=button.dataset.effect;if(effects.has(effect))effects.delete(effect);else effects.add(effect);updateEffects();});$('clear-effects').onclick=()=>{effects.clear();updateEffects();};$('foil').oninput=e=>{foil=Number(e.target.value)/100;$('foil-value').value=e.target.value+'%';wake();};$('depth').oninput=e=>{depth=Number(e.target.value)/100;$('depth-value').value=e.target.value+'%';wake();};$('animate-light').onchange=e=>{movingLight=e.target.checked;wake();};
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;canvas.style.opacity='0';$('status').textContent='光の描画を一時停止しています。立体レイヤーで表示中です。';wake();});canvas.addEventListener('webglcontextrestored',()=>{if(initGL())$('status').textContent='';});document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else{last=performance.now();wake();}});
initGL();fetch('cards.json').then(r=>{if(!r.ok)throw Error('カード一覧を読み込めませんでした');return r.json();}).then(list=>{cards=list;gallery();return select(cards[0]);}).catch(e=>{console.error(e);$('loading').textContent='カード一覧を読み込めませんでした。ページを再読み込みしてください。';});wake();
})();
