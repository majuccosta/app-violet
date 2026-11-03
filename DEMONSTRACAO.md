# 💜 Violet — Roteiro de demonstração (Banco de Dados + API)

Guia para apresentar ao professor, com o projeto aberto no computador. Tempo estimado: 10 a 15 minutos.

## 1. Antes da apresentação (10 min antes)

Abra **3 terminais** no VS Code, na pasta `backend`, com o ambiente virtual ativo (`.venv\Scripts\activate`).

| Terminal | Comando | Para quê |
|---|---|---|
| 1 | `python manage.py runserver` | API no ar em `http://127.0.0.1:8000` |
| 2 | `$env:PGCLIENTENCODING="UTF8"` e depois `& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d violet` | Consultar o banco |
| 3 | livre | Rodar os testes |

Deixe também abertos no navegador: `http://127.0.0.1:8000/admin/` (já logada com `mariajulia@ceub.edu.br` / `Violet@2026`) e o front pelo **Live Server** (com `USE_MOCK: false` em `frontend/assets/js/api.js`).

**Renove os grupos do Círculo** (os horários dos grupos de teste vencem com o tempo e somem da lista). No terminal 2, ou direto no PowerShell na pasta do projeto:

```
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d violet -f database\atualizar_demo.sql
```

Pode rodar quantas vezes quiser, não duplica nada.

Confira rápido: `/api/orientacoes/` abre um JSON? O login do app funciona? Se sim, está tudo pronto.

---

## 2. Parte 1 — Banco de dados (≈ 5 min)

**O que dizer:** "O banco é PostgreSQL, com 18 tabelas relacionadas por chaves estrangeiras, todas populadas com dados fictícios."

**2.1 Mostrar as tabelas.** No terminal 2 (psql):

```sql
\dt
```
Lista as tabelas do projeto (`usuarias_*`, `contatos_*`, `denuncias_*`, `conversas_*`, `circulo_*`, `emergencia_*`, `notificacoes_*`, `orientacoes_*`) e as internas do Django.

**2.2 Mostrar que estão populadas.**

```sql
SELECT 'usuarias' AS tabela, COUNT(*) FROM usuarias_usuaria
UNION ALL SELECT 'contatos', COUNT(*) FROM contatos_contatoconfianca
UNION ALL SELECT 'denuncias', COUNT(*) FROM denuncias_denuncia
UNION ALL SELECT 'conversas', COUNT(*) FROM conversas_conversa
UNION ALL SELECT 'mensagens', COUNT(*) FROM conversas_mensagem
UNION ALL SELECT 'grupos_trajeto', COUNT(*) FROM circulo_grupotrajeto
UNION ALL SELECT 'orientacoes', COUNT(*) FROM orientacoes_orientacao;
```

**2.3 Mostrar o relacionamento entre tabelas (JOIN).**

```sql
SELECT u.nome_completo AS usuaria, c.nome AS contato, c.relacao
FROM contatos_contatoconfianca c
JOIN usuarias_usuaria u ON u.id = c.usuaria_id
ORDER BY u.id;
```

```sql
SELECT g.nome AS grupo, u.nome_completo AS participante
FROM circulo_participacaogrupo p
JOIN circulo_grupotrajeto g ON g.id = p.grupo_id
JOIN usuarias_usuaria u ON u.id = p.usuaria_id
ORDER BY g.id;
```

**2.4 Mostrar uma regra importante: anonimato.**

```sql
SELECT protocolo, categoria, anonima, usuaria_id FROM denuncias_denuncia;
```
"O banco guarda internamente quem fez a denúncia (`usuaria_id`) para controle de acesso e segurança, mas a API **nunca** devolve essa informação" (isso é mostrado na Parte 2).

**2.5 Mostrar também no admin** (`/admin/`): clique em Usuárias, Denúncias e Conversas para ver os registros em tela. É a forma visual mais simples para quem não conhece SQL.

Para sair do psql: `\q`.

---

## 3. Parte 2 — API (≈ 5 min)

**O que dizer:** "A API é feita em Django REST Framework, segue a arquitetura MVC do documento, usa autenticação JWT e cada usuária só acessa os próprios dados."

**3.1 Endpoint público, direto no navegador.**
Abra `http://127.0.0.1:8000/api/orientacoes/`. Aparece o JSON das orientações, lido do PostgreSQL.

**3.2 Endpoint protegido.**
Abra `http://127.0.0.1:8000/api/contatos/` no navegador **sem login**: a API responde `401` (não autenticado). "Os dados privados exigem token."

**3.3 Login e dados da usuária (pelo app).**
No app (Live Server), entre com `mariajulia@ceub.edu.br` / `Violet@2026`. Mostre:
- a Home com o nome dela (vem de `/api/usuarias/me/`);
- Contatos, Conversas e Notificações (vêm do banco).

