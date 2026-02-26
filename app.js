/* ================= 0. FIREBASE CONFIGURAÇÃO ================= */
const firebaseConfig = {
    apiKey: "AIzaSyDDguzJOP5GKqlqf8GW-xdsTCxh1Ha7C7k",
    authDomain: "sutello-financeiro.firebaseapp.com",
    projectId: "sutello-financeiro",
    storageBucket: "sutello-financeiro.firebasestorage.app",
    messagingSenderId: "460447549653",
    appId: "1:460447549653:web:a36b0c7d2c2919ff633a5c"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ================= 1. GLOBAIS E ESTADOS ================= */
let caixas = [];
let agenda = [];
let notas = [];
let caixaAberta = null;
let subAbaAgenda = 'compromissos'; 

const ui = {
    lock: document.getElementById('lock'),
    mainContainer: document.getElementById('mainContainer'),
    totalGlobal: document.getElementById('totalGlobal'),
    listaCaixas: document.getElementById('lista'),
    fotoPerfil: document.getElementById('fotoPerfil'),
    uploadFoto: document.getElementById('uploadFoto'),
    confete: document.getElementById('confete')
};

/* ================= 2. AUTENTICAÇÃO, BIOMETRIA E NUVEM ================= */
function fazerLoginFirebase() {
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;

    if (!email || !senha) return alert("Preencha o e-mail e a senha!");

    auth.signInWithEmailAndPassword(email, senha)
        .then(() => {
            localStorage.setItem('biometriaAtiva_Agenda', 'true');
            entrarNoApp();
        })
        .catch((error) => alert("E-mail ou senha incorretos!"));
}

function logout() {
    auth.signOut().then(() => { location.reload(); });
}

auth.onAuthStateChanged(function(user) {
    if (user) {
        document.getElementById("loginEmail").style.display = "none";
        document.getElementById("loginSenha").style.display = "none";
        document.getElementById("btnEntrar").style.display = "none";
        document.getElementById("btnBiometria").style.display = "block";

        db.collection("dados_caixinhas_agenda").doc(user.uid)
          .onSnapshot(function(doc) {
              if (doc.exists) {
                  const d = doc.data();
                  caixas = d.caixas || [];
                  agenda = d.agenda || [];
                  notas = d.notas || [];
                  
                  if(ui.mainContainer.style.display === 'block') {
                      renderCaixinhas();
                      renderAgenda();
                  }
              }
          });
          verificarLembretes();

          if (localStorage.getItem('biometriaAtiva_Agenda') === 'true') {
              ui.lock.style.display = 'flex';
              ui.mainContainer.style.display = 'none';
              tentarAutoLogin();
          } else {
              entrarNoApp();
          }

    } else {
        ui.lock.style.display = 'flex';
        ui.mainContainer.style.display = 'none';
        document.getElementById("loginEmail").style.display = "block";
        document.getElementById("loginSenha").style.display = "block";
        document.getElementById("btnEntrar").style.display = "block";
        document.getElementById("btnBiometria").style.display = "none";
    }
});

function entrarNoApp() {
    ui.lock.style.display = 'none';
    ui.mainContainer.style.display = 'block';
    carregarFoto();
    renderCaixinhas();
    renderAgenda();
}

function salvarNuvem() {
    if (auth.currentUser) {
        db.collection("dados_caixinhas_agenda").doc(auth.currentUser.uid).set({
            caixas: caixas,
            agenda: agenda,
            notas: notas
        }).catch(erro => console.error("Erro ao salvar:", erro));
    }
}

/* LÓGICA DE BIOMETRIA */
async function tentarAutoLogin() {
    if (window.PublicKeyCredential) {
        try {
            const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (available) {
                acaoBotaoBiometria();
            }
        } catch (e) {
            console.log("Biometria não disponível");
        }
    }
}

async function acaoBotaoBiometria() {
    try {
        const publicKeyCredentialRequestOptions = { challenge: new Uint8Array(32), userVerification: "required" };
        const assertion = await navigator.credentials.get({ publicKey: publicKeyCredentialRequestOptions });
        if (assertion) { entrarNoApp(); }
    } catch (e) {
        console.error("Biometria cancelada:", e);
        document.getElementById("loginEmail").style.display = "block";
        document.getElementById("loginSenha").style.display = "block";
        document.getElementById("btnEntrar").style.display = "block";
    }
}

/* FOTO */
ui.fotoPerfil.onclick = () => ui.uploadFoto.click();
ui.uploadFoto.onchange = e => {
  const r = new FileReader();
  r.onload = () => { localStorage.setItem("fotoPerfilCaixa", r.result); ui.fotoPerfil.src = r.result; };
  r.readAsDataURL(e.target.files[0]);
};
function carregarFoto() { const f = localStorage.getItem("fotoPerfilCaixa"); if(f) ui.fotoPerfil.src = f; }

/* ================= 3. NAVEGAÇÃO ================= */
function mudarAbaPrincipal(abaId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(abaId).style.display = 'block';
    btn.classList.add('active');
}

/* ================= 4. LÓGICA CAIXINHAS ================= */
function renderCaixinhas() {
    let totalGuardado = 0;
    caixas.forEach(c => { totalGuardado += c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0); });
    ui.totalGlobal.innerText = `R$ ${totalGuardado.toFixed(2)}`;
    
    ui.listaCaixas.innerHTML = "";
    if (caixaAberta === null) {
        if(caixas.length === 0) ui.listaCaixas.innerHTML = `<p style="text-align:center;color:#aaa;margin-top:20px">Nenhuma caixinha criada.</p>`;
        caixas.forEach((c, i) => {
            const g = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
            const pct = Math.floor((g / c.total) * 100);
            ui.listaCaixas.innerHTML += `
            <div class="caixa" onclick="abrirCaixa(${i})">
                <div style="display:flex;justify-content:space-between"><h3>${c.nome}</h3><span>R$ ${c.total}</span></div>
                <div class="barra-fundo"><div class="barra-nivel" style="width:${pct}%"></div></div>
                <small>${pct}% • R$ ${g}</small>
            </div>`;
        });
        return;
    }
    const c = caixas[caixaAberta];
    const g = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
    const pct = Math.floor((g / c.total) * 100);
    ui.listaCaixas.innerHTML = `
    <div class="caixa" style="cursor:default">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
            <button onclick="voltarLista()" style="background:#555;border:none;color:white;padding:5px 10px;border-radius:5px">⬅ Voltar</button>
            <button onclick="deletarCaixa()" style="background:#ef5350;border:none;color:white;padding:5px 10px;border-radius:5px">🗑️</button>
        </div>
        <h2 style="text-align:center">${c.nome}</h2>
        <div class="barra-fundo"><div class="barra-nivel" style="width:${pct}%"></div></div>
        <div class="valores">${c.valores.map((v, i) => `<div class="valor ${v.ok?'marcado':''}" onclick="marcarValor(${i})">R$ ${v.valor}</div>`).join('')}</div>
    </div>`;
}

