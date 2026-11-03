-- Violet — atualiza os dados de demonstração (Círculo de Apoio e Orientações).
-- Pode rodar quantas vezes quiser: renova os horários (para os grupos nunca ficarem "no passado")
-- e cria grupos novos sem duplicar. Rode ANTES da apresentação.
--
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d violet -f database\atualizar_demo.sql
BEGIN;

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

-- Grupo de conversa da demonstração: a Maria Júlia (id 1) é a criadora (precisa do migrate com os campos novos)
UPDATE conversas_conversa SET criadora_id = 1, cor = 2 WHERE id = 5 AND criadora_id IS NULL;

-- Contatos de confiança que também têm conversa (a etiqueta "Contato de confiança" aparece na lista de conversas)
INSERT INTO contatos_contatoconfianca (usuaria_id, nome, telefone, relacao, compartilha_localizacao, recebe_alertas)
SELECT 1, 'Valentina Souza', '(61) 99111-0002', 'Amiga', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM contatos_contatoconfianca WHERE usuaria_id = 1 AND nome = 'Valentina Souza');
INSERT INTO contatos_contatoconfianca (usuaria_id, nome, telefone, relacao, compartilha_localizacao, recebe_alertas)
SELECT 1, 'Ana Clara Mendes', '(61) 99111-0005', 'Amiga', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM contatos_contatoconfianca WHERE usuaria_id = 1 AND nome = 'Ana Clara Mendes');

COMMIT;
