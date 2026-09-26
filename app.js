const state={role:"admin",view:"dashboard",taskFilter:"open"};
const data={
 tasks:[
  {id:1,title:"Contrôler les températures",assignee:"Aloïs Monier",due:"2026-09-26",priority:"Haute",repeat:"Tous les jours",done:false},
  {id:2,title:"Commander les consommables",assignee:"Hugo",due:"2026-09-27",priority:"Normale",repeat:"Chaque semaine",done:false},
  {id:3,title:"Mettre à jour l'affichage",assignee:"Léa",due:"2026-09-30",priority:"Normale",repeat:"Aucune",done:false},
  {id:4,title:"Vérifier les extincteurs",assignee:"Charline",due:"2026-09-20",priority:"Haute",repeat:"Chaque mois",done:false}
 ],
 documents:["Fiche pâte","Procédure ouverture","Procédure fermeture","Fiche allergènes"],
 requests:[
  {title:"Réparation imprimante cuisine",kind:"Maintenance",status:"En cours"},
  {title:"Nouveau terminal de paiement",kind:"Matériel",status:"Nouveau"}
 ]
};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const content=$("#content"),pageTitle=$("#pageTitle"),roleLabel=$("#roleLabel"),roleToggle=$("#roleToggle");
const titles={dashboard:"Tableau de bord",documents:"Fiches techniques",tasks:"To-do list",requests:"Besoins & interventions",reports:"Rapports hebdomadaires"};

