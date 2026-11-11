/* VIOLET — Verificação de identidade
   Com a Didit configurada no servidor: o app envia a usuária para a página da Didit (documento + selfie) e,
   quando ela volta (?didit=1), confere o resultado.
   Sem a Didit (modo demonstração): fotos de RG/CNH (frente e verso) como antes. */
document.addEventListener("DOMContentLoaded", () => {
  const { api, esc } = window.Violet;
  const steps = [...document.querySelectorAll("[data-step]")];
  const total = steps.length;
  const fotos = new FormData();
  let atual = 1;

  const ir = (n) => {
    atual = n;
    steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    document.getElementById("retorno-didit").hidden = true;
    document.getElementById("progresso").style.width = `${((n - 1) / (total - 1)) * 100}%`;
    document.getElementById("btn-voltar").style.visibility = n === total ? "hidden" : "visible";
    if (n === 4) analisar();
  };

  document.getElementById("btn-voltar").addEventListener("click", () => (atual > 1 ? ir(atual - 1) : history.back()));
  document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => ir(atual + 1)));

  document.querySelectorAll("[data-frame]").forEach((f) => (f.dataset.label = f.textContent));
  const nomes = { 2: "documento_frente", 3: "documento_verso" };
  document.querySelectorAll("[data-capture]").forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const step = Number(input.closest("[data-step]").dataset.step);
      fotos.set(nomes[step], file);
      const frame = input.closest("[data-step]").querySelector("[data-frame]");
      frame.classList.add("is-captured");
      frame.style.background = `center / cover no-repeat url(${URL.createObjectURL(file)})`;
      frame.textContent = "";
      setTimeout(() => ir(step + 1), 650);
    });
  });

  const refazer = () => {
    document.querySelectorAll("[data-frame]").forEach((f) => {
      f.classList.remove("is-captured"); f.style.background = ""; f.textContent = f.dataset.label;
    });
    fotos.delete("documento_frente"); fotos.delete("documento_verso");
    ir(2);
  };
  let resultado = { status: "aprovada" };

  async function analisar() {
    const box = document.getElementById("analisando");
    const dl = document.getElementById("dados-doc");
    const btn = document.getElementById("btn-confirmar");
    box.hidden = false; dl.hidden = true; btn.disabled = true;
    try {
      resultado = await api.verificacao(fotos);
    } catch (err) {
      // Foto inválida, sem sessão ou servidor fora do ar: nada de "aprovado"
      window.Violet.toast(err.message);
      return refazer();
    }
    const { dados } = resultado;
    const linhas = [
      ["Nome completo", dados.nome], ["Data de nascimento", dados.nascimento],
      ["Documento", dados.documento], ["Validade", dados.validade], ["Naturalidade", dados.naturalidade]
    ].filter(([, v]) => v);
    dl.innerHTML = linhas.map(([k, v]) => `<div class="summary__row"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    box.hidden = true; dl.hidden = false; btn.disabled = false;
  }

  document.getElementById("btn-confirmar").addEventListener("click", () => {
    if (resultado.status === "pendente") {
      const passo = document.querySelector('[data-step="5"]');
      passo.querySelector("h1").textContent = "Documento recebido!";
      passo.querySelector(".lead").textContent = "Sua verificação está em análise. Você poderá usar o Violet assim que ela for aprovada.";
      passo.querySelector("a").textContent = "Voltar ao início";
      passo.querySelector("a").href = "login.html";
    }
    else window.Violet.disp.set("tutorial_pendente", true);   // conta nova verificada: mostra o tutorial no primeiro acesso à Home
    ir(5);
  });
  document.getElementById("btn-refazer").addEventListener("click", refazer);

  // ---- Verificação real (Didit) ----
  document.getElementById("btn-comecar").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    window.Violet.loading(btn, true, "Abrindo verificação…");
    try {
      const r = await api.iniciarVerificacao();
      if (r.modo === "didit" && r.url) { location.href = r.url; return; }   // a usuária segue para a página da Didit
      if (r.modo === "ja_verificada") { location.href = "home.html"; return; }
      ir(2);                                                                  // modo demonstração: fluxo das fotos
    } catch (err) {
      window.Violet.toast(err.message);
    }
    window.Violet.loading(btn, false);
  });

  const retorno = {
    el: document.getElementById("retorno-didit"), titulo: document.getElementById("retorno-titulo"),
    texto: document.getElementById("retorno-texto"), voltar: document.getElementById("retorno-voltar"),
    refazer: document.getElementById("retorno-refazer"),
  };
  const mostrarRetorno = (titulo, texto, { voltar = false, refazer: tentar = false } = {}) => {
    steps.forEach((s) => (s.hidden = true));
    retorno.el.hidden = false;
    retorno.titulo.textContent = titulo; retorno.texto.textContent = texto;
    retorno.voltar.hidden = !voltar; retorno.refazer.hidden = !tentar;
  };
  retorno.refazer.addEventListener("click", () => { history.replaceState(null, "", location.pathname); ir(1); });

  async function acompanharDidit() {
    mostrarRetorno("Conferindo sua verificação…", "Isso leva só alguns segundos.");
    for (let i = 0; i < 20; i++) {                       // ~1 minuto esperando a Didit decidir
      let s = null;
      try { s = await api.statusVerificacao(); } catch { /* tenta de novo */ }
      if (s && (s.verificada || s.status === "aprovada")) {
        window.Violet.disp.set("tutorial_pendente", true);   // conta nova verificada: mostra o tutorial na Home
        return ir(5);
      }
      if (s && s.status === "reprovada") {
        return mostrarRetorno("Não conseguimos confirmar sua identidade",
          "Confira se o documento está nítido e inteiro, com boa iluminação, e tente de novo.", { refazer: true });
      }
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    mostrarRetorno("Documento recebido!",
      "Sua verificação está em análise. Você poderá usar o Violet assim que ela for aprovada.", { voltar: true });
  }
  if (new URLSearchParams(location.search).has("didit")) acompanharDidit();
});
