/* ==========================================================
   VIOLET — Tema claro / escuro
   Carregue no <head>, ANTES dos CSS e sem "defer": assim o tema certo
   já está aplicado quando a página aparece (sem piscar o claro).

   - Preferência salva no aparelho: "auto" | "claro" | "escuro"
   - "auto" segue o tema do celular/computador
   - Qualquer botão com  data-theme-toggle  alterna claro <-> escuro
   - Imagens com  data-src-dark="..."  trocam de arquivo no tema escuro
   - API: Violet.tema.get() / .set("auto"|"claro"|"escuro") / .alternar() / .escuro()
   ========================================================== */
(function () {
  const CHAVE = "violet:tema";
  const raiz = document.documentElement;
  const sistema = matchMedia("(prefers-color-scheme: dark)");
  const COR_BARRA_ESCURA = "#150d1d";
  const BARRAS_CLARAS = ["#faf7fc", "#e7d6f7"];   // theme-color que viram escuras no tema escuro

  const ler = () => { try { return localStorage.getItem(CHAVE) || "auto"; } catch { return "auto"; } };
  const gravar = (v) => { try { localStorage.setItem(CHAVE, v); } catch { /* sem storage */ } };
  const escuroAgora = (pref) => (pref === "escuro" || (pref === "auto" && sistema.matches));

  function aplicar(pref) {
    const escuro = escuroAgora(pref);
    raiz.dataset.theme = escuro ? "dark" : "light";

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (!meta.dataset.claro) meta.dataset.claro = meta.content;
      meta.content = escuro && BARRAS_CLARAS.includes(meta.dataset.claro) ? COR_BARRA_ESCURA : meta.dataset.claro;
    }
    // Só mexe em elementos depois que o <body> existe
    document.querySelectorAll("img[data-src-dark]").forEach((img) => {
      if (!img.dataset.srcClaro) img.dataset.srcClaro = img.getAttribute("src");
      img.setAttribute("src", escuro ? img.dataset.srcDark : img.dataset.srcClaro);
    });
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      b.setAttribute("aria-pressed", String(escuro));
      b.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
      b.setAttribute("title", escuro ? "Ativar tema claro" : "Ativar tema escuro");
    });
  }

  const tema = {
    get: ler,
    escuro: () => escuroAgora(ler()),
    set(pref) {
      gravar(pref);
      aplicar(pref);
      document.dispatchEvent(new CustomEvent("violet:tema", { detail: { pref, escuro: escuroAgora(pref) } }));
    },
    alternar() { tema.set(escuroAgora(ler()) ? "claro" : "escuro"); }
  };

  window.Violet = window.Violet || {};
  window.Violet.tema = tema;

  /* ---------- Preferências só deste aparelho (discrição, acessibilidade, PIN) ---------- */
  const CH_DISP = "violet:disp";
  const lerDisp = () => { try { return JSON.parse(localStorage.getItem(CH_DISP) || "{}"); } catch { return {}; } };
  function aplicarDisp() {
    const d = lerDisp();
    raiz.dataset.fonte = d.fonte || "normal";
    if (d.reduzir === true) raiz.dataset.reduzir = "1"; else delete raiz.dataset.reduzir;
  }
  window.Violet.disp = {
    get: (k, padrao) => { const v = lerDisp()[k]; return v === undefined ? padrao : v; },
    set(k, v) {
      const d = lerDisp(); d[k] = v;
      try { localStorage.setItem(CH_DISP, JSON.stringify(d)); } catch { /* sem storage */ }
      aplicarDisp();

    }
  };
  aplicarDisp();

  /* Páginas que nunca ficam atrás do PIN (entrada, cadastro, emergência…) */
  const LIVRES = ["index.html", "login.html", "cadastro.html", "completar-cadastro.html", "recuperar-senha.html", "verificacao.html", "emergencia.html", "neutro.html", "boas-vindas.html", "termos.html", "politica.html"];
  const arquivo = location.pathname.split("/").pop() || "index.html";
  window.Violet.paginaLivre = LIVRES.includes(arquivo);
  const desbloqueada = () => { try { return sessionStorage.getItem("violet:desbloqueado") === "1"; } catch { return false; } };
  window.Violet.precisaPin = () => !window.Violet.paginaLivre && !!window.Violet.disp.get("pin_hash", null) && !desbloqueada();
  if (window.Violet.precisaPin()) raiz.classList.add("is-locked");   // esconde o conteúdo até digitar o PIN

  /* PIN: guardamos só o hash (SHA-256), nunca os números */
  window.Violet.hashPin = async (pin) => {
    try {
      const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("violet:" + pin));
      return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
    } catch { return "x" + btoa("violet:" + pin); }
  };

  aplicar(ler());
  sistema.addEventListener("change", () => { if (ler() === "auto") aplicar("auto"); });
  document.addEventListener("DOMContentLoaded", () => aplicar(ler()));
  document.addEventListener("click", (e) => { if (e.target.closest("[data-theme-toggle]")) tema.alternar(); });
})();
