'use strict';

function cfg(){return LEVELS[Math.min(level,LEVELS.length-1)];}
function nC(){return COLORS.length;}

function safeColor(fi,r,c){
  const forbidden=new Set();
  const u1=gems[fi]?.[r-1]?.[c]?.color, u2=gems[fi]?.[r-2]?.[c]?.color;
  const d1=gems[fi]?.[r+1]?.[c]?.color, d2=gems[fi]?.[r+2]?.[c]?.color;
  const l1=gems[fi]?.[r]?.[c-1]?.color, l2=gems[fi]?.[r]?.[c-2]?.color;
  const r1=gems[fi]?.[r]?.[c+1]?.color, r2=gems[fi]?.[r]?.[c+2]?.color;
  if(u1!==undefined&&u1===u2)forbidden.add(u1);
  if(d1!==undefined&&d1===d2)forbidden.add(d1);
  if(u1!==undefined&&u1===d1)forbidden.add(u1);
  if(l1!==undefined&&l1===l2)forbidden.add(l1);
  if(r1!==undefined&&r1===r2)forbidden.add(r1);
  if(l1!==undefined&&l1===r1)forbidden.add(l1);
  let t,tries=0;
  do{t=Math.floor(Math.random()*nC());tries++;}while(forbidden.has(t)&&tries<20);
  return t;
}

function mkGem(color){return{color,scale:1,alpha:1,dy:0};}

function createBoard(){
  gems=Array.from({length:6},(_,fi)=>
    Array.from({length:FC},(_,r)=>
      Array.from({length:FC},(_,c)=>mkGem(safeColor(fi,r,c)))
    )
  );
  for(let pass=0;pass<20;pass++){
    const all=findAllMatches();
    if(!all.length)break;
    all.forEach(([fi,r,c])=>{gems[fi][r][c]=mkGem(safeColor(fi,r,c));});
  }
}

// ── Match finding ──

function findMatchesOnFace(fi){
  const marked=new Set();
  const f=gems[fi];
  for(let r=0;r<FC;r++){
    let run=1;
    for(let c=1;c<=FC;c++){
      const same=c<FC&&f[r][c]?.color===f[r][c-1]?.color;
      if(same)run++;
      else{if(run>=3)for(let k=c-run;k<c;k++)marked.add(`${r},${k}`);run=1;}
    }
  }
  for(let c=0;c<FC;c++){
    let run=1;
    for(let r=1;r<=FC;r++){
      const same=r<FC&&f[r]?.[c]?.color===f[r-1]?.[c]?.color;
      if(same)run++;
      else{if(run>=3)for(let k=r-run;k<r;k++)marked.add(`${k},${c}`);run=1;}
    }
  }
  return[...marked].map(s=>{const[r,c]=s.split(',');return[fi,+r,+c];});
}

function findCrossFaceMatches(){
  const result=[], added=new Set();
  for(const seam of CROSS_SEAMS){
    for(const[i0,i1,i2]of[[1,2,3],[2,3,4]]){
      const a=seam[i0],b=seam[i1],cc=seam[i2];
      const ca=gems[a.fi]?.[a.r]?.[a.c]?.color;
      const cb=gems[b.fi]?.[b.r]?.[b.c]?.color;
      const cc2=gems[cc.fi]?.[cc.r]?.[cc.c]?.color;
      if(ca===undefined||cb===undefined||cc2===undefined)continue;
      if(ca===cb&&cb===cc2){
        for(const cell of[a,b,cc]){
          const key=`${cell.fi},${cell.r},${cell.c}`;
          if(!added.has(key)){added.add(key);result.push([cell.fi,cell.r,cell.c]);}
        }
      }
    }
  }
  return result;
}

function findAllMatches(){
  const all=FACES.flatMap(f=>findMatchesOnFace(f.id));
  const seen=new Set(all.map(([fi,r,c])=>`${fi},${r},${c}`));
  for(const[fi,r,c]of findCrossFaceMatches()){
    const key=`${fi},${r},${c}`;
    if(!seen.has(key)){seen.add(key);all.push([fi,r,c]);}
  }
  return all;
}

// ── Hit test ──

