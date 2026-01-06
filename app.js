/* ===========================================================
   1. VARIÁVEIS GLOBAIS E CONFIGURAÇÕES
   =========================================================== */
let caixas = JSON.parse(localStorage.getItem("caixas")) || [];
let caixaAberta = null;
let userPin = localStorage.getItem("userPin");

// --- NOVOS DADOS FINANCEIROS ---
let contas = JSON.parse(localStorage.getItem("contas_importadas")) || [];
// Agora a renda é salva por mês: { "2026-01": 3500, "2026-02": 4000 }
let rendasPorMes = JSON.parse(localStorage.getItem("rendas_por_mes")) || {};

let graficoChart = null; 
let chartPizza = null;

// Elementos da Interface (UI)
const ui = {
    lock: document.getElementById('lock'),
    mainContainer: document.getElementById('mainContainer'),
    app: document.getElementById('app'),
    analise: document.getElementById('analise'),
    pinInput: document.getElementById('pinInput'),
    tituloLock: document.getElementById('tituloLock'),
    msgLock: document.getElementById('msgLock'),
    btnLock: document.getElementById('btnLock'),
    erroPin: document.getElementById('erroPin'),
    lista: document.getElementById('lista'),
    totalGlobal: document.getElementById('totalGlobal'),
    fotoPerfil: document.getElementById('fotoPerfil'),
    uploadFoto: document.getElementById('uploadFoto'),
    confete: document.getElementById('confete'),
    // Elementos da Aba Financeira
    inputRenda: document.getElementById('inputRenda'),
    labelRenda: document.querySelector('label[for="inputRenda"]') || document.getElementById('labelRenda'), 
    listaContas: document.getElementById('listaContas'),
    selectMes: document.getElementById('selectMes'),
    aiBox: document.getElementById('aiBox'),
    aiContent: document.getElementById('aiContent'),
    // Score e Comparativo
    scoreValue: document.getElementById('scoreValue'),
    scoreTitle: document.getElementById('scoreTitle'),
    scoreDesc: document.getElementById('scoreDesc'),
    scoreCircle: document.getElementById('scoreCircle'),
    comparativoBox: document.getElementById('comparativoBox'),
    textoComparativo: document.getElementById('textoComparativo'),
    // Modal de Gasto Manual
    modalGasto: document.getElementById('modalGasto'),
    novoGastoNome: document.getElementById('novoGastoNome'),
    novoGastoValor: document.getElementById('novoGastoValor'),
    novoGastoData: document.getElementById('novoGastoData')
};

/* ===========================================================
   2. INICIALIZAÇÃO E SEGURANÇA
   =========================================================== */
function init() {
    carregarFoto();
    
    // Configura texto da tela de bloqueio
    if (!userPin) {
        ui.tituloLock.innerText = "🆕 Criar Acesso";
        ui.msgLock.innerText = "Defina uma senha numérica.";
        ui.btnLock.innerText = "Salvar Senha";
    } else {
        ui.tituloLock.innerText = "🔐 Desbloquear";
        ui.msgLock.innerText = "Digite sua senha para entrar.";
        ui.btnLock.innerText = "Entrar";
    }
}

function verificarPin() {
    const input = ui.pinInput.value;
    if (!input) return;

    if (!userPin) {
        localStorage.setItem("userPin", input);
        userPin = input;
        alert("Senha criada com sucesso!");
        entrarApp();
    } else {
        if (input === userPin) entrarApp();
        else {
            ui.erroPin.style.display = "block";
            ui.pinInput.value = "";
            ui.pinInput.focus();
        }
    }
}

function entrarApp() {
    ui.lock.style.display = "none";
    ui.mainContainer.style.display = "block";
    render();        // Carrega Caixinhas
    renderAnalise(); // Carrega Financeiro
}

function logout() { location.reload(); }

/* FOTO DE PERFIL */
ui.fotoPerfil.onclick = () => ui.uploadFoto.click();
ui.uploadFoto.onchange = e => {
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem("fotoPerfil", reader.result);
    ui.fotoPerfil.src = reader.result;
  };
  reader.readAsDataURL(e.target.files[0]);
};
function carregarFoto() {
  const foto = localStorage.getItem("fotoPerfil");
  if (foto) ui.fotoPerfil.src = foto;
}

/* ===========================================================
   3. SISTEMA DE CAIXINHAS (GAMIFICAÇÃO)
   =========================================================== */
