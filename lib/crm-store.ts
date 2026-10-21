import { env } from 'cloudflare:workers';
import { emptyWorkspace, workspaceSchema } from './workspace-schema.mjs';
export async function mutateWorkspace(ownerId:string,mutate:(workspace:any)=>any){
 if(!env.DB)throw new Error('The saved workspace database is unavailable.');
 for(let attempt=0;attempt<4;attempt++){
  const row=await env.DB.prepare('SELECT revision, data FROM workspaces WHERE owner_id = ?').bind(ownerId).first<{revision:number,data:string}>();
  const workspace=workspaceSchema.parse(row?JSON.parse(row.data):emptyWorkspace()),result=mutate(workspace),parsed=workspaceSchema.safeParse(workspace);
  if(!parsed.success)throw new Error(parsed.error.issues[0].message);
  const data=JSON.stringify(parsed.data),at=new Date().toISOString();
  if(new TextEncoder().encode(data).length>740000)throw new Error('Workspace storage limit reached. Export your records before adding more.');
  const saved=row?await env.DB.prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(data,at,ownerId,row.revision).run():await env.DB.prepare('INSERT INTO workspaces (owner_id, revision, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(owner_id) DO NOTHING').bind(ownerId,data,at).run();
  if(saved.meta.changes)return {workspace:parsed.data,result,revision:(row?.revision||0)+1,updatedAt:at};
 }
 throw new Error('The workspace is busy. Please retry.');
}