function hitTest(sx,sy){
  const invRot=m3.T(rot);
  const rayO=m3.app(invRot,[0,0,-CAM]);
  const rdW=v3.norm([(sx-cx)/projScale, -(sy-cy)/projScale, CAM]);
  const rayD=m3.app(invRot,rdW);
  let bestT=Infinity, hit=null;
  for(const f of FACES){
    const rn=m3.app(rot,f.n);
    if(rn[2]>=-0.04)continue;
    const denom=v3.dot(f.n,rayD);
    if(Math.abs(denom)<1e-6)continue;
    const t=(1-v3.dot(f.n,rayO))/denom;
    if(t<=0||t>=bestT)continue;
    const hp=[rayO[0]+t*rayD[0],rayO[1]+t*rayD[1],rayO[2]+t*rayD[2]];
    const delta=v3.sub(hp,f.n);
    const u=v3.dot(delta,f.r);
    const v=v3.dot(delta,f.u);
    if(Math.abs(u)>1||Math.abs(v)>1)continue;
    const col=Math.round((u-CS0)/(CSIZ+CGAP));
    const row=FC-1-Math.round((v-CS0)/(CSIZ+CGAP));
    if(col<0||col>=FC||row<0||row>=FC)continue;
    bestT=t;
    hit={fi:f.id,r:row,c:col};
  }
  return hit;
}

// ── Swap ──

function areCrossFaceAdjacent(a,b){
  for(const seam of CROSS_SEAMS){
    const a0=seam[2],b0=seam[3];
    if(a.fi===a0.fi&&a.r===a0.r&&a.c===a0.c&&
       b.fi===b0.fi&&b.r===b0.r&&b.c===b0.c)return true;
    if(b.fi===a0.fi&&b.r===a0.r&&b.c===a0.c&&
       a.fi===b0.fi&&a.r===b0.r&&a.c===b0.c)return true;
  }
  return false;
}

function handleTap(hit){
  if(!gameRunning||animating)return;
  if(sliceMode==='selectFace'){selectSliceFace(hit.fi);return;}
  if(sliceMode==='selectDir')return;
  if(!sel){sel=hit;draw();return;}
  if(sel.fi===hit.fi&&sel.r===hit.r&&sel.c===hit.c){sel=null;draw();return;}
  if(sel.fi===hit.fi){
    const dr=Math.abs(sel.r-hit.r),dc=Math.abs(sel.c-hit.c);
    if(dr+dc===1){const s=sel;sel=null;trySwap(s,hit);return;}
  }
  if(sel.fi!==hit.fi&&areCrossFaceAdjacent(sel,hit)){
    const s=sel;sel=null;trySwap(s,hit);return;
  }
  sel=hit;draw();
}

function trySwap(a,b){
  computeFaceGravity();
  animating=true;
  _taFreeze();
  animateSwap(a,b,()=>{
    moves--;
    const m=findAllMatches();
    if(!m.length){
      animateSwap(a,b,()=>{
        animating=false;
        _taUnfreeze();
        updateHUD();
        checkEnd();
        draw();
      });
      return;
    }
    processMatches(m,0);
  });
}

function animateSwap(a,b,done){
  let t=0;const dur=14;
  const ga=gems[a.fi][a.r][a.c],gb=gems[b.fi][b.r][b.c];
  let swapped=false;
  function step(){
    t++;const p=t/dur;
    const e=p<.5?2*p*p:-1+(4-2*p)*p;
    const sc=p<.5?(1-0.45*e*2):(0.55+0.45*(e-0.5)*2);
    ga.scale=sc; gb.scale=sc;
    if(!swapped&&t>=Math.floor(dur/2)){
      swapped=true;
      [gems[a.fi][a.r][a.c],gems[b.fi][b.r][b.c]]=[gems[b.fi][b.r][b.c],gems[a.fi][a.r][a.c]];
    }
    draw();
    if(t<dur)requestAnimationFrame(step);
    else{gems[a.fi][a.r][a.c].scale=1;gems[b.fi][b.r][b.c].scale=1;done();}
  }
  requestAnimationFrame(step);
}

// ── Match processing ──

