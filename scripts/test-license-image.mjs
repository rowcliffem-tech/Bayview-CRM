import assert from 'node:assert/strict';
import {cardCorners,validCardCorners,cardProjection,imageQuality} from '../lib/license-image.mjs';
import {locateLicenseFields,resolveFieldReadings,fieldValue} from '../lib/license-layout.mjs';
const corners=[{x:.12,y:.16},{x:.9,y:.08},{x:.85,y:.83},{x:.06,y:.9}],project=cardProjection(corners);
for(const [i,uv] of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]]){const p=project(...uv);assert.ok(Math.abs(p.x-corners[i].x)<1e-8);assert.ok(Math.abs(p.y-corners[i].y)<1e-8);}
assert.equal(validCardCorners([corners[0],corners[2],corners[1],corners[3]]),false);assert.equal(validCardCorners(cardCorners({x:0,y:0,w:.001,h:.001})),false);assert.throws(()=>cardProjection([{x:0,y:0}]),/four handles/);
const blank=new Uint8ClampedArray(100*60*4).fill(255);assert.ok(imageQuality(blank,100,60).warnings.some(w=>/focus/.test(w)));assert.ok(imageQuality(blank,100,60).warnings.some(w=>/overexposure/.test(w)));
const line=(text,x0,y0,x1,y1)=>({text,confidence:85,bbox:{x0,y0,x1,y1}}),data={blocks:[{paragraphs:[{lines:[line('1,2 NAME / NOM',400,140,700,165),line('DEMO-SAMPLE',400,190,750,225),line('ALEX JAMIE',400,240,750,275),line('100 DEMO STREET',400,295,820,330),line('3. 1990/01/15',60,700,360,735),line('4b EXPIRY',780,450,980,470),line('2030/01/15',780,480,990,510)]}]}]};
const fields=locateLicenseFields([data],1100,800);assert.ok(fields.givenNames.rect[1]<=257/800&&fields.givenNames.rect[1]+fields.givenNames.rect[3]>=257/800);assert.ok(fields.lastName.rect[1]<=207/800&&fields.lastName.rect[1]+fields.lastName.rect[3]>=207/800);assert.ok(fields.dateOfBirth);assert.ok(fields.expiryDate);
assert.equal(fieldValue('1990/01/15','dateOfBirth'),'1990-01-15');assert.equal(fieldValue('1990/02/31','dateOfBirth'),'');assert.equal(fieldValue('DOB\nEXPIRY 2030/01/15','dateOfBirth'),'');
const resolved=resolveFieldReadings([{text:'DEMO-SAMPLE,',confidence:80,family:'original'},{text:'DEMO-SAMPLE',confidence:88,family:'contrast'}],'lastName');assert.equal(resolved.value,'DEMO-SAMPLE');assert.equal(resolved.needsReview,false);
assert.equal(resolveFieldReadings([{text:'1990/01/15',confidence:90,family:'original'},{text:'1990/01/16',confidence:89,family:'contrast'}],'dateOfBirth').needsReview,true);
const observed=lines=>({blocks:[{paragraphs:[{lines}]}]}),sourceA=observed([line('DEMO',350,165,650,230),line('ALEX JAMIE',350,205,750,270),line('100 DEMO STREET',350,295,850,330)]),sourceB=observed([line('DEMO',350,160,650,225),{...line('ALEX JAMIE',350,215,750,280),confidence:95}]);
const grouped=locateLicenseFields([sourceA,sourceB],1000,650);assert.ok(grouped.lastName.rect[1]*650<230&&grouped.givenNames.rect[1]*650>230,'Duplicate observations of the given-name row must not become the surname row');
console.log('PASS: projective card-corner mapping, invalid/crossed corners, photo-quality warnings, label/row-based surname and birthday locations, separate expiry, and uncertain reading detection.');
