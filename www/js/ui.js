'use strict';

// ── Nickname ──
function getNickname(){ return localStorage.getItem('cb3d_nickname')||''; }

async function saveNickname(){
  const val=document.getElementById('nickInput').value.trim();
  const btn=document.getElementById('nickConfirmBtn');
  const err=document.getElementById('nickError');
  if(!val){err.textContent='Please enter a nickname';err.style.display='';return;}
  if(val.length<2){err.textContent='Nickname must be at least 2 characters';err.style.display='';return;}
  if(val.length>16){err.textContent='Nickname must be 16 characters or fewer';err.style.display='';return;}
  if(!/^[a-zA-Z0-9_\- ]+$/.test(val)){err.textContent='Nickname can only contain letters, numbers, spaces, - and _';err.style.display='';return;}
  btn.disabled=true;
  btn.textContent='Checking...';
  err.style.display='none';
  const status=await checkNickname(val);
  if(status==='taken'){
    err.textContent='Name already taken';
    err.style.display='';
    btn.disabled=false;
    btn.textContent='Confirm';
    return;
  }
  localStorage.setItem('cb3d_nickname',val);
  await claimNickname(val);
  document.getElementById('nickOv').classList.add('hidden');
  if(window._pendingAfterNick){const fn=window._pendingAfterNick;window._pendingAfterNick=null;fn();}
}

// ── Google account binding ──
let _bindShownThisSession = false;

function _incrementGamesPlayed(){
  const n=(+localStorage.getItem('cb3d_gp')||0)+1;
  localStorage.setItem('cb3d_gp',n);
  return n;
}

function _shouldShowBindPrompt(){
  if(_bindShownThisSession) return false;
  if(!isAnonymousUser()) return false;
  const n=+localStorage.getItem('cb3d_gp')||0;
  return n>=3;
}

function onAccountBtn(){
  if(!isAnonymousUser()){
    // Already linked — show linked state in bindOv
    document.getElementById('bindOv').classList.remove('hidden');
    document.getElementById('bindOvTitle').textContent='Account Linked ✓';
    document.getElementById('bindOvDesc').textContent='Your progress is saved to your Google account.';
    document.getElementById('bindGoogleBtn').style.display='none';
    document.getElementById('bindError').style.display='none';
  } else {
    // Anonymous — show bind prompt
    document.getElementById('bindOvTitle').textContent='Save Your Progress';
    document.getElementById('bindOvDesc').textContent='Link your Google account to sync progress across devices and never lose your score.';
    document.getElementById('bindGoogleBtn').style.display='';
    document.getElementById('bindGoogleBtn').disabled=false;
    document.getElementById('bindError').style.display='none';
    document.getElementById('bindOv').classList.remove('hidden');
  }
}

function showBindPrompt(){
  _bindShownThisSession=true;
  document.getElementById('bindOvTitle').textContent='Save Your Progress';
  document.getElementById('bindOvDesc').textContent='Link your Google account to sync progress across devices and never lose your score.';
  document.getElementById('bindGoogleBtn').style.display='';
  document.getElementById('bindGoogleBtn').disabled=false;
  document.getElementById('bindError').style.display='none';
  document.getElementById('bindOv').classList.remove('hidden');
}

function hideBindPrompt(){
  document.getElementById('bindOv').classList.add('hidden');
}

async function doGoogleLink(){
  const btn=document.getElementById('bindGoogleBtn');
  const err=document.getElementById('bindError');
  btn.disabled=true;
  err.style.display='none';
  await initFirebase();
  const result=await linkWithGoogle();
  if(result.success){
    if(result.displayName&&!getNickname()){
      const safe=result.displayName.replace(/[^a-zA-Z0-9_\- ]/g,'').slice(0,16);
      if(safe.length>=2){
        localStorage.setItem('cb3d_nickname',safe);
        await claimNickname(safe);
      }
    }
    hideBindPrompt();
    showToast('✅ Account linked! Progress saved.');
    // Reload progress from Firestore (Google account may have existing data) and refresh city
    const progress=await loadProgress();
    if(progress){
      if(progress.nickname&&!getNickname())localStorage.setItem('cb3d_nickname',progress.nickname);
      if(progress.stars)Object.entries(progress.stars).forEach(([i,s])=>localStorage.setItem('cb3d_s'+i,s));
      if(progress.bestLeft)Object.entries(progress.bestLeft).forEach(([i,v])=>localStorage.setItem('cb3d_bl'+i,v));
      if(progress.blocksElim>totalBlocksElim){
        totalBlocksElim=progress.blocksElim;
        localStorage.setItem('cb3d_blocks',totalBlocksElim);
      }
      if(progress.classicBest>getClassicBest())localStorage.setItem('cb3d_classic_best',progress.classicBest);
      if(progress.taBest>getTaBest())localStorage.setItem('cb3d_ta_best',progress.taBest);
    }
    // Compute final slice count using Google account as source of truth
    const today=new Date().toDateString();
    const googleBase=progress&&progress.tools&&progress.tools.slice!=null?progress.tools.slice:0;
    if(progress&&progress.sliceDay===today){
      // Google already recorded today's bonus — use Google's count as-is
      sliceUses=googleBase;
      window._dailySliceBonus=false;
    } else {
      // Google hasn't given today's bonus yet — add it on top of Google's base
      sliceUses=googleBase+6;
      localStorage.setItem('cb3d_sliceday',today);
      window._dailySliceBonus=true;
      saveProgress('tools',{slice:sliceUses});saveProgress('sliceDay',today);
    }
    updateSliceBtn();
    updateCity();
  } else if(result.error==='cancelled'){
    btn.disabled=false;
  } else {
    err.textContent='Sign-in failed ('+(result.error||'unknown')+')';
    err.style.display='';
    btn.disabled=false;
  }
}