function spawnParticles(fi,r,c,noteIdx){
  const f=FACES[fi];
  const[u,v]=cellUV(r,c);
  const p3=faceUVto3D(f,u,v);
  const[sx,sy]=project(m3.app(rot,p3));
  playShatter(sx,sy,canvas.width,canvas.height,noteIdx);
  const col=COLORS[gems[fi][r][c].color];
  const colLo=COLORS_LO[gems[fi][r][c].color];
  const colHi=col.replace(/^#/,'')
    .match(/.{2}/g).map(x=>Math.min(255,parseInt(x,16)+80))
    .reduce((s,v)=>s+''+v.toString(16).padStart(2,'0'),'#');

  // flash ring
  particles.push({x:sx,y:sy,vx:0,vy:0,life:0.6,decay:0.08,size:projScale*CSIZ*1.1,col:'#ffffff',ring:true});

  // diamond shards
  const baseSize=projScale*CSIZ*0.9;
  const shardCount=5+Math.floor(Math.random()*3);
  for(let i=0;i<shardCount;i++){
    const a=Math.random()*Math.PI*2;
    const s=2+Math.random()*4;
    const sz=baseSize*(0.25+Math.random()*0.35);
    particles.push({
      x:sx+(Math.random()-.5)*baseSize*0.3,
      y:sy+(Math.random()-.5)*baseSize*0.3,
      vx:Math.cos(a)*s, vy:Math.sin(a)*s-1,
      life:1, decay:.013+Math.random()*.009,
      size:sz, col:Math.random()<0.4?colHi:Math.random()<0.6?col:colLo,
      rot:Math.random()*Math.PI*2,
      rotV:(Math.random()-.5)*0.18,
      shard:true
    });
  }

  // glitter orbs
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2,s=3+Math.random()*7;
    particles.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,
      life:0.9,decay:.045+Math.random()*.035,size:2+Math.random()*3,col,spark:false});
  }
  // white sparks
  for(let i=0;i<4;i++){
    const a=Math.random()*Math.PI*2,s=4+Math.random()*9;
    particles.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:0.7,decay:.055+Math.random()*.045,size:1.5+Math.random()*2,col:'#ffffff',spark:true});
  }
  // color sparks
  for(let i=0;i<3;i++){
    const a=Math.random()*Math.PI*2,s=5+Math.random()*8;
    particles.push({x:sx,y:sy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:0.6,decay:.06+Math.random()*.04,size:1+Math.random()*2,col:colHi,spark:true});
  }
}

// ── Power-up helpers ──