function gerarValores(total) {
  const base = [10, 20, 50, 100, 200];
  let soma = 0; let arr = [];
  while (soma < total) {
    let restante = total - soma;
    let possiveis = base.filter(n => n <= restante);
    if (possiveis.length === 0) { if (restante > 0) arr.push({ valor: restante, ok: false }); break; }
    let v = possiveis[Math.floor(Math.random() * possiveis.length)];
    arr.push({ valor: v, ok: false }); soma += v;
  }
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function sortearValor() {
    const c = caixas[caixaAberta];
    const pendentes = c.valores.map((v, i) => ({ ...v, index: i })).filter(v => !v.ok);
    if (pendentes.length === 0) return alert("Parabéns! Você já completou tudo!");
    
    const sorteado = pendentes[Math.floor(Math.random() * pendentes.length)];
    const el = document.querySelectorAll('.valor')[sorteado.index];
    
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transform = "scale(1.2)"; el.style.zIndex = "100"; el.style.boxShadow = "0 0 20px yellow";
    
    setTimeout(() => {
        if(confirm(`🎲 A sorte mandou pagar: R$ ${sorteado.valor}!\nVamos marcar agora?`)) marcarValor(sorteado.index);
        el.style.transform = ""; el.style.zIndex = ""; el.style.boxShadow = "";
    }, 500);
}

function criarCaixa() {
    const nome = document.getElementById('nome'); const valor = document.getElementById('valor');
    if (!nome.value || !valor.value || valor.value <= 0) return alert("Preencha corretamente");
    
    caixas.push({ nome: nome.value, total: Number(valor.value), valores: gerarValores(Number(valor.value)), criadaEm: new Date().toLocaleDateString() });
    nome.value = ""; valor.value = ""; salvar();
}

function deletarCaixa() { if (confirm("Apagar caixinha?")) { caixas.splice(caixaAberta, 1); caixaAberta = null; salvar(); } }
function salvar() { localStorage.setItem("caixas", JSON.stringify(caixas)); render(); }
function abrirCaixa(index) { caixaAberta = index; render(); }
function voltarLista() { caixaAberta = null; render(); }
function marcarValor(vi) {
    const c = caixas[caixaAberta]; c.valores[vi].ok = !c.valores[vi].ok;
    if (c.valores.every(v => v.ok)) comemorar(); salvar();
}
function comemorar() { ui.confete.style.display = "flex"; setTimeout(() => ui.confete.style.display = "none", 4000); }
function calcularGlobal() {
    let totalGuardado = 0;
    caixas.forEach(c => { totalGuardado += c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0); });
    ui.totalGlobal.innerText = `R$ ${totalGuardado.toFixed(2)}`;
}
function compartilharWhats() {
    const c = caixas[caixaAberta];
    const guardado = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
    const pct = Math.floor((guardado / c.total) * 100);
    let texto = `*Minha Caixinha: ${c.nome}*\n💰 Meta: R$ ${c.total}\n✅ Guardado: R$ ${guardado} (${pct}%)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`);
}
function imprimirPDF() { window.print(); }

function render() {
    calcularGlobal(); ui.lista.innerHTML = "";
    if (caixaAberta === null) {
        if(caixas.length === 0) { ui.lista.innerHTML = `<p style="text-align:center; color:#aaa">Nenhuma caixinha criada.</p>`; return; }
        caixas.forEach((c, index) => {
            const guardado = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
            const pct = Math.floor((guardado / c.total) * 100);
            ui.lista.innerHTML += `<div class="caixa" onclick="abrirCaixa(${index})"><div style="display:flex; justify-content:space-between"><h3>${c.nome}</h3><span>R$ ${c.total}</span></div><div class="barra-fundo"><div class="barra-nivel" style="width: ${pct}%"></div></div><small>${pct}% concluído (R$ ${guardado} guardados)</small></div>`;
        });
        return;
    }
    const c = caixas[caixaAberta];
    const guardado = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
    const restante = c.total - guardado; const pct = Math.floor((guardado / c.total) * 100);
    ui.lista.innerHTML = `<div class="caixa caixa-aberta-bg"><div class="acoes nao-imprimir"><button onclick="voltarLista()" class="btn-acao btn-voltar">⬅ Voltar</button><button onclick="deletarCaixa()" class="btn-acao btn-delete">🗑️</button></div><div style="text-align:center; margin-top:15px"><h2>${c.nome}</h2><h1>R$ ${c.total}</h1><p>Faltam: R$ ${restante.toFixed(2)}</p><button onclick="sortearValor()" style="background:#ff9800; border:none; border-radius:20px; padding:5px 15px; cursor:pointer; font-weight:bold; margin-top:5px">🎲 Sorteio</button></div><div class="barra-fundo" style="background:rgba(0,0,0,0.2)"><div class="barra-nivel" style="width: ${pct}%"></div></div><div class="valores">${c.valores.map((v, i) => `<div class="valor nota-${v.valor} ${v.ok ? 'marcado' : ''}" onclick="marcarValor(${i})">R$ ${v.valor}</div>`).join('')}</div><div class="acoes nao-imprimir" style="margin-top:20px"><button onclick="compartilharWhats()" class="btn-acao btn-whats">📲 WhatsApp</button><button onclick="imprimirPDF()" class="btn-acao btn-pdf">📄 Salvar PDF</button></div></div>`;
}

