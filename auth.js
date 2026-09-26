(function(){
  "use strict";
  const $=s=>document.querySelector(s);
  const gate=$("#authGate"),loginForm=$("#authForm"),signupForm=$("#signupForm");
  const message=$("#authMessage"),loginSubmit=$("#authSubmit"),signupSubmit=$("#signupSubmit"),logout=$("#authLogout");
  let client=null,appLoaded=false,appLoading=false;

  function setMessage(text,error=false){
    if(message){message.textContent=text;message.style.color=error?"#b94d61":"";}
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
    script.src="app.js?v=35";
    script.onload=async()=>{
      appLoaded=true;appLoading=false;
      if(typeof window.startCosyHubApp==="function"){
        try{await window.startCosyHubApp();}
        catch(err){console.error(err);showFatal(err?.message||"Erreur de démarrage.");}
      }else{
        showFatal("Le moteur CosyHub n’est pas disponible.");
      }
    };
    script.onerror=()=>{appLoading=false;showFatal("Impossible de charger le moteur CosyHub.");};
    document.body.appendChild(script);
  }

  async function handleLogin(e){
    e.preventDefault();
    if(!client){showFatal("La connexion à Supabase n’est pas disponible.");return;}
    loginSubmit.disabled=true;
    try{
      const email=$("#authEmail")?.value.trim()||"";
      const password=$("#authPassword")?.value||"";
      const result=await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      hideAuth();loadApp();
    }catch(err){
      console.error("CosyHub login error:",err);
      setMessage(err?.message||"Impossible de se connecter.",true);
    }finally{loginSubmit.disabled=false;}
  }

  async function handleSignup(e){
    e.preventDefault();
    if(!client){showFatal("La connexion à Supabase n’est pas disponible.");return;}
    signupSubmit.disabled=true;
    try{
      const email=$("#signupEmail")?.value.trim()||"";
      const password=$("#signupPassword")?.value||"";
      const result=await client.auth.signUp({email,password});
      if(result.error)throw result.error;
      if(result.data.session){
        hideAuth();loadApp();
      }else{
        setMessage("Compte créé. Vérifiez votre e-mail puis connectez-vous.");
        loginForm?.reset();signupForm?.reset();
      }
    }catch(err){
      console.error("CosyHub signup error:",err);
      setMessage(err?.message||"Impossible de créer le compte.",true);
    }finally{signupSubmit.disabled=false;}
  }

  async function init(){
    loginForm?.addEventListener("submit",handleLogin);
    signupForm?.addEventListener("submit",handleSignup);
    logout?.addEventListener("click",()=>client?.auth.signOut());
    showAuth();
    try{
      if(!window.supabase?.createClient)throw new Error("Le module Supabase n’a pas été chargé.");
      if(!window.TEAMHUB_SUPABASE_URL||!window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY)throw new Error("La configuration Supabase est manquante.");
      client=window.supabase.createClient(window.TEAMHUB_SUPABASE_URL,window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,storage:window.localStorage}});
      window.teamHubSupabase=client;
      client.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")showAuth();});
      const session=await client.auth.getSession();
      if(session.error)throw session.error;
      if(session.data.session){hideAuth();loadApp();}
    }catch(err){
      console.error("CosyHub auth init error:",err);
      setMessage(err?.message||"Impossible d’initialiser la connexion.",true);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();