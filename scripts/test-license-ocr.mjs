import assert from 'node:assert/strict';
import {parseLicenseText} from '../lib/license-ocr.mjs';
import {captureSchema,licenseProfileSchema} from '../lib/license-schema.mjs';
import {populateLicenseCustomer,missingLicenseFields} from '../lib/license-data.mjs';
const card=extra=>'ONTARIO DRIVER LICENCE\nSURNAME: DEMO\nGIVEN NAMES: ALEX JAMIE LEE\nADDRESS: 100 DEMO STREET\nTORONTO ON M5V 1A1\n'+extra;
for(const line of ['DOB: 1990/01/15','3.1990 / 1 / 15','3 1990-01-15','DATE DE NAISSANCE / DATE OF BIRTH\n1990.01.15','Date of birth / Date de naissance\nYYYY/MM/DD\n1990/01/15','D.O.B. 199O/0I/I5']){
 const p=parseLicenseText(card(line));assert.equal(p.dateOfBirth,'1990-01-15',line);assert.equal(p.firstName,'ALEX');assert.equal(p.middleName,'JAMIE LEE');assert.equal(p.lastName,'DEMO');
}
for(const number of ['A1234-12345-12345','A1234 - 12345 - 12345','A1234 12345 12345','A12341234512345','A1234–12345–12345','A1234-12O45-I2345']){
 const p=parseLicenseText(card('DL No: '+number));assert.equal(p.licenseNumber,number.includes('12O45')?'A1234-12045-12345':'A1234-12345-12345',number);
}
assert.equal(parseLicenseText(card('3. DOB\n4a. 2020/01/15\n4b. 2030/01/15')).dateOfBirth,'','Never substitute issue or expiry for missing birth date');
assert.equal(parseLicenseText(card('DOB: 1990/02/31\nEXPIRY: 2030/01/15')).dateOfBirth,'');
assert.equal(parseLicenseText(card('2030/01/15')).dateOfBirth,'','Unlabelled dates stay uncertain');
const hyphen=parseLicenseText(card('DOB: 1990/01/15').replace('ALEX JAMIE LEE','ALEX-JAMIE LEE'));assert.equal(hyphen.firstName,'ALEX-JAMIE');assert.equal(hyphen.middleName,'LEE');
const separate=parseLicenseText('SURNAME: DEMO\nFIRST NAME: ALEX\nMIDDLE NAME: JAMIE\nDOB: 1990/01/15');assert.equal(separate.firstName,'ALEX');assert.equal(separate.middleName,'JAMIE');
const combined=parseLicenseText('1,2 NAME/NOM\nDEMO,\nALEX. JAMIE\n8 100 DEMO STREET\nTORONTO ON M5V 1A1\n3 DOB/DDN 1990/01/15\n4d NUMBER A1234-12345-12345');assert.equal(combined.firstName,'ALEX');assert.equal(combined.middleName,'JAMIE');assert.equal(combined.lastName,'DEMO');assert.equal(combined.dateOfBirth,'1990-01-15');
const dotted=parseLicenseText('SURNAME: DEMO,\nGIVEN NAMES: ALEX.JAMIE\n3 DOB/DDN 1990/01/15');assert.equal(dotted.firstName,'ALEX');assert.equal(dotted.middleName,'JAMIE');
assert.equal(parseLicenseText('SURNAME: DEMO\nGIVEN NAMES: ALEX\nb 100 DEMO STREET').street,'100 DEMO STREET','An OCR B for the printed address-field number must not hide a valid address');
const blank=licenseProfileSchema.parse({});assert.ok(missingLicenseFields(blank).includes('Date of birth'));captureSchema.parse({id:crypto.randomUUID(),profile:blank,permission:true,reviewed:true});assert.equal(licenseProfileSchema.safeParse({...blank,dateOfBirth:'1990-02-31'}).success,false);
const known={name:'Existing Customer',address:'100 EXISTING STREET'};populateLicenseCustomer(known,blank);assert.equal(known.name,'Existing Customer');assert.equal(known.address,'100 EXISTING STREET');
const fresh={name:'',address:''};populateLicenseCustomer(fresh,blank);assert.equal(fresh.name,'Customer — details pending');assert.equal(fresh.address,'');
console.log('PASS: separate middle names, labelled/numbered/bilingual birth dates, OCR date and DL lookalikes, no expiry substitution, valid optional fields and preservation of existing customer details.');
