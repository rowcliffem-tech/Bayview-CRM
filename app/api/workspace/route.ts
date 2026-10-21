import {workspaceAccess} from '../../../lib/workspace-access';
import {financeChangesAllowed} from '../../../lib/finance-permissions.mjs';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { emptyWorkspace, requestSchema, workspaceSchema } from '../../../lib/workspace-schema.mjs';

export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return json({error:'Sign in to access your dealership.'},401);
  const access=workspaceAccess(user);if(!access)return json({error:'This account does not have dealership access.'},403);
  if(!env.DB)return json({error:'The saved workspace database is unavailable.'},503);
  try{
    const row=await env.DB.prepare('SELECT revision, data, updated_at FROM workspaces WHERE owner_id = ?').bind(access.ownerId).first<{revision:number,data:string,updated_at:string}>();
    return json({workspace:workspaceSchema.parse(row?JSON.parse(row.data):emptyWorkspace()),revision:row?.revision??0,updatedAt:row?.updated_at??null,user:{name:user.fullName||user.email,role:access.role},connections:{sms:false,ai:false,website:false,meta:false,marketplaces:false}});
  }catch{return json({error:'The saved workspace could not be loaded. Please retry.'},503);}
}

export async function PUT(request:Request){
  const user=await getChatGPTUser();
  if(!user)return json({error:'Sign in before saving records.'},401);
  const access=workspaceAccess(user);if(!access)return json({error:'This account does not have dealership access.'},403);
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('x-workspace-client')!=='dealer-workspace')return json({error:'This save request is not permitted.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Expected JSON.'},415);
  if(!env.DB)return json({error:'The saved workspace database is unavailable.'},503);
  if(Number(request.headers.get('content-length')||0)>750000)return json({error:'Workspace size limit reached. Export your records before adding more.'},413);
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>750000)return json({error:'Workspace size limit reached. Export your records before adding more.'},413);
    let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
    const parsed=requestSchema.safeParse(input);
    if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Invalid workspace records.'},400);
    const {revision,workspace}=parsed.data;
    if(access.role==='finance'){const prior=await env.DB.prepare('SELECT data FROM workspaces WHERE owner_id = ?').bind(access.ownerId).first<{data:string}>();if(!prior||!financeChangesAllowed(workspaceSchema.parse(JSON.parse(prior.data)),workspace))return json({error:'Finance access can update process stages and notes. Store settings, inventory entry and financial records require the owner.'},403);}
    const at=new Date().toISOString(),data=JSON.stringify(workspace);
    const result=revision===0
      ?await env.DB.prepare('INSERT INTO workspaces (owner_id, revision, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(owner_id) DO NOTHING').bind(access.ownerId,data,at).run()
      :await env.DB.prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(data,at,access.ownerId,revision).run();
    if(!result.meta.changes)return json({error:'Your workspace changed in another tab. Reload the latest records before saving again.'},409);
    return json({revision:revision+1,updatedAt:at});
  }catch{return json({error:'Your records could not be saved. Please retry.'},503);}
}
