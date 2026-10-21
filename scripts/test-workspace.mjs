import assert from 'node:assert/strict';
import { workspaceSchema } from '../lib/workspace-schema.mjs';

const base='http://127.0.0.1:5173';
const unauth=await fetch(base+'/api/workspace');
assert.equal(unauth.status,401,'Anonymous readers must be rejected');
assert.equal((await fetch(base+'/api/workspace',{method:'PUT'})).status,401,'Anonymous writers must be rejected');
const signIn=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'});
const cookie=signIn.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
assert.ok(cookie,'Local sign-in must return its development cookie');
const read=async()=>{const r=await fetch(base+'/api/workspace',{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
const put=(workspace,revision,origin=base)=>fetch(base+'/api/workspace',{method:'PUT',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-Workspace-Client':'dealer-workspace'},body:JSON.stringify({workspace,revision})});
const original=await read(),fixture=structuredClone(original.workspace),now=new Date().toISOString();
let latestRevision=original.revision;
const token=crypto.randomUUID();
const unit={id:'TEST-'+token,rooftop:fixture.settings.locations[0],vehicle:'2023 QA Demo Vehicle',vin:'',price:30000,cost:22000,days:0,received:now,km:25000,status:'Sold'};
fixture.inventory.push(unit);
fixture.deals.push({id:'TEST-D-'+token,rooftop:unit.rooftop,inventoryId:unit.id,leadId:'',customer:'Fictional test customer',vehicle:unit.vehicle,source:'Walk-in',price:30000,cost:22000,recon:1000,fees:500,gross:6500,date:now,type:'Retail'});
assert.ok(workspaceSchema.safeParse(fixture).success,'Linked stock and a balanced sale must validate');
const unbalanced=structuredClone(fixture);unbalanced.deals.at(-1).gross=99999;
assert.equal((await put(unbalanced,original.revision)).status,400,'Incorrect gross must be rejected');
const duplicate=structuredClone(fixture);duplicate.deals.push({...fixture.deals.at(-1),id:'SECOND-'+token});
assert.equal((await put(duplicate,original.revision)).status,400,'A stock unit cannot be delivered twice');
assert.equal((await put(fixture,original.revision,'https://untrusted.example')).status,403,'Cross-origin writes must fail');
const missingHeader=await fetch(base+'/api/workspace',{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({workspace:fixture,revision:original.revision})});
assert.equal(missingHeader.status,403,'Requests without the same-origin client header must fail');
try{
 const saved=await put(fixture,original.revision);assert.equal(saved.status,200);latestRevision=(await saved.json()).revision;
 const stored=await read();assert.equal(stored.revision,latestRevision);assert.equal(stored.workspace.inventory.find(x=>x.id===unit.id).status,'Sold');assert.equal(stored.workspace.deals.find(x=>x.inventoryId===unit.id).gross,6500);
 assert.equal((await put(original.workspace,original.revision)).status,409,'A stale browser must not overwrite the latest revision');
 const afterConflict=await read();assert.equal(afterConflict.revision,latestRevision);assert.ok(afterConflict.workspace.deals.some(x=>x.inventoryId===unit.id),'Stale write must leave the committed sale intact');
 console.log('PASS: anonymous reads/writes, invalid gross, duplicate sale, origin checks, client header, durable linked sale, stale revision protection.');
}finally{
 // Restore only the exact pre-test local fixture, with CAS protection against
 // any concurrent change. This script never targets the hosted database.
 const restored=await put(original.workspace,latestRevision);assert.equal(restored.status,200,'Test cleanup must not overwrite concurrent changes');
}
