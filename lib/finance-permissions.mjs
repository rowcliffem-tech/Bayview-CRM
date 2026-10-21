export function financeChangesAllowed(before,after){
 const old=structuredClone(before),next=structuredClone(after);
 if(old.leads.length!==next.leads.length)return false;
 for(let i=0;i<old.leads.length;i++){
  const a=old.leads[i],b=next.leads[i];if(a.id!==b.id)return false;
  for(const key of ['stage','timerAnchor','aiMode','notes'])a[key]=b[key];
 }
 if(old.inventory.length!==next.inventory.length)return false;
 for(let i=0;i<old.inventory.length;i++){
  const a=old.inventory[i],b=next.inventory[i];if(a.id!==b.id)return false;
  if(a.status!==b.status){if(b.status!=='Sold'||!next.leads.some(l=>l.stockId===b.id&&['Sold','Delivered'].includes(l.stage)))return false;a.status=b.status;a.reservedFor=b.reservedFor;a.reservedUntil=b.reservedUntil;}
 }
 return JSON.stringify(old)===JSON.stringify(next);
}
