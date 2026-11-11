/* VIOLET — Data e hora digitadas
   Troca os seletores de data/hora do navegador (input type=date / type=time) por campos de digitar com máscara:
   dd/mm/aaaa e hh:mm. O campo original continua na página, escondido, sempre com o valor no formato que a API
   espera (AAAA-MM-DD e HH:MM); por isso nenhum outro script precisa mudar. */
(() => {
  const soNumeros = (s) => String(s || "").replace(/\D/g, "");

  const mascaraData = (s) => {
    const d = soNumeros(s).slice(0, 8);
    if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return d;
  };

  const mascaraHora = (s) => {
    const d = soNumeros(s).slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
  };

  /* "14/05/2005" -> "2005-05-14"; devolve null se a data não existe (ex.: 31/02) */
  const dataParaISO = (texto) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
    if (!m) return null;
    const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(ano, mes - 1, dia);
    if (ano < 1900 || d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  };

  const isoParaData = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };

  /* "21:30" -> "21:30"; null se a hora não existe */
  const horaValida = (texto) => {
    const m = /^(\d{2}):(\d{2})$/.exec(texto);
    return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? texto : null;
  };

  function trocar(original, ehData) {
    const visivel = document.createElement("input");
    visivel.type = "text";
    visivel.inputMode = "numeric";
    visivel.autocomplete = "off";
    visivel.placeholder = ehData ? "dd/mm/aaaa" : "hh:mm";
    visivel.maxLength = ehData ? 10 : 5;
    visivel.required = original.required;
    visivel.className = original.className;
    visivel.dataset.original = original.id || original.name || "";

    // O rótulo (<label for=...>) passa a apontar para o campo visível
    const novoId = original.id ? `${original.id}-digitado` : "";
    if (original.id) {
      visivel.id = novoId;
      document.querySelectorAll(`label[for="${original.id}"]`).forEach((l) => (l.htmlFor = novoId));
    }

    original.required = false;      // quem exige é o campo visível
    original.style.display = "none";
    original.tabIndex = -1;
    original.setAttribute("aria-hidden", "true");
    original.parentNode.insertBefore(visivel, original);   // vem antes: é o primeiro input do campo

    // Outros scripts podem preencher o campo original (ex.: "hoje" como padrão); o campo visível acompanha.
    const descritor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(original, "value", {
      configurable: true,
      get() { return descritor.get.call(this); },
      set(v) {
        descritor.set.call(this, v);
        visivel.value = ehData ? isoParaData(v) : String(v || "").slice(0, 5);
        visivel.setCustomValidity("");
      },
    });
    const escrever = (v) => descritor.set.call(original, v);

    const atualizar = () => {
      visivel.value = ehData ? mascaraData(visivel.value) : mascaraHora(visivel.value);
      const texto = visivel.value;
      let valor = "";
      let erro = "";
      if (texto) {
        valor = (ehData ? dataParaISO(texto) : horaValida(texto)) || "";
        if (!valor) erro = ehData ? "Digite uma data válida, como 14/05/2005." : "Digite uma hora válida, como 21:30.";
        else if (ehData && original.max && valor > original.max) { valor = ""; erro = "Essa data ainda não chegou."; }
        else if (ehData && original.min && valor < original.min) { valor = ""; erro = "Essa data é anterior ao permitido."; }
      }
      visivel.setCustomValidity(erro);
      if (descritor.get.call(original) !== valor) {
        escrever(valor);
        original.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    visivel.addEventListener("input", atualizar);
    if (original.value) visivel.value = ehData ? isoParaData(original.value) : original.value.slice(0, 5);
    atualizar();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("input[type=date]").forEach((i) => trocar(i, true));
    document.querySelectorAll("input[type=time]").forEach((i) => trocar(i, false));
  });

  window.VioletDatas = { mascaraData, mascaraHora, dataParaISO, isoParaData, horaValida };
})();
