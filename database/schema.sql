-- ==========================================================
-- VIOLET — Banco físico (PostgreSQL)
-- Espelha backend/apps/*/models.py no estado atual (18 tabelas do Violet).
-- Os nomes das tabelas seguem o padrão do Django (<app>_<modelo>).
-- Este script NÃO cria as tabelas internas do Django (sessões, permissões,
-- django_migrations...). Para a API rodar, use `python manage.py migrate`
-- (caminho recomendado em database/README.md); este arquivo serve como
-- referência e como entrega da estrutura do banco.
-- Atualizado em 12/11/2026: campo apelido; conversas com criadora e membros;
-- sem a tabela de conexões (removida na migração conversas 0004).
-- ==========================================================

BEGIN;

-- ---------- Usuárias ----------
CREATE TABLE usuarias_usuaria (
    id               BIGSERIAL PRIMARY KEY,
    password         VARCHAR(128) NOT NULL,              -- hash PBKDF2 gerado pelo Django
    last_login       TIMESTAMPTZ,
    is_superuser     BOOLEAN NOT NULL DEFAULT FALSE,
    username         VARCHAR(150) NOT NULL UNIQUE,
    first_name       VARCHAR(150) NOT NULL DEFAULT '',
    last_name        VARCHAR(150) NOT NULL DEFAULT '',
    email            VARCHAR(254) NOT NULL UNIQUE,
    is_staff         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nome_completo    VARCHAR(150) NOT NULL,
    apelido          VARCHAR(30)  NOT NULL DEFAULT '',    -- como a pessoa quer ser chamada; o nome do documento não muda
    data_nascimento  DATE,
    telefone         VARCHAR(20) NOT NULL DEFAULT '',
    verificada       BOOLEAN NOT NULL DEFAULT FALSE,
    modo_anonimo     BOOLEAN NOT NULL DEFAULT FALSE,
    cep              VARCHAR(9)   NOT NULL DEFAULT '',
    logradouro       VARCHAR(120) NOT NULL DEFAULT '',
    numero           VARCHAR(10)  NOT NULL DEFAULT '',
    complemento      VARCHAR(60)  NOT NULL DEFAULT '',
    bairro           VARCHAR(80)  NOT NULL DEFAULT '',
    cidade           VARCHAR(80)  NOT NULL DEFAULT '',
    uf               VARCHAR(2)   NOT NULL DEFAULT '',
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarias_preferencias (
    id              BIGSERIAL PRIMARY KEY,
    usuaria_id      BIGINT NOT NULL UNIQUE REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    notificacoes    BOOLEAN NOT NULL DEFAULT TRUE,
    som             BOOLEAN NOT NULL DEFAULT TRUE,
    vibracao        BOOLEAN NOT NULL DEFAULT TRUE,
    volume          SMALLINT NOT NULL DEFAULT 70 CHECK (volume BETWEEN 0 AND 100),
    toque           VARCHAR(20) NOT NULL DEFAULT 'padrao',
    usar_pin        BOOLEAN NOT NULL DEFAULT FALSE,
    usar_biometria  BOOLEAN NOT NULL DEFAULT FALSE,
    idioma            VARCHAR(5)  NOT NULL DEFAULT 'pt-BR' CHECK (idioma IN ('pt-BR','en','es')),
    priv_perfil       VARCHAR(12) NOT NULL DEFAULT 'contatos'  CHECK (priv_perfil IN ('contatos','verificadas','ninguem')),
    priv_localizacao  VARCHAR(12) NOT NULL DEFAULT 'alerta'    CHECK (priv_localizacao IN ('alerta','ativar','circulo')),
    priv_historico    VARCHAR(12) NOT NULL DEFAULT 'anonimo'   CHECK (priv_historico IN ('anonimo','identificado')),
    priv_contato      VARCHAR(12) NOT NULL DEFAULT 'ninguem'   CHECK (priv_contato IN ('ninguem','contatos')),
    visivel_circulo   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Só o resultado e o código da sessão na Didit. As imagens do documento e da selfie NÃO são guardadas aqui.
CREATE TABLE usuarias_verificacaoidentidade (
    id               BIGSERIAL PRIMARY KEY,
    usuaria_id       BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    tipo_documento   VARCHAR(3)  NOT NULL DEFAULT 'rg' CHECK (tipo_documento IN ('rg','cnh')),
    status           VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','reprovada')),
    id_sessao_didit  VARCHAR(120) NOT NULL DEFAULT '',
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Contatos de confiança ----------
CREATE TABLE contatos_contatoconfianca (
    id                       BIGSERIAL PRIMARY KEY,
    usuaria_id               BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    nome                     VARCHAR(120) NOT NULL,
    telefone                 VARCHAR(20)  NOT NULL,
    relacao                  VARCHAR(40)  NOT NULL DEFAULT '',
    de_confianca             BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = contato comum (sem alertas), máx. 5 de confiança
    compartilha_localizacao  BOOLEAN NOT NULL DEFAULT TRUE,
    recebe_alertas           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Emergência ----------
CREATE TABLE emergencia_alertaemergencia (
    id                 BIGSERIAL PRIMARY KEY,
    usuaria_id         BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    latitude           NUMERIC(9,6),
    longitude          NUMERIC(9,6),
    status             VARCHAR(10) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado','cancelado')),
    ligue180_acionado  BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    encerrado_em       TIMESTAMPTZ
);

CREATE TABLE emergencia_midiaalerta (
    id         BIGSERIAL PRIMARY KEY,
    alerta_id  BIGINT NOT NULL REFERENCES emergencia_alertaemergencia(id) ON DELETE CASCADE,
    tipo       VARCHAR(5) NOT NULL CHECK (tipo IN ('audio','foto','video')),
    arquivo    VARCHAR(100) NOT NULL,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Denúncias ----------
CREATE TABLE denuncias_denuncia (
    id               BIGSERIAL PRIMARY KEY,
    usuaria_id       BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE RESTRICT,
    protocolo        VARCHAR(20) NOT NULL UNIQUE,
    categoria        VARCHAR(15) NOT NULL CHECK (categoria IN ('assedio','ameaca','violencia','importunacao','perseguicao','outro')),
    envolvido        VARCHAR(15) NOT NULL DEFAULT 'nao_informado' CHECK (envolvido IN ('nao_informado','professor','funcionario','aluno','outro')),
    local            VARCHAR(200) NOT NULL,
    data_ocorrencia  DATE NOT NULL,
    hora_ocorrencia  TIME,
    descricao        TEXT NOT NULL,
    anonima          BOOLEAN NOT NULL DEFAULT TRUE,
    status           VARCHAR(10) NOT NULL DEFAULT 'andamento' CHECK (status IN ('andamento','concluida')),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE denuncias_evidencia (
    id             BIGSERIAL PRIMARY KEY,
    denuncia_id    BIGINT NOT NULL REFERENCES denuncias_denuncia(id) ON DELETE CASCADE,
    arquivo        VARCHAR(100) NOT NULL,
    tipo_mime      VARCHAR(80)  NOT NULL,
    tamanho_bytes  INTEGER NOT NULL CHECK (tamanho_bytes >= 0),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE denuncias_analiseia (
    id             BIGSERIAL PRIMARY KEY,
    evidencia_id   BIGINT NOT NULL UNIQUE REFERENCES denuncias_evidencia(id) ON DELETE CASCADE,
    indicios       BOOLEAN NOT NULL DEFAULT FALSE,
    confianca      DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (confianca BETWEEN 0 AND 1),
    rotulos        JSONB NOT NULL DEFAULT '[]',
    versao_modelo  VARCHAR(40) NOT NULL DEFAULT '',
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Conversas ----------
CREATE TABLE conversas_conversa (
    id         BIGSERIAL PRIMARY KEY,
    tipo       VARCHAR(10) NOT NULL DEFAULT 'contato' CHECK (tipo IN ('contato','apoio','anonima','grupo')),
    nome       VARCHAR(40) NOT NULL DEFAULT '',   -- só em grupos de conversa
    descricao  VARCHAR(80) NOT NULL DEFAULT '',
    cor        SMALLINT    NOT NULL DEFAULT 1,
    criadora_id  BIGINT REFERENCES usuarias_usuaria(id) ON DELETE SET NULL,   -- quem criou o grupo de conversa
    membros      JSONB  NOT NULL DEFAULT '[]',                                -- contatos convidados (nome + id; não precisam ter conta)
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversas_participante (
    id           BIGSERIAL PRIMARY KEY,
    conversa_id  BIGINT NOT NULL REFERENCES conversas_conversa(id) ON DELETE CASCADE,
    usuaria_id   BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    anonima      BOOLEAN NOT NULL DEFAULT FALSE,
    silenciada   BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (conversa_id, usuaria_id)
);

CREATE TABLE conversas_mensagem (
    id           BIGSERIAL PRIMARY KEY,
    conversa_id  BIGINT NOT NULL REFERENCES conversas_conversa(id) ON DELETE CASCADE,
    autora_id    BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    texto        TEXT NOT NULL,
    lida         BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Notificações ----------
CREATE TABLE notificacoes_notificacao (
    id          BIGSERIAL PRIMARY KEY,
    usuaria_id  BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    tipo        VARCHAR(12) NOT NULL DEFAULT 'sistema' CHECK (tipo IN ('mensagem','denuncia','contato','emergencia','sistema')),
    titulo      VARCHAR(120) NOT NULL,
    texto       VARCHAR(255) NOT NULL,
    lida        BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Orientações ----------
CREATE TABLE orientacoes_orientacao (
    id        BIGSERIAL PRIMARY KEY,
    slug      VARCHAR(50)  NOT NULL UNIQUE,
    titulo    VARCHAR(150) NOT NULL,
    resumo    VARCHAR(255) NOT NULL,
    icone     VARCHAR(40)  NOT NULL DEFAULT 'help-circle',
    conteudo  JSONB NOT NULL DEFAULT '{}',
    aviso     VARCHAR(255) NOT NULL DEFAULT '',
    ordem     SMALLINT NOT NULL DEFAULT 0,
    ativo     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Círculo de Apoio ----------
CREATE TABLE circulo_grupotrajeto (
    id              BIGSERIAL PRIMARY KEY,
    criadora_id     BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    nome            VARCHAR(80)  NOT NULL,
    ponto_encontro  VARCHAR(200) NOT NULL,
    destino         VARCHAR(200) NOT NULL,
    horario         TIMESTAMPTZ NOT NULL,
    vagas           SMALLINT NOT NULL DEFAULT 5 CHECK (vagas > 0),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE circulo_participacaogrupo (
    id          BIGSERIAL PRIMARY KEY,
    grupo_id    BIGINT NOT NULL REFERENCES circulo_grupotrajeto(id) ON DELETE CASCADE,
    usuaria_id  BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    entrou_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    saiu_em     TIMESTAMPTZ,
    UNIQUE (grupo_id, usuaria_id)
);

CREATE TABLE circulo_solicitacaoacompanhamento (
    id               BIGSERIAL PRIMARY KEY,
    solicitante_id   BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    destinataria_id  BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    status           VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada')),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (solicitante_id <> destinataria_id)
);

CREATE TABLE circulo_compartilhamentolocalizacao (
    id          BIGSERIAL PRIMARY KEY,
    usuaria_id  BIGINT NOT NULL REFERENCES usuarias_usuaria(id) ON DELETE CASCADE,
    grupo_id    BIGINT REFERENCES circulo_grupotrajeto(id) ON DELETE CASCADE,
    inicio      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em   TIMESTAMPTZ NOT NULL,
    encerrado   BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (expira_em > inicio)
);

-- ---------- Índices ----------
CREATE INDEX idx_contatos_usuaria      ON contatos_contatoconfianca (usuaria_id);
CREATE INDEX idx_alertas_usuaria       ON emergencia_alertaemergencia (usuaria_id, criado_em DESC);
CREATE INDEX idx_denuncias_usuaria     ON denuncias_denuncia (usuaria_id, criado_em DESC);
CREATE INDEX idx_denuncias_padroes     ON denuncias_denuncia (local, envolvido, categoria);
CREATE INDEX idx_mensagens_conversa    ON conversas_mensagem (conversa_id, criado_em);
CREATE INDEX idx_notificacoes_usuaria  ON notificacoes_notificacao (usuaria_id, lida);
CREATE INDEX idx_grupos_horario        ON circulo_grupotrajeto (horario) WHERE ativo;

COMMIT;
