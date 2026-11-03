/* VIOLET — Login, cadastro e recuperação de senha */
document.addEventListener("DOMContentLoaded", () => {
  const { api, validate, loading, toast } = window.Violet;

  /* ---------- Login ---------- */
  const formLogin = document.getElementById("form-login");
  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(formLogin)) return;
    const btn = formLogin.querySelector("[type=submit]");
    loading(btn, true, "Entrando…");
    try {
      await api.login({ email: formLogin.email.value.trim(), senha: formLogin.senha.value });
      // Conta sem verificação de identidade concluída vai para a verificação
      let destino = "home.html";
      try { const eu = await api.me(); if (eu && eu.verificada === false) destino = "verificacao.html"; } catch { /* segue para a home */ }
      location.href = destino;
    } catch (err) { toast(err.message); loading(btn, false); }
  });

  /* ---------- Cadastro ---------- */
  const IDADE_MINIMA = 16;
  const idadeValida = (iso) => {
    const d = new Date(iso + "T00:00:00");
    if (!iso || isNaN(d)) return false;
    const hoje = new Date();
    let idade = hoje.getFullYear() - d.getFullYear();
    if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) idade--;
    return d <= hoje && idade >= IDADE_MINIMA && idade <= 100;
  };
  const formCadastro = document.getElementById("form-cadastro");
  formCadastro?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(formCadastro)) return;
    if (!idadeValida(formCadastro.nascimento.value)) {
      toast(`Informe uma data de nascimento válida (mínimo de ${IDADE_MINIMA} anos).`);
      return formCadastro.nascimento.focus();
    }
    const btn = formCadastro.querySelector("[type=submit]");
    loading(btn, true, "Criando conta…");
    try {
      await api.cadastro({
        nome: formCadastro.nome.value.trim(),
        email: formCadastro.email.value.trim(),
        senha: formCadastro.senha.value,
        data_nascimento: formCadastro.nascimento.value
      });
      // Já entra na conta para poder enviar o documento na etapa seguinte
      await api.login({ email: formCadastro.email.value.trim(), senha: formCadastro.senha.value });
      // A verificação de identidade é obrigatória para concluir o cadastro (<<include>>)
      location.href = "verificacao.html";
    } catch (err) { toast(err.message); loading(btn, false); }
  });

  document.querySelectorAll("[data-social]").forEach((b) =>
    b.addEventListener("click", () => toast(`Login com ${b.dataset.social} será ativado na fase de integrações.`))
  );

  /* ---------- Recuperar senha (4 passos na mesma página) ---------- */
  const steps = document.querySelectorAll("[data-step]");
  if (!steps.length) return;
  let atual = 1;
  const ir = (n) => {
    atual = n;
    steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    document.getElementById("btn-voltar").style.visibility = n === 4 ? "hidden" : "visible";
    steps[n - 1].querySelector("input")?.focus();
  };
  document.getElementById("btn-voltar").addEventListener("click", () => (atual > 1 ? ir(atual - 1) : (location.href = "login.html")));

  const formEmail = document.getElementById("form-email");
  formEmail.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(formEmail)) return;
    const destino = document.getElementById("rec-email").value.trim();
    await api.recuperarSenha({ destino });
    document.getElementById("rec-destino").textContent = destino;
    ir(2);
  });

  // Campos do código: avança/volta automaticamente
  const otp = [...document.querySelectorAll(".otp input")];
  const btnCodigo = document.getElementById("btn-codigo");
  otp.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
      input.classList.toggle("filled", !!input.value);
      if (input.value && otp[i + 1]) otp[i + 1].focus();
      btnCodigo.disabled = otp.some((o) => !o.value);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !input.value && otp[i - 1]) otp[i - 1].focus(); });
    input.addEventListener("paste", (e) => {
      const digits = (e.clipboardData.getData("text").match(/\d/g) || []).slice(0, otp.length);
      if (!digits.length) return;
      e.preventDefault();
      digits.forEach((d, j) => { otp[j].value = d; otp[j].classList.add("filled"); });
      btnCodigo.disabled = otp.some((o) => !o.value);
    });
  });

  document.getElementById("form-codigo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { valido } = await api.verificarCodigo({ codigo: otp.map((o) => o.value).join("") });
    valido ? ir(3) : toast("Código inválido. Confira e tente de novo.");
  });
  document.getElementById("btn-reenviar").addEventListener("click", () => toast("Enviamos um novo código."));

  const formSenha = document.getElementById("form-senha");
  formSenha.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(formSenha)) return;
    await api.novaSenha({ senha: document.getElementById("nova-senha").value });
    ir(4);
  });
});
