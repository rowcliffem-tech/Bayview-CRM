import {workspaceAccess} from '../../../lib/workspace-access';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {workspaceSchema,emptyWorkspace} from '../../../lib/workspace-schema.mjs';
import {captureSchema,licenseProfileSchema} from '../../../lib/license-schema.mjs';
import {licenseName,maskedLicense,missingLicenseFields,populateLicenseCustomer} from '../../../lib/license-data.mjs';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type LicenseRow={id:string,owner_id:string,lead_id:string,profile_json:string,front_key:string,back_key:string,front_type:string,back_type:string,created_at:string};
export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to update a private file.'},401);const access=workspaceAccess(user);if(!access)return json({error:'Finance-file access is not enabled for this account.'},403);
 const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('x-workspace-client')!=='dealer-workspace')return json({error:'This request is not permitted.'},403);
 if(!env.DB)return json({error:'Private files are unavailable.'},503);
 let id:string,expected:string,profile;try{const bytes=await limitedBody(request);if(bytes.length>16000)return json({error:'The update is too large.'},413);const input=JSON.parse(new TextDecoder().decode(bytes));if(!uuid.test(input.id)||typeof input.expectedProfile!=='string'||input.expectedProfile.length>6000||input.reviewed!==true)throw new Error();id=input.id;expected=input.expectedProfile;profile=licenseProfileSchema.parse(input.profile);}catch{return json({error:'Review any entered dates and details. Missing fields may stay blank.'},400);}
 try{
  const db=env.DB,profileJson=JSON.stringify(profile);
  for(let attempt=0;attempt<4;attempt++){
   const file=await db.prepare('SELECT * FROM customer_licenses WHERE owner_id = ? AND id = ?').bind(access.ownerId,id).first<LicenseRow>();if(!file)return json({error:'File not found.'},404);
   if(file.profile_json===profileJson)return json({id,leadId:file.lead_id});
   if(file.profile_json!==expected)return json({error:'This file changed. Reopen it before editing again.'},409);
   const row=await db.prepare('SELECT revision,data FROM workspaces WHERE owner_id = ?').bind(access.ownerId).first<{revision:number,data:string}>();if(!row)return json({error:'Customer record not found.'},409);
   const w=workspaceSchema.parse(JSON.parse(row.data)),lead=w.leads.find((l:any)=>l.id===file.lead_id);if(!lead)return json({error:'Customer record not found.'},409);
   populateLicenseCustomer(lead,profile);const now=new Date().toISOString();lead.notes.push({text:`Reviewed customer details updated in private finance file ${id}.`,at:now});const data=JSON.stringify(workspaceSchema.parse(w));if(new TextEncoder().encode(data).length>740000)return json({error:'Workspace capacity reached.'},409);
   const save=db.prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM customer_licenses WHERE owner_id = ? AND id = ? AND profile_json = ?)').bind(data,now,access.ownerId,row.revision,access.ownerId,id,expected);
   const update=db.prepare('UPDATE customer_licenses SET profile_json = ? WHERE owner_id = ? AND id = ? AND profile_json = ? AND EXISTS (SELECT 1 FROM workspaces WHERE owner_id = ? AND revision = ? AND data = ?)').bind(profileJson,access.ownerId,id,expected,access.ownerId,row.revision+1,data);
   const results=await db.batch([save,update]);if(results[0].meta.changes&&results[1].meta.changes)return json({id,leadId:file.lead_id});
  }
  return json({error:'The customer record changed. Reopen the file and try again.'},409);
 }catch{return json({error:'The update could not be confirmed. Reopen the file to check your changes.'},409);}
}
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to access private finance files.'},401);const access=workspaceAccess(user);if(!access)return json({error:'Finance-file access is not enabled for this account.'},403);
 if(!env.DB)return json({error:'Private files are unavailable.'},503);
 try{
  const query=new URL(request.url).searchParams,id=query.get('id'),side=query.get('side');
  if(id){
   if(!uuid.test(id))return json({error:'File not found.'},404);
   const row=await env.DB.prepare('SELECT * FROM customer_licenses WHERE owner_id = ? AND id = ?').bind(access.ownerId,id).first<LicenseRow>();
   if(!row)return json({error:'File not found.'},404);
   if(side){
    if(!['front','back'].includes(side)||side==='back'&&!row.back_key||!env.BUCKET)return json({error:'Image not available.'},404);
    const image=await env.BUCKET.get(side==='front'?row.front_key:row.back_key);if(!image)return json({error:'Image not available.'},404);
    return new Response(image.body,{headers:{...privateHeaders,'Content-Type':side==='front'?row.front_type:row.back_type,'Content-Disposition':`${query.get('download')==='1'?'attachment':'inline'}; filename="licence-${side}.${(side==='front'?row.front_type:row.back_type)==='image/png'?'png':(side==='front'?row.front_type:row.back_type)==='image/webp'?'webp':'jpg'}"`}});
   }
   return json({id:row.id,leadId:row.lead_id,profile:JSON.parse(row.profile_json),createdAt:row.created_at,hasBack:!!row.back_key});
  }
  const {results}=await env.DB.prepare('SELECT id,lead_id,profile_json,created_at FROM customer_licenses WHERE owner_id = ? ORDER BY created_at DESC LIMIT 500').bind(access.ownerId).all<LicenseRow>();
  return json({files:results.map(r=>{const p=JSON.parse(r.profile_json);return {id:r.id,leadId:r.lead_id,name:licenseName(p)||'Customer — details pending',license:maskedLicense(p.licenseNumber),province:p.province,expiryDate:p.expiryDate,missingFields:missingLicenseFields(p),createdAt:r.created_at};}),storageReady:!!env.BUCKET});
 }catch{return json({error:'Private finance files could not be loaded.'},503);}
}
async function limitedBody(request:Request){
 const max=10*1024*1024;if(Number(request.headers.get('content-length')||0)>max)throw new Error('size');
 const reader=request.body?.getReader();if(!reader)throw new Error('empty');const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();throw new Error('size');}chunks.push(part.value);}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return all;
}
async function photo(value:FormDataEntryValue|null){
 if(!value||typeof value==='string'||value.size<20||value.size>4*1024*1024)throw new Error('photo');
 const bytes=new Uint8Array(await value.arrayBuffer());
 const type=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':'';
 if(!type||type!==value.type)throw new Error('photo');return {bytes,type};
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in before saving a licence.'},401);const access=workspaceAccess(user);if(!access)return json({error:'Finance-file access is not enabled for this account.'},403);
 const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('x-workspace-client')!=='dealer-workspace')return json({error:'This request is not permitted.'},403);
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return json({error:'Expected licence photos and reviewed details.'},415);
 if(!env.DB||!env.BUCKET)return json({error:'Private document storage is not connected yet.'},503);
 let data;try{const bytes=await limitedBody(request),form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();const input=captureSchema.safeParse(JSON.parse(String(form.get('details')||'')));if(!input.success)return json({error:'Check any entered dates and email, and confirm customer permission and your review. Missing details can stay blank.'},400);data={input:input.data,front:await photo(form.get('front'))};}catch(error){return json({error:error instanceof Error&&error.message==='size'?'Keep the total upload below 10 MB.':'Use a JPEG, PNG or WebP photo of the front and review any available details.'},400);}
 const {input,front}=data,db=env.DB,bucket=env.BUCKET;
 const existing=await db.prepare('SELECT id,lead_id FROM customer_licenses WHERE owner_id = ? AND id = ?').bind(access.ownerId,input.id).first<{id:string,lead_id:string}>();
 if(existing)return json({id:existing.id,leadId:existing.lead_id,duplicate:true});
 const ownerHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(access.ownerId)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const prefix=`licenses/${ownerHash}/${crypto.randomUUID()}`,frontKey=prefix+'/front',backKey=prefix+'/back',now=new Date().toISOString();let uploaded=false;
 try{
  await bucket.put(frontKey,front.bytes,{httpMetadata:{contentType:front.type,cacheControl:'private, no-store'}});uploaded=true;
  for(let attempt=0;attempt<4;attempt++){
   const row=await db.prepare('SELECT revision,data FROM workspaces WHERE owner_id = ?').bind(access.ownerId).first<{revision:number,data:string}>(),w=workspaceSchema.parse(row?JSON.parse(row.data):emptyWorkspace());
   let lead=input.leadId?w.leads.find((l:any)=>l.id===input.leadId):null;if(input.leadId&&!lead)throw new Error('lead');
   const stock=input.stockId?w.inventory.find((u:any)=>u.id===input.stockId):null;if(input.stockId&&!stock)throw new Error('stock');
   if(!lead){lead={id:'L'+crypto.randomUUID(),name:'',address:'',email:input.email,phone:input.phone,vehicle:stock?.vehicle||input.vehicle||'Vehicle not selected',source:'Walk-in',rooftop:stock?.rooftop||w.settings.locations[0],rep:w.settings.reps[0],stage:'New opportunity',created:now,timerAnchor:'',notes:[],pipeline:w.settings.pipelines[0],stockId:stock?.id||'',smsConsent:false,doNotContact:false,aiMode:'human',externalId:'',isTest:false,testChat:false,testStopped:false};w.leads.unshift(lead);}
   else{if(input.phone)lead.phone=input.phone;if(input.email)lead.email=input.email;if(stock){lead.stockId=stock.id;lead.vehicle=stock.vehicle;}}
   populateLicenseCustomer(lead,input.profile);
   lead.notes.push({text:`Front licence image and reviewed customer details saved to private finance file ${input.id}.`,at:now});
   const parsed=workspaceSchema.parse(w),workspaceData=JSON.stringify(parsed);if(new TextEncoder().encode(workspaceData).length>740000)throw new Error('capacity');const next=(row?.revision||0)+1;
   const save=row?db.prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(workspaceData,now,access.ownerId,row.revision):db.prepare('INSERT INTO workspaces (owner_id,revision,data,updated_at) VALUES (?,1,?,?) ON CONFLICT(owner_id) DO NOTHING').bind(access.ownerId,workspaceData,now);
   const insert=db.prepare('INSERT INTO customer_licenses (id,owner_id,lead_id,profile_json,front_key,back_key,front_type,back_type,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE owner_id = ? AND revision = ? AND data = ?)').bind(input.id,access.ownerId,lead.id,JSON.stringify(input.profile),frontKey,'',front.type,'',now,access.ownerId,next,workspaceData);
   const results=await db.batch([save,insert]);if(results[0].meta.changes&&results[1].meta.changes)return json({id:input.id,leadId:lead.id,duplicate:false});
  }
  throw new Error('busy');
 }catch(error){
  try{const saved=await db.prepare('SELECT id,lead_id,front_key FROM customer_licenses WHERE owner_id = ? AND id = ?').bind(access.ownerId,input.id).first<{id:string,lead_id:string,front_key:string}>();if(saved){if(saved.front_key!==frontKey)await bucket.delete([frontKey,backKey]);return json({id:saved.id,leadId:saved.lead_id,duplicate:true});}if(uploaded)await bucket.delete([frontKey,backKey]);}catch{/* Preserve uncertain uploads privately rather than deleting a possibly committed file. */}
  return json({error:error instanceof Error&&['lead','stock'].includes(error.message)?'The selected customer or stock changed. Reload and try again.':'The licence save could not be confirmed. Retry with the same photos and reviewed details.'},409);
 }
}
