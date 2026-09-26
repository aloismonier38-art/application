(function(){
  "use strict";

  const $=s=>document.querySelector(s);
  const gate=$("#authGate");
  const form=$("#authForm");
  const switchBtn=$("#authSwitch");
  const title=$("#authTitle");
  const message=$("#authMessage");
  const submit=$("#authSubmit");
  const nameWrap=$("#authNameWrap");
  const nameInput=$("#authName");
  const logout=$("#authLogout");

  let mode="login";
  let client=null;
  let appLoaded=false;
  let appLoading=false;

  function setMessage(text,error=false){
    if(message){
      message.textContent=text;
      message.style.color=error?"#b94d61":"";
    }
  }

  function setMode(next){
    mode=next;
    const signup=mode==="signup";
    if(title)title.textContent=signup?"Créer mon compte":"Connexion";
    setMessage(signup
      ?"Le premier compte créé devient administrateur. Les suivants sont salariés par défaut."
      :"Connectez-vous pour accéder à votre équipe.");
    if(submit)submit.textContent=signup?"Créer le compte":"Se connecter";
    if(switchBtn)switchBtn.textContent=signup?"J’ai déjà un compte":"Créer mon compte";
    if(nameWrap)nameWrap.hidden=!signup;
    if(nameInput)nameInput.required=signup;
  }

  function showAuth(){
    if(gate)gate.hidden=false;
    document.body.classList.add("auth-open");
  }

  function hideAuth(){
    if(gate)gate.hidden=true;
    document.body.classList.remove("auth-open");
  }

  function showFatal(text){
    showAuth();
    setMessage(text,true);
  }

  function loadApp(){
    if(appLoaded||appLoading)return;
    appLoading=true;
    const script=document.createElement("script");
    script.src="app.js?v=14";
    script.onload=async()=>{
      appLoaded=true;
      appLoading=false;
      if(typeof window.startTeamHubApp==="function"){
        await window.startTeamHubApp();
      }else{
        showFatal("Le module TeamHub n’a pas pu démarrer.");
      }
    };
    script.onerror=()=>{
      appLoading=false;
      showFatal("Impossible de charger l’application TeamHub. Vérifiez la connexion puis rechargez.");
    };
    document.body.appendChild(script);
  }

  async function openSession(){
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(data.session){
      loadApp();
    }else{
      showAuth();
      setMode("login");
    }
  }

  async function submit(e){
    e.preventDefault();
    if(!client)return showFatal("Le module de connexion n’est pas disponible.");
    submit.disabled=true;
    const email=$("#authEmail")?.value.trim()||"";
    const password=$("#authPassword")?.value||"";
    const fullName=nameInput?.value.trim()||"";

    try{
      if(mode==="signup"){
        if(!fullName)throw new Error("Indiquez votre nom complet.");
        const result=await client.auth.signUp({
          email,
          password,
          options:{data:{full_name:fullName}}
        });
        if(result.error)throw result.error;
        if(!result.data.session){
          setMessage("Compte créé. Vérifiez votre e-mail avant de vous connecter.");
          return;
        }
        hideAuth();
        loadApp();
      }else{
        const result=await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        hideAuth();
        loadApp();
      }
    }catch(err){
      console.error("TeamHub authentication error:",err);
      setMessage(err?.message||"Impossible de se connecter.",true);
    }finally{
      submit.disabled=false;
    }
  }

  async function init(){
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

      form?.addEventListener("submit",submit);
      switchBtn?.addEventListener("click",()=>setMode(mode==="login"?"signup":"login"));
      logout?.addEventListener("click",()=>client.auth.signOut());

      client.auth.onAuthStateChange((event)=>{
        if(event==="SIGNED_OUT"){
          showAuth();
          setMode("login");
        }
      });

      await openSession();
    }catch(err){
      console.error("TeamHub auth init error:",err);
      showFatal(err?.message||"Impossible d’initialiser la connexion.");
    }
  }

  window.addEventListener("DOMContentLoaded",init,{once:true});
})();