// Group matched cells into connected components (same face adjacent OR cross-face adjacent)
function groupMatches(matches){
  const key=(fi,r,c)=>`${fi},${r},${c}`;
  const cellSet=new Set(matches.map(([fi,r,c])=>key(fi,r,c)));
  const visited=new Set();
  const groups=[];
  for(const[fi,r,c]of matches){
    const k=key(fi,r,c);
    if(visited.has(k))continue;
    const group=[],queue=[[fi,r,c]];
    visited.add(k);
    while(queue.length){
      const[qfi,qr,qc]=queue.shift();
      group.push([qfi,qr,qc]);
      // same-face neighbours
      for(const[nr,nc]of[[qr-1,qc],[qr+1,qc],[qr,qc-1],[qr,qc+1]]){
        if(nr<0||nr>=FC||nc<0||nc>=FC)continue;
        const nk=key(qfi,nr,nc);
        if(cellSet.has(nk)&&!visited.has(nk)){visited.add(nk);queue.push([qfi,nr,nc]);}
      }
      // cross-face neighbours
      for(const[nfi,nr,nc]of matches){
        const nk=key(nfi,nr,nc);
        if(visited.has(nk))continue;
        if(areCrossFaceAdjacent({fi:qfi,r:qr,c:qc},{fi:nfi,r:nr,c:nc})){
          visited.add(nk);queue.push([nfi,nr,nc]);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

// Return the face with the most cells in a group
function majorityFace(group){
  const count={};
  for(const[fi]of group)count[fi]=(count[fi]||0)+1;
  return+Object.keys(count).reduce((a,b)=>count[a]>=count[b]?a:b);
}

// Bomb: 3x3 area around group center, including cross-face cells at edges
function getBombCells(group){
  const fi=majorityFace(group);
  const fCells=group.filter(([f])=>f===fi);
  const avgR=Math.round(fCells.reduce((s,[,r])=>s+r,0)/fCells.length);
  const avgC=Math.round(fCells.reduce((s,[,,c])=>s+c,0)/fCells.length);
  const cellSet=new Set();
  const addCell=(f,r,c)=>cellSet.add(`${f},${r},${c}`);
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const nr=avgR+dr,nc=avgC+dc;
    if(nr>=0&&nr<FC&&nc>=0&&nc<FC){
      addCell(fi,nr,nc);
    } else {
      const er=Math.max(0,Math.min(FC-1,nr));
      const ec=Math.max(0,Math.min(FC-1,nc));
      for(const seam of CROSS_SEAMS){
        // get this face's cells within this seam
        const thisCells=seam.filter(s=>s.fi===fi);
        const idxInHalf=thisCells.findIndex(s=>s.r===er&&s.c===ec);
        if(idxInHalf<0)continue;
        const otherFi=seam.find(s=>s.fi!==fi)?.fi;
        if(otherFi==null)continue;
        const otherCells=seam.filter(s=>s.fi===otherFi);
        // mirror index: thisCells[half-1] is at the fold, maps to otherCells[0]
        const half=thisCells.length;
        const distFromFold=half-1-idxInHalf;
        const mapped=otherCells[Math.min(distFromFold,otherCells.length-1)];
        if(mapped)addCell(mapped.fi,mapped.r,mapped.c);
      }
    }
  }
  return [...cellSet].map(k=>k.split(',').map(Number));
}

// Rocket: clear entire horizontal ring (row r on 4 side faces 0-3)
function getRocketCells(group){
  const rows=group.map(([,r])=>r).sort((a,b)=>a-b);
  const r=rows[Math.floor(rows.length/2)]; // median row
  const cells=[];
  for(let f=0;f<4;f++)for(let c=0;c<FC;c++)cells.push([f,r,c]);
  return cells;
}

// Bomb particle ring
function spawnBombFX(cx,cy){
  const cols=['#ff8800','#ffcc00','#ff4400','#ffffff','#ffee88'];
  // shockwave rings
  particles.push({x:cx,y:cy,vx:0,vy:0,life:0.7,decay:0.045,size:8, col:'#ffcc00',ring:true});
  particles.push({x:cx,y:cy,vx:0,vy:0,life:0.5,decay:0.06, size:4, col:'#ffffff',ring:true});
  // burst particles
  for(let i=0;i<36;i++){
    const a=(i/36)*Math.PI*2;
    const s=6+Math.random()*14;
    particles.push({
      x:cx,y:cy,
      vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:1,decay:0.011+Math.random()*0.009,
      size:3+Math.random()*6,
      col:cols[Math.floor(Math.random()*cols.length)],
      spark:true
    });
  }
  // inner hot core sparks
  for(let i=0;i<12;i++){
    const a=Math.random()*Math.PI*2,s=2+Math.random()*5;
    particles.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:0.8,decay:0.05,size:2+Math.random()*3,col:'#ffffff',spark:true});
  }
}

// Rocket particle sweep
function spawnRocketFX(cells){
  const cols=['#00ccff','#ffffff','#88eeff','#00aaff'];
  cells.forEach(([fi,r,c])=>{
    if(!gems[fi]?.[r]?.[c])return;
    const f=FACES[fi];
    const[u,v]=cellUV(r,c);
    const[sx,sy]=project(m3.app(rot,faceUVto3D(f,u,v)));
    // flash per cell
    particles.push({x:sx,y:sy,vx:0,vy:0,life:0.5,decay:0.1,size:projScale*CSIZ*0.9,col:'#88eeff',ring:true});
    for(let i=0;i<6;i++){
      const a=Math.random()*Math.PI*2,s=3+Math.random()*7;
      particles.push({
        x:sx+(Math.random()-.5)*6,
        y:sy+(Math.random()-.5)*6,
        vx:Math.cos(a)*s,
        vy:Math.sin(a)*s-3,
        life:0.9,decay:0.04+Math.random()*0.025,
        size:1.5+Math.random()*3,
        col:cols[Math.floor(Math.random()*cols.length)],
        spark:true
      });
    }
  });
}

function showFloat(text,sx,sy){
  const el=document.createElement('div');
  el.className='float-txt';el.textContent=text;
  const wrap=document.getElementById('cw');
  const wr=wrap.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
  el.style.left=(cr.left-wr.left+sx-24)+'px';
  el.style.top=(cr.top-wr.top+sy-12)+'px';
  wrap.appendChild(el);setTimeout(()=>el.remove(),950);
}

function processMatches(matches,chain){
  // ── Power-up expansion ──
  const groups=groupMatches(matches);
  const expandedSet=new Set(matches.map(([fi,r,c])=>`${fi},${r},${c}`));
  let hasBomb=false,hasRocket=false;
  let bombCX=0,bombCY=0,rocketCells=[];

  for(const group of groups){
    if(group.length>=5){
      hasRocket=true;
      const rc=getRocketCells(group);
      rocketCells=rocketCells.concat(rc);
      rc.forEach(([fi,r,c])=>expandedSet.add(`${fi},${r},${c}`));
    } else if(group.length>=4){
      hasBomb=true;
      getBombCells(group).forEach(([fi,r,c])=>expandedSet.add(`${fi},${r},${c}`));
      // bomb center = average screen position of all cells in group
      let sx=0,sy=0;
      for(const[fi,r,c]of group){const[px,py]=project(m3.app(rot,faceUVto3D(FACES[fi],...cellUV(r,c))));sx+=px;sy+=py;}
      bombCX=sx/group.length;bombCY=sy/group.length;
    }
  }

  // Filter to cells with actual gems
  const allMatches=[...expandedSet].map(k=>k.split(',').map(Number))
    .filter(([fi,r,c])=>gems[fi]?.[r]?.[c]!=null);

  const n=allMatches.length;
  const gained=Math.round(n*10*(chain+1)*Math.pow(1.15,chain));
  score+=gained;
  shakeAmt=Math.min(18, 4+chain*4+(hasBomb?4:0)+(hasRocket?6:0));
  let avgSX=0,avgSY=0;
  allMatches.forEach(([fi,r,c])=>{
    const f=FACES[fi];
    const[u,v]=cellUV(r,c);
    const[sx,sy]=project(m3.app(rot,faceUVto3D(f,u,v)));
    avgSX+=sx;avgSY+=sy;
  });
  avgSX/=n;avgSY/=n;

  // Cells to flash before elimination (bomb 3x3 or rocket ring)
  const flashSet = (hasBomb||hasRocket)
    ? new Set([...expandedSet].filter(k=>{
        const[fi,r,c]=k.split(',').map(Number);
        return gems[fi]?.[r]?.[c]!=null;
      }))
    : new Set();

  function doElim(){
    const chainOffset=Math.min(chain*2,6);
    const total=allMatches.length;
    allMatches.forEach(([fi,r,c],idx)=>{
      // pitch climbs across all eliminated blocks in one sweep
      const noteIdx=chainOffset+Math.round(idx/(total-1||1)*Math.min(total-1,5));
      spawnParticles(fi,r,c,noteIdx);
    });

    // Power-up FX
    if(hasBomb){spawnBombFX(bombCX,bombCY);playBoom(bombCX,canvas.width);}
    if(hasRocket){spawnRocketFX(rocketCells);playRocket(avgSX,canvas.width);}

    // City building materials
    totalBlocksElim+=allMatches.length;
    localStorage.setItem('cb3d_blocks',totalBlocksElim);
    updateCity();

    const label=hasRocket?`🚀+${gained}`:hasBomb?`💣+${gained}`:`+${gained}${chain>0?'🔥'.repeat(Math.min(chain,3)):''}`;
    showFloat(label,avgSX,avgSY);

    // 缩小到消失动画
    const dur=18;let t=0;
    function elimStep(){
      t++;
      const p=Math.min(t/14,1);
      allMatches.forEach(([fi,r,c])=>{
        const g=gems[fi]?.[r]?.[c];if(!g)return;
        g.scale=1-p;
        g.alpha=1-p;
      });
      draw();
      if(t<dur)requestAnimationFrame(elimStep);
      else{
        allMatches.forEach(([fi,r,c])=>{if(gems[fi]?.[r]?.[c])gems[fi][r][c].flash=0;});
        allMatches.forEach(([fi,r,c])=>{gems[fi][r][c]=null;});
        applyGravity(()=>{
          updateHUD();
          const next=findAllMatches();
          if(next.length&&chain<6){processMatches(next,chain+1);return;}
          animating=false;_taUnfreeze();checkEnd();draw();
        });
      }
    }
    requestAnimationFrame(elimStep);
  }

  if((hasBomb||hasRocket) && flashSet.size>0){
    const flashCells=allMatches.filter(([fi,r,c])=>flashSet.has(`${fi},${r},${c}`));
    const seq=[-1,1,-1,1];
    let si=0,ft=0;
    const FLASH_DUR=5;
    function flashStep(){
      ft++;
      const v=seq[si];
      flashCells.forEach(([fi,r,c])=>{const g=gems[fi]?.[r]?.[c];if(g)g.flash=v;});
      draw();
      if(ft>=FLASH_DUR){si++;ft=0;}
      if(si<seq.length) requestAnimationFrame(flashStep);
      else{
        flashCells.forEach(([fi,r,c])=>{const g=gems[fi]?.[r]?.[c];if(g)g.flash=0;});
        doElim();
      }
    }
    requestAnimationFrame(flashStep);
  } else {
    doElim();
  }
}

// ── Gravity ──

function computeFaceGravity(){
  faceGravity=FACES.map(f=>{
    const rW=m3.app(rot,f.r);
    const uW=m3.app(rot,f.u);
    const cands=[
      {score:-rW[1], axis:'col', dir: 1},
      {score: rW[1], axis:'col', dir:-1},
      {score: uW[1], axis:'row', dir: 1},
      {score:-uW[1], axis:'row', dir:-1},
    ];
    return cands.reduce((best,c)=>c.score>best.score?c:best);
  });
}

function applyGravity(done){
  if(!faceGravity.length) faceGravity=FACES.map(()=>({axis:'row',dir:1}));
  for(let fi=0;fi<6;fi++){
    const{axis,dir}=faceGravity[fi];
    if(axis==='row'){
      for(let c=0;c<FC;c++){
        if(dir===1){
          let empty=FC-1;
          for(let r=FC-1;r>=0;r--){
            if(gems[fi][r][c]!==null){
              gems[fi][empty][c]=gems[fi][r][c];
              if(empty!==r)gems[fi][r][c]=null;
              empty--;
            }
          }
          for(let r=empty;r>=0;r--){
            const ng=mkGem(safeColor(fi,r,c));
            ng.dy=(FC-r)*CSIZ*1.2;
            gems[fi][r][c]=ng;
          }
        } else {
          let empty=0;
          for(let r=0;r<FC;r++){
            if(gems[fi][r][c]!==null){
              gems[fi][empty][c]=gems[fi][r][c];
              if(empty!==r)gems[fi][r][c]=null;
              empty++;
            }
          }
          for(let r=empty;r<FC;r++){
            const ng=mkGem(safeColor(fi,r,c));
            ng.dy=-(r+1)*CSIZ*1.2;
            gems[fi][r][c]=ng;
          }
        }
      }
    } else {
      for(let r=0;r<FC;r++){
        if(dir===1){
          let empty=FC-1;
          for(let c=FC-1;c>=0;c--){
            if(gems[fi][r][c]!==null){
              gems[fi][r][empty]=gems[fi][r][c];
              if(empty!==c)gems[fi][r][c]=null;
              empty--;
            }
          }
          for(let c=empty;c>=0;c--){
            const ng=mkGem(safeColor(fi,r,c));
            ng.dx=-(FC-c)*CSIZ*1.2;
            gems[fi][r][c]=ng;
          }
        } else {
          let empty=0;
          for(let c=0;c<FC;c++){
            if(gems[fi][r][c]!==null){
              gems[fi][r][empty]=gems[fi][r][c];
              if(empty!==c)gems[fi][r][c]=null;
              empty++;
            }
          }
          for(let c=empty;c<FC;c++){
            const ng=mkGem(safeColor(fi,r,c));
            ng.dx=(c+1)*CSIZ*1.2;
            gems[fi][r][c]=ng;
          }
        }
      }
    }
  }
  let start=null;const dur=380;
  function step(ts){
    if(!start)start=ts;
    const p=Math.min((ts-start)/dur,1);
    const e=1-Math.pow(1-p,3);
    for(let fi=0;fi<6;fi++)for(let r=0;r<FC;r++)for(let c=0;c<FC;c++){
      const g=gems[fi][r][c];
      if(g?.dy)g.dy*=(1-e);
      if(g?.dx)g.dx*=(1-e);
    }
    draw();
    if(p<1)requestAnimationFrame(step);
    else{
      for(let fi=0;fi<6;fi++)for(let r=0;r<FC;r++)for(let c=0;c<FC;c++){
        const g=gems[fi][r][c];
        if(g){g.dy=0;g.dx=0;}
      }
      done();
    }
  }
  requestAnimationFrame(step);
}
