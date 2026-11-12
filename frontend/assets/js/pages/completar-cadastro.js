/* VIOLET — Complete seu cadastro: data de nascimento de quem entrou pelo Google */
document.addEventListener("DOMContentLoaded", async () => {
  const { api, validate, loading, toast } = window.Violet;
  const IDADE_MINIMA = 16;

  // Quem já tem data (ou não está logada) não precisa desta tela
  try {
    const eu = await api.me();
    if (eu && eu.data_nascimento) return void (location.replace(eu.verificada === false ? "verificacao.html" : "home.html"));
  } catch { return void location.replace("login.html"); }

  const idadeValida = (iso) => {
    const d = new Date(iso + "T00:00:00");
    if (!iso || isNaN(d)) return false;
    const hoje = new Date();
    let idade = hoje.getFullYear() - d.getFullYear();
    if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) idade--;
    return d <= hoje && idade >= IDADE_MINIMA && idade <= 100;
  };

  const form = document.getElementById("form-completar");
  form.nascimento.max = new Date().toISOString().slice(0, 10);
  document.addEventListener("input", (e) => e.target.closest?.(".field")?.classList.remove("is-invalid"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    if (!idadeValida(form.nascimento.value)) {
      toast(`Informe uma data de nascimento válida (mínimo de ${IDADE_MINIMA} anos).`);
      return form.nascimento.focus();
    }
    const btn = form.querySelector("[type=submit]");
    loading(btn, true, "Salvando…");
    try {
      await api.atualizarConta({ data_nascimento: form.nascimento.value });
      location.href = "verificacao.html";
    } catch (err) { toast(err.message); loading(btn, false); }
  });
});
