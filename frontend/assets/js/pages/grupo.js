/* VIOLET — Novo grupo de conversa (diferente do Círculo de Apoio, que combina trajetos) */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, esc, initials, icon, validate, loading, toast } = window.Violet;
  const form = document.getElementById("form-grupo-chat");
  if (!form) return;

  const contatos = await api.listarContatos();
  const sel = new Map();               // id → contato
  let tone = 1;

  const prev = document.getElementById("prev-avatar");
  const chips = document.getElementById("chips");
  const contagem = document.getElementById("contagem");
  const listaEl = document.getElementById("lista-pick");
  const busca = document.getElementById("busca-contatos");
  const erro = document.getElementById("erro-membros");

  /* Prévia do avatar: iniciais do nome (ou ícone de grupo) + cor escolhida */
  const pintarPrev = () => {
    const nome = form.nome.value.trim();
    prev.dataset.tone = tone;
    prev.innerHTML = nome ? initials(nome) : icon("users", "lg");
  };
  form.nome.addEventListener("input", pintarPrev);
  document.querySelectorAll(".cor").forEach((b) => b.addEventListener("click", () => {
    tone = Number(b.dataset.tone);
    document.querySelectorAll(".cor").forEach((x) => { x.classList.toggle("is-active", x === b); x.setAttribute("aria-checked", x === b); });
    pintarPrev();
  }));

  const pintarChips = () => {
    contagem.textContent = sel.size ? `${sel.size} selecionada${sel.size > 1 ? "s" : ""}` : "Nenhuma selecionada";
    chips.hidden = !sel.size;
    chips.innerHTML = [...sel.values()].map((c) => `
      <button type="button" class="grupo-chip" data-remover="${c.id}" aria-label="Remover ${esc(c.nome)}">
        <span class="avatar" data-tone="${c.tone}">${initials(c.nome)}</span>${esc(c.nome.split(" ")[0])}${icon("x", "sm")}
      </button>`).join("");
    if (sel.size) erro.style.display = "none";
  };

  const pintarLista = () => {
    const termo = busca.value.trim().toLowerCase();
    const itens = contatos.filter((c) => !termo || c.nome.toLowerCase().includes(termo));
    if (!contatos.length) {
      listaEl.innerHTML = `<div class="empty empty--cute"><span class="empty__art">${icon("user", "lg")}</span>
        <p>Você ainda não tem contatos para convidar.</p><a href="contato-adicionar.html" class="btn btn--soft">Adicionar contato</a></div>`;
      return;
    }
    listaEl.innerHTML = itens.length ? itens.map((c) => `
      <button type="button" class="pick${sel.has(c.id) ? " is-checked" : ""}" data-id="${c.id}" role="checkbox" aria-checked="${sel.has(c.id)}">
        <span class="avatar" data-tone="${c.tone}">${initials(c.nome)}</span>
        <span class="grow">
          <span class="pick__nome">${esc(c.nome)}</span>
          <span class="pick__sub">${c.de_confianca !== false ? `${icon("heart", "sm")} De confiança` : esc(c.telefone)}</span>
        </span>
        <span class="choice__mark" aria-hidden="true">${icon("check", "sm")}</span>
      </button>`).join("") : `<div class="empty"><p>Nenhum contato encontrado.</p></div>`;
  };

  listaEl.addEventListener("click", (e) => {
    const b = e.target.closest(".pick"); if (!b) return;
    const c = contatos.find((x) => String(x.id) === b.dataset.id);
    if (sel.has(c.id)) sel.delete(c.id); else sel.set(c.id, c);
    b.classList.toggle("is-checked", sel.has(c.id)); b.setAttribute("aria-checked", sel.has(c.id));
    pintarChips();
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-remover]"); if (!b) return;
    sel.delete(contatos.find((x) => String(x.id) === b.dataset.remover).id);
    pintarChips(); pintarLista();
  });
  busca.addEventListener("input", pintarLista);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const okCampos = validate(form);
    erro.style.display = sel.size ? "none" : "block";
    if (!okCampos || !sel.size) return;
    const btn = document.getElementById("btn-criar");
    loading(btn, true, "Criando…");
    try {
      const conversa = await api.criarGrupoConversa({
        nome: form.nome.value.trim(),
        descricao: form.descricao.value.trim(),
        tone,
        membros: [...sel.values()].map((c) => ({ id: c.id, nome: c.nome }))
      });
      toast("Grupo criado! 💜");
      setTimeout(() => (location.href = `chat.html?id=${conversa.id}`), 600);
    } catch (err) { loading(btn, false); toast(err.message); }
  });

  pintarPrev(); pintarChips(); pintarLista();
});
