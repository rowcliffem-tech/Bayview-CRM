import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import {mobileHtml} from '../../ui/mobile-template';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getChatGPTUser();if(!user)return Response.redirect(new URL(chatGPTSignInPath('/mobile'),request.url),302);return new Response(mobileHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(self), microphone=(), geolocation=()'}});}
