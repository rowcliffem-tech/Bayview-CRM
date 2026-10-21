import {cleanGivenNames,resolveGivenNameReadings} from './license-name-reader.mjs';
import {parseLicenseText} from './license-ocr.mjs';
export const ocrLines=data=>(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])).filter(l=>l.bbox&&l.text).sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);
const birth=/\b(?:D\.?\s*O\.?\s*B\.?|DDN|BIRTH|NAISSANCE)\b|(?:^|\s)3[.)]?\s*(?=[12I][0-9OIl]{3}[\s/.-])/i,expiry=/\b(?:EXP(?:IRY|IRES|IRATION)?|EXPIRATION)\b|(?:^|\s)4\s*[bB8][.)]?\s*/i;
function padded(line,width,height,pad=.012){const b=line.bbox,x=Math.max(0,b.x0/width-pad),y=Math.max(0,b.y0/height-pad*.5),right=Math.min(1,b.x1/width+pad),bottom=Math.min(1,b.y1/height+pad*.5);return [x,y,right-x,bottom-y];}
export function locateLicenseFields(results,width,height){
 const lines=results.flatMap(ocrLines),fields={};
 const nameLabel=lines.filter(l=>/\bNAME\s*[!/|:]?\s*NOM\s*$|\bSURNAME\s*:?\s*$/i.test(l.text.trim())&&l.bbox.x0>width*.2&&l.bbox.y0<height*.5&&l.bbox.y1-l.bbox.y0<height*.065).sort((a,b)=>b.confidence-a.confidence)[0];
 const address=lines.filter(l=>l.bbox.x0>width*.2&&/\d/.test(l.text)&&/\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|LN|LANE|CRT|COURT|CT|WAY|CRES|CRESCENT|TRAIL|PLACE|HWY|HIGHWAY)\b/i.test(l.text)).sort((a,b)=>b.confidence-a.confidence)[0];
 if(address){
  const before=lines.filter(l=>l.bbox.y1<=address.bbox.y0+height*.02&&l.bbox.y0>height*.1&&l.bbox.x1-l.bbox.x0>width*.12&&Math.abs(l.bbox.x0-(nameLabel?.bbox.x0??address.bbox.x0))<width*.09&&(!nameLabel||(l.bbox.y0+l.bbox.y1)/2>(nameLabel.bbox.y0+nameLabel.bbox.y1)/2+height*.01)&&cleanGivenNames(l.text)).sort((a,b)=>b.bbox.y0-a.bbox.y0);
  // Group duplicate observations of a row, then use the two rows above the address.
  const rows=[];for(const l of before.sort((a,b)=>(b.bbox.y0+b.bbox.y1)-(a.bbox.y0+a.bbox.y1))){const duplicate=rows.findIndex(r=>Math.abs((r.bbox.y0+r.bbox.y1-l.bbox.y0-l.bbox.y1)/2)<height*.033);if(duplicate<0)rows.push(l);else if(l.confidence>rows[duplicate].confidence)rows[duplicate]=l;}
  const nameRect=line=>{const b=line.bbox,top=Math.max(b.y0,b.y1-height*.057);return padded({...line,bbox:{...b,y0:top}},width,height);};
  if(rows[0])fields.givenNames={rect:nameRect(rows[0]),kind:'name'};
  if(rows[1])fields.lastName={rect:nameRect(rows[1]),kind:'name'};
  // On Ontario's combined NAME/NOM block, the two value rows sit between
  // the name label and address. Label boundaries avoid security-pattern
  // fragments that OCR may attach to the top of a name's bounding box.
  if(nameLabel&&/\bNAME\s*[!/|:]?\s*NOM\b/i.test(nameLabel.text)){
   const top=nameLabel.bbox.y1,bottom=address.bbox.y0,gap=bottom-top,x=Math.max(0,nameLabel.bbox.x0/width+.016),w=Math.min(.49,1-x);
   if(gap>height*.065&&gap<height*.24){const row=gap/2;fields.lastName={rect:[x,(top+row*.03)/height,w,row*.9/height],kind:'name'};fields.givenNames={rect:[x,(top+row*1.02)/height,w,row*.94/height],kind:'name'};}
  }
 }
 for(const [key,label] of [['dateOfBirth',birth],['expiryDate',expiry],['licenseNumber',/\b(?:4\s*[dD]|LICEN[CS]E\s*(?:NO|NUMBER)|D\s*L\s*(?:NO|NUMBER)|NUMBER\s*\/\s*NUM)/i]]){
  const matches=lines.filter(l=>label.test(l.text)).sort((a,b)=>b.confidence-a.confidence);if(!matches.length)continue;const line=matches[0],b=line.bbox;
  const beside=lines.filter(l=>l.bbox.x0>=b.x1-width*.01&&Math.abs((l.bbox.y0+l.bbox.y1-b.y0-b.y1)/2)<height*.023&&fieldValue(l.text,key)).sort((a,b)=>a.bbox.x0-b.bbox.x0)[0];
  if(beside){fields[key]={rect:padded(beside,width,height),kind:key==='licenseNumber'?'number':'date',labelled:true};continue;}
  const next=lines.filter(l=>l.bbox.y0>=b.y1-height*.008&&l.bbox.y0<b.y1+height*.065&&Math.abs(l.bbox.x0-b.x0)<width*.17&&/\d/.test(l.text)&&!birth.test(l.text)&&!expiry.test(l.text)).sort((a,b)=>a.bbox.y0-b.bbox.y0)[0];
  const hasValue=key==='licenseNumber'?/[A-Z][0-9OIL]{4}[- ]/.test(line.text):/[12I][0-9OIl]{3}[\s/.-]+[0-9OIl]{1,2}/.test(line.text),bottom=hasValue?b.y1:Math.max(b.y1,next?.bbox.y1||b.y1+height*.045),x=Math.max(0,b.x0/width-.01),y=Math.max(0,b.y0/height-.008),right=Math.min(1,Math.max(b.x1,next?.bbox.x1||0)/width+.025);
  fields[key]={rect:[x,y,Math.max(.12,right-x),Math.min(1,bottom/height+.012)-y],kind:key==='licenseNumber'?'number':'date',labelled:true};
 }
 return fields;
}
export function fieldValue(text,key){
 if(key==='givenNames'||key==='lastName')return cleanGivenNames(text.replace(/^(?:[12][.,)]?\s*)?(?:SURNAME|LAST\s+NAME|GIVEN\s+NAMES?|FIRST\s+NAME|NAME\s*\/\s*NOM)\s*[:/-]?\s*/i,''));
 const label=key==='dateOfBirth'?'DOB':key==='expiryDate'?'EXPIRY':'DL NUMBER',profile=parseLicenseText(label+': '+text,{allowPartial:true});
 const value=profile[key]||'';if(key==='dateOfBirth'&&value>new Date().toISOString().slice(0,10))return '';return value;
}
export function resolveFieldReadings(readings,key){
 if(key==='givenNames')return resolveGivenNameReadings(readings);
 const groups=new Map();for(const reading of readings){const value=fieldValue(reading.text,key);if(!value)continue;const id=value.toUpperCase(),group=groups.get(id)||{value,families:new Set(),confidence:0};group.families.add(reading.family||reading.source);group.confidence=Math.max(group.confidence,Number(reading.confidence)||0);groups.set(id,group);}
 const candidates=[...groups.values()].sort((a,b)=>(b.families.size*40+b.confidence*.5)-(a.families.size*40+a.confidence*.5));if(!candidates.length)return {value:'',needsReview:true};const best=candidates[0],other=candidates[1];return {value:best.value,needsReview:best.families.size<2||best.confidence<60||!!other&&other.families.size>=best.families.size};
}
