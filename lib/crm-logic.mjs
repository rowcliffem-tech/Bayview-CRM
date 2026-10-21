export const timedStages=['New opportunity','24 hours','48 hours','72 hours'];
export const closedStages=['Lead lost / no answer','Income not approved','Sold','Delivered'];
export function threadFor(workspace,leadId){return (workspace.messages||[]).filter(x=>x.leadId===leadId&&x.status!=='discarded').sort((a,b)=>new Date(a.at)-new Date(b.at));}
export function effectiveStage(lead,workspace,now=Date.now()){
 if(!timedStages.includes(lead.stage))return lead.stage;
 const thread=threadFor(workspace,lead.id).filter(x=>x.status!=='draft'&&x.origin!=='simulation');
 const incoming=thread.filter(x=>x.direction==='inbound').at(-1);
 const outgoing=thread.filter(x=>x.direction==='outbound'&&x.status==='logged').at(-1);
 if(incoming&&(!outgoing||new Date(incoming.at)>new Date(outgoing.at))&&incoming.origin!=='intake'&&!lead.timerAnchor)return 'New opportunity';
 const age=(now-new Date(lead.timerAnchor||incoming?.at||lead.created).getTime())/3600000;
 return age>=72?'72 hours':age>=48?'48 hours':age>=24?'24 hours':'New opportunity';
}
export function followupCandidates(workspace,now=Date.now()){
 const rules=workspace.settings.ai;
 if(!rules?.enabled)return [];
 return workspace.leads.filter(lead=>{
  if(lead.isTest||/^TEST LEAD\b/i.test(lead.name)||!lead.smsConsent||lead.doNotContact||lead.aiMode==='human'||(!timedStages.includes(lead.stage)&&lead.stage!=='AI takeover'))return false;
  const thread=threadFor(workspace,lead.id),out=thread.filter(m=>m.direction==='outbound'&&m.status==='logged').at(-1),incoming=thread.filter(m=>m.direction==='inbound').at(-1);
  if(!out||incoming&&new Date(incoming.at)>=new Date(out.at))return false;
  if(thread.some(m=>m.status==='draft'))return false;
  if(thread.filter(m=>m.author==='template').length>=rules.maxDrafts)return false;
  return now-new Date(out.at).getTime()>=rules.delayHours*3600000;
 });
}
export function templateDraft(workspace,lead){return workspace.settings.ai.template.replaceAll('{firstName}',lead.name.split(' ')[0]).replaceAll('{vehicle}',lead.vehicle).replaceAll('{dealership}',workspace.settings.name);}
export function normaliseIntake(workspace,source,payload,now=new Date().toISOString()){
 const labels={website:'Website',facebook:'Facebook',instagram:'Instagram',autotrader:'AutoTrader',cargurus:'CarGurus'};
 if(!labels[source])throw new Error('Choose a supported lead source.');
 const fields=Object.fromEntries((Array.isArray(payload.field_data)?payload.field_data:[]).map(f=>[f.name,f.values?.[0]||'']));
 const p={...fields,...payload,...payload.customer};
 const value=(...keys)=>String(keys.map(k=>p[k]).find(v=>v!==undefined&&v!==null&&String(v).trim())||'').trim();
 const name=value('name','full_name','fullName')||[value('first_name'),value('last_name')].filter(Boolean).join(' ');
 const phone=value('phone','phone_number','telephone'),email=value('email','email_address');
 if(!name||(!phone&&!email))throw new Error('A lead needs a customer name and either a phone number or email.');
 const externalId=value('externalId','leadgen_id','id');
 const duplicate=externalId&&workspace.leads.find(l=>l.source===labels[source]&&l.externalId===externalId);
 if(duplicate)return {lead:duplicate,duplicate:true};
 const lead={id:'L'+crypto.randomUUID(),name,email,phone,vehicle:value('vehicle','vehicle_of_interest','model')||'Vehicle not specified',source:labels[source],rooftop:workspace.settings.locations[0],rep:workspace.settings.reps[0],stage:'New opportunity',created:now,notes:[{text:`Lead entered from ${labels[source]}.`,at:now}],pipeline:workspace.settings.pipelines[0],stockId:'',smsConsent:p.smsConsent===true,doNotContact:false,aiMode:workspace.settings.ai.enabled?workspace.settings.ai.newLeadMode:'human',externalId};
 return {lead,duplicate:false,message:value('message','comments','question')};
}