function showToast(msg){
  const wrap=document.getElementById('cw');
  if(!wrap)return;
  const el=document.createElement('div');
  el.textContent=msg;
  el.style.cssText='position:absolute;top:18%;left:50%;transform:translateX(-50%) translateY(0);font-size:13px;white-space:nowrap;z-index:60;color:#ffe066;background:rgba(20,16,48,.9);padding:6px 16px;border-radius:99px;border:1px solid rgba(255,224,102,.3);pointer-events:none;transition:transform 3s ease-out,opacity 3s ease-out';
  setTimeout(()=>requestAnimationFrame(()=>{
    el.style.transform='translateX(-50%) translateY(-40px)';
    el.style.opacity='0';
  }), 3000);
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),6000);
}

function showNickSetup(then){
  window._pendingAfterNick=then||null;
  document.getElementById('nickInput').value='';
  document.getElementById('nickError').style.display='none';
  document.getElementById('nickConfirmBtn').disabled=false;
  document.getElementById('nickConfirmBtn').textContent='Confirm';
  document.getElementById('nickOv').classList.remove('hidden');
  setTimeout(()=>document.getElementById('nickInput').focus(),100);
}

// ── Leaderboard rendering ──
function renderLeaderboard(elId, rows, myId){
  const el=document.getElementById(elId);
  if(!rows||!rows.length){el.innerHTML='<div class="lb-loading">No scores yet</div>';return;}
  const medals=['🥇','🥈','🥉'];
  el.innerHTML=rows.map((r,i)=>{
    const isMe=r.name===myId;
    const rank=i<3?`<span class="lb-rank top">${medals[i]}</span>`:`<span class="lb-rank">${i+1}</span>`;
    return`<div class="lb-row${isMe?' me':''}">${rank}<span class="lb-name">${r.name||'Anonymous'}</span><span class="lb-score">${(r.score||0).toLocaleString()}</span></div>`;
  }).join('');
}

function updateHUD(){
  document.getElementById('se').textContent=score.toLocaleString();
  if(window._gameMode==='timed'){
    document.getElementById('be').textContent=getTaBest().toLocaleString()||'0';
  } else if(window._gameMode==='classic'){
    document.getElementById('me').textContent=moves;
    document.getElementById('be').textContent=getClassicBest().toLocaleString()||'0';
  }
}

function checkEnd(){
  if(window._gameMode==='timed')return;
  if(moves<=0)endClassicGame();
}

function hideAll(){
  ['modeOv','taOv','classicOv','nickOv','lbOv','bindOv'].forEach(id=>document.getElementById(id).classList.add('hidden'));
}

function updateSliceBtn(){
  const lbl=document.getElementById('sliceLabel');
  if(lbl)lbl.textContent='Slice ×'+sliceUses;
}


let _pendingCityToasts=[];

function showCityToast(name){
  const wrap=document.getElementById('cw');
  if(!wrap)return;
  const el=document.createElement('div');
  el.textContent='🏙️ '+name+' Built!';
  el.style.cssText='position:absolute;top:6%;left:50%;transform:translateX(-50%) translateY(0);font-size:13px;white-space:nowrap;z-index:60;color:#ffe066;background:rgba(20,16,48,.85);padding:6px 16px;border-radius:99px;border:1px solid rgba(255,224,102,.3);pointer-events:none;transition:transform 3s ease-out,opacity 3s ease-out';
  setTimeout(()=>requestAnimationFrame(()=>{
    el.style.transform='translateX(-50%) translateY(-40px)';
    el.style.opacity='0';
  }), 3000);
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),6000);
}

function flushCityToasts(){
  if(!_pendingCityToasts.length)return;
  const msg=_pendingCityToasts.length===1
    ?_pendingCityToasts[0]
    :_pendingCityToasts.length+' new buildings';
  showCityToast(msg);
  _pendingCityToasts=[];
}

function showDailyToast(){
  showToast('🎁 Daily bonus: +6 Slice!');
}


