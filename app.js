const state={role:"admin",view:"dashboard"};
const titles={dashboard:"Tableau de bord",documents:"Fiches techniques",tasks:"To-do list",requests:"Besoins & interventions",reports:"Rapports hebdomadaires"};
const data={
 tasks:[
  {id:1,title:"Contrôler les températures",assignee:"Aloïs Monier",due:"2026-09-26",priority:"Haute",repeat:"Tous les jours",done:false},
  {id:2,title:"Commander les consommables",assignee:"Hugo",due:"2026-09-27",priority:"Normale",repeat:"Chaque semaine",done:false},
  {id:3,title:"Mettre à jour l'affichage",assignee:"Léa",due:"2026-09-30",priority:"Normale",repeat:"Aucune",done:false},
  {id:4,title:"Vérifier les extincteurs",assignee:"Charline",due:"2026-09-20",priority:"Haute",repeat:"Chaque mois",done:false}
 ],
 requests:[["Réparation imprimante cuisine","Maintenance","En cours"],["Nouveau terminal de paiement","Matériel","Nouveau"]],
 documents:["Fiche pâte","Procédure ouverture","Procédure fermeture","Fiche allergènes"]
};
const content=document.getElementById("content");
const title=document.getElementById("pageTitle");
const roleLabel=document.getElementById("roleLabel");
const roleToggle=document.getElementById("roleToggle");

function can(action){
 if(state.role==="admin") return true;
 if(state.role==="manager") return ["view","task","request","report","document"].includes(action);
 return ["view","request"].includes(action);
}
function fmtDate(s){return new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"});}
function daysLate(s){return Math.max(0,Math.floor((new Date()-new Date(s+"T23:59:59"))/86400000));}
function toggleTask(id){
 const t=data.tasks.find(x=>x.id===id);
 if(!t)return;
 t.done=!t.done;
 t.completedAt=t.done?new Date().toISOString():null;
 render();
}
function isToday(date){
 if(!date)return false;
 const d=new Date(date), n=new Date();
 return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();
}
function setTaskFilter(filter){
 state.taskFilter=filter;
 renderTasks();
}
function taskFilterButton(label,filter){
 return '<button class="filter-btn '+((state.taskFilter||"open")===filter?"active":"")+'" onclick="setTaskFilter(\''+filter+'\')">'+label+'</button>';
}

function taskHtml(t){
 const late=daysLate(t.due);
 return '<div class="row task-row '+(t.done?"task-done":"")+'">'+
 '<input class="check" type="checkbox" '+(t.done?"checked":"")+' onchange="toggleTask('+t.id+')">'+
 '<div class="task-main"><strong>'+t.title+'</strong>'+
 '<div class="muted">'+t.assignee+' · '+fmtDate(t.due)+' · '+t.repeat+'</div>'+
 '<div class="task-meta">'+(late&&!t.done?'<span class="tag danger">'+late+' jour'+(late>1?"s":"")+' de retard</span>':"")+
 '<span class="tag">'+t.priority+'</span></div></div></div>';
}

function renderDashboard(){
 const open=data.tasks.filter(t=>!t.done).length;
 const late=data.tasks.filter(t=>!t.done&&daysLate(t.due)>0).length;
 content.innerHTML='<div class="grid">'+
 '<div class="card"><div class="stat-label">Tâches ouvertes</div><div class="stat-value">'+open+'</div><div class="stat-note">'+late+' en retard</div></div>'+
 '<div class="card"><div class="stat-label">Besoins en cours</div><div class="stat-value">2</div><div class="stat-note">1 intervention</div></div>'+
 '<div class="card"><div class="stat-label">Fiches techniques</div><div class="stat-value">4</div><div class="stat-note">Aperçus disponibles</div></div>'+
 '<div class="card"><div class="stat-label">Rapport hebdo</div><div class="stat-value">S39</div><div class="stat-note">À compléter</div></div></div>'+
 '<div class="section-title"><h2>Mes prochaines tâches</h2><button class="btn" onclick="state.view=\'tasks\';render()">Voir tout</button></div>'+
 '<div class="list">'+data.tasks.filter(t=>!t.done).slice(0,3).map(taskHtml).join("")+'</div>';
}

function renderDocuments(){
 content.innerHTML='<div class="section-title"><h2>Fiches techniques</h2>'+
 (can("document")?'<button class="btn">+ Ajouter</button>':"")+
 '</div><div class="list">'+data.documents.map((d,i)=>
 '<div class="row doc-preview"><div class="pdf-icon">PDF</div><div><strong>'+d+'</strong><div class="muted">Version 1.'+(i+1)+' · Mise à jour récente</div></div>'+
 '<button class="preview-btn" onclick="alert(\'Aperçu de : '+d+'\')">Prévisualiser</button></div>'
 ).join("")+'</div>';
}

function renderTasks(){
 state.taskFilter=state.taskFilter||"open";
 const open=data.tasks.filter(t=>!t.done);
 const doneToday=data.tasks.filter(t=>t.done&&isToday(t.completedAt));
 const all=data.tasks;
 const visible=state.taskFilter==="done"?doneToday:state.taskFilter==="all"?all:open;
 const days=["Lun 28","Mar 29","Mer 30","Jeu 1","Ven 2","Sam 3","Dim 4"];
 content.innerHTML='<div class="section-title"><div><h2>Tâches</h2><div class="muted">À faire, échéances et récurrences</div></div>'+
 (can("task")?'<button class="btn">+ Nouvelle</button>':"")+'</div>'+
 '<div class="task-filters">'+taskFilterButton("À faire","open")+taskFilterButton("Validées aujourd\'hui","done")+taskFilterButton("Toutes","all")+'</div>'+
 '<div class="task-summary"><span>'+open.length+' à faire</span><span>'+doneToday.length+' validée'+(doneToday.length>1?"s":"")+' aujourd\'hui</span></div>'+
 '<div class="list">'+(visible.length?visible.map(taskHtml).join(""):'<div class="empty">Aucune tâche dans cette vue.</div>')+'</div>'+
 '<div class="section-title"><h2>Planning</h2><span class="muted">Aperçu de la semaine</span></div>'+
 '<div class="mini-calendar">'+days.map((d,i)=>'<div class="day"><b>'+d+'</b>'+
 (i<4?'<div class="day-task">'+data.tasks[i%data.tasks.length].title+'</div>':"")+'</div>').join("")+'</div>';
}
 const days=["Lun 28","Mar 29","Mer 30","Jeu 1","Ven 2","Sam 3","Dim 4"];
 content.innerHTML='<div class="section-title"><div><h2>Tâches</h2><div class="muted">À faire, échéances et récurrences</div></div>'+
 (can("task")?'<button class="btn">+ Nouvelle</button>':"")+'</div>'+
 '<div class="list">'+data.tasks.map(taskHtml).join("")+'</div>'+
 '<div class="section-title"><h2>Planning</h2><span class="muted">Aperçu de la semaine</span></div>'+
 '<div class="mini-calendar">'+days.map((d,i)=>'<div class="day"><b>'+d+'</b>'+
 (i<4?'<div class="day-task">'+data.tasks[i%data.tasks.length].title+'</div>':"")+'</div>').join("")+'</div>';
}

