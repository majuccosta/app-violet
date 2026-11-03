/* VIOLET — Contatos (RQ005): lista, adicionar em etapas e detalhe.
   Todo contato pode ser "só contato" (conversas e grupos) ou "de confiança" (recebe alertas, máx. 5). */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, initials, icon, validate, loading, toast, qs } = window.Violet;
  const MAX_CONFIANCA = 5;
  const deConfianca = (c) => c.de_confianca !== false;

  /* ---------- Lista (rede.html) ---------- */
  const lista = document.getElementById("lista-contatos");
  if (lista) {
    const todos = await api.listarContatos();
    const confianca = todos.filter(deConfianca);
    const outros = todos.filter((c) => !deConfianca(c));
    document.getElementById("total-contatos").textContent = `${confianca.length} de ${MAX_CONFIANCA}`;

    const item = (c) => `
      <a href="contato.html?id=${c.id}" class="list-item">
        <span class="avatar" data-tone="${c.tone}">${initials(c.nome)}</span>
        <div class="grow">
          <div class="list-item__title">${esc(c.nome)}</div>
          <div class="list-item__sub">${deConfianca(c) ? `${esc(c.relacao)} · ` : ""}${esc(c.telefone)}</div>
        </div>
        ${deConfianca(c) && c.compartilha_localizacao ? `<span title="Pode ver sua localização" class="text-primary">${icon("map-pin", "sm")}</span>` : ""}
        ${icon("chevron-right")}
      </a>`;

    lista.innerHTML = confianca.length ? confianca.map(item).join("") : `
      <div class="empty"><span class="icon-badge icon-badge--round">${icon("heart")}</span>
        <p>Você ainda não adicionou contatos de confiança.</p></div>`;

    if (outros.length) {
      document.getElementById("sec-outros").hidden = false;
      document.getElementById("total-outros").textContent = `${outros.length}`;
      document.getElementById("lista-outros").innerHTML = outros.map(item).join("");
    }

  }

  /* ---------- Adicionar em etapas (contato-adicionar.html) ---------- */
  const form = document.getElementById("form-contato");
  if (form) {
    const idEdicao = qs("id");                      // ?id=... → transformar contato existente em contato de confiança
    const secoes = [...form.querySelectorAll("[data-passo]")];
    const dots = [...document.querySelectorAll("#stepper .stepper__dot")];
    const bars = [...document.querySelectorAll("#stepper .stepper__bar")];
    const titulo = document.getElementById("titulo");
    const btnProx = document.getElementById("btn-prox");
    const btnSec = document.getElementById("btn-sec");
    const opConfianca = document.getElementById("op-confianca");
    const radios = [...form.querySelectorAll("[data-tipo]")];

    const todos = await api.listarContatos();
    const qtdConfianca = todos.filter((c) => deConfianca(c) && String(c.id) !== String(idEdicao)).length;
    const cheio = qtdConfianca >= MAX_CONFIANCA;
    document.getElementById("cota").textContent = `${Math.min(qtdConfianca, MAX_CONFIANCA)} de ${MAX_CONFIANCA}`;
    if (cheio) {
      opConfianca.disabled = true;
      opConfianca.classList.add("is-disabled");
      document.getElementById("aviso-cota").hidden = false;
    }

    let passo = 1, tipo = null;

    if (idEdicao) {
      const c = todos.find((x) => String(x.id) === String(idEdicao));
      if (!c) { location.replace("rede.html"); return; }
      form.nome.value = c.nome; form.telefone.value = c.telefone;
      if (cheio) { toast(`Você já tem ${MAX_CONFIANCA} contatos de confiança.`); setTimeout(() => (location.href = "rede.html"), 900); return; }
      tipo = "confianca"; passo = 3;
    }

    const nomeCurto = () => (form.nome.value.trim().split(/\s+/)[0]) || "Essa pessoa";
    const render = () => {
      secoes.forEach((s, i) => { const ativa = i === passo - 1; s.hidden = !ativa; if (ativa) { s.classList.remove("fade-in"); void s.offsetWidth; s.classList.add("fade-in"); } });
      const soContato = tipo === "contato";
      dots[2].hidden = bars[1].hidden = soContato;     // só contato = 2 etapas
      dots.forEach((d, i) => { d.classList.toggle("is-done", i < passo - 1); d.classList.toggle("is-current", i === passo - 1); });
      bars.forEach((b, i) => b.classList.toggle("is-done", i < passo - 1));
      document.querySelectorAll("[data-nome-chip]").forEach((el) => (el.textContent = nomeCurto()));
      titulo.textContent = idEdicao ? "Contato de confiança" : passo === 1 ? "Adicionar contato" : passo === 2 ? "Tipo de contato" : "Informações";
      radios.forEach((r) => { const on = r.dataset.tipo === tipo; r.classList.toggle("is-checked", on); r.setAttribute("aria-checked", on); });

      btnProx.disabled = passo === 2 && !tipo;
      btnProx.textContent = passo === 1 ? "Continuar"
        : passo === 2 ? (!tipo ? "Escolha uma opção" : soContato ? "Salvar contato" : "Continuar")
        : idEdicao ? "Tornar de confiança" : "Adicionar à minha rede";
      btnSec.textContent = passo === 1 || (idEdicao && passo === 3) ? "Cancelar" : "Voltar";
    };

    radios.forEach((r) => r.addEventListener("click", () => { if (r.disabled) return; tipo = r.dataset.tipo; render(); }));

    const voltar = () => {
      if (passo === 1 || (idEdicao && passo === 3)) { location.href = idEdicao ? `contato.html?id=${idEdicao}` : "rede.html"; return; }
      passo -= 1; render();
    };
    btnSec.addEventListener("click", voltar);
    document.getElementById("btn-topo-voltar").addEventListener("click", voltar);

    const salvar = async () => {
      loading(btnProx, true, "Salvando…");
      const confiavel = tipo === "confianca";
      const dados = {
        nome: form.nome.value.trim(),
        telefone: form.telefone.value,
        de_confianca: confiavel,
        relacao: confiavel ? form.relacao.value : "",
        recebe_alertas: confiavel ? document.getElementById("recebe-alertas").checked : false,
        compartilha_localizacao: confiavel ? document.getElementById("compartilha").checked : false
      };
      try {
        if (idEdicao) await api.atualizarContato(idEdicao, dados); else await api.adicionarContato(dados);
      } catch (err) { loading(btnProx, false); toast(err.message); return; }
      toast(confiavel ? `${nomeCurto()} agora é contato de confiança.` : `${nomeCurto()} foi adicionada aos seus contatos.`);
      setTimeout(() => (location.href = "rede.html"), 700);
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(secoes[passo - 1])) return;
      if (passo === 1) { passo = 2; render(); return; }
      if (passo === 2) { if (!tipo) return; if (tipo === "contato") return salvar(); passo = 3; render(); return; }
      salvar();
    });
    render();
  }

  /* ---------- Detalhe (contato.html) ---------- */
  const nomeEl = document.getElementById("c-nome");
  if (nomeEl) {
    const c = await api.obterContato(qs("id"));
    if (!c) { nomeEl.textContent = "Contato não encontrado"; return; }
    const confiavel = deConfianca(c);
    document.title = `${c.nome} · Violet`;
    nomeEl.textContent = c.nome;
    const av = document.getElementById("c-avatar");
    av.textContent = initials(c.nome);
    av.dataset.tone = c.tone;
    const tipoEl = document.getElementById("c-tipo");
    tipoEl.textContent = confiavel ? "Contato de confiança" : "Contato";
    tipoEl.className = `badge${confiavel ? "" : " badge--soft"}`;
    document.getElementById("c-telefone").textContent = c.telefone;
    document.getElementById("c-ligar").href = `tel:${c.telefone.replace(/\D/g, "")}`;

    ["row-relacao", "row-alertas", "row-local"].forEach((id) => (document.getElementById(id).hidden = !confiavel));
    if (confiavel) {
      document.getElementById("c-relacao").textContent = c.relacao || "—";
      document.getElementById("c-alertas").textContent = c.recebe_alertas === false ? "Não" : "Sim";
      document.getElementById("c-local").textContent = c.compartilha_localizacao ? "Durante alertas" : "Não";
    }
    const promover = document.getElementById("c-promover");
    const rebaixar = document.getElementById("c-rebaixar");
    promover.hidden = confiavel;
    rebaixar.hidden = !confiavel;
    promover.href = `contato-adicionar.html?id=${c.id}`;

    rebaixar.addEventListener("click", async () => {
      if (!confirm(`${c.nome} deixará de receber seus alertas de emergência. Ela continua nos seus contatos.`)) return;
      await api.atualizarContato(c.id, { de_confianca: false, recebe_alertas: false, compartilha_localizacao: false, relacao: "" });
      toast("Removida dos contatos de confiança.");
      setTimeout(() => (location.href = "rede.html"), 700);
    });
    document.getElementById("c-remover").addEventListener("click", async () => {
      if (!confirm(`Excluir ${c.nome} dos seus contatos?`)) return;
      await api.removerContato(c.id);
      toast("Contato excluído.");
      setTimeout(() => (location.href = "rede.html"), 700);
    });
  }
});
