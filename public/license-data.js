export const licenseName=p=>[p.firstName,p.middleName,p.lastName].filter(Boolean).join(' ').trim();
export const licenseAddress=p=>[p.street,p.street2,p.city,p.province,p.postalCode,p.country].filter(Boolean).join(', ');
export const maskedLicense=value=>value?'•••• '+String(value).slice(-4):'Not entered';
export const missingLicenseFields=p=>[['firstName','First name'],['lastName','Last name'],['dateOfBirth','Date of birth'],['licenseNumber','Licence number'],['street','Street address'],['city','City'],['province','Province'],['postalCode','Postal code'],['expiryDate','Expiry date']].filter(([key])=>!p[key]).map(([,label])=>label);
export function populateLicenseCustomer(lead,profile){
 const name=licenseName(profile),address=licenseAddress(profile);
 if(name&&(profile.firstName&&profile.lastName||!lead.name||lead.name==='Customer — details pending'))lead.name=name.slice(0,160);
 if(!lead.name)lead.name=name||'Customer — details pending';
 // A partial scan must not erase a customer's existing address.
 if(profile.street||!lead.address&&(profile.city||profile.postalCode))lead.address=address.slice(0,500);
}