let _tutDemoRaf=null;
let _tutOnClose=null;
function _startCrossDemo(){
  const cv=document.getElementById('tutCrossDemo');
  if(!cv)return;
  const c2=cv.getContext('2d');
  const W=90, H=90;
  const dpr=window.devicePixelRatio||1;
  cv.width=W*dpr; cv.height=H*dpr;
  cv.style.width=W+'px'; cv.style.height=H+'px';
  c2.scale(dpr,dpr);

  // Mini cube uses same face/math layout as game (FC=5, but we use 3x3 subset visually)
  // We'll render faces 0 and 1 (front and right side face)
  // Projection params for this mini canvas
  const tcx=W/2, tcy=H/2+4;
  const tScale=W*0.28;
  const CAM_D=3.5;
  function tProj(p){
    const z=p[2]+CAM_D;
    const s=tScale*CAM_D/z;
    return[tcx+p[0]*s, tcy-p[1]*s];
  }
  function tFaceUV(f,u,v){
    const{n,r:fr,u:up}=f;
    return[n[0]+u*fr[0]+v*up[0], n[1]+u*fr[1]+v*up[1], n[2]+u*fr[2]+v*up[2]];
  }
  function tCellUV(row,col,fc){
    const sz=1.7/fc, gap=0.04;
    const step=sz+gap;
    const off=-(fc-1)*step/2;
    return[off+col*step, off+(fc-1-row)*step];
  }

  // Color boards for face 0 and face 1 (3x3)
  // Match: face0 col2 row1, face1 col0 row1, face1 col1 row1 — all green (color 2)
  const FC3=3;
  const board0=[[1,0,2],[3,4,2],[0,1,3]]; // [row][col]
  const board1=[[2,3,0],[2,2,1],[4,0,3]]; // col0,col1 row1 are green
  const MATCH_COL=2; // green
  function isMatch0(r,c){return r===1&&c===2;}
  function isMatch1(r,c){return r===1&&(c===0||c===1);}

  // rotY(3π/4) puts face0(+Z) and face1(+X) both at 45° to camera — equally visible
  let tRot=m3.mul(m3.rotX(-0.28), m3.rotY(2.36));
  let angle=0;

  // Phases: idle(50) → highlight(25) → pop(15) → regrow(25)
  const PHASES=[50,25,15,25];
  const TOTAL=PHASES.reduce((a,b)=>a+b,0);
  let frame=0;
  function getPhase(f){
    let acc=0;
    for(let i=0;i<PHASES.length;i++){acc+=PHASES[i];if(f<acc)return{ph:i,t:(f-(acc-PHASES[i]))/PHASES[i]};}
    return{ph:0,t:0};
  }

  function drawFace3D(faceIdx, board, matchFn, ph, t){
    const f=FACES[faceIdx];
    const rn=m3.app(tRot,f.n);
    if(rn[2]>-0.05)return; // back-face cull

    const bright=Math.max(0.7, Math.min(1.2, -v3.dot(rn,[0.5,0.9,-0.5])*0.35+0.9));
    const h=1.0;
    const corners=[
      tFaceUV(f,-h, h), tFaceUV(f, h, h),
      tFaceUV(f, h,-h), tFaceUV(f,-h,-h),
    ].map(p=>tProj(m3.app(tRot,p)));

    // Face background
    c2.save();
    c2.beginPath();
    c2.moveTo(corners[0][0],corners[0][1]);
    corners.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));
    c2.closePath();
    c2.clip();
    c2.fillStyle=`rgba(30,24,60,${0.7*bright})`;
    c2.fill();

    // Gems
    for(let r=0;r<FC3;r++){
      for(let col=0;col<FC3;col++){
        const[u,v]=tCellUV(r,col,FC3);
        const sz=0.26;
        const pts=[
          tFaceUV(f,u-sz,v+sz), tFaceUV(f,u+sz,v+sz),
          tFaceUV(f,u+sz,v-sz), tFaceUV(f,u-sz,v-sz),
        ].map(p=>tProj(m3.app(tRot,p)));

        const match=matchFn(r,col);
        let alpha=match?1:0.55, glow=false, scaleOff=0;
        if(match){
          if(ph===1){scaleOff=t*0.18;glow=true;}
          else if(ph===2){alpha=1-t;scaleOff=0;}
          else if(ph===3){alpha=t;scaleOff=0;}
        }

        if(alpha<=0.01)continue;
        const cx2=(pts[0][0]+pts[2][0])/2, cy2=(pts[0][1]+pts[2][1])/2;
        const scaled=pts.map(p=>[cx2+(p[0]-cx2)*(1+scaleOff), cy2+(p[1]-cy2)*(1+scaleOff)]);

        c2.save();
        c2.globalAlpha=alpha;
        if(glow){c2.shadowColor=COLORS[board[r][col]];c2.shadowBlur=8*dpr;}

        // Border
        c2.beginPath();
        c2.moveTo(scaled[0][0],scaled[0][1]);
        scaled.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));
        c2.closePath();
        c2.fillStyle=shadeHex(COLORS_LO[board[r][col]], bright*0.45);
        c2.fill();

        // Inner inset
        const bv=0.06;
        const inner=[
          tFaceUV(f,u-sz+bv,v+sz-bv), tFaceUV(f,u+sz-bv,v+sz-bv),
          tFaceUV(f,u+sz-bv,v-sz+bv), tFaceUV(f,u-sz+bv,v-sz+bv),
        ].map(p=>tProj(m3.app(tRot,p)));
        const si=inner.map(p=>[cx2+(p[0]-cx2)*(1+scaleOff), cy2+(p[1]-cy2)*(1+scaleOff)]);
        c2.beginPath();
        c2.moveTo(si[0][0],si[0][1]);
        si.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));
        c2.closePath();
        c2.fillStyle=shadeHex(COLORS[board[r][col]], bright);
        c2.fill();

        // Glint
        if(match||alpha>0.5){
          const glintPts=[
            tFaceUV(f,u-sz+bv,v+sz-bv), tFaceUV(f,u-sz*0.2,v+sz-bv),
            tFaceUV(f,u-sz+bv,v+sz*0.2),
          ].map(p=>tProj(m3.app(tRot,p)));
          const sg=glintPts.map(p=>[cx2+(p[0]-cx2)*(1+scaleOff), cy2+(p[1]-cy2)*(1+scaleOff)]);
          c2.globalAlpha=alpha*0.35;
          c2.beginPath();c2.moveTo(sg[0][0],sg[0][1]);c2.lineTo(sg[1][0],sg[1][1]);c2.lineTo(sg[2][0],sg[2][1]);c2.closePath();
          c2.fillStyle='#fff';c2.fill();
        }
        c2.restore();
      }
    }
    c2.restore();
  }

  function tick(){
    _tutDemoRaf=requestAnimationFrame(tick);
    frame=(frame+1)%TOTAL;
    const{ph,t}=getPhase(frame);

    // Slow Y oscillation to hint at 3D
    angle+=0.008;
    tRot=m3.mul(m3.rotX(-0.28), m3.rotY(2.36+Math.sin(angle)*0.12));

    c2.clearRect(0,0,W,H);

    // Sort faces by depth (back to front)
    const faceOrder=[0,1,2,3,4,5].map(fi=>{
      const rn=m3.app(tRot,FACES[fi].n);
      return{fi,depth:rn[2]};
    }).sort((a,b)=>b.depth-a.depth);

    for(const{fi}of faceOrder){
      if(fi===0) drawFace3D(0,board0,isMatch0,ph,t);
      else if(fi===1) drawFace3D(1,board1,isMatch1,ph,t);
      else{
        // Draw other visible faces as plain dark panels
        const f=FACES[fi];
        const rn=m3.app(tRot,f.n);
        if(rn[2]>-0.05)continue;
        const h=1.0;
        const corners=[
          tFaceUV(f,-h,h),tFaceUV(f,h,h),tFaceUV(f,h,-h),tFaceUV(f,-h,-h),
        ].map(p=>tProj(m3.app(tRot,p)));
        c2.save();
        c2.beginPath();c2.moveTo(corners[0][0],corners[0][1]);
        corners.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));c2.closePath();
        c2.fillStyle='rgba(20,16,48,0.6)';c2.fill();
        c2.strokeStyle='rgba(255,255,255,0.08)';c2.lineWidth=0.5;c2.stroke();
        c2.restore();
      }
    }

    // Highlight pulse ring around matched gems when in highlight phase
    if((ph===1||ph===2)&&tRot){
      const alpha=ph===1?t*0.8:(1-t)*0.8;
      // draw the seam edge between face0 and face1 as a glowing line
      const f0=FACES[0],f1=FACES[1];
      const edgePts=[
        tFaceUV(f0,1,-1),tFaceUV(f0,1,1),
      ].map(p=>tProj(m3.app(tRot,p)));
      c2.save();
      c2.globalAlpha=alpha;
      c2.strokeStyle='#00eeff';
      c2.lineWidth=2.5;
      c2.shadowColor='#00eeff';
      c2.shadowBlur=6;
      c2.beginPath();c2.moveTo(edgePts[0][0],edgePts[0][1]);c2.lineTo(edgePts[1][0],edgePts[1][1]);c2.stroke();
      c2.restore();
    }
  }
  tick();
}

