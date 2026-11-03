# 🌐 Publicar o Violet na internet

No fim você terá **um link** para o app, que conversa com a **API** na nuvem, que usa o **banco** na nuvem. O professor e a parceria só abrem o link.

| Peça | Onde fica | Serviço grátis | Quando |
|---|---|---|---|
| Código | GitHub (repositório **privado** por enquanto) | GitHub | **Parte 1 (agora)** |
| Banco PostgreSQL | nuvem | **Supabase** | **Parte 1 (agora)** |
| API Django | nuvem | **Render** | **Parte 1 (agora)** |
| App (front) | link público | **GitHub Pages** | **Parte 2 (no final)** |

Tempo da Parte 1: cerca de 1 hora. **Não deixe para o dia da apresentação.**

---

# PARTE 1 — Banco e API na nuvem (faça agora)

## Passo 0 — Conferir no seu computador

No terminal do VS Code, na pasta `backend`, com o `.venv` ativo:

```
pip install -r requirements.txt
python manage.py test
```

Tem que aparecer `OK` no final. Se der erro, **não siga** e me chame.

## Passo 1 — Código no GitHub (privado)

1. No site do GitHub: **New repository**. Nome: `violet`. Marque **Private**. **Não** marque "Add a README". Clique em *Create repository*.
2. No terminal do VS Code, vá para a **raiz** do projeto (a pasta `violet`, que contém `backend`, `frontend` e `database`):

```
cd ..
git status
```

Confira na lista: o arquivo `backend/.env` **não** pode aparecer. (O `.gitignore` já bloqueia. Se ele aparecer, pare e me chame.)

3. Envie o código (troque pelo endereço que o GitHub mostrou):

```
git init
git add .
git commit -m "Violet: banco e API"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/violet.git
git push -u origin main
```

Se o `git init` já tinha sido feito antes, pule o `git init` e o `git remote add`.

## Passo 2 — Banco na nuvem (Supabase)

1. Entre em **supabase.com** → **Start your project** (pode entrar com o GitHub).
2. **New project** e preencha:
   - **Name:** `violet`
   - **Database Password:** crie uma senha **só com letras e números** (sem `@`, `#`, `/`, `%`). **Anote**: o Supabase não mostra de novo.
   - **Region:** *South America (São Paulo)*.
3. Espere o projeto ficar pronto (1 a 2 minutos).
4. Clique em **Connect** (botão no topo) e escolha **Session pooler**. **Não** use a "Direct connection": a direta usa IPv6 e o Render grátis não alcança.
5. Você verá algo assim:

```
postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

Anote em um bloco de notas:

| Nome | Valor |
|---|---|
| `DB_USER` | o que vem depois de `postgresql://` e antes do `:` (tem a forma `postgres.abcdefghijkl`, **com o ponto**) |
| `DB_PASSWORD` | a senha que você criou |
| `DB_HOST` | o que vem depois do `@` e antes do `:` (termina em `pooler.supabase.com`) |
| `DB_PORT` | `5432` |
| `DB_NAME` | `postgres` |

Guarde também a **linha inteira**, trocando `[YOUR-PASSWORD]` pela sua senha (sem os colchetes). Ela será usada no Passo 4.

## Passo 3 — API na nuvem (Render)

1. Entre em **render.com** e crie a conta com o GitHub. Autorize o acesso ao repositório `violet`.
2. **New +** → **Web Service** → escolha o repositório `violet`.
3. Preencha:

| Campo | Valor |
|---|---|
| Name | `violet-api` |
| Region | a mais próxima disponível |
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate` |
| Start Command | `gunicorn config.wsgi:application --workers 2 --threads 2` |
| Instance Type | **Free** |

4. Em **Environment Variables**, adicione uma por uma:

| Nome | Valor |
|---|---|
| `PYTHON_VERSION` | `3.12.8` |
| `DJANGO_SECRET_KEY` | uma chave longa e aleatória (veja abaixo) |
| `DJANGO_DEBUG` | `False` |
| `VERIFICACAO_DEMO` | `True` (para suas amigas testarem: aprova a verificação com qualquer foto de documento; depois da demonstração, mude para `False`) |
| `DB_NAME` | `postgres` |
| `DB_USER` | o do Supabase (`postgres.abcdefghijkl`) |
| `DB_PASSWORD` | a senha do Supabase |
| `DB_HOST` | o do Supabase (`aws-0-...pooler.supabase.com`) |
| `DB_PORT` | `5432` |
| `DB_SSLMODE` | `require` |
| `CORS_ORIGINS` | `http://localhost:5500,http://127.0.0.1:5500` (por enquanto; troca na Parte 2) |

Para gerar a `DJANGO_SECRET_KEY`, rode no terminal do VS Code:

```
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

5. Clique em **Create Web Service** e acompanhe o log (3 a 6 minutos). Quando aparecer `Your service is live`, deu certo. O build roda o `migrate`, então **as tabelas já são criadas no Supabase**.
6. Copie o endereço que o Render mostra no topo, por exemplo `https://violet-api.onrender.com`. Se o nome estiver ocupado, vem com outro sufixo, e é esse que vale.

## Passo 4 — Popular o banco e ativar a proteção

No terminal do VS Code, na pasta `backend` (troque o texto entre aspas pela **connection string inteira** do Passo 2, com a senha no lugar de `[YOUR-PASSWORD]`):

```
$env:PGCLIENTENCODING="UTF8"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "COLE-AQUI-A-CONNECTION-STRING" -f ..\database\seed.sql
```

Tem que terminar em `COMMIT`. Rode **uma vez só**: rodar de novo dá erro de chave duplicada (nesse caso nada é alterado).

Agora a proteção do Supabase, **uma vez**, com a mesma connection string:

