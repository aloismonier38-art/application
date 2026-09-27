(function(){
  'use strict';
let supabase;
window.__teamhubAppScriptLoaded=true;
// PIZZA COSY 1.1.63 — version centralisée.
// PIZZA COSY: structure validated — modal branches are explicitly closed.
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

const APP_VERSION="1.1.64";
const state={role:"employee",view:"dashboard",taskFilter:"open",profile:null};
const data={tasks:[],documents:[],requests:[],reports:[]};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const content=$("#content"),pageTitle=$("#pageTitle"),roleLabel=$("#roleLabel"),sidebarUserName=$("#sidebarUserName");
const authGate=$("#authGate"),authForm=$("#authForm"),authSwitch=$("#authSwitch"),authTitle=$("#authTitle"),authMessage=$("#authMessage"),authSubmit=$("#authSubmit"),authNameWrap=$("#authNameWrap"),authName=$("#authName"),authLogout=$("#authLogout");
const titles={dashboard:"Tableau de bord",documents:"Fiches techniques",reports:"Rapports hebdomadaires",settings:"Paramètres"};
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
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError)throw userError;
  if(!user)throw new Error("Session utilisateur introuvable.");
  const {data:profile,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
  if(error)throw error;
  state.profile={...profile,email:user.email||""};
  state.role=profile.role;
}
async function loadData(){
  // L’interface actuelle n’utilise plus les tâches ni les demandes.
  // Ne pas les charger ici : une erreur RLS sur une ancienne table ne doit pas
  // empêcher les fiches techniques et les rapports de s’afficher.
  const [documents,reports]=await Promise.all([
    supabase.from("documents").select("*").order("updated_at",{ascending:false}),
    supabase.from("reports").select("*").order("created_at",{ascending:false})
  ]);
  if(documents.error)throw documents.error;
  if(reports.error)throw reports.error;
  data.documents=documents.data||[];
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
 content.innerHTML='<div class="grid">'+
 '<div class="card"><div class="stat-label">Fiches techniques</div><div class="stat-value">'+data.documents.length+'</div><div class="stat-note">Documents enregistrés</div></div>'+
 '<div class="card"><div class="stat-label">Rapports hebdomadaires</div><div class="stat-value">'+data.reports.length+'</div><div class="stat-note">'+(data.reports.length?"Rapports enregistrés":"À compléter")+'</div></div></div>'+
 '<div class="section-title"><h2>Bienvenue sur CosyHub</h2></div>'+
 '<div class="empty">Votre espace équipe est prêt. Utilisez les sections disponibles pour gérer les fiches techniques et les rapports.</div>';
}

function renderDocuments(){
 const reorderable=can("document");
 content.innerHTML='<div class="section-title"><div><h2>Fiches techniques</h2>'+(reorderable?'<div class="muted">Glissez-déposez les fiches pour modifier leur ordre.</div>':"")+"</div>"+(reorderable?'<button class="btn" data-modal="document">+ Ajouter</button>':"")+"</div>"+
 '<div class="list document-list">'+(data.documents.length?data.documents.map(d=>'<div class="row doc-preview" data-doc-row="'+esc(d.id)+'" '+(reorderable?'draggable="true"':"")+'><div class="doc-drag-handle" aria-hidden="true">⋮⋮</div><div class="pdf-icon">PDF</div><div class="doc-info"><strong>'+esc(d.title)+'</strong><div class="muted">Version '+esc(d.version)+' · '+esc(d.file_name)+'</div></div><button class="preview-btn" data-preview="'+esc(d.id)+'">Prévisualiser</button>'+(reorderable?'<div class="doc-menu-wrap"><button class="doc-menu-btn" type="button" data-doc-menu="'+esc(d.id)+'" aria-label="Options">⋯</button><div class="doc-menu" data-menu-for="'+esc(d.id)+'" hidden><button type="button" data-doc-edit="'+esc(d.id)+'">Modifier</button><button type="button" class="danger" data-doc-delete="'+esc(d.id)+'">Supprimer</button></div></div>':"")+'</div>').join(""):'<div class="empty">Aucune fiche technique.</div>')+'</div>';
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
  content.innerHTML='<div class="section-title"><div><h2>Paramètres</h2><div class="muted">Gérez votre profil et les réglages de PIZZA COSY.</div></div></div></div>'+
  '<div class="settings-grid">'+
  '<section class="card settings-card"><div class="settings-card-head"><div><div class="stat-label">Profil</div><h3>Mes informations</h3></div><div class="settings-avatar">'+esc(initials)+'</div></div>'+
  '<form id="profileSettingsForm" class="settings-form"><label>Nom affiché<input name="full_name" required value="'+esc(p.full_name||"")+'"></label>'+
  '<label>Email<input value="'+esc(email||"Non disponible")+'" disabled></label>'+
  '<label>Rôle<input value="'+esc(roleText(state.role))+'" disabled></label>'+
  '<button class="btn" type="submit">Enregistrer les modifications</button><p id="profileSettingsMessage" class="muted"></p></form></section><section class="card settings-card"><div class="stat-label">Sécurité</div><h3>Mot de passe</h3><form id="passwordSettingsForm" class="settings-form"><label>Nouveau mot de passe<input name="password" type="password" minlength="6" required placeholder="6 caractères minimum"></label><label>Confirmer<input name="passwordConfirm" type="password" minlength="6" required placeholder="Retapez le mot de passe"></label><button class="btn-secondary" type="submit">Modifier le mot de passe</button><p id="passwordSettingsMessage" class="muted"></p></form></section>'+
  
  '<section class="card settings-card settings-danger"><div class="stat-label">Session</div><h3>Compte</h3><p class="muted">Déconnectez-vous de cet appareil. Vous pourrez vous reconnecter avec votre adresse e-mail et votre mot de passe.</p>'+
  '<button type="button" class="btn-danger" data-logout>Se déconnecter</button></section></div>';
}
function renderReports(){
 content.innerHTML='<div class="section-title"><h2>Rapports hebdomadaires</h2>'+(can("report")?'<button class="btn" data-modal="report">+ Nouveau rapport</button>':"")+'</div>'+
 '<div class="list">'+(data.reports.length?data.reports.map(r=>'<div class="row"><div><strong>'+esc(r.week_label)+'</strong><div class="muted">CA '+(r.revenue??"—")+' € · '+(r.clients??"—")+' clients · Note '+(r.rating??"—")+'</div></div></div>').join(""):'<div class="empty">Aucun rapport enregistré.</div>')+'</div>';
}

function render(){
 pageTitle.textContent=titles[state.view];
 ({dashboard:renderDashboard,documents:renderDocuments,reports:renderReports,settings:renderSettings}[state.view]||renderDashboard)();
 $$(".nav-item,.bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=roleText(state.role);
 if(sidebarUserName)sidebarUserName.textContent=state.profile?.full_name||"Mon profil";
}

function closeModal(){const m=$("#appModal");if(m)m.remove();}
async function openPreview(id){
  const d=data.documents.find(x=>x.id===id);if(!d)return;
  const tab=window.open("about:blank","_blank");
  if(!tab){alert("Autorisez les fenêtres pop-up pour prévisualiser le document.");return;}
  const loadingHtml='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chargement — '+esc(d.title)+'</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f9f8f4;color:#205040}body{display:grid;place-items:center}.loader{text-align:center;padding:30px;max-width:420px;width:90%}.spinner{width:42px;height:42px;margin:0 auto 20px;border:4px solid #e5e2dc;border-top-color:#205040;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}h1{font-size:18px;margin:0 0 8px}p{font-size:13px;color:#748078;margin:0 0 18px}.track{height:8px;background:#e5e2dc;border-radius:999px;overflow:hidden}.bar{height:100%;width:0;background:#205040;border-radius:999px;transition:width .15s ease}.percent{margin-top:8px;font-size:12px;color:#748078}.pdf{display:none;position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff}</style></head><body><div class="loader" id="loader"><div class="spinner"></div><h1>Veuillez patienter…</h1><p id="status">Préparation du document</p><div class="track"><div class="bar" id="bar"></div></div><div class="percent" id="percent">0 %</div></div><iframe id="pdf" class="pdf" title="Prévisualisation du PDF"></iframe></body></html>';
  tab.document.open();tab.document.write(loadingHtml);tab.document.close();
  try{
    const {data:url,error}=await supabase.storage.from("team-documents").createSignedUrl(d.storage_path,600);
    if(error)throw error;
    const response=await fetch(url.signedUrl);
    if(!response.ok)throw new Error("Impossible de charger le PDF ("+response.status+").");
    const total=Number(response.headers.get("content-length"))||0;
    const reader=response.body?.getReader();
    const chunks=[];
    let loaded=0;
    const updateProgress=()=>{
      const percent=total?Math.min(99,Math.round((loaded/total)*100)):0;
      const bar=tab.document.getElementById("bar"),label=tab.document.getElementById("percent"),status=tab.document.getElementById("status");
      if(bar)bar.style.width=percent+"%";
      if(label)label.textContent=percent+" %";
      if(status)status.textContent=total?"Téléchargement du PDF…":"Chargement du PDF…";
    };
    if(reader){
      while(true){
        const part=await reader.read();
        if(part.done)break;
        chunks.push(part.value);loaded+=part.value.byteLength;updateProgress();
      }
    }else{
      chunks.push(new Uint8Array(await response.arrayBuffer()));loaded=total||chunks[0].byteLength;
    }
    const blob=new Blob(chunks,{type:"application/pdf"});
    const blobUrl=URL.createObjectURL(blob);
    const pdf=tab.document.getElementById("pdf"),loader=tab.document.getElementById("loader"),bar=tab.document.getElementById("bar"),percent=tab.document.getElementById("percent"),status=tab.document.getElementById("status");
    if(bar)bar.style.width="100%";
    if(percent)percent.textContent="100 %";
    if(status)status.textContent="Ouverture du PDF…";
    if(pdf){
      pdf.onload=()=>{
        if(loader)loader.style.display="none";
        pdf.style.display="block";
        setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
      };
      pdf.src=blobUrl;
    }
  }catch(err){
    try{
      tab.document.body.innerHTML='<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:40px;text-align:center;color:#205040"><h2>Impossible d’ouvrir le document</h2><p style="color:#748078">'+esc(err?.message||"Erreur inconnue")+'</p></div>';
    }catch(_){}
  }
}
function setUploadProgress(percent,text){
  const bar=$("#uploadProgressBar"),label=$("#uploadProgressText"),wrap=$("#uploadProgress");
  if(!wrap)return;
  wrap.hidden=false;
  if(bar)bar.style.width=Math.max(0,Math.min(100,percent))+"%";
  if(label)label.textContent=text||("Téléversement "+Math.round(percent)+" %");
  const value=wrap.querySelector(".upload-progress-head strong");
  if(value)value.textContent=Math.round(percent)+" %";
}
async function uploadDocumentWithProgress(path,file){
  const {data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(!session?.access_token)throw new Error("Session Supabase introuvable.");
  return await new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    const url=window.TEAMHUB_SUPABASE_URL+"/storage/v1/object/team-documents/"+path.split("/").map(encodeURIComponent).join("/");
    xhr.open("POST",url,true);
    xhr.setRequestHeader("Authorization","Bearer "+session.access_token);
    xhr.setRequestHeader("apikey",window.TEAMHUB_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Content-Type",file.type||"application/octet-stream");
    xhr.setRequestHeader("x-upsert","false");
    xhr.upload.onprogress=e=>{
      if(e.lengthComputable)setUploadProgress((e.loaded/e.total)*100,"Téléversement… "+Math.round((e.loaded/e.total)*100)+" %");
    };
    xhr.onload=()=>{
      if(xhr.status>=200&&xhr.status<300){
        setUploadProgress(100,"Téléversement terminé");
        resolve(true);
      }else{
        let msg="Erreur pendant l’upload ("+xhr.status+").";
        try{const body=JSON.parse(xhr.responseText);msg=body.message||body.error||msg;}catch(_){}
        reject(new Error(msg));
      }
    };
    xhr.onerror=()=>reject(new Error("Impossible de téléverser le fichier."));
    xhr.onabort=()=>reject(new Error("Téléversement annulé."));
    setUploadProgress(0,"Préparation du téléversement…");
    xhr.send(file);
  });
}

let draggingDocumentId=null;

async function persistDocumentOrder(){
  const base=Date.now();
  const results=await Promise.all(data.documents.map((d,index)=>
    supabase.from("documents").update({updated_at:new Date(base-index*1000).toISOString()}).eq("id",d.id)
  ));
  for(const result of results)if(result.error)throw result.error;
}

async function moveDocument(id,targetId){
  if(!can("document")||!id||id===targetId)return;
  const from=data.documents.findIndex(d=>d.id===id);
  const target=data.documents.findIndex(d=>d.id===targetId);
  if(from<0||target<0)return;
  const [item]=data.documents.splice(from,1);
  data.documents.splice(target,0,item);
  try{
    await persistDocumentOrder();
    render();
  }catch(err){
    await loadData();
    render();
    alert("Impossible d’enregistrer le nouvel ordre : "+(err?.message||"Erreur inconnue"));
  }
}

document.addEventListener("dragstart",e=>{
  const row=e.target.closest("[data-doc-row]");
  if(!row||!can("document"))return;
  draggingDocumentId=row.dataset.docRow;
  row.classList.add("is-dragging");
  if(e.dataTransfer){
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",draggingDocumentId);
  }
});
document.addEventListener("dragover",e=>{
  const row=e.target.closest("[data-doc-row]");
  if(!row||!draggingDocumentId||row.dataset.docRow===draggingDocumentId)return;
  e.preventDefault();
  document.querySelectorAll("[data-doc-row].drag-over").forEach(x=>x.classList.remove("drag-over"));
  row.classList.add("drag-over");
  if(e.dataTransfer)e.dataTransfer.dropEffect="move";
});
document.addEventListener("drop",async e=>{
  const row=e.target.closest("[data-doc-row]");
  if(!row||!draggingDocumentId)return;
  e.preventDefault();
  const targetId=row.dataset.docRow;
  document.querySelectorAll("[data-doc-row].drag-over").forEach(x=>x.classList.remove("drag-over"));
  const rect=row.getBoundingClientRect();
  const insertAfter=e.clientY>rect.top+rect.height/2;
  const sourceIndex=data.documents.findIndex(d=>d.id===draggingDocumentId);
  const targetIndex=data.documents.findIndex(d=>d.id===targetId);
  let adjustedTarget=targetIndex+(insertAfter?1:0);
  if(sourceIndex<adjustedTarget)adjustedTarget--;
  const [item]=data.documents.splice(sourceIndex,1);
  data.documents.splice(Math.max(0,Math.min(data.documents.length,adjustedTarget)),0,item);
  try{
    await persistDocumentOrder();
    render();
  }catch(err){
    await loadData();
    render();
    alert("Impossible d’enregistrer le nouvel ordre : "+(err?.message||"Erreur inconnue"));
  }
  draggingDocumentId=null;
});
document.addEventListener("dragend",e=>{
  const row=e.target.closest("[data-doc-row]");
  if(row)row.classList.remove("is-dragging");
  document.querySelectorAll("[data-doc-row].drag-over").forEach(x=>x.classList.remove("drag-over"));
  draggingDocumentId=null;
});

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
 m.innerHTML='<div class="modal"><div class="modal-head"><div><div class="eyebrow">Équipe</div><h2>'+names[type]+'</h2></div><button class="modal-close" data-close>×</button></div><form id="modalForm" data-type="'+type+'">'+form+'<div id="uploadProgress" class="upload-progress" hidden><div class="upload-progress-head"><span id="uploadProgressText">Préparation du téléversement…</span><strong>0 %</strong></div><div class="upload-progress-track"><div id="uploadProgressBar" class="upload-progress-bar"></div></div></div><div class="modal-actions"><button type="button" class="btn-secondary" data-close>Annuler</button><button class="btn">'+(type==="document-edit"?"Enregistrer":"Créer")+'</button></div></form></div>';
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
     const file=fd.get("file");
     if(!file||!file.size)throw new Error("Sélectionnez un fichier.");
     const id=crypto.randomUUID();
     const path=est+"/"+id+"/"+file.name;
     const submit=f.querySelector('button[type="submit"]');
     const cancel=f.querySelector('[data-close]');
     if(submit)submit.disabled=true;
     if(cancel)cancel.disabled=true;
     setUploadProgress(0,"Préparation du téléversement…");
     await uploadDocumentWithProgress(path,file);
     setUploadProgress(100,"Enregistrement de la fiche…");
     const {error}=await supabase.from("documents").insert({id,establishment_id:est,title:fd.get("name"),category:fd.get("category"),storage_path:path,file_name:file.name,uploaded_by:user.id});
     if(error){
       await supabase.storage.from("team-documents").remove([path]);
       throw error;
     }
     state.view="documents";
   }
   if(type==="document-edit"){
     const id=window.__editDocumentId;const {error}=await supabase.from("documents").update({title:fd.get("name"),category:fd.get("category")}).eq("id",id);
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


document.body.classList.remove("dark");localStorage.removeItem("teamhub-theme");

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
      console.error("PIZZA COSY profile loading error:",profileError);
      state.profile=null;
      state.role="employee";
      const section=document.getElementById("content");
      if(section){
        section.innerHTML='<div class="empty"><strong>Impossible de charger votre profil.</strong><br><span class="muted">'+esc(profileError?.message||"Erreur Supabase lors du chargement du profil.")+'</span></div>';
      }
      return;
    }

    try{
      await Promise.race([
        loadData(),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("Le chargement des données prend trop de temps.")),8000))
      ]);
      render();
    }catch(dataError){
      console.error("PIZZA COSY data loading error:",dataError);
      const section=document.getElementById("content");
      if(section){
        section.innerHTML='<div class="empty"><strong>Impossible de charger les données.</strong><br><span class="muted">'+esc(dataError?.message||"Erreur Supabase lors du chargement des données.")+'</span></div>';
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

})();