let _gravDemoRaf=null;

function _startGravityDemo(){
  const cv=document.getElementById('tutGravityDemo');
  if(!cv)return;
  const c2=cv.getContext('2d');
  const W=90,H=90;
  const dpr=window.devicePixelRatio||1;
  cv.width=W*dpr; cv.height=H*dpr;
  cv.style.width=W+'px'; cv.style.height=H+'px';
  c2.scale(dpr,dpr);

  const tcx=W/2, tcy=H/2+2;
  const tSc=W*0.23, CAM=3.5;
  function gProj(p){const z=p[2]+CAM,s=tSc*CAM/z;return[tcx+p[0]*s,tcy-p[1]*s];}
  function gFuv(f,u,v){const{n,r:fr,u:up}=f;return[n[0]+u*fr[0]+v*up[0],n[1]+u*fr[1]+v*up[1],n[2]+u*fr[2]+v*up[2]];}
  function gCuv(rowF,colF,fc){const sz=1.55/fc,gap=0.05,step=sz+gap,off=-(fc-1)*step/2;return[off+colF*step,off+(fc-1-rowF)*step];}
  // rotZ helper (m3 may not have it)
  function rotZ(a){const c=Math.cos(a),s=Math.sin(a);return[c,-s,0,s,c,0,0,0,1];}
  function ease(t){return t<0.5?2*t*t:-1+(4-2*t)*t;}

  const FC=4;
  // Phase 1 board: row 3 (visual bottom) = all blue
  const B0=[[0,3,2,4],[4,0,3,1],[2,4,0,3],[1,1,1,1]];
  const B0f=[[-1,-1,-1,-1],[0,3,2,4],[4,0,3,1],[2,4,0,3]];
  // Phase 2 board (after 90° CW twist): col 0 (new visual bottom) = all green
  // After rotZ(-π/2): UV col 0 (-u) maps to visual bottom
  const B1=[[2,0,3,4],[2,4,0,3],[2,3,4,0],[2,0,4,3]];
  const B1f=[[0,3,4,-1],[4,0,3,-1],[3,4,0,-1],[0,4,3,-1]]; // col 0 removed, cols 1-3 shift left

  // Phases: 0=idle1, 1=hl1, 2=elim1, 3=fall1, 4=pause1, 5=twist, 6=idle2, 7=hl2, 8=elim2, 9=fall2, 10=pause2
  const PD=[30,15,12,22,8,45,25,15,12,22,120];
  const TOT=PD.reduce((a,b)=>a+b,0);
  function phaseOf(f){let acc=0;for(let i=0;i<PD.length;i++){acc+=PD[i];if(f<acc)return{ph:i,t:(f-(acc-PD[i]))/PD[i]};}return{ph:0,t:0};}

  function drawGem(f,tRot,rowF,colF,ci,alpha,sc,glow){
    if(alpha<0.02||sc<0.02||ci<0)return;
    const[u,v]=gCuv(rowF,colF,FC);
    const sz=0.8/FC,bv=sz*0.14;
    const pts=[[-sz,sz],[sz,sz],[sz,-sz],[-sz,-sz]].map(([du,dv])=>gProj(m3.app(tRot,gFuv(f,u+du,v+dv))));
    const gx=(pts[0][0]+pts[2][0])/2,gy=(pts[0][1]+pts[2][1])/2;
    const sp=pts.map(p=>[gx+(p[0]-gx)*sc,gy+(p[1]-gy)*sc]);
    const ip=[[-sz+bv,sz-bv],[sz-bv,sz-bv],[sz-bv,-sz+bv],[-sz+bv,-sz+bv]].map(([du,dv])=>gProj(m3.app(tRot,gFuv(f,u+du,v+dv))));
    const si=ip.map(p=>[gx+(p[0]-gx)*sc,gy+(p[1]-gy)*sc]);
    c2.save();c2.globalAlpha=alpha;
    if(glow){c2.shadowColor=COLORS[ci];c2.shadowBlur=6;}
    c2.beginPath();c2.moveTo(sp[0][0],sp[0][1]);sp.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));c2.closePath();
    c2.fillStyle=COLORS_LO[ci];c2.fill();
    c2.beginPath();c2.moveTo(si[0][0],si[0][1]);si.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));c2.closePath();
    c2.fillStyle=COLORS[ci];c2.fill();
    c2.restore();
  }

  // axis: 'row'=fall toward row FC-1, 'col'=fall toward col 0
  function drawFace0(board,tRot,hlIdx,hlAxis,hlSc,hlAl,fallT,fallBoard,fallAxis){
    const f=FACES[0];
    const rn=m3.app(tRot,f.n);
    if(rn[2]>-0.03)return;
    const h=1.0;
    const cor=[gFuv(f,-h,h),gFuv(f,h,h),gFuv(f,h,-h),gFuv(f,-h,-h)].map(p=>gProj(m3.app(tRot,p)));
    c2.save();
    c2.beginPath();c2.moveTo(cor[0][0],cor[0][1]);cor.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));c2.closePath();
    c2.fillStyle='rgba(18,14,44,0.6)';c2.fill();
    c2.strokeStyle='rgba(255,255,255,0.09)';c2.lineWidth=0.5;c2.stroke();
    c2.clip();

    for(let r=0;r<FC;r++){
      for(let col=0;col<FC;col++){
        const isHL=hlAxis==='row'?r===hlIdx:col===hlIdx;
        const ci=board[r][col];
        if(ci<0)continue;
        if(fallT>0&&fallAxis==='row'){
          // rows above FC-1 fall toward FC-1
          if(r===0){drawGem(f,tRot,r,col,fallBoard[r][col],fallT*0.8,1,false);}
          else{const rowF=(r-1)+ease(fallT);drawGem(f,tRot,rowF,col,board[r-1][col],0.85,1,false);}
        } else if(fallT>0&&fallAxis==='col'){
          // cols 1..FC-1 fall toward col 0
          if(col===FC-1){drawGem(f,tRot,r,col,fallBoard[r][col],fallT*0.8,1,false);}
          else{const colF=(col+1)-ease(fallT);drawGem(f,tRot,r,colF,board[r][col+1],0.85,1,false);}
        } else {
          const sc=isHL?hlSc:1;
          const al=isHL?hlAl:0.75;
          drawGem(f,tRot,r,col,ci,al,sc,isHL&&hlSc>1);
        }
      }
    }
    c2.restore();

    // gravity arrow: row mode → below face (v=-1.2), col mode → left of face (u=-1.2)
    const au=hlAxis==='col'?-1.2:0, av=hlAxis==='col'?0:-1.2;
    const apt=gProj(m3.app(tRot,gFuv(f,au,av)));
    c2.save();c2.globalAlpha=0.7;c2.fillStyle='#ffd700';
    c2.font='bold 11px sans-serif';c2.textAlign='center';c2.textBaseline='middle';
    c2.fillText('↓',apt[0],apt[1]);c2.restore();
  }

  function drawOtherFaces(tRot){
    [0,1,2,3,4,5].map(fi=>({fi,d:m3.app(tRot,FACES[fi].n)[2]})).sort((a,b)=>b.d-a.d).forEach(({fi})=>{
      if(fi===0)return;
      const f=FACES[fi],rn=m3.app(tRot,f.n);
      if(rn[2]>-0.03)return;
      const h=1.0;
      const cor=[gFuv(f,-h,h),gFuv(f,h,h),gFuv(f,h,-h),gFuv(f,-h,-h)].map(p=>gProj(m3.app(tRot,p)));
      c2.save();c2.beginPath();c2.moveTo(cor[0][0],cor[0][1]);cor.slice(1).forEach(p=>c2.lineTo(p[0],p[1]));c2.closePath();
      c2.fillStyle='rgba(18,14,44,0.4)';c2.fill();
      c2.strokeStyle='rgba(255,255,255,0.06)';c2.lineWidth=0.5;c2.stroke();c2.restore();
    });
  }

  let frame=0;
  function tick(){
    _gravDemoRaf=requestAnimationFrame(tick);
    frame=(frame+1)%TOT;
    const{ph,t}=phaseOf(frame);
    c2.clearRect(0,0,W,H);

    // twist angle: 0 → -π/2 during phase 5, stays at -π/2 after
    const twist=ph<5?0:ph===5?-Math.PI/2*ease(t):-Math.PI/2;
    const tRot=m3.mul(m3.rotX(-0.18),m3.mul(rotZ(twist),m3.rotY(Math.PI)));

    drawOtherFaces(tRot);

    if(ph<5){
      let hlSc=1,hlAl=ph===0?0.5+Math.sin(frame*0.2)*0.5:1;
      if(ph===1){hlSc=1+t*0.13;hlAl=1;}
      else if(ph===2){hlSc=1-t;hlAl=1-t;}
      const brd=ph>=4?B0f:B0;
      const fallT=ph===3?t:0;
      drawFace0(brd,tRot,ph<3?3:-1,'row',hlSc,hlAl,fallT,B0f,'row');
    } else if(ph===5){
      // during twist show B0f, axis transitions from row to col
      const axis=t<0.5?'row':'col';
      drawFace0(B0f,tRot,-1,axis,1,0.75,0,null,axis);
    } else {
      let hlSc=1,hlAl=ph===6?0.5+Math.sin(frame*0.2)*0.5:1;
      if(ph===7){hlSc=1+t*0.13;hlAl=1;}
      else if(ph===8){hlSc=1-t;hlAl=1-t;}
      const brd=ph>=10?B1f:B1;
      const fallT=ph===9?t:0;
      drawFace0(brd,tRot,ph<8?0:-1,'col',hlSc,hlAl,fallT,B1f,'col');
    }
  }
  tick();
}

