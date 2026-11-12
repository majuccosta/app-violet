/* VIOLET — Minha conta: dados pessoais, endereço, senha e exclusão */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, initials, icon, validate, loading, toast, phoneMask, openSheet, closeSheet } = window.Violet;
  const $ = (id) => document.getElementById(id);
  const eu = await api.me();
  // Depois da verificação, o nome vem do documento e não muda.
  // A data de nascimento é informada uma vez (cadastro) e depois fica travada.
  const nomeBloqueado = !!eu.verificada;
  const nascBloqueado = !!eu.data_nascimento;

  /* Limpa o erro do campo assim que a pessoa volta a digitar */
  document.addEventListener("input", (e) => e.target.closest?.(".field")?.classList.remove("is-invalid"));

  /* ---------- Topo ---------- */
  const pintarTopo = (u) => { $("c-iniciais").textContent = initials(u.nome); $("c-nome").textContent = u.nome; };
  pintarTopo(eu);
  $("c-verificada").hidden = !eu.verificada;

  /* ---------- Dados pessoais ---------- */
  const fd = $("form-dados");
  const nome = $("c-nome-in"), nasc = $("c-nasc"), tel = $("c-tel");
  const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  const apelido = $("c-apelido");
  nome.value = eu.nome_completo || eu.nome || "";
  apelido.value = eu.apelido || "";
  $("c-email").value = eu.email || "";
  tel.value = eu.telefone || "";
  phoneMask(tel);
  const trancar = (i) => {
    i.readOnly = true;
    const wrap = i.closest(".input-wrap");
    wrap.classList.add("is-locked");
    wrap.insertAdjacentHTML("beforeend", icon("lock", "sm"));
  };
  if (nomeBloqueado) trancar(nome);
  if (nomeBloqueado || nascBloqueado) {
    const dica = $("dica-bloqueio");
    dica.lastChild.textContent = nomeBloqueado && nascBloqueado
      ? " O nome vem do seu documento verificado e não pode ser alterado. A data de nascimento também fica fixa; para corrigir, fale com o suporte."
      : nomeBloqueado ? " O nome vem do seu documento verificado e não pode ser alterado."
      : " A data de nascimento não pode ser alterada depois de informada. Para corrigir, fale com o suporte.";
    dica.hidden = false;
  }
  if (nascBloqueado) {
    nasc.value = dataBR(eu.data_nascimento);
    trancar(nasc);
  } else {
    nasc.type = "date";
    nasc.value = eu.data_nascimento || "";
  }

  /* ---------- E-mail ----------
     Conta criada com o Google: o e-mail é o do Google e fica trancado.
     Conta normal (com senha): pode trocar, confirmando a senha. */
  const emailIn = $("c-email"), emailOriginal = eu.email || "";
  const campoSenhaEmail = $("campo-senha-email"), senhaEmail = $("c-email-senha");
  const dicaEmail = emailIn.closest(".field").querySelector(".field__hint");
  if (eu.tem_senha) {
    emailIn.readOnly = false;
    const wrapEmail = emailIn.closest(".input-wrap");
    wrapEmail.classList.remove("is-locked");
    [...wrapEmail.children].filter((el) => el !== emailIn)[1]?.remove();      // tira o cadeado
    dicaEmail.textContent = "É com ele que você entra no Violet. Se trocar, vamos pedir sua senha.";
    emailIn.addEventListener("input", () => {
      campoSenhaEmail.hidden = emailIn.value.trim().toLowerCase() === emailOriginal.toLowerCase();
    });
  } else {
    dicaEmail.textContent = "Você entrou com o Google, então este é o e-mail da sua conta Google e não pode ser trocado.";
  }

  fd.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(fd)) return;
    const dados = { telefone: tel.value.trim(), apelido: apelido.value.trim() };
    if (!nomeBloqueado) dados.nome = nome.value.trim();
    if (!nascBloqueado && nasc.value) dados.data_nascimento = nasc.value;
    const btn = $("btn-dados");
    loading(btn, true, "Salvando…");
    try {
      const emailNovo = emailIn.value.trim();
      if (eu.tem_senha && emailNovo.toLowerCase() !== emailOriginal.toLowerCase()) {
        if (!senhaEmail.value) {
          campoSenhaEmail.classList.add("is-invalid"); senhaEmail.focus();
          loading(btn, false); return;
        }
        const r = await api.alterarEmail({ email: emailNovo, senha: senhaEmail.value });
        emailIn.value = r.email; senhaEmail.value = ""; campoSenhaEmail.hidden = true;
      }
      const novo = await api.atualizarConta(dados);
      pintarTopo({ ...eu, ...novo, nome: novo.nome || eu.nome });
      toast("Dados salvos! 💜");
    } catch (err) { toast(err.message); }
    loading(btn, false);
  });

  /* ---------- Endereço ---------- */
  const fe = $("form-end");
  const campo = (n) => fe.elements[n];
  ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"].forEach((n) => { campo(n).value = eu[n] || ""; });
  const cepEl = campo("cep"), cepStatus = $("cep-status");
  const DICA_CEP = cepStatus.textContent;

  let ultimoCep = cepEl.value.replace(/\D/g, "");
  cepEl.addEventListener("input", () => {
    const d = cepEl.value.replace(/\D/g, "").slice(0, 8);
    cepEl.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    if (d.length < 8) { cepStatus.textContent = DICA_CEP; return; }
    if (d !== ultimoCep) { ultimoCep = d; buscarCep(d); }
  });
  async function buscarCep(d) {
    cepStatus.textContent = "Buscando endereço…";
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j.erro) { cepStatus.textContent = "CEP não encontrado. Preencha o endereço manualmente."; return; }
      campo("logradouro").value = j.logradouro || "";
      campo("bairro").value = j.bairro || "";
      campo("cidade").value = j.localidade || "";
      campo("uf").value = j.uf || "";
      fe.querySelectorAll(".field").forEach((f) => f.classList.remove("is-invalid"));
      cepStatus.textContent = "Endereço encontrado. Confira e informe o número.";
      campo("numero").focus();
    } catch { cepStatus.textContent = "Não deu para buscar agora. Preencha o endereço manualmente."; }
  }

  fe.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Endereço é opcional, mas se começar a preencher, precisa vir completo
    const campos = ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"];
    const algum = campos.some((n) => campo(n).value.trim());
    ["cep", "logradouro", "numero", "cidade", "uf"].forEach((n) => { campo(n).required = algum; });
    if (!validate(fe)) return;
    const dados = Object.fromEntries(campos.map((n) => [n, campo(n).value.trim()]));
    const btn = $("btn-end");
    loading(btn, true, "Salvando…");
    try { await api.atualizarConta(dados); toast(algum ? "Endereço salvo! 💜" : "Endereço removido."); }
    catch (err) { toast(err.message); }
    loading(btn, false);
  });

  /* ---------- Alterar senha ---------- */
  const fs = $("form-senha");
  const nova = $("s-nova"), meter = $("pw-meter"), dica = $("pw-dica"), erroNova = $("pw-erro");
  const ERRO_PADRAO = erroNova.textContent, DICA_PADRAO = dica.textContent;
  $("abrir-senha").addEventListener("click", () => openSheet("sheet-senha"));

  const nivel = (s) => {
    if (!s) return 0;
    let p = 0;
    if (s.length >= 8) p++;
    if (/[a-z]/i.test(s) && /\d/.test(s)) p++;
    if ((/[a-z]/.test(s) && /[A-Z]/.test(s)) || /[^A-Za-z0-9]/.test(s)) p++;
    if (s.length >= 12) p++;
    return p >= 3 ? 3 : p === 2 ? 2 : 1;
  };
  const TEXTO = ["", "Fraca — use 8+ caracteres, com letras e números.", "Média — quase lá!", "Forte 💜"];
  nova.addEventListener("input", () => {
    const n = nivel(nova.value);
    meter.dataset.nivel = n;
    dica.textContent = n ? TEXTO[n] : DICA_PADRAO;
  });

  fs.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroNova.textContent = ERRO_PADRAO;
    let ok = validate(fs);
    if (ok && /^\d+$/.test(nova.value)) { erroNova.textContent = "A senha não pode ter só números. Misture letras."; nova.closest(".field").classList.add("is-invalid"); nova.focus(); ok = false; }
    if (ok && nova.value === $("s-atual").value) { erroNova.textContent = "A nova senha precisa ser diferente da atual."; nova.closest(".field").classList.add("is-invalid"); nova.focus(); ok = false; }
    if (!ok) return;
    const btn = $("btn-senha");
    loading(btn, true, "Atualizando…");
    try {
      await api.alterarSenha({ atual: $("s-atual").value, nova: nova.value });
      toast("Senha atualizada! 💜");
      closeSheet("sheet-senha");
      fs.reset(); meter.dataset.nivel = 0; dica.textContent = DICA_PADRAO;
    } catch (err) { toast(err.message); }
    loading(btn, false);
  });

  /* ---------- Conta criada com o Google: não tem senha ----------
     Não há "senha atual" para trocar (ela pode criar uma em "Esqueceu sua senha?") e a exclusão não pede senha. */
  if (!eu.tem_senha) {
    $("abrir-senha").style.display = "none";
    const campoX = $("x-senha").closest(".field");
    $("x-senha").required = false;
    campoX.hidden = true;
    const aviso = document.querySelector("#form-excluir p.text-sm");
    if (aviso) aviso.textContent = "Essa ação apaga seus dados, denúncias, contatos e conversas e não pode ser desfeita.";
  }

  /* ---------- Excluir conta ---------- */
  const fx = $("form-excluir");
  $("abrir-excluir").addEventListener("click", () => openSheet("sheet-excluir"));
  if (new URLSearchParams(location.search).get("excluir") === "1") openSheet("sheet-excluir");   // vindo de Configurações
  fx.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(fx)) return;
    const btn = $("btn-excluir");
    loading(btn, true, "Excluindo…");
    try {
      await api.excluirConta({ senha: $("x-senha").value || "" });
      toast("Conta excluída. Cuide-se! 💜");
      setTimeout(() => (location.href = "../index.html"), 1200);
    } catch (err) { loading(btn, false); toast(err.message); }
  });
});
