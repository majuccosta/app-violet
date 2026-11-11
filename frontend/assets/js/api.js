/* ==========================================================
   VIOLET — Camada de acesso à API
   Todas as telas pedem dados por aqui. Enquanto USE_MOCK = true,
   as respostas vêm de mock-data.js; com false, vão para o Django/DRF.
   Os caminhos abaixo batem com backend/config/urls.py.
   ========================================================== */
// Endereço da API publicada (Render). Troque pelo seu depois de publicar, sem barra no final.
const API_PRODUCAO = "https://violet-api-9441.onrender.com/api";
const API_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

const API_CONFIG = {
  BASE_URL: API_LOCAL ? "http://localhost:8000/api" : API_PRODUCAO,
  USE_MOCK: false,
  MOCK_DELAY: 250 // ms, simula a rede
};

const ENDPOINTS = {
  login: "/auth/login/",
  cadastro: "/auth/cadastro/",
  recuperarSenha: "/auth/recuperar-senha/",
  verificarCodigo: "/auth/verificar-codigo/",
  novaSenha: "/auth/nova-senha/",
  me: "/usuarias/me/",
  senha: "/usuarias/me/senha/",
  excluirConta: "/usuarias/me/excluir/",
  verificacao: "/usuarias/verificacao/",
  verificacaoIniciar: "/usuarias/verificacao/iniciar/",
  verificacaoStatus: "/usuarias/verificacao/status/",
  contatos: "/contatos/",
  conversas: "/conversas/",
  mensagens: (id) => `/conversas/${id}/mensagens/`,
  notificacoes: "/notificacoes/",
  denuncias: "/denuncias/",
  analisarEvidencia: "/ia/analisar/",
  alertas: "/emergencia/alertas/",
  orientacoes: "/orientacoes/",
  grupos: "/circulo/grupos/",
  grupo: (id) => `/circulo/grupos/${id}/`,
  solicitacoes: "/circulo/solicitacoes/",
  localizacao: "/circulo/localizacao/",
  proximas: "/circulo/proximas/"
};

/* ---------- Armazenamento local seguro (mock) ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("violet:" + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("violet:" + key, JSON.stringify(value)); } catch { /* sem storage */ }
  }
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));
const M = () => window.VIOLET_MOCK;

/* ---------- HTTP real ---------- */
/* Renova o token de acesso (dura 30 min) usando o refresh; se não der, volta ao login */
async function renovarToken() {
  const refresh = store.get("refresh", null);
  if (!refresh) return false;
  try {
    const r = await fetch(API_CONFIG.BASE_URL + "/auth/refresh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh }) });
    if (!r.ok) return false;
    const d = await r.json();
    store.set("token", d.access);
    if (d.refresh) store.set("refresh", d.refresh);
    return true;
  } catch { return false; }
}
function sessaoExpirada() {
  store.set("token", null); store.set("refresh", null);
  try { Object.keys(sessionStorage).filter((k) => k.startsWith("violet:c:")).forEach((k) => sessionStorage.removeItem(k)); } catch { /* sem cache */ }
  const pagina = location.pathname.split("/").pop();
  if (!["login.html", "cadastro.html", "index.html", ""].includes(pagina)) location.replace("login.html");
}

/* ---------- Cache das consultas (GET) ----------
   Voltar para uma tela já visitada mostra na hora o que foi carregado antes e atualiza por trás,
   então a próxima visita já vem com dados novos. Qualquer alteração (POST, PATCH, DELETE) limpa o cache.
   Não entram no cache: mensagens do chat, login e verificação (precisam ser sempre atuais). */
const CACHE_PREFIXO = "violet:c:";
const emVoo = new Map();                                   // pedidos iguais ao mesmo tempo viram um só
const cacheiavel = (path) => !/\/(mensagens|auth|verificacao)\//.test(path) && !path.startsWith("/auth/");
const cacheChave = (path) => CACHE_PREFIXO + String(store.get("token", "") || "").slice(-16) + ":" + path;
function cacheLer(path) {
  try { const v = sessionStorage.getItem(cacheChave(path)); return v ? JSON.parse(v) : null; } catch { return null; }
}
function cacheGravar(path, data) {
  try { sessionStorage.setItem(cacheChave(path), JSON.stringify(data)); } catch { /* cheio ou bloqueado */ }
}
function cacheLimpar() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIXO)).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* sem cache */ }
}

/* ---------- Só entra no app quem tem conta ----------
   Sem login (token), só as páginas públicas abrem; qualquer outra volta para a entrada. */
if (!API_CONFIG.USE_MOCK) {
  const PUBLICAS = ["", "index.html", "login.html", "cadastro.html", "recuperar-senha.html", "termos.html", "politica.html", "neutro.html"];
  const arquivo = location.pathname.split("/").pop();
  if (!store.get("token", null) && !PUBLICAS.includes(arquivo)) {
    location.replace(location.pathname.includes("/pages/") ? "login.html" : "pages/login.html");
  }
}