function showTutorial(onClose){
  _tutOnClose=onClose||null;
  if(_tutDemoRaf){cancelAnimationFrame(_tutDemoRaf);_tutDemoRaf=null;}
  if(_gravDemoRaf){cancelAnimationFrame(_gravDemoRaf);_gravDemoRaf=null;}
  document.getElementById('tutOv').classList.remove('hidden');
  localStorage.setItem('cb3d_tut','1');
  _taFreeze();
  _startCrossDemo();
  _startGravityDemo();
}
function closeTutorial(){
  document.getElementById('tutOv').classList.add('hidden');
  if(_tutDemoRaf){cancelAnimationFrame(_tutDemoRaf);_tutDemoRaf=null;}
  if(_gravDemoRaf){cancelAnimationFrame(_gravDemoRaf);_gravDemoRaf=null;}
  _taUnfreeze();
  const cb=_tutOnClose;_tutOnClose=null;
  if(cb)cb();
}



// ── City building ──
const CITY_STAGES=[
  {id:'cs1',        threshold:100,   name:'House'},
  {id:'cs2',        threshold:200,   name:'Café'},
  {id:'cs3',        threshold:400,   name:'Apartments'},
  {id:'cs4',        threshold:600,   name:'Park'},
  {id:'cs5',        threshold:1000,  name:'Office Tower'},
  {id:'cs6',        threshold:1500,  name:'Skyscraper'},
  {id:'cs7',        threshold:2000,  name:'Grand Tower'},
  {id:'cs_lamps',   threshold:2500,  name:'Street Lamps'},
  {id:'cs1b',       threshold:3000,  name:'House Garden'},
  {id:'cs_balloon', threshold:3500,  name:'Hot Air Balloon'},
  {id:'cs2b',       threshold:4500,  name:'Café Terrace'},
  {id:'cs_billboard',threshold:5500, name:'Neon Billboard'},
  {id:'cs3b',       threshold:6500,  name:'Rooftop Garden'},
  {id:'cs_crane',   threshold:7500,  name:'Construction Crane'},
  {id:'cs5b',       threshold:8500,  name:'Office Upgrade'},
  {id:'cs_blimp',   threshold:9500,  name:'Airship'},
  {id:'cs4b',       threshold:10500, name:'Park Fountain'},
  {id:'cs6b',       threshold:11500, name:'LED Skyscraper'},
  {id:'cs_dish',    threshold:12500, name:'Satellite Dish'},
  {id:'cs7b',        threshold:13500, name:'Observation Deck'},
  {id:'cs_aurora2',  threshold:15000, name:'Northern Lights'},
  {id:'csfin',       threshold:16500, name:'Metropolis!'},
  {id:'cs_harbor',   threshold:18000, name:'Harbor'},
  {id:'cs_stadium',  threshold:19500, name:'Stadium'},
  {id:'cs_monorail', threshold:21000, name:'Monorail'},
  {id:'cs_museum',   threshold:22500, name:'Museum'},
  {id:'cs_spire',    threshold:24000, name:'Crystal Spire'},
  {id:'cs_arcadium', threshold:25500, name:'Arcadium'},
  {id:'cs_colosseum',threshold:27000, name:'Colosseum'},
  {id:'cs_dome',     threshold:28500, name:'Futuristic Dome'},
  {id:'cs_finale2',  threshold:30000, name:'City of Stars'},
];