function dateLabel(v){return new Date(v+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"});}
function late(v){return Math.max(0,Math.floor((Date.now()-new Date(v+"T23:59:59").getTime())/86400000));}
function today(v){if(!v)return false;const d=new Date(v),n=new Date();return d.toDateString()===n.toDateString();}
function can(a){return state.role==="admin"||(state.role==="manager"&&["task","document","request","report"].includes(a))||(state.role==="employee"&&a==="request");}

function taskCard(t){
 const l=late(t.due);
 return '<div class="row task-row '+(t.done?"task-done":"")+'">'+
 '<input class="check" type="checkbox" data-action="toggle-task" data-id="'+t.id+'" '+(t.done?"checked":"")+ '>'+
 '<div class="task-main"><strong>'+t.title+'</strong><div class="muted">'+t.assignee+' · '+dateLabel(t.due)+' · '+t.repeat+'</div>'+
 '<div class="task-meta">'+(l&&!t.done?'<span class="tag danger">'+l+' jour'+(l>1?"s":"")+' de retard</span>':"")+
 '<span class="tag">'+t.priority+'</span>'+(t.done?'<span class="tag green">Validée</span>':"")+
 '</div></div></div>';
}

function renderDashboard(){
 const open=data.tasks.filter(t=>!t.done),lateCount=open.filter(t=>late(t.due)>0).length;
 content.innerHTML='<div class="grid">'+
 '<div class="card"><div class="stat-label">Tâches ouvertes</div><div class="stat-value">'+open.length+'</div><div class="stat-note">'+lateCount+' en retard</div></div>'+
 '<div class="card"><div class="stat-label">Besoins en cours</div><div class="stat-value">'+data.requests.length+'</div><div class="stat-note">Demandes enregistrées</div></div>'+
 '<div class="card"><div class="stat-label">Fiches techniques</div><div class="stat-value">'+data.documents.length+'</div><div class="stat-note">Aperçus disponibles</div></div>'+
 '<div class="card"><div class="stat-label">Rapport hebdo</div><div class="stat-value">S39</div><div class="stat-note">À compléter</div></div></div>'+
 '<div class="section-title"><h2>Mes prochaines tâches</h2><button class="btn" data-view="tasks">Voir tout</button></div>'+
 '<div class="list">'+open.slice(0,3).map(taskCard).join("")+'</div>';
}

function renderDocuments(){
 content.innerHTML='<div class="section-title"><h2>Fiches techniques</h2>'+
 (can("document")?'<button class="btn" data-modal="document">+ Ajouter</button>':"")+'</div>'+
 '<div class="list">'+data.documents.map((d,i)=>
 '<div class="row doc-preview"><div class="pdf-icon">PDF</div><div><strong>'+d+'</strong><div class="muted">Version 1.'+(i+1)+' · Mise à jour récente</div></div>'+
 '<button class="preview-btn" data-preview="'+d.replaceAll('"','&quot;')+'">Prévisualiser</button></div>'
 ).join("")+'</div>';
}

function renderTasks(){
 const open=data.tasks.filter(t=>!t.done),done=data.tasks.filter(t=>t.done&&today(t.completedAt)),all=data.tasks;
 const list=state.taskFilter==="done"?done:state.taskFilter==="all"?all:open;
 const filter=(label,value)=>'<button class="filter-btn '+(state.taskFilter===value?"active":"")+'" data-filter="'+value+'">'+label+'</button>';
 content.innerHTML='<div class="section-title"><div><h2>Tâches</h2><div class="muted">À faire, échéances et récurrences</div></div>'+
 (can("task")?'<button class="btn" data-modal="task">+ Nouvelle</button>':"")+'</div>'+
 '<div class="task-filters">'+filter("À faire","open")+filter("Validées aujourd’hui","done")+filter("Toutes","all")+'</div>'+
 '<div class="task-summary"><span>'+open.length+' à faire</span><span>'+done.length+' validée'+(done.length>1?"s":"")+' aujourd’hui</span></div>'+
 '<div class="list">'+(list.length?list.map(taskCard).join(""):'<div class="empty">Aucune tâche dans cette vue.</div>')+'</div>'+
 '<div class="section-title"><h2>Planning</h2><span class="muted">Aperçu de la semaine</span></div>'+
 '<div class="mini-calendar">'+["Lun 28","Mar 29","Mer 30","Jeu 1","Ven 2","Sam 3","Dim 4"].map(d=>'<div class="day"><b>'+d+'</b></div>').join("")+'</div>';
}

function renderRequests(){
 content.innerHTML='<div class="section-title"><h2>Besoins & interventions</h2><button class="btn" data-modal="request">+ Nouveau besoin</button></div>'+
 '<div class="list">'+data.requests.map(r=>'<div class="row"><div><strong>'+r.title+'</strong><div class="muted">'+r.kind+'</div></div><span class="tag">'+r.status+'</span></div>').join("")+'</div>';
}
function renderReports(){
 content.innerHTML='<div class="section-title"><h2>Rapports hebdomadaires</h2>'+
 (can("report")?'<button class="btn" data-modal="report">+ Nouveau rapport</button>':"")+'</div>'+
 '<div class="empty">Aucun rapport n’est encore enregistré.</div>';
}

function render(){
 pageTitle.textContent=titles[state.view];
 ({dashboard:renderDashboard,documents:renderDocuments,tasks:renderTasks,requests:renderRequests,reports:renderReports}[state.view]||renderDashboard)();
 $$(".nav-item,.bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=state.role==="admin"?"Administrateur":state.role==="manager"?"Manager":"Salarié";
 roleToggle.textContent=(state.role==="admin"?"Admin":state.role==="manager"?"Manager":"Salarié")+" ▾";
}

function closeModal(){const m=$("#appModal");if(m)m.remove();}

function openModal(type){
 closeModal();
 const names={task:"Nouvelle tâche",document:"Ajouter une fiche technique",request:"Nouveau besoin / intervention",report:"Nouveau rapport hebdomadaire"};
 let form="";
 if(type==="task")form='<label>Titre<input name="title" required placeholder="Ex. Contrôler les températures"></label><div class="form-grid"><label>Attribuer à<select name="assignee"><option>Aloïs Monier</option><option>Hugo</option><option>Léa</option><option>Charline</option></select></label><label>Date<input name="due" type="date" required></label></div><div class="form-grid"><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label><label>Récurrence<select name="repeat"><option>Aucune</option><option>Tous les jours</option><option>Chaque semaine</option><option>Chaque mois</option></select></label></div><label>Note<textarea name="note"></textarea></label>';
 if(type==="document")form='<label>Fichier<input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required></label><label>Nom<input name="name" required placeholder="Ex. Procédure ouverture"></label><label>Catégorie<select name="category"><option>Fiche technique</option><option>Procédure</option><option>Hygiène / HACCP</option><option>Autre</option></select></label>';
 if(type==="request")form='<label>Objet<input name="title" required></label><div class="form-grid"><label>Type<select name="kind"><option>Maintenance</option><option>Matériel</option><option>Informatique</option><option>Fournisseur</option></select></label><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label></div><label>Description<textarea name="description" required></textarea><label>Pièce jointe<input name="file" type="file"></label>';
 if(type==="report")form='<label>Semaine<input name="week" required placeholder="S39"></label><div class="form-grid"><label>CA TTC<input name="revenue" type="number" step=".01"></label><label>Clients<input name="clients" type="number"></label></div><div class="form-grid"><label>Ticket moyen<input name="ticket" type="number" step=".01"></label><label>Note<input name="rating" type="number" step=".01"></label></div><label>Commentaires<textarea name="comments"></textarea>';
 const m=document.createElement("div");m.id="appModal";m.className="modal-backdrop";
 m.innerHTML='<div class="modal"><div class="modal-head"><div><div class="eyebrow">Équipe</div><h2>'+names[type]+'</h2></div><button class="modal-close" data-close>×</button></div><form id="modalForm" data-type="'+type+'">'+form+'<div class="modal-actions"><button type="button" class="btn-secondary" data-close>Annuler</button><button class="btn">Créer</button></div></form></div>';
 document.body.appendChild(m);m.querySelector("input,select,textarea")?.focus();
}

document.addEventListener("click",e=>{
 const close=e.target.closest("[data-close]");if(close){closeModal();return;}
 const nav=e.target.closest("[data-view]");if(nav){state.view=nav.dataset.view;render();return;}
 const modal=e.target.closest("[data-modal]");if(modal){openModal(modal.dataset.modal);return;}
 const filter=e.target.closest("[data-filter]");if(filter){state.taskFilter=filter.dataset.filter;renderTasks();return;}
 const preview=e.target.closest("[data-preview]");if(preview){alert("Aperçu de : "+preview.dataset.preview);return;}
});
document.addEventListener("change",e=>{
 if(e.target.matches('[data-action="toggle-task"]')){
  const t=data.tasks.find(x=>x.id===Number(e.target.dataset.id));if(t){t.done=e.target.checked;t.completedAt=t.done?new Date().toISOString():null;render();}
 }
});
document.addEventListener("submit",e=>{
 if(e.target.id!=="modalForm")return;
 e.preventDefault();const f=e.target,fd=new FormData(f),type=f.dataset.type;
 if(type==="task"){data.tasks.unshift({id:Date.now(),title:fd.get("title"),assignee:fd.get("assignee"),due:fd.get("due"),priority:fd.get("priority"),repeat:fd.get("repeat"),done:false});state.view="tasks";}
 if(type==="document"){data.documents.unshift(fd.get("name")||"Nouvelle fiche");state.view="documents";}
 if(type==="request"){data.requests.unshift({title:fd.get("title"),kind:fd.get("kind"),status:"Nouveau"});state.view="requests";}
 if(type==="report")state.view="reports";
 closeModal();render();
});
roleToggle.addEventListener("click",()=>{state.role=state.role==="admin"?"manager":state.role==="manager"?"employee":"admin";render();});
render();