export function testChatAction(workspace,input,now=new Date().toISOString()){
 const lead=workspace.leads.find(l=>l.id===input.leadId);
 if(!lead||!(lead.isTest||/^TEST LEAD\b/i.test(lead.name)))throw new Error('Practice chat is available only for a clearly marked test lead.');
 const key='TEST-'+input.requestId;
 if(workspace.messages.some(m=>m.id===key))return {id:lead.id,duplicate:true};
 const add=(suffix,direction,body,author)=>workspace.messages.push({id:key+suffix,leadId:lead.id,direction,body,at:now,status:direction==='inbound'?'received':'simulated',author,origin:'simulation'});
 if(input.action==='start-test-chat'){
  lead.isTest=true;lead.testChat=true;lead.testStopped=false;lead.stage='72 hours';lead.timerAnchor=new Date(new Date(now).getTime()-72*3600000).toISOString();
  const firstName=lead.name.replace(/^TEST LEAD\s*[-:–]?\s*/i,'').split(' ')[0]||'there';
  add('','outbound',`Hi ${firstName}, just following up on the ${lead.vehicle}. Are you still looking, or would you like to arrange a visit?`,'simulator');
  lead.notes.push({text:'72-hour practice scenario started. Scripted replies only; no SMS or AI service used.',at:now});
 }else if(input.action==='end-test-chat'){lead.testChat=false;return {id:lead.id};}
 else{
  if(!lead.testChat)throw new Error('Start the practice scenario first.');
  if(lead.testStopped)throw new Error('This practice conversation stopped. Restart the scenario to continue.');
  const body=String(input.body||'').trim();if(!body||body.length>3000)throw new Error('Enter a test message of up to 3000 characters.');
  if(!['customer','staff'].includes(input.role))throw new Error('Choose which side of the practice conversation to play.');
  add('',input.role==='customer'?'inbound':'outbound',body,input.role==='customer'?'customer':'staff');
  const stop=/^(stop|stop all|stop texting|unsubscribe|cancel|end|quit)[.!]?$/i.test(body);
  let reply;
  if(input.role==='customer'){
   if(stop){lead.testStopped=true;reply='Understood. This practice conversation is stopped. In the connected workflow, an opt-out would block further texts.';}
   else if(/financ|credit|approv|income|payment/i.test(body))reply='I can have a team member help with financing questions. Approval and payments need to be reviewed by the dealership. Would you prefer a call or a visit?';
   else if(/price|cost|discount|best deal|\$/i.test(body))reply='A team member can confirm the current price and any applicable fees. Would you like them to review the numbers with you?';
   else if(/saturday|sunday|tomorrow|today|appointment|visit|test drive|\b(?:am|pm)\b/i.test(body))reply='Thanks! What day and time work best for a visit? A team member will need to confirm the appointment and vehicle availability.';
   else if(/not interested|already bought|no thanks/i.test(body))reply='Thanks for letting us know. Would you like the dealership to close this inquiry?';
   else reply='Thanks for getting back to us. Are you still interested in this vehicle, or has what you are looking for changed?';
  }else{
   if(/price|cost|budget|payment/i.test(body))reply='I’m hoping to stay around $30,000. Can someone confirm the total price and fees?';
   else if(/saturday|sunday|appointment|visit|test drive|\b(?:am|pm)\b/i.test(body))reply='Saturday afternoon could work for me. Is 2 pm possible, and can your team confirm the vehicle is available?';
   else if(/financ|credit|approv/i.test(body))reply='I would like to learn about financing. Can someone from your team explain the next steps?';
   else reply='Hi, yes, I’m still interested in the RAV4. Is it available, and could I come for a test drive on Saturday?';
  }
  add('-reply',input.role==='customer'?'outbound':'inbound',reply,'simulator');
 }
 return {id:lead.id,duplicate:false};
}

