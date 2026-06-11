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
      if(progress.tools&&progress.tools.slice!=null){sliceUses=progress.tools.slice;updateSliceBtn();}
      if(progress.blocksElim>totalBlocksElim){
        totalBlocksElim=progress.blocksElim;
        localStorage.setItem('cb3d_blocks',totalBlocksElim);
      }
    }
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


function showCityToast(name){
  const wrap=document.getElementById('cw');
  if(!wrap)return;
  const el=document.createElement('div');
  el.textContent='🏙️ New '+name+' Built! Check home screen';
  el.style.cssText='position:absolute;top:18%;left:50%;transform:translateX(-50%) translateY(0);font-size:13px;white-space:nowrap;z-index:60;color:#ffe066;background:rgba(20,16,48,.85);padding:6px 16px;border-radius:99px;border:1px solid rgba(255,224,102,.3);pointer-events:none;transition:transform 3s ease-out,opacity 3s ease-out';
  setTimeout(()=>requestAnimationFrame(()=>{
    el.style.transform='translateX(-50%) translateY(-40px)';
    el.style.opacity='0';
  }), 3000);
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),6000);
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

  CITY_STAGES.forEach(({id,threshold})=>{
    const el=document.getElementById(id);
    if(!el)return;
    const unlocked=n>=threshold;
    const wasHidden=el.getAttribute('opacity')==='0';
    if(unlocked&&wasHidden){
      el.setAttribute('opacity','1');
      el.classList.add('rising');
      setTimeout(()=>el.classList.remove('rising'),800);
      if(gameRunning)showCityToast(name);
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
  btn.textContent='▶ \xa0Loading…';
  btn.disabled=true;

  await initFirebase();
  const progress=await loadProgress();
  if(progress){
    // 恢复昵称（重装app后从云端恢复）
    if(progress.nickname&&!getNickname())localStorage.setItem('cb3d_nickname',progress.nickname);
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
  updateSliceBtn();

  // 首次进入要求设置昵称
  if(!getNickname()){
    showNickSetup(()=>showModeSelect());
  } else {
    showModeSelect();
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
  if(window._showTutorial){window._showTutorial=false;setTimeout(showTutorial,300);}
}

function getClassicBest(){return+localStorage.getItem('cb3d_classic_best')||0;}

async function endClassicGame(){
  gameRunning=false;
  const best=Math.max(score,getClassicBest());
  localStorage.setItem('cb3d_classic_best',best);
  const finalScore=score;
  saveProgress('blocksElim',totalBlocksElim);
  await submitScore('classic',finalScore);
  document.getElementById('classicScore').textContent=finalScore.toLocaleString();
  document.getElementById('classicBest').textContent=best.toLocaleString();
  document.getElementById('classicLb').innerHTML='<div class="lb-loading">Loading...</div>';
  setTimeout(()=>document.getElementById('classicOv').classList.remove('hidden'),400);
  const rows=await fetchLeaderboard('classic');
  renderLeaderboard('classicLb',rows,localStorage.getItem('cb3d_nickname'));
  _incrementGamesPlayed();
  if(_shouldShowBindPrompt()) setTimeout(showBindPrompt, 1800);
}

// ── Time Attack ──
let _taTimer=null;
const TA_DURATION=60; // seconds

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
  if(window._showTutorial){window._showTutorial=false;setTimeout(showTutorial,300);}

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

async function endTimedGame(){
  gameRunning=false;
  clearInterval(_taTimer);
  const best=Math.max(score,getTaBest());
  localStorage.setItem('cb3d_ta_best',best);
  document.getElementById('me').style.display='';
  document.getElementById('timerPill').style.display='none';
  const finalScore=score;
  saveProgress('blocksElim',totalBlocksElim);
  await submitScore('timed',finalScore);
  document.getElementById('taScore').textContent=finalScore.toLocaleString();
  document.getElementById('taBest').textContent=best.toLocaleString();
  document.getElementById('taLb').innerHTML='<div class="lb-loading">Loading...</div>';
  setTimeout(()=>document.getElementById('taOv').classList.remove('hidden'),400);
  const rows=await fetchLeaderboard('timed');
  renderLeaderboard('taLb',rows,localStorage.getItem('cb3d_nickname'));
  _incrementGamesPlayed();
  if(_shouldShowBindPrompt()) setTimeout(showBindPrompt, 1800);
}

// Boot — 只渲染画布，显示启动页
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  resize();
  rot=m3.mul(m3.rotX(-0.38),m3.mul(m3.rotY(0.5),m3.id()));
  draw();
}));
initFirebase();
