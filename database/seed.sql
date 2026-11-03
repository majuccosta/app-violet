-- ==========================================================
-- VIOLET — Dados de exemplo (população do banco)
-- Rode DEPOIS de schema.sql ou de `python manage.py migrate`.
-- Todas as usuárias abaixo entram com a senha:  Violet@2026
-- Dados fictícios, criados só para teste.
-- ==========================================================

BEGIN;

-- O Django não cria DEFAULT no banco (aplica pelo Python). Estes comandos deixam o banco
-- igual ao schema.sql, então o seed funciona nos dois caminhos.
ALTER TABLE usuarias_usuaria ALTER COLUMN is_superuser SET DEFAULT FALSE;
ALTER TABLE usuarias_usuaria ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN last_name SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN is_staff SET DEFAULT FALSE;
ALTER TABLE usuarias_usuaria ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE usuarias_usuaria ALTER COLUMN date_joined SET DEFAULT NOW();
ALTER TABLE usuarias_usuaria ALTER COLUMN telefone SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN verificada SET DEFAULT FALSE;
ALTER TABLE usuarias_usuaria ALTER COLUMN modo_anonimo SET DEFAULT FALSE;
ALTER TABLE usuarias_usuaria ALTER COLUMN cep SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN logradouro SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN numero SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN complemento SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN bairro SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN cidade SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN uf SET DEFAULT '';
ALTER TABLE usuarias_usuaria ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE usuarias_preferencias ALTER COLUMN notificacoes SET DEFAULT TRUE;
ALTER TABLE usuarias_preferencias ALTER COLUMN som SET DEFAULT TRUE;
ALTER TABLE usuarias_preferencias ALTER COLUMN vibracao SET DEFAULT TRUE;
ALTER TABLE usuarias_preferencias ALTER COLUMN volume SET DEFAULT 70;
ALTER TABLE usuarias_preferencias ALTER COLUMN toque SET DEFAULT 'padrao';
ALTER TABLE usuarias_preferencias ALTER COLUMN usar_pin SET DEFAULT FALSE;
ALTER TABLE usuarias_preferencias ALTER COLUMN usar_biometria SET DEFAULT FALSE;
ALTER TABLE usuarias_preferencias ALTER COLUMN idioma SET DEFAULT 'pt-BR';
ALTER TABLE usuarias_preferencias ALTER COLUMN priv_perfil SET DEFAULT 'contatos';
ALTER TABLE usuarias_preferencias ALTER COLUMN priv_localizacao SET DEFAULT 'alerta';
ALTER TABLE usuarias_preferencias ALTER COLUMN priv_historico SET DEFAULT 'anonimo';
ALTER TABLE usuarias_preferencias ALTER COLUMN priv_contato SET DEFAULT 'ninguem';
ALTER TABLE usuarias_preferencias ALTER COLUMN visivel_circulo SET DEFAULT TRUE;
ALTER TABLE usuarias_verificacaoidentidade ALTER COLUMN tipo_documento SET DEFAULT 'rg';
ALTER TABLE usuarias_verificacaoidentidade ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE usuarias_verificacaoidentidade ALTER COLUMN id_sessao_didit SET DEFAULT '';
ALTER TABLE usuarias_verificacaoidentidade ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE contatos_contatoconfianca ALTER COLUMN relacao SET DEFAULT '';
ALTER TABLE contatos_contatoconfianca ALTER COLUMN de_confianca SET DEFAULT TRUE;
ALTER TABLE contatos_contatoconfianca ALTER COLUMN compartilha_localizacao SET DEFAULT TRUE;
ALTER TABLE contatos_contatoconfianca ALTER COLUMN recebe_alertas SET DEFAULT TRUE;
ALTER TABLE contatos_contatoconfianca ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE emergencia_alertaemergencia ALTER COLUMN status SET DEFAULT 'ativo';
ALTER TABLE emergencia_alertaemergencia ALTER COLUMN ligue180_acionado SET DEFAULT FALSE;
ALTER TABLE emergencia_alertaemergencia ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE emergencia_midiaalerta ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE denuncias_denuncia ALTER COLUMN envolvido SET DEFAULT 'nao_informado';
ALTER TABLE denuncias_denuncia ALTER COLUMN anonima SET DEFAULT TRUE;
ALTER TABLE denuncias_denuncia ALTER COLUMN status SET DEFAULT 'andamento';
ALTER TABLE denuncias_denuncia ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE denuncias_evidencia ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE denuncias_analiseia ALTER COLUMN indicios SET DEFAULT FALSE;
ALTER TABLE denuncias_analiseia ALTER COLUMN confianca SET DEFAULT 0;
ALTER TABLE denuncias_analiseia ALTER COLUMN rotulos SET DEFAULT '[]';
ALTER TABLE denuncias_analiseia ALTER COLUMN versao_modelo SET DEFAULT '';
ALTER TABLE denuncias_analiseia ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE conversas_conversa ALTER COLUMN tipo SET DEFAULT 'contato';
ALTER TABLE conversas_conversa ALTER COLUMN nome SET DEFAULT '';
ALTER TABLE conversas_conversa ALTER COLUMN descricao SET DEFAULT '';
ALTER TABLE conversas_conversa ALTER COLUMN cor SET DEFAULT 1;
ALTER TABLE conversas_conversa ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE conversas_conversa ALTER COLUMN membros SET DEFAULT '[]';
ALTER TABLE conversas_participante ALTER COLUMN anonima SET DEFAULT FALSE;
ALTER TABLE conversas_participante ALTER COLUMN silenciada SET DEFAULT FALSE;
ALTER TABLE conversas_mensagem ALTER COLUMN lida SET DEFAULT FALSE;
ALTER TABLE conversas_mensagem ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE notificacoes_notificacao ALTER COLUMN tipo SET DEFAULT 'sistema';
ALTER TABLE notificacoes_notificacao ALTER COLUMN lida SET DEFAULT FALSE;
ALTER TABLE notificacoes_notificacao ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE orientacoes_orientacao ALTER COLUMN icone SET DEFAULT 'help-circle';
ALTER TABLE orientacoes_orientacao ALTER COLUMN conteudo SET DEFAULT '{}';
ALTER TABLE orientacoes_orientacao ALTER COLUMN aviso SET DEFAULT '';
ALTER TABLE orientacoes_orientacao ALTER COLUMN ordem SET DEFAULT 0;
ALTER TABLE orientacoes_orientacao ALTER COLUMN ativo SET DEFAULT TRUE;
ALTER TABLE circulo_grupotrajeto ALTER COLUMN vagas SET DEFAULT 5;
ALTER TABLE circulo_grupotrajeto ALTER COLUMN ativo SET DEFAULT TRUE;
ALTER TABLE circulo_grupotrajeto ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE circulo_participacaogrupo ALTER COLUMN entrou_em SET DEFAULT NOW();
ALTER TABLE circulo_solicitacaoacompanhamento ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE circulo_solicitacaoacompanhamento ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE circulo_compartilhamentolocalizacao ALTER COLUMN inicio SET DEFAULT NOW();
ALTER TABLE circulo_compartilhamentolocalizacao ALTER COLUMN encerrado SET DEFAULT FALSE;

