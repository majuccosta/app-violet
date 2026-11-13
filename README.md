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
                                                    ├─► IA de análise de evidências (TensorFlow Lite)
                                                    ├─► Didit (verificação de identidade)
                                                    ├─► IBGE (estimativa de gênero pelo primeiro nome)
                                                    ├─► Google (entrar com Google)
                                                    └─► Brevo (e-mail de recuperação de senha)
```

O UptimeRobot consulta `GET /api/saude/` de tempos em tempos para a API do Render não dormir.

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
- **Verificação de identidade:** Didit (documento + selfie), com a regra "só mulheres" (gênero do documento; se faltar, estimativa pelo primeiro nome com a base do IBGE)
- **Login social:** Google (tokeninfo)
- **E-mail:** Brevo (API HTTP, porque o Render bloqueia SMTP)
- **Publicação:** GitHub Pages (front-end) e Render (API)
- **Monitoramento:** UptimeRobot (`/api/saude/`)

## Inteligência artificial nas denúncias

Quando a usuária anexa uma foto ou vídeo a uma denúncia, a API analisa o arquivo e indica se há **sinais de violência física** na cena, com um nível de confiança. O resultado fica salvo junto da evidência (tabela `denuncias_analiseia`) e aparece na tela de denúncia.

Limites conhecidos:

- A análise é um **apoio à triagem**. Ela **não comprova** a ocorrência; a avaliação final é sempre humana.
- O modelo detecta violência física em **imagens e vídeos**. Assédio sem agressão física, conversas (prints) e áudios **não são analisados**.
- Se a IA falhar, a denúncia é registrada normalmente.

O código está em `backend/apps/ia/`.

## Verificação de identidade e regra "só mulheres"

1. A usuária cria a conta e o app chama `POST /api/usuarias/verificacao/iniciar/`, que abre uma sessão na Didit.
2. Ela fotografa o documento e faz uma selfie na página da Didit. **As imagens ficam na Didit**; o Violet guarda só o resultado e o código da sessão.
3. A Didit avisa o Violet por webhook (assinatura HMAC `X-Signature-V2`, exige `DIDIT_WEBHOOK_SECRET`) e o app também consulta `GET /api/usuarias/verificacao/status/`.
4. Regra "só mulheres": gênero do documento F aprova e M reprova. Se o documento não informa o gênero, o Violet estima pelo primeiro nome com a tabela do IBGE (`apps/usuarias/dados/nomes_ibge.json`, gerada por `python manage.py baixar_nomes_ibge`; se faltar, consulta a API do IBGE). Caso ambíguo ou sem dado, a verificação fica **pendente** para revisão de uma administradora.
5. Depois de aprovada, o nome da conta passa a ser o do documento. A data de nascimento é a informada no cadastro e não muda depois.

Também há login com Google (`POST /api/auth/google/`): a conta nova entra sem verificação e sem data de nascimento, e passa pela tela "Complete seu cadastro".

## Como rodar localmente

Requisitos: Python 3.10 ou superior e PostgreSQL.

**1. Banco de dados e API**

```bash
createdb violet
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    |    Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # preencha com os dados do seu banco
python manage.py migrate    # cria as tabelas
psql -d violet -f ../database/seed.sql   # opcional: dados fictícios (só em desenvolvimento)
python manage.py runserver
```

A API sobe em `http://localhost:8000/api/`. O `database/schema.sql` é a estrutura de referência das 18 tabelas (veja `database/README.md`); para rodar a API use o `migrate`, que também cria as tabelas internas do Django.

**2. Variáveis de ambiente** (arquivo `backend/.env`, modelo em `backend/.env.example`; nunca suba o `.env` para o GitHub)

| Variável | Para que serve |
|---|---|
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Configuração básica do Django (em produção: `DJANGO_DEBUG=False`) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_SSLMODE`, `DB_CONN_MAX_AGE` | Conexão com o PostgreSQL (na nuvem: `DB_SSLMODE=require`) |
| `CORS_ORIGINS`, `CSRF_ORIGINS` | Endereços do front-end autorizados |
| `VERIFICACAO_DEMO` | `True` aprova a verificação sem a Didit (só para demonstração; desligue em produção) |
| `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_CALLBACK_URL` | Verificação de identidade real pela Didit |
| `GOOGLE_CLIENT_ID`, `GOOGLE_DOMINIOS` | Entrar com Google (domínios de e-mail permitidos são opcionais) |
| `BREVO_API_KEY`, `EMAIL_REMETENTE` | Envio de e-mail pela Brevo (o remetente precisa estar confirmado na Brevo) |

Sem `DIDIT_*`, `GOOGLE_CLIENT_ID` ou `BREVO_API_KEY`, o recurso correspondente fica desligado ou em modo de demonstração (o e-mail aparece no terminal do `runserver`).

**3. Front-end**

Abra a pasta `frontend/` com o Live Server do VS Code (porta 5500). Quando aberto em `localhost` ou `127.0.0.1`, o app usa automaticamente a API local; no GitHub Pages, ele usa a API do Render.

**Testes**

```bash
cd backend
python manage.py test            # todos os testes (158 em 12/11/2026)
python manage.py test apps.ia    # só a IA
```

## Equipe

- Maria Júlia de Carvalho Costa
- Laura Venancio Martins
- Sara Ramos Scalia
