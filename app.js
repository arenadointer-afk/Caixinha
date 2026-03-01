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
let perfisSaude = []; 
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

/* ================= 2. AUTENTICAÇÃO E NUVEM ================= */
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
                  perfisSaude = d.perfisSaude || []; 
                  
                  if(ui.mainContainer.style.display === 'block') {
                      renderCaixinhas();
                      renderAgenda();
                      renderSaude(); 
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
    renderSaude(); 
}

function salvarNuvem() {
    if (auth.currentUser) {
        db.collection("dados_caixinhas_agenda").doc(auth.currentUser.uid).set({
            caixas: caixas,
            agenda: agenda,
            notas: notas,
            perfisSaude: perfisSaude 
        }).catch(erro => console.error("Erro ao salvar:", erro));
    }
}

async function tentarAutoLogin() {
    if (window.PublicKeyCredential) {
        try {
            const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (available) {
                acaoBotaoBiometria();
            }
        } catch (e) { console.log("Biometria não disponível"); }
    }
}

async function acaoBotaoBiometria() {
    try {
        const publicKeyCredentialRequestOptions = { challenge: new Uint8Array(32), userVerification: "required" };
        const assertion = await navigator.credentials.get({ publicKey: publicKeyCredentialRequestOptions });
        if (assertion) { entrarNoApp(); }
    } catch (e) {
        document.getElementById("loginEmail").style.display = "block";
        document.getElementById("loginSenha").style.display = "block";
        document.getElementById("btnEntrar").style.display = "block";
    }
}

ui.fotoPerfil.onclick = () => ui.uploadFoto.click();
ui.uploadFoto.onchange = e => {
  const r = new FileReader();
  r.onload = () => { localStorage.setItem("fotoPerfilCaixa", r.result); ui.fotoPerfil.src = r.result; };
  r.readAsDataURL(e.target.files[0]);
};
function carregarFoto() { const f = localStorage.getItem("fotoPerfilCaixa"); if(f) ui.fotoPerfil.src = f; }

/* ================= 3. NAVEGAÇÃO E MODAIS ================= */
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
    document.getElementById('nome').value = ""; document.getElementById('valor').value = "";
}
function abrirCaixa(i) { caixaAberta = i; renderCaixinhas(); }
function voltarLista() { caixaAberta = null; renderCaixinhas(); }
function marcarValor(i) { 
    caixas[caixaAberta].valores[i].ok = !caixas[caixaAberta].valores[i].ok;
    salvarNuvem();
    if(caixas[caixaAberta].valores.every(v => v.ok)) { ui.confete.style.display = "flex"; setTimeout(()=>ui.confete.style.display="none", 3000); }
}
function deletarCaixa() { if(confirm("Apagar?")) { caixas.splice(caixaAberta, 1); caixaAberta = null; salvarNuvem(); } }


/* ================= 5. LÓGICA AGENDA E NOTAS ================= */
let pressTimer;
let agendaSelecionadaId = null;
let notaSelecionadaId = null;

function startPress(id) { pressTimer = setTimeout(() => abrirOpcoesAgenda(id), 500); }
function startPressNota(id) { pressTimer = setTimeout(() => abrirOpcoesNota(id), 500); }
function cancelPress() { clearTimeout(pressTimer); }

function abrirOpcoesAgenda(id) {
    agendaSelecionadaId = id;
    const item = agenda.find(x => x.id === id);
    if(!item) return;
    document.getElementById('opcoesAgendaTitulo').innerText = item.titulo;
    document.getElementById('modalOpcoesAgenda').style.display = 'flex';
    if(navigator.vibrate) navigator.vibrate(50);
}

function chamarAgendarNativo() {
    fecharModais();
    const item = agenda.find(x => x.id === agendaSelecionadaId);
    if(item) agendarNativo(item.titulo, item.data, item.hora);
}

function chamarExcluirAgenda() { fecharModais(); excluirAgenda(agendaSelecionadaId); }