-- Hash PBKDF2 (formato Django) da senha "Violet@2026"
\set senha '''pbkdf2_sha256$870000$violetseed2026xyz$VgBm+wzYe8PspSTNv9RHtw93JL3gn1ywsIZ4T/iVz2A='''

INSERT INTO usuarias_usuaria (id, password, username, email, nome_completo, data_nascimento, telefone, verificada, modo_anonimo, is_staff, is_superuser) VALUES
 (1, :senha, 'mariajulia@ceub.edu.br', 'mariajulia@ceub.edu.br', 'Maria Júlia de Carvalho Costa', '2005-05-14', '(61) 99111-0001', TRUE,  FALSE, TRUE,  TRUE),
 (2, :senha, 'valen@ceub.edu.br',      'valen@ceub.edu.br',      'Valentina Souza',               '2004-09-02', '(61) 99111-0002', TRUE,  FALSE, FALSE, FALSE),
 (3, :senha, 'pam@ceub.edu.br',        'pam@ceub.edu.br',        'Pamela Ribeiro',                '2005-01-20', '(61) 99111-0003', TRUE,  FALSE, FALSE, FALSE),
 (4, :senha, 'kirby@ceub.edu.br',      'kirby@ceub.edu.br',      'Kirby Oliveira',                '2003-11-11', '(61) 99111-0004', TRUE,  FALSE, FALSE, FALSE),
 (5, :senha, 'ana@ceub.edu.br',        'ana@ceub.edu.br',        'Ana Clara Mendes',              '2004-03-08', '(61) 99111-0005', TRUE,  FALSE, FALSE, FALSE),
 (6, :senha, 'luara@ceub.edu.br',      'luara@ceub.edu.br',      'Luara Santos',                  '2005-07-30', '(61) 99111-0006', TRUE,  TRUE,  FALSE, FALSE),
 (7, :senha, 'nova@ceub.edu.br',       'nova@ceub.edu.br',       'Usuária Em Verificação',        '2006-02-15', '',                FALSE, FALSE, FALSE, FALSE);
