'use strict';

const FACES=[
  {id:0,n:[0,0,1],  r:[1,0,0],  u:[0,1,0] }, // front  +Z
  {id:1,n:[1,0,0],  r:[0,0,-1], u:[0,1,0] }, // right  +X
  {id:2,n:[0,0,-1], r:[-1,0,0], u:[0,1,0] }, // back   -Z
  {id:3,n:[-1,0,0], r:[0,0,1],  u:[0,1,0] }, // left   -X
  {id:4,n:[0,1,0],  r:[1,0,0],  u:[0,0,-1]}, // top    +Y
  {id:5,n:[0,-1,0], r:[1,0,0],  u:[0,0,1] }, // bottom -Y
];

const ADJ=[
  [{f:4,e:'b'},{f:1,e:'l'},{f:5,e:'t'},{f:3,e:'r'}], // front
  [{f:4,e:'r'},{f:2,e:'l'},{f:5,e:'r'},{f:0,e:'r'}], // right
  [{f:4,e:'t'},{f:3,e:'l'},{f:5,e:'b'},{f:1,e:'r'}], // back
  [{f:4,e:'l'},{f:0,e:'l'},{f:5,e:'l'},{f:2,e:'r'}], // left
  [{f:2,e:'t'},{f:1,e:'t'},{f:0,e:'t'},{f:3,e:'t'}], // top
  [{f:0,e:'b'},{f:1,e:'b'},{f:2,e:'b'},{f:3,e:'b'}], // bottom
];

const FC=5;
const COLORS=['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7'];
const CAM=5.5;
const CPAD=0.06, CGAP=0.04;
const CSIZ=(2-2*CPAD-(FC-1)*CGAP)/FC;
const CS0=-1+CPAD+CSIZ/2;

const LEVELS=[
  {goal:800,  moves:22,colors:4},
  {goal:1500, moves:20,colors:4},
  {goal:2800, moves:18,colors:5},
  {goal:4500, moves:16,colors:5},
  {goal:7000, moves:15,colors:5},
];

const CROSS_SEAMS=(()=>{
  const N=FC, seams=[];
  const add=s=>seams.push(s);

  for(const[fA,fB]of[[0,1],[1,2],[2,3],[3,0]]){
    for(let r=0;r<N;r++){
      add([{fi:fA,r,c:N-3},{fi:fA,r,c:N-2},{fi:fA,r,c:N-1},
           {fi:fB,r,c:0},  {fi:fB,r,c:1},  {fi:fB,r,c:2}]);
    }
  }

  for(let c=0;c<N;c++){
    add([{fi:0,r:2,c},{fi:0,r:1,c},{fi:0,r:0,c},
         {fi:4,r:N-1,c},{fi:4,r:N-2,c},{fi:4,r:N-3,c}]);
  }
  for(let c=0;c<N;c++){
    add([{fi:0,r:N-3,c},{fi:0,r:N-2,c},{fi:0,r:N-1,c},
         {fi:5,r:0,c},{fi:5,r:1,c},{fi:5,r:2,c}]);
  }

  for(let c=0;c<N;c++){
    const tr=N-1-c;
    add([{fi:1,r:2,c},{fi:1,r:1,c},{fi:1,r:0,c},
         {fi:4,r:tr,c:N-1},{fi:4,r:tr,c:N-2},{fi:4,r:tr,c:N-3}]);
  }
  for(let c=0;c<N;c++){
    add([{fi:1,r:N-3,c},{fi:1,r:N-2,c},{fi:1,r:N-1,c},
         {fi:5,r:c,c:N-1},{fi:5,r:c,c:N-2},{fi:5,r:c,c:N-3}]);
  }

  for(let c=0;c<N;c++){
    const tc=N-1-c;
    add([{fi:2,r:2,c},{fi:2,r:1,c},{fi:2,r:0,c},
         {fi:4,r:0,c:tc},{fi:4,r:1,c:tc},{fi:4,r:2,c:tc}]);
  }
  for(let c=0;c<N;c++){
    const bc=N-1-c;
    add([{fi:2,r:N-3,c},{fi:2,r:N-2,c},{fi:2,r:N-1,c},
         {fi:5,r:N-1,c:bc},{fi:5,r:N-2,c:bc},{fi:5,r:N-3,c:bc}]);
  }

  for(let c=0;c<N;c++){
    add([{fi:3,r:2,c},{fi:3,r:1,c},{fi:3,r:0,c},
         {fi:4,r:c,c:0},{fi:4,r:c,c:1},{fi:4,r:c,c:2}]);
  }
  for(let c=0;c<N;c++){
    const br=N-1-c;
    add([{fi:3,r:N-3,c},{fi:3,r:N-2,c},{fi:3,r:N-1,c},
         {fi:5,r:br,c:0},{fi:5,r:br,c:1},{fi:5,r:br,c:2}]);
  }

  return seams;
})();
