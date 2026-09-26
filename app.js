const { createClient } = window.supabase;
const supabase = createClient(window.TEAMHUB_SUPABASE_URL, window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY, {
  auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
});

const state={role:"employee",view:"dashboard",taskFilter:"open",profile:null};
const data={tasks:[],documents:[],requests:[],reports:[]};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const content=$("#content"),pageTitle=$("#pageTitle"),roleLabel=$("#roleLabel"),roleToggle=$("#roleToggle"),themeToggle=$("#themeToggle");
const authGate=$("#authGate"),authForm=$("#authForm"),authSwitch=$("#authSwitch"),authTitle=$("#authTitle"),authMessage=$("#authMessage"),authSubmit=$("#authSubmit"),authNameWrap=$("#authNameWrap"),authName=$("#authName"),authLogout=$("#authLogout");
const titles={dashboard:"Tableau de bord",documents:"Fiches techniques",tasks:"To-do list",requests:"Besoins & interventions",reports:"Rapports hebdomadaires"};
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

async function authSubmitHandler(e){
  e.preventDefault();
  authSubmit.disabled=true;
  const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=authName.value.trim();
  try{
    if(authMode==="signup"){
      const {data:res,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});
      if(error)throw error;
      if(!res.session)authInfo("Compte créé. Vérifiez votre e-mail si Supabase demande une confirmation, puis connectez-vous.");
      else await boot();
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
      await boot();
    }
  }catch(err){authError(err.message||"Impossible de se connecter.");}
  finally{authSubmit.disabled=false;}
}
authForm.addEventListener("submit",authSubmitHandler);
function toggleAuthMode(){
  const next=authMode==="login"?"signup":"login";
  window.__teamhubAuthMode=next;
  setAuthMode(next);
}
authSwitch.addEventListener("click",toggleAuthMode);
authSwitch.onclick=toggleAuthMode;
authLogout.addEventListener("click",()=>supabase.auth.signOut());