SELECT setval('usuarias_usuaria_id_seq', (SELECT MAX(id) FROM usuarias_usuaria));

INSERT INTO usuarias_preferencias (usuaria_id, notificacoes, som, vibracao, volume, toque, usar_pin, usar_biometria) VALUES
 (1, TRUE, TRUE, TRUE, 70, 'padrao', TRUE, TRUE),
 (2, TRUE, FALSE, TRUE, 50, 'suave', FALSE, TRUE),
 (3, TRUE, TRUE, TRUE, 80, 'alerta', FALSE, FALSE),
 (4, FALSE, FALSE, TRUE, 40, 'discreto', TRUE, FALSE),
 (5, TRUE, TRUE, TRUE, 70, 'padrao', FALSE, FALSE),
 (6, TRUE, TRUE, FALSE, 60, 'padrao', TRUE, TRUE),
 (7, TRUE, TRUE, TRUE, 70, 'padrao', FALSE, FALSE);

INSERT INTO usuarias_verificacaoidentidade (usuaria_id, tipo_documento, status, id_sessao_didit) VALUES
 (1, 'rg',  'aprovada',  'didit-demo-0001'),
 (2, 'cnh', 'aprovada',  'didit-demo-0002'),
 (3, 'rg',  'aprovada',  'didit-demo-0003'),
 (4, 'rg',  'aprovada',  'didit-demo-0004'),
 (5, 'cnh', 'aprovada',  'didit-demo-0005'),
 (6, 'rg',  'aprovada',  'didit-demo-0006'),
 (7, 'rg',  'pendente',  'didit-demo-0007');

INSERT INTO contatos_contatoconfianca (usuaria_id, nome, telefone, relacao, compartilha_localizacao, recebe_alertas) VALUES
 (1, 'Laura Martins', '(61) 99876-5432', 'Amiga', TRUE,  TRUE),
 (1, 'Camila Almeida', '(61) 98765-4321', 'Irmã', TRUE,  TRUE),
 (1, 'Beatriz Rocha', '(61) 98533-2211', 'Prima', FALSE, TRUE),
 (2, 'Helena Souza',  '(61) 99222-1100', 'Mãe',   TRUE,  TRUE),
 (3, 'Renata Ribeiro','(61) 99333-4455', 'Mãe',   TRUE,  TRUE),
 (5, 'Júlia Mendes',  '(61) 99444-7788', 'Irmã',  TRUE,  TRUE),
 (1, 'Valentina Souza',   '(61) 99111-0002', 'Amiga', TRUE,  TRUE),
 (1, 'Ana Clara Mendes',  '(61) 99111-0005', 'Amiga', TRUE,  TRUE);

