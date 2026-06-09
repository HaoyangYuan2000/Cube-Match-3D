'use strict';

function getStars(li){return +localStorage.getItem('cb3d_s'+li)||0;}
function getBestLeft(li){return +localStorage.getItem('cb3d_bl'+li)||0;}
function saveStars(li,s){if(s>getStars(li))localStorage.setItem('cb3d_s'+li,s);}
function saveBestLeft(li,m){if(m>getBestLeft(li))localStorage.setItem('cb3d_bl'+li,m);}
function isUnlocked(li){return li===0||getStars(li-1)>0;}

function calcStars(){
  const total=cfg().moves;
  if(moves>=Math.ceil(total*0.45))return 3;
  if(moves>=Math.ceil(total*0.20))return 2;
  return 1;
}

function updateStarDisplay(){
  const n=calcStars();
  for(let i=1;i<=3;i++){
    const el=document.getElementById('s'+i);
    el.style.opacity=i<=n?'1':'0.2';
    el.style.textShadow=i<=n?'0 0 8px rgba(255,215,0,0.7)':'none';
  }
}

function updateHUD(){
  document.getElementById('se').textContent=score.toLocaleString();
  document.getElementById('me').textContent=moves;
  document.getElementById('be').textContent=getBestLeft(level)||'-';
  if(gameRunning)updateStarDisplay();
}

function checkEnd(){
  const{goal}=cfg();
  if(score>=goal){showWin();return;}
  if(moves<=0){showOver();return;}
}

function hideAll(){
  ['menuOv','rulesOv','winOv','ovOv'].forEach(id=>document.getElementById(id).classList.add('hidden'));
}

function showWin(){
  gameRunning=false;
  const stars=calcStars();
  saveStars(level,stars);
  saveBestLeft(level,moves);
  saveAllProgress();
  document.getElementById('wsc').textContent=moves+' moves left';
  document.getElementById('wst').textContent='★'.repeat(stars)+'<span style="opacity:.2">★</span>'.repeat(3-stars);
  const nextBtn=document.querySelector('#winOv .btn-p');
  nextBtn.style.display=level<LEVELS.length-1?'':'none';
  setTimeout(()=>document.getElementById('winOv').classList.remove('hidden'),500);
}

function showOver(){
  gameRunning=false;
  document.getElementById('fsc').textContent=score.toLocaleString();
  setTimeout(()=>document.getElementById('ovOv').classList.remove('hidden'),500);
}

function showMenu(){
  gameRunning=false;animating=false;sel=null;
  document.getElementById('backBtn').style.display='none';
  document.getElementById('toolBar').style.display='none';
  document.getElementById('hud').style.display='none';
  document.getElementById('infoStrip').style.display='none';
  cancelSlice();
  hideAll();
  buildLevelMenu();
  document.getElementById('menuOv').classList.remove('hidden');
}

function buildLevelMenu(){
  const grid=document.getElementById('levelGrid');
  grid.innerHTML='';
  LEVELS.forEach((lv,i)=>{
    const stars=getStars(i);
    const unlocked=isUnlocked(i);
    const done=stars>0;
    const card=document.createElement('div');
    card.className='lv-card'+(done?' done':'')+(unlocked?'':' locked');
    const diffDots='<span style="color:var(--accent);font-size:10px">'+'●'.repeat(lv.colors-3)+'</span>';
    card.innerHTML=`
      <div class="lv-tag">Level</div>
      <div class="lv-num">${i+1}</div>
      <div class="lv-stars">${'⭐'.repeat(stars)}${'<span style="opacity:.25">⭐</span>'.repeat(3-stars)}</div>
      <div class="lv-goal">Goal ${lv.goal}</div>
      <div class="lv-info">${lv.moves} moves · ${diffDots}${'●'.repeat(Math.max(0,4-lv.colors)).replace(/●/g,'<span style="opacity:.2">●</span>')}</div>
      ${unlocked?'':'<div style="font-size:18px;margin-top:4px">🔒</div>'}
    `;
    if(unlocked)card.onclick=()=>startLevel(i);
    grid.appendChild(card);
  });
}

