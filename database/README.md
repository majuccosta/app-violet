# Banco de dados — PostgreSQL

| Arquivo | O que é |
|---|---|
| `schema.sql` | Estrutura das 18 tabelas do Violet, com chaves estrangeiras, `CHECK`s e índices (referência e entrega do banco) |
| `seed.sql` | Dados fictícios de teste para todas as tabelas |
| `atualizar_demo.sql` | Renova os horários dos grupos do Círculo de Apoio antes de uma apresentação |
| `supabase_rls.sql` | Ativa o RLS no Supabase (rode uma vez, depois do seed) |

Os nomes das tabelas seguem o padrão do Django (`<app>_<modelo>`) e espelham `backend/apps/*/models.py`.

> **Importante:** o `schema.sql` cria só as **18 tabelas do Violet**. A API também precisa das tabelas internas do Django (sessões, permissões, `django_migrations`), que só o `manage.py migrate` cria. Por isso, para rodar a API, use o caminho recomendado abaixo. Use **um** dos dois caminhos num banco vazio, nunca os dois juntos.

## Caminho recomendado (banco + API funcionando juntos)

As migrações já estão no repositório (`backend/apps/*/migrations/`). Não precisa rodar `makemigrations`.

```bash
createdb -U postgres violet                         # 1. cria o banco vazio
cd backend
python -m venv .venv && .venv\Scripts\activate     # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                              # preencha DB_PASSWORD (cp no Linux/Mac)
python manage.py migrate                            # 2. cria as tabelas (Violet + internas do Django)
psql -U postgres -d violet -f ../database/seed.sql  # 3. popula com dados de teste (só em desenvolvimento)
python manage.py runserver                          # 4. API em http://localhost:8000/api/
```

Quando um model muda, gere a migração (`python manage.py makemigrations`), rode `migrate` e guarde o arquivo novo no Git. Depois, atualize também o `schema.sql`.

## Só a estrutura, sem Django (entrega do banco físico)

```bash
createdb -U postgres violet
psql -U postgres -d violet -f database/schema.sql
psql -U postgres -d violet -f database/seed.sql
```

Esse banco tem as 18 tabelas, mas **não serve para a API** (faltam as tabelas internas do Django).

## Entregar o banco físico ao professor

Depois de criado e populado: `pg_dump -U postgres -d violet -f violet_backup.sql` gera um arquivo único com estrutura e dados.

## Acesso de teste (só em desenvolvimento)

Todas as usuárias do `seed.sql` entram com a senha **`Violet@2026`**, e `mariajulia@ceub.edu.br` também é administradora do Django (`/admin`). Essas contas são fictícias e a senha é pública: **nunca rode o `seed.sql` no banco de produção real** (ou troque a senha logo depois).

## Mapa das tabelas (18)

- **Usuárias:** `usuarias_usuaria`, `usuarias_preferencias`, `usuarias_verificacaoidentidade`
- **Contatos de confiança:** `contatos_contatoconfianca`
- **Emergência:** `emergencia_alertaemergencia`, `emergencia_midiaalerta`
- **Denúncias:** `denuncias_denuncia`, `denuncias_evidencia`, `denuncias_analiseia`
- **Conversas:** `conversas_conversa`, `conversas_participante`, `conversas_mensagem`
- **Notificações:** `notificacoes_notificacao`
- **Orientações:** `orientacoes_orientacao`
- **Círculo de Apoio:** `circulo_grupotrajeto`, `circulo_participacaogrupo`, `circulo_solicitacaoacompanhamento`, `circulo_compartilhamentolocalizacao`

## Pontos de atenção

- **Anonimato:** `denuncias_denuncia.usuaria_id` existe por segurança e controle de acesso, mas a API nunca devolve esse campo no relato.
- **Verificação de identidade:** `usuarias_verificacaoidentidade` guarda só o resultado (`pendente`, `aprovada` ou `reprovada`) e o código da sessão na Didit. As imagens do documento e da selfie ficam na Didit, não no banco.
- **Recuperação de senha:** o código de 6 dígitos é calculado (HMAC) e não tem tabela.
- **Migração `conversas.0004_delete_conexao`:** apaga a tabela de conexões (a busca de usuárias foi removida e será refeita depois). A `0003_conexao` continua no histórico de propósito, porque pode já ter sido aplicada no banco da nuvem.
