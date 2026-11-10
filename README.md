# Violet — Aplicação

**Violet** é um aplicativo de segurança feminina no ambiente acadêmico: botão de emergência, contatos de confiança, denúncias com evidências, círculo de apoio para trajetos e conversas entre usuárias verificadas.

Projeto de extensão do curso de Ciência da Computação do CEUB.

> **Este repositório é onde a aplicação roda.** Ele é a fonte da publicação do app: o front-end é publicado daqui pelo GitHub Pages e a API é publicada daqui pelo Render. O repositório entregue à faculdade (`CAMPUSCEUB/CCO-VIOLET`, privado) guarda a cópia da entrega em `entregas/` e a documentação.

## Acesse

| O quê | Onde |
|---|---|
| Aplicativo (front-end) | https://majuccosta.github.io/app-violet/ |
| API (back-end) | https://violet-api-9441.onrender.com/api/ |
| Painel administrativo | https://violet-api-9441.onrender.com/admin/ |

A API roda no plano gratuito do Render e **dorme após alguns minutos sem uso**. O primeiro acesso depois disso pode levar de 1 a 3 minutos para responder. É só aguardar.

## Como as peças se conectam

```
 Usuária ──► Front-end (GitHub Pages) ──► API (Render, Django REST) ──► Banco (PostgreSQL / Supabase)
                                                    │
                                                    └─► IA de análise de evidências (TensorFlow Lite)
```

## Estrutura do repositório

| Pasta | O que tem |
|---|---|
| `frontend/` | Telas em HTML, CSS e JavaScript puro (sem framework). É a pasta publicada no GitHub Pages. |
| `backend/` | API em Django + Django REST Framework, com autenticação por token (JWT). |
| `database/` | Scripts do banco PostgreSQL: `schema.sql` (tabelas) e `seed.sql` (dados de demonstração). |
| `.github/workflows/` | Publicação automática do front-end no GitHub Pages a cada push na `main`. |

### Módulos da API (`backend/apps/`)

`usuarias` · `contatos` · `emergencia` · `denuncias` · `conversas` · `notificacoes` · `orientacoes` · `circulo` · `ia` · `comum`

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript
- **Back-end:** Python, Django, Django REST Framework, SimpleJWT
- **Banco de dados:** PostgreSQL (Supabase)
- **IA:** TensorFlow Lite (`ai-edge-litert`) com modelo MobileNetV2
- **Publicação:** GitHub Pages (front-end) e Render (API)

## Inteligência artificial nas denúncias

Quando a usuária anexa uma foto ou vídeo a uma denúncia, a API analisa o arquivo e indica se há **sinais de violência física** na cena, com um nível de confiança. O resultado fica salvo junto da evidência (tabela `denuncias_analiseia`) e aparece na tela de denúncia.

Limites conhecidos:

- A análise é um **apoio à triagem**. Ela **não comprova** a ocorrência; a avaliação final é sempre humana.
- O modelo detecta violência física em **imagens e vídeos**. Assédio sem agressão física, conversas (prints) e áudios **não são analisados**.
- Se a IA falhar, a denúncia é registrada normalmente.

O código está em `backend/apps/ia/`.

## Como rodar localmente

Requisitos: Python 3.10 ou superior e PostgreSQL.

**1. Banco de dados**

```bash
createdb violet
psql -d violet -f database/schema.sql
psql -d violet -f database/seed.sql
```

**2. API**

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    |    Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # preencha com os dados do seu banco
python manage.py runserver
```

A API sobe em `http://localhost:8000/api/`.

**3. Front-end**

Abra a pasta `frontend/` com o Live Server do VS Code (porta 5500). Quando aberto em `localhost` ou `127.0.0.1`, o app usa automaticamente a API local; no GitHub Pages, ele usa a API do Render.

> Atenção: o banco local e o banco publicado são **diferentes**. Contas e dados criados em um não existem no outro.

**Testes da IA**

```bash
cd backend
python -m unittest apps.ia.tests -v
```

## Segurança

- O arquivo `.env` (senhas, chaves e configuração do banco) **nunca** é enviado ao GitHub. Use o `.env.example` como modelo.
- As contas de demonstração e as instruções de teste foram entregues à banca no repositório da faculdade.

## Equipe

- Maria Júlia de Carvalho Costa
- Laura Venancio Martins
- Sara Ramos Scalia
