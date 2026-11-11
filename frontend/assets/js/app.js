/* ==========================================================
   VIOLET — Comportamentos comuns a todas as telas
   - Menu inferior: <div class="app has-nav" data-nav="inicio|denunciar|rede|conversas|perfil">
   - Botão SOS flutuante: adicione data-sos na .app
   - Voltar: <button data-back="pagina.html"> (usa o histórico quando existe)
   - Mostrar/ocultar senha: <button data-toggle-password>
   ========================================================== */
(function () {
  const V = (window.Violet = window.Violet || {});

  const NAV = [
    { id: "inicio", href: "home.html", icon: "home", label: "Início" },
    { id: "denunciar", href: "denuncia.html", icon: "plus", label: "Denunciar" },
    { id: "rede", href: "rede.html", icon: "heart", label: "Rede" },
    { id: "conversas", href: "conversas.html", icon: "message", label: "Conversas" },
    { id: "perfil", href: "perfil.html", icon: "user", label: "Perfil" }
  ];

  const reduzMovimento = document.documentElement.dataset.reduzir === "1"; // escolha dentro do app (Configurações)
  const sessao = {
    get(k) { try { return sessionStorage.getItem("violet:" + k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem("violet:" + k, v); } catch { /* sem storage */ } }
  };

  /* Barra de navegação com pílula deslizante.
     A posição anterior fica na sessão, então a pílula "viaja" de uma aba para outra entre páginas. */
  function buildNav(active) {
    const nav = document.createElement("nav");
    nav.className = "bottom-nav no-anim";
    nav.setAttribute("aria-label", "Navegação principal");
    const atual = Math.max(0, NAV.findIndex((n) => n.id === active));
    nav.innerHTML = `<span class="bottom-nav__pill" aria-hidden="true"></span>` + NAV.map((item, i) => {
      const current = i === atual;
      return `<a href="${item.href}" data-i="${i}" class="${current ? "is-active" : ""}" ${current ? 'aria-current="page"' : ""} aria-label="${item.label}">
        ${V.icon(item.icon)}<span>${item.label}</span></a>`;
    }).join("");

    // A bolinha rosa/roxa desliza até a aba ativa. A cápsula ativa se ajusta ao tamanho do texto,
    // então a posição final é medida numa cópia invisível da barra (sem animação).
    let corrente = atual;
    const medirX = (indice) => {
      const copia = nav.cloneNode(true);
      copia.classList.add("is-medindo");
      copia.classList.remove("no-anim");
      // Fora do fluxo da página e com a mesma largura da barra real: não altera o layout (nem a barra de rolagem)
      copia.style.cssText = `position:fixed;left:-10000px;top:0;margin:0;transform:none;width:${nav.getBoundingClientRect().width}px`;
      copia.querySelectorAll("a[data-i]").forEach((a) => a.classList.toggle("is-active", Number(a.dataset.i) === indice));
      document.body.appendChild(copia);
      const alvo = copia.querySelector(`a[data-i="${indice}"]`);
      const x = alvo ? alvo.offsetLeft + 4 : 4;
      copia.remove();
      return x;
    };
    let bloqueio = 0;   // enquanto a bolinha desliza, o reajuste automático espera
    const moverPill = (indice, animar = true) => {
      corrente = indice;
      if (!animar) nav.classList.add("no-anim");
      nav.style.setProperty("--pill-x", `${medirX(indice)}px`);
      if (!animar) requestAnimationFrame(() => nav.classList.remove("no-anim"));
      else { bloqueio = performance.now() + 900; setTimeout(reajustar, 950); }
    };
    // Se a largura da barra ou da cápsula mudar depois (fonte web, barra de rolagem, zoom, rotação…), a bolinha acompanha.
    function reajustar() { if (performance.now() >= bloqueio) moverPill(corrente, false); }
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(reajustar);
      ro.observe(nav);   // a barra encolhe/estica (ex.: barra de rolagem aparecendo)
      nav.querySelectorAll("a[data-i]").forEach((a) => ro.observe(a));
    }
    document.fonts?.addEventListener?.("loadingdone", reajustar);
    const anterior = Number(sessao.get("nav"));
    const indiceAnterior = Number.isFinite(anterior) && sessao.get("nav") !== null ? anterior : atual;
    nav.querySelectorAll("a").forEach(a => a.classList.toggle("is-active", Number(a.dataset.i) === indiceAnterior));
    requestAnimationFrame(() => {
      moverPill(indiceAnterior, false);
      requestAnimationFrame(() => {
        nav.querySelectorAll("a").forEach(a => a.classList.toggle("is-active", Number(a.dataset.i) === atual));
        moverPill(atual, true);
      });
    });
    addEventListener("resize", () => moverPill(corrente, false));
    // Quando a fonte termina de carregar, a largura do texto muda: reposiciona a bolinha
    document.fonts?.ready.then(reajustar);
    sessao.set("nav", atual);

    nav.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-i]");
      if (!link) return;
      e.preventDefault();
      const i = Number(link.dataset.i);
      nav.querySelectorAll("a").forEach((a) => {
        const ativo = a === link;
        a.classList.toggle("is-active", ativo);
        if (ativo) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
      link.classList.add("is-tapped");
      moverPill(i, true);
      sessao.set("nav", i);
      if (navigator.vibrate) navigator.vibrate(8);
      if (i === atual) return;
      irPara(link.href, reduzMovimento ? 0 : 300);
    });
    return nav;
  }

  /* Saída suave antes de trocar de página */
  function irPara(href, atraso = 180) {
    document.body.classList.add("is-leaving");
    setTimeout(() => (location.href = href), atraso);
  }
  V.irPara = irPara;

  /* Onda (ripple) no ponto do toque */
  const ALVOS_RIPPLE = ".btn, .chip, .list-item, .tile, .icon-btn, .segmented button, .quick a, .social button";
  function ripple(e) {
    const alvo = e.target.closest(ALVOS_RIPPLE);
    if (!alvo || alvo.closest(".bottom-nav") || reduzMovimento) return;
    const r = alvo.getBoundingClientRect();
    const tam = Math.max(r.width, r.height) * 2;
    const onda = document.createElement("span");
    onda.className = "ripple";
    onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - r.left - tam / 2}px;top:${e.clientY - r.top - tam / 2}px`;
    if (getComputedStyle(alvo).position === "static") alvo.style.position = "relative";
    alvo.style.overflow = "hidden";
    alvo.appendChild(onda);
    onda.addEventListener("animationend", () => onda.remove());
  }

  /* Listas entram uma a uma (também quando as telas redesenham a lista) */
  const LISTAS = ".list, .divided-list, .people, .quick, .tiles, .chips, .sos-list, #lista, #lista-conversas, #lista-notificacoes, #lista-contatos, #resumo, .summary";
  function escalonar(el) {
    if (reduzMovimento) return;
    el.classList.remove("stagger");
    [...el.children].forEach((c, i) => c.style.setProperty("--d", i));
    void el.offsetWidth; // reinicia a animação
    el.classList.add("stagger");
  }

  /* Abas segmentadas: fundo branco desliza até a aba ativa */
  function segmentado(seg) {
    const thumb = document.createElement("span");
    thumb.className = "segmented__thumb";
    thumb.setAttribute("aria-hidden", "true");
    seg.prepend(thumb);
    const mover = () => {
      const ativo = seg.querySelector("button.is-active") || seg.querySelector("button");
      thumb.style.width = `${ativo.offsetWidth}px`;
      thumb.style.transform = `translateX(${ativo.offsetLeft - 4}px)`;
    };
    seg.addEventListener("click", () => requestAnimationFrame(mover));
    addEventListener("resize", mover);
    requestAnimationFrame(mover);
  }

  function buildSos() {
    const a = document.createElement("a");
    a.href = "emergencia.html";
    a.className = "sos-fab";
    a.setAttribute("aria-label", "Abrir botão de emergência");
    a.innerHTML = V.icon("bell", "lg");
    return a;
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  V.toast = function (msg, ms = 2600) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), ms);
  };

  /* ---------- Bottom sheet ---------- */
  V.openSheet = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-open");
    el.addEventListener("click", (e) => { if (e.target === el) V.closeSheet(id); }, { once: true });
  };
  V.closeSheet = (id) => document.getElementById(id)?.classList.remove("is-open");

  /* ---------- Utilidades ---------- */
  V.qs = (name) => new URLSearchParams(location.search).get(name);
  V.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  V.initials = (nome) => String(nome || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  V.loading = function (btn, on, label) {
    if (!btn) return;
    btn.classList.toggle("is-loading", !!on);          // brilhos animados no botão (components.css)
    btn.setAttribute("aria-busy", on ? "true" : "false");
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = label || "Aguarde…"; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  };

  /* Validação simples: campos com required / type=email / data-min */
  V.validate = function (form) {
    let ok = true;
    form.querySelectorAll(".field").forEach((field) => {
      const input = field.querySelector("input, select, textarea");
      if (!input) return;
      let valid = input.checkValidity();
      if (valid && input.dataset.min) valid = input.value.trim().length >= Number(input.dataset.min);
      if (valid && input.dataset.match) valid = input.value === form.querySelector(input.dataset.match)?.value;
      field.classList.toggle("is-invalid", !valid);
      if (!valid && ok) { input.focus(); ok = false; }
    });
    return ok;
  };

  V.phoneMask = function (input) {
    input.addEventListener("input", () => {
      const d = input.value.replace(/\D/g, "").slice(0, 11);
      let out = d;
      if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      input.value = out;
    });
  };

  /* ---------- Inicialização ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const app = document.querySelector(".app");
    let nav;
    if (app?.dataset.nav) { nav = buildNav(app.dataset.nav); app.appendChild(nav); }
    // O SOS fica preso à barra, centralizado acima dela (como no Figma)
    if (app && "sos" in app.dataset) (nav || app).appendChild(buildSos());

    V.renderIcons();

    // Microinterações
    document.addEventListener("pointerdown", ripple);
    document.querySelectorAll(".segmented").forEach(segmentado);
    document.querySelectorAll(LISTAS).forEach((el) => el.children.length && escalonar(el));
    new MutationObserver((muts) => {
      const alvos = new Set();
      muts.forEach((m) => { if (m.addedNodes.length && m.target.matches?.(LISTAS)) alvos.add(m.target); });
      alvos.forEach(escalonar);
    }).observe(document.body, { childList: true, subtree: true });

    // Links internos saem com transição
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || a.target || e.metaKey || e.ctrlKey) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^(tel|mailto|https?):/.test(href)) return;
      e.preventDefault();
      irPara(a.href, reduzMovimento ? 0 : 160);
    });
    // Voltar pelo navegador restaura a página sem o efeito de saída
    addEventListener("pageshow", () => document.body.classList.remove("is-leaving"));

    document.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fallback = btn.dataset.back;
        if (document.referrer && document.referrer.startsWith(location.origin) && history.length > 1) history.back();
        else if (fallback) location.href = fallback;
      });
    });

    document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.parentElement.querySelector("input");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.innerHTML = V.icon(show ? "eye-off" : "eye", "sm");
        btn.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
      });
    });

    document.querySelectorAll("input[type=tel]").forEach(V.phoneMask);

    // Limpa erro ao digitar
    document.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("is-invalid"));
  });
})();


/* ==========================================================
   Segurança dentro do app: bloqueio por PIN, saída rápida e aviso de trajeto
   ========================================================== */
(function () {
  const V = window.Violet;
  const ic = (n, t) => (V.icon ? V.icon(n, t) : "");

  /* ---------- Bloqueio por PIN ---------- */
  function montarBloqueio() {
    const caixa = document.createElement("div");
    caixa.className = "lock";
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-modal", "true");
    caixa.setAttribute("aria-label", "Violet bloqueado");
    const bio = V.disp.get("biometria_sim", false);
    caixa.innerHTML = `
      <div class="lock__box">
        <span class="lock__icon">${ic("lock", "lg")}</span>
        <h2>Violet bloqueado</h2>
        <p class="text-sm text-muted">Digite seu PIN para entrar.</p>
        <div class="lock__dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <p class="lock__erro" role="alert" aria-live="assertive"></p>
        <div class="lock__pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join("")}
          ${bio ? `<button type="button" data-bio aria-label="Usar biometria (simulada)">${ic("fingerprint")}</button>` : "<span></span>"}
          <button type="button" data-n="0">0</button>
          <button type="button" data-apagar aria-label="Apagar">${ic("arrow-left")}</button>
        </div>
        <a class="lock__sos" href="emergencia.html">${ic("bell", "sm")} Emergência</a>
      </div>`;
    document.body.appendChild(caixa);

    let digitos = "", erros = 0, travadoAte = 0;
    const pontos = [...caixa.querySelectorAll(".lock__dots i")];
    const erro = caixa.querySelector(".lock__erro");
    const pintar = () => pontos.forEach((p, i) => p.classList.toggle("is-on", i < digitos.length));
    const liberar = () => {
      try { sessionStorage.setItem("violet:desbloqueado", "1"); } catch { /* sem storage */ }
      document.documentElement.classList.remove("is-locked");
      document.removeEventListener("keydown", teclado);
      caixa.remove();
      monitorarTrajeto();
    };
    async function conferir() {
      if (Date.now() < travadoAte) { erro.textContent = `Aguarde ${Math.ceil((travadoAte - Date.now()) / 1000)} s para tentar de novo.`; digitos = ""; pintar(); return; }
      if ((await V.hashPin(digitos)) === V.disp.get("pin_hash", null)) return liberar();
      erros++; digitos = ""; pintar();
      caixa.classList.remove("is-erro"); void caixa.offsetWidth; caixa.classList.add("is-erro");
      if (navigator.vibrate) navigator.vibrate(120);
      if (erros >= 5) { travadoAte = Date.now() + 30000; erros = 0; erro.textContent = "Muitas tentativas. Aguarde 30 segundos."; }
      else erro.textContent = "PIN incorreto.";
    }
    const digitar = (n) => { if (digitos.length >= 4) return; erro.textContent = ""; digitos += n; pintar(); if (digitos.length === 4) conferir(); };
    caixa.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.n !== undefined) digitar(b.dataset.n);
      else if ("apagar" in b.dataset) { digitos = digitos.slice(0, -1); pintar(); }
      else if ("bio" in b.dataset) { erro.textContent = "Biometria reconhecida (simulação)."; setTimeout(liberar, 700); }
    });
    function teclado(e) {
      if (/^\d$/.test(e.key)) digitar(e.key);
      else if (e.key === "Backspace") { digitos = digitos.slice(0, -1); pintar(); }
    }
    document.addEventListener("keydown", teclado);
  }

  /* ---------- Saída rápida: fecha tudo e abre uma tela neutra ---------- */
  function saidaRapida() {
    try { sessionStorage.removeItem("violet:desbloqueado"); } catch { /* sem storage */ }
    location.replace("neutro.html");
  }
  function montarSaidaRapida() {
    const fixo = document.querySelector("[data-quick-exit]");   // botão que já está na tela (Home)
    if (fixo) fixo.hidden = V.paginaLivre || !V.disp.get("saida_rapida", true);
    if (V.paginaLivre || !V.disp.get("saida_rapida", true)) return;
    const app = document.querySelector(".app");
    if (!app) return;
    const b = fixo || document.createElement("button");
    if (!fixo) {
      b.type = "button";
      b.className = "quick-exit" + (app.classList.contains("has-nav") ? " quick-exit--nav" : "");
      b.setAttribute("aria-label", "Saída rápida: abre uma tela neutra");
      b.title = "Saída rápida";
      b.innerHTML = ic("eye-off", "sm");
      document.body.appendChild(b);
    }
    b.addEventListener("click", saidaRapida);
    // No computador: Esc duas vezes seguidas
    let ultimo = 0;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (Date.now() - ultimo < 600) saidaRapida();
      ultimo = Date.now();
    });
  }

  /* ---------- Trajeto seguro: se não confirmar a chegada, a rede é avisada (simulado) ---------- */
  let avisoTimer;
  async function monitorarTrajeto() {
    clearTimeout(avisoTimer);
    if (!V.api || !V.api.obterTrajeto || V.precisaPin()) return;
    const t = await V.api.obterTrajeto();
    if (!t || t.alertado) return;
    const falta = new Date(t.limite_em) - Date.now();
    if (falta > 0) { avisoTimer = setTimeout(monitorarTrajeto, Math.min(falta + 50, 20000)); return; }
    await V.api.marcarTrajetoAlertado();
    let nomes = [];
    try { nomes = (await V.api.listarContatos()).filter((c) => c.de_confianca !== false && c.recebe_alertas !== false).map((c) => c.nome.split(" ")[0]); } catch { /* sem contatos */ }
    const aviso = document.createElement("div");
    aviso.className = "aviso-rede";
    aviso.setAttribute("role", "alertdialog");
    aviso.setAttribute("aria-modal", "true");
    aviso.setAttribute("aria-labelledby", "aviso-rede-titulo");
    aviso.innerHTML = `
      <div class="aviso-rede__box">
        <span class="aviso-rede__icon">${ic("alert-triangle", "lg")}</span>
        <h2 id="aviso-rede-titulo">Você ainda não confirmou a chegada</h2>
        <p class="text-sm">O prazo do seu trajeto${t.nome ? ` “${V.esc(t.nome)}”` : ""} acabou. Aqui o Violet avisaria a sua rede de apoio${nomes.length ? `: <b>${V.esc(nomes.join(", "))}</b>` : ""}.</p>
        <p class="text-xs text-muted">Aviso simulado: nesta versão nenhuma mensagem é enviada de verdade.</p>
        <button type="button" class="btn btn--primary" data-chegou>${ic("check-circle", "sm")} Estou bem, já cheguei</button>
        <a class="btn btn--soft" href="emergencia.html">Preciso de ajuda</a>
      </div>`;
    document.body.appendChild(aviso);
    aviso.querySelector("[data-chegou]").addEventListener("click", async () => {
      const antes = await V.api.obterTrajeto();
      await V.api.confirmarChegada();
      try {                                  // a localização do grupo termina junto com o trajeto
        const c = await V.api.obterCompartilhamento();
        if (c && antes && String(c.grupo) === String(antes.grupo)) await V.api.encerrarLocalizacao();
      } catch { /* sem compartilhamento */ }
      aviso.remove();
      V.toast("Que bom! Avisamos a rede que você está bem 💜");
      window.dispatchEvent(new Event("violet:trajeto-fim"));   // a tela do grupo some com o cartão do trajeto
    });
  }

  window.addEventListener("violet:trajeto", monitorarTrajeto);
  document.addEventListener("DOMContentLoaded", () => {
    if (V.precisaPin()) montarBloqueio(); else monitorarTrajeto();
    montarSaidaRapida();
  });
})();
