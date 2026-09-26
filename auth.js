(function(){
  "use strict";

  const $=s=>document.querySelector(s);
  const gate=$("#authGate");
  const loginForm=$("#authForm");
  const loginSwitch=$("#authSwitch");
  const loginMessage=$("#authMessage");
  const loginButton=$("#authSubmit");
  const logout=$("#authLogout");

  const signupModal=$("#signupModal");
  const signupForm=$("#signupForm");
  const signupClose=$("#signupClose");
  const signupCancel=$("#signupCancel");
  const signupMessage=$("#signupMessage");
  const signupButton=$("#signupSubmit");

  let client=null;
  let appLoaded=false;
  let appLoading=false;

  function setLoginMessage(text,error=false){
    if(loginMessage){loginMessage.textContent=text;loginMessage.style.color=error?"#b94d61":"";}
  }
  function setSignupMessage(text,error=false){
    if(signupMessage){signupMessage.textContent=text;signupMessage.style.color=error?"#b94d61":"";}
  }
  function openSignup(){
    if(!signupModal)return;
    signupModal.hidden=false;
    signupModal.setAttribute("aria-hidden","false");
    document.body.classList.add("signup-open");
    setSignupMessage("Créez votre compte pour rejoindre l’équipe.");
    setTimeout(()=>$("#signupName")?.focus(),0);
  }
  function closeSignup(){
    if(!signupModal)return;
    signupModal.hidden=true;
    signupModal.setAttribute("aria-hidden","true");
    document.body.classList.remove("signup-open");
  }
  function showAuth(){
    if(gate)gate.hidden=false;
    document.body.classList.add("auth-open");
  }
  function hideAuth(){
    if(gate)gate.hidden=true;
    const appRoot=$("#app");
    if(appRoot)appRoot.hidden=false;
    document.body.classList.remove("auth-open");
  }
  function showFatal(text){
    showAuth();
    setLoginMessage(text,true);
  }

  function loadApp(){
    if(appLoaded||appLoading)return;
    appLoading=true;
    const script=document.createElement("script");
    script.src="app.js?v=16";
    script.onload=async()=>{
      appLoaded=true;
      appLoading=false;
      if(typeof window.startTeamHubApp==="function")await window.startTeamHubApp();
      else showFatal("Le module TeamHub n’a pas pu démarrer.");
    };
    script.onerror=()=>{appLoading=false;showFatal("Impossible de charger l’application TeamHub.");};
    document.body.appendChild(script);
  }

  async function openSession(){
    const result=await client.auth.getSession();
    if(result.error)throw result.error;
    if(result.data.session)loadApp();
    else showAuth();
  }

  async function login(e){
    e.preventDefault();
    if(!client)return showFatal("La connexion à Supabase n’est pas disponible.");
    loginButton.disabled=true;
    try{
      const email=$("#authEmail")?.value.trim()||"";
      const password=$("#authPassword")?.value||"";
      const result=await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      closeSignup();
      hideAuth();
      loadApp();
    }catch(err){
      console.error("TeamHub login error:",err);
      setLoginMessage(err?.message||"Impossible de se connecter.",true);
    }finally{loginButton.disabled=false;}
  }

  async function signup(e){
    e.preventDefault();
    if(!client){setSignupMessage("La connexion à Supabase n’est pas disponible.",true);return;}
    signupButton.disabled=true;
    try{
      const name=$("#signupName")?.value.trim()||"";
      const email=$("#signupEmail")?.value.trim()||"";
      const password=$("#signupPassword")?.value||"";
      const confirm=$("#signupPasswordConfirm")?.value||"";
      if(password!==confirm)throw new Error("Les deux mots de passe ne correspondent pas.");
      const result=await client.auth.signUp({email,password,options:{data:{full_name:name}}});
      if(result.error)throw result.error;
      if(result.data.session){
        closeSignup();
        hideAuth();
        loadApp();
      }else{
        setSignupMessage("Compte créé. Vérifiez votre e-mail puis connectez-vous.");
        signupForm.reset();
      }
    }catch(err){
      console.error("TeamHub signup error:",err);
      setSignupMessage(err?.message||"Impossible de créer le compte.",true);
    }finally{signupButton.disabled=false;}
  }

  async function init(){
    // The signup window is deliberately bound before any Supabase check.
    // The button must always open even if a backend is temporarily unavailable.
    loginSwitch?.addEventListener("click",openSignup);
    signupClose?.addEventListener("click",closeSignup);
    signupCancel?.addEventListener("click",closeSignup);
    signupModal?.addEventListener("click",e=>{if(e.target.matches("[data-signup-close]"))closeSignup();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSignup();});
    loginForm?.addEventListener("submit",login);
    signupForm?.addEventListener("submit",signup);
    logout?.addEventListener("click",()=>client?.auth.signOut());

    showAuth();

    try{
      if(!window.supabase?.createClient)throw new Error("Le module Supabase n’a pas été chargé.");
      if(!window.TEAMHUB_SUPABASE_URL||!window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY)throw new Error("La configuration Supabase est manquante.");
      client=window.supabase.createClient(
        window.TEAMHUB_SUPABASE_URL,
        window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY,
        {auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}
      );
      window.teamHubSupabase=client;
      window.teamHubShowAuth=showAuth;
      window.teamHubHideAuth=hideAuth;
      client.auth.onAuthStateChange(event=>{
        if(event==="SIGNED_OUT"){showAuth();closeSignup();}
      });
      await openSession();
    }catch(err){
      console.error("TeamHub auth init error:",err);
      setLoginMessage(err?.message||"Impossible d’initialiser la connexion.",true);
    }
  }

  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();