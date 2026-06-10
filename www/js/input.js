'use strict';

let pDown=false,pX=0,pY=0,pT=0,moved=false;
let lastDX=0,lastDY=0;

function onDown(x,y){
  pDown=true;pX=x;pY=y;pT=Date.now();moved=false;lastDX=0;lastDY=0;
  vel=[0,0];spinning=false;
}
function onMove(x,y){
  if(!pDown)return;
  const dx=x-pX,dy=y-pY;
  if(!moved&&Math.hypot(dx,dy)>6)moved=true;
  if(moved&&sliceMode==='selectDir'){pX=x;pY=y;return;}
  if(moved){
    const speed=0.006;
    rot=m3.mul(m3.rotY(-dx*speed),m3.mul(m3.rotX(-dy*speed),rot));
    lastDX=dx;lastDY=dy;
    draw();
  }
  pX=x;pY=y;
}
function onUp(x,y){
  if(!pDown)return;
  const dt=Date.now()-pT;
  pDown=false;
  if(!moved&&dt<250){
    const h=hitTest(x,y);
    if(h)handleTap(h);
    return;
  }
  if(moved){vel=[lastDX*0.7,lastDY*0.7];startSpin();}
}

canvas.addEventListener('mousedown', e=>{onDown(e.offsetX,e.offsetY);});
canvas.addEventListener('mousemove', e=>{if(pDown)onMove(e.offsetX,e.offsetY);});
canvas.addEventListener('mouseup',   e=>{onUp(e.offsetX,e.offsetY);});
canvas.addEventListener('mouseleave',e=>{if(pDown){vel=[0,0];pDown=false;}});

let tfAngle=null;

function touchAngle(touches){
  return Math.atan2(
    touches[1].clientY-touches[0].clientY,
    touches[1].clientX-touches[0].clientX
  );
}

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  if(e.touches.length>=2){
    pDown=false;spinning=false;
    tfAngle=touchAngle(e.touches);
  } else {
    tfAngle=null;
    const t=e.touches[0];
    onDown(t.clientX-r.left,t.clientY-r.top);
  }
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  if(e.touches.length>=2&&tfAngle!==null&&sliceMode!=='selectDir'){
    const a=touchAngle(e.touches);
    const delta=a-tfAngle;
    tfAngle=a;
    rot=m3.mul(m3.rotZ(-delta),rot);
    draw();
  } else if(e.touches.length===1&&tfAngle===null){
    const t=e.touches[0];
    onMove(t.clientX-r.left,t.clientY-r.top);
  }
},{passive:false});

canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  if(e.touches.length===0){
    tfAngle=null;
    const t=e.changedTouches[0];
    onUp(t.clientX-r.left,t.clientY-r.top);
  } else if(e.touches.length===1){
    tfAngle=null;
    const t=e.touches[0];
    pX=t.clientX-r.left;pY=t.clientY-r.top;pDown=true;moved=false;
  }
},{passive:false});

function startSpin(){
  spinning=true;
  function tick(){
    if(!spinning)return;
    const speed=0.005;
    rot=m3.mul(m3.rotY(-vel[0]*speed),m3.mul(m3.rotX(-vel[1]*speed),rot));
    vel[0]*=0.92;vel[1]*=0.92;
    draw();
    if(Math.hypot(vel[0],vel[1])>0.4)requestAnimationFrame(tick);
    else spinning=false;
  }
  requestAnimationFrame(tick);
}
