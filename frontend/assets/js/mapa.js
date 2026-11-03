/* ==========================================================
   VIOLET — Mapa do campus (ilustrativo)
   Um mapa simples em SVG, usado em Pontos seguros, Círculo de Apoio e na tela do grupo.
   Para outra instituição, é só trocar os dados em Violet.campus (nome, lugares e posições).

   Violet.campus            → { nome, lugares: [...] }
   Violet.lugarPorNome(txt) → acha o lugar pelo nome digitado ("Portaria principal do CEUB" → portaria)
   Violet.mapaCampus(el, { selecionado, onSelect, rota: [idA, idB], tipos: ["seguranca", ...] })
   ========================================================== */
(function () {
  const V = (window.Violet = window.Violet || {});

  const TIPOS = {
    seguranca: { nome: "Segurança", cor: "var(--violet-600)" },
    apoio: { nome: "Apoio", cor: "var(--orchid-500)" },
    transporte: { nome: "Transporte", cor: "var(--success-600)" },
    convivencia: { nome: "Convivência", cor: "var(--warning-600)" }
  };

  /* Posições no desenho (viewBox 360 × 400). x, y, w, h = o prédio; dentro = true quando é dentro do campus. */
  const LUGARES = [
    { id: "bloco9", nome: "Bloco 9", rotulo: "Bloco 9", tipo: "convivencia", x: 22, y: 30, w: 96, h: 58, chaves: ["bloco 9"], hora: "até 22 h",
      desc: "Salas de aula. Saída com movimento até o fim da noite." },
    { id: "g2", nome: "Estacionamento G2", rotulo: "Estac. G2", tipo: "convivencia", x: 244, y: 30, w: 94, h: 58, chaves: ["estacionamento", "g2"], hora: "noite",
      desc: "Área aberta. Evite ir sozinha à noite: combine o trajeto pelo Círculo de Apoio." },
    { id: "biblioteca", nome: "Biblioteca central", rotulo: "Biblioteca", tipo: "seguranca", x: 22, y: 124, w: 104, h: 66, chaves: ["biblioteca"], hora: "até 22 h",
      desc: "Ambiente com movimento e atendentes até o fim do expediente." },
    { id: "nucleo", nome: "Núcleo de Apoio", rotulo: "Núcleo", tipo: "apoio", x: 150, y: 124, w: 82, h: 66, chaves: ["núcleo", "nucleo"], hora: "horário comercial",
      desc: "Apoio psicológico, jurídico e social. Procure presencialmente." },
    { id: "bloco3", nome: "Bloco 3 — saída lateral", rotulo: "Bloco 3", tipo: "seguranca", x: 256, y: 124, w: 82, h: 86, chaves: ["bloco 3"], hora: "noite",
      desc: "Ponto de encontro dos grupos do Círculo de Apoio." },
    { id: "cantina", nome: "Cantina", rotulo: "Cantina", tipo: "convivencia", x: 22, y: 226, w: 84, h: 52, chaves: ["cantina"], hora: "até 21 h",
      desc: "Local movimentado e iluminado para esperar o grupo." },
    { id: "portaria", nome: "Portaria principal", rotulo: "Portaria", tipo: "seguranca", x: 138, y: 318, w: 86, h: 42, chaves: ["portaria"], hora: "24 h",
      desc: "Segurança patrimonial 24 h. Peça acompanhamento até o transporte." },
    { id: "onibus", nome: "Ponto de ônibus W3", rotulo: "Ônibus W3", tipo: "transporte", cx: 300, cy: 352, r: 17, chaves: ["w3", "ônibus", "onibus", "parada"], hora: "linhas até 23 h",
      desc: "Parada em frente ao campus, com iluminação pública." },
    { id: "metro", nome: "Metrô 112 Sul", rotulo: "Metrô", tipo: "transporte", cx: 62, cy: 352, r: 17, chaves: ["metrô", "metro"], hora: "até 23 h",
      desc: "Estação mais próxima. Siga em grupo pelo caminho iluminado." }
  ];

  const centro = (l) => (l.cx != null ? { x: l.cx, y: l.cy } : { x: l.x + l.w / 2, y: l.y + l.h / 2 });
  const semAcento = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  V.campus = { nome: "Campus (exemplo da demonstração)", tipos: TIPOS, lugares: LUGARES };

  V.lugarPorNome = (texto) => {
    const t = semAcento(texto);
    if (!t.trim()) return null;
    return LUGARES.find((l) => t.includes(semAcento(l.nome)) || l.chaves.some((c) => t.includes(semAcento(c)))) || null;
  };

  V.mapaCampus = function (el, opcoes = {}) {
    const { selecionado = null, onSelect = null, rota = null, tipos = null } = opcoes;
    const visiveis = (l) => !tipos || tipos.includes(l.tipo);
    const [a, b] = (rota || []).map((id) => LUGARES.find((l) => l.id === id));

    const construcao = (l) => {
      const ativo = l.id === selecionado || (rota && rota.includes(l.id));
      const cls = `mapa__lugar mapa__lugar--${l.tipo}${ativo ? " is-ativo" : ""}${visiveis(l) ? "" : " is-apagado"}`;
      const rotulo = l.rotulo.length > 12 && l.w && l.w < 90 ? l.rotulo.replace(" ", " ") : l.rotulo;
      const corpo = l.cx != null
        ? `<circle cx="${l.cx}" cy="${l.cy}" r="${l.r}" class="mapa__forma"/><text x="${l.cx}" y="${l.cy + 3.5}" class="mapa__txt" text-anchor="middle">${l.id === "metro" ? "M" : "W3"}</text>
           <text x="${l.cx}" y="${l.cy + l.r + 13}" class="mapa__rot" text-anchor="middle">${rotulo}</text>`
        : `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="10" class="mapa__forma"/>
           <text x="${l.x + l.w / 2}" y="${l.y + l.h / 2 + 3.5}" class="mapa__txt" text-anchor="middle">${rotulo}</text>`;
      return `<g class="${cls}" data-lugar="${l.id}" role="button" tabindex="0" aria-label="${l.nome}" aria-pressed="${ativo}">${corpo}</g>`;
    };

    let linha = "";
    if (a && b) {
      const p = centro(a), q = centro(b);
      linha = `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="mapa__rota"/>
        <circle cx="${p.x}" cy="${p.y}" r="9" class="mapa__ab"/><text x="${p.x}" y="${p.y + 3.5}" class="mapa__abtxt" text-anchor="middle">A</text>
        <circle cx="${q.x}" cy="${q.y}" r="9" class="mapa__ab mapa__ab--b"/><text x="${q.x}" y="${q.y + 3.5}" class="mapa__abtxt" text-anchor="middle">B</text>`;
    }

    el.innerHTML = `
      <svg viewBox="0 0 360 400" class="mapa__svg" role="group" aria-label="Mapa ilustrativo do campus">
        <rect x="0" y="0" width="360" height="400" class="mapa__rua"/>
        <rect x="8" y="8" width="344" height="306" rx="22" class="mapa__campus"/>
        <rect x="172" y="14" width="16" height="300" class="mapa__via"/>
        <rect x="14" y="98" width="332" height="16" class="mapa__via"/>
        <rect x="14" y="200" width="332" height="16" class="mapa__via"/>
        <rect x="172" y="300" width="16" height="30" class="mapa__via"/>
        <rect x="8" y="330" width="344" height="12" class="mapa__via mapa__via--rua"/>
        <text x="180" y="391" class="mapa__rot" text-anchor="middle">Rua de acesso</text>
        ${LUGARES.map(construcao).join("")}
        ${linha}
      </svg>`;

    const escolher = (id) => { if (onSelect) onSelect(LUGARES.find((l) => l.id === id)); };
    el.querySelectorAll("[data-lugar]").forEach((g) => {
      g.addEventListener("click", () => escolher(g.dataset.lugar));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(g.dataset.lugar); } });
    });
  };
})();
