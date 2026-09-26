(function(){
  'use strict';
let supabase;
window.__teamhubAppScriptLoaded=true;
// CosyHub 1.1.43 — bouton paramètres compact à la place du rôle.
// CosyHub 1.1.39: structure validated — modal branches are explicitly closed.
function showFatal(message){
  const gate=document.getElementById("authGate");
  const msg=document.getElementById("authMessage");
  if(gate)gate.hidden=false;
  if(msg){msg.textContent=message;msg.style.color="#b94d61";}
}
if(!window.supabase?.createClient){
  showFatal("Impossible de charger le module de connexion. Rechargez la page.");
  throw new Error("Supabase SDK indisponible");
}
if(!window.TEAMHUB_SUPABASE_URL || !window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY){
  showFatal("Configuration de connexion manquante. Rechargez la page.");
  throw new Error("Configuration Supabase indisponible");
}
supabase=window.supabase.createClient(window.TEAMHUB_SUPABASE_URL,window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,storage:window.localStorage}});

const state={role:"employee",view:"dashboard",taskFilter:"open",profile:null};
const data={tasks:[],documents:[],requests:[],reports:[]};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const content=$("#content"),pageTitle=$("#pageTitle"),roleLabel=$("#roleLabel"),roleToggle=$("#roleToggle"),themeToggle=$("#themeToggle"),sidebarUserName=$("#sidebarUserName");
const authGate=$("#authGate"),authForm=$("#authForm"),authSwitch=$("#authSwitch"),authTitle=$("#authTitle"),authMessage=$("#authMessage"),authSubmit=$("#authSubmit"),authNameWrap=$("#authNameWrap"),authName=$("#authName"),authLogout=$("#authLogout");
const titles={dashboard:"Tableau de bord",documents:"Fiches techniques",tasks:"To-do list",requests:"Besoins & interventions",reports:"Rapports hebdomadaires",settings:"Paramètres"};
let authMode=window.__teamhubAuthMode||"login";

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function dateLabel(v){return v?new Date(v+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"—";}
function late(v){return v?Math.max(0,Math.floor((Date.now()-new Date(v+"T23:59:59").getTime())/86400000)):0;}
function today(v){if(!v)return false;return new Date(v).toDateString()===new Date().toDateString();}
function can(a){return state.role==="admin"||(state.role==="manager"&&["task","document","request","report"].includes(a))||(state.role==="employee"&&a==="request");}
function priorityLabel(v){return ({normal:"Normale",high:"Haute",urgent:"Urgente"})[v]||v;}
function priorityValue(v){return ({Normale:"normal",Haute:"high",Urgente:"urgent"})[v]||"normal";}
function roleText(v){return ({admin:"Administrateur",manager:"Manager",employee:"Salarié"})[v]||"Salarié";}

function showAuth(show=true){
  authGate.hidden=!show;
  const appRoot=document.getElementById("app");
  if(appRoot)appRoot.hidden=show;
  document.body.classList.toggle("auth-open",show);
}
function setAuthMode(mode){
  authMode=mode;
  const signup=mode==="signup";
  authTitle.textContent=signup?"Créer mon compte":"Connexion";
  authMessage.textContent=signup?"Le premier compte créé devient administrateur. Les suivants sont salariés par défaut.":"Connectez-vous pour accéder à votre équipe.";
  authSubmit.textContent=signup?"Créer le compte":"Se connecter";
  authSwitch.textContent=signup?"J’ai déjà un compte":"Créer mon compte";
  authNameWrap.hidden=!signup;
  authName.required=signup;
}
function authError(msg){authMessage.textContent=msg;authMessage.style.color="#b94d61";}
function authInfo(msg){authMessage.textContent=msg;authMessage.style.color="";}

function showRuntimeError(err){
  console.error("CosyHub runtime error:",err);
  if(content){
    content.innerHTML='<div class="empty" style="text-align:left"><strong>CosyHub rencontre une erreur.</strong><br><span class="muted">'+esc(err?.message||String(err)||"Erreur inconnue")+'</span></div>';
  }
}

async function handleLogin(e){
  e.preventDefault();
  if(!authSubmit)return;
  authSubmit.disabled=true;
  try{
    const email=$("#authEmail")?.value.trim()||"";
    const password=$("#authPassword")?.value||"";
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    showAuth(false);
    await boot();
  }catch(err){authError(err?.message||"Impossible de se connecter.");}
  finally{authSubmit.disabled=false;}
}

async function handleSignup(e){
  e.preventDefault();
  const submit=$("#signupSubmit");
  if(submit)submit.disabled=true;
  try{
    const email=$("#signupEmail")?.value.trim()||"";
    const password=$("#signupPassword")?.value||"";
    const {data:result,error}=await supabase.auth.signUp({email,password});
    if(error)throw error;
    if(result?.session){
      showAuth(false);
      await boot();
    }else{
      authInfo("Compte créé. Vérifiez votre e-mail puis connectez-vous.");
      authForm?.reset();
      $("#signupForm")?.reset();
    }
  }catch(err){authError(err?.message||"Impossible de créer le compte.");}
  finally{if(submit)submit.disabled=false;}
}

authForm?.addEventListener("submit",handleLogin);
$("#signupForm")?.addEventListener("submit",handleSignup);


async function loadProfile(){
  const {data:profile,error}=await supabase.from("profiles").select("*").eq("id",(await supabase.auth.getUser()).data.user.id).single();
  if(error)throw error;
  state.profile={...profile,email:user.email||""};state.role=profile.role;
}
async function loadData(){
  const est=state.profile?.establishment_id;
  const [tasks,documents,requests,reports]=await Promise.all([
    supabase.from("tasks").select("*").order("due_date",{ascending:true}),
    supabase.from("documents").select("*").order("updated_at",{ascending:false}),
    supabase.from("requests").select("*").order("created_at",{ascending:false}),
    supabase.from("reports").select("*").order("created_at",{ascending:false})
  ]);
  for(const r of [tasks,documents,requests,reports])if(r.error)throw r.error;
  data.tasks=(tasks.data||[]).map(t=>({id:t.id,title:t.title,description:t.description,assignee:t.assigned_to,due:t.due_date,priority:t.priority,repeat:t.recurrence||"Aucune",done:t.status==="done",completedAt:t.completed_at}));
  data.documents=documents.data||[];
  data.requests=(requests.data||[]).map(r=>({id:r.id,title:r.title,kind:r.request_type,status:r.status,priority:r.priority,description:r.description}));
  data.reports=reports.data||[];
}

function taskCard(t){
  const l=late(t.due);
  return '<div class="row task-row '+(t.done?"task-done":"")+'"><input class="check" type="checkbox" data-action="toggle-task" data-id="'+esc(t.id)+'" '+(t.done?"checked":"")+'>'+
  '<div class="task-main"><strong>'+esc(t.title)+'</strong><div class="muted">'+esc(t.assigneeName||"Équipe")+' · '+dateLabel(t.due)+' · '+esc(t.repeat)+'</div>'+
  '<div class="task-meta">'+(l&&!t.done?'<span class="tag danger">'+l+' jour'+(l>1?"s":"")+' de retard</span>':"")+
  '<span class="tag">'+esc(priorityLabel(t.priority))+'</span>'+(t.done?'<span class="tag">Validée</span>':"")+'</div></div></div>';
}

function renderDashboard(){
 const open=data.tasks.filter(t=>!t.done),lateCount=open.filter(t=>late(t.due)>0).length;
 content.innerHTML='<div class="grid"><div class="card"><div class="stat-label">Tâches ouvertes</div><div class="stat-value">'+open.length+'</div><div class="stat-note">'+lateCount+' en retard</div></div>'+
 '<div class="card"><div class="stat-label">Besoins en cours</div><div class="stat-value">'+data.requests.filter(r=>r.status!=="closed").length+'</div><div class="stat-note">Demandes enregistrées</div></div>'+
 '<div class="card"><div class="stat-label">Fiches techniques</div><div class="stat-value">'+data.documents.length+'</div><div class="stat-note">Documents enregistrés</div></div>'+
 '<div class="card"><div class="stat-label">Rapport hebdo</div><div class="stat-value">'+(data.reports[0]?.week_label||"—")+'</div><div class="stat-note">'+(data.reports.length?"Dernier rapport":"À compléter")+'</div></div></div>'+
 '<div class="section-title"><h2>Mes prochaines tâches</h2><button class="btn" data-view="tasks">Voir tout</button></div>'+
 '<div class="list">'+open.slice(0,3).map(taskCard).join("")+'</div>';
}

function renderDocuments(){
 content.innerHTML='<div class="section-title"><h2>Fiches techniques</h2>'+(can("document")?'<button class="btn" data-modal="document">+ Ajouter</button>':"")+'</div>'+
 '<div class="list">'+(data.documents.length?data.documents.map(d=>'<div class="row doc-preview"><div class="pdf-icon">PDF</div><div class="doc-info"><strong>'+esc(d.title)+'</strong><div class="muted">Version '+esc(d.version)+' · '+esc(d.file_name)+'</div></div><button class="preview-btn" data-preview="'+esc(d.id)+'">Prévisualiser</button>'+(can("document")?'<div class="doc-menu-wrap"><button class="doc-menu-btn" type="button" data-doc-menu="'+esc(d.id)+'" aria-label="Options">⋯</button><div class="doc-menu" data-menu-for="'+esc(d.id)+'" hidden><button type="button" data-doc-edit="'+esc(d.id)+'">Modifier</button><button type="button" class="danger" data-doc-delete="'+esc(d.id)+'">Supprimer</button></div></div>':"")+'</div>').join(""):'<div class="empty">Aucune fiche technique.</div>')+'</div>';
}

function renderTasks(){
 const open=data.tasks.filter(t=>!t.done),done=data.tasks.filter(t=>t.done&&today(t.completedAt)),all=data.tasks;
 const list=state.taskFilter==="done"?done:state.taskFilter==="all"?all:open;
 const filter=(label,value)=>'<button class="filter-btn '+(state.taskFilter===value?"active":"")+'" data-filter="'+value+'">'+label+'</button>';
 content.innerHTML='<div class="section-title"><div><h2>Tâches</h2><div class="muted">À faire, échéances et récurrences</div></div>'+(can("task")?'<button class="btn" data-modal="task">+ Nouvelle</button>':"")+'</div>'+
 '<div class="task-filters">'+filter("À faire","open")+filter("Validées aujourd’hui","done")+filter("Toutes","all")+'</div>'+
 '<div class="task-summary"><span>'+open.length+' à faire</span><span>'+done.length+' validée'+(done.length>1?"s":"")+' aujourd’hui</span></div>'+
 '<div class="list">'+(list.length?list.map(taskCard).join(""):'<div class="empty">Aucune tâche dans cette vue.</div>')+'</div>'+
 '<div class="section-title"><h2>Planning</h2><span class="muted">Aperçu de la semaine</span></div>'+
 '<div class="mini-calendar">'+["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=>'<div class="day"><b>'+d+'</b></div>').join("")+'</div>';
}

function renderRequests(){
 content.innerHTML='<div class="section-title"><h2>Besoins & interventions</h2><button class="btn" data-modal="request">+ Nouveau besoin</button></div>'+
 '<div class="list">'+(data.requests.length?data.requests.map(r=>'<div class="row"><div><strong>'+esc(r.title)+'</strong><div class="muted">'+esc(r.kind)+' · '+esc(priorityLabel(r.priority))+'</div></div><span class="tag">'+esc(r.status)+'</span></div>').join(""):'<div class="empty">Aucune demande.</div>')+'</div>';
}
function renderSettings(){
  const p=state.profile||{};
  const email=state.profile?.email||"";
  const initials=(p.full_name||"Aloïs Monier").split(/\\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  content.innerHTML='<div class="section-title"><div><h2>Paramètres</h2><div class="muted">Gérez votre profil et les réglages de CosyHub.</div></div></div>'+
  '<div class="settings-grid">'+
  '<section class="card settings-card"><div class="settings-card-head"><div><div class="stat-label">Profil</div><h3>Mes informations</h3></div><div class="settings-avatar">'+esc(initials)+'</div></div>'+
  '<form id="profileSettingsForm" class="settings-form"><label>Nom affiché<input name="full_name" required value="'+esc(p.full_name||"")+'"></label>'+
  '<label>Email<input value="'+esc(email||"Non disponible")+'" disabled></label>'+
  '<label>Rôle<input value="'+esc(roleText(state.role))+'" disabled></label>'+
  '<button class="btn" type="submit">Enregistrer les modifications</button><p id="profileSettingsMessage" class="muted"></p></form></section><section class="card settings-card"><div class="stat-label">Sécurité</div><h3>Mot de passe</h3><form id="passwordSettingsForm" class="settings-form"><label>Nouveau mot de passe<input name="password" type="password" minlength="6" required placeholder="6 caractères minimum"></label><label>Confirmer<input name="passwordConfirm" type="password" minlength="6" required placeholder="Retapez le mot de passe"></label><button class="btn-secondary" type="submit">Modifier le mot de passe</button><p id="passwordSettingsMessage" class="muted"></p></form></section>'+
  '<section class="card settings-card"><div class="stat-label">Application</div><h3>Préférences</h3>'+
  '<div class="settings-row"><div><strong>Mode sombre</strong><div class="muted">Adapter l’affichage à vos préférences.</div></div><button type="button" class="btn-secondary" data-settings-theme>Changer</button></div>'+
  '<div class="settings-row"><div><strong>Version</strong><div class="muted">CosyHub 1.1.42</div></div></div></section>'+
  '<section class="card settings-card settings-danger"><div class="stat-label">Session</div><h3>Compte</h3><p class="muted">Déconnectez-vous de cet appareil. Vous pourrez vous reconnecter avec votre adresse e-mail et votre mot de passe.</p>'+
  '<button type="button" class="btn-danger" data-logout>Se déconnecter</button></section></div>';
}
function renderReports(){
 content.innerHTML='<div class="section-title"><h2>Rapports hebdomadaires</h2>'+(can("report")?'<button class="btn" data-modal="report">+ Nouveau rapport</button>':"")+'</div>'+
 '<div class="list">'+(data.reports.length?data.reports.map(r=>'<div class="row"><div><strong>'+esc(r.week_label)+'</strong><div class="muted">CA '+(r.revenue??"—")+' € · '+(r.clients??"—")+' clients · Note '+(r.rating??"—")+'</div></div></div>').join(""):'<div class="empty">Aucun rapport enregistré.</div>')+'</div>';
}

function render(){
 pageTitle.textContent=titles[state.view];
 ({dashboard:renderDashboard,documents:renderDocuments,tasks:renderTasks,requests:renderRequests,reports:renderReports,settings:renderSettings}[state.view]||renderDashboard)();
 $$(".nav-item,.bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=roleText(state.role);
 roleToggle.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A2 2 0 0 0 4.4 11H4.2a2 2 0 0 1 0-4h.2A2 2 0 0 0 5.8 3.6l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A2 2 0 0 0 12 4.2V4a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A2 2 0 0 0 20 11h.2a2 2 0 0 1 0 4H20a2 2 0 0 0-.6 0Z"/></svg><span>Paramètres</span>'; if(sidebarUserName)sidebarUserName.textContent=state.profile?.full_name||"Mon profil";
}

function closeModal(){const m=$("#appModal");if(m)m.remove();}
async function openPreview(id){
  const d=data.documents.find(x=>x.id===id);if(!d)return;
  const tab=window.open("about:blank","_blank");
  try{
    const {data:url,error}=await supabase.storage.from("team-documents").createSignedUrl(d.storage_path,300);
    if(error)throw error;
    if(tab)tab.location.href=url.signedUrl;
    else window.location.href=url.signedUrl;
  }catch(err){
    if(tab)tab.close();
    alert("Impossible d’ouvrir le document : "+(err?.message||"Erreur inconnue"));
  }
}
async function deleteDocument(id){
 const d=data.documents.find(x=>x.id===id);if(!d)return;
 if(!can("document"))return;
 if(!confirm('Supprimer la fiche « '+d.title+' » ?\n\nCette action est définitive.'))return;
 const {error}=await supabase.from("documents").delete().eq("id",id);
 if(error){alert("Impossible de supprimer la fiche : "+error.message);return;}
 const {error:storageError}=await supabase.storage.from("team-documents").remove([d.storage_path]);
 if(storageError)console.error("Storage delete error:",storageError);
 await loadData();render();
}
async function openModal(type){
 closeModal();
 const names={task:"Nouvelle tâche",document:"Ajouter une fiche technique","document-edit":"Modifier la fiche technique",request:"Nouveau besoin / intervention",report:"Nouveau rapport hebdomadaire"};
 let form="";
 if(type==="task")form='<label>Titre<input name="title" required placeholder="Ex. Contrôler les températures"></label><div class="form-grid"><label>Attribuer à<select name="assignee" id="assigneeSelect"></select></label><label>Date<input name="due" type="date" required></label></div><div class="form-grid"><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label><label>Récurrence<select name="repeat"><option>Aucune</option><option>Tous les jours</option><option>Chaque semaine</option><option>Chaque mois</option></select></label></div><label>Note<textarea name="note"></textarea></label>';
 if(type==="document")form='<label>Fichier<input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required></label><label>Nom<input name="name" required placeholder="Ex. Procédure ouverture"></label><label>Catégorie<select name="category"><option value="technical">Fiche technique</option><option value="procedure">Procédure</option><option value="haccp">Hygiène / HACCP</option><option value="other">Autre</option></select></label>';
 if(type==="document-edit"){const d=data.documents.find(x=>x.id===window.__editDocumentId)||{};form='<label>Nom<input name="name" required value="'+esc(d.title||"")+'"></label><label>Catégorie<select name="category"><option value="technical" '+(d.category==="technical"?"selected":"")+'>Fiche technique</option><option value="procedure" '+(d.category==="procedure"?"selected":"")+'>Procédure</option><option value="haccp" '+(d.category==="haccp"?"selected":"")+'>Hygiène / HACCP</option><option value="other" '+(d.category==="other"?"selected":"")+'>Autre</option></select></label>';
 }
 if(type==="request")form='<label>Objet<input name="title" required></label><div class="form-grid"><label>Type<select name="kind"><option>Maintenance</option><option>Matériel</option><option>Informatique</option><option>Fournisseur</option></select></label><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label></div><label>Description<textarea name="description" required></textarea>';
 if(type==="report")form='<label>Semaine<input name="week" required placeholder="S39"></label><div class="form-grid"><label>CA TTC<input name="revenue" type="number" step=".01"></label><label>Clients<input name="clients" type="number"></label></div><div class="form-grid"><label>Ticket moyen<input name="ticket" type="number" step=".01"></label><label>Note<input name="rating" type="number" step=".01"></label></div><label>Commentaires<textarea name="comments"></textarea>';
 const m=document.createElement("div");m.id="appModal";m.className="modal-backdrop";
 m.innerHTML='<div class="modal"><div class="modal-head"><div><div class="eyebrow">Équipe</div><h2>'+names[type]+'</h2></div><button class="modal-close" data-close>×</button></div><form id="modalForm" data-type="'+type+'">'+form+'<div class="modal-actions"><button type="button" class="btn-secondary" data-close>Annuler</button><button class="btn">'+(type==="document-edit"?"Enregistrer":"Créer")+'</button></div></form></div>';
 document.body.appendChild(m);
 if(type==="task"){
   const {data:people}=await supabase.from("profiles").select("id,full_name").eq("active",true).order("full_name");
   $("#assigneeSelect").innerHTML=(people||[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name)+'</option>').join("");
 }
 m.querySelector("input,select,textarea")?.focus();
}

document.addEventListener("click",async e=>{
 const close=e.target.closest("[data-close]");if(close){closeModal();return;}
 const nav=e.target.closest("[data-view]");if(nav){state.view=nav.dataset.view;render();return;}
 const modal=e.target.closest("[data-modal]");if(modal){openModal(modal.dataset.modal).catch(err=>alert("Impossible d’ouvrir le formulaire : "+(err?.message||"Erreur inconnue")));return;}
 const filter=e.target.closest("[data-filter]");if(filter){state.taskFilter=filter.dataset.filter;renderTasks();return;}
 const preview=e.target.closest("[data-preview]");if(preview){await openPreview(preview.dataset.preview);return;}
 const menu=e.target.closest("[data-doc-menu]");if(menu){document.querySelectorAll(".doc-menu").forEach(x=>x.hidden=true);const box=document.querySelector('[data-menu-for="'+menu.dataset.docMenu+'"]');if(box)box.hidden=false;return;}
 const edit=e.target.closest("[data-doc-edit]");if(edit){document.querySelectorAll(".doc-menu").forEach(x=>x.hidden=true);window.__editDocumentId=edit.dataset.docEdit;openModal("document-edit");return;}
 const del=e.target.closest("[data-doc-delete]");if(del){document.querySelectorAll(".doc-menu").forEach(x=>x.hidden=true);await deleteDocument(del.dataset.docDelete);return;}
});
document.addEventListener("click",e=>{
  if(!e.target.closest(".doc-menu-wrap"))document.querySelectorAll(".doc-menu").forEach(x=>x.hidden=true);
},true);

document.addEventListener("change",async e=>{
 if(e.target.matches('[data-action="toggle-task"]')){
   const id=e.target.dataset.id,done=e.target.checked;
   const {error}=await supabase.from("tasks").update({status:done?"done":"todo",completed_at:done?new Date().toISOString():null}).eq("id",id);
   if(error){e.target.checked=!done;alert(error.message);return;}
   await loadData();render();
 }
});
document.addEventListener("click",async e=>{
  const logout=e.target.closest("[data-logout]");
  if(logout){
    if(!confirm("Se déconnecter de CosyHub ?"))return;
    logout.disabled=true;
    const {error}=await supabase.auth.signOut();
    if(error){logout.disabled=false;alert("Impossible de se déconnecter : "+error.message);return;}
    state.profile=null;state.role="employee";data.tasks=[];data.documents=[];data.requests=[];data.reports=[];
    showAuth(true);
    return;
  }
  const theme=e.target.closest("[data-settings-theme]");
  if(theme){
    const dark=document.body.classList.toggle("dark");
    localStorage.setItem("teamhub-theme",dark?"dark":"light");
    updateThemeButton();
    renderSettings();
  }
});
document.addEventListener("submit",async e=>{
 if(e.target.id==="profileSettingsForm"){e.preventDefault(); const fd=new FormData(e.target); const name=String(fd.get("full_name")||"").trim(); if(!name)return; const {error}=await supabase.from("profiles").update({full_name:name,updated_at:new Date().toISOString()}).eq("id",state.profile.id); const msg=$("#profileSettingsMessage"); if(error){if(msg)msg.textContent=error.message;return;} state.profile.full_name=name; if(sidebarUserName)sidebarUserName.textContent=name; if(msg)msg.textContent="Profil enregistré."; return;} if(e.target.id==="passwordSettingsForm"){e.preventDefault(); const fd=new FormData(e.target); const p=String(fd.get("password")||""); const pc=String(fd.get("passwordConfirm")||""); const msg=$("#passwordSettingsMessage"); if(p!==pc){if(msg)msg.textContent="Les deux mots de passe sont différents.";return;} const {error}=await supabase.auth.updateUser({password:p}); if(msg)msg.textContent=error?error.message:"Mot de passe modifié."; if(!error)e.target.reset(); return;} if(e.target.id!=="modalForm")return;
 e.preventDefault();
 const f=e.target,fd=new FormData(f),type=f.dataset.type,est=state.profile.establishment_id,user=(await supabase.auth.getUser()).data.user;
 try{
   if(type==="task"){
     const {error}=await supabase.from("tasks").insert({establishment_id:est,title:fd.get("title"),assigned_to:fd.get("assignee")||null,created_by:user.id,due_date:fd.get("due"),priority:priorityValue(fd.get("priority")),status:"todo",recurrence:fd.get("repeat")||null,description:fd.get("note")||null});
     if(error)throw error;state.view="tasks";
   }
   if(type==="document"){
     const file=fd.get("file");const id=crypto.randomUUID();const path=est+"/"+id+"/"+file.name;
     const up=await supabase.storage.from("team-documents").upload(path,file,{upsert:false});
     if(up.error)throw up.error;
     const {error}=await supabase.from("documents").insert({id,establishment_id:est,title:fd.get("name"),category:fd.get("category"),storage_path:path,file_name:file.name,uploaded_by:user.id});
     if(error)throw error;state.view="documents";
   }
   if(type==="document-edit"){
     const id=window.__editDocumentId;const {error}=await supabase.from("documents").update({title:fd.get("name"),category:fd.get("category"),updated_at:new Date().toISOString()}).eq("id",id);
     if(error)throw error;window.__editDocumentId=null;state.view="documents";
   }
   if(type==="request"){
     const {error}=await supabase.from("requests").insert({establishment_id:est,title:fd.get("title"),description:fd.get("description"),request_type:fd.get("kind"),priority:priorityValue(fd.get("priority")),created_by:user.id});
     if(error)throw error;state.view="requests";
   }
   if(type==="report"){
     const {error}=await supabase.from("reports").insert({establishment_id:est,week_label:fd.get("week"),revenue:fd.get("revenue")||null,clients:fd.get("clients")||null,average_ticket:fd.get("ticket")||null,rating:fd.get("rating")||null,comments:fd.get("comments")||null,created_by:user.id});
     if(error)throw error;state.view="reports";
   }
   closeModal();await loadData();render();
 }catch(err){alert(err.message||"Impossible d’enregistrer.");}
});


const savedTheme=localStorage.getItem("teamhub-theme");if(savedTheme==="dark")document.body.classList.add("dark");
function updateThemeButton(){const dark=document.body.classList.contains("dark");themeToggle?.setAttribute("aria-pressed",String(dark));themeToggle?.setAttribute("aria-label",dark?"Désactiver le mode sombre":"Activer le mode sombre");}
themeToggle?.addEventListener("click",()=>{const dark=document.body.classList.toggle("dark");localStorage.setItem("teamhub-theme",dark?"dark":"light");updateThemeButton();});

let booting=false;
async function boot(){
  if(booting)return;
  booting=true;
  try{
    const {data:{session},error:sessionError}=await supabase.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session){showAuth(true);return;}

    // Show the shell immediately. Profile/data loading must never block the UI.
    showAuth(false);
    if(authLogout)authLogout.hidden=false;
    render();

    try{
      await Promise.race([
        loadProfile(),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("Le profil met trop de temps à charger.")),6000))
      ]);
      render();
    }catch(profileError){
      console.error("CosyHub profile loading error:",profileError);
      state.role="employee";
      render();
    }

    try{
      await Promise.race([
        loadData(),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("Le chargement des données prend trop de temps.")),8000))
      ]);
      render();
    }catch(dataError){
      console.error("CosyHub data loading error:",dataError);
      const section=document.getElementById("content");
      if(section){
        section.innerHTML='<div class="empty"><strong>Tableau de bord chargé.</strong><br><span class="muted">Les données n’ont pas encore pu être récupérées. Rechargez la page dans quelques secondes.</span></div>';
      }
    }
  }catch(err){
    showAuth(false);
    showRuntimeError(err);
  }finally{
    booting=false;
  }
}
window.startCosyHubApp=boot;
boot().catch(showRuntimeError);
updateThemeButton();

})();