INSERT INTO emergencia_alertaemergencia (usuaria_id, latitude, longitude, status, ligue180_acionado, criado_em, encerrado_em) VALUES
 (1, -15.766900, -47.892700, 'encerrado', TRUE, '2026-03-20 19:22-03', '2026-03-20 19:41-03'),
 (3, -15.767300, -47.893100, 'cancelado', FALSE, '2026-04-02 22:05-03', '2026-04-02 22:06-03');

INSERT INTO emergencia_midiaalerta (alerta_id, tipo, arquivo) VALUES
 (1, 'audio', 'privado/alertas/2026/03/alerta-1.webm');

INSERT INTO denuncias_denuncia (id, usuaria_id, protocolo, categoria, envolvido, local, data_ocorrencia, hora_ocorrencia, descricao, anonima, status, criado_em) VALUES
 (1, 1, 'PEN-2026-000042', 'outro',        'aluno',       'Evento acadêmico',                '2026-02-15', '13:40', 'Comentários constrangedores durante a apresentação do evento.', TRUE,  'concluida', '2026-02-15 18:00-03'),
 (2, 1, 'PEN-2026-000081', 'importunacao', 'aluno',       'Biblioteca — Sala de estudos',    '2026-03-02', '18:30', 'Um colega se aproximou várias vezes sem consentimento.',        TRUE,  'andamento', '2026-03-02 20:10-03'),
 (3, 1, 'PEN-2026-000097', 'ameaca',       'nao_informado','Estacionamento da instituição',  '2026-03-12', '21:15', 'Recebi ameaças verbais ao sair da aula noturna.',               TRUE,  'concluida', '2026-03-13 09:00-03'),
 (4, 1, 'PEN-2026-000118', 'assedio',      'professor',   'Prédio A — Corredor',             '2026-03-20', '19:20', 'Estava sendo seguida por um colega após a aula.',               TRUE,  'andamento', '2026-03-20 20:00-03'),
 (5, 2, 'PEN-2026-000119', 'assedio',      'professor',   'Prédio A — Corredor',             '2026-03-22', '19:05', 'Abordagem insistente com comentários sobre aparência.',         TRUE,  'andamento', '2026-03-22 21:30-03'),
 (6, 5, 'PEN-2026-000120', 'perseguicao',  'aluno',       'Bloco 3 — Saída lateral',         '2026-04-10', '22:00', 'Pessoa me acompanhou até o ponto de ônibus.',                   FALSE, 'andamento', '2026-04-10 23:00-03');
SELECT setval('denuncias_denuncia_id_seq', (SELECT MAX(id) FROM denuncias_denuncia));

INSERT INTO denuncias_evidencia (id, denuncia_id, arquivo, tipo_mime, tamanho_bytes) VALUES
 (1, 4, 'privado/evidencias/2026/03/print-conversa.png', 'image/png', 284113),
 (2, 4, 'privado/evidencias/2026/03/audio-corredor.m4a', 'audio/mp4', 1048576),
 (3, 5, 'privado/evidencias/2026/03/video-camera.mp4',   'video/mp4', 7340032);
SELECT setval('denuncias_evidencia_id_seq', (SELECT MAX(id) FROM denuncias_evidencia));

INSERT INTO denuncias_analiseia (evidencia_id, indicios, confianca, rotulos, versao_modelo) VALUES
 (1, TRUE,  0.64, '["linguagem intimidadora"]', 'violet-ia-0.1'),
 (2, FALSE, 0.21, '[]',                         'violet-ia-0.1'),
 (3, TRUE,  0.78, '["aproximação insistente", "seguimento"]', 'violet-ia-0.1');

INSERT INTO conversas_conversa (id, tipo, nome) VALUES (1,'contato',''),(2,'contato',''),(3,'contato',''),(4,'contato',''),(5,'grupo','Saída noturna');
SELECT setval('conversas_conversa_id_seq', 5);
UPDATE conversas_conversa SET criadora_id = 1, cor = 2 WHERE id = 5;

INSERT INTO conversas_participante (conversa_id, usuaria_id, anonima) VALUES
 (1,1,FALSE),(1,2,FALSE),
 (2,1,FALSE),(2,3,FALSE),
 (3,1,FALSE),(3,4,FALSE),
 (4,1,FALSE),(4,5,FALSE),
 (5,1,FALSE),(5,2,FALSE),(5,5,FALSE);

