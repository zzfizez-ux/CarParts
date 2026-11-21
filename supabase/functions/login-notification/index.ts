// Auth verifies the bearer token. Recipients and event IDs come only from that verified login.
const headers={"Access-Control-Allow-Origin":"https://zzfizez-ux.github.io","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const reply=(status:number)=>new Response(null,{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return reply(204);
 if(req.method!=="POST")return reply(405);
 const bearer=req.headers.get("authorization")||"";
 if(!bearer.startsWith("Bearer "))return reply(401);
 try{
  const url=Deno.env.get("SUPABASE_URL");
  const check=await fetch(url+"/auth/v1/user",{headers:{authorization:bearer,apikey:req.headers.get("apikey")||""},signal:AbortSignal.timeout(6000)});
  if(!check.ok)return reply(401);
  const user=await check.json();
  const claims=JSON.parse(atob(bearer.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
  const login=claims.amr?.find((a:{method:string})=>a.method==="password");
  if(!user.email_confirmed_at||!user.email||claims.sub!==user.id||!claims.session_id||!login||Math.abs(Date.now()/1000-login.timestamp)>600)return reply(403);
  const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("CARPARTS_MAIL_FROM");
  if(!key||!from)return reply(503);
  const time=new Date(login.timestamp*1000).toLocaleString("de-DE",{timeZone:"Europe/Berlin"});
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{
   Authorization:"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"carparts-login-"+claims.session_id
  },body:JSON.stringify({from,to:[user.email],subject:"Neue Anmeldung bei CarParts",
   text:"Dein CarParts-Konto wurde am "+time+" Uhr (Berlin) angemeldet. Wenn du das warst, ist nichts zu tun. Andernfalls ändere dein Passwort über „Passwort vergessen“ auf https://zzfizez-ux.github.io/CarParts/."}),signal:AbortSignal.timeout(8000)});
  return reply(response.ok?204:502);
 }catch{return reply(503)}
});
