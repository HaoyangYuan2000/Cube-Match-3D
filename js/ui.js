'use strict';

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
  ['modeOv','taOv','classicOv'].forEach(id=>document.getElementById(id).classList.add('hidden'));
}

function updateSliceBtn(){
  const lbl=document.getElementById('sliceLabel');
  if(lbl)lbl.textContent='Slice ×'+sliceUses;
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


function showTutorial(){
  document.getElementById('tutOv').classList.remove('hidden');
  markTutorialDone();
}


function closeAd(){}
function watchAdBonus(){}
function watchAdContinue(){}

// ── City building ──
const CITY_STAGES=[
  {id:'cs1',        threshold:1000,  name:'House'},
  {id:'cs2',        threshold:2000,  name:'Café'},
  {id:'cs3',        threshold:3000,  name:'Apartments'},
  {id:'cs4',        threshold:4000,  name:'Park'},
  {id:'cs5',        threshold:5000,  name:'Office Tower'},
  {id:'cs6',        threshold:6000,  name:'Skyscraper'},
  {id:'cs7',        threshold:7000,  name:'Grand Tower'},
  {id:'cs_lamps',   threshold:8000,  name:'Street Lamps'},
  {id:'cs1b',       threshold:9000,  name:'House Garden'},
  {id:'cs_balloon', threshold:10000, name:'Hot Air Balloon'},
  {id:'cs2b',       threshold:11000, name:'Café Terrace'},
  {id:'cs_billboard',threshold:12000,name:'Neon Billboard'},
  {id:'cs3b',       threshold:13000, name:'Rooftop Garden'},
  {id:'cs_crane',   threshold:14000, name:'Construction Crane'},
  {id:'cs5b',       threshold:15000, name:'Office Upgrade'},
  {id:'cs_blimp',   threshold:16000, name:'Airship'},
  {id:'cs4b',       threshold:17000, name:'Park Fountain'},
  {id:'cs6b',       threshold:18000, name:'LED Skyscraper'},
  {id:'cs_dish',    threshold:19000, name:'Satellite Dish'},
  {id:'cs7b',       threshold:20000, name:'Observation Deck'},
  {id:'cs_aurora2', threshold:21000, name:'Northern Lights'},
  {id:'csfin',      threshold:22000, name:'Metropolis!'},
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
  showModeSelect();
  updateSliceBtn();
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
  document.getElementById('le').textContent='🏆';
  document.getElementById('beLabel').textContent='Best';
  document.getElementById('be').textContent=getClassicBest().toLocaleString()||'0';
  cancelSlice(); updateSliceBtn(); updateHUD(); resize();
}

function getClassicBest(){return+localStorage.getItem('cb3d_classic_best')||0;}

function endClassicGame(){
  gameRunning=false;
  const best=Math.max(score,getClassicBest());
  localStorage.setItem('cb3d_classic_best',best);
  document.getElementById('classicScore').textContent=score.toLocaleString();
  document.getElementById('classicBest').textContent=best.toLocaleString();
  setTimeout(()=>document.getElementById('classicOv').classList.remove('hidden'),400);
}

// ── Time Attack ──
let _taTimer=null;
const TA_DURATION=120; // seconds

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
  document.getElementById('le').textContent='⏱';
  document.getElementById('se').textContent='0';
  document.getElementById('beLabel').textContent='Highest';
  document.getElementById('be').textContent=getTaBest().toLocaleString()||'0';
  document.getElementById('be').style.color='';
  cancelSlice(); updateSliceBtn(); resize();

  // start countdown
  clearInterval(_taTimer);
  let remaining=TA_DURATION;
  updateTimerDisplay(remaining);
  _taTimer=setInterval(()=>{
    remaining--;
    updateTimerDisplay(remaining);
    if(remaining<=10)document.getElementById('timerPill').classList.add('urgent');
    if(remaining<=0){clearInterval(_taTimer);endTimedGame();}
  },1000);
}

function updateTimerDisplay(sec){
  const m=Math.floor(sec/60), s=sec%60;
  document.getElementById('timerPill').textContent=m+':'+(s<10?'0':'')+s;
}

function getTaBest(){return+localStorage.getItem('cb3d_ta_best')||0;}

function endTimedGame(){
  gameRunning=false;
  clearInterval(_taTimer);
  const best=Math.max(score,getTaBest());
  localStorage.setItem('cb3d_ta_best',best);
  document.getElementById('me').style.display='';
  document.getElementById('timerPill').style.display='none';
  document.getElementById('taScore').textContent=score.toLocaleString();
  document.getElementById('taBest').textContent=best.toLocaleString();
  setTimeout(()=>document.getElementById('taOv').classList.remove('hidden'),400);
}

// Boot — 只渲染画布，显示启动页
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  resize();
  rot=m3.mul(m3.rotX(-0.38),m3.mul(m3.rotY(0.5),m3.id()));
  draw();
}));
