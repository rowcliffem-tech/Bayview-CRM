import type {ChatGPTUser} from '../app/chatgpt-auth';
import {roleForIdentity} from './team-access.mjs';
// Site-scoped identity resolved from the existing saved dealership, not a client field.
const ownerId="px4vIIcMLBEx7UomKmFSILqPAUgZYIlzY9o5qeh1U3Zo28CgNEOzeu";
export function workspaceAccess(user:ChatGPTUser){
 if(import.meta.env.DEV)return {ownerId:user.userId,role:'owner' as const};
 const role=roleForIdentity(user,ownerId);return role?{ownerId,role}:null;
}
