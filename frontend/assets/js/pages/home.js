/* VIOLET — Tela inicial: saudação por horário, painel de proteção, próximo trajeto, humor, atalhos, conversas e notificações */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, initials, icon, toast } = window.Violet;
  // Primeira vez no app: mostra o tutorial de boas-vindas
  if (window.Violet.disp.get("tutorial_pendente", false) && !window.Violet.disp.get("tutorial_visto", false)) { location.replace("boas-vindas.html"); return; }
  const $ = (id) => document.getElementById(id);
  const lang = () => document.documentElement.lang || "pt-BR";
  const seguro = (p, padrao) => Promise.resolve(p).catch(() => padrao);

  /* ---------- Saudação e data (mudam com o horário) ---------- */
  const SAUDACOES = {
    pt: ["Bom dia", "Boa tarde", "Boa noite"],
    en: ["Good morning", "Good afternoon", "Good evening"],
    es: ["Buenos días", "Buenas tardes", "Buenas noches"]
  };
  const pintarHora = () => {
    const agora = new Date();
    const h = agora.getHours();
    const idioma = lang().slice(0, 2);
    const turno = h >= 5 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : 2;
    $("saudacao").textContent = (SAUDACOES[idioma] || SAUDACOES.pt)[turno];
    const data = new Intl.DateTimeFormat(lang(), { weekday: "long", day: "numeric", month: "long" }).format(agora);
    $("data-hoje").textContent = data.charAt(0).toUpperCase() + data.slice(1);
  };
  pintarHora();
  setInterval(pintarHora, 60000);

  const [eu, conversas, notificacoes, contatos, prefs, grupos, denuncias, proximas] = await Promise.all([
    api.me(), seguro(api.listarConversas(), []), seguro(api.listarNotificacoes(), []),
    seguro(api.listarContatos(), []), seguro(api.obterPreferencias(), {}),
    seguro(api.listarGrupos(), []), seguro(api.listarDenuncias(), []),
    seguro(api.usuariasProximas(), { total: 0 })
  ]);

  $("nome-usuaria").textContent = eu.primeiro_nome || eu.nome.split(" ")[0];

  /* ---------- Você está protegida ---------- */
  const confianca = contatos.filter((c) => c.de_confianca !== false);
  const estado = { local: false, ate: null, anon: !!prefs.modo_anonimo };
  const hhmm = (iso) => new Date(iso).toLocaleTimeString(lang(), { hour: "2-digit", minute: "2-digit" });
  // A localização é a mesma do Círculo de Apoio: vale por tempo limitado e continua ativa ao trocar de tela
  const lerLocal = async () => {
    const c = await seguro(api.obterCompartilhamento(), null);
    estado.local = !!c; estado.ate = c ? c.expira_em : null;
  };
  await lerLocal();

  const pintarGuard = () => {
    const protegida = confianca.length > 0;
    $("guard").classList.toggle("is-warn", !protegida);
    $("guard-titulo").textContent = protegida ? "Você está protegida" : "Complete sua proteção";
    $("guard-ico").innerHTML = icon(protegida ? "shield-check" : "shield", "sm");

    $("v-local").textContent = estado.local ? `Até ${hhmm(estado.ate)}` : "Desativada";
    $("chip-local").classList.toggle("is-on", estado.local);
    $("chip-local").setAttribute("aria-pressed", estado.local);

    $("v-rede").textContent = protegida ? `${confianca.length} de 5` : "Adicionar";
    $("chip-rede").classList.toggle("is-on", protegida);

    $("v-anon").textContent = estado.anon ? "Ligado" : "Desligado";
    $("chip-anon").classList.toggle("is-on", estado.anon);
    $("chip-anon").setAttribute("aria-pressed", estado.anon);
  };
  pintarGuard();

  let minLocal = 30;
  const pintarSheetLocal = () => {
    $("local-off").hidden = estado.local;
    $("local-on").hidden = !estado.local;
    if (estado.local) $("local-info").textContent = `Sua rede vê sua localização até as ${hhmm(estado.ate)}. Quer mais tempo?`;
  };
  $("chip-local").addEventListener("click", () => { pintarSheetLocal(); Violet.openSheet("sheet-local"); });
  document.querySelectorAll("#sheet-local [data-min]").forEach((b) => b.addEventListener("click", () => {
    minLocal = Number(b.dataset.min);
    document.querySelectorAll("#sheet-local [data-min]").forEach((x) => x.classList.toggle("is-active", x === b));
  }));
  $("local-ligar").addEventListener("click", async () => {
    try { await api.autorizarLocalizacao({ minutos: minLocal }); } catch (e) { toast(e.message); return; }
    await lerLocal(); pintarGuard(); Violet.closeSheet("sheet-local");
    toast("Localização compartilhada com sua rede.");
  });
  $("local-mais").addEventListener("click", async () => {
    try { await Violet.estenderLocalizacao(30); } catch (e) { toast(e.message); return; }
    await lerLocal(); pintarGuard(); pintarSheetLocal();
    toast("Mais 30 minutos de localização.");
  });
  $("local-desligar").addEventListener("click", async () => {
    try { await api.encerrarLocalizacao(); } catch (e) { toast(e.message); return; }
    await lerLocal(); pintarGuard(); Violet.closeSheet("sheet-local");
    toast("Compartilhamento desativado.");
  });
  // Se o tempo acabar com a tela aberta, o botão volta para "Desativada"
  setInterval(async () => { if (estado.local && new Date(estado.ate) <= new Date()) { await lerLocal(); pintarGuard(); } }, 15000);
  $("chip-anon").addEventListener("click", async () => {
    estado.anon = !estado.anon;
    pintarGuard();
    try { await api.salvarPreferencias({ modo_anonimo: estado.anon }); }
    catch (e) { estado.anon = !estado.anon; pintarGuard(); toast(e.message); return; }
    toast(estado.anon ? "Modo anônimo ativado." : "Modo anônimo desativado.");
  });

  /* ---------- Próximo trajeto (do Círculo de Apoio) ---------- */
  const tempoAte = (iso) => {
    const min = Math.round((new Date(iso) - Date.now()) / 60000);
    if (min <= 0) return "Sai agora";
    if (min < 60) return `Sai em ${min} min`;
    if (min < 720) { const h = Math.floor(min / 60), m = min % 60; return m ? `Sai em ${h} h ${m} min` : `Sai em ${h} h`; }
    const d = new Date(iso);
    const hora = d.toLocaleTimeString(lang(), { hour: "2-digit", minute: "2-digit" });
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    const dias = Math.round((dia - hoje) / 86400000);
    const quando = dias <= 0 ? "" : dias === 1 ? "amanhã " : `${d.toLocaleDateString(lang(), { weekday: "long" })} `;
    return `Sai ${quando}às ${hora}`;
  };
  const proximo = grupos
    .filter((g) => g.membro && g.horario && new Date(g.horario) > Date.now() - 5 * 60000)
    .sort((a, b) => new Date(a.horario) - new Date(b.horario))[0];

  const tripEl = $("trip");
  if (proximo) {
    const gente = proximo.participantes || [];
    const resto = gente.length - 3;
    tripEl.className = "trip";
    tripEl.innerHTML = `
      <div class="trip__top"><span class="trip__label">Próximo trajeto</span><span class="trip__pill">${esc(proximo.nome)}</span></div>
      <h3 class="trip__time" id="trip-tempo">${tempoAte(proximo.horario)}</h3>
      <div class="trip__route"><span class="trip__stop">${esc(proximo.ponto)}</span><span class="trip__dot"></span><span class="trip__line"></span><span class="trip__dot trip__dot--end"></span><span class="trip__stop">${esc(proximo.destino)}</span></div>
      <div class="trip__foot">
        <div class="avatars-stack">${gente.slice(0, 3).map((p) => `<span class="avatar" data-tone="${p.tone}">${p.eu ? "Eu" : initials(p.nome)}</span>`).join("")}${resto > 0 ? `<span class="avatar avatar--more">+${resto}</span>` : ""}</div>
        <a href="circulo-grupo.html?id=${proximo.id}" class="btn btn--primary trip__btn">Ver círculo</a>
      </div>`;
    setInterval(() => { $("trip-tempo").textContent = tempoAte(proximo.horario); }, 30000);
  } else {
    tripEl.className = "trip trip--empty";
    tripEl.innerHTML = `
      <span class="trip__label">Círculo de Apoio</span>
      <h3 class="trip__time trip__time--sm">Combine seu trajeto com outras meninas</h3>
      <p class="text-muted text-sm">Vá e volte acompanhada, com localização compartilhada só durante o caminho.</p>
      <div class="trip__foot"><a href="circulo.html" class="btn btn--primary trip__btn">Encontrar círculos</a><a href="circulo-criar.html" class="btn btn--soft trip__btn">Criar um</a></div>`;
  }

  /* ---------- Humor ---------- */
  const RESPOSTAS = {
    bem: "Que bom! Estamos por aqui se precisar 💜",
    normal: "Dias assim acontecem. Estamos por aqui 💜",
    triste: "Sentimos muito. Conversar pode ajudar — vamos te levar até suas conversas.",
    apoio: "Vamos te levar até suas conversas de apoio."
  };
  document.querySelectorAll("[data-mood]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-mood]").forEach((b) => b.classList.toggle("is-active", b === btn));
      const tipo = btn.dataset.mood;
      toast(RESPOSTAS[tipo]);
      if (tipo === "apoio" || tipo === "triste") setTimeout(() => (location.href = "conversas.html"), 1100);
    });
  });

  /* ---------- Atalhos com informação ---------- */
  const andamento = denuncias.filter((d) => d.status === "andamento").length;
  $("sub-denuncia").textContent = andamento ? `${andamento} em andamento` : "Acompanhe o andamento";

  /* ---------- Conversas ---------- */
  $("lista-pessoas").innerHTML = conversas.slice(0, 6).map((c) => `
    <a href="chat.html?id=${c.id}" class="home-person">
      <span class="home-person__ring">
        <span class="avatar${c.tipo === "grupo" ? " avatar--group" : ""}" data-tone="${c.tone}">${c.tipo === "grupo" ? icon("users", "sm") : initials(c.nome)}</span>
      </span>
      ${c.nao_lidas ? `<span class="badge badge--count">${c.nao_lidas}</span>` : ""}
      <span>${esc(c.curto || c.nome)}</span>
    </a>`).join("");

  /* ---------- Notificações ---------- */
  document.getElementById("bell-dot").hidden = !notificacoes.some((n) => !n.lida);
  const icones = { mensagem: "message", denuncia: "file-text", contato: "heart" };
  $("lista-notificacoes").innerHTML = notificacoes.slice(0, 2).map((n) => `
    <a href="notificacoes.html" class="notif ${n.lida ? "" : "is-unread"}">
      <span class="notif__ico notif__ico--${esc(n.tipo)}">${icon(icones[n.tipo] || "bell", "sm")}</span>
      <div class="grow">
        <div class="notif__title">${esc(n.titulo)}</div>
        <div class="notif__text">${esc(n.texto)}</div>
      </div>
      <span class="notif__time">${esc(n.hora)}</span>
    </a>`).join("");
});
