import {workspaceAccess} from '../../../lib/workspace-access';
import {opportunityStages} from '../../../lib/workspace-schema.mjs';
import { getChatGPTUser } from '../../chatgpt-auth';
import { mutateWorkspace } from '../../../lib/crm-store';
import { normaliseIntake,followupCandidates,templateDraft,testChatAction } from '../../../lib/crm-logic.mjs';
import { z } from 'zod';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to use the CRM.'},401);const access=workspaceAccess(user);if(!access)return json({error:'This account does not have dealership access.'},403);
 const origin=request.headers.get('origin');
 if((origin&&origin!==new URL(request.url).origin)||request.headers.get('x-workspace-client')!=='dealer-workspace')return json({error:'This request is not permitted.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Expected JSON.'},415);
 try{
  const raw=await request.text();if(new TextEncoder().encode(raw).length>20000)return json({error:'The request is too large.'},413);
  const input=JSON.parse(raw),now=new Date().toISOString();
  if(input.action==='set-process-stage'){
   const parsed=z.object({leadId:z.string().min(1).max(100),stage:z.enum(opportunityStages as [string,...string[]])}).parse(input);
   const result=await mutateWorkspace(access.ownerId,w=>{const lead=w.leads.find((l:any)=>l.id===parsed.leadId);if(!lead)throw new Error('Customer not found.');if(w.deals.some((d:any)=>d.leadId===lead.id)&&parsed.stage!=='Delivered')throw new Error('This customer has a recorded delivery. Correct the financial record before reopening.');const previous=lead.stage;lead.stage=parsed.stage;lead.timerAnchor='';lead.aiMode='human';if(['Sold','Delivered'].includes(parsed.stage)&&lead.stockId){const stock=w.inventory.find((u:any)=>u.id===lead.stockId);if(stock){stock.status='Sold';stock.reservedFor='';stock.reservedUntil='';}}lead.notes.push({text:'Process stage changed from '+previous+' to '+parsed.stage+'.',at:now});return {id:lead.id,stage:lead.stage};});return json(result);
  }
  if(access.role!=='owner')return json({error:'This action requires dealership owner access.'},403);
  if(input.action==='intake'){
   const parsed=z.object({source:z.enum(['website','facebook','instagram','autotrader','cargurus']),payload:z.record(z.unknown())}).parse(input);
   const result=await mutateWorkspace(access.ownerId,w=>{const item=normaliseIntake(w,parsed.source,parsed.payload,now);if(!item.duplicate){w.leads.unshift(item.lead);if(item.message)w.messages.push({id:'M'+crypto.randomUUID(),leadId:item.lead.id,direction:'inbound',body:item.message,at:now,status:'received',author:'customer',origin:'intake'});}return {id:item.lead.id,duplicate:item.duplicate};});
   return json(result);
  }
  if(input.action==='prepare-followups'){
   const rooftop=z.string().max(160).optional().parse(input.rooftop);
   const result=await mutateWorkspace(access.ownerId,w=>{const candidates=followupCandidates(w).filter((l:any)=>!rooftop||rooftop==='all'||l.rooftop===rooftop);for(const lead of candidates){w.messages.push({id:'M'+crypto.randomUUID(),leadId:lead.id,direction:'outbound',body:templateDraft(w,lead),at:now,status:'draft',author:'template',origin:'manual'});lead.stage='AI takeover';}return {prepared:candidates.length};});return json(result);
  }
  if(['start-test-chat','test-chat','end-test-chat'].includes(input.action)){
   const parsed=z.object({action:z.enum(['start-test-chat','test-chat','end-test-chat']),leadId:z.string().min(1).max(100),requestId:z.string().uuid(),role:z.enum(['staff','customer']).optional(),body:z.string().trim().min(1).max(3000).optional()}).parse(input);
   const result=await mutateWorkspace(access.ownerId,w=>testChatAction(w,parsed,now));return json(result);
  }
  return json({error:'Unknown CRM action.'},400);
 }catch(error){return json({error:error instanceof Error?error.message:'CRM action failed.'},400);}
}