function gerarValores(total) {
    const base = [10, 20, 50, 100]; let s = 0; let arr = [];
    while (s < total) {
        let rest = total - s; let pos = base.filter(n => n <= rest);
        if (pos.length === 0) { if (rest > 0) arr.push({ valor: rest, ok: false }); break; }
        let v = pos[Math.floor(Math.random() * pos.length)]; arr.push({ valor: v, ok: false }); s += v;
    }
    return arr.sort(() => Math.random() - 0.5);
}

function criarCaixa() {
    const n = document.getElementById('nome').value; const v = Number(document.getElementById('valor').value);
    if(!n || !v) return;
    caixas.push({ nome: n, total: v, valores: gerarValores(v) });
    salvarNuvem();
    
    // NOTIFICAÇÃO 1: NOVA CAIXINHA
    enviarNotificacao("📦 Nova Caixinha!", `O objetivo '${n}' no valor de R$ ${v} foi criado.`);
    
    document.getElementById('nome').value = ""; document.getElementById('valor').value = "";
}

function abrirCaixa(i) { caixaAberta = i; renderCaixinhas(); }
function voltarLista() { caixaAberta = null; renderCaixinhas(); }

function marcarValor(i) { 
    caixas[caixaAberta].valores[i].ok = !caixas[caixaAberta].valores[i].ok;
    salvarNuvem();
    
    // NOTIFICAÇÃO 2: DINHEIRO GUARDADO (Só apita se a pessoa marcou o valor)
    if (caixas[caixaAberta].valores[i].ok === true) {
        enviarNotificacao("💰 Dinheiro Guardado!", "Um novo valor foi marcado na caixinha. Estamos mais perto da meta!");
    }
    
    if(caixas[caixaAberta].valores.every(v => v.ok)) { ui.confete.style.display = "flex"; setTimeout(()=>ui.confete.style.display="none", 3000); }
}

