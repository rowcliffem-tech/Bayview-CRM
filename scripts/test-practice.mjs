import assert from 'node:assert/strict';
import {testChatAction,effectiveStage,followupCandidates} from '../lib/crm-logic.mjs';
import {workspaceSchema,emptyWorkspace} from '../lib/workspace-schema.mjs';
const now=new Date().toISOString(),w=workspaceSchema.parse(emptyWorkspace());
const lead={id:'fixture',name:'TEST LEAD - Alex Morgan',email:'fixture@example.com',phone:'+14165550104',vehicle:'2023 Toyota RAV4 (test)',rooftop:'Main store',rep:'Unassigned',source:'Website',created:now,notes:[],stage:'New opportunity',smsConsent:false,aiMode:'human'};
w.leads.push(lead);
const run=(action,extra={})=>testChatAction(w,{action,leadId:lead.id,requestId:crypto.randomUUID(),...extra},now);
run('start-test-chat');assert.equal(effectiveStage(lead,w),'72 hours');assert.ok(w.messages[0].body.startsWith('Hi Alex,'));assert.equal(lead.smsConsent,false);
run('test-chat',{role:'staff',body:'Would Saturday work for a test drive?'});assert.match(w.messages.at(-1).body,/2 pm/);
run('test-chat',{role:'customer',body:'Can I get financing?'});assert.match(w.messages.at(-1).body,/reviewed by the dealership/);
const input={action:'test-chat',leadId:lead.id,requestId:crypto.randomUUID(),role:'customer',body:'What is the price?'};testChatAction(w,input,now);const count=w.messages.length;testChatAction(w,input,now);assert.equal(w.messages.length,count);
run('test-chat',{role:'customer',body:'STOP'});assert.equal(lead.testStopped,true);assert.equal(lead.smsConsent,false);assert.equal(lead.doNotContact,undefined);assert.throws(()=>run('test-chat',{role:'staff',body:'Hi'}),/stopped/);
run('start-test-chat');assert.equal(lead.testStopped,false);assert.equal(effectiveStage(lead,w),'72 hours');workspaceSchema.parse(w);
w.settings.ai.enabled=true;Object.assign(lead,{smsConsent:true,aiMode:'auto'});assert.equal(followupCandidates(w).length,0);
assert.throws(()=>testChatAction(w,{action:'start-test-chat',leadId:'missing',requestId:crypto.randomUUID()}),/test lead/);
const real={...lead,id:'real',name:'Real customer',isTest:false};w.leads.push(real);assert.throws(()=>testChatAction(w,{action:'start-test-chat',leadId:'real',requestId:crypto.randomUUID()}),/test lead/);

const base='http://127.0.0.1:5173',sign=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}),cookie=sign.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Workspace-Client':'dealer-workspace'};
const read=async()=>{const r=await fetch(base+'/api/workspace',{headers});return r.json();};
const original=await read();let revision=original.revision;
const put=(workspace)=>fetch(base+'/api/workspace',{method:'PUT',headers,body:JSON.stringify({workspace,revision})});
try{
 const work=structuredClone(original.workspace),id='PRACTICE-'+crypto.randomUUID();work.leads.push({...lead,id,name:'TEST LEAD - Practice Fixture',notes:[],isTest:false,testChat:false,testStopped:false,smsConsent:false,aiMode:'human'});const saved=await put(work);assert.equal(saved.status,200);revision=(await saved.json()).revision;
 const action=async data=>{const r=await fetch(base+'/api/crm',{method:'POST',headers,body:JSON.stringify({action:'start-test-chat',leadId:id,requestId:crypto.randomUUID(),...data})});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));revision=value.revision;return value;};
 const started=await action({});assert.equal(started.workspace.leads.find(l=>l.id===id).stage,'72 hours');
 const reply=await action({action:'test-chat',role:'customer',body:'Can I book a test drive?'});assert.match(reply.workspace.messages.at(-1).body,/confirm the appointment/);assert.equal(reply.workspace.messages.at(-1).origin,'simulation');
 const loaded=await read();assert.equal(loaded.workspace.leads.find(l=>l.id===id).testChat,true);assert.equal(loaded.workspace.leads.find(l=>l.id===id).smsConsent,false);assert.equal(loaded.connections.ai,false);
}finally{assert.equal((await put(original.workspace)).status,200);}
console.log('PASS: 72h scenario, both chat roles, scripted replies, opt-out, no fabricated consent, real-lead guard, request deduplication, persisted API messages, isolated follow-up eligibility.');
