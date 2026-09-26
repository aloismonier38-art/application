const state={role:"admin",view:"dashboard",taskFilter:"open"};

const titles={
 dashboard:"Tableau de bord",
 documents:"Fiches techniques",
 tasks:"To-do list",
 requests:"Besoins & interventions",
 reports:"Rapports hebdomadaires"
};

const data={
 tasks:[
  {id:1,title:"Contrôler les températures",assignee:"Aloïs Monier",due:"2026-09-26",priority:"Haute",repeat:"Tous les jours",done:false,completedAt:null},
  {id:2,title:"Commander les consommables",assignee:"Hugo",due:"2026-09-27",priority:"Normale",repeat:"Chaque semaine",done:false,completedAt:null},
  {id:3,title:"Mettre à jour l'affichage",assignee:"Léa",due:"2026-09-30",priority:"Normale",repeat:"Aucune",done:false,completedAt:null},
  {id:4,title:"Vérifier les extincteurs",assignee:"Charline",due:"2026-09-20",priority:"Haute",repeat:"Chaque mois",done:false,completedAt:null}
 ],
 requests:[
  ["Réparation imprimante cuisine","Maintenance","En cours"],
  ["Nouveau terminal de paiement","Matériel","Nouveau"]
 ],
 documents:["Fiche pâte","Procédure ouverture","Procédure fermeture","Fiche allergènes"]
};

const content=document.getElementById("content");
const title=document.getElementById("pageTitle");
const roleLabel=document.getElementById("roleLabel");
const roleToggle=document.getElementById("roleToggle");

function can(action){
 if(state.role==="admin")return true;
 if(state.role==="manager")return ["view","task","request","report","document"].includes(action);
 return ["view","request"].includes(action);
}

function fmtDate(s){
 return new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
}

function daysLate(s){
 return Math.max(0,Math.floor((new Date()-new Date(s+"T23:59:59"))/86400000));
}

function isToday(date){
 if(!date)return false;
 const d=new Date(date),n=new Date();
 return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();
}

function toggleTask(id){
 const task=data.tasks.find(t=>t.id===id);
 if(!task)return;
 task.done=!task.done;
 task.completedAt=task.done?new Date().toISOString():null;
 render();
}

function setTaskFilter(filter){
 state.taskFilter=filter;
 renderTasks();
}

function taskFilterButton(label,filter){
 const active=(state.taskFilter||"open")===filter?"active":"";
 return '<button class="filter-btn '+active+'" onclick="setTaskFilter(\''+filter+'\')">'+label+'</button>';
}

function taskHtml(t){
 const late=daysLate(t.due);
 return '<div class="row task-row '+(t.done?"task-done":"")+'">'+
 '<input class="check" type="checkbox" '+(t.done?"checked":"")+' onchange="toggleTask('+t.id+')">'+
 '<div class="task-main"><strong>'+t.title+'</strong>'+
 '<div class="muted">'+t.assignee+' · '+fmtDate(t.due)+' · '+t.repeat+'</div>'+
 '<div class="task-meta">'+
 (late&&!t.done?'<span class="tag danger">'+late+' jour'+(late>1?"s":"")+' de retard</span>':"")+
 '<span class="tag">'+t.priority+'</span>'+
 (t.done?'<span class="tag green">Validée</span>':"")+
 '</div></div></div>';
}

function renderDashboard(){
 const open=data.tasks.filter(t=>!t.done).length;
 const late=data.tasks.filter(t=>!t.done&&daysLate(t.due)>0).length;
 content.innerHTML=
 '<div class="grid">'+
 '<div class="card"><div class="stat-label">Tâches ouvertes</div><div class="stat-value">'+open+'</div><div class="stat-note">'+late+' en retard</div></div>'+
 '<div class="card"><div class="stat-label">Besoins en cours</div><div class="stat-value">'+data.requests.length+'</div><div class="stat-note">Demandes enregistrées</div></div>'+
 '<div class="card"><div class="stat-label">Fiches techniques</div><div class="stat-value">'+data.documents.length+'</div><div class="stat-note">Aperçus disponibles</div></div>'+
 '<div class="card"><div class="stat-label">Rapport hebdo</div><div class="stat-value">S39</div><div class="stat-note">À compléter</div></div>'+
 '</div>'+
 '<div class="section-title"><h2>Mes prochaines tâches</h2><button class="btn" onclick="state.view=\'tasks\';render()">Voir tout</button></div>'+
 '<div class="list">'+data.tasks.filter(t=>!t.done).slice(0,3).map(taskHtml).join("")+'</div>';
}

