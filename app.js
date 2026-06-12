/* ================= 0. FIREBASE ================= */
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
const db   = firebase.firestore();

/* ================= 1. ESTADO GLOBAL ================= */
let caixas       = [];
let agenda       = [];
let notas        = [];
let perfisSaude  = [];
let caixaAberta  = null;
let subAbaAgenda = 'compromissos';
let _pressTimer  = null;
let _agendaSelId = null;
let _notaSelId   = null;
let _toast       = null;

const ui = {
    lock:          document.getElementById('lock'),
    main:          document.getElementById('mainContainer'),
    totalGlobal:   document.getElementById('totalGlobal'),
    listaCaixas:   document.getElementById('lista'),
    fotoPerfil:    document.getElementById('fotoPerfil'),
    uploadFoto:    document.getElementById('uploadFoto'),
    confete:       document.getElementById('confete'),
};

/* ================= 2. TOAST (substitui alert/confirm) ================= */
function toast(msg, tipo = 'info', duracao = 3000) {
    if (_toast) _toast.remove();
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(el);
    _toast = el;
    requestAnimationFrame(() => el.classList.add('toast-show'));
    setTimeout(() => { el.classList.remove('toast-show'); setTimeout(() => el.remove(), 300); }, duracao);
}

function confirmar(msg, titulo = 'Confirmar') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
        <div class="modal-card" style="text-align:center; max-width:320px;">
            <div style="font-size:32px; margin-bottom:12px;">⚠️</div>
            <h3 style="margin-bottom:8px;">${titulo}</h3>
            <p style="color:var(--text-secondary); font-size:14px; margin-bottom:20px;">${msg}</p>
            <div style="display:flex; gap:10px;">
                <button id="_cnfNo"  class="btn-cancelar" style="flex:1;">Cancelar</button>
                <button id="_cnfSim" class="btn-salvar"   style="flex:1; background:var(--danger); box-shadow:none;">Confirmar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#_cnfNo').onclick  = () => { overlay.remove(); resolve(false); };
        overlay.querySelector('#_cnfSim').onclick = () => { overlay.remove(); resolve(true);  };
    });
}

/* ================= 3. AUTENTICAÇÃO ================= */
function fazerLoginFirebase() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    if (!email || !senha) { toast('Preencha e-mail e senha.', 'erro'); return; }

    const btn = document.getElementById('btnEntrar');
    btn.textContent = 'Entrando…';
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, senha)
        .then(() => { localStorage.setItem('biometriaAtiva_Agenda', 'true'); })
        .catch(() => {
            toast('E-mail ou senha incorretos.', 'erro');
            btn.textContent = 'ENTRAR';
            btn.disabled = false;
        });
}

function logout() {
    auth.signOut().then(() => location.reload());
}

auth.onAuthStateChanged(user => {
    const emailEl  = document.getElementById('loginEmail');
    const senhaEl  = document.getElementById('loginSenha');
    const btnEntra = document.getElementById('btnEntrar');
    const btnBio   = document.getElementById('btnBiometria');

    if (user) {
        emailEl.style.display  = 'none';
        senhaEl.style.display  = 'none';
        btnEntra.style.display = 'none';
        btnBio.style.display   = 'block';

        db.collection('dados_caixinhas_agenda').doc(user.uid)
          .onSnapshot(doc => {
              if (doc.exists) {
                  const d = doc.data();
                  caixas      = d.caixas      || [];
                  agenda      = d.agenda      || [];
                  notas       = d.notas       || [];
                  perfisSaude = d.perfisSaude || [];
                  if (ui.main.style.display === 'block') {
                      renderCaixinhas();
                      renderAgenda();
                      renderSaude();
                  }
              }
          });

        verificarLembretes();

        if (localStorage.getItem('biometriaAtiva_Agenda') === 'true') {
            tentarAutoLogin();
        } else {
            entrarNoApp();
        }
    } else {
        ui.lock.style.display  = 'flex';
        ui.main.style.display  = 'none';
        emailEl.style.display  = 'block';
        senhaEl.style.display  = 'block';
        btnEntra.style.display = 'block';
        btnBio.style.display   = 'none';
    }
});

function entrarNoApp() {
    ui.lock.style.display = 'none';
    ui.main.style.display = 'block';
    carregarFoto();
    renderCaixinhas();
    renderAgenda();
    renderSaude();
}

