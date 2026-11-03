-- ==========================================================
-- VIOLET — Segurança no Supabase (rode UMA vez, depois do seed)
-- O Supabase expõe as tabelas do schema "public" por uma API própria.
-- Ativar o RLS (Row Level Security) SEM criar políticas bloqueia esse acesso
-- externo. A API Django continua funcionando, porque conecta com o usuário
-- dono do banco, que ignora o RLS.
-- ==========================================================
ALTER TABLE IF EXISTS public.usuarias_usuaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarias_preferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarias_verificacaoidentidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contatos_contatoconfianca ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergencia_alertaemergencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emergencia_midiaalerta ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.denuncias_denuncia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.denuncias_evidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.denuncias_analiseia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversas_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversas_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversas_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notificacoes_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orientacoes_orientacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circulo_grupotrajeto ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circulo_participacaogrupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circulo_solicitacaoacompanhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circulo_compartilhamentolocalizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.django_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.django_content_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.django_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.django_admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarias_usuaria_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarias_usuaria_user_permissions ENABLE ROW LEVEL SECURITY;