/* Só para consultas (GET): se o servidor ainda está acordando ou a conexão cai, tenta de novo (até 2 vezes) */
const TRANSITORIO = /Sem conexão|502|503|504/;
async function comRetentativa(fazer, metodo) {
  if (metodo !== "GET") return fazer();
  for (let tentativa = 0; ; tentativa++) {
    try { return await fazer(); }
    catch (e) {
      if (tentativa >= 2 || !TRANSITORIO.test(String(e && e.message))) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
    }
  }
}

async function http(path, opts = {}, jaRenovou = false) {
  const metodo = opts.method || "GET";
  if (metodo !== "GET") {
    cacheLimpar();
    return httpBruto(path, opts, jaRenovou);
  }
  if (!cacheiavel(path)) return comRetentativa(() => httpBruto(path, opts, jaRenovou), "GET");
  const chave = cacheChave(path);
  const buscar = () => {
    if (emVoo.has(chave)) return emVoo.get(chave);
    const pedido = comRetentativa(() => httpBruto(path, opts, jaRenovou), "GET")
      .then((data) => { cacheGravar(path, data); return data; })
      .finally(() => emVoo.delete(chave));
    emVoo.set(chave, pedido);
    return pedido;
  };
  const guardado = cacheLer(path);
  if (guardado !== null) { buscar().catch(() => {}); return guardado; }   // mostra o guardado e atualiza por trás
  return buscar();
}

