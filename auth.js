(function(){
  "use strict";
  const $=s=>document.querySelector(s);
  const gate=$("#authGate"),form=$("#authForm"),switchBtn=$("#authSwitch");
  const title=$("#authTitle"),message=$("#authMessage"),submitButton=$("#authSubmit");
  const logout=$("#authLogout");
  let mode="login",client=null,appLoaded=false,appLoading=false;

  function setMessage(text,error=false){
    if(message){message.textContent=text;message.style.color=error?"#b94d61":"";}
  }
  function setMode(next){
    mode=next;
    const signup=mode==="signup";
    if(title)title.textContent=signup?"Créer mon compte":"Connexion";
    setMessage(signup?"Créez votre compte pour rejoindre l’équipe.":"Connectez-vous pour accéder à votre équipe.");
    if(submitButton)submitButton.textContent=signup?"Créer le compte":"Se connecter";
    if(switchBtn)switchBtn.textContent=signup?"J’ai déjà un compte":"Créer mon compte";
  }
  function showAuth(){
    if(gate)gate.hidden=false;
    const app=$("#app");if(app)app.hidden=true;
    document.body.classList.add("auth-open");
  }
  function hideAuth(){
    if(gate)gate.hidden=true;
    const app=$("#app");if(app)app.hidden=false;
    document.body.classList.remove("auth-open");
  }
  function showFatal(text){showAuth();setMessage(text,true);}

  function loadApp(){
    if(appLoaded||appLoading)return;
    appLoading=true;
    const script=document.createElement("script");
    script.src="app.js?v=22";
    script.onload=async()=>{
      appLoaded=true;appLoading=false;
      if(typeof window.startTeamHubApp==="function"){
        try{await window.startTeamHubApp();}
        catch(err){console.error(err);showFatal(err?.message||"Erreur de démarrage.");}
      }else{
        showFatal("Le moteur TeamHub n’est pas disponible.");
      }
    };
    script.onerror=()=>{appLoading=false;showFatal("Impossible de charger le moteur TeamHub.");};
    document.body.appendChild(script);
  }

  async function init(){
    // Bind the UI first. The signup switch must never depend on Supabase or app.js.
    switchBtn?.addEventListener("click",()=>setMode(mode==="login"?"signup":"login"));
    form?.addEventListener("submit",async e=>{
      e.preventDefault();
      if(!client){showFatal("La connexion à Supabase n’est pas disponible.");return;}
      submitButton.disabled=true;
      try{
        const email=$("#authEmail")?.value.trim()||"";
        const password=$("#authPassword")?.value||"";
        if(mode==="signup"){
          const result=await client.auth.signUp({email,password});
          if(result.error)throw result.error;
          if(result.data.session){
            setMessage("Compte créé. Ouverture de TeamHub…");
            hideAuth();
            loadApp();
          }else{
            setMessage("Compte créé. Vérifiez votre e-mail puis connectez-vous.");
            setMode("login");
          }
        }else{
          const result=await client.auth.signInWithPassword({email,password});
          if(result.error)throw result.error;
          hideAuth();
          loadApp();
        }
      }catch(err){
        console.error("TeamHub authentication error:",err);
        setMessage(err?.message||"Impossible de créer le compte.",true);
      }finally{submitButton.disabled=false;}
    });
    logout?.addEventListener("click",()=>client?.auth.signOut());
    showAuth();

    try{
      if(!window.supabase?.createClient)throw new Error("Le module Supabase n’a pas été chargé.");
      if(!window.TEAMHUB_SUPABASE_URL||!window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY)throw new Error("La configuration Supabase est manquante.");
      client=window.supabase.createClient(window.TEAMHUB_SUPABASE_URL,window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,storage:window.localStorage}});
      window.teamHubSupabase=client;
      client.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT"){showAuth();setMode("login");}});
      const session=await client.auth.getSession();
      if(session.error)throw session.error;
      if(session.data.session){hideAuth();loadApp();}else setMode("login");
    }catch(err){
      console.error("TeamHub auth init error:",err);
      setMessage(err?.message||"Impossible d’initialiser la connexion.",true);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();