INSERT INTO conversas_mensagem (conversa_id, autora_id, texto, lida, criado_em) VALUES
 (1,2,'Estarei aqui pra você se precisar, amiga!', FALSE, '2026-10-26 09:50-03'),
 (2,3,'Entendi! Me avisa quando chegar.',          FALSE, '2026-10-26 09:59-03'),
 (3,4,'Isso vem acontecendo faz tempo?',            TRUE,  '2026-10-26 09:00-03'),
 (4,1,'Oi, Ana! Você está por aí?',                 TRUE,  '2026-10-26 10:02-03'),
 (4,5,'Oi, Maju! Estou sim. Aconteceu alguma coisa?', TRUE, '2026-10-26 10:03-03'),
 (4,1,'Aconteceu uma situação na faculdade e eu fiquei bastante desconfortável.', TRUE, '2026-10-26 10:04-03'),
 (4,5,'Poxa, sinto muito. Quer me contar o que aconteceu?', TRUE, '2026-10-26 10:04-03'),
 (4,1,'Ainda não consigo falar sobre tudo, mas precisava conversar com alguém.', TRUE, '2026-10-26 10:06-03'),
 (4,5,'Claro. Você pode falar quando se sentir preparada. Estou aqui para te ouvir 💜', FALSE, '2026-10-26 10:07-03'),
 (4,1,'Obrigada, Ana.', TRUE, '2026-10-26 10:08-03'),
 (5,2,'Pessoal, saio às 22h10 do portão principal.', FALSE, '2026-10-26 08:00-03');

INSERT INTO notificacoes_notificacao (usuaria_id, tipo, titulo, texto, lida, criado_em) VALUES
 (1,'mensagem','Valen enviou uma mensagem','Estarei aqui pra você se precisar, amiga!', FALSE, '2026-10-26 09:50-03'),
 (1,'denuncia','Denúncia em andamento','Sua denúncia PEN-2026-000118 foi encaminhada.', FALSE, '2026-10-26 09:00-03'),
 (1,'contato','Laura aceitou seu convite','Agora ela faz parte da sua rede de apoio.', TRUE, '2026-10-25 15:00-03'),
 (2,'sistema','Bem-vinda ao Violet','Sua identidade foi verificada.', TRUE, '2026-03-01 10:00-03');

INSERT INTO orientacoes_orientacao (slug, titulo, resumo, icone, ordem, aviso, conteudo) VALUES
 ('assediada', 'Estou sendo assediada. O que faço?', 'Saiba como agir e se proteger nessas situações.', 'help-circle', 1,
  'Você não tem culpa pelo que aconteceu. Sua segurança vem primeiro.',
  '{"passos":[{"t":"Afaste-se da situação","d":"Vá para um local seguro e, se possível, fique perto de alguém de confiança."},{"t":"Registre o que aconteceu","d":"Anote data, horário, local e descrição. Guarde prints, áudios e mensagens."},{"t":"Busque apoio","d":"Converse com uma pessoa de confiança e acione sua rede de apoio pelo app."},{"t":"Faça a denúncia","d":"Você pode denunciar pelo Violet de forma anônima, na universidade ou na polícia."}]}'),
 ('denunciar', 'Como denunciar?', 'Entenda o passo a passo para fazer uma denúncia.', 'file-text', 2,
  'As evidências passam por uma análise de apoio com IA. O resultado não é uma comprovação.',
  '{"passos":[{"t":"Reúna as evidências","d":"Prints, fotos, vídeos, mensagens e uma descrição do ocorrido."},{"t":"Preencha o formulário","d":"Descreva o que aconteceu e anexe as evidências, se tiver."},{"t":"Revise e envie","d":"Confira as informações e envie. Você recebe um número de protocolo."}]}'),
 ('ajuda', 'Onde buscar ajuda?', 'Canais oficiais e serviços de apoio.', 'phone', 3,
  'O Violet não substitui os serviços oficiais. Em perigo imediato, ligue 190.',
  '{"canais":[{"nome":"Central de Atendimento à Mulher","numero":"180","desc":"24h, gratuito e anônimo.","icon":"phone"},{"nome":"Polícia Militar","numero":"190","desc":"Emergência e atendimento imediato.","icon":"shield"},{"nome":"Núcleo de Apoio da Universidade","numero":null,"desc":"Apoio psicológico, jurídico e social.","icon":"building"},{"nome":"CVV — Apoio emocional","numero":"188","desc":"Escuta e apoio emocional, 24h.","icon":"message"}]}'),
 ('botao', 'Como funciona o botão de emergência?', 'Entenda como ele funciona e quando usar.', 'siren', 4, '',
  '{"faq":[{"q":"Onde fica?","a":"No centro da tela inicial, logo acima do menu."},{"q":"Como aciono?","a":"Segure o botão por 3 segundos."},{"q":"Quem recebe?","a":"Seus contatos de confiança e a central de apoio."},{"q":"O que é enviado?","a":"Sua localização em tempo real e, se você permitir, áudio, foto e vídeo."}]}');