// FIM DA PARTE 1 - CONTINUE COPIANDO A PARTE 2 ABAIXO
/* ===========================================================
   4. FINANCEIRO PRO: LÓGICA DE DADOS E IMPORTAÇÃO
   =========================================================== */
function mudarAba(abaId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(abaId).style.display = 'block';
    btn.classList.add('active');
    if(abaId === 'analise') renderAnalise();
}

/* LÓGICA DE RENDA MENSAL */
function alterarMesVisualizacao() {
    renderAnalise(); // Redesenha a tela ao trocar o mês
}

function salvarRendaMes() {
    const mes = ui.selectMes.value;
    const valor = Number(ui.inputRenda.value);
    
    if(mes === "todos") return alert("Selecione um mês específico para definir a renda.");
    
    rendasPorMes[mes] = valor;
    localStorage.setItem("rendas_por_mes", JSON.stringify(rendasPorMes));
    renderAnalise();
}

/* IMPORTAR JSON */
function importarJson(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if(Array.isArray(json)) {
                contas = json;
                localStorage.setItem("contas_importadas", JSON.stringify(contas));
                alert("Backup importado com sucesso! 🎉");
                renderAnalise();
            } else alert("JSON inválido.");
        } catch(err) { alert("Erro ao ler JSON."); }
    };
    reader.readAsText(file);
}

/* GESTÃO DE CONTAS (CRUD) */
function apagarConta(index) {
    if(confirm("Remover esta conta?")) {
        contas.splice(index, 1);
        localStorage.setItem("contas_importadas", JSON.stringify(contas));
        renderAnalise();
    }
}
function editarConta(index) {
    const novoValor = prompt("Novo valor:", contas[index].valor);
    if(novoValor && !isNaN(novoValor)) {
        contas[index].valor = Number(novoValor);
        localStorage.setItem("contas_importadas", JSON.stringify(contas));
        renderAnalise();
    }
}

/* GASTO MANUAL (MODAL) */
function abrirModalGasto() { ui.modalGasto.style.display = 'flex'; }
function fecharModalGasto() { ui.modalGasto.style.display = 'none'; }
function salvarNovoGasto() {
    const nome = ui.novoGastoNome.value; const valor = Number(ui.novoGastoValor.value); const data = ui.novoGastoData.value;
    if(!nome || !valor || !data) return alert("Preencha todos os campos!");
    
    contas.push({ nome: nome, valor: valor, vencimento: data, paga: true, recorrente: false });
    localStorage.setItem("contas_importadas", JSON.stringify(contas));
    
    ui.novoGastoNome.value = ""; ui.novoGastoValor.value = "";
    fecharModalGasto(); renderAnalise();
}

/* ===========================================================
   5. RENDERIZAÇÃO DA ANÁLISE (O CÉREBRO DO DASHBOARD)
   =========================================================== */