function chamarEdicaoAgenda() {
    fecharModais();
    const item = agenda.find(x => x.id === agendaSelecionadaId);
    if(!item) return;
    document.getElementById('agendaIdEdit').value = item.id;
    document.getElementById('agendaTitulo').value = item.titulo;
    document.getElementById('agendaData').value = item.data;
    document.getElementById('agendaHora').value = item.hora;
    document.getElementById('agendaDono').value = item.dono || "Ambos";
    document.getElementById('modalAgendaTituloDisplay').innerText = "Editar Compromisso";
    document.getElementById('modalAgenda').style.display = 'flex';
}

function abrirOpcoesNota(id) {
    notaSelecionadaId = id;
    document.getElementById('modalOpcoesNota').style.display = 'flex';
    if(navigator.vibrate) navigator.vibrate(50);
}

function chamarExcluirNota() { fecharModais(); excluirNota(notaSelecionadaId); }

function chamarEdicaoNota() {
    fecharModais();
    const item = notas.find(x => x.id === notaSelecionadaId);
    if(!item) return;
    document.getElementById('notaIdEdit').value = item.id;
    document.getElementById('notaTexto').value = item.texto;
    document.getElementById('modalNotaTituloDisplay').innerText = "Editar Nota";
    document.getElementById('modalNota').style.display = 'flex';
}

function fecharModais() { 
    document.getElementById('modalAgenda').style.display = 'none'; 
    document.getElementById('modalNota').style.display = 'none'; 
    document.getElementById('modalPerfilSaude').style.display = 'none'; 
    document.getElementById('modalAtualizarPeso').style.display = 'none'; 
    const modalOpAg = document.getElementById('modalOpcoesAgenda');
    if(modalOpAg) modalOpAg.style.display = 'none';
    const modalOpNot = document.getElementById('modalOpcoesNota');
    if(modalOpNot) modalOpNot.style.display = 'none';
}

function abrirModalAgenda() { 
    document.getElementById('agendaIdEdit').value = "";
    document.getElementById('agendaTitulo').value = "";
    document.getElementById('agendaData').value = "";
    document.getElementById('agendaHora').value = "";
    document.getElementById('agendaDono').value = "Ambos";
    document.getElementById('modalAgendaTituloDisplay').innerText = "Novo Compromisso";
    document.getElementById('modalAgenda').style.display = 'flex'; 
}

