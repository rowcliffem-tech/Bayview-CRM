import {z} from 'zod';
const field=z.string().trim().max(160).default('');
const day=z.string().refine(v=>v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Enter a valid date or leave it blank.').default('');
export const licenseProfileSchema=z.object({firstName:field,middleName:field,lastName:field,street:field,street2:field,city:field,province:field,postalCode:field,country:z.enum(['CAN','USA']).default('CAN'),dateOfBirth:day,expiryDate:day,licenseNumber:z.string().trim().max(60).default('')});
export const captureSchema=z.object({id:z.string().uuid(),leadId:z.string().max(100).default(''),profile:licenseProfileSchema,phone:z.string().trim().max(40).default(''),email:z.union([z.literal(''),z.string().email().max(160)]).default(''),vehicle:field.default('Vehicle not selected'),stockId:z.string().max(100).default(''),permission:z.literal(true),reviewed:z.literal(true)});
