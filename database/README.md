# Banco de dados — PostgreSQL

| Arquivo | O que é |
|---|---|
| `schema.sql` | Cria as 18 tabelas com chaves estrangeiras, `CHECK`s e índices |
| `seed.sql` | Popula todas as tabelas com dados fictícios de teste |

Os nomes das tabelas seguem o padrão do Django (`<app>_<modelo>`), então o banco criado por este script é o mesmo que o `manage.py migrate` cria a partir de `backend/apps/*/models.py`.

## Caminho recomendado (banco + API funcionando juntos)

```bash
createdb -U postgres violet                         # 1. cria o banco vazio
cd backend
python -m venv .venv && .venv\Scripts\activate     # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                              # preencha DB_PASSWORD (cp no Linux/Mac)
python manage.py makemigrations usuarias contatos emergencia denuncias conversas notificacoes orientacoes circulo
python manage.py migrate                            # 2. cria as tabelas (+ tabelas internas do Django)
psql -U postgres -d violet -f ../database/seed.sql  # 3. popula
python manage.py runserver                          # 4. API em http://localhost:8000/api/
```

> Faça o `makemigrations` **antes** do `migrate` e depois guarde a pasta `migrations/` de cada app no Git.

## Só o banco, sem Django (script de entrega)

```bash
createdb -U postgres violet
psql -U postgres -d violet -f database/schema.sql
psql -U postgres -d violet -f database/seed.sql
```

`schema.sql` cria as 18 tabelas do projeto. Para a API rodar em cima desse banco, rode depois `python manage.py migrate` só se já tiver gerado as migrations; senão use o caminho recomendado acima. Use **um** dos caminhos num banco vazio.

## Entregar o banco físico ao professor

Depois de criado e populado: `pg_dump -U postgres -d violet -f violet_backup.sql` gera um arquivo único com estrutura e dados.

## Acesso de teste

Todas as usuárias do `seed.sql` entram com a senha **`Violet@2026`**. A conta `mariajulia@ceub.edu.br` também é admin do Django (`/admin`).

## Mapa das tabelas

- **Usuárias:** `usuarias_usuaria`, `usuarias_preferencias`, `usuarias_verificacaoidentidade`
- **Contatos de confiança:** `contatos_contatoconfianca`
- **Emergência:** `emergencia_alertaemergencia`, `emergencia_midiaalerta`
- **Denúncias:** `denuncias_denuncia`, `denuncias_evidencia`, `denuncias_analiseia`
- **Conversas:** `conversas_conversa`, `conversas_participante`, `conversas_mensagem`
- **Notificações:** `notificacoes_notificacao`
- **Orientações:** `orientacoes_orientacao`
- **Círculo de Apoio:** `circulo_grupotrajeto`, `circulo_participacaogrupo`, `circulo_solicitacaoacompanhamento`, `circulo_compartilhamentolocalizacao`

Anonimato: `denuncias_denuncia.usuaria_id` existe por segurança e controle de acesso, mas a API nunca devolve esse campo no relato.