function renderRequests(){
 content.innerHTML='<div class="section-title"><h2>Besoins & interventions</h2><button class="btn">+ Nouveau besoin</button></div>'+
 '<div class="list">'+data.requests.map(r=>'<div class="row"><div><strong>'+r[0]+'</strong><div class="muted">'+r[1]+'</div></div><span class="tag">'+r[2]+'</span></div>').join("")+'</div>';
}
function renderReports(){
 content.innerHTML='<div class="section-title"><h2>Rapports hebdomadaires</h2>'+
 (can("report")?'<button class="btn">+ Nouveau rapport</button>':"")+'</div>'+
 '<div class="empty">Aucun rapport n\'est encore enregistré.<br><span class="muted">Les indicateurs pourront ensuite être reliés aux données de tes établissements.</span></div>';
}
function render(){
 title.textContent=titles[state.view];
 ({dashboard:renderDashboard,documents:renderDocuments,tasks:renderTasks,requests:renderRequests,reports:renderReports}[state.view])();
 document.querySelectorAll(".nav-item,.bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=state.role==="admin"?"Administrateur":state.role==="manager"?"Manager":"Salarié";
 roleToggle.textContent=(state.role==="admin"?"Admin":state.role==="manager"?"Manager":"Salarié")+" ▾";
}
document.querySelectorAll(".nav-item,.bottom-nav button").forEach(b=>b.addEventListener("click",()=>{state.view=b.dataset.view;render();}));
roleToggle.addEventListener("click",()=>{state.role=state.role==="admin"?"manager":state.role==="manager"?"employee":"admin";render();});
render();