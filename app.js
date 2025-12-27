const PIN = "2007";

let caixas = JSON.parse(localStorage.getItem("caixas")) || [];
let caixaAberta = null; // índice da caixinha aberta
let timerPress = null;
let segurou = false;

/* 🔐 PIN */
function desbloquear() {
  if (pin.value === PIN) {
    lock.style.display = "none";
    app.style.display = "block";
    carregarFoto();
    render();
  } else alert("PIN incorreto");
}

/* FOTO PERFIL */
fotoPerfil.onclick = () => uploadFoto.click();

uploadFoto.onchange = e => {
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem("fotoPerfil", reader.result);
    fotoPerfil.src = reader.result;
  };
  reader.readAsDataURL(e.target.files[0]);
};

function carregarFoto() {
  const foto = localStorage.getItem("fotoPerfil");
  if (foto) fotoPerfil.src = foto;
}

/* VALORES ESTILO CAIXA DE MADEIRA */
function gerarValores(total) {
  const base = [5,10,20,50,100,200];
  let soma = 0;
  let arr = [];

  while (soma < total) {
    let v = base[Math.floor(Math.random() * base.length)];
    if (soma + v <= total) {
      arr.push({ valor: v, ok: false });
      soma += v;
    }
  }
  return arr;
}

/* CRIAR */
function criarCaixa() {
  if (!nome.value || !valor.value) return alert("Preencha tudo");

  caixas.push({
    nome: nome.value,
    total: Number(valor.value),
    valores: gerarValores(Number(valor.value))
  });

  nome.value = "";
  valor.value = "";
  salvar();
}

/* SALVAR */
function salvar() {
  localStorage.setItem("caixas", JSON.stringify(caixas));
  render();
}

/* 👉 TOUCH / LONG PRESS */
function iniciarPress(ci) {
  segurou = false;
  timerPress = setTimeout(() => {
    segurou = true;
    if (confirm("Deseja deletar esta caixinha?")) {
      caixas.splice(ci, 1);
      salvar();
    }
  }, 600);
}

function finalizarPress(ci) {
  clearTimeout(timerPress);
  if (!segurou) {
    abrirCaixa(ci);
  }
}

/* ABRIR / FECHAR */
function abrirCaixa(ci) {
  caixaAberta = ci;
  render();
}

function voltarLista() {
  caixaAberta = null;
  render();
}

/* MARCAR VALOR */
function marcarValor(vi) {
  const c = caixas[caixaAberta];
  c.valores[vi].ok = !c.valores[vi].ok;

  if (c.valores.every(v => v.ok)) comemorar();
  salvar();
}

/* 🎉 */
function comemorar() {
  confete.style.display = "flex";
  setTimeout(() => confete.style.display = "none", 2500);
}

/* 🖼️ RENDER */
function render() {
  lista.innerHTML = "";

  /* 📦 LISTA */
  if (caixaAberta === null) {
    caixas.forEach((c, ci) => {
      lista.innerHTML += `
        <div class="caixa"
          ontouchstart="iniciarPress(${ci})"
          ontouchend="finalizarPress(${ci})"
          onmousedown="iniciarPress(${ci})"
          onmouseup="finalizarPress(${ci})">
          
          <h3>${c.nome}</h3>
          <small>R$ ${c.total}</small>
        </div>
      `;
    });
    return;
  }

  /* 🪵 CAIXA ABERTA */
  const c = caixas[caixaAberta];
  lista.innerHTML = `
    <div class="caixa">
      <button onclick="voltarLista()" style="
        margin-bottom:10px;
        padding:8px;
        border-radius:10px;
        border:none;
        background:#3b220f;
        color:white">⬅ Voltar</button>

      <h3>${c.nome}</h3>
<small>R$ ${c.total}</small>

<div style="display:flex; gap:10px; margin:10px 0">
  <button onclick="compartilharWhats()" class="btn-share">📲 WhatsApp</button>
  <button onclick="baixarPDF()" class="btn-share">📄 PDF</button>
</div>

      <div class="valores">
        ${c.valores.map((v,vi)=>`
          <div class="valor ${v.ok?'marcado':''}"
            onclick="marcarValor(${vi})">
            ${v.valor}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

render();
function compartilharWhats() {
  const c = caixas[caixaAberta];
  const feito = c.valores.filter(v => v.ok).reduce((s,v)=>s+v.valor,0);

  let texto = `🪵 Caixinha: ${c.nome}%0A`;
  texto += `💰 Total: R$ ${c.total}%0A`;
  texto += `✅ Guardado: R$ ${feito}%0A%0A`;

  c.valores.forEach(v => {
    texto += `${v.ok ? "❌" : "⬜"} R$ ${v.valor}%0A`;
  });

  window.open(`https://wa.me/?text=${texto}`);
}
function baixarPDF() {
  const c = caixas[caixaAberta];
  const feito = c.valores.filter(v => v.ok).reduce((s,v)=>s+v.valor,0);

  let conteudo = `
Caixinha: ${c.nome}
Total: R$ ${c.total}
Guardado: R$ ${feito}

`;

  c.valores.forEach(v=>{
    conteudo += `${v.ok ? "[X]" : "[ ]"} R$ ${v.valor}\n`;
  });

  const blob = new Blob([conteudo], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.nome}.pdf`;
  a.click();
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}