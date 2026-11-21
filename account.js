(() => {
 const button = document.getElementById('accountButton');
 const dialog = document.getElementById('accountDialog');
 const form = dialog.querySelector('form');
 const title = dialog.querySelector('h2');
 const status = dialog.querySelector('[role=status]');
 const email = form.elements.email, password = form.elements.password, code = form.elements.code;
 const primary = form.querySelector('[type=submit]');
 const modes = {
  login:['Anmelden','Anmelden'], signup:['Konto erstellen','Registrieren'],
  recover:['Passwort vergessen','Code anfordern'], verify:['E-Mail-Code eingeben','Code prüfen'],
  reset:['Neues Passwort wählen','Passwort speichern'], account:['Mein Konto','Abmelden']
 };
 let mode='login', user=null, busy=false, client;
 function show(modeName,message=''){
  mode=modeName;
  title.textContent=modes[mode][0]; primary.textContent=modes[mode][1];
  status.textContent=message;
  for(const [field,visible] of [[email,['login','signup','recover'].includes(mode)],
    [password,['login','signup','reset'].includes(mode)],[code,mode==='verify']]){
   field.disabled=!visible;field.closest('label').hidden=!visible;
  }
  password.value='';code.value='';
  password.autocomplete=mode==='login'?'current-password':'new-password';
  password.minLength=mode==='login'?1:8;
  dialog.querySelectorAll('[data-modes]').forEach(el=>el.hidden=!el.dataset.modes.split(' ').includes(mode));
  dialog.querySelector('[data-identity]').textContent=mode==='account'?user?.email||'':'';
 }
 function open(){if(!dialog.open)dialog.showModal()}
 button.onclick=()=>{show(user?'account':'login');open()};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{password.value='';code.value=''});
 dialog.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{if(!busy)show(el.dataset.go)});
 function failure(error){
  if(error.status===429)return 'Zu viele Versuche. Bitte warte einen Moment.';
  if(error.code==='email_not_confirmed')return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if(mode==='verify')return 'Der Code ist ungültig oder abgelaufen. Du kannst einen neuen anfordern.';
  if(mode==='login')return 'Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.';
  return 'Der Vorgang konnte nicht abgeschlossen werden. '+(error.message||'Bitte versuche es erneut.');
 }
 async function init(){
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');
  client=createClient('https://umhzxsryqhwzxrmkbmwp.supabase.co','sb_publishable_NHGz3NHOpX97VDO2GLd08w_5kCpkYHI',{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'carparts-account-v1'}
  });
  client.auth.onAuthStateChange((event,session)=>{
   user=session?.user||null;
   button.textContent=user?'Mein Konto':'Anmelden';
   if(event==='PASSWORD_RECOVERY'){show('reset');open()}
   else if(event==='SIGNED_OUT'&&dialog.open){show('login')}
   else if(!busy&&dialog.open&&user&&mode==='login')show('account');
  });
  return client;
 }
 let ready=init().catch(()=>null);
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  busy=true;primary.disabled=true;status.textContent='Bitte warten …';
  const action=mode;
  try{
   if(!await ready){ready=init().catch(()=>null);if(!await ready)throw Error('Der Kontodienst ist nicht erreichbar.')}
   const address=email.value.trim();
   const redirect=new URL('./',location.href).href;
   if(action==='login'){
    const {data,error}=await client.auth.signInWithPassword({email:address,password:password.value});
    if(error)throw error;
    user=data.user;show('account','Du bist auf diesem Gerät angemeldet.');
    const res=await client.functions.invoke('login-notification',{body:{}});
    if(res.error)status.textContent='Du bist angemeldet. Die Anmeldebenachrichtigung konnte nicht versendet werden.';
   }else if(action==='signup'){
    const {data,error}=await client.auth.signUp({email:address,password:password.value,options:{emailRedirectTo:redirect}});
    if(error)throw error;
    if(data.session){user=data.user;show('account','Dein Konto ist bereit.')}
    else show('login','Öffne die Bestätigungsmail, um deine E-Mail-Adresse zu bestätigen.');
   }else if(action==='recover'){
    const {error}=await client.auth.resetPasswordForEmail(address,{redirectTo:redirect});
    if(error)throw error;
    show('verify','Wenn ein Konto zu dieser Adresse existiert, erhältst du eine E-Mail. Gib den Code hier ein oder öffne den Link in der Nachricht.');
   }else if(action==='verify'){
    const {error}=await client.auth.verifyOtp({email:address,token:code.value.trim(),type:'recovery'});
    if(error)throw error;show('reset');
   }else if(action==='reset'){
    const {error}=await client.auth.updateUser({password:password.value});if(error)throw error;
    show('account','Dein neues Passwort wurde gespeichert.');
   }else{
    const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
    email.value='';show('login','Du bist auf diesem Gerät abgemeldet.');
   }
  }catch(e){status.textContent=failure(e)}
  finally{busy=false;primary.disabled=false}
 };
})();
