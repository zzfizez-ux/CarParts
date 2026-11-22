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
 let mode='login', user=null, busy=false, client, recoveryVerified=false;
 function show(modeName,message=''){
  mode=modeName;
  title.textContent=modes[mode][0]; primary.textContent=modes[mode][1];
  status.textContent=message;
  for(const [field,visible] of [[email,['login','signup','recover','verify'].includes(mode)],
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
 button.onclick=()=>{show(recoveryVerified?'reset':user?'account':'login');open()};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{password.value='';code.value=''});
 dialog.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{if(!busy)show(el.dataset.go)});

 const page=new URL(location.href);
 const fromCodeLink=page.searchParams.get('account')==='recovery';
 const fragment=new URLSearchParams(page.hash.slice(1));
 const invalidFragment=fragment.get('error_code')==='otp_expired';
 const invalidQuery=page.searchParams.get('error_code')==='otp_expired';
 if(fromCodeLink||invalidFragment||invalidQuery){
  if(fromCodeLink)page.searchParams.delete('account');
  if(invalidFragment)page.hash='';
  if(invalidQuery){
   for(const key of ['error','error_code','error_description','sb'])page.searchParams.delete(key);
  }
  history.replaceState(history.state,'',page.href);
  if(invalidFragment||invalidQuery){
   show('recover','Der Link ist ungültig oder abgelaufen. Fordere einen neuen Code an.');
  }else{
   show('verify');
  }
  open();
 }

 function failure(error){
  if(error.status===429)return 'Zu viele Versuche. Bitte warte einen Moment.';
  if(error.code==='email_not_confirmed')return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if(mode==='verify'){
   if(error.code==='otp_expired'||error.status===400||error.status===403){
    code.value='';
    return 'Der Code ist ungültig oder abgelaufen. Du kannst einen neuen anfordern.';
   }
   return 'Der Code konnte gerade nicht geprüft werden. Bitte versuche es erneut.';
  }
  if(mode==='login')return 'Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse und Passwort.';
  return 'Der Vorgang konnte nicht abgeschlossen werden. '+(error.message||'Bitte versuche es erneut.');
 }
 async function init(){
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');
  const {url,publishableKey}=window.CARPARTS_SUPABASE_CONFIG;
  client=createClient(url,publishableKey,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'carparts-account-v1'}
  });
  client.auth.onAuthStateChange((event,session)=>{
   user=session?.user||null;
   button.textContent=user?'Mein Konto':'Anmelden';
   if(event==='PASSWORD_RECOVERY'&&user){
    recoveryVerified=true;
    show('reset');
    open();
   }else if(event==='SIGNED_OUT'){
    recoveryVerified=false;
    if(dialog.open)show('login');
   }
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
    show('verify','Wenn zu dieser E-Mail-Adresse ein Konto besteht, schicken wir dir einen Einmalcode.');
   }else if(action==='verify'){
    const {data,error}=await client.auth.verifyOtp({email:address,token:code.value.trim(),type:'recovery'});
    if(error)throw error;
    if(!data?.session?.user)throw Error('Keine bestätigte Sitzung.');
    recoveryVerified=true;
    show('reset');
   }else if(action==='reset'){
    if(!recoveryVerified){
     show('recover','Fordere einen Code an, um ein neues Passwort zu wählen.');
     return;
    }
    const {error}=await client.auth.updateUser({password:password.value});if(error)throw error;
    recoveryVerified=false;
    show('account','Dein neues Passwort wurde gespeichert.');
   }else{
    const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
    email.value='';show('login','Du bist auf diesem Gerät abgemeldet.');
   }
  }catch(e){status.textContent=failure(e)}
  finally{busy=false;primary.disabled=false}
 };
})();