function updateCity(){
  const n=totalBlocksElim;
  const matsEl=document.getElementById('cityMats');
  if(matsEl)matsEl.textContent=n.toLocaleString();

  CITY_STAGES.forEach(({id,threshold,name})=>{
    const el=document.getElementById(id);
    if(!el)return;
    const unlocked=n>=threshold;
    const wasHidden=el.getAttribute('opacity')==='0';
    if(unlocked&&wasHidden){
      el.setAttribute('opacity','1');
      el.classList.add('rising');
      setTimeout(()=>el.classList.remove('rising'),800);
      if(gameRunning)_pendingCityToasts.push(name);
    } else if(unlocked){
      el.setAttribute('opacity','1');
    }
  });

  const fill=document.getElementById('cityProgressFill');
  const label=document.getElementById('cityNextLabel');
  if(!fill||!label)return;
  const next=CITY_STAGES.find(s=>n<s.threshold);
  if(next){
    const unlocked=CITY_STAGES.filter(s=>n>=s.threshold);
    const prevThreshold=unlocked.length?unlocked[unlocked.length-1].threshold:0;
    const pct=Math.min(100,Math.round((n-prevThreshold)/(next.threshold-prevThreshold)*100));
    fill.style.width=pct+'%';
    label.textContent=`→ ${next.name} in ${(next.threshold-n).toLocaleString()} blocks`;
  }else{
    fill.style.width='100%';
    label.textContent='✨ Metropolis complete!';
  }
}

// Splash screen
function showSplash(){
  gameRunning=false;animating=false;sel=null;
  cancelSlice();
  hideAll();
  document.getElementById('hud').style.display='none';
  document.getElementById('infoStrip').style.display='none';
  document.getElementById('sliceBtn').style.display='none';
  document.getElementById('backBtn').style.display='none';
  const btn=document.getElementById('playBtn');
  btn.textContent='▶ \xa0PLAY';
  btn.disabled=false;
  document.getElementById('splashOv').classList.remove('hidden');
  updateCity();
}