**3.4 Gravar no banco pelo app.**
Cadastre um contato novo (ou registre uma denúncia). Depois volte ao `/admin/` e mostre que o registro apareceu na tabela. Isso prova a integração ponta a ponta: **app → API → PostgreSQL**.

**3.5 Anonimato na API.**
Registre uma denúncia anônima pelo app. Com o app aberto, aperte **F12 → aba Rede (Network)**, clique na requisição `denuncias/` e abra **Resposta**. Ela traz protocolo, categoria e status, e **não traz** a identidade da usuária. (Abrir `/api/denuncias/` direto na barra do navegador dá `401`, porque o navegador não envia o token do app.)

**3.6 Testes automáticos.** No terminal 3:

```
python manage.py test
```
Resultado esperado: `Ran 21 tests ... OK`. Eles cobrem cadastro, login, recuperação de senha, anonimato de denúncia, limite de 5 contatos de confiança, isolamento entre usuárias e alerta de emergência.

---

## 4. Tabela de rotas (para consulta rápida)

| Método | Rota | Para quê |
|---|---|---|
| POST | `/api/auth/cadastro/` | Criar conta |
| POST | `/api/auth/login/` | Login (devolve JWT) |
| POST | `/api/auth/recuperar-senha/`, `/verificar-codigo/`, `/nova-senha/` | Recuperação de senha |
| GET/PATCH | `/api/usuarias/me/` | Perfil |
| CRUD | `/api/contatos/` | Contatos de confiança (máx. 5) |
| POST | `/api/emergencia/alertas/` | Acionar alerta |
| GET/POST | `/api/denuncias/` | Histórico e nova denúncia |
| GET/POST | `/api/conversas/` e `/api/conversas/{id}/mensagens/` | Conversas |
| GET | `/api/notificacoes/` | Notificações |
| GET | `/api/orientacoes/` | Orientações (público) |
| CRUD | `/api/circulo/grupos/` | Grupos de trajeto |

---

## 5. Perguntas que o professor pode fazer

- **"Onde estão as senhas?"** Guardadas com hash PBKDF2 (padrão do Django), nunca em texto puro.
- **"E se alguém tentar ver dados de outra usuária?"** Cada consulta filtra pela usuária logada; há testes que provam isso.
- **"A análise com IA já está ligada?"** O ponto de integração existe (`backend/apps/ia/services.py`); a conexão com o modelo final está na fase de integrações.
- **"E a verificação de identidade (Didit)?"** Também na fase de integrações. Hoje a verificação fica pendente em produção e é aprovada no modo de desenvolvimento.
- **"Por que o banco tem tabelas do Django?"** São tabelas internas (sessões, permissões e administração). As 18 tabelas do Violet são as que começam com o nome do módulo.

---

## 6. Subir no GitHub

Na raiz do projeto (a pasta `violet`, que contém `backend`, `frontend`, `database`):

```
git init
git add .
git commit -m "Violet: banco de dados PostgreSQL e API Django"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
git push -u origin main
```

Crie antes o repositório vazio no site do GitHub (sem README) e use o endereço que ele mostrar.

**Confira antes do `git add`:**
- o arquivo `backend/.env` **não** deve subir (ele tem a senha do banco). O `.gitignore` já bloqueia. Confirme com `git status`: ele não pode aparecer na lista;
- as pastas `backend/apps/*/migrations/` **devem** subir (são as migrations geradas);
- `.venv/` não sobe (também bloqueada pelo `.gitignore`).

Se quiser incluir o backup do banco, gere e coloque em `database/`:

```
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -d violet -f database\violet_backup.sql
```

### Como o professor (ou outra pessoa) roda a partir do GitHub

```
git clone https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
cd violet\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          (e preencher DB_PASSWORD)
```
Criar o banco `violet` no PostgreSQL e rodar:

```
python manage.py migrate
psql -U postgres -d violet -f ..\database\seed.sql
python manage.py runserver
```

Detalhes completos em `database/README.md` e `backend/README.md`.

---

## 7. Se algo der errado na hora

| Problema | Solução |
|---|---|
| App não loga | Veja se o `runserver` está rodando e se `USE_MOCK` está `false` |
| Erro de CORS no console (F12) | Confira a porta do Live Server em `CORS_ORIGINS` no `backend/.env` (padrão: 5500 e 8080) |
| `connection refused` ao subir a API | O serviço do PostgreSQL está desligado (Serviços do Windows → postgresql) |
| Senha do banco incorreta | Corrija `DB_PASSWORD` no `backend/.env` e reinicie o `runserver` |
| Quer refazer o seed do zero | `DROP DATABASE violet; CREATE DATABASE violet;` no psql, depois `migrate` e `seed.sql` |
| Plano B sem servidor | `USE_MOCK: true` mostra o app com dados de teste, sem API |
