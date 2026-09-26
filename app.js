const state={role:"admin",view:"dashboard"};
const titles={dashboard:"Tableau de bord",documents:"Fiches techniques",tasks:"To-do list",requests:"Besoins & interventions",reports:"Rapports hebdomadaires"};
const data={tasks:[["Contrôler les températures","Aloïs Monier","Aujourd'hui","Haute"],["Commander les consommables","Hugo","Demain","Normale"],["Mettre à jour l'affichage","Léa","30 sept.","Normale"]],requests:[["Réparation imprimante cuisine","Maintenance","En cours"],["Nouveau terminal de paiement","Matériel","Nouveau"]],documents:["Fiche pâte","Procédure ouverture","Procédure fermeture","Fiche allergènes"]};
const content=document.getElementById("content"),title=document.getElementById("pageTitle"),roleLabel=document.getElementById("roleLabel"),roleToggle=document.getElementById("roleToggle");
function can(action){if(state.role==="admin")return true;if(state.role==="manager")return ["view","task","request","report","document"].includes(action);return ["view","request"].includes(action)}
function render(){
 title.textContent=titles[state.view];
 if(state.view==="dashboard")renderDashboard();
 if(state.view==="documents")renderDocuments();
 if(state.view==="tasks")renderTasks();
 if(state.view==="requests")renderRequests();
 if(state.view==="reports")renderReports();
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 roleLabel.textContent=state.role==="admin"?"Administrateur":state.role==="manager"?"Manager":"Salarié";
 roleToggle.textContent=(state.role==="admin"?"Admin":state.role==="manager"?"Manager":"Salarié")+" ▾";
}
function renderDashboard(){content.innerHTML=`<div class="grid">
<div class="card"><div class="stat-label">Tâches ouvertes</div><div class="stat-value">3</div><div class="stat-note">1 priorité haute</div></div>
<div class="card"><div class="stat-label">Besoins en cours</div><div class="stat-value">2</div><div class="stat-note">1 intervention</div></div>
<div class="card"><div class="stat-label">Fiches techniques</div><div class="stat-value">4</div><div class="stat-note">Dernière mise à jour hier</div></div>
<div class="card"><div class="stat-label">Rapport hebdo</div><div class="stat-value">S39</div><div class="stat-note">À compléter</div></div></div>
<div class="section-title"><h2>Mes prochaines tâches</h2><button class="btn" onclick="state.view='tasks';render()">Voir tout</button></div>
<div class="list">${data.tasks.slice(0,2).map(t=>`<div class="row"><div><strong>${t[0]}</strong><div class="muted">${t[1]} · ${t[2]}</div></div><span class="tag">${t[3]}</span></div>`).join("")}</div>
<div class="section-title"><h2>Architecture des accès</h2></div><div class="card"><strong>Rôle actuel : ${state.role==="admin"?"Administrateur":state.role==="manager"?"Manager":"Salarié"}</strong><div class="permission">Les permissions sont centralisées dans app.js pour la V1. Elles seront remplacées par une authentification et des droits côté serveur lors de la prochaine étape.</div></div>`}
function renderDocuments(){content.innerHTML=`<div class="section-title"><h2>Documents disponibles</h2>${can("document")?'<button class="btn">+ Ajouter une fiche</button>':""}</div><div class="list">${data.documents.map((d,i)=>`<div class="row"><div><strong>${d}</strong><div class="muted">Version 1.${i+1} · PDF</div></div><button class="btn">Télécharger</button></div>`).join("")}</div>`}
function renderTasks(){content.innerHTML=`<div class="section-title"><h2>Tâches de l'équipe</h2>${can("task")?'<button class="btn">+ Nouvelle tâche</button>':""}</div><div class="list">${data.tasks.map(t=>`<div class="row"><div><strong>${t[0]}</strong><div class="muted">Assigné à ${t[1]} · Échéance ${t[2]}</div></div><span class="tag">${t[3]}</span></div>`).join("")}</div>`}
function renderRequests(){content.innerHTML=`<div class="section-title"><h2>Besoins & interventions</h2><button class="btn">+ Nouveau besoin</button></div><div class="list">${data.requests.map(r=>`<div class="row"><div><strong>${r[0]}</strong><div class="muted">${r[1]}</div></div><span class="tag">${r[2]}</span></div>`).join("")}</div>`}
function renderReports(){content.innerHTML=`<div class="section-title"><h2>Rapports hebdomadaires</h2>${can("report")?'<button class="btn">+ Nouveau rapport</button>':""}</div><div class="empty">Aucun rapport n'est encore enregistré.<br><span class="muted">La structure sera reliée aux indicateurs de chaque établissement dans la prochaine version.</span></div>`}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{state.view=b.dataset.view;render()}));
roleToggle.addEventListener("click",()=>{state.role=state.role==="admin"?"manager":state.role==="manager"?"employee":"admin";render()});
render();