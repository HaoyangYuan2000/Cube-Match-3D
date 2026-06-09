'use strict';

const v3={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  len:(v)=>Math.sqrt(v[0]**2+v[1]**2+v[2]**2),
  norm:(v)=>{const l=Math.sqrt(v[0]**2+v[1]**2+v[2]**2)||1;return[v[0]/l,v[1]/l,v[2]/l];},
};

const m3={
  id:()=>[1,0,0,0,1,0,0,0,1],
  mul:(a,b)=>[
    a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
    a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
    a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8],
  ],
  app:(m,v)=>[
    m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
    m[3]*v[0]+m[4]*v[1]+m[5]*v[2],
    m[6]*v[0]+m[7]*v[1]+m[8]*v[2],
  ],
  T:(m)=>[m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]],
  rotX:(a)=>{const c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,c,-s,0,s,c];},
  rotY:(a)=>{const c=Math.cos(a),s=Math.sin(a);return[c,0,s,0,1,0,-s,0,c];},
  rotZ:(a)=>{const c=Math.cos(a),s=Math.sin(a);return[c,-s,0,s,c,0,0,0,1];},
};
