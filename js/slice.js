'use strict';

function positionSliceArrows(fi){
  const cr=canvas.getBoundingClientRect();
  const wr=document.getElementById('cw').getBoundingClientRect();
  const offX=cr.left-wr.left, offY=cr.top-wr.top;
  const sc=project(m3.app(rot,FACES[fi].n));
  const sx=offX+sc[0], sy=offY+sc[1];
  const gap=52;
  document.getElementById('sliceCW').style.left=(sx+gap)+'px';
  document.getElementById('sliceCW').style.top=sy+'px';
  document.getElementById('sliceCCW').style.left=(sx-gap)+'px';
  document.getElementById('sliceCCW').style.top=sy+'px';
}

function startSlice(){
  if(animating||!gameRunning)return;
  sliceMode='selectFace';
  sliceFace=-1;
  sel=null;
  document.getElementById('sliceBack').style.display='block';
  document.getElementById('sliceCW').style.display='none';
  document.getElementById('sliceCCW').style.display='none';
  document.getElementById('sliceBtn').classList.add('active');
  document.getElementById('sliceBtn').disabled=true;
  draw();
}

function sliceBack(){
  if(sliceMode==='selectDir'){
    sliceMode='selectFace';
    sliceFace=-1;
    document.getElementById('sliceCW').style.display='none';
    document.getElementById('sliceCCW').style.display='none';
    draw();
  } else {
    cancelSlice();
  }
}

function cancelSlice(){
  sliceMode=null;sliceFace=-1;
  document.getElementById('sliceBack').style.display='none';
  document.getElementById('sliceCW').style.display='none';
  document.getElementById('sliceCCW').style.display='none';
  document.getElementById('sliceBtn').classList.remove('active');
  document.getElementById('sliceBtn').disabled=false;
  draw();
}

function selectSliceFace(fi){
  sliceFace=fi;
  sliceMode='selectDir';
  document.getElementById('sliceCW').style.display='block';
  document.getElementById('sliceCCW').style.display='block';
  positionSliceArrows(fi);
  function pulse(){if(sliceMode==='selectDir'){draw();requestAnimationFrame(pulse);}}
  requestAnimationFrame(pulse);
}

function applySlice(cw){
  if(sliceFace<0)return;
  const fi=sliceFace;
  cancelSlice();
  animating=true;
  const target=cw?-Math.PI/2:Math.PI/2;
  sliceAnim={fi,angle:0};
  const dur=380;let start=null;
  function step(ts){
    if(!start)start=ts;
    const t=Math.min((ts-start)/dur,1);
    const ease=t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1;
    sliceAnim.angle=target*ease;
    draw();
    if(t<1){requestAnimationFrame(step);}
    else{
      sliceAnim=null;
      rotateFaceData(fi,cw);
      animating=false;
      draw();
      const m=findAllMatches();
      if(m.length)processMatches(m,0);
    }
  }
  requestAnimationFrame(step);
}

function rotateFaceData(fi,cw){
  const old=gems[fi].map(row=>row.map(g=>g?{...g}:null));
  for(let r=0;r<FC;r++)for(let c=0;c<FC;c++){
    if(cw) gems[fi][FC-1-c][r]=old[r][c];
    else   gems[fi][c][FC-1-r]=old[r][c];
  }
}
