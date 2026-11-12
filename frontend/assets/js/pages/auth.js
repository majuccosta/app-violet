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

  /* ---------- Entrar / cadastrar com Google ----------
     O botão é o oficial do Google (Google Identity Services). Ele devolve um "credential" que o servidor confere.
     Conta nova entra sem verificação de identidade e segue para a verificação (Didit), como no cadastro normal. */
  const caixaGoogle = document.getElementById("google-botao");
  if (caixaGoogle) {
    const divisor = document.getElementById("google-divisor");
    const esconder = () => { caixaGoogle.style.display = "none"; if (divisor) divisor.hidden = true; };
    const clientId = API_CONFIG.GOOGLE_CLIENT_ID;
    if (!clientId) esconder();
    else {
      const esperarGoogle = () => new Promise((ok, falha) => {
        const inicio = Date.now();
        (function tentar() {
          if (window.google && google.accounts && google.accounts.id) return ok();
          if (Date.now() - inicio > 8000) return falha();
          setTimeout(tentar, 100);
        })();
      });
      const aoReceber = async ({ credential }) => {
        caixaGoogle.style.opacity = ".5"; caixaGoogle.style.pointerEvents = "none";
        try {
          await api.loginGoogle(credential);
          let destino = "home.html";
          try { const eu = await api.me(); if (eu && eu.verificada === false) destino = "verificacao.html"; } catch { /* segue para a home */ }
          location.href = destino;
        } catch (err) {
          toast(err.message);
          caixaGoogle.style.opacity = ""; caixaGoogle.style.pointerEvents = "";
        }
      };
      esperarGoogle().then(() => {
        google.accounts.id.initialize({ client_id: clientId, callback: aoReceber, ux_mode: "popup", use_fedcm_for_prompt: true });
                // Bolinha desenhada por nós; o botão verdadeiro do Google fica por cima, invisível, e recebe o clique
        caixaGoogle.style.cssText += ";position:relative;display:block;width:40px;height:40px;min-height:40px;margin:0 auto;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)";
        caixaGoogle.innerHTML = '<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true" style="position:absolute;inset:9px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><div id="google-real" style="position:absolute;inset:0;opacity:.01;overflow:hidden;border-radius:50%"></div>';
        google.accounts.id.renderButton(document.getElementById("google-real"), {
          type: "icon", shape: "circle", size: "large", theme: "outline",
        });
      }).catch(() => { caixaGoogle.textContent = "Não foi possível carregar o login com Google. Verifique sua internet."; caixaGoogle.style.fontSize = "var(--fs-sm)"; });
    }
  }

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
  
  const btnReenviar = document.getElementById("btn-reenviar");
  btnReenviar.addEventListener("click", async () => {
    if (btnReenviar.disabled) return;
    const destino = document.getElementById("rec-email").value.trim();
    const rotulo = btnReenviar.textContent;
    btnReenviar.disabled = true;
    try { await api.recuperarSenha({ destino }); toast("Enviamos um novo código."); }
    catch (err) { toast(err.message); }
    // espera 30 s antes de permitir outro envio (evita cliques repetidos)
    let falta = 30;
    const t = setInterval(() => {
      falta--;
      if (falta <= 0) { clearInterval(t); btnReenviar.disabled = false; btnReenviar.textContent = rotulo; }
      else btnReenviar.textContent = `${rotulo} (${falta}s)`;
    }, 1000);
  });
  const formSenha = document.getElementById("form-senha");
  formSenha.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(formSenha)) return;
    await api.novaSenha({ senha: document.getElementById("nova-senha").value });
    ir(4);
  });
});