function renderAnalise() {
    // 1. Identificar Meses
    const meses = [...new Set(contas.map(c => c.vencimento.substring(0, 7)))].sort();
    
    // 2. Preencher Select
    if(ui.selectMes.options.length <= 1 && meses.length > 0) {
        meses.forEach(m => {
            if(![...ui.selectMes.options].some(op => op.value === m)) {
                ui.selectMes.innerHTML += `<option value="${m}">${m}</option>`;
            }
        });
    }

    const mesSelecionado = ui.selectMes.value;
    let dadosFiltrados = contas;
    
    // 3. Configurar Renda com base no Mês
    if(mesSelecionado === "todos") {
        ui.inputRenda.value = "";
        ui.inputRenda.placeholder = "Selecione um mês para ver a renda";
        ui.inputRenda.disabled = true;
        if(ui.labelRenda) ui.labelRenda.innerText = "Selecione um mês para definir renda";
    } else {
        ui.inputRenda.disabled = false;
        ui.inputRenda.placeholder = "Renda de " + mesSelecionado;
        if(ui.labelRenda) ui.labelRenda.innerText = `💵 Renda de ${mesSelecionado} (R$)`;
        ui.inputRenda.value = rendasPorMes[mesSelecionado] || 0;
        
        dadosFiltrados = contas.filter(c => c.vencimento.startsWith(mesSelecionado));
    }

    // 4. Renderizar Lista de Contas
    ui.listaContas.innerHTML = "";
    if(contas.length === 0) ui.listaContas.innerHTML = "<p style='text-align:center;color:#777'>Nenhum dado importado.</p>";
    else {
        dadosFiltrados.forEach((c) => {
            const realIndex = contas.indexOf(c);
            ui.listaContas.innerHTML += `
            <div class="conta-item" style="border-left-color: ${c.paga ? '#00e676' : '#ff1744'}">
                <div class="conta-info"><h4>${c.nome}</h4><p>${c.vencimento} | ${c.recorrente?'🔄 Recorrente':'Única'}</p></div>
                <div style="text-align:right"><span style="font-weight:bold; color:white">R$ ${c.valor.toFixed(2)}</span>
                <div class="conta-actions"><button onclick="editarConta(${realIndex})">✏️</button><button onclick="apagarConta(${realIndex})">🗑️</button></div></div>
            </div>`;
        });
    }

    // 5. Chamada de Funções Avançadas
    atualizarGraficoBarras(meses);
    gerarGraficoPizza(dadosFiltrados);
    executarIA(mesSelecionado, dadosFiltrados);
    calcularScoreFinanceiro(mesSelecionado, dadosFiltrados);
    compararMesAnterior(mesSelecionado, dadosFiltrados, meses);
}

/* ===========================================================
   6. GRÁFICOS, IA E SCORE
   =========================================================== */

/* SCORE FINANCEIRO (0 a 100) */
function calcularScoreFinanceiro(mes, contasMes) {
    if(mes === "todos" || contasMes.length === 0) {
        ui.scoreValue.innerText = "--";
        ui.scoreDesc.innerText = "Sem dados suficientes.";
        ui.scoreCircle.style.borderColor = "#555";
        return;
    }

    const renda = rendasPorMes[mes] || 0;
    const gastos = contasMes.reduce((acc, c) => acc + c.valor, 0);
    const hoje = new Date().toISOString().split('T')[0];
    const atrasadas = contasMes.filter(c => !c.paga && c.vencimento < hoje).length;

    let pontos = 100;
    
    // Penalidades
    if (renda > 0) {
        if (gastos > renda) pontos -= 40; 
        else if (gastos > renda * 0.9) pontos -= 20; 
    } else {
        pontos -= 10; // Sem renda definida
    }
    
    if (atrasadas > 0) pontos -= (atrasadas * 10);
    if (gastos < renda * 0.7 && renda > 0) pontos += 5; // Bônus

    if(pontos < 0) pontos = 0; if(pontos > 100) pontos = 100;

    let cor = "#00e676"; let titulo = "Ótimo";
    if(pontos < 70) { cor = "#ffeb3b"; titulo = "Atenção"; }
    if(pontos < 40) { cor = "#ff1744"; titulo = "Crítico"; }

    ui.scoreValue.innerText = Math.floor(pontos);
    ui.scoreTitle.innerText = titulo;
    ui.scoreCircle.style.borderColor = cor;
    ui.scoreCircle.style.boxShadow = `0 0 15px ${cor}40`;
    
    if(atrasadas > 0) ui.scoreDesc.innerText = `${atrasadas} contas vencidas.`;
    else if(renda > 0) ui.scoreDesc.innerText = `Saldo: R$ ${(renda - gastos).toFixed(0)}`;
    else ui.scoreDesc.innerText = "Defina sua renda.";
}

/* COMPARATIVO DE MÊS */
function compararMesAnterior(mesAtual, contasAtuais, listaMeses) {
    if(mesAtual === "todos") { ui.comparativoBox.style.display = 'none'; return; }
    
    const indexAtual = listaMeses.indexOf(mesAtual);
    if(indexAtual <= 0) { ui.comparativoBox.style.display = 'none'; return; }

    const mesAnterior = listaMeses[indexAtual - 1];
    const gastosAtual = contasAtuais.reduce((acc, c) => acc + c.valor, 0);
    
    const contasAnterior = contas.filter(c => c.vencimento.startsWith(mesAnterior));
    const gastosAnterior = contasAnterior.reduce((acc, c) => acc + c.valor, 0);

    if(gastosAnterior === 0) return;

    ui.comparativoBox.style.display = 'block';
    const diff = gastosAtual - gastosAnterior;
    const pct = ((diff / gastosAnterior) * 100).toFixed(1);

    if (diff > 0) ui.textoComparativo.innerHTML = `Você gastou <span class="comp-negativo">R$ ${Math.abs(diff).toFixed(2)} (+${pct}%)</span> a mais que em ${mesAnterior}.`;
    else ui.textoComparativo.innerHTML = `Parabéns! Economizou <span class="comp-positivo">R$ ${Math.abs(diff).toFixed(2)} (${pct}%)</span> vs ${mesAnterior}.`;
}

