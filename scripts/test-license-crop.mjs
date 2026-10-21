import assert from 'node:assert/strict';
import {initialLicenseCrop,cropDimensions,moveLicenseCrop,resizeLicenseCrop,normalizeCrop} from '../lib/license-crop.mjs';
for(const [w,h] of [[1800,2400],[2400,1800],[400,400],[4000,800]]){const r=initialLicenseCrop(w,h);assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=1&&r.y+r.h<=1);assert.ok(Math.abs(r.w*w/(r.h*h)-1.586)<.001,'The default selection fits the licence shape');}
const r={x:.1,y:.2,w:.7,h:.4};assert.deepEqual(moveLicenseCrop(r,-1,2),{...r,x:0,y:.6});
const enlarged=resizeLicenseCrop(r,'se',{x:.95,y:.9});assert.ok(Math.abs(enlarged.w-.85)<.001&&Math.abs(enlarged.h-.7)<.001);
const crossed=resizeLicenseCrop(r,'nw',{x:1,y:1});assert.ok(crossed.w>=.029&&crossed.h>=.029,'Dragging across the other corner must keep a nonempty selection');
assert.deepEqual(cropDimensions(1800,2400,1),{width:2400,height:1800});assert.deepEqual(cropDimensions(1800,2400,2),{width:1800,height:2400});
const clamped=normalizeCrop({x:-.1,y:-.2,w:1.5,h:2});assert.deepEqual(clamped,{x:0,y:0,w:1,h:1});
console.log('PASS: portrait/landscape crop, contained ID frame, dragging and resizing bounds, rotation dimensions and nonempty selections.');
