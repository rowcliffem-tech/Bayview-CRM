export function roleForIdentity(user,ownerId){
 const email=String(user?.email||'').toLowerCase();
 if(user?.userId===ownerId&&email==='mrowcliffe@me.com')return 'owner';
 if(user?.userId&&email==='rowcliffem@gmail.com')return 'finance';
 return null;
}