async function onPlay(){
  const btn=document.getElementById('playBtn');
  btn.disabled=true;

  const progress=await _progressPromise;
  if(progress){
    // 恢复昵称（重装app后从云端恢复）
    if(progress.nickname&&!getNickname())localStorage.setItem('cb3d_nickname',progress.nickname);
    // 恢复星星
    if(progress.stars)Object.entries(progress.stars).forEach(([i,s])=>localStorage.setItem('cb3d_s'+i,s));
    // 恢复每关最多剩余步数
    if(progress.bestLeft)Object.entries(progress.bestLeft).forEach(([i,v])=>localStorage.setItem('cb3d_bl'+i,v));
    // 恢复道具次数
    if(progress.tools&&progress.tools.slice!=null)sliceUses=progress.tools.slice;
    // 恢复个人最高分（取本地和云端较大值）
    if(progress.classicBest>getClassicBest())localStorage.setItem('cb3d_classic_best',progress.classicBest);
    if(progress.taBest>getTaBest())localStorage.setItem('cb3d_ta_best',progress.taBest);
    // 恢复城市建材（取本地和云端较大值）
    if(progress.blocksElim>totalBlocksElim){
      totalBlocksElim=progress.blocksElim;
      localStorage.setItem('cb3d_blocks',totalBlocksElim);
    }
  }

  // 每日奖励：localStorage 和云端双重校验，任意一个有今天日期就不发
  const today=new Date().toDateString();
  const cloudSliceDay=progress&&progress.sliceDay;
  const localSliceDay=localStorage.getItem('cb3d_sliceday');
  if(cloudSliceDay!==today&&localSliceDay!==today){
    sliceUses+=6;
    localStorage.setItem('cb3d_sliceday',today);
    window._dailySliceBonus=true;
    saveProgress('tools',{slice:sliceUses});saveProgress('sliceDay',today);
  }

  document.getElementById('splashOv').classList.add('hidden');
  updateSliceBtn();

  const isNewUser = !localStorage.getItem('cb3d_tut');

  function afterNick(){
    if(isNewUser){
      // 新用户：先看教程，关闭后跳 mode select
      showTutorial(()=>showModeSelect());
    } else {
      showModeSelect();
    }
  }

  if(!getNickname()){
    showNickSetup(afterNick);
  } else {
    afterNick();
  }
}

// ── Leaderboard overlay ──
let _lbTab='classic';

async function showLeaderboard(){
  hideAll();
  document.getElementById('splashOv').classList.add('hidden');
  document.getElementById('hud').style.display='none';
  document.getElementById('infoStrip').style.display='none';
  document.getElementById('sliceBtn').style.display='none';
  document.getElementById('backBtn').style.display='none';
  document.getElementById('lbOv').classList.remove('hidden');
  await initFirebase();
  await loadLbTab('classic');
}

function hideLeaderboard(){
  document.getElementById('lbOv').classList.add('hidden');
  document.getElementById('splashOv').classList.remove('hidden');
}

// ── Settings ──
function _getSetting(key,def){const v=localStorage.getItem(key);return v===null?def:v==='1';}
function showSettings(){
  document.getElementById('splashOv').classList.add('hidden');
  document.getElementById('settingSound').checked=_getSetting('cb3d_sound',true);
  document.getElementById('settingVibration').checked=_getSetting('cb3d_vibration',true);
  document.getElementById('settingsOv').classList.remove('hidden');
}
function hideSettings(){
  document.getElementById('settingsOv').classList.add('hidden');
  document.getElementById('splashOv').classList.remove('hidden');
}
function onSettingSound(v){
  localStorage.setItem('cb3d_sound',v?'1':'0');
}
function onSettingVibration(v){
  localStorage.setItem('cb3d_vibration',v?'1':'0');
}
function onResetProgress(){
  if(!confirm('Reset all progress? This cannot be undone.'))return;
  const keep=['cb3d_sound','cb3d_vibration','cb3d_tut','cb3d_did','cb3d_nickname'];
  Object.keys(localStorage).filter(k=>k.startsWith('cb3d_')&&!keep.includes(k)).forEach(k=>localStorage.removeItem(k));
  showToast('Progress reset.');
}
function vibrate(pattern){
  if(!_getSetting('cb3d_vibration',true))return;
  if(window.AndroidVibrate){window.AndroidVibrate.vibrate(JSON.stringify(pattern));}
  else if(navigator.vibrate){navigator.vibrate(pattern);}
}

async function switchLbTab(tab){
  _lbTab=tab;
  document.getElementById('lbTabClassic').classList.toggle('active',tab==='classic');
  document.getElementById('lbTabTimed').classList.toggle('active',tab==='timed');
  await loadLbTab(tab);
}

async function loadLbTab(tab){
  const el=document.getElementById('lbMain');
  el.innerHTML='<div class="lb-loading">Loading...</div>';
  const rows=await fetchLeaderboard(tab);
  renderLeaderboard('lbMain',rows,localStorage.getItem('cb3d_nickname'));
}

function confirmExitGame(){
  const ov=document.getElementById('exitConfirmOv');
  ov.style.display='flex';
}
function hideExitConfirm(){
  document.getElementById('exitConfirmOv').style.display='none';
}
function doExitGame(){
  hideExitConfirm();
  showModeSelect();
}

function showModeSelect(){
  gameRunning=false;animating=false;sel=null;
  cancelSlice();
  hideAll();
  document.getElementById('hud').style.display='none';
  document.getElementById('infoStrip').style.display='none';
  document.getElementById('sliceBtn').style.display='none';
  document.getElementById('backBtn').style.display='none';
  document.getElementById('modeOv').classList.remove('hidden');
  if(window._dailySliceBonus){
    window._dailySliceBonus=false;
    setTimeout(showDailyToast,400);
  }
}

function selectMode(mode){
  window._gameMode=mode;
  if(mode==='classic'){
    startClassicGame();
  } else {
    startTimedGame();
  }
}

// ── Classic (fixed moves, no goal) ──
const CLASSIC_MOVES=20;

function startClassicGame(){
  window._gameMode='classic';
  level=0; score=0; moves=CLASSIC_MOVES;
  rot=m3.mul(m3.rotX(-0.42),m3.mul(m3.rotY(0.55),m3.id()));
  faceGravity=FACES.map(()=>({axis:'row',dir:1}));
  hideAll();
  document.getElementById('splashOv').classList.add('hidden');
  createBoard();
  gameRunning=true; animating=false; sel=null; particles=[]; shakeAmt=0;

  document.getElementById('hud').style.display='';
  document.getElementById('infoStrip').style.display='';
  document.getElementById('backBtn').style.display='';
  document.getElementById('sliceBtn').style.display='';
  document.getElementById('starHb').style.display='none';
  document.getElementById('timerPill').style.display='none';
  document.getElementById('me').style.display='';
  document.getElementById('modeLabel').textContent='Moves Left';
  document.getElementById('le').textContent='🏆';
  document.getElementById('beLabel').textContent='Best';
  document.getElementById('be').textContent=getClassicBest().toLocaleString()||'0';
  cancelSlice(); updateSliceBtn(); updateHUD(); resize();
}

