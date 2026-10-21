import assert from 'node:assert/strict';
import { workspaceSchema,emptyWorkspace,opportunityStages } from '../lib/workspace-schema.mjs';
import { effectiveStage,followupCandidates,normaliseIntake } from '../lib/crm-logic.mjs';
const now=Date.now(),ago=h=>new Date(now-h*3600000).toISOString();
const model=workspaceSchema.parse(emptyWorkspace());
const lead={id:'TEST',name:'Fictional Customer',email:'fixture@example.com',phone:'+14165550100',vehicle:'Test vehicle',source:'Website',rooftop:'Main store',rep:'Unassigned',stage:'New opportunity',created:ago(100),notes:[],pipeline:'Vehicle sales',stockId:'',smsConsent:true,doNotContact:false,aiMode:'assist',externalId:'',timerAnchor:''};
model.leads.push(lead);model.settings.ai.enabled=true;
for(const [age,expected] of [[23,'New opportunity'],[24,'24 hours'],[48,'48 hours'],[72,'72 hours']])assert.equal(effectiveStage({...lead,created:ago(age)},model,now),expected);
for(const stage of opportunityStages.filter(x=>!['New opportunity','24 hours','48 hours','72 hours'].includes(x)))assert.equal(effectiveStage({...lead,stage},model,now),stage,'Outcome stages must not age into a timed lane');
const outgoing={id:'MSG',leadId:lead.id,direction:'outbound',body:'Did you want to arrange a visit?',at:ago(74),status:'logged',author:'staff',origin:'manual'};model.messages.push(outgoing);
assert.equal(followupCandidates(model,now).length,1);
for(const patch of [{smsConsent:false},{doNotContact:true},{aiMode:'human'},{stage:'Booked appointment'},{stage:'Approved'},{stage:'Income not approved'},{stage:'Sold'},{stage:'Delivered'}]){Object.assign(lead,patch);assert.equal(followupCandidates(model,now).length,0,'Contact control and outcome must block follow-up');Object.assign(lead,{smsConsent:true,doNotContact:false,aiMode:'assist',stage:'New opportunity'});}
model.messages.push({...outgoing,id:'REPLY',direction:'inbound',status:'received',author:'customer',at:ago(1)});assert.equal(followupCandidates(model,now).length,0);assert.equal(effectiveStage(lead,model,now),'New opportunity');
const meta=normaliseIntake(model,'facebook',{id:'FB-TEST',field_data:[{name:'full_name',values:['Meta Fixture']},{name:'phone_number',values:['+14165550101']}],vehicle:'Sample car'});assert.equal(meta.lead.name,'Meta Fixture');assert.equal(meta.lead.phone,'+14165550101');assert.equal(meta.lead.smsConsent,false,'Provider lead arrival must not invent text consent');

const base='http://127.0.0.1:5173',sign=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}),cookie=sign.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Workspace-Client':'dealer-workspace'};
const read=async()=>{const r=await fetch(base+'/api/workspace',{headers});assert.equal(r.status,200);return r.json();};
const put=(workspace,revision)=>fetch(base+'/api/workspace',{method:'PUT',headers,body:JSON.stringify({workspace,revision})});
const action=async body=>{const r=await fetch(base+'/api/crm',{method:'POST',headers,body:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
assert.equal((await fetch(base+'/api/crm',{method:'POST'})).status,401);
const original=await read(),externalId='FIXTURE-'+crypto.randomUUID();
let revision=original.revision;
try{
 const first=await action({action:'intake',source:'website',payload:{name:'Intake Fixture',email:'fixture@example.com',vehicle:'Sample car',externalId,message:'Is it available?'}});revision=first.revision;const id=first.result.id;
 const duplicate=await action({action:'intake',source:'website',payload:{name:'Intake Fixture',email:'fixture@example.com',externalId}});revision=duplicate.revision;assert.equal(duplicate.result.id,id);assert.equal(duplicate.result.duplicate,true);assert.equal(duplicate.workspace.messages.filter(m=>m.leadId===id).length,1);
 const work=duplicate.workspace,rooftop='Test-only-'+externalId;work.settings.locations.push(rooftop);work.settings.ai.enabled=true;const target=work.leads.find(l=>l.id===id);Object.assign(target,{rooftop,created:ago(100),aiMode:'assist',smsConsent:true});work.messages.find(m=>m.leadId===id).at=ago(99);work.messages.push({...outgoing,id:'OUT-'+externalId,leadId:id});
 const stored=await put(work,revision);assert.equal(stored.status,200);revision=(await stored.json()).revision;
 const prepared=await action({action:'prepare-followups',rooftop});revision=prepared.revision;assert.equal(prepared.result.prepared,1);assert.equal(prepared.workspace.leads.find(l=>l.id===id).stage,'AI takeover');const draft=prepared.workspace.messages.find(m=>m.leadId===id&&m.status==='draft');assert.equal(draft.author,'template');assert.ok(draft.body.includes('Intake'));
 const repeated=await action({action:'prepare-followups',rooftop});revision=repeated.revision;assert.equal(repeated.result.prepared,0,'A pending draft must prevent duplicate follow-ups');
 const afterReload=await read();assert.equal(afterReload.workspace.messages.find(m=>m.id===draft.id).status,'draft');assert.equal(afterReload.connections.sms,false);assert.equal(afterReload.connections.ai,false);
 console.log('PASS: requested stages, timed aging, fixed outcomes, permission/opt-out controls, human reply handoff, Meta normalization, intake deduplication, persisted template review drafts, duplicate prevention, disconnected service status.');
}finally{const restored=await put(original.workspace,revision);assert.equal(restored.status,200,'Local test cleanup must preserve revision protection');}
