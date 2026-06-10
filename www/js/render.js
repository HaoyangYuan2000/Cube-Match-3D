'use strict';

const LIGHT=v3.norm([0.5,0.9,-0.5]);

function resize(){
  const w=canvas.parentElement.clientWidth;
  const h=canvas.parentElement.clientHeight;
  canvas.width=w; canvas.height=h;
  cx=w/2; cy=h/2;
  projScale=Math.min(w,h)*0.38;
  draw();
}
window.addEventListener('resize',resize);

function project(p){
  const z=p[2]+CAM;
  const s=projScale*CAM/z;
  return[cx+p[0]*s, cy-p[1]*s];
}

function faceUVto3D(f,u,v){
  const{n,r,u:up}=f;
  return[n[0]+u*r[0]+v*up[0], n[1]+u*r[1]+v*up[1], n[2]+u*r[2]+v*up[2]];
}

function cellUV(row,col){
  return[CS0+col*(CSIZ+CGAP), CS0+(FC-1-row)*(CSIZ+CGAP)];
}

function faceBrightness(fi){
  const rn=m3.app(rot,FACES[fi].n);
  return Math.max(0.08, -v3.dot(rn,LIGHT)*0.9+0.55);
}

function shadeHex(hex,b){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, bl=n&255;
  r=Math.round(Math.min(255,r*b));
  g=Math.round(Math.min(255,g*b));
  bl=Math.round(Math.min(255,bl*b));
  return`rgb(${r},${g},${bl})`;
}