export function saveActivity(workspace,input,now=new Date().toISOString()){
 workspace.activities??=[];
 const lead=workspace.leads.find(l=>l.id===input.leadId);
 if(!lead)throw new Error('Choose an opportunity for this activity.');
 const existing=input.id&&workspace.activities.find(a=>a.id===input.id);
 if(input.id&&!existing)throw new Error('This activity no longer exists.');
 if(existing&&existing.leadId!==lead.id)throw new Error('Keep the original opportunity when editing an activity.');
 if(!['Appointment','Follow-up'].includes(input.type))throw new Error('Choose an appointment or follow-up.');
 if(existing?.status==='No show'&&input.type==='Follow-up')throw new Error('Change the appointment status before converting it to a follow-up.');
 const title=String(input.title||'').trim(),notes=String(input.notes||'').trim(),rep=String(input.rep||'').trim(),at=new Date(input.at),duration=Number(input.duration||30);
 if(!title||title.length>160||!rep||rep.length>160||notes.length>2000||!Number.isFinite(at.getTime())||!Number.isInteger(duration)||duration<15||duration>240)throw new Error('Enter a title, valid date, sales rep and duration between 15 and 240 minutes.');
 if(!existing&&closedStages.includes(lead.stage))throw new Error('Reopen this opportunity before scheduling a new activity.');
 const activity={id:existing?.id||'A'+crypto.randomUUID(),leadId:lead.id,type:input.type,title,at:at.toISOString(),duration,rep,rooftop:existing?.rooftop||lead.rooftop,notes,status:existing?.status||'Scheduled',created:existing?.created||now};
 if(existing)Object.assign(existing,activity);else workspace.activities.push(activity);
 if(activity.type==='Appointment'&&activity.status==='Scheduled'&&!closedStages.includes(lead.stage)){if(lead.stage!=='Approved')lead.stage='Booked appointment';lead.aiMode='human';}
 lead.notes.push({text:`${existing?'Updated':'Scheduled'} ${activity.type.toLowerCase()}: ${title}.`,at:now});
 return activity;
}
export function changeActivityStatus(workspace,id,status,now=new Date().toISOString()){
 const activity=workspace.activities?.find(a=>a.id===id),lead=activity&&workspace.leads.find(l=>l.id===activity.leadId);
 if(!activity||!lead)throw new Error('This activity is no longer available.');
 if(!['Scheduled','Completed','Cancelled','No show'].includes(status)||activity.type==='Follow-up'&&status==='No show')throw new Error('Choose a valid activity status.');
 if(status==='Scheduled'&&closedStages.includes(lead.stage))throw new Error('Reopen this opportunity before rescheduling its activity.');
 if(status===activity.status)return activity;
 activity.status=status;lead.notes.push({text:`${activity.type} ${status.toLowerCase()}: ${activity.title}.`,at:now});return activity;
}
export function checkInAppointment(workspace,id,now=new Date().toISOString()){
 const activity=workspace.activities?.find(a=>a.id===id),lead=activity&&workspace.leads.find(l=>l.id===activity.leadId);
 if(!activity||activity.type!=='Appointment'||activity.status!=='Scheduled'||!lead)throw new Error('Choose a scheduled appointment to check in.');
 const visit={id:'V'+crypto.randomUUID(),leadId:lead.id,name:lead.name,vehicle:lead.vehicle,rooftop:activity.rooftop,rep:activity.rep,status:'Checked in',at:now};
 workspace.visits.unshift(visit);changeActivityStatus(workspace,id,'Completed',now);lead.notes.push({text:'Customer arrived and was checked into the showroom.',at:now});return visit;
}
export function recordDelivery(workspace,input,now=new Date().toISOString()){
 const unit=workspace.inventory.find(u=>u.id===input.inventoryId);
 if(!unit||workspace.deals.some(d=>d.inventoryId===unit.id))throw new Error('This vehicle already has a delivered sale, or no longer exists.');
 const lead=input.leadId&&workspace.leads.find(l=>l.id===input.leadId);
 if(input.leadId&&!lead)throw new Error('Choose an existing opportunity.');
 const values=Object.fromEntries(['price','cost','recon','fees'].map(k=>[k,Number(input[k])]));
 if(Object.values(values).some(v=>!Number.isFinite(v)||v<0||v>100000000))throw new Error('Enter valid selling price and costs.');
 const date=new Date(input.date),customer=String(input.customer||'').trim(),source=String(input.source||'').trim();
 if(!Number.isFinite(date.getTime())||!customer||customer.length>160||!source||!['Retail','Wholesale'].includes(input.type))throw new Error('Enter a buyer, source, delivery date and sale type.');
 const deal={id:'D'+crypto.randomUUID(),inventoryId:unit.id,leadId:lead?.id||'',customer,vehicle:unit.vehicle,rooftop:unit.rooftop,source,date:date.toISOString(),type:input.type,...values,gross:Math.round((values.price-values.cost-values.recon-values.fees)*100)/100};
 workspace.deals.push(deal);unit.status='Sold';unit.reservedFor='';unit.reservedUntil='';
 if(lead){lead.stage='Delivered';lead.aiMode='human';lead.stockId=unit.id;lead.notes.push({text:`Delivered ${unit.vehicle}, stock ${unit.id}. Sale recorded in the deal ledger.`,at:now});}
 return deal;
}
