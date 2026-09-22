const config = {
  apiKey: "AIzaSyDHsad9fwQ23ItoWmiYQZLDFJ6wfN9JpT4",
  authDomain: "argent-de-poche-famille.firebaseapp.com",
  projectId: "argent-de-poche-famille"
};
firebase.initializeApp(config);
const db = firebase.firestore();
let currentUser, unsubEvents, unsubClotures, userRole, activeNetTotal = 0, activeScolaire = 0, activeAutre = 0, activeManque = 0;
let childFixe = 5, childPrerequis = 5, childScolaireBonus = 5, childMinScolaire = 3;
let childHeureSemaine = "20h30", childHeureWeekend = "22h00", selectedChildId = "", childrenList = [];

firebase.auth().onAuthStateChanged(user => {
  currentUser = user;
  toggleView('login-card', !user);
  toggleView('dashboard', !!user);
  if (user) loadUser();
});

function login() {
  firebase.auth().signInWithEmailAndPassword(g('email').value, g('pass').value).catch(e => alert(e.message));
}
function logout() { 
  firebase.auth().signOut(); 
  if (unsubEvents) unsubEvents(); 
  if (unsubClotures) unsubClotures();
}
function g(id) { return document.getElementById(id); }
function toggleView(id, show) { g(id).classList.toggle('hidden', !show); }
function toggleHelp(show) { toggleView('help-modal', show); }

function getWeekType() {
  const d = new Date(); const target = new Date(d.valueOf()); const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); const firstThursday = target.valueOf(); target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return (1 + Math.ceil((firstThursday - target) / 604800000)) % 2 === 0 ? "Semaine 1/A" : "Semaine 2/B";
}

function updateCloturePosition() {
  const now = new Date();
  const isSundayNight = (now.getDay() === 0 && now.getHours() >= 20);
  const targetSlot = isSundayNight ? 'cloture-top-slot' : 'cloture-bottom-slot';
  const card = g('cloture-card'); const slot = g(targetSlot);
  if (card && slot) { slot.appendChild(card); card.classList.remove('hidden'); }
}

function loadUser() {
  g('week-type').innerText = getWeekType();
  db.collection('utilisateurs').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data(); appliquerTheme(data); userRole = data.role; g('user-title').innerText = data.prenom;
      if (userRole === 'parent') {
        toggleView('parent-view', true); loadChildren(); initCategories(); updateCloturePosition();
      } else {
        toggleView('child-view', true); applyReglages(data); listenEvents(currentUser.uid, 'my-total'); listenClotures(currentUser.uid);
      }
    } else { alert("Profil introuvable."); logout(); }
  }).catch(e => alert("Erreur : " + e.message));
}

function applyReglages(data) {
  childFixe = data.montantFixe !== undefined ? data.montantFixe : 5;
  childPrerequis = data.montantPrerequis !== undefined ? data.montantPrerequis : 5;
  childScolaireBonus = data.montantBonus !== undefined ? data.montantBonus : 5;
  childMinScolaire = data.minScolaire !== undefined ? data.minScolaire : 3;
  g('help-text-min-scol').innerText = childMinScolaire;
  g('help-text-bonus-scol').innerText = childScolaireBonus;
  g('help-text-prerequis').innerText = childPrerequis;
  g('help-text-fixe').innerText = childFixe; // Liaison dynamique de la cagnotte fixe
  childHeureSemaine = data.heureSemaine !== undefined ? data.heureSemaine : "20h30";
  childHeureWeekend = data.heureWeekend !== undefined ? data.heureWeekend : "22h00";
  g('help-text-heure-semaine').innerText = childHeureSemaine;
  g('help-text-heure-weekend').innerText = childHeureWeekend;
}

function initCategories() {
  db.collection('categories').orderBy('nom').onSnapshot(snap => {
    if (snap.empty) {
      const defaults = ["Maths", "Chambre", "Table", "Vaisselle", "Lecture", "Comportement", "Douche"];
      defaults.forEach(c => db.collection('categories').add({ nom: c })); return;
    }
    const select = g('category-select');
    select.innerHTML = '<option value="">Sélectionner une catégorie</option>';
    snap.forEach(doc => { select.innerHTML += `<option value="${doc.data().nom}">${doc.data().nom}</option>`; });
    select.innerHTML += '<option value="autre">Autre...</option>';
  });
}

function checkCategory(val) {
  if (val === 'autre') {
    const nv = prompt("Saisissez la nouvelle catégorie :");
    if (nv) {
      db.collection('categories').add({ nom: nv }).then(() => { setTimeout(() => { g('category-select').value = nv; }, 500); });
    } else { g('category-select').value = ''; }
  }
}