function salvarNuvem() {
    if (!auth.currentUser) return;
    db.collection('dados_caixinhas_agenda').doc(auth.currentUser.uid).set({
        caixas, agenda, notas, perfisSaude
    }).catch(err => { console.error('Erro ao salvar:', err); toast('Erro ao salvar na nuvem.', 'erro'); });
}

async function tentarAutoLogin() {
    if (!window.PublicKeyCredential) { entrarNoApp(); return; }
    try {
        const ok = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (ok) await acaoBotaoBiometria();
        else entrarNoApp();
    } catch { entrarNoApp(); }
}

async function acaoBotaoBiometria() {
    try {
        const cred = await navigator.credentials.get({
            publicKey: { challenge: new Uint8Array(32), userVerification: 'required' }
        });
        if (cred) entrarNoApp();
    } catch {
        ['loginEmail','loginSenha','btnEntrar'].forEach(id =>
            document.getElementById(id).style.display = 'block');
        document.getElementById('btnBiometria').style.display = 'none';
    }
}

/* Foto de perfil */
ui.fotoPerfil.onclick  = () => ui.uploadFoto.click();
ui.uploadFoto.onchange = e => {
    const r = new FileReader();
    r.onload  = () => { localStorage.setItem('fotoPerfilCaixa', r.result); ui.fotoPerfil.src = r.result; };
    r.readAsDataURL(e.target.files[0]);
};
function carregarFoto() {
    const f = localStorage.getItem('fotoPerfilCaixa');
    if (f) ui.fotoPerfil.src = f;
}

/* ================= 4. NAVEGAÇÃO ================= */
function mudarAbaPrincipal(abaId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(abaId).style.display = 'block';
    btn.classList.add('active');
}

/* ================= 5. CAIXINHAS ================= */
function renderCaixinhas() {
    const totalGuardado = caixas.reduce((acc, c) =>
        acc + c.valores.filter(v => v.ok).reduce((s, v) => s + v.valor, 0), 0);
    ui.totalGlobal.textContent = formatarReais(totalGuardado);
    ui.listaCaixas.innerHTML = '';

    if (caixaAberta === null) {
        if (caixas.length === 0) {
            ui.listaCaixas.innerHTML = `
            <div style="text-align:center; padding:48px 24px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:12px;">📦</div>
                <p style="font-size:15px; font-weight:600; color:var(--text-secondary);">Nenhuma caixinha ainda</p>
                <p style="font-size:13px; margin-top:4px;">Crie uma meta acima para começar.</p>
            </div>`;
            return;
        }
        caixas.forEach((c, i) => {
            const guardado = c.valores.filter(v => v.ok).reduce((s, v) => s + v.valor, 0);
            const pct      = Math.min(100, Math.floor((guardado / c.total) * 100));
            const completo = pct === 100;
            ui.listaCaixas.innerHTML += `
            <div class="caixa ${completo ? 'caixa-completa' : ''}" onclick="abrirCaixa(${i})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:16px; font-weight:700;">${escHtml(c.nome)}</h3>
                    <span style="font-size:13px; color:var(--text-secondary); font-variant-numeric:tabular-nums;">${formatarReais(c.total)}</span>
                </div>
                <div class="barra-fundo" style="margin:10px 0 4px;">
                    <div class="barra-nivel" style="width:${pct}%"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <small style="color:var(--text-secondary); font-size:12px;">${formatarReais(guardado)} guardado</small>
                    <small style="color:${completo ? 'var(--success)' : 'var(--primary)'}; font-weight:700; font-size:12px;">${pct}%</small>
                </div>
            </div>`;
        });
        return;
    }

    /* Vista detalhe */
    const c        = caixas[caixaAberta];
    const guardado = c.valores.filter(v => v.ok).reduce((s, v) => s + v.valor, 0);
    const faltam   = c.total - guardado;
    const pct      = Math.min(100, Math.floor((guardado / c.total) * 100));

    ui.listaCaixas.innerHTML = `
    <div class="caixa" style="cursor:default;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <button onclick="voltarLista()" class="btn-voltar">← Voltar</button>
            <h3 style="font-size:17px; font-weight:700; flex:1; text-align:center;">${escHtml(c.nome)}</h3>
            <button onclick="deletarCaixa()" class="btn-deletar">🗑️</button>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-secondary); margin-bottom:8px;">
            <span>Guardado: <strong style="color:var(--success);">${formatarReais(guardado)}</strong></span>
            <span>Faltam: <strong style="color:var(--danger);">${formatarReais(faltam)}</strong></span>
        </div>
        <div class="barra-fundo"><div class="barra-nivel" style="width:${pct}%"></div></div>
        <div style="text-align:center; font-size:13px; color:var(--text-muted); margin:6px 0 14px;">${pct}% concluído</div>
        <div class="valores">
            ${c.valores.map((v, i) => `
            <div class="valor ${v.ok ? 'marcado' : ''}" onclick="marcarValor(${i})">
                ${formatarReais(v.valor)}
            </div>`).join('')}
        </div>
    </div>`;
}

