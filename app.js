let caixas = JSON.parse(localStorage.getItem("caixas")) || [];
let caixaAberta = null;
let userPin = localStorage.getItem("userPin");

// Elementos DOM
const ui = {
    lock: document.getElementById('lock'),
    app: document.getElementById('app'),
    pinInput: document.getElementById('pinInput'),
    tituloLock: document.getElementById('tituloLock'),
    msgLock: document.getElementById('msgLock'),
    btnLock: document.getElementById('btnLock'),
    erroPin: document.getElementById('erroPin'),
    lista: document.getElementById('lista'),
    totalGlobal: document.getElementById('totalGlobal'),
    fotoPerfil: document.getElementById('fotoPerfil'),
    uploadFoto: document.getElementById('uploadFoto'),
    confete: document.getElementById('confete')
};

/* 🚀 INICIALIZAÇÃO */
function init() {
    carregarFoto();
    
    if (!userPin) {
        // Modo Cadastro
        ui.tituloLock.innerText = "🆕 Criar Acesso";
        ui.msgLock.innerText = "Defina uma senha numérica para proteger suas economias.";
        ui.btnLock.innerText = "Salvar Senha";
    } else {
        // Modo Login
        ui.tituloLock.innerText = "🔐 Desbloquear";
        ui.msgLock.innerText = "Digite sua senha para entrar.";
        ui.btnLock.innerText = "Entrar";
    }
}

/* 🔐 SEGURANÇA */
function verificarPin() {
    const input = ui.pinInput.value;
    
    if (!input) return;

    if (!userPin) {
        // Salvar Novo PIN
        localStorage.setItem("userPin", input);
        userPin = input;
        alert("Senha criada com sucesso! Não a esqueça.");
        entrarApp();
    } else {
        // Verificar PIN
        if (input === userPin) {
            entrarApp();
        } else {
            ui.erroPin.style.display = "block";
            ui.pinInput.value = "";
            ui.pinInput.focus();
        }
    }
}

function entrarApp() {
    ui.lock.style.display = "none";
    ui.app.style.display = "block";
    render();
}

function logout() {
    location.reload();
}

/* 📸 PERFIL */
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

/* 🧮 LÓGICA DE VALORES (Agora Embaralhada) */
function gerarValores(total) {
  const base = [10, 20, 50, 100, 200];
  let soma = 0;
  let arr = [];

  // 1. Preenche até atingir o total
  while (soma < total) {
    let restante = total - soma;
    let possiveis = base.filter(n => n <= restante);

    if (possiveis.length === 0) {
        if (restante > 0) arr.push({ valor: restante, ok: false });
        break;
    }

    let v = possiveis[Math.floor(Math.random() * possiveis.length)];
    arr.push({ valor: v, ok: false });
    soma += v;
  }
  
  // 2. Embaralhar (Algoritmo Fisher-Yates) para misturar as notas
  for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  
  return arr;
}

/* 🎲 NOVA FUNÇÃO: SORTEAR UM VALOR PARA PAGAR */
function sortearValor() {
    const c = caixas[caixaAberta];
    // Pega apenas os índices que ainda NÃO foram pagos
    const pendentes = c.valores
        .map((v, i) => ({ ...v, index: i })) // guarda o índice original
        .filter(v => !v.ok);

    if (pendentes.length === 0) return alert("Parabéns! Você já completou tudo!");

    // Sorteia um
    const sorteado = pendentes[Math.floor(Math.random() * pendentes.length)];
    
    // Efeito visual: Rola até o elemento e dá um destaque
    const el = document.querySelectorAll('.valor')[sorteado.index];
    
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Pisca o elemento
    el.style.transform = "scale(1.2)";
    el.style.zIndex = "100";
    el.style.boxShadow = "0 0 20px yellow";
    
    setTimeout(() => {
        if(confirm(`🎲 A sorte mandou pagar: R$ ${sorteado.valor}!\nVamos marcar agora?`)) {
            marcarValor(sorteado.index);
        }
        // Remove estilos temporários
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.boxShadow = "";
    }, 500);
}

/* 📦 GERENCIAMENTO DE CAIXAS */
function criarCaixa() {
    const nome = document.getElementById('nome');
    const valor = document.getElementById('valor');

    if (!nome.value || !valor.value || valor.value <= 0) return alert("Preencha corretamente");

    caixas.push({
        nome: nome.value,
        total: Number(valor.value),
        valores: gerarValores(Number(valor.value)),
        criadaEm: new Date().toLocaleDateString()
    });

    nome.value = "";
    valor.value = "";
    salvar();
}