async function loadProfile(){
  const {data:profile,error}=await supabase.from("profiles").select("*").eq("id",(await supabase.auth.getUser()).data.user.id).single();
  if(error)throw error;
  state.profile=profile;state.role=profile.role;
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
 '<div class="list">'+(data.documents.length?data.documents.map(d=>'<div class="row doc-preview"><div class="pdf-icon">PDF</div><div><strong>'+esc(d.title)+'</strong><div class="muted">Version '+esc(d.version)+' · '+esc(d.file_name)+'</div></div><button class="preview-btn" data-preview="'+esc(d.id)+'">Prévisualiser</button></div>').join(""):'<div class="empty">Aucune fiche technique.</div>')+'</div>';
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
function renderReports(){
 content.innerHTML='<div class="section-title"><h2>Rapports hebdomadaires</h2>'+(can("report")?'<button class="btn" data-modal="report">+ Nouveau rapport</button>':"")+'</div>'+
 '<div class="list">'+(data.reports.length?data.reports.map(r=>'<div class="row"><div><strong>'+esc(r.week_label)+'</strong><div class="muted">CA '+(r.revenue??"—")+' € · '+(r.clients??"—")+' clients · Note '+(r.rating??"—")+'</div></div></div>').join(""):'<div class="empty">Aucun rapport enregistré.</div>')+'</div>';
}

function render(){
 pageTitle.textContent=titles[state.view];
 ({dashboard:renderDashboard,documents:renderDocuments,tasks:renderTasks,requests:renderRequests,reports:renderReports}[state.view]||renderDashboard)();
 $$(".nav-item,.bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=roleText(state.role);
 roleToggle.textContent=roleText(state.role);
}

function closeModal(){const m=$("#appModal");if(m)m.remove();}
async function openPreview(id){
 const d=data.documents.find(x=>x.id===id);if(!d)return;
 const {data:url,error}=await supabase.storage.from("team-documents").createSignedUrl(d.storage_path,300);
 if(error){alert("Impossible d’ouvrir le document : "+error.message);return;}
 window.open(url.signedUrl,"_blank","noopener");
}
async function openModal(type){
 closeModal();
 const names={task:"Nouvelle tâche",document:"Ajouter une fiche technique",request:"Nouveau besoin / intervention",report:"Nouveau rapport hebdomadaire"};
 let form="";
 if(type==="task")form='<label>Titre<input name="title" required placeholder="Ex. Contrôler les températures"></label><div class="form-grid"><label>Attribuer à<select name="assignee" id="assigneeSelect"></select></label><label>Date<input name="due" type="date" required></label></div><div class="form-grid"><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label><label>Récurrence<select name="repeat"><option>Aucune</option><option>Tous les jours</option><option>Chaque semaine</option><option>Chaque mois</option></select></label></div><label>Note<textarea name="note"></textarea></label>';
 if(type==="document")form='<label>Fichier<input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required></label><label>Nom<input name="name" required placeholder="Ex. Procédure ouverture"></label><label>Catégorie<select name="category"><option value="technical">Fiche technique</option><option value="procedure">Procédure</option><option value="haccp">Hygiène / HACCP</option><option value="other">Autre</option></select></label>';
 if(type==="request")form='<label>Objet<input name="title" required></label><div class="form-grid"><label>Type<select name="kind"><option>Maintenance</option><option>Matériel</option><option>Informatique</option><option>Fournisseur</option></select></label><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label></div><label>Description<textarea name="description" required></textarea><label>Pièce jointe<input name="file" type="file"></label>';
 if(type==="report")form='<label>Semaine<input name="week" required placeholder="S39"></label><div class="form-grid"><label>CA TTC<input name="revenue" type="number" step=".01"></label><label>Clients<input name="clients" type="number"></label></div><div class="form-grid"><label>Ticket moyen<input name="ticket" type="number" step=".01"></label><label>Note<input name="rating" type="number" step=".01"></label></div><label>Commentaires<textarea name="comments"></textarea>';
 const m=document.createElement("div");m.id="appModal";m.className="modal-backdrop";
 m.innerHTML='<div class="modal"><div class="modal-head"><div><div class="eyebrow">Équipe</div><h2>'+names[type]+'</h2></div><button class="modal-close" data-close>×</button></div><form id="modalForm" data-type="'+type+'">'+form+'<div class="modal-actions"><button type="button" class="btn-secondary" data-close>Annuler</button><button class="btn">Créer</button></div></form></div>';
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
 const modal=e.target.closest("[data-modal]");if(modal){openModal(modal.dataset.modal);return;}
 const filter=e.target.closest("[data-filter]");if(filter){state.taskFilter=filter.dataset.filter;renderTasks();return;}
 const preview=e.target.closest("[data-preview]");if(preview){await openPreview(preview.dataset.preview);return;}
});
document.addEventListener("change",async e=>{
 if(e.target.matches('[data-action="toggle-task"]')){
   const id=e.target.dataset.id,done=e.target.checked;
   const {error}=await supabase.from("tasks").update({status:done?"done":"todo",completed_at:done?new Date().toISOString():null}).eq("id",id);
   if(error){e.target.checked=!done;alert(error.message);return;}
   await loadData();render();
 }
});
document.addEventListener("submit",async e=>{
 if(e.target.id!=="modalForm")return;
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

roleToggle.addEventListener("click",()=>authLogout.click());
const savedTheme=localStorage.getItem("teamhub-theme");if(savedTheme==="dark")document.body.classList.add("dark");
function updateThemeButton(){const dark=document.body.classList.contains("dark");themeToggle?.setAttribute("aria-pressed",String(dark));themeToggle?.setAttribute("aria-label",dark?"Désactiver le mode sombre":"Activer le mode sombre");}
themeToggle?.addEventListener("click",()=>{const dark=document.body.classList.toggle("dark");localStorage.setItem("teamhub-theme",dark?"dark":"light");updateThemeButton();});

async function boot(){
 try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session){showAuth(true);return;}
   await loadProfile();await loadData();
   showAuth(false);authLogout.hidden=false;render();
 }catch(err){
   showAuth(true);
   setAuthMode("login");
   const detail=err?.message||err?.details||err?.hint||"Erreur inconnue";
   authError("Erreur de chargement : "+detail);
   console.error("TeamHub boot error:",err);
 }
}
supabase.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){showAuth(true);setAuthMode("login");}else if(event==="SIGNED_IN"){boot();}});
setAuthMode("login");updateThemeButton();boot();