function deletarCaixa() { if(confirm("Apagar?")) { caixas.splice(caixaAberta, 1); caixaAberta = null; salvarNuvem(); } }

/* ================= 5. LÓGICA AGENDA E NOTAS ================= */
function mudarSubAba(aba) {
    subAbaAgenda = aba;
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(aba === 'compromissos' ? 'subTabCompromissos' : 'subTabNotas').classList.add('active');
    document.getElementById('viewCompromissos').style.display = aba === 'compromissos' ? 'block' : 'none';
    document.getElementById('viewNotas').style.display = aba === 'notas' ? 'block' : 'none';
    renderAgenda();
}

function renderAgenda() {
    const listaComp = document.getElementById('listaCompromissos');
    listaComp.innerHTML = "";
    agenda.sort((a, b) => new Date(`${a.data}T${a.hora}`) - new Date(`${b.data}T${b.hora}`));
    
    let mesAtual = "";
    agenda.forEach(c => {
        const mesRef = getMesAno(c.data);
        if(mesRef !== mesAtual) { listaComp.innerHTML += `<div class="mes-header">${mesRef}</div>`; mesAtual = mesRef; }
        
        const txtDono = (c.dono && c.dono !== "Ambos") ? ` <span style="color:#7b2ff7; font-size:0.85em;">(${c.dono})</span>` : "";

        listaComp.innerHTML += `
        <div class="card-agenda">
            <div>
                <span class="card-data">${formatarData(c.data)} • ${getDiaSemana(c.data)}</span>
                <span class="card-hora">${c.hora}</span>
                <span class="card-titulo">${c.titulo}${txtDono}</span>
            </div>
            <div>
                <button onclick="agendarNativo('${c.titulo}','${c.data}','${c.hora}')" style="background:none;border:none;cursor:pointer;font-size:18px">⏰</button>
                <button onclick="excluirAgenda(${c.id})" style="background:none;border:none;cursor:pointer;font-size:16px">🗑️</button>
            </div>
        </div>`;
    });
    if(agenda.length===0) listaComp.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px'>Agenda vazia.</p>";

    const listaNotas = document.getElementById('listaNotas');
    listaNotas.innerHTML = "";
    notas.sort((a,b) => a.feito - b.feito);
    notas.forEach(n => {
        listaNotas.innerHTML += `
        <div class="card-nota ${n.feito?'feito':''}">
            <button class="check-btn" onclick="toggleNota(${n.id})">${n.feito?'✔':''}</button>
            <div class="nota-texto" onclick="editarNota(${n.id})">${n.texto}</div>
            <button onclick="excluirNota(${n.id})" style="background:none;border:none;cursor:pointer;color:#ef5350">🗑️</button>
        </div>`;
    });
    if(notas.length===0) listaNotas.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px'>Sem anotações.</p>";
}

function abrirModalAgenda() { document.getElementById('modalAgenda').style.display = 'flex'; }
function fecharModais() { document.getElementById('modalAgenda').style.display = 'none'; document.getElementById('modalNota').style.display = 'none'; }

function addAgenda() {
    const t = document.getElementById('agendaTitulo').value;
    const d = document.getElementById('agendaData').value;
    const h = document.getElementById('agendaHora').value;
    const dono = document.getElementById('agendaDono').value;

    if(!t || !d || !h) return;
    
    agenda.push({ id: Date.now(), titulo: t, data: d, hora: h, dono: dono });
    salvarNuvem();
    
    // NOTIFICAÇÃO 3: NOVO COMPROMISSO
    enviarNotificacao("📅 Novo Compromisso!", `Um compromisso de ${dono} foi marcado para ${formatarData(d)} às ${h}.`);
    
    fecharModais(); 
    document.getElementById('agendaTitulo').value = ""; 
}