function getClassicBest(){return+localStorage.getItem('cb3d_classic_best')||0;}

async function endClassicGame(){
  gameRunning=false;
  const best=Math.max(score,getClassicBest());
  localStorage.setItem('cb3d_classic_best',best);
  const finalScore=score;
  saveProgress('blocksElim',totalBlocksElim);
  saveProgress('classicBest',best);
  await submitScore('classic',finalScore);
  document.getElementById('classicScore').textContent=finalScore.toLocaleString();
  document.getElementById('classicBest').textContent=best.toLocaleString();
  document.getElementById('classicLb').innerHTML='<div class="lb-loading">Loading...</div>';
  setTimeout(()=>{document.getElementById('classicOv').classList.remove('hidden');flushCityToasts();},400);
  const rows=await fetchLeaderboard('classic');
  renderLeaderboard('classicLb',rows,localStorage.getItem('cb3d_nickname'));
  _incrementGamesPlayed();
  if(_shouldShowBindPrompt()) setTimeout(showBindPrompt, 1800);
}

// ── Time Attack ──
let _taTimer=null;
let _taRemaining=0;
let _taPausedAt=null; // Date.now() when paused, null when running
const TA_DURATION=60; // seconds

function _taFreeze(){
  if(window._gameMode!=='timed'||_taPausedAt!==null)return;
  _taPausedAt=Date.now();
  document.getElementById('timerPill').classList.add('frozen');
}
function _taUnfreeze(){
  if(window._gameMode!=='timed'||_taPausedAt===null)return;
  _taPausedAt=null;
  document.getElementById('timerPill').classList.remove('frozen');
  if(_taRemaining<=0){clearInterval(_taTimer);endTimedGame();}
}

function startTimedGame(){
  window._gameMode='timed';
  level=0; score=0;
  rot=m3.mul(m3.rotX(-0.42),m3.mul(m3.rotY(0.55),m3.id()));
  faceGravity=FACES.map(()=>({axis:'row',dir:1}));
  hideAll();
  document.getElementById('splashOv').classList.add('hidden');
  createBoard();
  gameRunning=true; animating=false; sel=null; particles=[]; shakeAmt=0;

  // HUD
  document.getElementById('hud').style.display='';
  document.getElementById('infoStrip').style.display='';
  document.getElementById('backBtn').style.display='';
  document.getElementById('sliceBtn').style.display='';
  document.getElementById('starHb').style.display='none';
  document.getElementById('me').style.display='none';
  document.getElementById('timerPill').style.display='';
  document.getElementById('timerPill').classList.remove('urgent');
  document.getElementById('modeLabel').textContent='Time Left';
  document.getElementById('le').textContent='⏱';
  document.getElementById('se').textContent='0';
  document.getElementById('beLabel').textContent='Highest';
  document.getElementById('be').textContent=getTaBest().toLocaleString()||'0';
  document.getElementById('be').style.color='';
  cancelSlice(); updateSliceBtn(); resize();

  // start countdown
  clearInterval(_taTimer);
  _taRemaining=TA_DURATION;
  _taPausedAt=null;
  updateTimerDisplay(Math.ceil(_taRemaining));
  _taTimer=setInterval(()=>{
    if(_taPausedAt!==null)return; // frozen — skip tick
    _taRemaining=Math.max(0,_taRemaining-1);
    updateTimerDisplay(Math.ceil(_taRemaining));
    if(_taRemaining<=10)document.getElementById('timerPill').classList.add('urgent');
    if(_taRemaining<=0){clearInterval(_taTimer);endTimedGame();}
  },1000);
}

function updateTimerDisplay(sec){
  const m=Math.floor(sec/60), s=sec%60;
  document.getElementById('timerPill').textContent=m+':'+(s<10?'0':'')+s;
}

function getTaBest(){return+localStorage.getItem('cb3d_ta_best')||0;}

async function endTimedGame(){
  gameRunning=false;
  clearInterval(_taTimer);
  _taPausedAt=null;
  document.getElementById('timerPill').classList.remove('frozen','urgent');
  const best=Math.max(score,getTaBest());
  localStorage.setItem('cb3d_ta_best',best);
  document.getElementById('timerPill').textContent='0:00';
  const finalScore=score;
  saveProgress('blocksElim',totalBlocksElim);
  saveProgress('taBest',best);
  await submitScore('timed',finalScore);
  document.getElementById('taScore').textContent=finalScore.toLocaleString();
  document.getElementById('taBest').textContent=best.toLocaleString();
  document.getElementById('taLb').innerHTML='<div class="lb-loading">Loading...</div>';
  setTimeout(()=>{document.getElementById('taOv').classList.remove('hidden');flushCityToasts();},400);
  const rows=await fetchLeaderboard('timed');
  renderLeaderboard('taLb',rows,localStorage.getItem('cb3d_nickname'));
  _incrementGamesPlayed();
  if(_shouldShowBindPrompt()) setTimeout(showBindPrompt, 1800);
}

// Freeze timer when app goes to background, resume when returning
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){_taFreeze();}else{_taUnfreeze();}
});
// Capacitor app state (Android home button / task switcher)
if(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App){
  window.Capacitor.Plugins.App.addListener('appStateChange',({isActive})=>{
    if(!isActive){_taFreeze();}else{_taUnfreeze();}
  });
}

// Boot — 只渲染画布，显示启动页
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  resize();
  rot=m3.mul(m3.rotX(-0.38),m3.mul(m3.rotY(0.5),m3.id()));
  draw();
}));
// 页面加载时提前初始化，点击 Play 时直接 await 已完成的 Promise
let _progressPromise = initFirebase().then(() => loadProgress());
