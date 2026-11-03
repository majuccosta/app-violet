/* VIOLET — Sobre o Violet */
document.addEventListener("DOMContentLoaded", () => {
  const { esc, initials } = window.Violet;

  /* Equipe do projeto de extensão (edite o curso/papel de cada pessoa aqui, se quiser) */
  const EQUIPE = [
    { nome: "Laura Venancio Martins", curso: "Projeto Violet · CEUB" },
    { nome: "Maria Júlia de Carvalho Costa", curso: "Projeto Violet · CEUB" },
    { nome: "Sara Ramos Scalia", curso: "Projeto Violet · CEUB" }
  ];

  const secao = document.getElementById("equipe");
  if (!EQUIPE.length) return;
  secao.hidden = false;
  document.getElementById("equipe-lista").innerHTML = EQUIPE.map((p, i) => `
    <article class="about-person">
      <span class="avatar" data-tone="${(i % 4) + 1}">${p.nome.startsWith("[") ? "?" : esc(initials(p.nome))}</span>
      <b>${esc(p.nome)}</b>
      <span>${esc(p.curso)}</span>
    </article>`).join("");
});
