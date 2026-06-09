'use strict';

let gems=[];
let faceGravity=[];
let rot=m3.id();
let vel=[0,0];
let score=0,level=0,moves=0;
let sel=null;
let gameRunning=false,animating=false,spinning=false;
let particles=[];
let adPending=null;
let sliceUses=3;
let sliceMode=null;
let sliceFace=-1;
let sliceAnim=null;
let projScale=1;
let cx=0,cy=0;
let shakeAmt=0;

const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