function gerarValores(total) {
    const base = [10, 20, 50, 100];
    let soma = 0, arr = [];
    while (soma < total) {
        const resto = total - soma;
        const possiveis = base.filter(n => n <= resto);
        if (!possiveis.length) { if (resto > 0) arr.push({ valor: resto, ok: false }); break; }
        const v = possiveis[Math.floor(Math.random() * possiveis.length)];
        arr.push({ valor: v, ok: false });
        soma += v;
    }
    return arr.sort(() => Math.random() - 0.5);
}

function criarCaixa() {
    const nome  = document.getElementById('nome').value.trim();
    const valor = Number(document.getElementById('valor').value);
    if (!nome)   { toast('Digite um nome para a caixinha.', 'erro'); return; }
    if (!valor || valor <= 0) { toast('Digite um valor válido.', 'erro'); return; }
    if (valor > 100000) { toast('Valor muito alto (máx. R$ 100.000).', 'erro'); return; }
    caixas.push({ nome, total: valor, valores: gerarValores(valor) });
    salvarNuvem();
    document.getElementById('nome').value  = '';
    document.getElementById('valor').value = '';
    toast(`Caixinha "${nome}" criada! 🎉`, 'sucesso');
}

function abrirCaixa(i)  { caixaAberta = i;    renderCaixinhas(); }
function voltarLista()  { caixaAberta = null; renderCaixinhas(); }

function marcarValor(i) {
    const c   = caixas[caixaAberta];
    c.valores[i].ok = !c.valores[i].ok;
    salvarNuvem();
    if (c.valores.every(v => v.ok)) {
        ui.confete.style.display = 'flex';
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => { ui.confete.style.display = 'none'; }, 3500);
    }
    renderCaixinhas();
}

async function deletarCaixa() {
    const ok = await confirmar('Esta caixinha e todo o progresso serão apagados.', 'Apagar Caixinha?');
    if (!ok) return;
    caixas.splice(caixaAberta, 1);
    caixaAberta = null;
    salvarNuvem();
    toast('Caixinha apagada.', 'info');
}

/* ================= 6. AGENDA ================= */
function startPress(id)     { _pressTimer = setTimeout(() => abrirOpcoesAgenda(id), 500); }
function startPressNota(id) { _pressTimer = setTimeout(() => abrirOpcoesNota(id),   500); }
function cancelPress()      { clearTimeout(_pressTimer); }

function abrirOpcoesAgenda(id) {
    _agendaSelId = id;
    const item = agenda.find(x => x.id === id);
    if (!item) return;
    document.getElementById('opcoesAgendaTitulo').textContent = item.titulo;
    document.getElementById('modalOpcoesAgenda').style.display = 'flex';
    if (navigator.vibrate) navigator.vibrate(40);
}

function abrirOpcoesNota(id) {
    _notaSelId = id;
    document.getElementById('modalOpcoesNota').style.display = 'flex';
    if (navigator.vibrate) navigator.vibrate(40);
}

function chamarAgendarNativo()  { fecharModais(); const i = agenda.find(x => x.id === _agendaSelId); if (i) agendarNativo(i.titulo, i.data, i.hora); }
function chamarExcluirAgenda()  { fecharModais(); excluirAgenda(_agendaSelId); }
function chamarEdicaoAgenda()   {
    fecharModais();
    const item = agenda.find(x => x.id === _agendaSelId);
    if (!item) return;
    document.getElementById('agendaIdEdit').value           = item.id;
    document.getElementById('agendaTitulo').value           = item.titulo;
    document.getElementById('agendaData').value             = item.data;
    document.getElementById('agendaHora').value             = item.hora;
    document.getElementById('agendaDono').value             = item.dono || 'Ambos';
    document.getElementById('modalAgendaTituloDisplay').textContent = 'Editar Compromisso';
    document.getElementById('modalAgenda').style.display   = 'flex';
}