function loadChildren() {
  db.collection('utilisateurs').where('role', '==', 'enfant').get().then(snap => {
    childrenList = [];
    snap.forEach(doc => {
      childrenList.push({ id: doc.id, prenom: doc.data().prenom });
    });
    if (childrenList.length > 0) {
      selectChild(childrenList[0].id);
    }
  });
}

function renderChildButtons(selectedId) {
  const container = g('child-buttons-container');
  if (!container) return;
  container.innerHTML = '';
  childrenList.forEach(child => {
    const isSelected = child.id === selectedId;
    const btnClass = isSelected 
      ? 'bg-kakipastel text-marroncafe font-bold border-2 border-taupeclair shadow-md' 
      : 'bg-white text-gray-400 border border-gray-200';
    container.innerHTML += `
      <button onclick="selectChild('${child.id}')" class="${btnClass} flex-1 p-2.5 rounded-xl text-xs transition duration-200">
        👧 ${child.prenom}
      </button>`;
  });
}

function selectChild(id) {
  selectedChildId = id;
  renderChildButtons(id);
  db.collection('utilisateurs').doc(id).get().then(doc => {
    const data = doc.data() || {}; appliquerTheme(data); applyReglages(data);
    g('set-fixe').value = childFixe; g('set-prerequis').value = childPrerequis; g('set-scolaire').value = childScolaireBonus; g('set-min-scolaire').value = childMinScolaire;
    g('set-heure-semaine').value = childHeureSemaine;
    g('set-heure-weekend').value = childHeureWeekend;
    if (unsubEvents) unsubEvents(); listenEvents(id, 'child-total'); listenClotures(id);
  });
}

function sauvegarderReglages() {
  const childId = selectedChildId; if (!childId) return;
  db.collection('utilisateurs').doc(childId).update({
    montantFixe: Number(g('set-fixe').value), montantPrerequis: Number(g('set-prerequis').value), montantBonus: Number(g('set-scolaire').value), minScolaire: Number(g('set-min-scolaire').value), heureSemaine: g('set-heure-semaine').value,
    heureWeekend: g('set-heure-weekend').value
  }).then(() => { alert("Réglages mis à jour !"); selectChild(childId); });
}