function addAgenda() {
    const idEdit = document.getElementById('agendaIdEdit').value;
    const t = document.getElementById('agendaTitulo').value;
    const d = document.getElementById('agendaData').value;
    const h = document.getElementById('agendaHora').value;
    const dono = document.getElementById('agendaDono').value;

    if(!t || !d || !h) return;
    
    if (idEdit) {
        const index = agenda.findIndex(x => x.id == idEdit);
        if (index !== -1) {
            agenda[index].titulo = t; agenda[index].data = d;
            agenda[index].hora = h; agenda[index].dono = dono;
        }
    } else {
        agenda.push({ id: Date.now(), titulo: t, data: d, hora: h, dono: dono });
    }
    salvarNuvem(); fecharModais(); renderAgenda();
}

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
        <div class="card-agenda" 
             onmousedown="startPress(${c.id})" onmouseup="cancelPress()" onmouseleave="cancelPress()" 
             ontouchstart="startPress(${c.id})" ontouchend="cancelPress()" ontouchmove="cancelPress()"
             oncontextmenu="return false;"
             style="cursor:pointer; user-select:none; -webkit-user-select:none; position:relative;">
            <div style="width: 100%;">
                <span class="card-data">${formatarData(c.data)} • ${getDiaSemana(c.data)}</span>
                <span class="card-hora">${c.hora}</span>
                <span class="card-titulo">${c.titulo}${txtDono}</span>
            </div>
        </div>`;
    });
    if(agenda.length===0) listaComp.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px'>Agenda vazia.</p>";

    const listaNotas = document.getElementById('listaNotas');
    listaNotas.innerHTML = "";
    notas.sort((a,b) => a.feito - b.feito);
    notas.forEach(n => {
        listaNotas.innerHTML += `
        <div class="card-nota ${n.feito?'feito':''}"
             onmousedown="startPressNota(${n.id})" onmouseup="cancelPress()" onmouseleave="cancelPress()" 
             ontouchstart="startPressNota(${n.id})" ontouchend="cancelPress()" ontouchmove="cancelPress()"
             oncontextmenu="return false;"
             style="cursor:pointer; user-select:none; -webkit-user-select:none; position:relative; justify-content: flex-start; gap: 10px;">
            <button class="check-btn" onclick="toggleNota(${n.id}); event.stopPropagation();" style="z-index: 2;">${n.feito?'✔':''}</button>
            <div class="nota-texto" style="flex-grow: 1;">${n.texto}</div>
        </div>`;
    });
    if(notas.length===0) listaNotas.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px'>Sem anotações.</p>";
}

function excluirAgenda(id) { if(confirm("Tem a certeza que deseja apagar?")) { agenda = agenda.filter(x => x.id !== id); salvarNuvem(); renderAgenda(); } }

function abrirModalNota() { 
    document.getElementById('notaIdEdit').value = "";
    document.getElementById('notaTexto').value = "";
    document.getElementById('modalNotaTituloDisplay').innerText = "Nova Nota";
    document.getElementById('modalNota').style.display = 'flex'; 
}

function addNota() {
    const idEdit = document.getElementById('notaIdEdit').value;
    const t = document.getElementById('notaTexto').value;
    if(!t) return;
    
    if (idEdit) {
        const index = notas.findIndex(x => x.id == idEdit);
        if (index !== -1) notas[index].texto = t;
    } else {
        notas.unshift({ id: Date.now(), texto: t, feito: false });
    }
    salvarNuvem(); fecharModais(); renderAgenda();
}
function toggleNota(id) { const n = notas.find(x => x.id === id); if(n) { n.feito = !n.feito; salvarNuvem(); renderAgenda(); } }
function excluirNota(id) { if(confirm("Apagar?")) { notas = notas.filter(x => x.id !== id); salvarNuvem(); renderAgenda(); } }

/* ================= 6. LÓGICA DA SAÚDE E BEM-ESTAR ================= */
function abrirModalPerfilSaude() { document.getElementById('modalPerfilSaude').style.display = 'flex'; }

function salvarPerfilSaude() {
    const nome = document.getElementById('saudeNome').value;
    const sexo = document.getElementById('saudeSexo').value;
    const altura = parseFloat(document.getElementById('saudeAltura').value);
    const peso = parseFloat(document.getElementById('saudePeso').value);
    const corPele = document.getElementById('saudeCorPele').value;

    if(!nome || !altura || !peso) return alert("Preencha todos os campos!");

    perfisSaude.push({
        id: Date.now(),
        nome: nome,
        sexo: sexo,
        altura: altura, 
        corPele: corPele, 
        historicoPeso: [{ data: new Date().toISOString().split('T')[0], peso: peso }]
    });

    salvarNuvem();
    fecharModais();
    
    document.getElementById('saudeNome').value = "";
    document.getElementById('saudeAltura').value = "";
    document.getElementById('saudePeso').value = "";
    renderSaude();
}

function abrirModalAtualizarPeso(idPerfil) {
    document.getElementById('pesoIdPerfil').value = idPerfil;
    document.getElementById('modalAtualizarPeso').style.display = 'flex';
}

function salvarNovoPeso() {
    const id = Number(document.getElementById('pesoIdPerfil').value);
    const novoPeso = parseFloat(document.getElementById('novoPesoVal').value);
    if(!novoPeso) return;

    const perfil = perfisSaude.find(p => p.id === id);
    if(perfil) {
        perfil.historicoPeso.push({ data: new Date().toISOString().split('T')[0], peso: novoPeso });
        salvarNuvem();
    }
    fecharModais();
    document.getElementById('novoPesoVal').value = "";
    renderSaude();
}

function excluirPerfilSaude(id) {
    if(confirm("Tem certeza que deseja apagar esta pessoa e todo o histórico?")) {
        perfisSaude = perfisSaude.filter(p => p.id !== id);
        salvarNuvem();
        renderSaude();
    }
}

function compartilharSaudeWhatsApp(id) {
    const p = perfisSaude.find(x => x.id === id);
    if(!p) return;
    
    const pesoAtual = p.historicoPeso[p.historicoPeso.length - 1].peso;
    const pesoInicial = p.historicoPeso[0].peso;
    const dif = pesoAtual - pesoInicial;
    const difTexto = dif > 0 ? `+${dif.toFixed(1)} kg` : `${dif.toFixed(1)} kg`;
    
    const alturaMetros = p.altura / 100;
    const imc = (pesoAtual / (alturaMetros * alturaMetros)).toFixed(1);
    
    let classImc = "";
    if (imc < 18.5) classImc = "Abaixo do Peso";
    else if (imc < 25) classImc = "Peso Ideal 🌟";
    else if (imc < 30) classImc = "Sobrepeso ⚠️";
    else classImc = "Obesidade 🛑";

    let txt = `🏥 *Progresso de Saúde de ${p.nome}*\n\n`;
    txt += `📏 *Altura:* ${alturaMetros.toFixed(2)}m\n`;
    txt += `⚖️ *Peso Atual:* ${pesoAtual} kg\n`;
    txt += `📊 *IMC:* ${imc} (${classImc})\n`;
    txt += `📉 *Evolução Total:* ${difTexto}\n\n`;
    txt += `*Histórico de Pesagens:*\n`;
    
    p.historicoPeso.forEach(h => {
        txt += `- ${formatarData(h.data)}: ${h.peso} kg\n`;
    });

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`;
    window.open(url, '_blank');
}