function drawGem(fi,r,c,bright){
  const gem=gems[fi]?.[r]?.[c];
  if(!gem)return;
  const f=FACES[fi];
  let[u,v]=cellUV(r,c);
  const sc=gem.scale??1;
  const h=CSIZ/2*sc;
  const dyOff=gem.dy||0;
  const dxOff=gem.dx||0;

  if(sliceAnim&&sliceAnim.fi===fi){
    const a=-sliceAnim.angle;
    const ca=Math.cos(a),sa=Math.sin(a);
    const u0=u+dxOff, v0=v+dyOff;
    const u2=u0*ca-v0*sa, v2=u0*sa+v0*ca;
    const bv=h*0.22;
    const hi=h-bv;
    // helper: rotated corner at offset (ou, ov)
    const rc=(ou,ov)=>project(m3.app(rot,faceUVto3D(f,
      u2+ou*ca-ov*sa, v2+ou*sa+ov*ca)));
    const outer=[rc(-h,h),rc(h,h),rc(h,-h),rc(-h,-h)];
    const inner=[rc(-hi,hi),rc(hi,hi),rc(hi,-hi),rc(-hi,-hi)];
    const col=COLORS[gem.color];
    const colLo=COLORS_LO[gem.color];
    ctx.save();ctx.globalAlpha=gem.alpha??1;
    // Top bevel
    ctx.beginPath();ctx.moveTo(outer[0][0],outer[0][1]);ctx.lineTo(outer[1][0],outer[1][1]);
    ctx.lineTo(inner[1][0],inner[1][1]);ctx.lineTo(inner[0][0],inner[0][1]);ctx.closePath();
    ctx.fillStyle=shadeHex(col,bright*1.35);ctx.fill();
    // Left bevel
    ctx.beginPath();ctx.moveTo(outer[3][0],outer[3][1]);ctx.lineTo(outer[0][0],outer[0][1]);
    ctx.lineTo(inner[0][0],inner[0][1]);ctx.lineTo(inner[3][0],inner[3][1]);ctx.closePath();
    ctx.fillStyle=shadeHex(col,bright*1.20);ctx.fill();
    // Right bevel
    ctx.beginPath();ctx.moveTo(outer[1][0],outer[1][1]);ctx.lineTo(outer[2][0],outer[2][1]);
    ctx.lineTo(inner[2][0],inner[2][1]);ctx.lineTo(inner[1][0],inner[1][1]);ctx.closePath();
    ctx.fillStyle=shadeHex(colLo,bright*0.72);ctx.fill();
    // Bottom bevel
    ctx.beginPath();ctx.moveTo(outer[2][0],outer[2][1]);ctx.lineTo(outer[3][0],outer[3][1]);
    ctx.lineTo(inner[3][0],inner[3][1]);ctx.lineTo(inner[2][0],inner[2][1]);ctx.closePath();
    ctx.fillStyle=shadeHex(colLo,bright*0.60);ctx.fill();
    // Main face
    ctx.beginPath();ctx.moveTo(inner[0][0],inner[0][1]);
    inner.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));ctx.closePath();
    const grd=ctx.createLinearGradient(inner[0][0],inner[0][1],inner[2][0],inner[2][1]);
    grd.addColorStop(0,shadeHex(col,bright));
    grd.addColorStop(1,shadeHex(colLo,bright*1.4));
    ctx.fillStyle=grd;ctx.fill();
    ctx.restore();
    return;
  }

  u+=dxOff; v+=dyOff;
  const bv=h*0.22; // bevel width

  // Outer corners: TL TR BR BL
  const outer=[
    faceUVto3D(f,u-h,v+h),
    faceUVto3D(f,u+h,v+h),
    faceUVto3D(f,u+h,v-h),
    faceUVto3D(f,u-h,v-h),
  ].map(p=>project(m3.app(rot,p)));

  // Inner corners (inset by bevel)
  const inner=[
    faceUVto3D(f,u-h+bv,v+h-bv),
    faceUVto3D(f,u+h-bv,v+h-bv),
    faceUVto3D(f,u+h-bv,v-h+bv),
    faceUVto3D(f,u-h+bv,v-h+bv),
  ].map(p=>project(m3.app(rot,p)));

  const isSel=sel&&sel.fi===fi&&sel.r===r&&sel.c===c;
  const col=COLORS[gem.color];

  ctx.save();
  ctx.globalAlpha=gem.alpha??1;

  const colLo=COLORS_LO[gem.color];

  // Top bevel — highlight
  ctx.beginPath();
  ctx.moveTo(outer[0][0],outer[0][1]);ctx.lineTo(outer[1][0],outer[1][1]);
  ctx.lineTo(inner[1][0],inner[1][1]);ctx.lineTo(inner[0][0],inner[0][1]);
  ctx.closePath();
  ctx.fillStyle=shadeHex(col,bright*1.35);ctx.fill();

  // Left bevel — highlight
  ctx.beginPath();
  ctx.moveTo(outer[3][0],outer[3][1]);ctx.lineTo(outer[0][0],outer[0][1]);
  ctx.lineTo(inner[0][0],inner[0][1]);ctx.lineTo(inner[3][0],inner[3][1]);
  ctx.closePath();
  ctx.fillStyle=shadeHex(col,bright*1.20);ctx.fill();

  // Right bevel — shadow
  ctx.beginPath();
  ctx.moveTo(outer[1][0],outer[1][1]);ctx.lineTo(outer[2][0],outer[2][1]);
  ctx.lineTo(inner[2][0],inner[2][1]);ctx.lineTo(inner[1][0],inner[1][1]);
  ctx.closePath();
  ctx.fillStyle=shadeHex(colLo,bright*0.72);ctx.fill();

  // Bottom bevel — shadow
  ctx.beginPath();
  ctx.moveTo(outer[2][0],outer[2][1]);ctx.lineTo(outer[3][0],outer[3][1]);
  ctx.lineTo(inner[3][0],inner[3][1]);ctx.lineTo(inner[2][0],inner[2][1]);
  ctx.closePath();
  ctx.fillStyle=shadeHex(colLo,bright*0.60);ctx.fill();

  // Main face with gradient
  ctx.beginPath();
  ctx.moveTo(inner[0][0],inner[0][1]);
  inner.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));
  ctx.closePath();
  const grd=ctx.createLinearGradient(inner[0][0],inner[0][1],inner[2][0],inner[2][1]);
  grd.addColorStop(0,shadeHex(col,bright));
  grd.addColorStop(1,shadeHex(colLo,bright*1.4));
  ctx.fillStyle=grd;ctx.fill();



  // Flash white on elimination
  if(gem.flash){
    ctx.beginPath();
    ctx.moveTo(outer[0][0],outer[0][1]);
    outer.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));
    ctx.closePath();
    ctx.fillStyle=`rgba(255,255,255,${gem.flash*0.75})`;
    ctx.fill();
  }

  if(isSel){
    ctx.strokeStyle='#fff';ctx.lineWidth=2.5;
    ctx.shadowColor='#fff';ctx.shadowBlur=10;
    ctx.beginPath();
    ctx.moveTo(outer[0][0],outer[0][1]);
    outer.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));
    ctx.closePath();ctx.stroke();
    ctx.shadowBlur=0;
  }

  ctx.restore();
}