function listenEvents(childId, totalElementId) {
  unsubEvents = db.collection('utilisateurs').doc(childId).collection('evenements').orderBy('date', 'desc')
    .onSnapshot(snap => {
      activeNetTotal = 0; activeScolaire = 0; activeAutre = 0; activeManque = 0;
      let scolHtml = '', autrHtml = '', manqHtml = '', pendingHtml = '';
      snap.forEach(doc => {
        const ev = doc.data(); if (ev.cloture) return;
        if (ev.status === 'en_attente') {
          pendingHtml += `<div class="p-2 bg-white rounded-lg border border-purple-100 flex justify-between items-center text-xs"><span><strong>[${ev.type === 'scolaire' ? 'Scolaire' : 'Autre'}]</strong> ${ev.commentaire}</span><div class="flex space-x-1"><button onclick="traiterDemande('${doc.id}', 'valide')" class="bg-green-500 text-white px-2 py-1 rounded text-[14px] font-bold">✅</button><button onclick="traiterDemande('${doc.id}', 'refuse')" class="bg-red-500 text-white px-2 py-1 rounded text-[14px] font-bold">❌</button></div></div>`;
        }
        if (ev.status !== 'en_attente' && ev.status !== 'refuse') {
          activeNetTotal += ev.valeur;
          if (ev.type === 'scolaire') activeScolaire++; else if (ev.type === 'manquement') activeManque++; else activeAutre++;
        }
        const rawDate = ev.date ? ev.date.toDate() : new Date();
        let dateStr = userRole === 'enfant' ? (rawDate.toLocaleDateString('fr-FR', { weekday: 'long' }) + ' ' + rawDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')) : rawDate.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const color = ev.valeur > 0 ? (ev.type === 'scolaire' ? 'text-green-600' : 'text-blue-600') : 'text-red-600';
        let badgeEtat = '';
        if (ev.proposeParEnfant) {
          if (ev.status === 'en_attente') badgeEtat = ' <span class="text-purple-600 font-bold">[⏳ En attente]</span>';
          else if (ev.status === 'refuse') badgeEtat = ' <span class="text-red-500 font-bold">[❌ Refusé]</span>';
          else if (ev.status === 'valide') badgeEtat = ' <span class="text-green-500 font-bold">[✅ Validé]</span>';
        }
        const badge = ev.desaccord ? `<div class="text-orange-500 font-semibold mt-1">🟠 Contesté : "${ev.commEnfant}"</div>` : '';
        const replyHtml = ev.reponseParent ? `<div class="text-gray-500 italic mt-1">💬 Décision : "${ev.reponseParent}"</div>` : '';
        const actionBtn = (!ev.desaccord && userRole === 'enfant' && ev.status !== 'en_attente' && ev.status !== 'refuse' && ev.type === 'manquement') ? `<button onclick="contester('${doc.id}')" class="text-red-500 underline ml-2 font-bold">Contester</button>` : '';
        const replyBtn = (ev.desaccord && userRole === 'parent') ? `<button onclick="repondreContestation('${doc.id}')" class="text-blue-600 underline ml-2 font-bold">✍️ Répondre</button>` : '';
        const deleteBtn = (userRole === 'parent') ? `<button onclick="supprimerPoint('${doc.id}')" class="text-red-500 font-bold ml-2">❌</button>` : '';
        const labelCategorie = ev.categorie ? `[${ev.categorie}] ` : '';
        const itemHtml = `<div class="p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs flex justify-between items-center"><div><span><strong>${labelCategorie}${ev.commentaire}</strong>${badgeEtat} ${actionBtn} ${replyBtn}</span><span class="text-gray-400 block text-[14px]">${dateStr}</span>${badge}${replyHtml}</div><div class="flex items-center"><span class="${color} font-bold">${ev.valeur > 0 ? '+' : ''}${ev.valeur}</span>${deleteBtn}</div></div>`;
        if (ev.type === 'scolaire') scolHtml += itemHtml; else if (ev.type === 'manquement') manqHtml += itemHtml; else autrHtml += itemHtml; 
      });
     g('events-list').innerHTML = `
  <div class="space-y-1">
    <p class="font-bold text-green-700 text-xs">🎓 Efforts Scolaires</p>
    ${scolHtml || '<p class="text-gray-400 text-[14px] italic">Aucun effort.</p>'}
  </div>
  <div class="space-y-1 mt-3">
    <p class="font-bold text-blue-700 text-xs">🚀 Autres Efforts</p> <!-- Remplacé 🔵 par 🚀 -->
    ${autrHtml || '<p class="text-gray-400 text-[14px] italic">Aucun autre effort.</p>'}
  </div>
  <div class="space-y-1 mt-3">
    <p class="font-bold text-red-700 text-xs">😈 Manquements</p> <!-- Remplacé 🔴 par 😈 -->
    ${manqHtml || '<p class="text-gray-400 text-[14px] italic">Aucun manquement.</p>'}
  </div>
`;
      g(totalElementId).innerText = activeNetTotal;
      const detailStr = `🎓 ${activeScolaire} | 🚀 ${activeAutre} | 😈 ${activeManque}`; // Remplacé 🔵 et 🔴
      if (userRole === 'parent') {
        g('child-breakdown').innerText = detailStr; g('stat-scolaires').innerText = activeScolaire; g('stat-requis').innerText = childMinScolaire; g('stat-fixe').innerText = childFixe; g('stat-prerequis-val').innerText = childPrerequis; g('stat-scolaire-val').innerText = childScolaireBonus; g('check-prerequis').checked = activeNetTotal >= 0; g('check-scolaire').checked = activeScolaire >= childMinScolaire; g('pending-list').innerHTML = pendingHtml || '<p class="text-gray-400 text-[14px] italic">Aucune demande.</p>'; toggleView('pending-requests-card', userRole === 'parent' && pendingHtml !== '');
      } else {
        g('my-breakdown').innerText = detailStr;
        const reachedObj = activeScolaire >= childMinScolaire;
        g('my-progress').innerHTML = `🎓 Objectif scolaire : <span class="${reachedObj ? 'text-green-600 font-bold' : 'text-orange-500'}">${activeScolaire} / ${childMinScolaire}</span>`;
      }
    });
}

function listenClotures(childId) {
  if (unsubClotures) unsubClotures();
  unsubClotures = db.collection('utilisateurs').doc(childId).collection('clotures').orderBy('date', 'desc')
    .onSnapshot(snap => {
      const list = g('clotures-list'); list.innerHTML = '';
      if (snap.empty) { list.innerHTML = '<p class="text-gray-400 text-[14px] italic">Aucune semaine clôturée.</p>'; return; }
      snap.forEach(doc => {
        const cl = doc.data(); const rawDate = cl.date ? cl.date.toDate() : new Date(); const dateStr = rawDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); const titreAffiche = cl.titre || `Semaine du ${dateStr}`;
        let detailsHtml = '';
        if (cl.details && cl.details.length > 0) {
          detailsHtml = '<div class="mt-2 space-y-1 border-t border-yellow-200 pt-2">';
          cl.details.forEach(p => {
            const col = p.valeur > 0 ? (p.type === 'scolaire' ? 'text-green-600' : 'text-blue-600') : 'text-red-600'; const labelType = p.type ? p.type.toUpperCase() : 'AUTRE'; detailsHtml += `<p class="text-[12px] text-gray-500"><strong>${labelType}</strong> [${p.categorie}] ${p.commentaire} <span class="${col} font-bold">${p.valeur > 0 ? '+' : ''}${p.valeur}</span></p>`;
          });
          detailsHtml += '</div>';
        }
        const actionHtml = (userRole === 'parent') ? `
  <div class="flex justify-end space-x-2 border-t pt-1 mt-2 text-[14px]">
    <button onclick="modifierCloture('${doc.id}')" class="text-blue-600 font-bold">✏️ Modifier</button>
    <button onclick="annulerCloture('${doc.id}')" class="text-yellow-600 font-bold">↩️ Annuler Clôture</button>
    <button onclick="supprimerCloture('${doc.id}')" class="text-red-600 font-bold">🗑️ Supprimer</button>
  </div>` : '';
        list.innerHTML += `<details class="p-3 bg-yellow-50 rounded-lg border border-yellow-100 text-xs"><summary class="flex justify-between font-bold text-yellow-800 cursor-pointer outline-none"><span>${titreAffiche}</span><span class="flex items-center">${cl.totalGagne} € <span class="ml-1 text-[14px] text-yellow-600">▼</span></span></summary><div class="text-[14px] text-gray-600 space-y-0.5 mt-2 pt-2 border-t border-yellow-200"><p>Total : ${cl.totalNet} | Scolaires : ${cl.scolaires}/3</p><p>Prérequis : ${cl.prerequisAccorde ? '✅ Accordé' : '❌ Non accordé'}</p><p>Bonus Scolaire : ${cl.scolaireAccorde ? '✅ Accordé' : '❌ Non accordé'}</p>${cl.commentaire ? `<p class="italic text-gray-500 mt-1">💬 "${cl.commentaire}"</p>` : ''}${detailsHtml}${actionHtml}</div></details>`;
      });
    });
}

