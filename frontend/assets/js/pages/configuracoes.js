/* VIOLET — Configurações: notificações, sons, privacidade, bloqueio e idioma */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, initials, icon, toast, openSheet, closeSheet, disp, hashPin } = window.Violet;

  /* ---------- Painéis ---------- */
  const titulos = { principal: "Configurações", sons: "Sons e vibrações", privacidade: "Quem pode ver meus dados", bloqueio: "Bloqueio do aplicativo", idioma: "Idioma", aparencia: "Aparência", bloqueadas: "Usuárias bloqueadas" };
  let painel = "principal";
  const abrir = (p) => {
    painel = p;
    document.querySelectorAll("[data-painel]").forEach((s) => (s.hidden = s.dataset.painel !== p));
    document.getElementById("titulo").textContent = titulos[p];
    document.getElementById("btn-voltar").style.visibility = "visible";
  };
  abrir("principal");
  document.querySelectorAll("[data-abrir]").forEach((b) => b.addEventListener("click", () => abrir(b.dataset.abrir)));
  document.getElementById("btn-voltar").addEventListener("click", () => (painel === "principal" ? Violet.irPara("perfil.html") : abrir("principal")));

  const prefs = await api.obterPreferencias();
  const salvar = (mudanca) => { Object.assign(prefs, mudanca); return api.salvarPreferencias(mudanca); };

  /* ---------- Interruptores, volume e toque ---------- */
  document.querySelectorAll("[data-pref]").forEach((el) => {
    const k = el.dataset.pref;
    if (el.type === "checkbox") el.checked = !!prefs[k];
    else if (el.type === "radio") el.checked = prefs[k] === el.value;
    else el.value = prefs[k];
    el.addEventListener("change", () => {
      const v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
      salvar({ [k]: v });
    });
  });
  const vol = document.getElementById("volume");
  const out = document.getElementById("volume-valor");
  const pintarVolume = () => (out.textContent = `${vol.value}%`);
  vol.addEventListener("input", pintarVolume);
  pintarVolume();
  document.querySelectorAll("input[type=radio]").forEach((r) => (r.style.accentColor = "var(--violet-600)"));

  /* ---------- Privacidade: quem pode ver cada dado ---------- */
  const PRIVACIDADE = [
    {
      chave: "priv_perfil", titulo: "Perfil", icone: "user",
      desc: "Seu nome e foto de perfil.",
      opcoes: [
        { v: "contatos", t: "Somente meus contatos de confiança" },
        { v: "verificadas", t: "Usuárias verificadas do Violet" },
        { v: "ninguem", t: "Ninguém" }
      ]
    },
    {
      chave: "priv_localizacao", titulo: "Localização", icone: "map-pin",
      desc: "Onde você está agora. A central de apoio sempre recebe sua localização quando você aciona a emergência.",
      opcoes: [
        { v: "alerta", t: "Contatos de confiança, só durante um alerta" },
        { v: "ativar", t: "Contatos de confiança, quando eu ativar o compartilhamento" },
        { v: "circulo", t: "Também participantes do meu grupo no Círculo de Apoio" }
      ]
    },
    {
      chave: "priv_historico", titulo: "Histórico de denúncias", icone: "file-text",
      desc: "Suas denúncias e o andamento delas. Somente você vê a lista completa.",
      opcoes: [
        { v: "anonimo", t: "Equipe de suporte, sem meu nome" },
        { v: "identificado", t: "Equipe de suporte, com meu nome (para entrarem em contato)" }
      ]
    },
    {
      chave: "priv_contato", titulo: "Dados de contato", icone: "phone",
      desc: "Seu telefone e e-mail.",
      opcoes: [
        { v: "ninguem", t: "Não compartilhar" },
        { v: "contatos", t: "Somente meus contatos de confiança" }
      ]
    }
  ];
  const PADRAO = { priv_perfil: "contatos", priv_localizacao: "alerta", priv_historico: "anonimo", priv_contato: "ninguem" };
  const valor = (item) => prefs[item.chave] || PADRAO[item.chave];
  const rotulo = (item) => item.opcoes.find((o) => o.v === valor(item))?.t;

  const listaPriv = document.getElementById("lista-privacidade");
  const desenharPrivacidade = () => {
    listaPriv.innerHTML = PRIVACIDADE.map((item, i) => `
      <button class="list-item" data-priv="${i}">
        <span class="icon-badge">${icon(item.icone)}</span>
        <div class="grow"><div class="list-item__title">${item.titulo}</div><div class="list-item__sub">${esc(rotulo(item))}</div></div>
        ${icon("chevron-right")}
      </button>`).join("");
  };
  desenharPrivacidade();

  listaPriv.addEventListener("click", (e) => {
    const b = e.target.closest("[data-priv]");
    if (!b) return;
    const item = PRIVACIDADE[b.dataset.priv];
    document.getElementById("opcao-titulo").textContent = `Quem pode ver: ${item.titulo.toLowerCase()}`;
    document.getElementById("opcao-desc").textContent = item.desc;
    const lista = document.getElementById("opcao-lista");
    lista.innerHTML = item.opcoes.map((o) => escolha(o.v, o.t, o.v === valor(item))).join("");
    lista.onclick = async (ev) => {
      const op = ev.target.closest("[data-valor]");
      if (!op) return;
      marcar(lista, op);
      await salvar({ [item.chave]: op.dataset.valor });
      desenharPrivacidade();
      setTimeout(() => closeSheet("sheet-opcao"), 250);
      toast("Privacidade atualizada.");
    };
    openSheet("sheet-opcao");
  });

  /* ---------- Idioma ---------- */
  const IDIOMAS = [
    { v: "pt-BR", t: "Português (Brasil)", bandeira: "🇧🇷" },
    { v: "en", t: "English", bandeira: "🇺🇸" },
    { v: "es", t: "Español", bandeira: "🇪🇸" }
  ];
  const idiomaAtual = () => IDIOMAS.find((i) => i.v === (prefs.idioma || "pt-BR"));
  const listaIdiomas = document.getElementById("lista-idiomas");
  const desenharIdiomas = () => {
    listaIdiomas.innerHTML = IDIOMAS.map((i) => escolha(i.v, i.t, i.v === idiomaAtual().v, i.bandeira)).join("");
    document.getElementById("idioma-atual").textContent = idiomaAtual().t;
  };
  desenharIdiomas();
  listaIdiomas.addEventListener("click", async (e) => {
    const op = e.target.closest("[data-valor]");
    if (!op) return;
    marcar(listaIdiomas, op);
    await salvar({ idioma: op.dataset.valor });
    if (window.Violet.idioma) { window.Violet.idioma.set(op.dataset.valor); setTimeout(() => window.Violet.idioma.set(op.dataset.valor), 0); }
    document.documentElement.lang = op.dataset.valor;
    document.getElementById("idioma-atual").textContent = idiomaAtual().t;
    toast(op.dataset.valor === "pt-BR" ? "Idioma salvo." : (op.dataset.valor === "en" ? "Language saved." : "Idioma guardado."));
  });

  /* ---------- Aparência (claro / escuro) ---------- */
  const TEMAS = [
    { v: "auto", t: "Automático (segue o aparelho)", e: "🌗" },
    { v: "claro", t: "Claro", e: "☀️" },
    { v: "escuro", t: "Escuro", e: "🌙" }
  ];
  const nomeTema = (v) => TEMAS.find((x) => x.v === v).t.split(" (")[0];
  const listaTema = document.getElementById("lista-tema");
  const desenharTema = () => {
    const atual = Violet.tema.get();
    listaTema.innerHTML = TEMAS.map((x) => escolha(x.v, x.t, x.v === atual, x.e)).join("");
    document.getElementById("tema-atual").textContent = nomeTema(atual);
  };
  desenharTema();
  listaTema.addEventListener("click", (e) => {
    const op = e.target.closest("[data-valor]");
    if (!op) return;
    marcar(listaTema, op);
    Violet.tema.set(op.dataset.valor);
    document.getElementById("tema-atual").textContent = nomeTema(op.dataset.valor);
  });


  /* ---------- Opções só deste aparelho: discrição, alerta silencioso, animações ---------- */
  document.querySelectorAll("[data-disp]").forEach((el) => {
    const padrao = el.dataset.padrao === "true";
    el.checked = !!disp.get(el.dataset.disp, padrao);
    el.addEventListener("change", () => {
      disp.set(el.dataset.disp, el.checked);
      toast(el.checked ? "Ativado." : "Desativado.");
    });
  });

  /* ---------- Tamanho do texto ---------- */
  const FONTES = [{ v: "normal", t: "Normal" }, { v: "grande", t: "Grande" }, { v: "enorme", t: "Muito grande" }];
  const listaFonte = document.getElementById("lista-fonte");
  const desenharFonte = () => { listaFonte.innerHTML = FONTES.map((f) => escolha(f.v, f.t, f.v === disp.get("fonte", "normal"))).join(""); };
  desenharFonte();
  listaFonte.addEventListener("click", (e) => {
    const op = e.target.closest("[data-valor]"); if (!op) return;
    disp.set("fonte", op.dataset.valor); desenharFonte();
  });

  /* ---------- Usuárias bloqueadas ---------- */
  const listaBloq = document.getElementById("lista-bloqueadas");
  async function desenharBloqueadas() {
    const lista = await api.listarBloqueadas();
    document.getElementById("qtd-bloqueadas").textContent = lista.length;
    listaBloq.innerHTML = lista.length ? lista.map((b) => `
      <div class="list-item">
        <span class="avatar avatar--sm" data-tone="2">${initials(b.nome)}</span>
        <span class="grow list-item__title">${esc(b.nome)}</span>
        <button class="btn btn--soft btn--sm" data-desbloquear="${esc(b.nome)}">Desbloquear</button>
      </div>`).join("") : `<div class="empty"><span class="icon-badge icon-badge--round">${icon("shield-check")}</span><p>Você não bloqueou ninguém.</p></div>`;
  }
  listaBloq.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-desbloquear]"); if (!b) return;
    await api.desbloquearUsuaria(b.dataset.desbloquear);
    toast(`${b.dataset.desbloquear} foi desbloqueada.`); desenharBloqueadas();
  });
  desenharBloqueadas();

  /* ---------- PIN de verdade: o app pede o PIN ao abrir (veja app.js) ---------- */
  const swPin = document.getElementById("sw-pin");
  const btnTrocar = document.getElementById("btn-trocar-pin");
  const pinInput = document.getElementById("pin-input");
  const pinErro = document.getElementById("pin-erro");
  const TXT = {
    atual: ["Digite seu PIN atual", "Para continuar, confirme o PIN que você usa hoje."],
    novo: ["Crie um PIN", "Escolha 4 números que só você saiba."],
    repetir: ["Repita o PIN", "Digite os mesmos 4 números para confirmar."]
  };
  const pin = { modo: "", passos: [], i: 0, tmp: "" };
  const temPin = () => !!disp.get("pin_hash", null);
  const sincronizarPin = () => { swPin.checked = temPin(); btnTrocar.hidden = !temPin(); };
  sincronizarPin();
  function passoPin() {
    const [t, d] = TXT[pin.passos[pin.i]];
    document.getElementById("pin-titulo").textContent = t;
    document.getElementById("pin-desc").textContent = d;
    pinInput.value = ""; pinErro.textContent = "";
    setTimeout(() => pinInput.focus(), 250);
  }
  function abrirPin(modo) {
    pin.modo = modo; pin.i = 0; pin.tmp = "";
    pin.passos = modo === "criar" ? ["novo", "repetir"] : modo === "desativar" ? ["atual"] : ["atual", "novo", "repetir"];
    passoPin(); openSheet("sheet-pin");
  }
  const fecharPin = () => { closeSheet("sheet-pin"); sincronizarPin(); };
  document.getElementById("pin-cancelar").addEventListener("click", fecharPin);
  document.getElementById("sheet-pin").addEventListener("click", (e) => { if (e.target.id === "sheet-pin") sincronizarPin(); });
  swPin.addEventListener("change", () => abrirPin(swPin.checked ? "criar" : "desativar"));
  btnTrocar.addEventListener("click", () => abrirPin("trocar"));
  async function avancarPin() {
    const v = pinInput.value;
    if (!/^\d{4}$/.test(v)) { pinErro.textContent = "Digite 4 números."; return; }
    const passo = pin.passos[pin.i];
    if (passo === "atual" && (await hashPin(v)) !== disp.get("pin_hash", null)) { pinErro.textContent = "PIN incorreto."; pinInput.value = ""; return; }
    if (passo === "atual" && pin.modo === "desativar") { disp.set("pin_hash", null); toast("PIN desativado."); return fecharPin(); }
    if (passo === "novo") pin.tmp = v;
    if (passo === "repetir") {
      if (v !== pin.tmp) { pin.i = pin.passos.indexOf("novo"); passoPin(); pinErro.textContent = "Os PINs não eram iguais. Crie de novo."; return; }
      disp.set("pin_hash", await hashPin(v));
      try { sessionStorage.setItem("violet:desbloqueado", "1"); } catch { /* sem storage */ }
      toast("PIN ativado. O app vai pedi-lo ao abrir.");
      return fecharPin();
    }
    pin.i++; passoPin();
  }
  document.getElementById("pin-ok").addEventListener("click", avancarPin);
  pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); avancarPin(); } });

  /* ---------- Opção com marcação ---------- */
  function escolha(v, texto, ativa, prefixo = "") {
    return `<button class="choice${ativa ? " is-checked" : ""}" role="radio" aria-checked="${ativa}" data-valor="${v}">
      ${prefixo ? `<span class="choice__flag" aria-hidden="true">${prefixo}</span>` : ""}
      <span class="grow">${esc(texto)}</span>
      <span class="choice__mark" aria-hidden="true">${icon("check", "sm")}</span>
    </button>`;
  }
  function marcar(lista, op) {
    lista.querySelectorAll(".choice").forEach((c) => {
      c.classList.toggle("is-checked", c === op);
      c.setAttribute("aria-checked", c === op);
    });
  }
});
