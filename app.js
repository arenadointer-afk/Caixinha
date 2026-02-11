/* ================= GLOBAIS ================= */
// --- CAIXINHAS ---
let caixas = JSON.parse(localStorage.getItem("caixas")) || [];
let caixaAberta = null;
let userPin = localStorage.getItem("userPin");

// --- AGENDA & NOTAS ---
let agenda = JSON.parse(localStorage.getItem("agenda_db")) || [];
let notas = JSON.parse(localStorage.getItem("notas_db")) || [];
let subAbaAgenda = 'compromissos'; 

// Elementos UI Principais
const ui = {
    lock: document.getElementById('lock'),
    mainContainer: document.getElementById('mainContainer'),
    pinInput: document.getElementById('pinInput'),
    tituloLock: document.getElementById('tituloLock'),
    msgLock: document.getElementById('msgLock'),
    btnLock: document.getElementById('btnLock'),
    erroPin: document.getElementById('erroPin'),
    totalGlobal: document.getElementById('totalGlobal'),
    listaCaixas: document.getElementById('lista'),
    fotoPerfil: document.getElementById('fotoPerfil'),
    uploadFoto: document.getElementById('uploadFoto'),
    confete: document.getElementById('confete')
};

/* ================= INICIALIZAÇÃO ================= */
function init() {
    carregarFoto();
    if (!userPin) {
        ui.tituloLock.innerText = "🆕 Criar Senha";
        ui.msgLock.innerText = "Crie uma senha numérica de 4 dígitos";
        ui.btnLock.innerText = "Salvar";
    }
}

function verificarPin() {
    const input = ui.pinInput.value;
    if (!input) return;

    if (!userPin) {
        localStorage.setItem("userPin", input);
        userPin = input;
        alert("Senha criada!");
        entrarApp();
    } else {
        if (input === userPin) entrarApp();
        else {
            ui.erroPin.style.display = "block";
            ui.pinInput.value = "";
        }
    }
}

function entrarApp() {
    ui.lock.style.display = "none";
    ui.mainContainer.style.display = "block";
    renderCaixinhas();
    renderAgenda();
    verificarLembretes(); // Checa se tem compromisso amanhã
}

function logout() { location.reload(); }

/* FOTO */
ui.fotoPerfil.onclick = () => ui.uploadFoto.click();
ui.uploadFoto.onchange = e => {
  const r = new FileReader();
  r.onload = () => { localStorage.setItem("fotoPerfil", r.result); ui.fotoPerfil.src = r.result; };
  r.readAsDataURL(e.target.files[0]);
};
function carregarFoto() { const f = localStorage.getItem("fotoPerfil"); if(f) ui.fotoPerfil.src = f; }

/* ================= NAVEGAÇÃO PRINCIPAL ================= */
function mudarAbaPrincipal(abaId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(abaId).style.display = 'block';
    btn.classList.add('active');
}

/* ================= LÓGICA CAIXINHAS ================= */
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
    localStorage.setItem("caixas", JSON.stringify(caixas));
    document.getElementById('nome').value = ""; document.getElementById('valor').value = "";
    renderCaixinhas();
}
function abrirCaixa(i) { caixaAberta = i; renderCaixinhas(); }
function voltarLista() { caixaAberta = null; renderCaixinhas(); }
function marcarValor(i) { 
    caixas[caixaAberta].valores[i].ok = !caixas[caixaAberta].valores[i].ok;
    localStorage.setItem("caixas", JSON.stringify(caixas));
    if(caixas[caixaAberta].valores.every(v => v.ok)) { ui.confete.style.display = "flex"; setTimeout(()=>ui.confete.style.display="none", 3000); }
    renderCaixinhas();
}
function deletarCaixa() { if(confirm("Apagar?")) { caixas.splice(caixaAberta, 1); caixaAberta = null; localStorage.setItem("caixas", JSON.stringify(caixas)); renderCaixinhas(); } }

/* ================= LÓGICA AGENDA & NOTAS ================= */
function mudarSubAba(aba) {
    subAbaAgenda = aba;
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(aba === 'compromissos' ? 'subTabCompromissos' : 'subTabNotas').classList.add('active');
    document.getElementById('viewCompromissos').style.display = aba === 'compromissos' ? 'block' : 'none';
    document.getElementById('viewNotas').style.display = aba === 'notas' ? 'block' : 'none';
    renderAgenda();
}