INSERT INTO circulo_grupotrajeto (id, criadora_id, nome, ponto_encontro, destino, horario, vagas) VALUES
 (1, 2, 'Saída noturna — Asa Norte', 'Portaria principal do CEUB', 'Metrô 112 Sul',      NOW() + INTERVAL '2 days', 4),
 (2, 3, 'Ponto de ônibus W3',         'Bloco 3 — saída lateral',   'Parada W3 Norte 707',NOW() + INTERVAL '3 days', 6);
SELECT setval('circulo_grupotrajeto_id_seq', 2);

INSERT INTO circulo_participacaogrupo (grupo_id, usuaria_id) VALUES (1,2),(1,1),(1,5),(2,3),(2,4);

INSERT INTO circulo_solicitacaoacompanhamento (solicitante_id, destinataria_id, status) VALUES
 (1, 2, 'aceita'), (4, 3, 'pendente');

INSERT INTO circulo_compartilhamentolocalizacao (usuaria_id, grupo_id, inicio, expira_em, encerrado) VALUES
 (1, 1, '2026-10-20 22:10-03', '2026-10-20 22:50-03', TRUE);

-- Mais grupos do Círculo (o mesmo conteúdo de circulo_extra.sql)
INSERT INTO circulo_grupotrajeto (id, criadora_id, nome, ponto_encontro, destino, horario, vagas) VALUES
 (1, 2, 'Saída noturna — Asa Norte',  'Portaria principal do CEUB', 'Metrô 112 Sul',            NOW() + INTERVAL '3 hours',  4),
 (2, 3, 'Ponto de ônibus W3',          'Bloco 3 — saída lateral',    'Parada W3 Norte 707',      NOW() + INTERVAL '5 hours',  6),
 (3, 1, 'Volta da aula de sábado',     'Bloco 9',                    'Rodoviária do Plano Piloto', NOW() + INTERVAL '2 days',   8),
 (4, 5, 'Estacionamento G2',           'Biblioteca central',         'Estacionamento G2',        NOW() + INTERVAL '1 day',    4),
 (5, 6, 'Saída das 18h — Asa Sul',     'Portaria principal do CEUB', 'Metrô Asa Sul',            NOW() + INTERVAL '8 hours',  4)
ON CONFLICT (id) DO UPDATE SET horario = EXCLUDED.horario, ativo = TRUE;
SELECT setval('circulo_grupotrajeto_id_seq', (SELECT MAX(id) FROM circulo_grupotrajeto));

-- Maju (1) participa do grupo 1 e é criadora do 3
INSERT INTO circulo_participacaogrupo (grupo_id, usuaria_id) VALUES
 (1,2),(1,1),(1,5),
 (2,3),(2,4),
 (3,1),(3,2),(3,3),(3,6),
 (4,5),(4,4),
 (5,6)
ON CONFLICT (grupo_id, usuaria_id) DO NOTHING;


