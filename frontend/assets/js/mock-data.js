/* ==========================================================
   VIOLET — Dados simulados (mock)
   Usados enquanto a API Django não está pronta.
   Quando a API estiver no ar, mude USE_MOCK para false em api.js.
   ========================================================== */
window.VIOLET_MOCK = {
  usuaria: {
    id: 1,
    nome: "Maria Júlia Costa",
    primeiro_nome: "Maria Júlia",
    email: "mariajulia@ceub.edu.br",
    iniciais: "MJ",
    verificada: true,
    modo_anonimo: false,
    telefone: "(61) 98888-7766",
    data_nascimento: "2005-05-14",
    cep: "70704-000", logradouro: "SQN 704, Bloco A", numero: "12", complemento: "Apto 301",
    bairro: "Asa Norte", cidade: "Brasília", uf: "DF"
  },

  /* Contatos da usuária. de_confianca=true → pode ser avisada em emergências (máx. 5). */
  contatos: [
    { id: 1, nome: "Laura Martins", relacao: "Amiga", telefone: "(61) 99876-5432", de_confianca: true, recebe_alertas: true, compartilha_localizacao: true, tone: 1 },
    { id: 2, nome: "Camila Almeida", relacao: "Irmã", telefone: "(61) 98765-4321", de_confianca: true, recebe_alertas: true, compartilha_localizacao: true, tone: 2 },
    { id: 3, nome: "Beatriz Rocha", relacao: "Prima", telefone: "(61) 98533-2211", de_confianca: true, recebe_alertas: true, compartilha_localizacao: false, tone: 3 },
    { id: 4, nome: "Valentina Souza", relacao: "Amiga", telefone: "(61) 99111-2020", de_confianca: true, recebe_alertas: true, compartilha_localizacao: true, tone: 4 },
    { id: 5, nome: "Pâmela Duarte", relacao: "", telefone: "(61) 99222-3131", de_confianca: false, recebe_alertas: false, compartilha_localizacao: false, tone: 2 },
    { id: 6, nome: "Kirby Lima", relacao: "", telefone: "(61) 99333-4242", de_confianca: false, recebe_alertas: false, compartilha_localizacao: false, tone: 3 },
    { id: 7, nome: "Ana Clara Mendes", relacao: "Amiga", telefone: "(61) 99444-5353", de_confianca: true, recebe_alertas: true, compartilha_localizacao: true, tone: 1 }
  ],

  /* Conversas diretas. Os grupos em que a pessoa entrou (Círculo de Apoio) são somados em api.listarConversas() */
  conversas: [
    { id: 1, contato_id: 4, nome: "Valen", ultima: "Estarei aqui pra você se precisar, amiga!", hora: "10 min", min: 10, nao_lidas: 2, online: true, tipo: "contato", tone: 1 },
    { id: 2, contato_id: 5, nome: "Pam", ultima: "Entendi! Me avisa quando chegar.", hora: "1 min", min: 1, nao_lidas: 2, online: true, tipo: "contato", tone: 2 },
    { id: 3, contato_id: 6, nome: "Kirby", ultima: "Isso vem acontecendo faz tempo?", hora: "1 h", min: 60, nao_lidas: 0, online: true, tipo: "contato", tone: 3 },
    { id: 4, contato_id: 7, nome: "Ana", ultima: "Aí foi mais ou menos isso.", hora: "10 min", min: 10, nao_lidas: 5, online: false, tipo: "contato", tone: 4 }
  ],

  /* Resumo de cada grupo na lista de conversas (grupo.id → dados). Grupos novos usam "agora". */
  resumoGrupos: {
    1: { curto: "Noturna", hora: "1 h", min: 60, nao_lidas: 0 },
    2: { curto: "Ponto W3", hora: "2 h", min: 120, nao_lidas: 0 },
    3: { curto: "G2", hora: "ontem", min: 1440, nao_lidas: 0 },
    4: { curto: "Sábado", hora: "10 min", min: 10, nao_lidas: 2 }
  },

  mensagens: {
    4: [
      { id: 1, autora: "eu", texto: "Oi, Ana! Você está por aí?", hora: "10:02" },
      { id: 2, autora: "ela", texto: "Oi, Maju! Estou sim. Aconteceu alguma coisa?", hora: "10:03" },
      { id: 3, autora: "eu", texto: "Aconteceu uma situação na faculdade e eu fiquei bastante desconfortável.", hora: "10:04" },
      { id: 4, autora: "ela", texto: "Poxa, sinto muito. Quer me contar o que aconteceu?", hora: "10:04" },
      { id: 5, autora: "eu", texto: "Ainda não consigo falar sobre tudo, mas precisava conversar com alguém.", hora: "10:06" },
      { id: 6, autora: "ela", texto: "Claro. Você pode falar quando se sentir preparada. Estou aqui para te ouvir 💜", hora: "10:07" },
      { id: 7, autora: "eu", texto: "Obrigada, Ana.", hora: "10:08" }
    ],
    /* Mensagens dos grupos (chave "g" + id do grupo) */
    g4: [
      { id: 1, autora: "ela", nome: "Valentina", texto: "Oi, meninas! Alguém vai sair junto no sábado?", hora: "10:02" },
      { id: 2, autora: "eu", texto: "Eu vou! Saio do Bloco 9 por volta das 12h.", hora: "10:03" },
      { id: 3, autora: "ela", nome: "Valentina", texto: "Perfeito, a gente se encontra na entrada 💜", hora: "10:04" },
      { id: 4, autora: "ela", nome: "Valentina", texto: "Eu levo a garrafinha d'água 💜", hora: "10:06" }
    ],
    g1: [
      { id: 1, autora: "ela", nome: "Ana Clara", texto: "Pessoal, hoje saio às 22h da portaria principal.", hora: "21:10" },
      { id: 2, autora: "ela", nome: "Valentina", texto: "Combinado! Te encontro lá.", hora: "21:12" },
      { id: 3, autora: "ela", nome: "Ana Clara", texto: "Saio às 22h, combinado?", hora: "21:15" }
    ],
    g2: [
      { id: 1, autora: "ela", nome: "Pamela", texto: "Cheguei na parada!", hora: "18:40" },
      { id: 2, autora: "ela", nome: "Kirby", texto: "Já estou chegando, 2 minutinhos.", hora: "18:41" }
    ],
    g3: [
      { id: 1, autora: "ela", nome: "Beatriz", texto: "Pode ser às 18h30?", hora: "ontem" }
    ]
  },

  notificacoes: [
    { id: 1, titulo: "Nova mensagem em Volta da aula de sábado", texto: "Valentina: Eu levo a garrafinha d'água 💜", hora: "agora", tipo: "mensagem", lida: false },
    { id: 2, titulo: "Denúncia em andamento", texto: "Sua denúncia PEN-2026-000118 foi encaminhada.", hora: "1 h", tipo: "denuncia", lida: false },
    { id: 3, titulo: "Laura aceitou seu convite", texto: "Agora ela faz parte da sua rede de apoio.", hora: "ontem", tipo: "contato", lida: true }
  ],

  denuncias: [
    { id: 1, protocolo: "PEN-2026-000118", categoria: "Assédio", data: "20/03/2026", hora: "19:20", local: "Prédio A — Corredor", status: "andamento" },
    { id: 2, protocolo: "PEN-2026-000097", categoria: "Ameaça", data: "12/03/2026", hora: "21:15", local: "Estacionamento da instituição", status: "concluida" },
    { id: 3, protocolo: "PEN-2026-000081", categoria: "Importunação", data: "02/03/2026", hora: "18:30", local: "Biblioteca — Sala de estudos", status: "andamento" },
    { id: 4, protocolo: "PEN-2026-000042", categoria: "Outro", data: "15/02/2026", hora: "13:40", local: "Evento acadêmico", status: "concluida" }
  ],

  /* Círculo de Apoio — horários calculados a partir de agora para a demo sempre fazer sentido */
  grupos: (() => {
    const em = (h) => new Date(Date.now() + h * 3600e3).toISOString();
    return [
      { id: 1, nome: "Saída noturna — Asa Norte", ponto: "Portaria principal do CEUB", destino: "Metrô 112 Sul", horario: em(2.5), vagas: 5,
        participantes: [{ nome: "Valentina", tone: 1 }, { nome: "Ana Clara", tone: 4 }], membro: false, compativel: true, distancia: "350 m" },
      { id: 2, nome: "Ponto de ônibus W3", ponto: "Bloco 3 — saída lateral", destino: "Parada W3 Norte 707", horario: em(3.2), vagas: 6,
        participantes: [{ nome: "Pamela", tone: 2 }, { nome: "Kirby", tone: 3 }, { nome: "Luara", tone: 1 }], membro: false, compativel: true, distancia: "500 m" },
      { id: 3, nome: "Estacionamento G2", ponto: "Biblioteca central", destino: "Estacionamento G2", horario: em(26), vagas: 4,
        participantes: [{ nome: "Beatriz", tone: 2 }], membro: false, compativel: false, distancia: "1,2 km" },
      { id: 4, nome: "Volta da aula de sábado", ponto: "Bloco 9", destino: "Rodoviária do Plano Piloto", horario: em(50), vagas: 8,
        participantes: [{ nome: "Você", tone: 0, eu: true }, { nome: "Valentina", tone: 1 }], membro: true, compativel: true, distancia: "200 m", minha: true }
    ];
  })(),

  solicitacoes: [
    { id: 1, nome: "Luara", curso: "Direito · 3º semestre", destino: "Metrô 112 Sul", tempo: "há 5 min", tone: 1 },
    { id: 2, nome: "Isabela", curso: "Psicologia · 5º semestre", destino: "Parada W3 Norte", tempo: "há 20 min", tone: 3 }
  ],

  proximas: 6,

  categorias: [
    { id: "assedio", nome: "Assédio", desc: "Moral ou sexual", icon: "flag" },
    { id: "ameaca", nome: "Ameaça", desc: "Intimidação, coação", icon: "shield" },
    { id: "violencia", nome: "Violência", desc: "Física ou psicológica", icon: "alert-triangle" },
    { id: "importunacao", nome: "Importunação", desc: "Toques, comentários", icon: "eye-off" },
    { id: "perseguicao", nome: "Perseguição", desc: "Stalking, vigilância", icon: "route" },
    { id: "outro", nome: "Outro", desc: "Outra situação", icon: "more-h" }
  ],

  orientacoes: [
      {
          "id": "assediada",
          "titulo": "Estou sendo assediada. O que faço?",
          "resumo": "Saiba como agir e se proteger nessas situações.",
          "icon": "help-circle",
          "passos": [
              {
                  "t": "Se afaste da situação",
                  "d": "Vá para um local seguro e, se possível, acompanhe alguém de confiança."
              },
              {
                  "t": "Registre o que aconteceu",
                  "d": "Anote data, horário, local, descrição e, se possível, guarde evidências."
              },
              {
                  "t": "Busque apoio",
                  "d": "Entre em contato com pessoas de confiança e com os canais de ajuda."
              },
              {
                  "t": "Faça a denúncia",
                  "d": "Você pode denunciar pelo Violet, na universidade, na polícia ou em canais especializados."
              }
          ],
          "aviso": "Você não tem culpa pelo que aconteceu. Sua segurança vem primeiro."
      },
      {
          "id": "denunciar",
          "titulo": "Como denunciar?",
          "resumo": "Entenda o passo a passo para fazer uma denúncia.",
          "icon": "file-text",
          "passos": [
              {
                  "t": "Reúna as evidências",
                  "d": "Salve prints, fotos, vídeos, mensagens e anote detalhes do ocorrido.",
                  "i": "image"
              },
              {
                  "t": "Preencha o formulário",
                  "d": "Descreva o que aconteceu e anexe as evidências, se tiver.",
                  "i": "file-text"
              },
              {
                  "t": "Revise e envie",
                  "d": "Confira as informações e finalize o envio da denúncia. Você recebe um número de protocolo.",
                  "i": "send"
              }
          ],
          "aviso": "Sua denúncia é confidencial e será encaminhada aos responsáveis adequados. As evidências passam por uma análise de apoio com IA, que não comprova a ocorrência: a avaliação final é sempre humana."
      },
      {
          "id": "ajuda",
          "titulo": "Onde buscar ajuda?",
          "resumo": "Canais oficiais e serviços de apoio.",
          "icon": "phone",
          "canais": [
              {
                  "nome": "Central de Atendimento à Mulher",
                  "numero": "180",
                  "desc": "Atendimento 24h, gratuito e anônimo.",
                  "icon": "phone"
              },
              {
                  "nome": "Polícia Militar",
                  "numero": "190",
                  "desc": "Emergência e atendimento imediato.",
                  "icon": "shield"
              },
              {
                  "nome": "CVV — Apoio emocional",
                  "numero": "188",
                  "desc": "Escuta e apoio emocional, 24h.",
                  "icon": "message"
              },
              {
                  "nome": "Núcleo de Apoio da Universidade",
                  "numero": null,
                  "desc": "Apoio psicológico, jurídico e social.",
                  "icon": "building"
              },
              {
                  "nome": "Serviço de Saúde Mental",
                  "numero": null,
                  "desc": "Atendimento psicológico especializado.",
                  "icon": "heart"
              },
              {
                  "nome": "Delegacia da Mulher (DEAM)",
                  "numero": null,
                  "desc": "Procure a delegacia especializada mais próxima.",
                  "icon": "flag"
              },
              {
                  "nome": "Ouvidoria da instituição",
                  "numero": null,
                  "desc": "Registre ocorrências direto com a universidade.",
                  "icon": "file-text"
              }
          ],
          "aviso": "O Violet não substitui os serviços oficiais. Em perigo imediato, ligue 190."
      },
      {
          "id": "botao",
          "titulo": "Como funciona o botão de emergência?",
          "resumo": "Entenda como ele funciona e quando usar.",
          "icon": "siren",
          "faq": [
              {
                  "q": "Onde fica?",
                  "a": "Sempre visível na tela inicial."
              },
              {
                  "q": "Como aciono?",
                  "a": "Segure o botão por 3 segundos. Assim evitamos toques acidentais."
              },
              {
                  "q": "Quem recebe?",
                  "a": "Seus contatos de confiança e o serviço de emergência."
              },
              {
                  "q": "O que envia?",
                  "a": "Sua localização em tempo real, áudio, foto e vídeo (se autorizado)."
              }
          ]
      }
  ]
};