function excluirAgenda(id) { if(confirm("Apagar?")) { agenda = agenda.filter(x => x.id !== id); salvarNuvem(); } }

function abrirModalNota() { document.getElementById('modalNota').style.display = 'flex'; }
function addNota() {
    const t = document.getElementById('notaTexto').value;
    if(!t) return;
    notas.unshift({ id: Date.now(), texto: t, feito: false });
    salvarNuvem();
    
    // NOTIFICAÇÃO 4: NOVA NOTA
    enviarNotificacao("📝 Novo Recado", "Uma nova anotação foi salva no aplicativo.");
    
    fecharModais(); document.getElementById('notaTexto').value = ""; 
}

function toggleNota(id) { const n = notas.find(x => x.id === id); if(n) { n.feito = !n.feito; salvarNuvem(); } }
function excluirNota(id) { if(confirm("Apagar?")) { notas = notas.filter(x => x.id !== id); salvarNuvem(); } }
function editarNota(id) { const n = notas.find(x => x.id === id); const novo = prompt("Editar:", n.texto); if(novo) { n.texto = novo; salvarNuvem(); } }

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function formatarData(iso) { const d = iso.split("-"); return `${d[2]}/${d[1]}`; }
function getMesAno(iso) { const d = new Date(iso + "T00:00:00"); return `${meses[d.getMonth()]} ${d.getFullYear()}`; }
function getDiaSemana(iso) { const d = new Date(iso + "T00:00:00"); return dias[d.getDay()]; }

function verificarLembretes() {
    const amanha = new Date(); amanha.setDate(new Date().getDate() + 1);
    const dataAmanha = amanha.toISOString().split("T")[0];
    const itens = agenda.filter(c => c.data === dataAmanha);
    if(itens.length > 0) alert(`🔔 Lembrete: ${itens.length} compromisso(s) amanhã!`);
}

function agendarNativo(titulo, data, hora) {
    const inicio = data.replace(/-/g, "") + "T" + hora.replace(":", "") + "00";
    const fim = data.replace(/-/g, "") + "T" + (parseInt(hora.substring(0,2))+1).toString().padStart(2,'0') + hora.substring(3) + "00";
    if(confirm("Abrir calendário do celular?")) window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${inicio}/${fim}`, '_blank');
}
/* ================= 6. NOTIFICAÇÕES (ONESIGNAL) - MODO DETETIVE 2 ================= */
async function enviarNotificacao(titulo, mensagem) {
    const appId = "9b555390-0b3d-448b-8461-2a7d79aec4b9";
    const restApiKey = "os_v2_app_tnkvhealhvcixbdbfj6xtlwexfbt6zc4yrmutu56e5jmeoqldsqw2sbfimmgq5lj7yugqyejqhormt2c6zowpg7qryfp25uwuo5a7xq"; 

    const url = "https://onesignal.com/api/v1/notifications";
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // MUDANÇA: Usando a palavra 'Key' para chaves V2
            'Authorization': `Key ${restApiKey}`
        },
        body: JSON.stringify({
            app_id: appId,
            included_segments: ["Total Subscriptions", "Subscribed Users"], 
            headings: { "en": titulo, "pt": titulo },
            contents: { "en": mensagem, "pt": mensagem }
        })
    };

    try {
        const resposta = await fetch("https://corsproxy.io/?" + encodeURIComponent(url), options);
        const dados = await resposta.json();
        
        if (dados.errors) {
            alert("❌ O OneSignal bloqueou: " + JSON.stringify(dados.errors));
        } else {
            alert("✅ Sucesso! O OneSignal aceitou. Entregue para: " + dados.recipients + " aparelho(s).");
        }
    } catch (e) {
        alert("🚧 Erro de Conexão: " + e.message);
    }
}