-- Pedidos de acompanhamento para a Maju (aba "Pedidos" do Círculo); não duplica
INSERT INTO circulo_solicitacaoacompanhamento (solicitante_id, destinataria_id, status)
SELECT 6, 1, 'pendente' WHERE NOT EXISTS (SELECT 1 FROM circulo_solicitacaoacompanhamento WHERE solicitante_id=6 AND destinataria_id=1);
INSERT INTO circulo_solicitacaoacompanhamento (solicitante_id, destinataria_id, status)
SELECT 5, 1, 'pendente' WHERE NOT EXISTS (SELECT 1 FROM circulo_solicitacaoacompanhamento WHERE solicitante_id=5 AND destinataria_id=1);

-- Orientações no formato do app (passos, canais, perguntas). Pode rodar quantas vezes quiser.
UPDATE orientacoes_orientacao SET resumo='Saiba como agir e se proteger nessas situações.', aviso='Você não tem culpa pelo que aconteceu. Sua segurança vem primeiro.', conteudo='{"passos":[{"t":"Se afaste da situação","d":"Vá para um local seguro e, se possível, acompanhe alguém de confiança."},{"t":"Registre o que aconteceu","d":"Anote data, horário, local, descrição e, se possível, guarde evidências."},{"t":"Busque apoio","d":"Entre em contato com pessoas de confiança e com os canais de ajuda."},{"t":"Faça a denúncia","d":"Você pode denunciar pelo Violet, na universidade, na polícia ou em canais especializados."}]}' WHERE slug='assediada';
UPDATE orientacoes_orientacao SET resumo='Entenda o passo a passo para fazer uma denúncia.', aviso='Sua denúncia é confidencial e será encaminhada aos responsáveis adequados. As evidências passam por uma análise de apoio com IA, que não comprova a ocorrência: a avaliação final é sempre humana.', conteudo='{"passos":[{"t":"Reúna as evidências","d":"Salve prints, fotos, vídeos, mensagens e anote detalhes do ocorrido.","i":"image"},{"t":"Preencha o formulário","d":"Descreva o que aconteceu e anexe as evidências, se tiver.","i":"file-text"},{"t":"Revise e envie","d":"Confira as informações e finalize o envio da denúncia. Você recebe um número de protocolo.","i":"send"}]}' WHERE slug='denunciar';
UPDATE orientacoes_orientacao SET resumo='Canais oficiais e serviços de apoio.', aviso='O Violet não substitui os serviços oficiais. Em perigo imediato, ligue 190.', conteudo='{"canais":[{"nome":"Central de Atendimento à Mulher","numero":"180","desc":"Atendimento 24h, gratuito e anônimo.","icon":"phone"},{"nome":"Polícia Militar","numero":"190","desc":"Emergência e atendimento imediato.","icon":"shield"},{"nome":"CVV — Apoio emocional","numero":"188","desc":"Escuta e apoio emocional, 24h.","icon":"message"},{"nome":"Núcleo de Apoio da Universidade","numero":null,"desc":"Apoio psicológico, jurídico e social.","icon":"building"},{"nome":"Serviço de Saúde Mental","numero":null,"desc":"Atendimento psicológico especializado.","icon":"heart"},{"nome":"Delegacia da Mulher (DEAM)","numero":null,"desc":"Procure a delegacia especializada mais próxima.","icon":"flag"},{"nome":"Ouvidoria da instituição","numero":null,"desc":"Registre ocorrências direto com a universidade.","icon":"file-text"}]}' WHERE slug='ajuda';
UPDATE orientacoes_orientacao SET resumo='Entenda como ele funciona e quando usar.', aviso='', conteudo='{"faq":[{"q":"Onde fica?","a":"Sempre visível na tela inicial."},{"q":"Como aciono?","a":"Segure o botão por 3 segundos. Assim evitamos toques acidentais."},{"q":"Quem recebe?","a":"Seus contatos de confiança e o serviço de emergência."},{"q":"O que envia?","a":"Sua localização em tempo real, áudio, foto e vídeo (se autorizado)."}]}' WHERE slug='botao';

COMMIT;