```
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" "COLE-AQUI-A-CONNECTION-STRING" -f ..\database\supabase_rls.sql
```

Ela impede que as tabelas sejam lidas pela API pública do Supabase (as denúncias são dados sensíveis). A API do Violet continua funcionando.

## Passo 5 — Testar

- `https://SEU-ENDERECO.onrender.com/api/orientacoes/` → deve aparecer o JSON.
- `https://SEU-ENDERECO.onrender.com/admin/` → entre com `mariajulia@ceub.edu.br` / `Violet@2026`.
- No Supabase: **Table Editor** → as tabelas aparecem com dados (é daí que você mostra o banco ao professor).

## Passo 6 — Testar o app local usando a API da nuvem (opcional)

Em `frontend/assets/js/api.js`, no começo do arquivo, troque temporariamente:

```js
const API_PRODUCAO = "https://SEU-ENDERECO.onrender.com/api";   // termina em /api
const API_LOCAL = false;                                          // era a linha com localhost
```

Abra o app pelo Live Server e entre com `mariajulia@ceub.edu.br` / `Violet@2026`. Se entrar, o app está conversando com a API e o banco da nuvem.

**Depois volte** `API_LOCAL` para o valor original (`["localhost", "127.0.0.1"].includes(location.hostname)`) para continuar usando a API local nos seus testes de desenvolvimento.

---

# PARTE 2 — Publicar o front (faça no final, com o front pronto)

## Passo 7 — Endereço da API no front

Em `frontend/assets/js/api.js`, deixe `API_PRODUCAO` com o endereço do **seu** Render (terminando em `/api`) e `API_LOCAL` com o valor original. Salve e envie:

```
git add .
git commit -m "Front pronto"
git push
```

## Passo 8 — Repositório público e GitHub Pages

1. No GitHub, no repositório: **Settings** → **General** → no fim da página, **Change visibility** → **Make public**. (O GitHub Pages grátis exige repositório público. Os dados do projeto são fictícios, mas o `.env` nunca pode subir.)
2. **Settings** → **Pages** → em **Source**, escolha **GitHub Actions**.
3. Aba **Actions**: o fluxo "Publicar front-end" roda sozinho a cada `git push` (ou clique em *Run workflow*). Espere ficar verde.
4. O link do app será `https://SEU-USUARIO-GITHUB.github.io/violet/`.

## Passo 9 — Liberar o front na API (CORS)

No Render, em **Environment**, troque `CORS_ORIGINS` para:

```
https://SEU-USUARIO-GITHUB.github.io
```

(sem barra no final e **sem** o nome do repositório). Salve; o Render reinicia sozinho.

## Passo 10 — Teste final (em outro computador ou no celular)

1. Abra o link do app.
2. Entre com `mariajulia@ceub.edu.br` / `Violet@2026`.
3. Passe pelas telas. Cadastre um contato e confira em `/admin/` da API publicada.

---

# Na hora de apresentar

1. **10 minutos antes:** abra o link do app e faça login. Isso "acorda" a API, que dorme depois de ~15 minutos parada (o primeiro acesso demora 30 a 60 segundos).
2. Mostre o app pelo link.
3. Banco: painel do Supabase → **Table Editor**.
4. API: `.../api/orientacoes/` e `.../admin/` no navegador.
5. Deixe esses endereços e os logins (GitHub, Supabase, Render) salvos no celular.
6. **Plano B:** o projeto rodando no seu notebook (`DEMONSTRACAO.md`).

---

# Atualizar depois de publicado

Qualquer mudança vira atualização automática:

```
git add .
git commit -m "Descreva a mudança"
git push
```

O GitHub Pages republica o front em 1 a 2 minutos, e o Render republica a API. O link continua o mesmo.

---

# Cuidados

- **A API grátis dorme** depois de ~15 minutos sem uso (veja "Na hora de apresentar").
- **Arquivos enviados** (evidências, mídias) somem quando a API reinicia, porque o plano grátis não guarda arquivos. Os dados do banco **não** somem.
- **Código de recuperação de senha:** ainda não há envio de e-mail (fase de integrações). Em produção o código aparece no **log do Render** (aba *Logs*).
- Todas as contas do seed usam a mesma senha. São contas **de teste**: não cadastre dados reais.
- **Nunca suba o `.env`** nem cole a connection string em lugares públicos.

---

# Se der erro

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| Login falha e o Console (F12) mostra erro de **CORS** | `CORS_ORIGINS` errado | No Render, deixe só `https://SEU-USUARIO.github.io` (sem `/violet`, sem barra no final) e faça *Manual Deploy* |
| Login falha com erro de rede / `ERR_CONNECTION` | `API_PRODUCAO` errado ou API dormindo | Confira o endereço no `api.js` (termina em `/api`); espere 1 minuto |
| Build do Render falha em `migrate` | variáveis do banco erradas | `DB_USER` tem que ter o ponto (`postgres.xxxx`); `DB_HOST` termina em `pooler.supabase.com`; `DB_SSLMODE=require`; senha certa |
| `connection refused` ou `Network is unreachable` | usou a conexão direta (IPv6) | Use a **Session pooler**, não a "Direct connection" |
| `DisallowedHost` | host não permitido | No Render, adicione `DJANGO_ALLOWED_HOSTS` com o domínio do Render |
| Admin sem visual (sem cores) | arquivos estáticos | Confira se o Build Command tem `collectstatic` |
| Seed dá `ERRO ... já existe` | seed já rodou | Já está populado; confira no Table Editor |
| `psql` não reconhecido | caminho do PostgreSQL | Use o caminho completo (`C:\Program Files\PostgreSQL\17\bin\psql.exe`); troque `17` pela versão instalada |
| Site do GitHub Pages dá 404 | Pages não ativado | Settings → Pages → Source: **GitHub Actions** |
