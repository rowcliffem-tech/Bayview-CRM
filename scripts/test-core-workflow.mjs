import assert from 'node:assert/strict';
import {workspaceSchema,emptyWorkspace} from '../lib/workspace-schema.mjs';
import {normaliseIntake,effectiveStage,saveActivity,changeActivityStatus,checkInAppointment,recordDelivery} from '../lib/crm-logic.mjs';
const w=workspaceSchema.parse(emptyWorkspace()),now=new Date(),next=new Date(now.getTime()+86400000).toISOString();
assert.deepEqual(w.activities,[],'Existing saved workspaces must acquire an empty activity list');
const lead=normaliseIntake(w,'website',{name:'Core Workflow Fixture',email:'fixture@example.com',vehicle:'2023 Toyota RAV4',externalId:'core-workflow'}).lead;w.leads.push(lead);
const task=saveActivity(w,{leadId:lead.id,type:'Follow-up',title:'Call about trade-in',at:next,rep:'Unassigned',duration:30});assert.equal(lead.stage,'New opportunity');
const appointment=saveActivity(w,{leadId:lead.id,type:'Appointment',title:'RAV4 test drive',at:next,rep:'Unassigned',duration:45});assert.equal(lead.stage,'Booked appointment');assert.equal(appointment.duration,45);
saveActivity(w,{...appointment,title:'RAV4 appointment revised'});assert.equal(w.activities.length,2,'Editing must not duplicate an appointment');
assert.throws(()=>changeActivityStatus(w,task.id,'No show'),/valid activity/);
changeActivityStatus(w,task.id,'Completed');assert.equal(task.status,'Completed');
checkInAppointment(w,appointment.id);assert.equal(w.visits.length,1);assert.equal(w.visits[0].leadId,lead.id);assert.equal(appointment.status,'Completed');assert.throws(()=>checkInAppointment(w,appointment.id),/scheduled/,'Repeated check-in must not create duplicate visits');
assert.throws(()=>saveActivity(w,{leadId:'missing',type:'Appointment'}),/opportunity/);
assert.throws(()=>saveActivity(w,{leadId:lead.id,type:'Appointment',title:'Invalid time',at:'bad',rep:'Unassigned',duration:30}),/valid date/);
const historical={...lead,id:'aged',stage:'72 hours',timerAnchor:new Date(now.getTime()-72*3600000).toISOString()};w.leads.push(historical);w.messages.push({id:'manual-in',leadId:historical.id,direction:'inbound',body:'Previous message',at:new Date(now.getTime()-3600000).toISOString(),status:'received',author:'customer',origin:'manual'});assert.equal(effectiveStage(historical,w),'72 hours','An explicitly chosen timed lane must be respected');assert.equal(effectiveStage({...historical,timerAnchor:''},w),'New opportunity','A customer reply still resets a lane without a manual timer');
w.inventory.push({id:'CORE-STOCK',vehicle:lead.vehicle,vin:'',rooftop:lead.rooftop,price:30000,cost:23000,days:0,received:now.toISOString(),km:50000,status:'Sold',reservedFor:'',reservedUntil:''});
const dealInput={inventoryId:'CORE-STOCK',leadId:lead.id,customer:lead.name,source:lead.source,type:'Retail',date:now.toISOString(),price:30000,cost:23000,recon:1000,fees:500};
const deal=recordDelivery(w,dealInput);assert.equal(deal.gross,5500);assert.equal(lead.stage,'Delivered');assert.equal(lead.aiMode,'human');assert.throws(()=>recordDelivery(w,dealInput),/already has a delivered/);assert.throws(()=>saveActivity(w,{leadId:lead.id,type:'Appointment',title:'Visit',at:next,rep:'Unassigned',duration:30}),/Reopen/);workspaceSchema.parse(w);
const invalid=structuredClone(w);invalid.activities[0].leadId='missing';assert.equal(workspaceSchema.safeParse(invalid).success,false);

const base='http://127.0.0.1:5173',sign=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}),cookie=sign.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),headers={Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Workspace-Client':'dealer-workspace'};
const read=async()=>{const r=await fetch(base+'/api/workspace',{headers});assert.equal(r.status,200);return r.json();};
const original=await read();let revision=original.revision;
const put=workspace=>fetch(base+'/api/workspace',{method:'PUT',headers,body:JSON.stringify({workspace,revision})});
try{
 const fixture=structuredClone(original.workspace),unique=crypto.randomUUID();const copy=structuredClone(w);const mapping=new Map(copy.leads.map(l=>[l.id,l.id+'-'+unique]));copy.leads.forEach(l=>{l.id=mapping.get(l.id);if(l.stockId)l.stockId+='-'+unique;});copy.inventory.forEach(u=>u.id+='-'+unique);copy.deals.forEach(d=>{d.id+='-'+unique;d.inventoryId+='-'+unique;d.leadId=mapping.get(d.leadId);});for(const key of ['messages','activities','visits'])copy[key].forEach(x=>{x.id+='-'+unique;x.leadId=mapping.get(x.leadId);});for(const key of ['leads','inventory','deals','messages','activities','visits'])fixture[key].push(...copy[key]);
 const response=await put(fixture);assert.equal(response.status,200,await response.clone().text());revision=(await response.json()).revision;
 const saved=await read();assert.equal(saved.workspace.activities.find(a=>a.id===copy.activities[0].id).status,'Completed');assert.equal(saved.workspace.visits.find(v=>v.id===copy.visits[0].id).status,'Checked in');assert.equal(saved.workspace.deals.find(d=>d.id===copy.deals[0].id).gross,5500);assert.equal(saved.workspace.leads.find(l=>l.id===copy.leads[0].id).stage,'Delivered');
 const bad=structuredClone(saved.workspace);bad.activities.push({...copy.activities[0],id:'INVALID',leadId:'missing'});assert.equal((await put(bad)).status,400);assert.equal((await read()).revision,revision,'A rejected activity must not alter saved data');
}finally{assert.equal((await put(original.workspace)).status,200,'Restore the original local workspace with revision protection');}
console.log('PASS: lead intake, dated appointments, task completion, appointment edits, single showroom check-in, manual pipeline timing, sold-to-delivered workflow, duplicate delivery prevention, schema references, durable linked save and reload.');
