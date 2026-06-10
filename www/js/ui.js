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

function updateSliceBtn(){
  const lbl=document.getElementById('sliceLabel');
  if(lbl)lbl.textContent='Slice ×'+sliceUses;
}

function showWin(){
  gameRunning=false;
  const stars=calcStars();
  sliceUses++;                    // 通关奖励 +1
  saveStars(level,stars);
  saveBestLeft(level,moves);
  saveAllProgress();              // 含最新 sliceUses
  updateSliceBtn();
  document.getElementById('wsc').textContent=moves+' moves left';
  document.getElementById('wst').innerHTML='★'.repeat(stars)+'<span style="opacity:.2">★</span>'.repeat(3-stars);
  const nextBtn=document.querySelector('#winOv .btn-p');
  nextBtn.style.display=level<LEVELS.length-1?'':'none';
  setTimeout(()=>document.getElementById('winOv').classList.remove('hidden'),500);
}

function showOver(){
  gameRunning=false;
  document.getElementById('fsc').textContent=score.toLocaleString();
  setTimeout(()=>document.getElementById('ovOv').classList.remove('hidden'),500);
}

function showDailyToast(){
  const wrap=document.getElementById('cw');
  if(!wrap)return;
  const el=document.createElement('div');
  el.className='float-txt';
  el.textContent='🎁 Daily bonus: +6 Slice!';
  el.style.cssText='left:50%;top:40%;transform:translateX(-50%);font-size:14px;white-space:nowrap;z-index:60;color:#ffdd44';
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),2000);
}

function showMenu(){
  gameRunning=false;animating=false;sel=null;
  document.getElementById('backBtn').style.display='none';
  document.getElementById('sliceBtn').style.display='none';
  document.getElementById('hud').style.display='none';
  document.getElementById('infoStrip').style.display='none';
  cancelSlice();
  hideAll();
  buildLevelMenu();
  document.getElementById('menuOv').classList.remove('hidden');
  if(window._dailySliceBonus){
    window._dailySliceBonus=false;
    setTimeout(showDailyToast,400);
  }
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

function showTutorial(){
  document.getElementById('tutOv').classList.remove('hidden');
  markTutorialDone();
}

function beginPlay(){
  initLevel();
  if(window._showTutorial){
    window._showTutorial=false;
    setTimeout(showTutorial, 600);
  }
}
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
  document.getElementById('sliceBtn').style.display='';
  cancelSlice();
  updateSliceBtn();
  updateHUD();
  resize();
}

function showInterstitial(){
  if(adPending){adPending();adPending=null;}
}
function closeAd(){}
function watchAdBonus(){}
function watchAdContinue(){}

// ── City building ──
const CITY_STAGES=[
  // Early build-up (irregular spacing)
  {id:'cs1',      threshold:30,   name:'House'},
  {id:'cs2',      threshold:100,  name:'Café'},
  {id:'cs3',      threshold:250,  name:'Apartments'},
  {id:'cs4',      threshold:500,  name:'Park'},
  {id:'cs5',      threshold:700,  name:'Office Tower'},
  {id:'cs6',      threshold:1200, name:'Skyscraper'},
  {id:'cs7',      threshold:2500, name:'Grand Tower'},
  // Every 500 from 2500
  {id:'cs_lamps', threshold:3000, name:'Street Lamps'},
  {id:'cs1b',     threshold:3500, name:'House Garden'},
  {id:'cs_balloon',threshold:4000,name:'Hot Air Balloon'},
  {id:'cs2b',     threshold:4500, name:'Café Terrace'},
  {id:'cs_billboard',threshold:5000,name:'Neon Billboard'},
  {id:'cs3b',     threshold:5500, name:'Rooftop Garden'},
  {id:'cs_crane', threshold:6000, name:'Construction Crane'},
  {id:'cs5b',     threshold:6500, name:'Office Upgrade'},
  {id:'cs_blimp', threshold:7000, name:'Airship'},
  {id:'cs4b',     threshold:7500, name:'Park Fountain'},
  {id:'cs6b',     threshold:8000, name:'LED Skyscraper'},
  {id:'cs_dish',  threshold:8500, name:'Satellite Dish'},
  {id:'cs7b',     threshold:9000, name:'Observation Deck'},
  {id:'cs_aurora2',threshold:9500,name:'Northern Lights'},
  {id:'csfin',    threshold:10000,name:'Metropolis!'},
];

function updateCity(){
  const n=totalBlocksElim;
  const matsEl=document.getElementById('cityMats');
  if(matsEl)matsEl.textContent=n.toLocaleString();

  CITY_STAGES.forEach(({id,threshold})=>{
    const el=document.getElementById(id);
    if(!el)return;
    const unlocked=n>=threshold;
    const wasHidden=el.getAttribute('opacity')==='0';
    if(unlocked&&wasHidden){
      el.setAttribute('opacity','1');
      el.classList.add('rising');
      setTimeout(()=>el.classList.remove('rising'),800);
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
  document.getElementById('menuOv').classList.add('hidden');
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
    // 恢复城市建材（取本地和云端较大值）
    if(progress.blocksElim>totalBlocksElim){
      totalBlocksElim=progress.blocksElim;
      localStorage.setItem('cb3d_blocks',totalBlocksElim);
    }
  }

  // 每日奖励：每天送 6 次 slice
  const today=new Date().toDateString();
  const lastDay=localStorage.getItem('cb3d_sliceday');
  if(lastDay!==today){
    sliceUses+=6;
    localStorage.setItem('cb3d_sliceday',today);
    window._dailySliceBonus=true;
    saveProgress('tools',{slice:sliceUses}); // 立即同步
  }

  // 用 Firebase 存档决定是否展示教程
  window._showTutorial = !progress?.tutorialDone;

  document.getElementById('splashOv').classList.add('hidden');
  showMenu();
  updateSliceBtn();
}

// Boot — 只渲染画布，显示启动页
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  resize();
  rot=m3.mul(m3.rotX(-0.38),m3.mul(m3.rotY(0.5),m3.id()));
  draw();
}));
