// Compare observed name text, without a name dictionary or spelling guesses.
export function cleanGivenNames(text){
 if(typeof text!=='string'||text.length>200)return '';
 const value=text.normalize('NFKC').replace(/[|]/g,'I').replace(/([\p{L}]{2,})[.,](?=[\p{L}])/gu,'$1 ').replace(/([\p{L}]{2,})[.,](?=\s|$)/gu,'$1').replace(/^[\s,;:]+|[\s,;:]+$/g,'').replace(/\s+/g,' ').trim();
 return /^[\p{L}][\p{L} .’'\-]{1,159}$/u.test(value)&&!/(?:\bNAMES?\b|\bSURNAME\b|\bNOM\b|\bADDRESS\b|\bLICEN[CS]E\b|\bONTARIO\b|\bCANADA\b)/i.test(value)?value:'';
}
export function resolveGivenNameReadings(readings){
 const groups=new Map();
 for(const reading of readings){const text=cleanGivenNames(reading.text);if(!text)continue;const [firstName,...rest]=text.split(' '),middleName=rest.join(' '),key=firstName.toLocaleUpperCase('en-CA'),confidence=Math.max(0,Math.min(100,Number(reading.confidence)||0));const candidate={firstName,middleName,confidence,source:reading.source||'unknown',family:reading.family||reading.source||'unknown'};if(!groups.has(key))groups.set(key,[]);groups.get(key).push(candidate);}
 const ranked=Array.from(groups.values()).map(candidates=>{const families=new Set(candidates.map(c=>c.family)).size,best=[...candidates].sort((a,b)=>b.confidence-a.confidence)[0];return {candidates,families,best,score:families*35+best.confidence*.55+(best.firstName.length===1?-30:0)};}).sort((a,b)=>b.score-a.score);
 if(!ranked.length)return {firstName:'',middleName:'',needsReview:true};
 const winner=ranked[0],firstName=winner.best.firstName,middleName=winner.best.middleName,competing=ranked[1],needsReview=winner.families<2||winner.best.confidence<55||firstName.length===1||!!competing&&competing.families>=winner.families&&competing.best.confidence>winner.best.confidence-10;
 return {firstName,middleName,needsReview};
}
export function locateGivenNameLine(data,width,height){
 const lines=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[])).filter(line=>line.bbox&&line.text).sort((a,b)=>a.bbox.y0-b.bbox.y0);
 const address=lines.find(line=>line.bbox.x0/width>.25&&line.bbox.y0/height>.2&&line.bbox.y0/height<.55&&/\d/.test(line.text)&&/\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|LANE|LN|CRT|COURT|CT|WAY|CRES|CRESCENT|TRAIL|PL|PLACE|HWY|HIGHWAY)\b/i.test(line.text));
 if(!address)return null;
 const before=lines.filter(line=>line.bbox.y0<address.bbox.y0&&line.bbox.y0/height>.12&&line.bbox.y1<=address.bbox.y0+height*.01&&Math.abs(line.bbox.x0-address.bbox.x0)/width<.12&&line.bbox.x1-line.bbox.x0>width*.08&&cleanGivenNames(line.text));
 if(!before.length)return null;const line=before.at(-1),x=Math.max(0,line.bbox.x0/width-.012),y=Math.max(0,line.bbox.y0/height-.006),right=Math.min(1,line.bbox.x1/width+.025),bottom=Math.min(address.bbox.y0/height-.001,line.bbox.y1/height+.008);
 return bottom>y?{rect:[x,y,right-x,bottom-y],text:line.text,confidence:line.confidence}:null;
}
