/* VIOLET — Encontrar outras usuárias: buscar, enviar pedido de conexão e responder pedidos recebidos */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, icon, initials, toast } = window.Violet;
  const $ = (id) => document.getElementById(id);
  const MIN = 3;
  const campo = $("q"), resultados = $("resultados"), pedidos = $("pedidos"), pedidosLista = $("pedidos-lista");
  let achadas = [];          // resultado da última busca
  let seq = 0, timer;

  const avatar = (p) => `<span class="avatar" data-tone="${p.tone}">${esc(initials(p.nome))}</span>`;
  const botao = (acao, id, rotulo, tipo = "primary", extra = "") =>
    `<button type="button" class="btn btn--${tipo} btn--sm" data-acao="${acao}" data-id="${id}" ${extra}>${rotulo}</button>`;

  /* ---------- Avisos sobre a minha própria privacidade ---------- */
  api.obterPreferencias().then((p) => {
    const aviso = $("aviso-privacidade");
    if (p && p.modo_anonimo) {
      aviso.innerHTML = `${icon("incognito", "sm")}<span>Você está no <b>modo anônimo</b>: não aparece na busca e não envia pedidos. Para mudar, vá em <a href="configuracoes.html">Configurações</a>.</span>`;
      aviso.hidden = false;
    } else if (p && p.priv_perfil && p.priv_perfil !== "verificadas") {
      aviso.innerHTML = `${icon("info", "sm")}<span>Seu perfil está oculto para a busca, então outras usuárias não te encontram. Para mudar, abra <a href="configuracoes.html">Configurações</a> › Privacidade › Perfil e escolha “Usuárias verificadas do Violet”.</span>`;
      aviso.hidden = false;
    }
  }).catch(() => {});

  /* ---------- Resultado da busca ---------- */
  const acaoDe = (p) => {
    if (p.relacao === "conectadas" && p.conversa_id) return botao("conversar", p.conversa_id, "Conversar");
    if (p.relacao === "enviada") return botao("nada", p.id, "Pedido enviado", "soft", "disabled");
    if (p.relacao === "recebida") return botao("aceitar", p.conexao_id, "Aceitar");
    return botao("pedir", p.id, `${icon("plus", "sm")} Adicionar`);
  };
  const linha = (p) => `
    <div class="pessoa" data-pessoa="${p.id}">
      ${avatar(p)}
      <div class="pessoa__corpo"><div class="pessoa__nome">${esc(p.nome)}</div><div class="pessoa__sub">Usuária do Violet</div></div>
      <div class="pessoa__acoes">${acaoDe(p)}</div>
    </div>`;

  const comoFunciona = () => `
    <div class="achar__como">
      <b>Como funciona</b>
      <ul>
        <li>${icon("search", "sm")}<span>Digite pelo menos ${MIN} letras do nome ou do apelido.</span></li>
        <li>${icon("heart", "sm")}<span>Você envia um pedido e, quando ela aceitar, vocês podem conversar.</span></li>
        <li>${icon("lock", "sm")}<span>Só aparecem usuárias verificadas que deixaram o perfil visível. Quem está no modo anônimo não aparece.</span></li>
      </ul>
    </div>`;
  const semResultado = () => `
    <div class="achar__vazio"><span class="home-convos__art">${icon("search")}</span><b>Ninguém encontrada</b>
      <span>Confira o nome ou o apelido. Ela só aparece se deixou o perfil visível para usuárias verificadas.</span></div>`;

  const desenhar = () => { resultados.innerHTML = achadas.length ? achadas.map(linha).join("") : semResultado(); };

  const buscar = async () => {
    const q = campo.value.trim();
    const minha = ++seq;
    if (q.length < MIN) { achadas = []; resultados.innerHTML = comoFunciona(); return; }
    resultados.innerHTML = `<p class="text-sm text-muted text-center">Buscando…</p>`;
    try {
      const r = await api.buscarUsuarias(q);
      if (minha !== seq) return;                 // chegou uma busca mais nova: ignora esta
      achadas = r || [];
      desenhar();
    } catch (err) {
      if (minha !== seq) return;
      resultados.innerHTML = "";
      toast(err.message);
    }
  };
  campo.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(buscar, 350); });

  /* ---------- Pedidos recebidos ---------- */
  const linhaPedido = (c) => `
    <div class="pessoa pessoa--pedido" data-pedido="${c.id}">
      ${avatar(c.pessoa)}
      <div class="pessoa__corpo"><div class="pessoa__nome">${esc(c.pessoa.nome)}</div><div class="pessoa__sub">quer se conectar</div></div>
      <div class="pessoa__acoes">${botao("aceitar", c.id, "Aceitar")}${botao("recusar", c.id, "Recusar", "soft")}</div>
    </div>`;
  const carregarPedidos = async () => {
    try {
      const lista = (await api.listarConexoes("recebidas")) || [];
      pedidos.hidden = !lista.length;
      pedidosLista.innerHTML = lista.map(linhaPedido).join("");
      if (lista.length && location.hash === "#pedidos") pedidos.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch { /* sem pedidos por enquanto */ }
  };

  /* ---------- Cliques nos botões ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-acao]");
    if (!b || b.disabled) return;
    const { acao, id } = b.dataset;
    if (acao === "conversar") { location.href = `chat.html?id=${id}`; return; }
    b.disabled = true;
    try {
      if (acao === "pedir") {
        const r = await api.pedirConexao(Number(id));
        const p = achadas.find((x) => String(x.id) === String(id));
        if (p) { p.relacao = r.status === "aceita" ? "conectadas" : "enviada"; p.conversa_id = r.conversa_id; }
        toast(r.status === "aceita" ? "Vocês agora estão conectadas! 💜" : "Pedido enviado 💜");
        desenhar();
      } else if (acao === "aceitar") {
        const r = await api.aceitarConexao(id);
        toast("Pronto! Vocês já podem conversar 💜");
        const linhaEl = b.closest("[data-pedido]");
        if (linhaEl) linhaEl.querySelector(".pessoa__acoes").innerHTML = botao("conversar", r.conversa_id, "Conversar");
        const p = achadas.find((x) => String(x.conexao_id) === String(id));
        if (p) { p.relacao = "conectadas"; p.conversa_id = r.conversa_id; desenhar(); }
      } else if (acao === "recusar") {
        await api.recusarConexao(id);
        b.closest("[data-pedido]")?.remove();
        if (!pedidosLista.children.length) pedidos.hidden = true;
      }
    } catch (err) { toast(err.message); b.disabled = false; }
  });

  resultados.innerHTML = comoFunciona();
  carregarPedidos();
});
