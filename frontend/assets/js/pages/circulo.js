/* VIOLET — Círculo de Apoio (RQ011)
   circulo.html        → usuárias próximas, grupos sugeridos, meus grupos, pedidos de acompanhamento
   circulo-criar.html  → criar grupo de trajeto
   circulo-grupo.html  → detalhes, entrar/sair, compartilhar localização por tempo limitado */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, initials, icon, toast, qs, validate, loading, openSheet, closeSheet, irPara } = window.Violet;

  /* ---------- Utilidades ---------- */
  const quando = (iso) => {
    const d = new Date(iso);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    const diff = Math.round((dia - hoje) / 86400e3);
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const rotulo = diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    return `${rotulo} · ${hora}`;
  };
  const avatares = (ps) => `<span class="avatars">${ps.slice(0, 4).map((p) =>
    `<span class="avatar ${p.eu ? "avatar--you" : ""}" data-tone="${p.tone}" title="${esc(p.nome)}">${p.eu ? "EU" : initials(p.nome)}</span>`).join("")}</span>`;
  const rota = (g) => `<div class="route"><span>${esc(g.ponto)}<small>Ponto de encontro</small></span><span>${esc(g.destino)}<small>Destino</small></span></div>`;

  /* Contagem regressiva do compartilhamento de localização */
  let timer;
  function contagem(el, expira, aoTerminar) {
    clearInterval(timer);
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(expira) - Date.now()) / 1000));
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      if (s === 0) { clearInterval(timer); aoTerminar?.(); }
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  /* =====================================================
     HUB (circulo.html)
     ===================================================== */
  const listaEl = document.getElementById("lista-circulo");
  if (listaEl) {
    const mapa = document.getElementById("mapa");
    const cardShare = document.getElementById("card-compartilhando");
    let minutos = 30;

    async function pintarLocalizacao() {
      const c = await api.obterCompartilhamento();
      const ativo = !!c;
      mapa.classList.toggle("map-preview--blur", !ativo);
      document.getElementById("map-lock").hidden = ativo;
      document.getElementById("map-badge").hidden = !ativo;
      cardShare.hidden = !ativo;
      if (ativo) {
        const { total } = await api.usuariasProximas();
        document.getElementById("proximas").textContent = `${total} usuárias verificadas por perto`;
        contagem(document.getElementById("countdown"), c.expira_em, pintarLocalizacao);
      }
    }
    await pintarLocalizacao();

    document.getElementById("btn-autorizar").addEventListener("click", () => openSheet("sheet-autorizar"));
    document.querySelectorAll("[data-min]").forEach((b) => b.addEventListener("click", () => {
      minutos = Number(b.dataset.min);
      document.querySelectorAll("[data-min]").forEach((x) => x.classList.toggle("is-active", x === b));
    }));
    document.getElementById("confirmar-autorizar").addEventListener("click", async () => {
      await api.autorizarLocalizacao({ minutos });
      closeSheet("sheet-autorizar");
      toast(`Localização compartilhada por ${minutos >= 60 ? minutos / 60 + " h" : minutos + " min"}.`);
      pintarLocalizacao();
    });
    document.getElementById("btn-mais")?.addEventListener("click", async () => {
      try { await Violet.estenderLocalizacao(30); toast("Mais 30 minutos de localização."); } catch (e) { toast(e.message); }
      pintarLocalizacao();
    });
    document.getElementById("btn-encerrar").addEventListener("click", async () => {
      await api.encerrarLocalizacao();
      clearInterval(timer);
      toast("Compartilhamento encerrado.");
      pintarLocalizacao();
    });

    /* Abas */
    let aba = "sugeridos";
    const busca = document.getElementById("busca");
    const solicitacoes = await api.listarSolicitacoes();
    const qtd = document.getElementById("qtd-solicitacoes");
    const pintarQtd = (n) => { qtd.textContent = n; qtd.hidden = !n; };
    pintarQtd(solicitacoes.length);

    /* Lugares do campus (o mesmo mapa de Pontos seguros) */
    const mapaHub = document.getElementById("mapa-hub");
    if (mapaHub && window.Violet.mapaCampus) {
      const pintarHub = (l) => {
        Violet.mapaCampus(mapaHub, { selecionado: l && l.id, onSelect: pintarHub });
        document.getElementById("mapa-hub-detalhe").innerHTML = l ? `
          <div class="row-between"><h4>${esc(l.nome)}</h4><span class="badge">${esc(l.hora)}</span></div>
          <p class="text-sm">${esc(l.desc)}</p>
          <a class="btn btn--primary btn--sm" href="circulo-criar.html?ponto=${encodeURIComponent(l.nome)}">${icon("users", "sm")} Combinar trajeto daqui</a>` : "";
      };
      pintarHub(null);
    }

    async function desenhar() {
      if (aba === "solicitacoes") return desenharSolicitacoes();
      const grupos = (await api.listarGrupos({ busca: busca.value }))
        .filter((g) => (aba === "meus" ? g.membro : !g.membro));
      if (!grupos.length) {
        listaEl.innerHTML = `<div class="empty"><span class="icon-badge icon-badge--round">${icon(aba === "meus" ? "users" : "search")}</span>
          <p>${aba === "meus" ? "Você ainda não está em nenhum grupo." : "Nenhum grupo para esse destino ainda."}</p>
          <a href="circulo-criar.html" class="link">Criar um grupo</a></div>`;
        return;
      }
      listaEl.innerHTML = grupos.map((g) => `
        <a href="circulo-grupo.html?id=${g.id}" class="card group-card">
          <div class="group-card__head">
            <div>
              <span class="group-card__when">${icon("clock", "sm")} ${quando(g.horario)}</span>
              <h4 style="margin-top:4px">${esc(g.nome)}</h4>
            </div>
            ${g.compativel && aba === "sugeridos" ? '<span class="badge">Compatível</span>' : ""}
            ${g.minha ? '<span class="badge">Criado por você</span>' : ""}
          </div>
          ${rota(g)}
          <div class="row-between">
            <div class="row" style="gap:var(--sp-2)">${avatares(g.participantes)}
              <span class="text-xs text-muted">${g.participantes.length}/${g.vagas} vagas</span></div>
            <span class="text-xs text-muted">${icon("map-pin", "sm")}</span>
          </div>
        </a>`).join("");
    }

    function desenharSolicitacoes() {
      api.listarSolicitacoes().then((lista) => {
        pintarQtd(lista.length);
        listaEl.innerHTML = lista.length ? lista.map((s) => `
          <div class="card stack-sm" data-sol="${s.id}">
            <div class="row">
              <span class="avatar" data-tone="${s.tone}">${initials(s.nome)}</span>
              <div class="grow">
                <div class="list-item__title">${esc(s.nome)} quer te acompanhar</div>
                <div class="list-item__sub">${esc(s.curso)} · ${esc(s.tempo)}</div>
              </div>
            </div>
            <div class="row text-sm text-muted" style="gap:6px">${icon("flag", "sm")} Indo para ${esc(s.destino)}</div>
            <div class="row">
              <button class="btn btn--soft btn--sm grow" data-resp="0">Recusar</button>
              <button class="btn btn--primary btn--sm grow" data-resp="1">Aceitar</button>
            </div>
          </div>`).join("") : `<div class="empty"><span class="icon-badge icon-badge--round">${icon("hand-heart")}</span><p>Nenhum pedido de acompanhamento.</p></div>`;
      });
    }

    listaEl.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-resp]");
      if (!b) return;
      const card = b.closest("[data-sol]");
      const aceita = b.dataset.resp === "1";
      await api.responderSolicitacao(Number(card.dataset.sol), aceita);
      toast(aceita ? "Pedido aceito. Combinem o encontro pelas conversas." : "Pedido recusado.");
      desenharSolicitacoes();
    });

    document.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => {
      aba = b.dataset.aba;
      document.querySelectorAll("[data-aba]").forEach((x) => { x.classList.toggle("is-active", x === b); x.setAttribute("aria-selected", x === b); });
      busca.parentElement.hidden = aba === "solicitacoes";
      desenhar();
    }));
    let espera;
    busca.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(desenhar, 200); });
    desenhar();
  }

  /* =====================================================
     CRIAR (circulo-criar.html)
     ===================================================== */
  const form = document.getElementById("form-grupo");
  if (form) {
    const hoje = new Date();
    form.data.min = hoje.toISOString().slice(0, 10);
    form.data.value = form.data.min;
    let vagas = 5;
    const out = document.getElementById("vagas");
    document.querySelectorAll("[data-vagas]").forEach((b) => b.addEventListener("click", () => {
      vagas = Math.min(10, Math.max(2, vagas + Number(b.dataset.vagas)));
      out.textContent = vagas;
    }));
    // Veio de "Pontos seguros"/Círculo com um lugar já escolhido
    if (qs("ponto")) form.ponto.value = qs("ponto");
    // Escolher o ponto de encontro ou o destino no mapa do campus
    let alvoMapa = null, lugarMapa = null;
    const pintarEscolha = () => {
      Violet.mapaCampus(document.getElementById("mapa-escolha"), { selecionado: lugarMapa && lugarMapa.id, onSelect: (l) => { lugarMapa = l; pintarEscolha(); } });
      document.getElementById("mapa-nome").textContent = lugarMapa ? `${lugarMapa.nome} — ${lugarMapa.desc}` : "Toque em um lugar do mapa.";
      document.getElementById("mapa-ok").disabled = !lugarMapa;
    };
    document.querySelectorAll("[data-mapa]").forEach((b) => b.addEventListener("click", () => {
      alvoMapa = b.dataset.mapa;
      document.getElementById("mapa-titulo").textContent = alvoMapa === "ponto" ? "Ponto de encontro" : "Destino";
      lugarMapa = Violet.lugarPorNome(form[alvoMapa].value);
      pintarEscolha(); openSheet("sheet-mapa");
    }));
    document.getElementById("mapa-ok").addEventListener("click", () => {
      if (!lugarMapa || !alvoMapa) return;
      form[alvoMapa].value = lugarMapa.nome;
      closeSheet("sheet-mapa");
    });
    const erroPassado = document.getElementById("erro-passado");
    erroPassado.style.display = "none";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      const horario = new Date(`${form.data.value}T${form.hora.value}`);
      if (horario <= new Date()) { erroPassado.style.display = "block"; return; }
      erroPassado.style.display = "none";
      const btn = form.querySelector("[type=submit]");
      loading(btn, true, "Criando…");
      try {
        const g = await api.criarGrupo({
          nome: form.nome.value.trim(), ponto: form.ponto.value.trim(), destino: form.destino.value.trim(),
          horario: horario.toISOString(), vagas,
          compartilhar_localizacao: document.getElementById("compartilhar").checked
        });
        toast("Grupo criado! Vamos avisar quando alguém entrar.");
        setTimeout(() => irPara(`circulo-grupo.html?id=${g.id}`), 600);
      } catch (err) { loading(btn, false); toast(err.message); }
    });
  }

  /* =====================================================
     DETALHE (circulo-grupo.html)
     ===================================================== */
  const conteudo = document.getElementById("conteudo");
  if (conteudo && document.getElementById("sheet-sair")) {
    const id = qs("id") || "1";
    let timerTrajeto;

    async function desenharGrupo() {
      const g = await api.obterGrupo(id);
      if (!g) { conteudo.innerHTML = `<div class="empty"><p>Grupo não encontrado.</p><a class="link" href="circulo.html">Voltar ao Círculo</a></div>`; return; }
      document.title = `${g.nome} · Violet`;
      const c = await api.obterCompartilhamento();
      const compartilhando = c && String(c.grupo) === String(g.id);
      const trajeto = await api.obterTrajeto();
      const trajetoAtivo = !!(trajeto && String(trajeto.grupo) === String(g.id));
      const lugarPonto = window.Violet.lugarPorNome ? Violet.lugarPorNome(g.ponto) : null;
      const lugarDestino = window.Violet.lugarPorNome ? Violet.lugarPorNome(g.destino) : null;
      const lotado = g.participantes.length >= g.vagas;
      const pct = Math.round((g.participantes.length / g.vagas) * 100);

      conteudo.innerHTML = `
        <section class="card group-hero stack">
          <span class="row text-sm" style="gap:6px;opacity:.9">${icon("clock", "sm")} ${quando(g.horario)}</span>
          <h2>${esc(g.nome)}</h2>
          ${rota(g)}
        </section>
        ${lugarPonto || lugarDestino ? `
        <section class="card stack-sm">
          <h4>Trajeto no mapa</h4>
          <div class="mapa" id="mapa-grupo"></div>
          <p class="text-xs text-muted">${lugarPonto ? `A: ${esc(lugarPonto.nome)}` : ""}${lugarPonto && lugarDestino ? " · " : ""}${lugarDestino ? `B: ${esc(lugarDestino.nome)}` : ""}</p>
        </section>` : ""}

        <section class="card stack-sm">
          <div class="row-between"><h4>Participantes</h4><span class="text-sm text-muted">${g.participantes.length} de ${g.vagas}</span></div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="list" style="margin-top:var(--sp-2)">
            ${g.participantes.map((p) => `
              <div class="row">
                <span class="avatar avatar--sm ${p.eu ? "avatar--you" : ""}" data-tone="${p.tone}" ${p.eu ? 'style="background:var(--grad-primary);color:#fff"' : ""}>${p.eu ? "EU" : initials(p.nome)}</span>
                <span class="grow fw-600 text-sm">${esc(p.nome)}${g.minha && p.eu ? ' <span class="text-xs text-muted">· criadora</span>' : ""}</span>
                <span class="badge badge--success">${icon("shield-check", "sm")} Verificada</span>
                ${g.minha && !p.eu ? `<button type="button" class="icon-btn" data-remover="${esc(p.id ?? p.nome)}" data-nome="${esc(p.nome)}" aria-label="Remover ${esc(p.nome)} do grupo" style="color:var(--danger)">${icon("trash", "sm")}</button>` : ""}
              </div>`).join("")}
          </div>
        </section>

        ${g.membro ? `
          <div class="stack-sm">
            ${trajetoAtivo
              ? `<div class="card share-card stack-sm" id="card-trajeto">
                   <div class="row"><span class="icon-badge">${icon("route")}</span>
                     <div class="grow"><div class="list-item__title">Trajeto em andamento</div><div class="list-item__sub">O grupo vê sua localização. Confirme quando chegar; sem confirmação, avisamos sua rede em</div></div>
                     <span class="countdown" id="countdown-trajeto">--:--</span></div>
                   <button class="btn btn--primary" id="btn-cheguei">${icon("check-circle", "sm")} Cheguei bem</button>
                 </div>`
              : `<div class="card stack-sm" id="card-trajeto">
                   <div class="row"><span class="icon-badge">${icon("route")}</span>
                     <div class="grow"><div class="list-item__title">Trajeto seguro</div><div class="list-item__sub">Compartilha sua localização com o grupo durante o trajeto. Se você não confirmar que chegou, sua rede é avisada.</div></div></div>
                   ${compartilhando ? `<div class="row share-card" style="padding:var(--sp-3);border-radius:var(--r-md)"><div class="grow"><div class="list-item__title">Localização ativa</div><div class="list-item__sub">Encerra em</div></div><span class="countdown" id="countdown">--:--</span><button class="btn btn--soft btn--sm" id="btn-mais">+30 min</button><button class="btn btn--soft btn--sm" id="btn-parar">Encerrar</button></div>` : ""}
                   <div class="duration">${[[900, "15 min"], [1800, "30 min"], [3600, "1 h"], [20, "20 s (demo)"]].map(([sg, t]) => `<button class="chip ${sg === 1800 ? "is-active" : ""}" data-prazo="${sg}">${t}</button>`).join("")}</div>
                   <button class="btn btn--primary" id="btn-trajeto">Iniciar trajeto</button>
                 </div>`}
            <a class="btn btn--soft" href="chat.html?id=g${g.id}">${icon("message", "sm")} Conversar com o grupo</a>
            <button class="btn btn--ghost" id="btn-sair" style="color:var(--danger-600)">${icon("log-out", "sm")} Sair do grupo</button>
            ${g.minha ? `<button class="btn btn--ghost" id="btn-excluir-grupo" style="color:var(--danger-600)">${icon("trash", "sm")} Excluir grupo</button>` : ""}
          </div>`
        : `
          <div class="callout"><i data-icon="shield-check"></i><span>Todas as participantes têm identidade verificada. Ao entrar, elas verão apenas seu primeiro nome.</span></div>
          <button class="btn btn--primary" id="btn-entrar" ${lotado ? "disabled" : ""}>${lotado ? "Grupo lotado" : "Entrar no grupo"}</button>`}
      `;
      Violet.renderIcons(conteudo);
      const mapaGrupo = document.getElementById("mapa-grupo");
      if (mapaGrupo) Violet.mapaCampus(mapaGrupo, {
        selecionado: lugarPonto && lugarPonto.id,
        rota: lugarPonto && lugarDestino && lugarPonto.id !== lugarDestino.id ? [lugarPonto.id, lugarDestino.id] : null
      });

      if (compartilhando && !trajetoAtivo && document.getElementById("countdown")) contagem(document.getElementById("countdown"), c.expira_em, desenharGrupo);

      let minutos = 60;
      conteudo.querySelectorAll("[data-min]").forEach((b) => b.addEventListener("click", () => {
        minutos = Number(b.dataset.min);
        conteudo.querySelectorAll("[data-min]").forEach((x) => x.classList.toggle("is-active", x === b));
      }));
      document.getElementById("btn-local")?.addEventListener("click", async () => {
        await api.autorizarLocalizacao({ minutos, grupo: g.id });
        toast("Localização compartilhada com o grupo.");
        desenharGrupo();
      });
      document.getElementById("btn-mais")?.addEventListener("click", async () => {
        try { await Violet.estenderLocalizacao(30); toast("Mais 30 minutos de localização."); } catch (e) { toast(e.message); }
        desenharGrupo();
      });
      document.getElementById("btn-parar")?.addEventListener("click", async () => {
        await api.encerrarLocalizacao();
        clearInterval(timer);
        toast("Compartilhamento encerrado.");
        desenharGrupo();
      });
      document.getElementById("btn-entrar")?.addEventListener("click", async (e) => {
        loading(e.currentTarget, true, "Entrando…");
        try { await api.entrarGrupo(g.id); toast("Você entrou no grupo 💜"); }
        catch (err) { toast(err.message); }
        desenharGrupo();
      });
      let prazo = 1800;
      conversaPrazo();
      function conversaPrazo() {
        conteudo.querySelectorAll("[data-prazo]").forEach((b) => b.addEventListener("click", () => {
          prazo = Number(b.dataset.prazo);
          conteudo.querySelectorAll("[data-prazo]").forEach((x) => x.classList.toggle("is-active", x === b));
        }));
      }
      document.getElementById("btn-trajeto")?.addEventListener("click", async () => {
        await api.iniciarTrajeto({ grupo: g.id, nome: g.nome, segundos: prazo });
        // O trajeto já compartilha a localização com o grupo, pelo mesmo tempo
        const ja = await api.obterCompartilhamento();
        const quer = Math.max(1, Math.ceil(prazo / 60));
        const resta = ja ? Math.ceil((new Date(ja.expira_em) - Date.now()) / 60000) : 0;
        if (!ja || resta < quer || String(ja.grupo) !== String(g.id)) await api.autorizarLocalizacao({ minutos: quer, grupo: g.id });
        toast("Trajeto iniciado. Confirme quando chegar 💜");
        window.dispatchEvent(new Event("violet:trajeto"));
        desenharGrupo();
      });
      if (trajetoAtivo) {
        clearInterval(timerTrajeto);
        const el = document.getElementById("countdown-trajeto");
        const tick = () => {
          const sg = Math.max(0, Math.round((new Date(trajeto.limite_em) - Date.now()) / 1000));
          el.textContent = `${String(Math.floor(sg / 60)).padStart(2, "0")}:${String(sg % 60).padStart(2, "0")}`;
          if (sg === 0) clearInterval(timerTrajeto);
        };
        tick(); timerTrajeto = setInterval(tick, 1000);
      }
      document.getElementById("btn-cheguei")?.addEventListener("click", async () => {
        await api.confirmarChegada();
        clearInterval(timerTrajeto);
        if (c && String(c.grupo) === String(g.id)) { await api.encerrarLocalizacao(); clearInterval(timer); }
        toast("Avisamos o grupo que você chegou bem 💜");
        desenharGrupo();
      });
      document.getElementById("btn-sair")?.addEventListener("click", () => openSheet("sheet-sair"));
      document.getElementById("btn-excluir-grupo")?.addEventListener("click", async () => {
        if (!confirm(`Excluir o grupo “${g.nome}”? As participantes deixam de vê-lo e isso não pode ser desfeito.`)) return;
        try { await api.excluirGrupo(g.id); toast("Grupo excluído."); setTimeout(() => irPara("circulo.html"), 500); }
        catch (err) { toast(err.message); }
      });
      /* Só a criadora do trajeto vê estes botões (a API confere de novo) */
      conteudo.querySelectorAll("[data-remover]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm(`Remover ${b.dataset.nome} do grupo “${g.nome}”?`)) return;
        try { await api.removerParticipante("g" + g.id, b.dataset.remover); toast(`${b.dataset.nome} foi removida do grupo.`); }
        catch (err) { toast(err.message); }
        desenharGrupo();
      }));
    }

    window.addEventListener("violet:trajeto-fim", () => { clearInterval(timerTrajeto); clearInterval(timer); desenharGrupo(); });

    document.getElementById("confirmar-sair").addEventListener("click", async () => {
      await api.sairGrupo(id);
      const c = await api.obterCompartilhamento();
      if (c && String(c.grupo) === String(id)) await api.encerrarLocalizacao();
      closeSheet("sheet-sair");
      toast("Você saiu do grupo.");
      desenharGrupo();
    });
    document.getElementById("btn-compartilhar-link").addEventListener("click", () => toast("Convite disponível na fase de integrações."));

    desenharGrupo();
  }
});
