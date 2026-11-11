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
    document.getElementById("conferencia").hidden = true;
    document.getElementById("progresso").style.width = `${((n - 1) / (total - 1)) * 100}%`;
    document.getElementById("progresso").parentElement.parentElement.hidden = n === 1;   // sem barra solta na introdução
    document.getElementById("btn-voltar").style.visibility = n === total ? "hidden" : "visible";
    if (n === 4) analisar();
  };

  document.getElementById("progresso").parentElement.parentElement.hidden = true;   // começa na introdução: sem barra
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
    btn.disabled = true;
    try {
      const r = await api.iniciarVerificacao();
      if (r.modo === "didit" && r.url) { location.href = r.url; return; }   // a usuária segue para a página da Didit
      if (r.modo === "ja_verificada") { location.href = "home.html"; return; }
      ir(2);                                                                  // modo demonstração: fluxo das fotos
    } catch (err) {
      window.Violet.toast(err.message);
    }
    btn.disabled = false;
  });

  const retorno = {
    el: document.getElementById("retorno-didit"), titulo: document.getElementById("retorno-titulo"),
    texto: document.getElementById("retorno-texto"), voltar: document.getElementById("retorno-voltar"),
    refazer: document.getElementById("retorno-refazer"),
  };
  const mostrarRetorno = (titulo, texto, { voltar = false, refazer: tentar = false } = {}) => {
    steps.forEach((s) => (s.hidden = true));
    document.getElementById("conferencia").hidden = true;
    retorno.el.hidden = false;
    retorno.titulo.textContent = titulo; retorno.texto.textContent = texto;
    retorno.voltar.hidden = !voltar; retorno.refazer.hidden = !tentar;
  };
  retorno.refazer.addEventListener("click", () => { history.replaceState(null, "", location.pathname); ir(1); });

  // ---- Conferência do nome: passo a passo, aparece depois que a Didit aprova o documento ----
  const mensagemRecusa = ["Não conseguimos confirmar o seu cadastro",
    "Confira se o documento está nítido e inteiro, com boa iluminação, e tente de novo. Se acha que houve um engano, fale com o suporte do Violet."];
  const mensagemRevisao = ["Documento recebido!",
    "Seu cadastro está em revisão por uma administradora. Você poderá usar o Violet assim que ele for aprovado."];

  const passosDaConferencia = (c) => {
    const nome = esc(c.nome || "");
    const pct = c.pct_feminino != null ? String(c.pct_feminino).replace(".", ",") : "";
    const passos = [{ icone: "check", tom: "ok", titulo: "Identidade confirmada",
      sub: "Documento, selfie e prova de vida verificados pela Didit." }];
    if (c.genero_documento === "F" || c.genero_documento === "M") {
      passos.push({ icone: c.genero_documento === "F" ? "check" : "x", tom: c.genero_documento === "F" ? "ok" : "erro",
        titulo: "Gênero informado no documento",
        sub: c.genero_documento === "F" ? "Feminino, como consta no seu documento." : "Masculino, como consta no documento." });
    } else {
      passos.push({ icone: "info", tom: "info", titulo: "Gênero no documento",
        sub: "Seu documento não informa o gênero. Vamos conferir pelo primeiro nome." });
      if (c.metodo === "ibge") {
        const ok = c.classe === "F", erro = c.classe === "M";
        passos.push({ icone: ok ? "check" : erro ? "x" : "clock", tom: ok ? "ok" : erro ? "erro" : "aviso",
          titulo: `Primeiro nome: ${nome}`,
          sub: pct ? `${pct}% das pessoas com esse nome no Brasil são mulheres (base do IBGE).`
                   : "Nome pouco comum na base do IBGE." });
      } else if (c.metodo === "indisponivel") {
        passos.push({ icone: "clock", tom: "aviso", titulo: `Primeiro nome: ${nome}`,
          sub: "Não conseguimos consultar a base do IBGE agora." });
      }
    }
    const fim = { aprovada: ["check", "ok", "Cadastro confirmado", "Tudo certo: você já pode usar o Violet."],
      pendente: ["clock", "aviso", "Em revisão", "Uma administradora vai analisar o seu cadastro."],
      reprovada: ["x", "erro", "Não foi possível confirmar", "O cadastro não passou na conferência."] }[c.resultado]
      || ["info", "info", "Resultado", ""];
    passos.push({ icone: fim[0], tom: fim[1], titulo: fim[2], sub: fim[3], final: true });
    return passos;
  };

  const mostrarConferencia = (c, aoContinuar) => {
    steps.forEach((x) => (x.hidden = true));
    retorno.el.hidden = true;
    const tela = document.getElementById("conferencia");
    const lista = document.getElementById("conf-lista");
    const btn = document.getElementById("conf-continuar");
    tela.hidden = false; btn.disabled = true; lista.innerHTML = "";
    document.getElementById("conf-nota").hidden = c.metodo === "documento";
    document.getElementById("progresso").parentElement.parentElement.hidden = true;
    document.getElementById("btn-voltar").style.visibility = "hidden";
    const classeIcone = { ok: "icon-badge icon-badge--success", erro: "icon-badge icon-badge--danger", aviso: "icon-badge", info: "icon-badge" };
    const rapido = document.documentElement.dataset.reduzir === "1";   // "Reduzir animações" ligado: mostra tudo de uma vez
    const passos = passosDaConferencia(c);
    passos.forEach((p, i) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.className = "list-item fade-in";
        div.innerHTML = `<span class="${classeIcone[p.tom]}"><i data-icon="${p.icone}"></i></span>` +
          `<div class="grow"><div class="list-item__title">${p.titulo}</div><div class="list-item__sub">${p.sub}</div></div>`;
        lista.appendChild(div);
        window.Violet.renderIcons(div);
        if (i === passos.length - 1) btn.disabled = false;
      }, rapido ? 0 : i * 900);
    });
    btn.onclick = aoContinuar;
  };

  async function acompanharDidit() {
    mostrarRetorno("Conferindo sua verificação…", "Isso leva só alguns segundos.");
    for (let i = 0; i < 20; i++) {                       // ~1 minuto esperando a Didit decidir
      let s = null;
      try { s = await api.statusVerificacao(); } catch { /* tenta de novo */ }
      const c = s && s.conferencia;
      const aprovada = s && (s.verificada || s.status === "aprovada");
      if (c) {                                           // a Didit aprovou: mostra como o nome foi conferido
        const aoContinuar = aprovada
          ? () => { window.Violet.disp.set("tutorial_pendente", true); ir(5); }
          : s.status === "reprovada"
            ? () => mostrarRetorno(...mensagemRecusa, { refazer: true })
            : () => mostrarRetorno(...mensagemRevisao, { voltar: true });
        return mostrarConferencia(c, aoContinuar);
      }
      if (aprovada) {                                    // aprovada sem detalhes (regra desligada)
        window.Violet.disp.set("tutorial_pendente", true);   // conta nova verificada: mostra o tutorial na Home
        return ir(5);
      }
      if (s && s.status === "reprovada") {
        return mostrarRetorno("Não conseguimos confirmar sua identidade",
          "Confira se o documento está nítido e inteiro, com boa iluminação, e tente de novo.", { refazer: true });
      }
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    mostrarRetorno(...mensagemRevisao, { voltar: true });
  }
  if (new URLSearchParams(location.search).has("didit")) acompanharDidit();
});