function renderAgenda() {
    // Render Compromissos
    const listaComp = document.getElementById('listaCompromissos');
    listaComp.innerHTML = "";
    agenda.sort((a, b) => new Date(`${a.data}T${a.hora}`) - new Date(`${b.data}T${b.hora}`));
    
    let mesAtual = "";
    agenda.forEach(c => {
        const mesRef = getMesAno(c.data);
        if(mesRef !== mesAtual) { listaComp.innerHTML += `<div class="mes-header">${mesRef}</div>`; mesAtual = mesRef; }
        listaComp.innerHTML += `
        <div class="card-agenda">
            <div onclick="editarAgenda(${c.id})">
                <span class="card-data">${formatarData(c.data)} • ${getDiaSemana(c.data)}</span>
                <span class="card-hora">${c.hora}</span>
                <span class="card-titulo">${c.titulo}</span>
            </div>
            <div>
                <button onclick="agendarNativo('${c.titulo}','${c.data}','${c.hora}')" style="background:none;border:none;cursor:pointer;font-size:18px">⏰</button>
                <button onclick="excluirAgenda(${c.id})" style="background:none;border:none;cursor:pointer;font-size:16px">🗑️</button>
            </div>
        </div>`;
    });
    if(agenda.length===0) listaComp.innerHTML = "<p style='text-align:center;color:#666;margin-top:20px'>Agenda vazia.</p>";

    // Render Notas
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

// CRUD Agenda
function abrirModalAgenda() { document.getElementById('modalAgenda').style.display = 'flex'; }
function fecharModais() { document.getElementById('modalAgenda').style.display = 'none'; document.getElementById('modalNota').style.display = 'none'; }
function addAgenda() {
    const t = document.getElementById('agendaTitulo').value;
    const d = document.getElementById('agendaData').value;
    const h = document.getElementById('agendaHora').value;
    if(!t || !d || !h) return;
    agenda.push({ id: Date.now(), titulo: t, data: d, hora: h });
    localStorage.setItem("agenda_db", JSON.stringify(agenda));
    fecharModais(); document.getElementById('agendaTitulo').value = ""; renderAgenda();
}
function excluirAgenda(id) { if(confirm("Apagar?")) { agenda = agenda.filter(x => x.id !== id); localStorage.setItem("agenda_db", JSON.stringify(agenda)); renderAgenda(); } }

// CRUD Notas
function abrirModalNota() { document.getElementById('modalNota').style.display = 'flex'; }
function addNota() {
    const t = document.getElementById('notaTexto').value;
    if(!t) return;
    notas.unshift({ id: Date.now(), texto: t, feito: false });
    localStorage.setItem("notas_db", JSON.stringify(notas));
    fecharModais(); document.getElementById('notaTexto').value = ""; renderAgenda();
}
function toggleNota(id) { const n = notas.find(x => x.id === id); if(n) { n.feito = !n.feito; localStorage.setItem("notas_db", JSON.stringify(notas)); renderAgenda(); } }
function excluirNota(id) { if(confirm("Apagar?")) { notas = notas.filter(x => x.id !== id); localStorage.setItem("notas_db", JSON.stringify(notas)); renderAgenda(); } }
function editarNota(id) { const n = notas.find(x => x.id === id); const novo = prompt("Editar:", n.texto); if(novo) { n.texto = novo; localStorage.setItem("notas_db", JSON.stringify(notas)); renderAgenda(); } }

// Úteis
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

/* ================= EXTRAS (PDF & BACKUP AGENDA) ================= */
function baixarBackupAgenda() {
    const dados = { agenda, notas, data: new Date() };
    const blob = new Blob([JSON.stringify(dados)], {type: "application/json"});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "backup_agenda.json"; a.click();
}
function restaurarBackupAgenda(input) {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const d = JSON.parse(e.target.result);
            if(d.agenda || d.notas) {
                if(confirm("Substituir dados atuais?")) {
                    agenda = d.agenda || []; notas = d.notas || [];
                    localStorage.setItem("agenda_db", JSON.stringify(agenda));
                    localStorage.setItem("notas_db", JSON.stringify(notas));
                    alert("Restaurado!"); renderAgenda();
                }
            }
        } catch(err) { alert("Erro arquivo."); }
    };
    reader.readAsText(file);
}

function gerarPDFAgenda() {
    if(!window.jspdf) return alert("Erro PDF");
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.text("AGENDA PESSOAL", 105, 15, {align:'center'});
    const dados = agenda.map(c => [formatarData(c.data), c.hora, c.titulo]);
    doc.autoTable({ head: [['Data', 'Hora', 'Compromisso']], body: dados, startY: 25 });
    doc.save("minha_agenda.pdf");
}

init();
