# Front-end — HTML, CSS e JavaScript

Sem framework e sem build: abra no navegador e funciona.

## Rodando

Use a extensão **Live Server** do VS Code (botão "Go Live") com a pasta `frontend` aberta, ou:

```bash
cd frontend
python -m http.server 5500
```

E acesse `http://localhost:5500`. Para ver como celular, abra o DevTools (F12) e ative o modo dispositivo.

## Estrutura

```
frontend/
├── index.html                 Tela inicial (boas-vindas)
├── pages/                     Uma página por tela
│   ├── login, cadastro, recuperar-senha
│   ├── verificacao            RG/CNH, frente e verso
│   ├── home                   Tela principal
│   ├── emergencia             Botão SOS (segurar 3 s)
│   ├── denuncia               4 etapas + protocolo
│   ├── rede, contato, contato-adicionar
│   ├── conversas, chat, notificacoes
│   ├── orientacoes, orientacao
│   ├── perfil, historico, configuracoes
│   └── circulo, circulo-criar, circulo-grupo   Círculo de Apoio
└── assets/
    ├── css/
    │   ├── tokens.css         Cores, fontes, espaçamentos (mude aqui)
    │   ├── base.css           Reset e estrutura do app
    │   ├── components.css     Botões, campos, cards, nav…
    │   └── pages.css          Estilos específicos de telas
    ├── js/
    │   ├── icons.js           Ícones SVG (<i data-icon="bell">)
    │   ├── mock-data.js       Dados de teste
    │   ├── api.js             Chamadas à API (mock ou Django)
    │   ├── app.js             Menu inferior, toast, voltar, validação
    │   └── pages/             Lógica de cada tela
    └── img/logo.svg
```

## Como criar uma tela nova

1. Copie uma página parecida de `pages/`.
2. Na `<div class="app">`, use `data-nav="inicio|denunciar|rede|conversas|perfil"` para o menu inferior. O botão de emergência (`data-sos`) fica só na `home.html`.
3. Monte o layout com as classes de `components.css` (`card`, `list-item`, `btn btn--primary`, `field`, `input-wrap`…).
4. Busque dados só por `Violet.api` — nunca com `fetch` direto na tela.

## Mock × API real

`assets/js/api.js` → `USE_MOCK: true` usa `mock-data.js` e salva no `localStorage` do navegador (contatos, denúncias e mensagens novas ficam guardados). Com `false`, chama o Django em `BASE_URL`.

## Tema claro / escuro

- `assets/js/theme.js` (carregado no `<head>` de todas as páginas) aplica `data-theme="dark"` ou `"light"` no `<html>`.
- As cores do tema escuro ficam em `assets/css/tokens.css`, no bloco `:root[data-theme="dark"]`.
- A escolha ("auto", "claro" ou "escuro") fica salva no aparelho (`localStorage`, chave `violet:tema`). "auto" segue o tema do sistema.
- Botão rápido: qualquer elemento com `data-theme-toggle` alterna o tema (está na tela inicial). Também há **Configurações → Aparência**.
- Imagens com `data-src-dark="..."` trocam de arquivo no escuro (ex.: `logo-violet-dark.png`).
- Ao criar uma nova tela, use sempre as variáveis (`var(--surface)`, `var(--ink-900)`, `var(--line)`…) em vez de cores fixas como `#fff`, para o escuro funcionar sozinho.