function renderSaude() {
    const lista = document.getElementById('listaPerfisSaude');
    if(!lista) return;
    lista.innerHTML = "";
    
    if(perfisSaude.length === 0) {
        lista.innerHTML = "<p style='text-align:center;color:#aaa;'>Nenhum perfil de saúde criado.</p>";
        return;
    }

    perfisSaude.forEach(p => {
        const pesoAtual = p.historicoPeso[p.historicoPeso.length - 1].peso;
        const pesoInicial = p.historicoPeso[0].peso;
        
        const dif = pesoAtual - pesoInicial;
        const difTexto = dif > 0 ? `+${dif.toFixed(1)} kg` : `${dif.toFixed(1)} kg`;
        const difCor = dif > 0 ? "#ef5350" : "#66bb6a"; 

        const alturaMetros = p.altura / 100;
        const imc = (pesoAtual / (alturaMetros * alturaMetros)).toFixed(1);
        
        let classImc = "";
        let corImc = "";
        if (imc < 18.5) { classImc = "Abaixo do Peso"; corImc = "#ffb74d"; }
        else if (imc < 25) { classImc = "Peso Ideal"; corImc = "#66bb6a"; }
        else if (imc < 30) { classImc = "Sobrepeso"; corImc = "#ffa726"; }
        else { classImc = "Obesidade"; corImc = "#ef5350"; }
        
        let scaleX = Math.max(0.7, Math.min(2.5, imc / 22)); 
        let corBoneco = p.corPele || "#ffdbac"; 
        let corRoupa = p.sexo === 'F' ? '#e91e63' : '#3f51b5'; 

        let iconeSVG = `
        <svg viewBox="0 0 100 120" width=\"65\" height=\"80\" style=\"transform: scaleX(${scaleX}); transform-origin: bottom center; transition: transform 0.5s ease; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.4));\">
            <rect x=\"45\" y=\"30\" width=\"10\" height=\"15\" fill=\"${corBoneco}\" />
            <circle cx=\"50\" cy=\"20\" r=\"16\" fill=\"${corBoneco}\" />
            <path d=\"M 32 20 C 32 5, 68 5, 68 20 C 68 25, 65 30, 65 30 C 50 15, 35 30, 35 30 C 35 30, 32 25, 32 20 Z\" fill=\"#2d1e16\" />
            <circle cx=\"44\" cy=\"18\" r=\"2.5\" fill=\"#111\" />
            <circle cx=\"56\" cy=\"18\" r=\"2.5\" fill=\"#111\" />
            <path d=\"M 45 25 Q 50 30 55 25\" stroke=\"#111\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/>
            <path d=\"M 30 45 L 20 80\" stroke=\"${corBoneco}\" stroke-width=\"8\" stroke-linecap=\"round\" fill=\"none\" />
            <path d=\"M 70 45 L 80 80\" stroke=\"${corBoneco}\" stroke-width=\"8\" stroke-linecap=\"round\" fill=\"none\" />
            <path d=\"M 35 40 Q 50 35 65 40 L 70 80 L 30 80 Z\" fill=\"${corRoupa}\" rx=\"5\"/>
            <path d=\"M 35 40 L 25 55\" stroke=\"${corRoupa}\" stroke-width=\"10\" stroke-linecap=\"round\" />
            <path d=\"M 65 40 L 75 55\" stroke=\"${corRoupa}\" stroke-width=\"10\" stroke-linecap=\"round\" />
            <path d=\"M 32 80 L 68 80 L 63 120 L 53 120 L 50 95 L 47 120 L 37 120 Z\" fill=\"#1a1a1a\" />
        </svg>`;

        // CORREÇÃO: MATEMÁTICA DE DATAS EXATA (Mínimo de 30 dias para avisar)
        const ultimaData = new Date(p.historicoPeso[p.historicoPeso.length - 1].data + "T00:00:00");
        const hoje = new Date();
        const diffTempo = hoje.getTime() - ultimaData.getTime();
        const diffDias = Math.floor(diffTempo / (1000 * 3600 * 24)); // Converte milissegundos em dias
        
        const aviso = diffDias >= 30 ? `<div style=\"color:#ffa726; font-size:12px; margin-top:5px; font-weight:bold;\">⚠️ Já passou 1 mês! Atualize o seu peso.</div>` : "";

        lista.innerHTML += `
        <div style=\"background:#1e1e24; border-radius:15px; padding:15px; border:1px solid #333; position: relative;\">
            
            <div style=\"display:flex; justify-content:space-between; align-items:center;\">
                <h3 style=\"color:white; margin:0; font-size: 18px;\">${p.nome}</h3>
                <div style=\"display: flex; gap: 8px;\">
                    <button onclick=\"compartilharSaudeWhatsApp(${p.id})\" style=\"background:#25D366; border:none; color:white; width:35px; height:35px; border-radius:8px; cursor:pointer; font-size: 16px;\">📱</button>
                    <button onclick=\"excluirPerfilSaude(${p.id})\" style=\"background:#ef5350; border:none; color:white; width:35px; height:35px; border-radius:8px; cursor:pointer; font-size: 16px;\">🗑️</button>
                </div>
            </div>
            
            <div style=\"display:flex; margin-top:20px; align-items:center; gap:25px;\">
                <div class=\"pwa-person-container\">${iconeSVG}</div>
                <div style=\"flex-grow: 1;\">
                    <div style=\"color:#aaa; font-size:14px;\">Peso Atual: <strong style=\"color:white; font-size:18px;\">${pesoAtual} kg</strong></div>
                    <div style=\"color:#aaa; font-size:14px; margin-top:3px;\">IMC: <strong style=\"color:white;\">${imc}</strong> <span style=\"background:${corImc}; color:#111; padding:2px 6px; border-radius:10px; font-size:11px; font-weight:bold; margin-left:5px;\">${classImc}</span></div>
                    <div style=\"color:#aaa; font-size:14px; margin-top:3px;\">Desde o Início: <strong style=\"color:${difCor};\">${difTexto}</strong></div>
                    ${aviso}
                </div>
            </div>

            <div style=\"margin-top:15px; display:flex; justify-content:center;\">
                <button onclick=\"abrirModalAtualizarPeso(${p.id})\" style=\"background:#7b2ff7; width: 100%; border:none; color:white; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold;\">⚖️ Atualizar Peso Hoje</button>
            </div>

            <div style=\"margin-top:15px; font-size:12px; color:#666; background:#111; padding:8px; border-radius:8px;\">
                <strong>Histórico:</strong> ${p.historicoPeso.slice(-4).map(h => `${formatarData(h.data)} (${h.peso}kg)`).join(' ➔ ')}
            </div>
        </div>`;
    });
}


/* ================= 7. UTILITÁRIOS E DATAS ================= */
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
    if(confirm("Abrir calendário do telemóvel?")) window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${inicio}/${fim}`, '_blank');
}