function drawFaceBG(fi,bright){
  const f=FACES[fi];
  const h=1.0;
  const corners=[
    faceUVto3D(f,-h, h),
    faceUVto3D(f, h, h),
    faceUVto3D(f, h,-h),
    faceUVto3D(f,-h,-h),
  ].map(p=>project(m3.app(rot,p)));
  ctx.beginPath();
  ctx.moveTo(corners[0][0],corners[0][1]);
  corners.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));
  ctx.closePath();
  ctx.fillStyle=`rgb(12,12,28)`;
  ctx.fill();
  ctx.strokeStyle=`rgba(124,111,255,${bright*0.4})`;
  ctx.lineWidth=1;
  ctx.stroke();
}

function drawCubeEdges(){
  const verts=[
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
  ];
  const edges=[
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  ctx.save();
  ctx.strokeStyle='rgba(124,111,255,0.25)';
  ctx.lineWidth=1;
  edges.forEach(([a,b])=>{
    const p1=project(m3.app(rot,verts[a]));
    const p2=project(m3.app(rot,verts[b]));
    ctx.beginPath();ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.stroke();
  });
  ctx.restore();
}

function drawParticles(){
  particles=particles.filter(p=>p.life>0);
  // cap total particles to avoid mobile slowdown
  if(particles.length>120)particles.splice(0,particles.length-120);
  ctx.save();
  for(const p of particles){
    ctx.globalAlpha=p.life*(p.spark?1:0.9);
    if(p.shard){
      ctx.fillStyle=p.col;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      const s=p.size*p.life;
      ctx.fillRect(-s/2,-s/2,s,s);
      ctx.restore();
      p.rot+=p.rotV;
    } else {
      ctx.fillStyle=p.col;
      const r=p.size*(p.spark?p.life*0.6:p.life);
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0.5,r),0,Math.PI*2);ctx.fill();
    }
    p.x+=p.vx;p.y+=p.vy;
    p.vy+=p.shard?0.06:(p.spark?0.05:0.18);
    p.vx*=0.96;
    p.life-=p.decay;
  }
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  if(shakeAmt>0.5){
    ctx.translate((Math.random()-.5)*shakeAmt,(Math.random()-.5)*shakeAmt);
    shakeAmt*=0.75;
  }

  const visible=FACES.map(f=>{
    const rn=m3.app(rot,f.n);
    return{f,rn,depth:rn[2]};
  }).filter(({rn})=>rn[2]<-0.04)
    .sort((a,b)=>b.depth-a.depth);

  drawCubeEdges();

  for(const{f,rn}of visible){
    if(rn[2]>=-0.04)continue;
    const b=Math.max(0.82,Math.min(1.15,-v3.dot(rn,LIGHT)*0.2+0.95));
    const h=1.0;
    const faceCorners=[
      faceUVto3D(f,-h, h),
      faceUVto3D(f, h, h),
      faceUVto3D(f, h,-h),
      faceUVto3D(f,-h,-h),
    ].map(p=>project(m3.app(rot,p)));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(faceCorners[0][0],faceCorners[0][1]);
    faceCorners.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));
    ctx.closePath();
    ctx.clip();

    drawFaceBG(f.id,b);
    for(let r=0;r<FC;r++)for(let c=0;c<FC;c++)drawGem(f.id,r,c,b);

    if(sliceMode==='selectDir'&&sliceFace===f.id){
      const pulse=0.15+0.15*Math.sin(Date.now()*0.008);
      ctx.beginPath();
      ctx.moveTo(faceCorners[0][0],faceCorners[0][1]);
      faceCorners.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));
      ctx.closePath();
      ctx.fillStyle=`rgba(255,255,255,${pulse})`;
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles();
  ctx.restore();
}
