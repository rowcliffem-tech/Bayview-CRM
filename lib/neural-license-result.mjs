import {parseLicenseText} from './license-ocr.mjs';
const clean=text=>String(text||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function normalizeNeuralLabels(text){
 let value=clean(text).replace(/^(?:(?:1\s*[,./]?\s*2|[12])[.)]?\s*)?NAME\s*[/I|!]\s*NOM\b/i,'NAME/NOM');
 // Correct letter/digit lookalikes only inside the fixed Canadian postal
 // pattern on a line carrying a province. Never apply this to names or IDs.
 if(/\b(?:ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|NT|NU|YT)\b/i.test(value))value=value.replace(/\b([ABCEGHJ-NPRSTVXY])([0-9OIL])([ABCEGHJ-NPRSTV-Z])\s*([0-9OIL])([ABCEGHJ-NPRSTV-Z])([0-9OIL])\b/gi,(_,a,b,c,d,e,f)=>{const digit=s=>s.replace(/[OIL]/gi,l=>l.toUpperCase()==='O'?'0':'1');return (a+digit(b)+c+' '+digit(d)+e+digit(f)).toUpperCase();});
 return value;
}
export function neuralTextLines(result){
 const items=(result?.items||[]).filter(item=>Number(item.score)>=.5&&Array.isArray(item.poly)&&item.poly.length===4).map(item=>{const xs=item.poly.map(p=>p[0]),ys=item.poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return {...item,text:clean(item.text),x0,x1,y0,y1,height:y1-y0,cy:(y0+y1)/2};}).filter(item=>item.text&&item.height>0).sort((a,b)=>a.cy-b.cy||a.x0-b.x0);
 const rows=[];
 for(const item of items){const row=rows.find(row=>Math.abs(row.cy-item.cy)<Math.max(row.height,item.height)*.55&&Math.max(row.y0,item.y0)<Math.min(row.y1,item.y1));if(row){row.items.push(item);row.cy=row.items.reduce((sum,i)=>sum+i.cy,0)/row.items.length;row.y0=Math.min(row.y0,item.y0);row.y1=Math.max(row.y1,item.y1);row.height=Math.max(row.height,item.height);}else rows.push({cy:item.cy,y0:item.y0,y1:item.y1,height:item.height,items:[item]});}
 return rows.sort((a,b)=>a.cy-b.cy).map(row=>{const sorted=row.items.sort((a,b)=>a.x0-b.x0);return {text:sorted.map(i=>i.text).join(' '),score:Math.min(...sorted.map(i=>i.score)),poly:sorted.flatMap(i=>i.poly),items:sorted};});
}
export function neuralLicenseProfile(result){
 const lines=neuralTextLines(result),text=lines.map(l=>normalizeNeuralLabels(l.text)).join('\n');
 if(!/LICEN[CS]E|PERMIS|DRIVER|D\s*[O0]\s*B|DDN|NAISSANCE/i.test(text))throw new Error('A licence front was not identified. Select the complete card or retake a clear front photo.');
 const profile=parseLicenseText(text,{allowPartial:true}),review=[];
 for(const line of lines)if(line.score<.88){if(/NAME|NOM/i.test(line.text))review.push('Names');if(/DOB|DDN|BIRTH|NAISSANCE/i.test(line.text))review.push('Date of birth');if(/EXP|4\s*B/i.test(line.text))review.push('Expiry date');}
 if(profile.dateOfBirth>new Date().toISOString().slice(0,10)){profile.dateOfBirth='';review.push('Date of birth');}
 return {profile,review:[...new Set(review)],lines};
}