async function httpBruto(path, { method = "GET", body, form } = {}, jaRenovou = false) {
  const headers = { Accept: "application/json" };
  const token = store.get("token", null);
  // Login, cadastro e recuperação de senha não usam token (um token vencido guardado no navegador faria a API recusar)
  if (token && !path.startsWith("/auth/")) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

  let res;
  // O servidor grátis "dorme" sem uso e leva até 1 minuto para acordar: avisamos uma vez, em vez de deixar a tela parada
  const aviso = setTimeout(() => {
    if (window.Violet && Violet.toast && !window.__avisouServidor) {
      window.__avisouServidor = true;
      Violet.toast("O servidor está acordando. Pode levar até 1 minuto na primeira vez 💜", 6000);
    }
  }, 6000);
  try {
    res = await fetch(API_CONFIG.BASE_URL + path, { method, headers, body: payload });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  } finally {
    clearTimeout(aviso);
  }
  // Token vencido: renova uma vez e repete; se não der, pede login de novo
  if (res.status === 401 && token && !jaRenovou && !path.startsWith("/auth/")) {
    if (await renovarToken()) return httpBruto(path, { method, body, form }, true);
    sessaoExpirada();
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new Error(`Sem conexão com o servidor (${res.status}). Ele pode estar acordando; tente de novo em instantes.`);
  if (!res.ok) {
    let msg = "Não foi possível concluir. Tente novamente.";
    try {
      const data = await res.json();
      // O Django devolve {detail: "..."} ou {campo: ["erro"]}; pega a primeira mensagem
      const primeira = Object.values(data || {}).flat()[0];
      msg = data.detail || (typeof primeira === "string" ? primeira : msg);
    } catch { /* resposta sem JSON */ }
    // Conta ainda sem verificação de identidade: volta para a verificação
    if (res.status === 403 && /verifica[çc][ãa]o de identidade/i.test(msg) && !location.pathname.endsWith("verificacao.html")) location.replace("verificacao.html");
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const data = await res.json();
  // Listas do DRF vêm paginadas ({ count, next, results }); as telas usam só os itens
  return data && Array.isArray(data.results) ? data.results : data;
}

/* ---------- Recursos que ainda não têm rota no backend: ficam neste aparelho ---------- */
const local = {
  async listarBloqueadas() { return store.get("bloqueadas", []); },
  async bloquearUsuaria({ nome }) {
    const l = store.get("bloqueadas", []);
    if (!l.some((b) => b.nome === nome)) l.push({ nome, em: new Date().toISOString() });
    store.set("bloqueadas", l); return l;
  },
  async desbloquearUsuaria(nome) {
    const l = store.get("bloqueadas", []).filter((b) => b.nome !== nome);
    store.set("bloqueadas", l); return l;
  },
  async denunciarUsuaria({ nome = null, motivo, detalhe = "", onde = "" }) {
    await wait(API_CONFIG.MOCK_DELAY);
    const l = store.get("denuncias_usuarias", []);
    const nova = { id: Date.now(), protocolo: `USR-2026-${String(l.length + 1).padStart(5, "0")}`, nome, motivo, detalhe, onde, em: new Date().toISOString() };
    l.push(nova); store.set("denuncias_usuarias", l); return nova;
  },
  /* Trajeto seguro ("Cheguei bem"): se o prazo acabar sem confirmação, o app avisa a rede (simulado) */
  async obterTrajeto() { return store.get("trajeto", null); },
  async iniciarTrajeto({ grupo, nome, segundos }) {
    const t = { grupo, nome, inicio: new Date().toISOString(), limite_em: new Date(Date.now() + segundos * 1000).toISOString(), alertado: false };
    store.set("trajeto", t); return t;
  },
  async marcarTrajetoAlertado() {
    const t = store.get("trajeto", null); if (t) { t.alertado = true; store.set("trajeto", t); } return t;
  },
  async confirmarChegada() { const t = store.get("trajeto", null); store.set("trajeto", null); return t; }
};

/* ---------- Mock ---------- */
const mock = {
  async login({ email }) { await wait(API_CONFIG.MOCK_DELAY); store.set("token", "mock-token"); return { usuaria: { ...M().usuaria, email } }; },
  async cadastro(dados) { await wait(API_CONFIG.MOCK_DELAY); store.set("cadastro", dados); return { id: 99, ...dados }; },
  async recuperarSenha() { await wait(API_CONFIG.MOCK_DELAY); return { enviado: true }; },
  async verificarCodigo({ codigo }) { await wait(API_CONFIG.MOCK_DELAY); return { valido: codigo.length === 5 }; },
  async novaSenha() { await wait(API_CONFIG.MOCK_DELAY); return { ok: true }; },
  async me() { await wait(80); return { ...M().usuaria, ...store.get("perfil", {}) }; },
  async atualizarConta(dados) { await wait(API_CONFIG.MOCK_DELAY); store.set("perfil", { ...store.get("perfil", {}), ...dados }); return mock.me(); },
  // No mock não existe senha guardada: só confere as regras. A API real confere a senha atual no servidor.
  async alterarSenha({ atual, nova }) {
    await wait(API_CONFIG.MOCK_DELAY);
    if (atual === nova) throw new Error("A nova senha precisa ser diferente da atual.");
    return { ok: true };
  },
  async excluirConta() {
    await wait(API_CONFIG.MOCK_DELAY);
    try { Object.keys(localStorage).filter((k) => k.startsWith("violet:") && !/tema|idioma/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* sem storage */ }
    return null;
  },
  async iniciarVerificacao() { await wait(300); return { modo: "demo" }; },
  async statusVerificacao() { await wait(300); return { verificada: true, status: "aprovada", modo: "demo" }; },
  async verificacao() {
    await wait(900);
    return { status: "aprovada", dados: { nome: "Maria Júlia de Carvalho Costa", nascimento: "14/05/2005", documento: "RG •••• 6789", validade: "01/01/2032", naturalidade: "Brasília — DF" } };
  },

  async listarContatos() { await wait(API_CONFIG.MOCK_DELAY); return store.get("contatos", clone(M().contatos)); },
  async adicionarContato(c) {
    const lista = await mock.listarContatos();
    const novo = { id: Date.now(), tone: (lista.length % 4) + 1, de_confianca: true, recebe_alertas: true, ...c };
    lista.push(novo); store.set("contatos", lista); return novo;
  },
  async atualizarContato(id, dados) {
    const lista = await mock.listarContatos();
    const c = lista.find((x) => String(x.id) === String(id));
    if (c) Object.assign(c, dados);
    store.set("contatos", lista); return c;
  },
  async removerContato(id) {
    const lista = (await mock.listarContatos()).filter((c) => c.id !== id);
    store.set("contatos", lista); return null;
  },
  async obterContato(id) { return (await mock.listarContatos()).find((c) => String(c.id) === String(id)); },

  /* Conversas = conversas diretas + um item para cada grupo do Círculo de Apoio em que a pessoa entrou (membro). */
  async _conversaDoGrupo(g) {
    const id = "g" + g.id;
    const msgs = await mock.listarMensagens(id);
    const ultima = msgs[msgs.length - 1];
    const r = (M().resumoGrupos || {})[g.id] || { curto: g.nome.split(" ")[0], hora: "agora", min: 0, nao_lidas: 0 };
    return {
      id, grupo_id: g.id, tipo: "grupo", origem: "circulo", nome: g.nome, curto: r.curto, membros: g.participantes.length, tone: (g.id % 4) + 1,
      criadora: !!g.minha, participantes: g.participantes.map((p) => ({ ...p, id: String(p.id ?? p.nome) })),
      ultima: ultima ? `${ultima.autora === "eu" ? "Você" : ultima.nome || "Grupo"}: ${ultima.texto}` : "Você entrou no grupo 💜",
      hora: ultima && ultima.autora === "eu" ? "agora" : r.hora, min: ultima && ultima.autora === "eu" ? 0 : r.min, nao_lidas: r.nao_lidas
    };
  },
  /* Grupos de conversa (criados em "Novo grupo") — diferentes do Círculo de Apoio */
  async _conversaDoChat(g) {
    const msgs = await mock.listarMensagens(g.id);
    const ultima = msgs[msgs.length - 1];
    const min = Math.max(0, Math.round((Date.now() - g.criado) / 60000));
    const minhaUltima = ultima && ultima.autora === "eu";
    return {
      id: g.id, tipo: "grupo", origem: "chat", nome: g.nome, curto: g.nome, descricao: g.descricao || "",
      membros: g.membros.length + 1, tone: g.tone, criadora: true,
      participantes: [{ id: "eu", nome: "Você", eu: true, tone: 0 }, ...g.membros.map((m, i) => ({ id: String(m.id), nome: m.nome, tone: (i % 4) + 1 }))],
      ultima: !ultima ? "Grupo criado 💜" : ultima.sistema ? ultima.texto : `${minhaUltima ? "Você" : ultima.nome || "Grupo"}: ${ultima.texto}`,
      hora: minhaUltima || min < 1 ? "agora" : min < 60 ? `${min} min` : `${Math.round(min / 60)} h`,
      min: minhaUltima ? 0 : min, nao_lidas: 0
    };
  },
  async criarGrupoConversa({ nome, descricao = "", tone = 1, membros = [] }) {
    await wait(500);
    const lista = store.get("gruposChat", []);
    const novo = { id: "cg" + Date.now(), nome, descricao, tone, membros, criado: Date.now() };
    lista.push(novo); store.set("gruposChat", lista);
    return mock._conversaDoChat(novo);
  },
  async atualizarGrupoConversa(id, dados) {
    const lista = store.get("gruposChat", []); const g = lista.find((x) => String(x.id) === String(id));
    if (!g) return null; Object.assign(g, dados); store.set("gruposChat", lista); return mock._conversaDoChat(g);
  },
  async excluirGrupoConversa(id) {
    store.set("gruposChat", store.get("gruposChat", []).filter((x) => String(x.id) !== String(id)));
    store.set("mensagens:" + id, null); return true;
  },
  async _diretas() {
    const contatos = await mock.listarContatos();
    return clone(M().conversas).map((c) => ({ ...c, de_confianca: contatos.some((x) => x.id === c.contato_id && x.de_confianca !== false) }));
  },
  async listarConversas() {
    await wait(API_CONFIG.MOCK_DELAY);
    const diretas = await mock._diretas();
    const meus = (await mock.listarGrupos()).filter((g) => g.membro);
    const grupos = await Promise.all(meus.map((g) => mock._conversaDoGrupo(g)));
    const chats = await Promise.all(store.get("gruposChat", []).map((g) => mock._conversaDoChat(g)));
    return [...diretas, ...grupos, ...chats].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  },
  async obterConversa(id) {
    if (String(id).startsWith("cg")) {
      const g = store.get("gruposChat", []).find((x) => x.id === String(id));
      return g ? mock._conversaDoChat(g) : undefined;
    }
    if (String(id).startsWith("g")) {
      const g = await mock.obterGrupo(String(id).slice(1));
      return g ? mock._conversaDoGrupo(g) : undefined;
    }
    return (await mock._diretas()).find((c) => String(c.id) === String(id));
  },
  async listarMensagens(id) {
    await wait(API_CONFIG.MOCK_DELAY);
    const salvas = store.get("mensagens:" + id, null);
    if (salvas) return salvas;
    const base = M().mensagens[id];
    if (base) return clone(base);
    // Grupo de conversa recém-criado: aviso do sistema
    if (String(id).startsWith("cg")) return [{ id: 1, autora: "ela", sistema: true, texto: "Grupo criado! Diga um oi pra turma 💜", hora: "agora" }];
    // Grupo novo (sem histórico): mensagem de boas-vindas
    if (String(id).startsWith("g")) {
      const g = await mock.obterGrupo(String(id).slice(1));
      const outra = g && g.participantes.find((p) => !p.eu);
      if (outra) return [{ id: 1, autora: "ela", nome: outra.nome, texto: "Oi! Seja bem-vinda ao grupo 💜", hora: "agora" }];
    }
    return [];
  },
  async enviarMensagem(id, texto) {
    const lista = await mock.listarMensagens(id);
    const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const msg = { id: Date.now(), autora: "eu", texto, hora };
    lista.push(msg); store.set("mensagens:" + id, lista); return msg;
  },

  async removerParticipante(conversaId, membroId) {
    await wait(300);
    let nome = "";
    if (String(conversaId).startsWith("cg")) {
      const lista = store.get("gruposChat", []); const g = lista.find((x) => x.id === String(conversaId));
      if (!g) throw new Error("Grupo não encontrado.");
      const m = g.membros.find((x) => String(x.id) === String(membroId));
      nome = m ? m.nome : ""; g.membros = g.membros.filter((x) => String(x.id) !== String(membroId));
      store.set("gruposChat", lista);
    } else {
      const gid = String(conversaId).replace(/^g/, "");
      await mock._alterarGrupo(gid, (g) => {
        if (!g.minha) throw new Error("Só quem criou o grupo pode remover participantes.");
        const p = g.participantes.find((x) => String(x.id ?? x.nome) === String(membroId));
        nome = p ? p.nome : ""; g.participantes = g.participantes.filter((x) => String(x.id ?? x.nome) !== String(membroId));
      });
    }
    const msgs = await mock.listarMensagens(conversaId);
    msgs.push({ id: Date.now(), autora: "ela", sistema: true, texto: `${nome || "Uma participante"} foi removida do grupo.`, hora: "agora" });
    store.set("mensagens:" + conversaId, msgs);
    return true;
  },
  async listarNotificacoes() { await wait(API_CONFIG.MOCK_DELAY); return clone(M().notificacoes); },

  async listarDenuncias() { await wait(API_CONFIG.MOCK_DELAY); return [...store.get("denuncias", []), ...clone(M().denuncias)]; },
  async criarDenuncia(entrada) {
    await wait(700);
    let dados = entrada;
    if (entrada instanceof FormData) {
      const cat = M().categorias.find((c) => c.id === entrada.get("categoria"));
      const data = entrada.get("data_ocorrencia") || "";
      dados = {
        categoria: cat ? cat.nome : "Outro",
        local: entrada.get("local"),
        data: data.split("-").reverse().join("/"),
        hora: entrada.get("hora_ocorrencia") || "—"
      };
    }
    const n = String(124 + store.get("denuncias", []).length).padStart(6, "0");
    const nova = { id: Date.now(), protocolo: `PEN-2026-${n}`, status: "andamento", ...dados };
    store.set("denuncias", [nova, ...store.get("denuncias", [])]);
    return nova;
  },
  async analisarEvidencia(arquivo) {
    await wait(1200);
    // Resposta fictícia no formato que a IA deve devolver (ver ia/README.md)
    return { arquivo: arquivo.name, indicios: true, confianca: 0.72, rotulos: ["comportamento intimidador"], observacao: "Resultado de apoio. Não comprova a ocorrência." };
  },

  async acionarEmergencia({ lat, lng }) {
    await wait(600);
    const contatos = (await mock.listarContatos()).filter((c) => c.de_confianca !== false && c.compartilha_localizacao);
    return { id: Date.now(), status: "enviado", lat, lng, contatos_notificados: contatos.length, ligue180: true };
  },
  async cancelarEmergencia() { await wait(200); return { status: "cancelado" }; },

  async listarOrientacoes() { await wait(80); return clone(M().orientacoes); },

  async salvarPreferencias(prefs) { store.set("prefs", { ...store.get("prefs", {}), ...prefs }); return prefs; },
  async obterPreferencias() {
    return { notificacoes: true, som: true, vibracao: true, volume: 70, toque: "padrao", pin: true, biometria: true, compartilhar_localizacao: true, modo_anonimo: false, visivel_circulo: true, idioma: "pt-BR", ...store.get("prefs", {}) };
  },

  /* ---------- Círculo de Apoio (RQ011) ---------- */
  async listarGrupos({ busca = "" } = {}) {
    await wait(API_CONFIG.MOCK_DELAY);
    const termo = busca.trim().toLowerCase();
    return store.get("grupos", clone(M().grupos))
      .filter((g) => !termo || `${g.nome} ${g.ponto} ${g.destino}`.toLowerCase().includes(termo))
      .sort((a, b) => new Date(a.horario) - new Date(b.horario));
  },
  async obterGrupo(id) { return (await mock.listarGrupos()).find((g) => String(g.id) === String(id)); },
  async criarGrupo(dados) {
    await wait(500);
    const grupos = store.get("grupos", clone(M().grupos));
    const novo = { id: Date.now(), ...dados, participantes: [{ nome: "Você", tone: 0, eu: true }], membro: true, minha: true, compativel: true, distancia: "aqui" };
    grupos.push(novo); store.set("grupos", grupos);
    return novo;
  },
  async excluirGrupo(id) {
    await wait(300);
    const grupos = store.get("grupos", clone(M().grupos));
    const g = grupos.find((x) => String(x.id) === String(id));
    if (!g) throw new Error("Grupo não encontrado.");
    if (!g.minha) throw new Error("Só quem criou o grupo pode excluí-lo.");
    store.set("grupos", grupos.filter((x) => String(x.id) !== String(id)));
    store.set("mensagens:g" + id, null);
    return null;
  },
  async _alterarGrupo(id, fn) {
    const grupos = store.get("grupos", clone(M().grupos));
    const g = grupos.find((x) => String(x.id) === String(id));
    fn(g); store.set("grupos", grupos); return g;
  },
  async entrarGrupo(id) {
    await wait(400);
    return mock._alterarGrupo(id, (g) => {
      if (g.participantes.length >= g.vagas) throw new Error("Este grupo está lotado.");
      if (!g.membro) { g.membro = true; g.participantes.push({ nome: "Você", tone: 0, eu: true }); }
    });
  },
  async sairGrupo(id) {
    await wait(300);
    return mock._alterarGrupo(id, (g) => { g.membro = false; g.participantes = g.participantes.filter((p) => !p.eu); });
  },
  async listarSolicitacoes() { await wait(API_CONFIG.MOCK_DELAY); return store.get("solicitacoes", clone(M().solicitacoes)); },
  async responderSolicitacao(id, aceita) {
    const lista = (await mock.listarSolicitacoes()).filter((s) => s.id !== id);
    store.set("solicitacoes", lista); return { aceita };
  },
  async usuariasProximas() { await wait(150); return { total: M().proximas }; },
  async obterCompartilhamento() {
    const c = store.get("compartilhamento", null);
    if (c && new Date(c.expira_em) > new Date()) return c;
    return null;
  },
  async autorizarLocalizacao({ minutos, grupo = null, ate_desligar = false }) {
    await wait(300);
    const dur = ate_desligar ? 30 * 864e5 : minutos * 60e3;   // "até desligar" = 30 dias, só por segurança
    const c = { grupo, inicio: new Date().toISOString(), expira_em: new Date(Date.now() + dur).toISOString(), minutos };
    store.set("compartilhamento", c); return c;
  },
  async encerrarLocalizacao() { store.set("compartilhamento", null); return null; }
};

/* ---------- API real (mesma assinatura do mock) ---------- */
const real = {
  login: (d) => http(ENDPOINTS.login, { method: "POST", body: { email: d.email, password: d.senha } })
    .then((r) => { store.set("token", r.access); store.set("refresh", r.refresh); return r; }),
  cadastro: (d) => http(ENDPOINTS.cadastro, { method: "POST", body: { nome_completo: d.nome, email: d.email, senha: d.senha, data_nascimento: d.data_nascimento } }),
  // Recuperação de senha: guarda e-mail e código entre as 3 telas (o servidor confere tudo de novo no final)
  recuperarSenha: (d) => { store.set("rec_destino", d.destino); return http(ENDPOINTS.recuperarSenha, { method: "POST", body: d }); },
  verificarCodigo: (d) => http(ENDPOINTS.verificarCodigo, { method: "POST", body: { destino: store.get("rec_destino"), codigo: d.codigo } })
    .then((r) => { if (r.valido) store.set("rec_codigo", d.codigo); return r; }),
  novaSenha: (d) => http(ENDPOINTS.novaSenha, { method: "POST", body: { destino: store.get("rec_destino"), codigo: store.get("rec_codigo"), senha: d.senha } })
    .then((r) => { store.set("rec_destino", null); store.set("rec_codigo", null); return r; }),
  me: () => http(ENDPOINTS.me).then((u) => ({ ...u, nome: u.nome_completo, primeiro_nome: u.nome_completo.split(" ")[0] })),
  // Verificação real (Didit): devolve {modo:'didit', url} para enviar a usuária, ou {modo:'demo'} sem a Didit
  iniciarVerificacao: () => http(ENDPOINTS.verificacaoIniciar, { method: "POST", body: { retorno: `${location.origin}${location.pathname}?didit=1` } }),
  statusVerificacao: () => http(ENDPOINTS.verificacaoStatus),
  // Modo demonstração: devolve o status e os dados do cadastro (sem leitura do documento)
  verificacao: async (form) => {
    const r = await http(ENDPOINTS.verificacao, { method: "POST", form });
    const u = await http(ENDPOINTS.me);
    return { status: r.status, dados: { nome: u.nome_completo, nascimento: u.data_nascimento ? u.data_nascimento.split("-").reverse().join("/") : "", documento: "Foto recebida" } };
  },
  listarContatos: () => http(ENDPOINTS.contatos),
  adicionarContato: (c) => http(ENDPOINTS.contatos, { method: "POST", body: c }),
  atualizarContato: (id, d) => http(`${ENDPOINTS.contatos}${id}/`, { method: "PATCH", body: d }),
  removerContato: (id) => http(`${ENDPOINTS.contatos}${id}/`, { method: "DELETE" }),
  obterContato: (id) => http(`${ENDPOINTS.contatos}${id}/`),
  listarConversas: () => http(ENDPOINTS.conversas),
  obterConversa: (id) => http(`${ENDPOINTS.conversas}${id}/`),
  criarGrupoConversa: (d) => http(ENDPOINTS.conversas, { method: "POST", body: { tipo: "grupo", nome: d.nome, descricao: d.descricao, cor: d.tone, membros: d.membros.map((m) => m.id) } }),
  listarMensagens: (id) => http(ENDPOINTS.mensagens(id)),
  enviarMensagem: (id, texto) => http(ENDPOINTS.mensagens(id), { method: "POST", body: { texto } }),
  listarNotificacoes: () => http(ENDPOINTS.notificacoes),
  listarDenuncias: () => http(ENDPOINTS.denuncias),
  criarDenuncia: (form) => http(ENDPOINTS.denuncias, { method: "POST", form }),
  analisarEvidencia: (arquivo) => { const f = new FormData(); f.append("arquivo", arquivo); return http(ENDPOINTS.analisarEvidencia, { method: "POST", form: f }); },
  acionarEmergencia: (d) => http(ENDPOINTS.alertas, { method: "POST", body: d }),
  cancelarEmergencia: (id) => http(`${ENDPOINTS.alertas}${id}/cancelar/`, { method: "POST" }),
  listarOrientacoes: () => http(ENDPOINTS.orientacoes),
  // "modo_anonimo" fica no cadastro da usuária (fora de "preferencias"); o resto vai em "preferencias"
  salvarPreferencias: (p) => {
    const { modo_anonimo, ...resto } = p || {};
    const body = {};
    if (modo_anonimo !== undefined) body.modo_anonimo = modo_anonimo;
    if (Object.keys(resto).length) body.preferencias = resto;
    return http(ENDPOINTS.me, { method: "PATCH", body }).then(() => p);
  },
  atualizarConta: ({ nome, ...resto }) => http(ENDPOINTS.me, { method: "PATCH", body: nome ? { nome_completo: nome, ...resto } : resto }).then((u) => ({ ...u, nome: u.nome_completo })),
  alterarSenha: ({ atual, nova }) => http(ENDPOINTS.senha, { method: "POST", body: { senha_atual: atual, senha_nova: nova } }),
  excluirConta: ({ senha }) => http(ENDPOINTS.excluirConta, { method: "POST", body: { senha } }).then(() => { store.set("token", null); return null; }),
  listarGrupos: ({ busca = "" } = {}) => http(`${ENDPOINTS.grupos}?busca=${encodeURIComponent(busca)}`),
  obterGrupo: (id) => http(ENDPOINTS.grupo(id)),
  criarGrupo: (d) => http(ENDPOINTS.grupos, { method: "POST", body: { nome: d.nome, ponto: d.ponto, destino: d.destino, horario: d.horario, vagas: d.vagas } }),
  entrarGrupo: (id) => http(`${ENDPOINTS.grupo(id)}entrar/`, { method: "POST" }),
  sairGrupo: (id) => http(`${ENDPOINTS.grupo(id)}sair/`, { method: "POST" }),
  excluirGrupo: (id) => http(ENDPOINTS.grupo(id), { method: "DELETE" }).then(() => { store.set("mensagens:g" + id, null); return null; }),
  listarSolicitacoes: () => http(ENDPOINTS.solicitacoes),
  responderSolicitacao: (id, aceita) => http(`${ENDPOINTS.solicitacoes}${id}/responder/`, { method: "POST", body: { aceita } }),
  usuariasProximas: () => http(ENDPOINTS.proximas),
  obterCompartilhamento: () => http(ENDPOINTS.localizacao)
    .then((c) => (c && !c.encerrado && c.expira_em && new Date(c.expira_em) > new Date() ? c : null))
    .catch(() => null),
  autorizarLocalizacao: (d) => http(ENDPOINTS.localizacao, { method: "POST", body: d }),
  encerrarLocalizacao: () => http(ENDPOINTS.localizacao, { method: "DELETE" }),
  obterPreferencias: () => http(ENDPOINTS.me).then((u) => ({ ...(u.preferencias || {}), modo_anonimo: !!u.modo_anonimo }))
};

window.Violet = window.Violet || {};
Object.assign(mock, local);
Object.assign(real, local);


/* A API real não manda alguns campos só de visual (cor do avatar, hora curta); completa aqui */
if (!API_CONFIG.USE_MOCK) {
  const _lc = real.listarConversas, _ln = real.listarNotificacoes, _oc = real.obterConversa;
  const _lm = real.listarMensagens, _em = real.enviarMensagem;
  const ehGrupo = (id) => /^g\d+$/.test(String(id));      // grupo do Círculo de Apoio
  const ehChat = (id) => String(id).startsWith("cg");     // (antigo) grupo de conversa guardado só no aparelho
  /* Grupo de conversa ("Novo grupo") agora vem do banco: o servidor manda cor, criadora e participantes */
  const normalizaConversa = (c) => {
    if (c.tipo !== "grupo") return { tone: (Number(c.id) % 5) + 1, curto: (c.nome || "").split(" ")[0], online: false, min: 30, ...c };
    const criado = c.criado_em ? Math.max(0, Math.round((Date.now() - new Date(c.criado_em).getTime()) / 60000)) : 0;
    const ps = [{ id: "eu", nome: "Você", eu: true, tone: 0 }, ...(c.participantes || [])];
    return {
      ...c, origem: "chat", curto: c.nome, tone: c.cor || 1, membros: ps.length, participantes: ps,
      ultima: c.ultima || "Grupo criado 💜", hora: criado < 1 ? "agora" : criado < 60 ? `${criado} min` : criado < 1440 ? `${Math.round(criado / 60)} h` : `${Math.round(criado / 1440)} d`,
      min: criado
    };
  };
  const agoraHora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  /* Um grupo do Círculo vira uma conversa (as mensagens do grupo ficam só neste aparelho) */
  const conversaDoGrupo = (g) => {
    const id = "g" + g.id;
    const salvas = store.get("mensagens:" + id, null) || [];
    const ultima = salvas[salvas.length - 1];
    return {
      id, grupo_id: g.id, tipo: "grupo", origem: "circulo", nome: g.nome, curto: g.nome.split(" ")[0], membros: g.participantes.length,
      tone: (g.id % 4) + 1, criadora: !!g.minha,
      participantes: g.participantes.map((p) => ({ ...p, id: String(p.id) })),
      ultima: ultima ? `${ultima.autora === "eu" ? "Você" : ultima.nome || "Grupo"}: ${ultima.texto}` : "Você entrou no grupo 💜",
      hora: ultima ? ultima.hora : "agora", min: ultima ? 0 : 5, nao_lidas: 0
    };
  };
  const meusGrupos = async () => ((await real.listarGrupos()) || []).filter((g) => g.membro);

  const primeiroNome = (t) => String(t || "").trim().split(/\s+/)[0].toLowerCase();
  /* Conversa direta com alguém que também está na minha rede de apoio ganha a etiqueta "Contato de confiança" */
  const marcaConfianca = (contatos) => (c) => c.tipo === "grupo" ? c
    : { ...c, de_confianca: (contatos || []).some((x) => primeiroNome(x.nome) === primeiroNome(c.nome) && x.de_confianca !== false) };
  real.listarConversas = async (...a) => {
    const contatos = await real.listarContatos().catch(() => []);
    const diretas = ((await _lc(...a)) || []).map(normalizaConversa).map(marcaConfianca(contatos));
    const grupos = (await meusGrupos().catch(() => [])).map(conversaDoGrupo);
    return [...diretas, ...grupos].sort((x, y) => (x.min ?? 0) - (y.min ?? 0));
  };
  real.obterConversa = async (id) => {
    if (ehChat(id)) return mock.obterConversa(id);
    if (ehGrupo(id)) { const g = await real.obterGrupo(String(id).slice(1)).catch(() => null); return g ? conversaDoGrupo(g) : undefined; }
    const c = await _oc(id);
    if (!c) return c;
    const contatos = await real.listarContatos().catch(() => []);
    return marcaConfianca(contatos)(normalizaConversa(c));
  };
  real.listarMensagens = async (id) => {
    if (ehChat(id)) return mock.listarMensagens(id);
    if (ehGrupo(id)) {
      const salvas = store.get("mensagens:" + id, null);
      if (salvas) return salvas;
      const g = await real.obterGrupo(String(id).slice(1)).catch(() => null);
      return [{ id: 1, autora: "ela", sistema: true, texto: g ? `Grupo “${g.nome}” — combinem o trajeto por aqui 💜` : "Conversa do grupo", hora: "agora" }];
    }
    const msgs = (await _lm(id)) || [];
    if (!msgs.length) {
      const c = await _oc(id).catch(() => null);
      if (c && c.tipo === "grupo") return [{ id: 0, autora: "ela", sistema: true, texto: "Grupo criado! Diga um oi pra turma 💜", hora: "agora" }];
    }
    return msgs;
  };
  real.enviarMensagem = async (id, texto) => {
    if (ehChat(id)) return mock.enviarMensagem(id, texto);
    if (ehGrupo(id)) {
      const lista = await real.listarMensagens(id);
      const msg = { id: Date.now(), autora: "eu", texto, hora: agoraHora() };
      lista.push(msg); store.set("mensagens:" + id, lista); return msg;
    }
    return _em(id, texto);
  };
  real.criarGrupoConversa = async (d) => normalizaConversa(await http(ENDPOINTS.conversas, {
    method: "POST", body: { tipo: "grupo", nome: d.nome, descricao: d.descricao || "", cor: d.tone || 1, membros: (d.membros || []).map((m) => ({ id: m.id, nome: m.nome })) }
  }));
  real.atualizarGrupoConversa = async (id, dados) => normalizaConversa(await http(`${ENDPOINTS.conversas}${id}/`, { method: "PATCH", body: dados }));
  real.excluirGrupoConversa = async (id) => { await http(`${ENDPOINTS.conversas}${id}/`, { method: "DELETE" }); return true; };
  /* Só quem criou o grupo remove participante; a API confere de novo no servidor */
  real.removerParticipante = async (conversaId, membroId) => {
    if (ehChat(conversaId)) return mock.removerParticipante(conversaId, membroId);
    if (!ehGrupo(conversaId)) { await http(`${ENDPOINTS.conversas}${conversaId}/remover-membro/`, { method: "POST", body: { membro: String(membroId) } }); return true; }
    await http(`${ENDPOINTS.grupo(String(conversaId).replace(/^g/, ""))}remover/`, { method: "POST", body: { usuaria: Number(membroId) } });
    return true;
  };

  /* No banco, as orientações guardam o conteúdo em "conteudo" e usam "slug"/"icone"; a tela espera id/icon/passos/canais/faq */
  const _lo = real.listarOrientacoes;
  real.listarOrientacoes = async (...a) => ((await _lo(...a)) || [])
    .slice().sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0))
    .map((o) => ({ id: o.slug || o.id, titulo: o.titulo, resumo: o.resumo, icon: o.icone || "help-circle", aviso: o.aviso || "", ...(o.conteudo || {}) }));

  /* A API devolve categoria como código ("ameaca"), data em AAAA-MM-DD e hora com segundos; a tela mostra legível */
  const _ld = real.listarDenuncias;
  real.listarDenuncias = async (...a) => ((await _ld(...a)) || []).map((d) => {
    const [ano, mes, dia] = String(d.data_ocorrencia || "").split("-");
    return {
      ...d,
      categoria: d.categoria_nome || d.categoria,
      data: d.data || (dia ? `${dia}/${mes}/${ano}` : ""),
      hora: d.hora || String(d.hora_ocorrencia || "").slice(0, 5)
    };
  });

  real.listarNotificacoes = async (...a) => ((await _ln(...a)) || []).map((n) => ({
    hora: n.criado_em ? new Date(n.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "",
    ...n
  }));
}

const _api = API_CONFIG.USE_MOCK ? mock : real;
/* Notificações discretas: com a opção ligada, nada do conteúdo aparece na lista */
const _listarNotificacoes = _api.listarNotificacoes;
_api.listarNotificacoes = async (...a) => {
  const itens = await _listarNotificacoes(...a);
  const discretas = window.Violet.disp && window.Violet.disp.get("notif_discretas", false);
  return discretas ? itens.map((n) => ({ ...n, titulo: "Nova notificação", texto: "Toque para abrir o Violet.", tipo: "sistema" })) : itens;
};
window.Violet.api = _api;
window.Violet.store = store;
