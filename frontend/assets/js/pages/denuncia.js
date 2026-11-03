/* VIOLET — Denúncia anônima com evidências + análise por IA (RQ002, RQ004) */
document.addEventListener("DOMContentLoaded", () => {
  const { api, esc, icon, validate, loading, toast } = window.Violet;
  const form = document.getElementById("form-denuncia");
  const steps = [...form.querySelectorAll("[data-step]")];
  const btn = document.getElementById("btn-proximo");
  const dados = { categoria: null, arquivos: [] };
  let atual = 1;

  /* ---------- Categorias ---------- */
  const cats = window.VIOLET_MOCK.categorias;
  const tiles = document.getElementById("categorias");
  tiles.innerHTML = cats.map((c) => `
    <button type="button" class="tile" role="radio" aria-checked="false" data-cat="${c.id}">
      <span class="icon-badge">${icon(c.icon)}</span>
      <span class="tile__title">${c.nome}</span><span class="tile__sub">${c.desc}</span>
    </button>`).join("");
  tiles.addEventListener("click", (e) => {
    const t = e.target.closest(".tile");
    if (!t) return;
    tiles.querySelectorAll(".tile").forEach((x) => { x.classList.toggle("is-selected", x === t); x.setAttribute("aria-checked", x === t); });
    dados.categoria = cats.find((c) => c.id === t.dataset.cat);
    btn.disabled = false;
  });

  /* ---------- Navegação entre etapas ---------- */
  const dots = document.querySelectorAll(".stepper__dot");
  const bars = document.querySelectorAll(".stepper__bar");
  function ir(n) {
    atual = n;
    steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    dots.forEach((d, i) => { d.classList.toggle("is-done", i < n - 1); d.classList.toggle("is-current", i === n - 1); });
    bars.forEach((b, i) => b.classList.toggle("is-done", i < n - 1));
    btn.textContent = n === 4 ? "Enviar denúncia" : "Próximo";
    btn.disabled = n === 1 && !dados.categoria;
    document.getElementById("dica-revisar").hidden = n === 4;
    if (n === 4) montarResumo();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  ir(1);

  const btnVoltar = document.getElementById("btn-voltar");
  if (btnVoltar) btnVoltar.addEventListener("click", () => (atual > 1 ? ir(atual - 1) : (location.href = "home.html")));

  btn.addEventListener("click", async () => {
    if (atual === 2 && !validate(steps[1])) return;
    if (atual < 4) return ir(atual + 1);
    await enviar();
  });

  const desc = document.getElementById("descricao");
  desc.addEventListener("input", () => (document.getElementById("contador").textContent = `${desc.value.length}/2000`));
  document.getElementById("data").max = new Date().toISOString().slice(0, 10);

  /* ---------- Evidências + IA ---------- */
  const lista = document.getElementById("lista-arquivos");
  const tipoIcone = (f) => f.type.startsWith("image") ? "image" : f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "mic" : "file-text";

  document.getElementById("evidencias").addEventListener("change", (e) => {
    [...e.target.files].forEach((file) => {
      if (file.size > 25 * 1024 * 1024) return toast(`${file.name} passa de 25 MB.`);
      const item = { file, analise: null, id: crypto.randomUUID?.() || String(Date.now() + Math.random()) };
      dados.arquivos.push(item);
      const el = document.createElement("div");
      el.className = "file-pill";
      el.dataset.id = item.id;
      el.innerHTML = `${icon(tipoIcone(file), "sm")}
        <span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(file.name)}</span>
        <span class="badge" data-status>${icon("sparkles", "sm")} analisando…</span>
        <button type="button" class="icon-btn" style="width:30px;height:30px" aria-label="Remover ${esc(file.name)}">${icon("x", "sm")}</button>`;
      el.querySelector("button").addEventListener("click", () => {
        dados.arquivos = dados.arquivos.filter((a) => a.id !== item.id);
        el.remove();
      });
      lista.appendChild(el);

      // Toda evidência anexada passa pela IA (<<include>> Analisar evidências com IA)
      api.analisarEvidencia(file).then((r) => {
        item.analise = r;
        const s = el.querySelector("[data-status]");
        // O resultado detalhado vai para a equipe; para a usuária mostramos só que a análise terminou
        s.className = "badge badge--success";
        s.textContent = "analisada pela IA";
      }).catch(() => (el.querySelector("[data-status]").textContent = "análise pendente"));
    });
    e.target.value = "";
  });

  /* ---------- Resumo e envio ---------- */
  const envolvidoLabel = () => document.getElementById("envolvido").selectedOptions[0].text;
  function montarResumo() {
    const dataBR = form.data.value ? form.data.value.split("-").reverse().join("/") : "—";
    const linhas = [
      ["Categoria", dados.categoria?.nome],
      ["Local", form.local.value],
      ["Data e horário", `${dataBR}${form.hora.value ? " · " + form.hora.value : ""}`],
      ["Envolvido", envolvidoLabel()],
      ["Anexos", dados.arquivos.length ? `${dados.arquivos.length} arquivo(s)` : "Nenhum"],
      ["Identidade", document.getElementById("anonima").checked ? "Anônima" : "Identificada"]
    ];
    document.getElementById("resumo").innerHTML =
      linhas.map(([k, v]) => `<div class="summary__row"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("") +
      `<div class="summary__row summary__row--block"><dt>Descrição</dt><dd>${esc(form.descricao.value)}</dd></div>`;
  }

  async function enviar() {
    loading(btn, true, "Enviando…");
    const fd = new FormData();
    fd.append("categoria", dados.categoria.id);
    fd.append("local", form.local.value);
    fd.append("data_ocorrencia", form.data.value);
    fd.append("hora_ocorrencia", form.hora.value);
    fd.append("envolvido", form.envolvido.value);
    fd.append("descricao", form.descricao.value);
    fd.append("anonima", document.getElementById("anonima").checked);
    dados.arquivos.forEach((a) => fd.append("evidencias", a.file));

    try {
      const r = await api.criarDenuncia(fd);
      form.hidden = true;
      document.getElementById("stepper-wrap").hidden = true;
      if (btnVoltar) btnVoltar.style.visibility = "hidden";
      document.getElementById("protocolo").textContent = r.protocolo;
      document.getElementById("sucesso").hidden = false;
    } catch (err) {
      toast(err.message);
      loading(btn, false);
    }
  }
});
