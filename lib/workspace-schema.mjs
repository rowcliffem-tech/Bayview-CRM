import { z } from 'zod';

const text=z.string().trim().min(1).max(160);
const id=z.string().min(1).max(100);
const date=z.string().datetime({offset:true});
const amount=z.number().finite().min(0).max(100000000);
const base={id,rooftop:text};
export const opportunityStages=['New opportunity','24 hours','48 hours','72 hours','AI takeover','Lead lost / no answer','Income not approved','Booked appointment','Test drive','In finance','Approved','Sold','Delivered'];
const stage=z.preprocess(v=>({New:'New opportunity',Working:'New opportunity',Appointment:'Booked appointment',Showed:'Booked appointment'}[String(v)]||v),z.enum(opportunityStages));
const lead=z.object({...base,name:text,address:z.string().max(500).default(''),email:z.union([z.literal(''),z.string().email().max(160)]),phone:z.string().max(40),vehicle:text,source:text,rep:text,stage,created:date,timerAnchor:z.union([z.literal(''),date]).default(''),notes:z.array(z.object({text:z.string().trim().min(1).max(2000),at:date})).max(300),pipeline:text.default('Vehicle sales'),stockId:z.string().max(100).default(''),smsConsent:z.boolean().default(false),doNotContact:z.boolean().default(false),aiMode:z.enum(['human','assist','auto']).default('human'),externalId:z.string().max(200).default(''),isTest:z.boolean().default(false),testChat:z.boolean().default(false),testStopped:z.boolean().default(false)});
const inventory=z.object({...base,vehicle:text,vin:z.string().max(17).default(''),price:amount,cost:amount,days:z.number().int().min(0).max(10000),received:date,km:z.number().int().min(0).max(3000000),status:z.enum(['Available','Recon','Reserved','Sold']),reservedFor:z.string().max(100).default(''),reservedUntil:z.union([z.literal(''),date]).default('')});
const deal=z.object({...base,inventoryId:id,leadId:z.string().max(100).default(''),customer:text,vehicle:text,source:text,price:amount,cost:amount,recon:amount,fees:amount,gross:z.number().finite().min(-100000000).max(100000000),date,type:z.enum(['Retail','Wholesale'])});
const visit=z.object({...base,leadId:z.string().max(100),name:text,vehicle:text,rep:text,status:z.enum(['Checked in','Test drive','At the desk','Completed']),at:date});
const marketing=z.object({...base,source:text,amount,date});
const activity=z.object({...base,leadId:id,type:z.enum(['Appointment','Follow-up']),title:text,at:date,duration:z.number().int().min(15).max(240).default(30),rep:text,status:z.enum(['Scheduled','Completed','Cancelled','No show']).default('Scheduled'),notes:z.string().max(2000).default(''),created:date});
const message=z.object({id,leadId:id,direction:z.enum(['inbound','outbound']),body:z.string().trim().min(1).max(3000),at:date,status:z.enum(['received','draft','logged','discarded','simulated']),author:z.enum(['customer','staff','template','simulator']),origin:z.enum(['manual','intake','sample','simulation']).default('manual')});
const aiRules=z.object({enabled:z.boolean().default(false),newLeadMode:z.enum(['human','assist','auto']).default('human'),delayHours:z.number().int().min(72).max(720).default(72),maxDrafts:z.number().int().min(1).max(5).default(2),template:z.string().trim().min(1).max(1500).default('Hi {firstName}, just following up on the {vehicle}. Are you still looking, or would you like to book a visit? — {dealership}'),instructions:z.string().max(3000).default('Be helpful and brief. Do not promise credit approval, discounts or availability. Hand off to a person for pricing or financing decisions.')});
export const workspaceSchema=z.object({
  version:z.literal(2),
  settings:z.object({name:text,locations:z.array(text).min(1).max(30),reps:z.array(text).min(1).max(100),pipelines:z.array(text).min(1).max(12).default(['Vehicle sales','Financing','Trade-ins']),ai:aiRules.default({})}),
  leads:z.array(lead).max(3000),inventory:z.array(inventory).max(3000),deals:z.array(deal).max(3000),visits:z.array(visit).max(3000),marketing:z.array(marketing).max(3000),messages:z.array(message).max(3000).default([]),activities:z.array(activity).max(3000).default([])
}).superRefine((data,ctx)=>{
  for(const key of ['leads','inventory','deals','visits','marketing','messages','activities']){
    const ids=data[key].map(x=>x.id);if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',path:[key],message:'Duplicate record IDs.'});
  }
  const stock=new Map(data.inventory.map(x=>[x.id,x])),leads=new Map(data.leads.map(x=>[x.id,x])),sold=new Set();
  data.deals.forEach((d,i)=>{
    const unit=stock.get(d.inventoryId);
    if(!unit||unit.status!=='Sold'||unit.rooftop!==d.rooftop)ctx.addIssue({code:'custom',path:['deals',i],message:'A deal must match a sold inventory unit at the same dealership.'});
    if(sold.has(d.inventoryId))ctx.addIssue({code:'custom',path:['deals',i],message:'This inventory unit already has a delivered deal.'});
    sold.add(d.inventoryId);
    if(d.leadId&&!leads.has(d.leadId))ctx.addIssue({code:'custom',path:['deals',i],message:'Linked lead does not exist.'});
    if(Math.abs(d.gross-(d.price-d.cost-d.recon-d.fees))>0.01)ctx.addIssue({code:'custom',path:['deals',i,'gross'],message:'Gross must equal price less cost, recon and fees.'});
  });
  data.inventory.forEach((u,i)=>{if(u.reservedFor&&!leads.has(u.reservedFor))ctx.addIssue({code:'custom',path:['inventory',i],message:'Reservation customer does not exist.'});});
  data.visits.forEach((v,i)=>{if(v.leadId&&!leads.has(v.leadId))ctx.addIssue({code:'custom',path:['visits',i],message:'Linked lead does not exist.'});});
  data.activities.forEach((a,i)=>{const l=leads.get(a.leadId);if(!l)ctx.addIssue({code:'custom',path:['activities',i],message:'The activity must link to an existing opportunity.'});if(a.type==='Follow-up'&&a.status==='No show')ctx.addIssue({code:'custom',path:['activities',i],message:'Only appointments can be marked no show.'});});
  data.messages.forEach((m,i)=>{if(!leads.has(m.leadId))ctx.addIssue({code:'custom',path:['messages',i],message:'Conversation opportunity does not exist.'});if(m.direction==='inbound'&&m.status!=='received')ctx.addIssue({code:'custom',path:['messages',i],message:'Incoming messages must be recorded as received.'});});
});
export const emptyWorkspace=()=>({version:2,settings:{name:'My dealership',locations:['Main store'],reps:['Unassigned']},leads:[],inventory:[],deals:[],visits:[],marketing:[]});
export const requestSchema=z.object({revision:z.number().int().min(0),workspace:workspaceSchema});