/* GRÁFICO DE BARRAS */
function atualizarGraficoBarras(meses) {
    const ctx = document.getElementById('graficoGastos').getContext('2d');
    const dadosGastos = meses.map(m => contas.filter(c => c.vencimento.startsWith(m)).reduce((acc, c) => acc + c.valor, 0));
    const dadosRenda = meses.map(m => rendasPorMes[m] || 0);

    if(graficoChart) graficoChart.destroy();
    graficoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                { label: 'Gastos', data: dadosGastos, backgroundColor: '#ff1744', borderRadius: 5, order: 2 },
                { label: 'Renda', data: dadosRenda, backgroundColor: '#00e676', borderColor: '#00e676', type: 'line', borderWidth: 2, tension: 0.2, order: 1 }
            ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } }, scales: { y: { ticks: { color: '#aaa' }, grid: { color: '#333' } }, x: { ticks: { color: '#aaa' }, grid: { display: false } } } }
    });
}

/* GRÁFICO PIZZA (CATEGORIAS) */
function gerarGraficoPizza(contasFiltradas) {
    const ctx = document.getElementById('graficoPizza').getContext('2d');
    const categorias = {
        '🏠 Casa': ['aluguel', 'luz', 'água', 'internet', 'gás', 'condomínio'],
        '🚗 Transporte': ['gasolina', 'uber', '99', 'amortecedor', 'mecânico', 'ipva', 'moto', 'carro'],
        '🍔 Alimentação': ['mercado', 'açougue', 'ifood', 'padaria', 'restaurante', 'lanche', 'pizza'],
        '💳 Dívidas': ['nubank', 'fatura', 'empréstimo', 'visa', 'master', 'boleto'],
        '💊 Saúde': ['farmácia', 'exame', 'médico', 'dentista'],
        '🎉 Outros': []
    };
    const totais = {};
    contasFiltradas.forEach(c => {
        let catEncontrada = '🎉 Outros';
        const nomeLower = c.nome.toLowerCase();
        for (const [cat, chaves] of Object.entries(categorias)) {
            if (chaves.some(chave => nomeLower.includes(chave))) { catEncontrada = cat; break; }
        }
        if (!totais[catEncontrada]) totais[catEncontrada] = 0;
        totais[catEncontrada] += c.valor;
    });
    if(chartPizza) chartPizza.destroy();
    chartPizza = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(totais),
            datasets: [{
                data: Object.values(totais),
                backgroundColor: ['#ff9800', '#2196f3', '#4caf50', '#9c27b0', '#f44336', '#607d8b'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: 'white', font: { size: 10 } } } } }
    });
}

/* IA FINANCEIRA */
function executarIA(mes, dados) {
    ui.aiBox.style.display = "block"; ui.aiContent.innerHTML = "";
    if(mes === "todos") return ui.aiContent.innerHTML = "<p>Selecione um mês para análise da IA.</p>";

    const gastos = dados.reduce((acc, c) => acc + c.valor, 0);
    const renda = rendasPorMes[mes] || 0;
    
    // Projeção
    const hoje = new Date();
    if(mes === hoje.toISOString().substring(0, 7)) {
         const projecao = (gastos / hoje.getDate()) * 30;
         ui.aiContent.innerHTML += `<div class="dica-item">🔮 <b>Projeção:</b> Você deve fechar o mês gastando R$ ${projecao.toFixed(2)}.</div>`;
    }

    if(renda > 0 && gastos > renda) {
        ui.aiContent.innerHTML += `<div class="dica-item dica-alerta">⚠️ Você gastou <b>R$ ${(gastos - renda).toFixed(2)}</b> a mais que a renda.</div>`;
    } else if (renda > 0 && gastos < renda * 0.5) {
        ui.aiContent.innerHTML += `<div class="dica-item">✅ Ótimo controle! Sobrou mais da metade da renda.</div>`;
    }
}

// Inicializa tudo
init();