function modifierCloture(clotureId) {
  const childId = selectedChildId; const ref = db.collection('utilisateurs').doc(childId).collection('clotures').doc(clotureId);
  ref.get().then(doc => {
    if (!doc.exists) return; const cl = doc.data(); const nTitre = prompt("Renommer la semaine :", cl.titre || ""); if (nTitre === null) return; const nMontant = prompt("Modifier le montant :", cl.totalGagne); if (nMontant === null) return; const nComm = prompt("Modifier le commentaire :", cl.commentaire || ""); if (nComm === null) return;
    ref.update({ titre: nTitre, totalGagne: Number(nMontant), commentaire: nComm }).then(() => alert("Enregistré !"));
  });
}

function supprimerCloture(clotureId) {
  if (confirm("Supprimer ?")) { const childId = selectedChildId; db.collection('utilisateurs').doc(childId).collection('clotures').doc(clotureId).delete(); }
}

function ouvrirProposition(type) {
  const label = type === 'scolaire' ? 'scolaire' : 'autre';
  const comm = prompt(`Saisissez votre commentaire pour cet effort ${label} :`);
  if (comm === null) return;
  if (!comm.trim()) return alert("Vous devez écrire un commentaire !");
  db.collection('utilisateurs').doc(currentUser.uid).collection('evenements').add({
    type: type, categorie: type === 'scolaire' ? 'Scolaire' : 'Autre', commentaire: comm, date: firebase.firestore.FieldValue.serverTimestamp(), valeur: 1, desaccord: false, cloture: false, status: 'en_attente', proposeParEnfant: true
  }).then(() => alert("Proposition envoyée !"));
}

function traiterDemande(eventId, statut) {
  const childId = selectedChildId; db.collection('utilisateurs').doc(childId).collection('evenements').doc(eventId).update({ status: statut });
}

