export const homePosts = [
  { name: "Marina", title: "Alguém entendeu a parte de banco de dados?", meta: "12 respostas · há 8 min", text: "Estou montando o DER e travei na relação entre usuário, posts e comentários.", tags: ["PPO", "programação", "ajuda"] },
  { name: "Rafa", title: "Ideias para a feira técnica de sexta", meta: "7 respostas · há 22 min", text: "Vamos juntar sugestões de apresentação, decoração da sala e divisão das falas.", tags: ["evento", "turma"] },
  { name: "Luana", title: "Resumo colaborativo de matemática", meta: "24 respostas · hoje", text: "Criei uma lista com os conteúdos da prova. Quem puder, adiciona exemplos resolvidos.", tags: ["prova", "matemática", "resumo"] },
];
export const forumCategories = [
  { name: "Dúvidas de matérias", description: "Perguntas sobre conteúdos, provas, atividades e exercícios.", topics: 42, visibility: "Todos", last: "há 8 min" },
  { name: "Trabalhos e PPO", description: "Organização de projetos, entregas, equipes e apresentações.", topics: 18, visibility: "Alunos", last: "há 20 min" },
  { name: "2º Informática", description: "Espaço exclusivo para conversas e avisos da turma.", topics: 31, visibility: "Minha turma", last: "hoje" },
  { name: "Sala dos professores", description: "Discussões internas entre professores e coordenação.", topics: 9, visibility: "Professores", last: "ontem" },
  { name: "Eventos do colégio", description: "Feiras, reuniões, apresentações, campeonatos e encontros.", topics: 14, visibility: "Todos", last: "hoje" },
];
export const forumFilters = ["Todos", "Minha turma", "Alunos", "Professores", "Projetos", "Dúvidas"];
export const chatRooms = [
  { name: "2º Informática", description: "Chat principal da turma", online: 32, lastMessage: "Marina: vou mandar as categorias do fórum", active: true },
  { name: "Dúvidas ENEM", description: "Redação, matemática e simulados", online: 18, lastMessage: "Luana: alguém tem tema pra redação?", active: false },
  { name: "Trabalhos e PPO", description: "Organização dos projetos", online: 9, lastMessage: "Rafa: falta só arrumar os slides", active: false },
];
export const chatMessages = [
  { name: "Gabi", text: "Alguém vai ficar depois da aula pra terminar o protótipo?", mine: false },
  { name: "Pedro", text: "Eu fico. Também preciso ajustar a tela de login.", mine: false },
  { name: "Você", text: "Bora fazer o Bonfire ficar apresentável hoje.", mine: true },
  { name: "Marina", text: "Vou mandar umas ideias de categorias pro fórum.", mine: false },
];
export const notices = [
  { title: "Entrega do relatório PPO", author: "Coordenação", target: "Todos os alunos", date: "Hoje, 18h", type: "Prazo", content: "A entrega do relatório final do PPO deve ser feita até quinta-feira às 18h." },
  { title: "Reunião dos representantes", author: "Coordenação", target: "Representantes", date: "Hoje, intervalo", type: "Reunião", content: "Os representantes devem comparecer à sala 04 durante o intervalo." },
  { title: "Simulado ENEM", author: "Professores", target: "Ensino médio", date: "Sábado, 8h", type: "Avaliação", content: "O simulado ocorrerá no bloco principal. Chegue com antecedência." },
];
export const profilePosts = [
  { category: "PPO", title: "Como organizar as permissões do Bonfire?", comments: 14, time: "há 2 dias" },
  { category: "Programação", title: "Ajuda com relacionamentos no PostgreSQL", comments: 8, time: "há 5 dias" },
];
export const profileActivities = ["Comentou em “Resumo colaborativo de matemática”.", "Entrou na sala Trabalhos e PPO.", "Criou um tópico em Programação."];