function startLevel(i){
  level=i;score=0;
  const lv=LEVELS[Math.min(i,LEVELS.length-1)];
  const total=lv.moves;
  const th3=Math.ceil(total*0.45);
  const th2=Math.ceil(total*0.20);
  document.getElementById('rulesTitle').textContent=`Level ${i+1}`;
  document.getElementById('rulesMeta').innerHTML=
    `<span style="color:var(--gold);font-weight:700">Goal ${lv.goal.toLocaleString()}</span>`+
    `<span style="color:var(--muted)">·</span>`+
    `<span>${total} moves</span>`+
    `<span style="color:var(--muted)">·</span>`+
    `<span>${lv.colors} colors</span>`;
  document.getElementById('rulesStars').innerHTML=
    `<div style="display:flex;align-items:center;gap:10px">
       <span style="color:var(--gold);font-size:16px;letter-spacing:2px;min-width:52px">★★★</span>
       <span style="color:var(--text)">Finish with <b>≥ ${th3}</b> moves left</span>
     </div>
     <div style="display:flex;align-items:center;gap:10px">
       <span style="font-size:16px;letter-spacing:2px;min-width:52px"><span style="color:var(--gold)">★★</span><span style="color:var(--muted);opacity:.35">★</span></span>
       <span style="color:var(--text)">Finish with <b>≥ ${th2}</b> moves left</span>
     </div>
     <div style="display:flex;align-items:center;gap:10px">
       <span style="font-size:16px;letter-spacing:2px;min-width:52px"><span style="color:var(--gold)">★</span><span style="color:var(--muted);opacity:.35">★★</span></span>
       <span style="color:var(--text)">Just complete the level</span>
     </div>`;
  hideAll();
  document.getElementById('rulesOv').classList.remove('hidden');
}

function beginPlay(){initLevel();}
function retryLevel(){score=0;initLevel();}
function nextLevel(){
  level++;score=0;
  if(level>=LEVELS.length){showMenu();return;}
  if(level%3===0){adPending=initLevel;showInterstitial();}
  else initLevel();
}

function initLevel(){
  const{moves:m}=cfg();
  moves=m;
  rot=m3.mul(m3.rotX(-0.42),m3.mul(m3.rotY(0.55),m3.id()));
  faceGravity=FACES.map(()=>({axis:'row',dir:1}));
  hideAll();createBoard();
  gameRunning=true;animating=false;sel=null;particles=[];shakeAmt=0;
  document.getElementById('le').textContent=level+1;
  document.getElementById('hud').style.display='';
  document.getElementById('infoStrip').style.display='';
  document.getElementById('backBtn').style.display='';
  document.getElementById('starHb').style.display='';
  document.getElementById('toolBar').style.display='';
  cancelSlice();
  updateHUD();
  resize();
}

function showInterstitial(){
  if(adPending){adPending();adPending=null;}
}
function closeAd(){}
function watchAdBonus(){}
function watchAdContinue(){}

// Splash screen
function showSplash(){
  gameRunning=false;animating=false;sel=null;
  cancelSlice();
  hideAll();
  document.getElementById('menuOv').classList.add('hidden');
  document.getElementById('hud').style.display='none';
  document.getElementById('infoStrip').style.display='none';
  document.getElementById('toolBar').style.display='none';
  document.getElementById('backBtn').style.display='none';
  const btn=document.getElementById('playBtn');
  btn.textContent='▶ \xa0PLAY';
  btn.disabled=false;
  document.getElementById('splashOv').classList.remove('hidden');
}

async function onPlay(){
  const btn=document.getElementById('playBtn');
  btn.textContent='Loading...';
  btn.disabled=true;

  await initFirebase();
  const progress=await loadProgress();
  if(progress){
    // 恢复星星
    if(progress.stars)Object.entries(progress.stars).forEach(([i,s])=>localStorage.setItem('cb3d_s'+i,s));
    // 恢复每关最多剩余步数
    if(progress.bestLeft)Object.entries(progress.bestLeft).forEach(([i,v])=>localStorage.setItem('cb3d_bl'+i,v));
    // 恢复道具次数
    if(progress.tools&&progress.tools.slice!=null)sliceUses=progress.tools.slice;
  }

  document.getElementById('splashOv').classList.add('hidden');
  showMenu();
}

// Boot — 只渲染画布，显示启动页
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  resize();
  rot=m3.mul(m3.rotX(-0.38),m3.mul(m3.rotY(0.5),m3.id()));
  draw();
}));