function addPoint(type, val) {
  const childId = selectedChildId; const cat = g('category-select').value; const comm = g('comment').value; if (!childId) return;
  db.collection('utilisateurs').doc(childId).collection('evenements').add({
    type: type, categorie: cat || (type === 'scolaire' ? 'Scolaire' : type === 'autre' ? 'Autre' : 'Manquement'), commentaire: comm || (type === 'scolaire' ? 'Effort scolaire' : type === 'autre' ? 'Autre effort' : 'Manquement'), date: firebase.firestore.FieldValue.serverTimestamp(), valeur: val, desaccord: false, cloture: false
  }).then(() => { g('comment').value = ''; g('category-select').value = ''; });
}

function contester(eventId) {
  const raison = prompt("Pourquoi contestez-vous ce point ?");
  if (raison) { db.collection('utilisateurs').doc(currentUser.uid).collection('evenements').doc(eventId).update({ desaccord: true, commEnfant: raison }); }
}

function repondreContestation(eventId) {
  const explication = prompt("Expliquez votre décision :");
  if (explication !== null) {
    const childId = selectedChildId; db.collection('utilisateurs').doc(childId).collection('evenements').doc(eventId).update({ desaccord: false, reponseParent: explication });
  }
}

function supprimerPoint(eventId) {
  if (confirm("Voulez-vous supprimer ?")) { const childId = selectedChildId; db.collection('utilisateurs').doc(childId).collection('evenements').doc(eventId).delete(); }
}

function validerSemaine() {
  const childId = selectedChildId;
  if (!childId) return;
  
  // Double confirmation de sécurité
  if (!confirm("Voulez-vous vraiment valider et CLÔTURER DÉFINITIVEMENT cette semaine ?")) return;

  const preVal = g('check-prerequis').checked;
  const scoVal = g('check-scolaire').checked;
  const comm = g('parent-comment').value;

  db.collection('utilisateurs').doc(childId).collection('evenements').where('cloture', '==', false).get()
    .then(snap => {
      const pointsList = [];
      snap.forEach(doc => {
        const ev = doc.data();
        pointsList.push({ commentaire: ev.commentaire, valeur: ev.valeur, categorie: ev.categorie, type: ev.type });
      });

      // 1. Création de la clôture
      db.collection('utilisateurs').doc(childId).collection('clotures').add({
        date: firebase.firestore.FieldValue.serverTimestamp(),
        totalNet: activeNetTotal,
        scolaires: activeScolaire,
        prerequisAccorde: preVal,
        scolaireAccorde: scoVal,
        totalGagne: childFixe + (preVal ? childPrerequis : 0) + (scoVal ? childScolaireBonus : 0),
        commentaire: comm,
        details: pointsList
      }).then(clRef => {
        // 2. Archiver en liant l'événement à la clôture (clotureId)
        const batch = db.batch();
        snap.forEach(doc => batch.update(doc.ref, { cloture: true, clotureId: clRef.id }));
        batch.commit().then(() => {
          alert("Semaine clôturée avec succès !");
          g('parent-comment').value = '';
        });
      });
    });
}

function appliquerTheme(data) {
  const r = document.documentElement.style;
  r.setProperty('--beigelin', data.couleurBase || '#EAE3D2');
  r.setProperty('--sabledore', data.couleurSable || '#D6CDA4');
  r.setProperty('--kakipastel', data.couleurKaki || '#B4C4A8');
  r.setProperty('--nuderose', data.couleurNude || '#DBCBB6');
  r.setProperty('--taupeclair', data.couleurTaupe || '#C2B09B');
  r.setProperty('--marroncafe', data.couleurMarron || '#A9907E');
}

function annulerCloture(clotureId) {
  if (!confirm("Voulez-vous annuler cette clôture ? Tous les points archivés de cette semaine vont revenir dans les activités en cours !")) return;
  const childId = selectedChildId;
  
  // 1. Récupérer les événements liés à cette clôture précise
  db.collection('utilisateurs').doc(childId).collection('evenements').where('clotureId', '==', clotureId).get()
    .then(snap => {
      const batch = db.batch();
      // 2. Les remettre en cours
      snap.forEach(doc => {
        batch.update(doc.ref, { cloture: false, clotureId: firebase.firestore.FieldValue.delete() });
      });
      // 3. Supprimer le document de clôture de l'historique
      const clRef = db.collection('utilisateurs').doc(childId).collection('clotures').doc(clotureId);
      batch.delete(clRef);
      
      batch.commit().then(() => alert("Clôture annulée ! Les points sont revenus en cours."));
    });
}