function chamarExcluirNota()    { fecharModais(); excluirNota(_notaSelId); }
function chamarEdicaoNota()     {
    fecharModais();
    const item = notas.find(x => x.id === _notaSelId);
    if (!item) return;
    document.getElementById('notaIdEdit').value             = item.id;
    document.getElementById('notaTexto').value              = item.texto;
    document.getElementById('modalNotaTituloDisplay').textContent = 'Editar Nota';
    document.getElementById('modalNota').style.display     = 'flex';
}

function fecharModais() {
    ['modalAgenda','modalNota','modalPerfilSaude','modalAtualizarPeso','modalOpcoesAgenda','modalOpcoesNota']
        .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

/* Fechar modal clicando no overlay */
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) fecharModais(); });
});

function abrirModalAgenda() {
    ['agendaIdEdit','agendaTitulo','agendaData','agendaHora'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('agendaDono').value = 'Ambos';
    document.getElementById('modalAgendaTituloDisplay').textContent = 'Novo Compromisso';
    document.getElementById('modalAgenda').style.display = 'flex';
    setTimeout(() => document.getElementById('agendaTitulo').focus(), 100);
}

function abrirModalNota() {
    ['notaIdEdit','notaTexto'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modalNotaTituloDisplay').textContent = 'Nova Nota';
    document.getElementById('modalNota').style.display = 'flex';
    setTimeout(() => document.getElementById('notaTexto').focus(), 100);
}

function addAgenda() {
    const idEdit = document.getElementById('agendaIdEdit').value;
    const titulo = document.getElementById('agendaTitulo').value.trim();
    const data   = document.getElementById('agendaData').value;
    const hora   = document.getElementById('agendaHora').value;
    const dono   = document.getElementById('agendaDono').value;

    if (!titulo) { toast('Digite um título.', 'erro'); return; }
    if (!data)   { toast('Selecione uma data.', 'erro'); return; }
    if (!hora)   { toast('Selecione um horário.', 'erro'); return; }

    if (idEdit) {
        const idx = agenda.findIndex(x => x.id == idEdit);
        if (idx !== -1) Object.assign(agenda[idx], { titulo, data, hora, dono });
        toast('Compromisso atualizado.', 'sucesso');
    } else {
        agenda.push({ id: Date.now(), titulo, data, hora, dono });
        toast('Compromisso adicionado! 📅', 'sucesso');
    }
    salvarNuvem(); fecharModais(); renderAgenda();
}

function addNota() {
    const idEdit = document.getElementById('notaIdEdit').value;
    const texto  = document.getElementById('notaTexto').value.trim();
    if (!texto) { toast('Escreva algo na nota.', 'erro'); return; }

    if (idEdit) {
        const idx = notas.findIndex(x => x.id == idEdit);
        if (idx !== -1) notas[idx].texto = texto;
        toast('Nota atualizada.', 'sucesso');
    } else {
        notas.unshift({ id: Date.now(), texto, feito: false });
        toast('Nota adicionada! 📝', 'sucesso');
    }
    salvarNuvem(); fecharModais(); renderAgenda();
}

function toggleNota(id) {
    const n = notas.find(x => x.id === id);
    if (n) { n.feito = !n.feito; salvarNuvem(); renderAgenda(); }
}

async function excluirAgenda(id) {
    const ok = await confirmar('Este compromisso será removido da agenda.', 'Apagar Compromisso?');
    if (!ok) return;
    agenda = agenda.filter(x => x.id !== id);
    salvarNuvem(); renderAgenda();
    toast('Compromisso apagado.', 'info');
}

async function excluirNota(id) {
    const ok = await confirmar('Esta nota será apagada permanentemente.', 'Apagar Nota?');
    if (!ok) return;
    notas = notas.filter(x => x.id !== id);
    salvarNuvem(); renderAgenda();
    toast('Nota apagada.', 'info');
}

function mudarSubAba(aba) {
    subAbaAgenda = aba;
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(aba === 'compromissos' ? 'subTabCompromissos' : 'subTabNotas').classList.add('active');
    document.getElementById('viewCompromissos').style.display = aba === 'compromissos' ? 'block' : 'none';
    document.getElementById('viewNotas').style.display        = aba === 'notas'         ? 'block' : 'none';
}

function renderAgenda() {
    /* Compromissos */
    const listaComp = document.getElementById('listaCompromissos');
    listaComp.innerHTML = '';
    const hoje       = new Date(); hoje.setHours(0,0,0,0);
    const amanha     = new Date(hoje); amanha.setDate(amanha.getDate() + 1);

    const agendaOrdenada = [...agenda].sort((a, b) =>
        new Date(`${a.data}T${a.hora}`) - new Date(`${b.data}T${b.hora}`));

    if (agendaOrdenada.length === 0) {
        listaComp.innerHTML = `
        <div style="text-align:center; padding:48px 24px; color:var(--text-muted);">
            <div style="font-size:48px; margin-bottom:12px;">📆</div>
            <p style="font-size:15px; font-weight:600; color:var(--text-secondary);">Agenda vazia</p>
            <p style="font-size:13px; margin-top:4px;">Toque em + para adicionar um compromisso.</p>
        </div>`;
    }

    let mesAtual = '';
    agendaOrdenada.forEach(c => {
        const dataItem   = new Date(c.data + 'T00:00:00');
        const isHoje     = dataItem.getTime() === hoje.getTime();
        const isAmanha   = dataItem.getTime() === amanha.getTime();
        const isPast     = dataItem < hoje;
        const mesRef     = getMesAno(c.data);

        if (mesRef !== mesAtual) {
            listaComp.innerHTML += `<div class="mes-header">${mesRef}</div>`;
            mesAtual = mesRef;
        }

        const badge = isHoje   ? `<span class="badge badge-hoje">Hoje</span>`
                    : isAmanha ? `<span class="badge badge-amanha">Amanhã</span>`
                    : isPast   ? `<span class="badge badge-passado">Passado</span>` : '';

        const tagDono = (c.dono && c.dono !== 'Ambos')
            ? `<span style="color:var(--primary-light); font-size:12px; font-weight:600;">${escHtml(c.dono)}</span>` : '';

        listaComp.innerHTML += `
        <div class="card-agenda ${isPast ? 'card-passado' : ''}"
             onmousedown="startPress(${c.id})" onmouseup="cancelPress()" onmouseleave="cancelPress()"
             ontouchstart="startPress(${c.id})" ontouchend="cancelPress()" ontouchmove="cancelPress()"
             oncontextmenu="return false;">
            <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    ${badge}
                    ${tagDono}
                </div>
                <div style="font-weight:600; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(c.titulo)}</div>
                <div style="color:var(--text-secondary); font-size:12px; margin-top:3px;">
                    ${formatarData(c.data)} • ${getDiaSemana(c.data)} • ${c.hora}
                </div>
            </div>
        </div>`;
    });

    /* Notas */
    const listaNot = document.getElementById('listaNotas');
    listaNot.innerHTML = '';
    const notasOrdenadas = [...notas].sort((a, b) => a.feito - b.feito);

    if (notasOrdenadas.length === 0) {
        listaNot.innerHTML = `
        <div style="text-align:center; padding:48px 24px; color:var(--text-muted);">
            <div style="font-size:48px; margin-bottom:12px;">📝</div>
            <p style="font-size:15px; font-weight:600; color:var(--text-secondary);">Sem anotações</p>
            <p style="font-size:13px; margin-top:4px;">Toque em + para escrever uma nota.</p>
        </div>`;
    }

    notasOrdenadas.forEach(n => {
        listaNot.innerHTML += `
        <div class="card-nota ${n.feito ? 'feito' : ''}"
             onmousedown="startPressNota(${n.id})" onmouseup="cancelPress()" onmouseleave="cancelPress()"
             ontouchstart="startPressNota(${n.id})" ontouchend="cancelPress()" ontouchmove="cancelPress()"
             oncontextmenu="return false;">
            <button class="check-btn" onclick="toggleNota(${n.id}); event.stopPropagation();">${n.feito ? '✔' : ''}</button>
            <div class="nota-texto" style="flex:1;">${escHtml(n.texto)}</div>
        </div>`;
    });
}

/* ================= 7. SAÚDE ================= */
function abrirModalPerfilSaude() {
    document.getElementById('modalPerfilSaude').style.display = 'flex';
    setTimeout(() => document.getElementById('saudeNome').focus(), 100);
}

function salvarPerfilSaude() {
    const nome   = document.getElementById('saudeNome').value.trim();
    const sexo   = document.getElementById('saudeSexo').value;
    const altura = parseFloat(document.getElementById('saudeAltura').value);
    const peso   = parseFloat(document.getElementById('saudePeso').value);
    const corPele = document.getElementById('saudeCorPele').value;

    if (!nome)          { toast('Digite o nome.', 'erro'); return; }
    if (!altura || altura < 50 || altura > 250) { toast('Altura inválida (50–250 cm).', 'erro'); return; }
    if (!peso   || peso   < 10 || peso   > 500) { toast('Peso inválido (10–500 kg).', 'erro');   return; }

    perfisSaude.push({
        id: Date.now(), nome, sexo, altura, corPele,
        historicoPeso: [{ data: hojeISO(), peso }]
    });

    salvarNuvem(); fecharModais();
    document.getElementById('saudeNome').value   = '';
    document.getElementById('saudeAltura').value = '';
    document.getElementById('saudePeso').value   = '';
    toast(`Perfil de ${nome} criado! 💪`, 'sucesso');
    renderSaude();
}

function abrirModalAtualizarPeso(idPerfil) {
    document.getElementById('pesoIdPerfil').value = idPerfil;
    document.getElementById('novoPesoVal').value  = '';
    document.getElementById('modalAtualizarPeso').style.display = 'flex';
    setTimeout(() => document.getElementById('novoPesoVal').focus(), 100);
}

function salvarNovoPeso() {
    const id      = Number(document.getElementById('pesoIdPerfil').value);
    const novoPeso = parseFloat(document.getElementById('novoPesoVal').value);
    if (!novoPeso || novoPeso < 10 || novoPeso > 500) { toast('Peso inválido.', 'erro'); return; }

    const perfil = perfisSaude.find(p => p.id === id);
    if (perfil) {
        /* Evita duplicata no mesmo dia */
        const ultimo = perfil.historicoPeso[perfil.historicoPeso.length - 1];
        if (ultimo.data === hojeISO()) {
            ultimo.peso = novoPeso;
        } else {
            perfil.historicoPeso.push({ data: hojeISO(), peso: novoPeso });
        }
        salvarNuvem();
        toast('Peso atualizado! ⚖️', 'sucesso');
    }
    fecharModais();
    renderSaude();
}

async function excluirPerfilSaude(id) {
    const ok = await confirmar('Todo o histórico desta pessoa será apagado.', 'Apagar Perfil?');
    if (!ok) return;
    perfisSaude = perfisSaude.filter(p => p.id !== id);
    salvarNuvem(); renderSaude();
    toast('Perfil apagado.', 'info');
}

function compartilharSaudeWhatsApp(id) {
    const p = perfisSaude.find(x => x.id === id);
    if (!p) return;
    const { imc, classImc } = calcIMC(p);
    const pesoAtual  = p.historicoPeso.at(-1).peso;
    const pesoInicial = p.historicoPeso[0].peso;
    const dif        = pesoAtual - pesoInicial;
    const difTxt     = dif >= 0 ? `+${dif.toFixed(1)} kg` : `${dif.toFixed(1)} kg`;

    let txt = `🏥 *Progresso de Saúde — ${p.nome}*\n\n`;
    txt += `📏 Altura: ${(p.altura/100).toFixed(2)} m\n`;
    txt += `⚖️ Peso Atual: ${pesoAtual} kg\n`;
    txt += `📊 IMC: ${imc} (${classImc})\n`;
    txt += `📉 Evolução total: ${difTxt}\n\n`;
    txt += `*Histórico:*\n`;
    p.historicoPeso.forEach(h => { txt += `- ${formatarData(h.data)}: ${h.peso} kg\n`; });

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(txt)}`, '_blank');
}

function calcIMC(p) {
    const pesoAtual = p.historicoPeso.at(-1).peso;
    const altM      = p.altura / 100;
    const imc       = (pesoAtual / (altM * altM)).toFixed(1);
    let classImc = '', corImc = '';
    if      (imc < 18.5) { classImc = 'Abaixo do Peso'; corImc = '#FFB830'; }
    else if (imc < 25)   { classImc = 'Peso Ideal';      corImc = '#00D68F'; }
    else if (imc < 30)   { classImc = 'Sobrepeso';       corImc = '#FF9800'; }
    else                 { classImc = 'Obesidade';        corImc = '#FF5F6D'; }
    return { imc, classImc, corImc, pesoAtual };
}

function renderSaude() {
    const lista = document.getElementById('listaPerfisSaude');
    if (!lista) return;
    lista.innerHTML = '';

    if (perfisSaude.length === 0) {
        lista.innerHTML = `
        <div style="text-align:center; padding:48px 24px; color:var(--text-muted);">
            <div style="font-size:48px; margin-bottom:12px;">🏥</div>
            <p style="font-size:15px; font-weight:600; color:var(--text-secondary);">Nenhum perfil de saúde</p>
            <p style="font-size:13px; margin-top:4px;">Toque em + para adicionar uma pessoa.</p>
        </div>`;
        return;
    }

    perfisSaude.forEach(p => {
        const { imc, classImc, corImc, pesoAtual } = calcIMC(p);
        const pesoInicial = p.historicoPeso[0].peso;
        const dif         = pesoAtual - pesoInicial;
        const difTxt      = dif >= 0 ? `+${dif.toFixed(1)} kg` : `${dif.toFixed(1)} kg`;
        const difCor      = dif > 0 ? 'var(--danger)' : 'var(--success)';

        /* Dias desde última pesagem */
        const ultimaData  = new Date(p.historicoPeso.at(-1).data + 'T00:00:00');
        const diffDias    = Math.floor((Date.now() - ultimaData) / 86400000);
        const avisoHtml   = diffDias >= 30
            ? `<div style="color:var(--warning);font-size:12px;margin-top:8px;font-weight:600;">⚠️ Última pesagem há ${diffDias} dias — hora de atualizar!</div>` : '';

        /* Boneco SVG */
        const scaleX  = Math.max(0.7, Math.min(2.2, Number(imc) / 22));
        const corPele = p.corPele || '#FFDBAC';
        const corRoupa = p.sexo === 'F' ? '#e91e63' : '#3f51b5';
        const svg = `<svg viewBox="0 0 100 120" width="65" height="80"
            style="transform:scaleX(${scaleX});transform-origin:bottom center;transition:transform 0.5s ease;">
            <rect x="45" y="30" width="10" height="15" fill="${corPele}"/>
            <circle cx="50" cy="20" r="16" fill="${corPele}"/>
            <path d="M32 20 C32 5,68 5,68 20 C68 25,65 30,65 30 C50 15,35 30,35 30 C35 30,32 25,32 20Z" fill="#2d1e16"/>
            <circle cx="44" cy="18" r="2.5" fill="#111"/><circle cx="56" cy="18" r="2.5" fill="#111"/>
            <path d="M45 25 Q50 30 55 25" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M30 45 L20 80" stroke="${corPele}" stroke-width="8" stroke-linecap="round" fill="none"/>
            <path d="M70 45 L80 80" stroke="${corPele}" stroke-width="8" stroke-linecap="round" fill="none"/>
            <path d="M35 40 Q50 35 65 40 L70 80 L30 80Z" fill="${corRoupa}"/>
            <path d="M35 40 L25 55" stroke="${corRoupa}" stroke-width="10" stroke-linecap="round"/>
            <path d="M65 40 L75 55" stroke="${corRoupa}" stroke-width="10" stroke-linecap="round"/>
            <path d="M32 80 L68 80 L63 120 L53 120 L50 95 L47 120 L37 120Z" fill="#1a1a1a"/>
        </svg>`;

        /* Mini gráfico de linha */
        const hist = p.historicoPeso.slice(-6);
        let grafico = '';
        if (hist.length >= 2) {
            const min  = Math.min(...hist.map(h => h.peso)) - 2;
            const max  = Math.max(...hist.map(h => h.peso)) + 2;
            const pts  = hist.map((h, i) => {
                const x = 10 + (i / (hist.length - 1)) * 80;
                const y = 35 - ((h.peso - min) / (max - min)) * 30;
                return `${x},${y}`;
            }).join(' ');
            grafico = `
            <div style="margin-top:12px; background:var(--bg-surface); border-radius:10px; padding:10px 12px;">
                <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:6px; text-transform:uppercase; letter-spacing:.8px;">Evolução</div>
                <svg viewBox="0 0 100 40" style="width:100%;height:40px;">
                    <polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    ${hist.map((h, i) => {
                        const x = 10 + (i / (hist.length - 1)) * 80;
                        const y = 35 - ((h.peso - min) / (max - min)) * 30;
                        return `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--primary)"/>`;
                    }).join('')}
                </svg>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:2px;">
                    <span>${formatarData(hist[0].data)}</span><span>${formatarData(hist.at(-1).data)}</span>
                </div>
            </div>`;
        }

        lista.innerHTML += `
        <div style="background:var(--bg-surface);border-radius:var(--r-xl);padding:var(--space-md);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="font-size:17px;font-weight:700;margin:0;">${escHtml(p.nome)}</h3>
                <div style="display:flex;gap:8px;">
                    <button onclick="compartilharSaudeWhatsApp(${p.id})"
                        style="background:#25D366;border:none;color:white;width:34px;height:34px;border-radius:var(--r-md);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">📱</button>
                    <button onclick="excluirPerfilSaude(${p.id})"
                        style="background:var(--danger-dim);border:1px solid rgba(255,95,109,.25);color:var(--danger);width:34px;height:34px;border-radius:var(--r-md);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">🗑️</button>
                </div>
            </div>

            <div style="display:flex;align-items:center;gap:20px;">
                <div style="flex-shrink:0;">${svg}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;color:var(--text-secondary);">Peso atual</div>
                    <div style="font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;">${pesoAtual} <span style="font-size:14px;font-weight:400;color:var(--text-secondary);">kg</span></div>
                    <div style="font-size:13px;margin-top:4px;">
                        IMC <strong>${imc}</strong>
                        <span style="background:${corImc};color:#111;padding:2px 8px;border-radius:var(--r-full);font-size:11px;font-weight:700;margin-left:4px;">${classImc}</span>
                    </div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">
                        Desde o início: <strong style="color:${difCor};">${difTxt}</strong>
                    </div>
                    ${avisoHtml}
                </div>
            </div>

            ${grafico}

            <button onclick="abrirModalAtualizarPeso(${p.id})"
                style="width:100%;margin-top:14px;padding:12px;background:var(--grad-primary);border:none;color:white;border-radius:var(--r-md);font-weight:700;font-size:14px;cursor:pointer;">
                ⚖️ Atualizar Peso Hoje
            </button>

            <div style="margin-top:10px;font-size:11px;color:var(--text-muted);background:var(--bg-raised);padding:8px 10px;border-radius:var(--r-md);line-height:1.7;">
                ${p.historicoPeso.slice(-5).map(h => `${formatarData(h.data)}: <strong>${h.peso} kg</strong>`).join(' › ')}
            </div>
        </div>`;
    });
}

/* ================= 8. UTILITÁRIOS ================= */
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function formatarData(iso)  { const d = iso.split('-'); return `${d[2]}/${d[1]}`; }
function getMesAno(iso)     { const d = new Date(iso + 'T00:00:00'); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; }
function getDiaSemana(iso)  { const d = new Date(iso + 'T00:00:00'); return DIAS[d.getDay()]; }
function hojeISO()          { return new Date().toISOString().split('T')[0]; }
function formatarReais(v)   { return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function escHtml(str)       { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function verificarLembretes() {
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const dataAmanha = amanha.toISOString().split('T')[0];
    const itens = agenda.filter(c => c.data === dataAmanha);
    if (itens.length > 0) {
        setTimeout(() => toast(`🔔 ${itens.length} compromisso(s) amanhã!`, 'info', 5000), 1500);
    }
}

function agendarNativo(titulo, data, hora) {
    const inicio = data.replace(/-/g,'') + 'T' + hora.replace(':','') + '00';
    const hFim   = (parseInt(hora.substring(0,2)) + 1).toString().padStart(2,'0');
    const fim    = data.replace(/-/g,'') + 'T' + hFim + hora.substring(3) + '00';
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${inicio}/${fim}`, '_blank');
}