function renderDocuments(){
 content.innerHTML=
 '<div class="section-title"><h2>Fiches techniques</h2>'+
 (can("document")?'<button class="btn" onclick="openModal(\'document\')">+ Ajouter</button>':"")+
 '</div><div class="list">'+
 data.documents.map((d,i)=>
 '<div class="row doc-preview"><div class="pdf-icon">PDF</div>'+
 '<div><strong>'+d+'</strong><div class="muted">Version 1.'+(i+1)+' · Mise à jour récente</div></div>'+
 '<button class="preview-btn" onclick="previewDocument(\''+d.replace(/'/g,"\\'")+'\')">Prévisualiser</button></div>'
 ).join("")+
 '</div>';
}

function previewDocument(name){
 alert("Aperçu : "+name+"\n\nLe lecteur PDF sera connecté au stockage lors de la mise en place de la base de données.");
}

function renderTasks(){
 const open=data.tasks.filter(t=>!t.done);
 const doneToday=data.tasks.filter(t=>t.done&&isToday(t.completedAt));
 const visible=state.taskFilter==="done"?doneToday:state.taskFilter==="all"?data.tasks:open;
 const days=["Lun 28","Mar 29","Mer 30","Jeu 1","Ven 2","Sam 3","Dim 4"];
 content.innerHTML=
 '<div class="section-title"><div><h2>Tâches</h2><div class="muted">À faire, échéances et récurrences</div></div>'+
 (can("task")?'<button class="btn" onclick="openModal(\'task\')">+ Nouvelle</button>':"")+
 '</div>'+
 '<div class="task-filters">'+
 taskFilterButton("À faire","open")+
 taskFilterButton("Validées aujourd\'hui","done")+
 taskFilterButton("Toutes","all")+
 '</div>'+
 '<div class="task-summary"><span>'+open.length+' à faire</span><span>'+doneToday.length+' validée'+(doneToday.length>1?"s":"")+' aujourd\'hui</span></div>'+
 '<div class="list">'+(visible.length?visible.map(taskHtml).join(""):'<div class="empty">Aucune tâche dans cette vue.</div>')+'</div>'+
 '<div class="section-title"><h2>Planning</h2><span class="muted">Aperçu de la semaine</span></div>'+
 '<div class="mini-calendar">'+
 days.map((d,i)=>'<div class="day"><b>'+d+'</b>'+
 (i<4?'<div class="day-task">'+data.tasks[i%data.tasks.length].title+'</div>':"")+
 '</div>').join("")+
 '</div>';
}

function renderRequests(){
 content.innerHTML=
 '<div class="section-title"><h2>Besoins & interventions</h2>'+
 '<button class="btn" onclick="openModal(\'request\')">+ Nouveau besoin</button></div>'+
 '<div class="list">'+data.requests.map(r=>
 '<div class="row"><div><strong>'+r[0]+'</strong><div class="muted">'+r[1]+'</div></div><span class="tag">'+r[2]+'</span></div>'
 ).join("")+'</div>';
}

function renderReports(){
 content.innerHTML=
 '<div class="section-title"><h2>Rapports hebdomadaires</h2>'+
 (can("report")?'<button class="btn" onclick="openModal(\'report\')">+ Nouveau rapport</button>':"")+
 '</div>'+
 '<div class="empty">Aucun rapport n\'est encore enregistré.<br><span class="muted">Les indicateurs pourront ensuite être reliés aux données de tes établissements.</span></div>';
}

function render(){
 title.textContent=titles[state.view];
 const renderer={dashboard:renderDashboard,documents:renderDocuments,tasks:renderTasks,requests:renderRequests,reports:renderReports}[state.view];
 if(renderer)renderer();
 document.querySelectorAll(".nav-item,.bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=state.role==="admin"?"Administrateur":state.role==="manager"?"Manager":"Salarié";
 roleToggle.textContent=(state.role==="admin"?"Admin":state.role==="manager"?"Manager":"Salarié")+" ▾";
}

function closeModal(){
 const modal=document.getElementById("appModal");
 if(modal)modal.remove();
}

function openModal(type){
 closeModal();
 const titles={task:"Nouvelle tâche",document:"Ajouter une fiche technique",request:"Nouveau besoin / intervention",report:"Nouveau rapport hebdomadaire"};
 let form="";
 if(type==="task"){
  form='<label>Titre<input name="title" required placeholder="Ex. Contrôler les températures"></label>'+
  '<div class="form-grid"><label>Attribuer à<select name="assignee"><option>Aloïs Monier</option><option>Hugo</option><option>Léa</option><option>Charline</option></select></label>'+
  '<label>Date<input name="due" type="date" required></label></div>'+
  '<div class="form-grid"><label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label>'+
  '<label>Récurrence<select name="repeat"><option>Aucune</option><option>Tous les jours</option><option>Chaque semaine</option><option>Chaque mois</option></select></label></div>'+
  '<label>Note<textarea name="note" placeholder="Informations complémentaires"></textarea></label>';
 }
 if(type==="document"){
  form='<label>Fichier<input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required></label>'+
  '<label>Nom de la fiche<input name="name" required placeholder="Ex. Procédure ouverture"></label>'+
  '<label>Catégorie<select name="category"><option>Fiche technique</option><option>Procédure</option><option>Hygiène / HACCP</option><option>Autre</option></select></label>';
 }
 if(type==="request"){
  form='<label>Objet<input name="title" required placeholder="Ex. Intervention sur le four"></label>'+
  '<div class="form-grid"><label>Type<select name="kind"><option>Maintenance</option><option>Matériel</option><option>Informatique</option><option>Fournisseur</option><option>Autre</option></select></label>'+
  '<label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>Urgente</option></select></label></div>'+
  '<label>Description<textarea name="description" required placeholder="Décris le besoin..."></textarea>'+
  '<label>Photo / pièce jointe<input name="file" type="file"></label>';
 }
 if(type==="report"){
  form='<label>Semaine<input name="week" required placeholder="S39"></label>'+
  '<div class="form-grid"><label>CA TTC<input name="revenue" type="number" step="0.01" placeholder="0"></label><label>Clients<input name="clients" type="number" placeholder="0"></label></div>'+
  '<div class="form-grid"><label>Ticket moyen<input name="ticket" type="number" step="0.01" placeholder="0"></label><label>Avis / note<input name="rating" type="number" step="0.01" placeholder="0"></label></div>'+
  '<label>Commentaires<textarea name="comments" placeholder="Points importants de la semaine..."></textarea>';
 }
 const el=document.createElement("div");
 el.id="appModal";
 el.className="modal-backdrop";
 el.innerHTML='<div class="modal" role="dialog"><div class="modal-head"><div><div class="eyebrow">Équipe</div><h2>'+titles[type]+'</h2></div>'+
 '<button class="modal-close" type="button" onclick="closeModal()">×</button></div>'+
 '<form id="modalForm" data-type="'+type+'">'+form+
 '<div class="modal-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button><button class="btn" type="submit">Créer</button></div></form></div>';
 document.body.appendChild(el);
 el.addEventListener("click",e=>{if(e.target===el)closeModal();});
 const first=el.querySelector("input,textarea,select");
 if(first)first.focus();
}

function handleModalSubmit(e){
 e.preventDefault();
 const form=e.target,type=form.dataset.type,fd=new FormData(form);
 if(type==="task"){
  data.tasks.unshift({id:Date.now(),title:fd.get("title"),assignee:fd.get("assignee"),due:fd.get("due"),priority:fd.get("priority"),repeat:fd.get("repeat"),done:false,completedAt:null});
  state.taskFilter="open";state.view="tasks";
 }
 if(type==="document"){
  const file=fd.get("file");
  data.documents.unshift(fd.get("name")||(file?file.name:"Nouvelle fiche"));
  state.view="documents";
 }
 if(type==="request"){
  data.requests.unshift([fd.get("title"),fd.get("kind"),"Nouveau"]);
  state.view="requests";
 }
 if(type==="report"){
  state.view="reports";
  data.lastReport={week:fd.get("week"),revenue:fd.get("revenue"),clients:fd.get("clients"),ticket:fd.get("ticket"),rating:fd.get("rating"),comments:fd.get("comments")};
 }
 closeModal();
 render();
}

document.addEventListener("submit",e=>{
 if(e.target&&e.target.id==="modalForm")handleModalSubmit(e);
});

document.querySelectorAll(".nav-item,.bottom-nav button").forEach(button=>{
 button.addEventListener("click",()=>{
  state.view=button.dataset.view;
  render();
 });
});

roleToggle.addEventListener("click",()=>{
 state.role=state.role==="admin"?"manager":state.role==="manager"?"employee":"admin";
 render();
});

render();
