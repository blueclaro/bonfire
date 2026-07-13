export const activeRooms = [
  "# 2º informática",
  "# dúvidas enem",
  "# trabalhos",
  "# eventos",
];

export const homePosts = [
  {
    name: "Marina",
    title: "Alguém entendeu a parte de banco de dados?",
    meta: "12 respostas · postado há 8 min",
    text: "Estou montando o DER do projeto e travei na relação entre usuário, posts e comentários.",
    tags: ["PPO", "programação", "ajuda"],
  },
  {
    name: "Rafa",
    title: "Ideias para a feira técnica de sexta",
    meta: "7 respostas · postado há 22 min",
    text: "Vamos juntar sugestões de apresentação, decoração da sala e divisão das falas.",
    tags: ["evento", "turma"],
  },
  {
    name: "Luana",
    title: "Resumo colaborativo de matemática",
    meta: "24 respostas · postado hoje",
    text: "Criei uma lista com os conteúdos da prova. Quem puder, adiciona exemplos resolvidos.",
    tags: ["prova", "matemática", "resumo"],
  },
];

export const forumCategories = [
  {
    name: "Dúvidas de matérias",
    description: "Perguntas sobre conteúdos, provas, atividades e exercícios.",
    topics: 42,
    visibility: "Todos",
    last: "há 8 min",
  },
  {
    name: "Trabalhos e PPO",
    description: "Organização de projetos, entregas, equipes e apresentações.",
    topics: 18,
    visibility: "Alunos",
    last: "há 20 min",
  },
  {
    name: "2º Informática",
    description: "Espaço exclusivo para conversas e avisos da turma.",
    topics: 31,
    visibility: "Minha turma",
    last: "hoje",
  },
  {
    name: "Sala dos professores",
    description: "Discussões internas entre professores e coordenação.",
    topics: 9,
    visibility: "Professores",
    last: "ontem",
  },
  {
    name: "Eventos do colégio",
    description: "Feiras, reuniões, apresentações, campeonatos e encontros.",
    topics: 14,
    visibility: "Todos",
    last: "hoje",
  },
];

export const forumFilters = [
  "Todos",
  "Minha turma",
  "Alunos",
  "Professores",
  "Projetos",
  "Dúvidas",
];

export const chatRooms = [
  {
    name: "2º Informática",
    description: "Chat principal da turma",
    online: 32,
    lastMessage: "Marina: vou mandar as categorias do fórum",
    active: true,
  },
  {
    name: "Dúvidas ENEM",
    description: "Redação, matemática e simulados",
    online: 18,
    lastMessage: "Luana: alguém tem tema pra redação?",
    active: false,
  },
  {
    name: "Trabalhos e PPO",
    description: "Organização dos projetos",
    online: 9,
    lastMessage: "Rafa: falta só arrumar os slides",
    active: false,
  },
  {
    name: "Eventos",
    description: "Feiras, reuniões e avisos rápidos",
    online: 14,
    lastMessage: "Coordenação: reunião no intervalo",
    active: false,
  },
];

export const chatMessages = [
  {
    name: "Gabi",
    text: "Alguém vai ficar depois da aula pra terminar o protótipo?",
    mine: false,
  },
  {
    name: "Pedro",
    text: "Eu fico. Também preciso ajustar a tela de login.",
    mine: false,
  },
  {
    name: "Você",
    text: "Bora fazer o Bonfire ficar apresentável hoje.",
    mine: true,
  },
  {
    name: "Marina",
    text: "Vou mandar umas ideias de categorias pro fórum.",
    mine: false,
  },
  {
    name: "Rafa",
    text: "Depois a gente liga isso com o Supabase, né?",
    mine: false,
  },
];

export const chatParticipants = ["Carlos", "Marina", "Pedro", "Gabi", "Rafa", "Luana"];

export const notices = [
  {
    title: "Entrega do relatório PPO",
    author: "Coordenação",
    target: "Todos os alunos",
    date: "Hoje, 18h",
    type: "Prazo",
    content:
      "A entrega do relatório final do PPO deve ser feita até quinta-feira às 18h. O arquivo precisa conter introdução, objetivo, justificativa, tecnologias utilizadas e conclusão.",
  },
  {
    title: "Reunião dos representantes",
    author: "Coordenação",
    target: "Representantes de turma",
    date: "Hoje, intervalo",
    type: "Reunião",
    content:
      "Os representantes devem comparecer à sala 04 durante o intervalo para alinhamento dos eventos da semana.",
  },
  {
    title: "Simulado ENEM",
    author: "Professor Lucas",
    target: "3º ano e interessados",
    date: "Sábado, 8h",
    type: "Prova",
    content:
      "O simulado será aplicado no bloco principal. Os alunos devem levar documento, lápis, caneta preta e garrafa de água.",
  },
  {
    title: "Feira técnica",
    author: "Professora Ana",
    target: "Cursos técnicos",
    date: "Sexta-feira",
    type: "Evento",
    content:
      "As turmas devem organizar seus espaços de apresentação até o início da manhã. Cada grupo ficará responsável por apresentar seu projeto aos visitantes.",
  },
];

export const noticeFilters = [
  "Todos",
  "Minha turma",
  "Provas",
  "Eventos",
  "Prazos",
  "Reuniões",
];

export const profilePosts = [
  {
    title: "Banco de dados do Bonfire",
    category: "Trabalhos e PPO",
    comments: 8,
    time: "há 20 min",
  },
  {
    title: "Ideias para melhorar o chat da turma",
    category: "Sugestões",
    comments: 14,
    time: "hoje",
  },
  {
    title: "Resumo de requisitos funcionais",
    category: "PPO",
    comments: 5,
    time: "ontem",
  },
];

export const profileActivities = [
  "Comentou em “Como entregar o relatório final do PPO?”",
  "Entrou na sala # Trabalhos e PPO",
  "Criou o tópico “Banco de dados do Bonfire”",
  "Atualizou a biografia do perfil",
];