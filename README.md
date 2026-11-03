# 💜 Violet — Denúncia e proteção à mulher no ambiente acadêmico

Projeto de extensão e pesquisa do **CEUB** (FATECS). Aplicativo com botão de emergência, denúncia anônima com análise de evidências por IA, rede de contatos de confiança, conversas, orientações e Círculo de Apoio.

**Equipe:** Laura Venancio Martins · Maria Júlia de Carvalho Costa · Sara Ramos Scalia

## Estrutura do repositório

```
violet/
├── frontend/     HTML, CSS e JavaScript (telas do app)       → frontend/README.md
├── backend/      API Django + Django REST Framework           → backend/README.md
├── database/     PostgreSQL: schema.sql + seed.sql            → database/README.md
└── ia/           Modelo de IA de análise de evidências        → ia/README.md
```

## Entregas (05 a 25/10)

| Entrega | Onde está | Situação |
|---|---|---|
| Protótipo (alta fidelidade) | Figma | Falta o Círculo de Apoio |
| Front-end (HTML/CSS/JS) | `frontend/` | Todas as telas do protótipo, com dados de teste |
| Banco de dados (tabelas relacionadas e populadas) | `database/` | 18 tabelas + dados de exemplo |
| API | `backend/` | Models, endpoints e regras principais |
| Integrações | — | Próxima fase (Didit, SMS/WhatsApp, Ligue 180) |

Roteiro para apresentar banco e API: **DEMONSTRACAO.md**. Para publicar online (Supabase + Render + GitHub Pages): **PUBLICAR.md**.

## Rodando tudo

```bash
# 1. Banco
createdb violet
psql -d violet -f database/schema.sql
psql -d violet -f database/seed.sql

# 2. API
cd backend && pip install -r requirements.txt && cp .env.example .env
python manage.py runserver

# 3. Front (outro terminal)
cd frontend && python -m http.server 5500
```

O front funciona sozinho com dados de teste. Para usar a API, mude `USE_MOCK` para `false` em `frontend/assets/js/api.js`.

## Como trabalhamos no GitHub

- `main` sempre funcionando. Cada uma trabalha numa branch: `front/nome-da-tela`, `api/modulo`, `db/ajuste`.
- Abra um Pull Request para a `main` e peça revisão de outra integrante.
- Nunca suba `backend/.env`, senhas ou arquivos de evidências reais.

| Pasta | Responsável |
|---|---|
| `frontend/` | Maria Júlia |
| `backend/` | _definir_ |
| `database/` | _definir_ |
| `ia/` | equipe |

## Princípios do projeto

- O Violet **não substitui** os serviços oficiais (190, 180).
- Anonimato = a identidade não aparece no relato; ela fica registrada internamente por segurança (LGPD).
- A análise da IA é apoio e **nunca** comprova uma ocorrência.
