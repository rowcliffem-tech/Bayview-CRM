// Printed-text extraction. Uncertain and missing fields stay editable for review.
export function parseLicenseText(text,{allowPartial=false}={}){
 if(typeof text!=='string'||text.length>30000)throw new Error('The licence text could not be read. Retake the front photo.');
 const lines=text.split(/[\r\n]+/).map(l=>l.replace(/[|]/g,'I').replace(/\s+/g,' ').trim()).filter(Boolean),upper=lines.map(l=>l.toUpperCase());
 const p={firstName:'',middleName:'',lastName:'',street:'',street2:'',city:'',province:'ON',postalCode:'',country:'CAN',dateOfBirth:'',expiryDate:'',licenseNumber:''};
 const valueAfter=(patterns)=>{for(let i=0;i<lines.length;i++)for(const pattern of patterns){const m=lines[i].match(pattern);if(m){const value=lines[i].slice(m[0].length).replace(/^[:.\s/-]+/,'').trim();return value||lines[i+1]||'';}}return '';};
 const tidyName=s=>s.replace(/\s*(?:\bNOM\b|\bNAME\b)\s*[:/]?\s*/gi,' ').replace(/([\p{L}]{2,})[.,](?=[\p{L}])/gu,'$1 ').replace(/([\p{L}]{2,})[.,](?=\s|$)/gu,'$1').replace(/^[,;:\s]+|[,;:\s]+$/g,'').trim();
 p.firstName=tidyName(valueAfter([/^(?:2\.?\s*)?(?:GIVEN\s+NAMES?|FIRST\s+NAME|PR[ÉE]NOMS?)(?:\s*\/\s*(?:PR[ÉE]NOMS?|GIVEN\s+NAMES?))?\s*[:]?\s*/iu,/^2[.)]?\s+/]));
 p.middleName=tidyName(valueAfter([/^(?:MIDDLE\s+NAMES?|SECOND\s+NAME)\s*[:]?\s*/i]));
 p.lastName=tidyName(valueAfter([/^(?:1\.?\s+)?(?:SURNAME|FAMILY\s+NAME|LAST\s+NAME)(?:\s*\/\s*NOM)?\s*[:]?\s*/i,/^1[.)]?\s+/]));
 const full=valueAfter([/^(?:FULL\s+NAME|NAME\s*\/\s*NOM|NAME|NOM)\s*:\s*/i]);
 const combined=lines.findIndex(l=>/^(?:1\s*[,./]\s*2[.)]?\s*)?NAME\s*\/\s*NOM\b/i.test(l));
 if(combined>=0){const after=lines[combined].replace(/^(?:1\s*[,./]\s*2[.)]?\s*)?NAME\s*\/\s*NOM\b\s*:?\s*/i,'');const surname=after||lines[combined+1]||'',given=lines[combined+(after?1:2)]||'';if(/^[\p{L} ,.'’-]{2,160}$/u.test(surname)&&/^[\p{L} ,.'’-]{2,160}$/u.test(given)){p.lastName=tidyName(surname);p.firstName=tidyName(given);}}
 if(full&&!p.lastName){if(full.includes(',')){const parts=full.split(',');p.lastName=parts[0].trim();p.firstName=parts.slice(1).join(' ').trim();}else{const parts=full.split(' ');p.lastName=parts.pop()||'';p.firstName=parts.join(' ');}}
 const numberLabel=/^(?:(?:DRIVER['’]?S?\s+)?LICEN[CS]E\s*(?:NO\.?|NUMBER|#)|D[.\s/]*L\.?\s*(?:NO\.?|NUMBER|#)?|PERMIS(?:\s+DE\s+CONDUIRE)?\s*(?:N[O°]|NUM[ÉE]RO))\s*[:#]?\s*/i;
 const labelledNumber=valueAfter([numberLabel]);
 p.licenseNumber=readOntarioNumber(labelledNumber)||readOntarioNumber(text)||(/^[A-Z0-9][A-Z0-9 -]{4,59}$/i.test(labelledNumber)&&!/\b(?:NAME|BIRTH|EXPIR|ADDRESS|CLASS|NAISSANCE)\b/i.test(labelledNumber)?labelledNumber:'');
 const addressIndex=lines.findIndex(l=>/^(?:[8B&][.)]?\s+)?\d{1,6}[A-Z]?(?:[-/]\d+)?\s+.+\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|LANE|LN|CRT|COURT|CT|WAY|CRES|CRESCENT|TRAIL|PL|PLACE|HWY|HIGHWAY)\b/i.test(l));
 p.street=valueAfter([/^(?:8[.)]?\s+)?(?:ADDRESS|ADRESSE)(?:\s*\/\s*(?:ADDRESS|ADRESSE))?\s*[:]?\s*/i])||(addressIndex>=0?lines[addressIndex].replace(/^[8B&][.)]?\s+(?=\d)/i,''):'');
 const postalIndex=upper.findIndex(l=>/[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d/.test(l));
 if(postalIndex>=0){const m=upper[postalIndex].match(/([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)/);p.postalCode=m[1]+' '+m[2];const line=upper[postalIndex].slice(0,m.index).trim()||(upper[postalIndex-1]||'');const place=line.match(/^(.*?)\s+(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|NT|NU|YT)\b/);if(place){p.city=place[1].replace(/^CITY\s*:?\s*/,'').trim();p.province=place[2];}}
 p.city=(p.city||valueAfter([/^CITY\s*[:]?\s*/i])).replace(/[,;\s]+$/,'');
 p.dateOfBirth=readLabelledDate(lines,'birth');
 p.expiryDate=readLabelledDate(lines,'expiry');
 if(!p.firstName&&!p.lastName&&addressIndex>1){const candidates=lines.slice(Math.max(0,addressIndex-4),addressIndex).filter(l=>/^[\p{L} ,.'-]{2,60}$/u.test(l)&&!/ONTARIO|CANADA|LICEN[CS]E|PERMIS|DRIVER|CONDUCTEUR|ADDRESS|ADRESSE|CLASS|NAME|NOM/i.test(l));if(candidates.length>=2){p.lastName=candidates.at(-2);p.firstName=candidates.at(-1);}}
 // Ontario prints all given names together. Keep hyphenated names intact;
 // the editable review form lets the user correct compound first names.
 if(!p.middleName){const given=p.firstName.trim().split(/\s+/);p.firstName=given.shift()||'';p.middleName=given.join(' ');}
 for(const key of ['firstName','middleName','lastName'])p[key]=tidyName(p[key]).slice(0,160);
 const count=Object.entries(p).filter(([k,v])=>v&&!['country','province','middleName','street2'].includes(k)).length;
 if(count<2&&!allowPartial)throw new Error('The front text is not clear enough. Retake the photo, enter any details you have, or save the photo to complete later.');
 return p;
}

// Correct OCR lookalikes only within the fixed numeric portion of the
// Ontario format. Never derive an identifier from a name or date of birth.
function readOntarioNumber(text){
 const m=text.toUpperCase().match(/\b([A-Z])\s*([0-9OQILSZBG]{4})[\s.\-–—]*([0-9OQILSZBG]{5})[\s.\-–—]*([0-9OQILSZBG]{5})(?![A-Z0-9])/);
 if(!m)return '';const digits=s=>s.replace(/[OQILSZBG]/g,c=>({O:'0',Q:'0',I:'1',L:'1',S:'5',Z:'2',B:'8',G:'6'})[c]);
 return m[1]+digits(m[2])+'-'+digits(m[3])+'-'+digits(m[4]);
}

function readDate(text){
 // YYYY/MM/DD is unambiguous. Permit OCR spacing, single-digit fields and
 // common character confusions, but reject invalid dates rather than guess.
 const normalized=text.normalize('NFKC').replace(/[–—−]/g,'-');
 const m=normalized.match(/\b([12I][0-9OIl]{3})\s*[/.\-\s]\s*([0-9OIl]{1,2})\s*[/.\-\s]\s*([0-9OIl]{1,2})(?![\dOIl])/);
 if(!m)return '';const digits=s=>s.replace(/[OIil]/g,c=>c==='O'?'0':'1');
 const year=digits(m[1]),month=digits(m[2]).padStart(2,'0'),day=digits(m[3]).padStart(2,'0'),iso=year+'-'+month+'-'+day,d=new Date(iso+'T12:00:00Z');
 return Number(year)>=1900&&Number(year)<=2099&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
}

function readLabelledDate(lines,kind){
 const birth=/\b(?:D\s*\.?\s*O\s*\.?\s*B\.?|DDN|DATE\s+(?:OF\s+)?BIRTH|BIRTH\s*DATE|BIRTH|(?:DATE\s+DE\s+)?NAISSANCE)\b/i;
 const expiry=/\b(?:EXP(?:IRY|IRES|IRATION)?\.?|EXPIRATION)\b/i;
 const label=kind==='birth'?birth:expiry,number=kind==='birth'?/(?:^|\s)3[.)]?\s*(?=[\dI]|D\.?O|DATE|BIRTH|NAISSANCE|$)/i:/(?:^|\s)4\s*[B8][.)]?\s*/i;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],match=line.match(label)||line.match(number);if(!match)continue;
  let tail=line.slice(match.index+match[0].length);
  // A later field on the same OCR line must not supply this field's date.
  const stop=kind==='birth'?/\b4\s*[AB8][.)]?|\b(?:EXPIRY|EXPIRATION|ISSUED|ISSUE)\b/i:birth;
  tail=tail.split(stop)[0];const same=readDate(tail);if(same)return same;
  for(let j=i+1;j<=Math.min(i+2,lines.length-1);j++){
   if(stop.test(lines[j])||/^(?:[1-9][.)]\s*|4\s*[AB8][.)]?\s*)/.test(lines[j]))break;
   const next=readDate(lines[j]);if(next)return next;
  }
 }
 return '';
}
