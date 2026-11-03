# Backend — API Django REST Framework

Arquitetura MVC do documento de arquitetura, organizada por módulo em `apps/`:

| Camada (documento) | Onde fica no código |
|---|---|
| Bean / Model | `apps/<modulo>/models.py` |
| Action / Model | managers e métodos dos models |
| BusinessLogic | `apps/<modulo>/services.py` |
| Controller | `apps/<modulo>/views.py` + `urls.py` |
| View | `apps/<modulo>/serializers.py` + telas do `frontend/` |
| Persistence | Django ORM + PostgreSQL |

## Rodando localmente

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # preencha a senha do banco
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

A API fica em `http://localhost:8000/api/` e o admin em `http://localhost:8000/admin/`.

## Endpoints

| Método | Rota | Para quê |
|---|---|---|
| POST | `/api/auth/cadastro/` | Criar conta |
| POST | `/api/auth/login/` | Login (devolve token JWT `access` e `refresh`) |
| GET/PATCH | `/api/usuarias/me/` | Perfil e preferências |
| POST | `/api/usuarias/verificacao/` | Envio de RG/CNH (frente e verso) |
| CRUD | `/api/contatos/` | Contatos de confiança (máx. 5) |
| POST | `/api/emergencia/alertas/` | Acionar alerta |
| POST | `/api/emergencia/alertas/{id}/cancelar/` | Encerrar alerta |
| POST | `/api/emergencia/alertas/{id}/midias/` | Anexar áudio/foto/vídeo |
| GET/POST | `/api/denuncias/` | Histórico e nova denúncia (multipart, campo `evidencias`) |
| GET | `/api/conversas/` | Lista de conversas |
| GET/POST | `/api/conversas/{id}/mensagens/` | Mensagens |
| GET | `/api/notificacoes/` | Notificações |
| POST | `/api/notificacoes/marcar-lidas/` | Marcar todas como lidas |
| GET | `/api/orientacoes/` | Conteúdo de orientação (público) |
| CRUD | `/api/circulo/grupos/?busca=` | Grupos de trajeto (`/entrar/`, `/sair/`) |
| GET/POST | `/api/circulo/solicitacoes/` | Pedidos de acompanhamento (`/{id}/responder/`) |
| GET/POST/DELETE | `/api/circulo/localizacao/` | Localização autorizada por tempo limitado |
| GET | `/api/circulo/proximas/` | Quantas usuárias por perto |
| POST | `/api/ia/analisar/` | Prévia da análise de uma evidência |

Recuperação de senha (sem tabela extra, código de 6 dígitos válido por 15 min, uso único):

| Método | Rota | Corpo |
|---|---|---|
| POST | `/api/auth/recuperar-senha/` | `{destino}` (e-mail; o código aparece no terminal do `runserver`) |
| POST | `/api/auth/verificar-codigo/` | `{destino, codigo}` → `{valido}` |
| POST | `/api/auth/nova-senha/` | `{destino, codigo, senha}` |

## Testes

```bash
python manage.py test
```

## Ligando o front na API

Em `frontend/assets/js/api.js`, troque `USE_MOCK: true` por `false`. Os nomes das funções são os mesmos nos dois modos, então nenhuma tela precisa mudar.