function deletarCaixa() {
    if (confirm("Tem certeza que deseja apagar essa caixinha e todo o progresso?")) {
        caixas.splice(caixaAberta, 1);
        caixaAberta = null;
        salvar();
    }
}

function salvar() {
    localStorage.setItem("caixas", JSON.stringify(caixas));
    render();
}

/* 👁️ NAVEGAÇÃO */
function abrirCaixa(index) {
    caixaAberta = index;
    render();
}

function voltarLista() {
    caixaAberta = null;
    render();
}

function marcarValor(vi) {
    const c = caixas[caixaAberta];
    c.valores[vi].ok = !c.valores[vi].ok;
    
    // Efeito sonoro ou visual de verificação
    if (c.valores.every(v => v.ok)) comemorar();
    
    salvar();
}

/* 🎉 EXTRAS */
function comemorar() {
    ui.confete.style.display = "flex";
    setTimeout(() => ui.confete.style.display = "none", 4000);
}

function calcularGlobal() {
    let totalGuardado = 0;
    caixas.forEach(c => {
        totalGuardado += c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
    });
    ui.totalGlobal.innerText = `R$ ${totalGuardado.toFixed(2)}`;
}

/* 🖼️ RENDERIZADOR */
function render() {
    calcularGlobal();
    ui.lista.innerHTML = "";

    // MODO LISTA (DASHBOARD)
    if (caixaAberta === null) {
        if(caixas.length === 0) {
            ui.lista.innerHTML = `<p style="text-align:center; color:#aaa">Nenhuma caixinha criada ainda.</p>`;
            return;
        }

        caixas.forEach((c, index) => {
            const guardado = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
            const pct = Math.floor((guardado / c.total) * 100);

            ui.lista.innerHTML += `
            <div class="caixa" onclick="abrirCaixa(${index})">
                <div style="display:flex; justify-content:space-between">
                    <h3>${c.nome}</h3>
                    <span>R$ ${c.total}</span>
                </div>
                
                <div class="barra-fundo">
                    <div class="barra-nivel" style="width: ${pct}%"></div>
                </div>
                <small>${pct}% concluído (R$ ${guardado} guardados)</small>
            </div>
            `;
        });
        return;
    }

    // MODO CAIXA ABERTA (DETALHES)
    const c = caixas[caixaAberta];
    const guardado = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
    const restante = c.total - guardado;
    const pct = Math.floor((guardado / c.total) * 100);

    ui.lista.innerHTML = `
        <div class="caixa caixa-aberta-bg">
            <div class="acoes nao-imprimir">
                <button onclick="voltarLista()" class="btn-acao btn-voltar">⬅ Voltar</button>
                <button onclick="deletarCaixa()" class="btn-acao btn-delete">🗑️</button>
            </div>

            <div style="text-align:center; margin-top:15px">
                <h2>${c.nome}</h2>
                <h1 style="font-size:32px">R$ ${c.total}</h1>
                <p>Faltam: R$ ${restante.toFixed(2)}</p>
            </div>

            <div class="barra-fundo" style="background:rgba(0,0,0,0.2)">
                <div class="barra-nivel" style="width: ${pct}%"></div>
            </div>

            <div class="valores">
                ${c.valores.map((v, i) => `
                    <div class="valor nota-${v.valor} ${v.ok ? 'marcado' : ''}" onclick="marcarValor(${i})">
                        R$ ${v.valor}
                    </div>
                `).join('')}
            </div>

            <div class="acoes nao-imprimir" style="margin-top:20px">
                <button onclick="compartilharWhats()" class="btn-acao btn-whats">📲 WhatsApp</button>
                <button onclick="imprimirPDF()" class="btn-acao btn-pdf">📄 Salvar PDF</button>
            </div>
        </div>
    `;
}

/* 📤 COMPARTILHAMENTO */
function compartilharWhats() {
    const c = caixas[caixaAberta];
    const guardado = c.valores.filter(v => v.ok).reduce((acc, v) => acc + v.valor, 0);
    const pct = Math.floor((guardado / c.total) * 100);
    
    let texto = `*Minha Caixinha: ${c.nome}*\n`;
    texto += `💰 Meta: R$ ${c.total}\n`;
    texto += `✅ Guardado: R$ ${guardado} (${pct}%)\n\n`;
    texto += `Gerado pelo App Caixinhas 🚀`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`);
}

function imprimirPDF() {
    window.print();
}

// Inicializa
init();
