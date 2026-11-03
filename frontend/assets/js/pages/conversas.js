/* VIOLET — Conversas (Todas | Grupos) e chat */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, initials, icon, toast, qs, openSheet, closeSheet, loading } = window.Violet;

  const avatar = (c, extra = "") => c.tipo === "grupo"
    ? `<span class="avatar avatar--group ${extra}" data-tone="${c.tone}">${icon("users", "sm")}</span>`
    : `<span class="avatar ${extra}" data-tone="${c.tone}">${initials(c.nome)}${c.online ? '<span class="dot"></span>' : ""}</span>`;

  /* ---------- Lista ---------- */
  const listaEl = document.getElementById("lista-conversas");
  if (listaEl) {
    const bloqueadasLista = new Set((await api.listarBloqueadas()).map((b) => b.nome));
    const conversas = (await api.listarConversas()).filter((c) => c.tipo === "grupo" || !bloqueadasLista.has(c.nome));
    let filtro = "todas";
    const busca = document.getElementById("busca");

    /* "Online agora": só contatos disponíveis + atalho para criar grupo */
    const onlineEl = document.getElementById("online");
    const onlineLista = document.getElementById("online-lista");
    // O atalho tracejado para criar grupo fica sempre primeiro na faixa "Online agora".
    // A faixa aparece somente na aba Todas; na aba Grupos são exibidos exclusivamente grupos.
    const ordemOnline = ["Pam", "Valen", "Kirby"];
    const onlineAgora = conversas
      .filter((c) => c.tipo !== "grupo" && c.online)
      .sort((a, b) => {
        const ia = ordemOnline.indexOf(a.nome);
        const ib = ordemOnline.indexOf(b.nome);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    onlineLista.innerHTML = `
      <a href="grupo-criar.html" class="online__item online__item--novo" aria-label="Criar novo grupo">
        <span class="online__novo">${icon("plus", "md")}</span><span>Novo grupo</span>
      </a>` + onlineAgora.map((c) => `
      <a href="chat.html?id=${c.id}" class="online__item">
        <span class="online__ring">${avatar(c)}</span><span>${esc(c.nome)}</span>
      </a>`).join("");

    const vazio = () => filtro === "grupo" && !busca.value.trim()
      ? `<div class="empty empty--cute"><span class="empty__art">${icon("users", "lg")}</span>
           <p>Você ainda não entrou em nenhum grupo.</p>
           <div class="stack-sm"><a href="grupo-criar.html" class="btn btn--primary">Criar um grupo</a><a href="circulo.html" class="btn btn--soft">Encontrar círculos de apoio</a></div></div>`
      : `<div class="empty empty--cute"><span class="empty__art">${icon("heart", "lg")}</span><p>Nenhuma conversa encontrada.</p></div>`;

    const render = () => {
      const termo = busca.value.trim().toLowerCase();
      onlineEl.hidden = !(filtro === "todas" && !termo);
      const itens = conversas.filter((c) =>
        (filtro === "todas" ? c.tipo !== "grupo" : c.tipo === "grupo") &&
        (!termo || c.nome.toLowerCase().includes(termo) || c.ultima.toLowerCase().includes(termo)));
      listaEl.innerHTML = itens.length ? itens.map((c) => `
        <a href="chat.html?id=${c.id}" class="convo-item${c.nao_lidas ? " is-unread" : ""}">
          ${avatar(c, "convo-avatar")}
          <div class="grow convo-item__body">
            <div class="convo-item__top">
              <span class="convo-item__nome">${esc(c.nome)}</span>
              ${c.tipo === "grupo" ? `<span class="convo-tag${c.origem === "circulo" ? " convo-tag--circulo" : ""}">${c.origem === "circulo" ? "Círculo" : "Grupo"}</span>` : c.de_confianca === true ? `<span class="convo-tag convo-tag--circulo">Contato de confiança</span>` : ""}
            </div>
            <div class="convo-item__preview">${esc(c.ultima)}</div>
          </div>
          <div class="convo-item__meta">
            <span class="convo-item__hora">${esc(c.hora)}</span>
            ${c.nao_lidas ? `<span class="badge badge--count">${c.nao_lidas}</span>` : `<span class="convo-item__lida">${icon("check", "sm")}</span>`}
          </div>
        </a>`).join("") : vazio();
    };

    busca.addEventListener("input", render);
    document.querySelectorAll("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
      filtro = b.dataset.filtro;
      document.querySelectorAll("[data-filtro]").forEach((x) => { x.classList.toggle("is-active", x === b); x.setAttribute("aria-selected", x === b); });
      render();
    }));
    render();
  }

  /* ---------- Chat (conversa direta ou grupo) ---------- */
  const chat = document.getElementById("chat");
  if (chat) {
    const id = qs("id") || "4";
    const conversa = (await api.obterConversa(id)) || { nome: "Conversa", tone: 1 };
    const grupo = conversa.tipo === "grupo";
    document.title = `${conversa.nome} · Violet`;
    document.getElementById("chat-nome").textContent = conversa.nome;
    document.getElementById("chat-status").textContent = grupo
      ? `${conversa.membros} participantes`
      : conversa.online ? "Disponível" : "Visto recentemente";
    document.getElementById("chat-avatar").outerHTML = avatar(conversa, "avatar--sm");
    const editarGrupo = document.getElementById("editar-grupo");
    const excluirGrupo = document.getElementById("excluir-grupo");
    if (grupo && conversa.origem === "chat") {
      editarGrupo.hidden = false; excluirGrupo.hidden = false;
      editarGrupo.addEventListener("click", async () => {
        const nome = prompt("Novo nome do grupo:", conversa.nome);
        if (nome && nome.trim()) {
          try { await window.Violet.api.atualizarGrupoConversa(id, { nome: nome.trim() }); toast("Nome do grupo atualizado."); setTimeout(() => (location.href = "conversas.html"), 500); }
          catch (err) { toast(err.message); }
        }
      });
      excluirGrupo.addEventListener("click", async () => {
        if (!confirm(`Excluir o grupo “${conversa.nome}”? Essa ação não pode ser desfeita.`)) return;
        try { await window.Violet.api.excluirGrupoConversa(id); toast("Grupo excluído."); setTimeout(() => (location.href = "conversas.html"), 500); }
        catch (err) { toast(err.message); }
      });
    }

    /* Grupo do Círculo de Apoio: qualquer participante sai; só a criadora exclui */
    if (grupo && conversa.origem === "circulo") {
      const sairGrupo = document.getElementById("sair-grupo");
      sairGrupo.hidden = false;
      sairGrupo.addEventListener("click", async () => {
        if (!confirm(`Sair do grupo “${conversa.nome}”?`)) return;
        try { await api.sairGrupo(conversa.grupo_id); toast("Você saiu do grupo."); setTimeout(() => (location.href = "conversas.html"), 500); }
        catch (err) { toast(err.message); }
      });
      if (conversa.criadora) {
        excluirGrupo.hidden = false;
        excluirGrupo.addEventListener("click", async () => {
          if (!confirm(`Excluir o grupo “${conversa.nome}”? Essa ação não pode ser desfeita.`)) return;
          try { await api.excluirGrupo(conversa.grupo_id); toast("Grupo excluído."); setTimeout(() => (location.href = "conversas.html"), 500); }
          catch (err) { toast(err.message); }
        });
      }
    }

    /* ---------- Proteção: bloquear, denunciar e participantes ---------- */
    const $ = (i) => document.getElementById(i);
    let bloqueadas = new Set((await api.listarBloqueadas()).map((b) => b.nome));
    let alvo = null;                       // quem está sendo bloqueada/denunciada agora ({ nome })
    const membrosLista = () => conversa.participantes || [];
    $("chat-tag").hidden = grupo || !conversa.de_confianca;
    $("btn-bloquear").hidden = grupo;
    $("btn-membros").hidden = !(grupo && membrosLista().length);
    $("txt-denunciar").textContent = grupo ? "Denunciar grupo" : "Denunciar usuária";

    const estaBloqueada = () => !grupo && bloqueadas.has(conversa.nome);
    function pintarBloqueio() {
      const bloq = estaBloqueada();
      $("btn-bloquear").querySelector(".grow").textContent = bloq ? "Desbloquear usuária" : "Bloquear usuária";
      $("msg").disabled = bloq;
      $("msg").placeholder = bloq ? "Você bloqueou esta usuária" : "Escreva uma mensagem…";
      $("composer").querySelector(".send").disabled = bloq;
    }
    pintarBloqueio();

    const motivos = (alvoNome) => alvoNome
      ? [["ofensa", "Mensagens ofensivas ou ameaças"], ["assedio", "Assédio ou insistência"], ["falso", "Perfil falso ou que não é mulher"], ["spam", "Spam ou propaganda"], ["outro", "Outro motivo"]]
      : [["ofensa", "Conversas ofensivas ou ameaçadoras"], ["assedio", "Assédio dentro do grupo"], ["falso", "Participantes com perfil falso"], ["spam", "Spam ou propaganda"], ["outro", "Outro motivo"]];

    function abrirDenuncia(a) {
      alvo = a;
      $("den-titulo").textContent = a ? `Denunciar ${a.nome}` : `Denunciar grupo “${conversa.nome}”`;
      $("den-motivos").innerHTML = motivos(a && a.nome).map(([v, t]) => `
        <button type="button" class="choice" role="radio" aria-checked="false" data-valor="${v}" data-texto="${esc(t)}">
          <span class="grow">${esc(t)}</span><span class="choice__mark" aria-hidden="true">${icon("check", "sm")}</span>
        </button>`).join("");
      $("den-detalhe").value = "";
      $("den-bloquear").checked = false;
      $("den-bloquear-wrap").hidden = !a || bloqueadas.has(a.nome);
      closeSheet("sheet-opcoes"); closeSheet("sheet-membros");
      openSheet("sheet-denunciar");
    }
    $("den-motivos").addEventListener("click", (e) => {
      const op = e.target.closest(".choice"); if (!op) return;
      $("den-motivos").querySelectorAll(".choice").forEach((c) => { c.classList.toggle("is-checked", c === op); c.setAttribute("aria-checked", c === op); });
    });
    $("den-enviar").addEventListener("click", async () => {
      const escolhido = $("den-motivos").querySelector(".choice.is-checked");
      if (!escolhido) return toast("Escolha um motivo para continuar.");
      const btn = $("den-enviar");
      loading(btn, true, "Enviando…");
      try {
        const r = await api.denunciarUsuaria({ nome: alvo ? alvo.nome : null, motivo: escolhido.dataset.texto, detalhe: $("den-detalhe").value.trim(), onde: conversa.nome });
        if (alvo && $("den-bloquear").checked) await bloquear(alvo.nome, false);
        closeSheet("sheet-denunciar");
        toast(`Denúncia enviada. Protocolo ${r.protocolo}.`, 3600);
      } catch (err) { toast(err.message); }
      loading(btn, false);
    });

    async function bloquear(nome, avisar = true) {
      await api.bloquearUsuaria({ nome });
      bloqueadas.add(nome);
      // Em grupo: as mensagens dela somem da tela
      chat.querySelectorAll(".bubble").forEach((b) => { if (b.querySelector(".bubble__autora")?.textContent === nome) b.remove(); });
      pintarBloqueio();
      if (avisar) toast(`${nome} foi bloqueada.`);
    }
    $("btn-denunciar").addEventListener("click", () => abrirDenuncia(grupo ? null : { nome: conversa.nome }));
    $("btn-bloquear").addEventListener("click", async () => {
      $("bloq-desc").textContent = "Ela não conseguirá falar com você e a conversa some da sua lista. Você pode desbloquear em Configurações, em Privacidade.";
      if (estaBloqueada()) {
        await api.desbloquearUsuaria(conversa.nome); bloqueadas.delete(conversa.nome); pintarBloqueio();
        closeSheet("sheet-opcoes"); return toast(`${conversa.nome} foi desbloqueada.`);
      }
      alvo = { nome: conversa.nome };
      $("bloq-titulo").textContent = `Bloquear ${conversa.nome}?`;
      closeSheet("sheet-opcoes"); openSheet("sheet-bloquear");
    });
    $("bloq-confirmar").addEventListener("click", async () => {
      await bloquear(alvo.nome);
      closeSheet("sheet-bloquear"); closeSheet("sheet-membros");
    });

    /* Participantes do grupo: denunciar, bloquear e, para a criadora, remover */
    function desenharMembros() {
      const lista = membrosLista();
      $("membros-dica").textContent = conversa.criadora
        ? "Como criadora do grupo, você pode remover participantes."
        : "Você pode denunciar ou bloquear qualquer participante.";
      $("lista-membros").innerHTML = lista.map((p) => p.eu ? `
        <div class="list-item">
          <span class="avatar avatar--sm" style="background:var(--grad-primary);color:#fff">EU</span>
          <span class="grow list-item__title">Você</span>
          ${conversa.criadora ? '<span class="convo-tag convo-tag--circulo">Criadora</span>' : ""}
        </div>` : `
        <div class="list-item" data-pid="${esc(p.id)}">
          <span class="avatar avatar--sm" data-tone="${p.tone}">${initials(p.nome)}</span>
          <span class="grow list-item__title">${esc(p.nome)}${bloqueadas.has(p.nome) ? ' <span class="text-xs text-muted">· bloqueada</span>' : ""}</span>
          <button type="button" class="icon-btn" data-acao="denunciar" aria-label="Denunciar ${esc(p.nome)}">${icon("flag", "sm")}</button>
          <button type="button" class="icon-btn" data-acao="bloquear" aria-label="${bloqueadas.has(p.nome) ? "Desbloquear" : "Bloquear"} ${esc(p.nome)}">${icon("x", "sm")}</button>
          ${conversa.criadora ? `<button type="button" class="icon-btn" data-acao="remover" aria-label="Remover ${esc(p.nome)} do grupo" style="color:var(--danger)">${icon("trash", "sm")}</button>` : ""}
        </div>`).join("");
    }
    $("btn-membros").addEventListener("click", () => { closeSheet("sheet-opcoes"); desenharMembros(); openSheet("sheet-membros"); });
    $("lista-membros").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-acao]"); if (!b) return;
      const linha = b.closest("[data-pid]");
      const p = membrosLista().find((x) => String(x.id) === linha.dataset.pid);
      if (b.dataset.acao === "denunciar") return abrirDenuncia({ nome: p.nome });
      if (b.dataset.acao === "bloquear") {
        if (bloqueadas.has(p.nome)) { await api.desbloquearUsuaria(p.nome); bloqueadas.delete(p.nome); toast(`${p.nome} foi desbloqueada.`); return desenharMembros(); }
        alvo = { nome: p.nome };
        $("bloq-titulo").textContent = `Bloquear ${p.nome}?`;
        $("bloq-desc").textContent = "As mensagens dela deixam de aparecer para você neste grupo. Ela continua no grupo. Você pode desbloquear em Configurações, em Privacidade.";
        return openSheet("sheet-bloquear");
      }
      if (b.dataset.acao === "remover" && confirm(`Remover ${p.nome} do grupo “${conversa.nome}”?`)) {
        try {
          await api.removerParticipante(id, p.id);
          conversa.participantes = membrosLista().filter((x) => String(x.id) !== String(p.id));
          document.getElementById("chat-status").textContent = `${conversa.participantes.length} participantes`;
          add({ sistema: true, texto: `${p.nome} foi removida do grupo.` });
          toast(`${p.nome} foi removida do grupo.`);
          desenharMembros();
        } catch (err) { toast(err.message); }
      }
    });

    const add = (m) => {
      if (m.sistema) { chat.insertAdjacentHTML("beforeend", `<span class="chat__day">${esc(m.texto)}</span>`); return; }
      const entrada = m.autora !== "eu";
      chat.insertAdjacentHTML("beforeend", `<div class="bubble ${entrada ? "bubble--in" : "bubble--out"}">${grupo && entrada && m.nome ? `<span class="bubble__autora">${esc(m.nome)}</span>` : ""}${esc(m.texto)}<time>${esc(m.hora)}</time></div>`);
      const app = document.querySelector(".app");
      app.scrollTo({ top: app.scrollHeight, behavior: "smooth" });
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    };
    (await api.listarMensagens(id)).filter((m) => !(grupo && m.nome && bloqueadas.has(m.nome))).forEach(add);

    const form = document.getElementById("composer");
    const input = document.getElementById("msg");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = input.value.trim();
      if (!texto) return;
      if (estaBloqueada()) return toast("Desbloqueie esta usuária para enviar mensagens.");
      input.value = "";
      add(await api.enviarMensagem(id, texto));
    });

    let mudo = false;
    document.getElementById("btn-silenciar").addEventListener("click", (e) => {
      mudo = !mudo;
      e.currentTarget.innerHTML = icon(mudo ? "bell-off" : "bell");
      toast(mudo ? "Notificações desta conversa silenciadas." : "Notificações reativadas.");
    });
  }
});
