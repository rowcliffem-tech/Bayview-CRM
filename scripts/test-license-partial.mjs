import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {licenseProfileSchema} from '../lib/license-schema.mjs';
const base='http://127.0.0.1:5173',login=await fetch(base+'/signin-with-chatgpt?return_to=%2Fmobile',{redirect:'manual'}),Cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),headers={Cookie,Origin:base,'X-Workspace-Client':'dealer-workspace'};
const get=async path=>{const r=await fetch(base+path,{headers});assert.equal(r.status,200);return r.json();},original=await get('/api/workspace');let revision=original.revision;
const id=crypto.randomUUID(),blank=licenseProfileSchema.parse({}),photo=fs.readFileSync('.sites-runtime/scanner-qa/fixtures/front-ocr.png');
const wrangler=args=>execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js',...args,'--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}),sql=command=>JSON.parse(wrangler(['d1','execute','DB','--command',command,'--json']));
const patch=(profile,expected=JSON.stringify(blank),extra={})=>fetch(base+'/api/licenses',{method:'PATCH',headers:{...headers,'Content-Type':'application/json',...extra},body:JSON.stringify({id,expectedProfile:expected,profile,reviewed:true})});
try{
 const form=new FormData();form.append('details',JSON.stringify({id,profile:blank,permission:true,reviewed:true}));form.append('front',new Blob([photo],{type:'image/png'}),'front.png');
 const saved=await fetch(base+'/api/licenses',{method:'POST',headers,body:form});assert.equal(saved.status,200,await saved.clone().text());const result=await saved.json();
 const after=await get('/api/workspace');revision=after.revision;const lead=after.workspace.leads.find(l=>l.id===result.leadId);assert.equal(lead.name,'Customer — details pending');assert.equal(lead.address,'');
 const entry=(await get('/api/licenses')).files.find(f=>f.id===id);assert.ok(entry.missingFields.includes('Date of birth'));assert.equal(entry.license,'Not entered');
 const complete={...blank,firstName:'ALEX',middleName:'JAMIE',lastName:'DEMO',dateOfBirth:'1990-01-15',licenseNumber:'A1234-12345-12345',street:'100 DEMO STREET',city:'TORONTO',province:'ON',postalCode:'M5V 1A1',expiryDate:'2030-01-15'};
 assert.equal((await patch(complete,undefined,{Origin:'https://untrusted.example'})).status,403);
 const update=await patch(complete);assert.equal(update.status,200,await update.clone().text());revision=(await get('/api/workspace')).revision;
 assert.equal((await get('/api/licenses?id='+id)).profile.middleName,'JAMIE');const changed=(await get('/api/workspace')).workspace;assert.equal(changed.leads.find(l=>l.id===result.leadId).name,'ALEX JAMIE DEMO');assert.equal(JSON.stringify(changed).includes('1990-01-15'),false);assert.equal(JSON.stringify(changed).includes('A1234-12345-12345'),false);
 assert.equal((await patch({...complete,firstName:'STALE'})).status,409,'Stale edits must not overwrite a newer file');
 assert.equal((await patch({...complete,dateOfBirth:'1990-02-31'},JSON.stringify(complete))).status,400);
 assert.equal((await fetch(base+'/api/licenses',{method:'PATCH'})).status,401);
 const foreign=await fetch(base+'/api/licenses',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),expectedProfile:'{}',profile:complete,reviewed:true})});assert.equal(foreign.status,404);
}finally{
 const restored=await fetch(base+'/api/workspace',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({revision,workspace:original.workspace})});assert.equal(restored.status,200,'Restore only this local fixture with revision protection');
 const rows=sql(`SELECT front_key FROM customer_licenses WHERE id='${id}'`)[0].results;sql(`DELETE FROM customer_licenses WHERE id='${id}'`);if(rows[0]?.front_key)wrangler(['r2','object','delete','site-creator-r2/'+rows[0].front_key]);
}
console.log('PASS: blank fields can save a private photo and customer, missing-data status, later editing, CRM population, stale-write protection, origin/auth checks and private birth date/number.');
