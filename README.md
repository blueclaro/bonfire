# Bonfire

## Primeira versão social (24/09/2026)

O início agora é um feed de texto e uma imagem opcional por publicação, com
hashtags, curtidas, comentários e Ignites (reposts simples que preservam o autor).
Os fóruns existentes permanecem acessíveis; seus dados e permissões não são apagados.
Publicações novas do feed não precisam de título ou escolha de categoria.

### Aplicação no Supabase — antes do deploy desta versão

Execute no SQL Editor, nesta ordem, após as migrações de contas temporárias:

1. `supabase/migrations/20260924_social_feed.sql`
2. `supabase/migrations/20260924_social_storage.sql`

Em instalações novas, execute o `schema.sql` e depois estes dois arquivos.
Eles são reaplicáveis. Não reaplique migrações antigas por cima das novas.
Não é necessário desabilitar RLS nem tornar o bucket público.
Só publique o código depois do sucesso dos dois arquivos.

### Escopo e limites da primeira versão

- Feed: 20 eventos por página; publicações antigas acessíveis e Ignites aparecem
  cronologicamente. Conteúdo restrito não pode receber Ignite.
- Imagens: uma JPG/PNG/WebP de até 5 MB, convertida no navegador para JPEG de até
  1600 px (remove metadados; transparência vira fundo branco). Bucket privado
  `post-images`, com URLs assinadas de 120 segundos. Uma URL já emitida pode
  funcionar até expirar; imagem já baixada não pode ser revogada do dispositivo.
- O upload não sobrescreve arquivos. Se a resposta de publicação for ambígua,
  o arquivo é preservado para não apagar uma imagem de publicação já gravada.
  Limpeza de uploads órfãos é uma manutenção futura, não automática.
- Curtidas e Ignites: uma interação de cada tipo por pessoa/publicação; clicar
  novamente desfaz. Ainda não geram notificações próprias.
- Publicações novas podem ser excluídas pelo autor no feed. Edição de texto de
  publicações sem título não faz parte desta versão. Fóruns antigos mantêm edição.
- Perfil: etiqueta `school_label` editável, inclusive para contas temporárias
  ativas. É apenas informação declarada pelo participante; `class_name` continua
  administrativo e controla acesso. Identificadores antigos são preservados.
- `/pessoas/[id]`: perfil público para membros autenticados, com atalho de mensagem.
- `/mensagens`: texto individual, busca por nome, últimas 100 mensagens de cada
  conversa e atualização a cada 10 segundos. Bloquear interrompe novos envios em
  ambos os sentidos, sem apagar histórico. Sem anexos, recibos, E2EE ou denúncias
  de DMs nesta versão. Administradores do banco ainda possuem acesso técnico;
  o isolamento é aplicado aos usuários do aplicativo pelo RLS.

### Verificação antes de liberar

`node --test tests/*.test.cjs tests/*.integration.cjs` inclui testes de isolamento,
expiração, contagens, falsificação, repost de conteúdo privado e políticas de imagem.
Os testes de banco usam PostgreSQL local descartável e um esquema de Storage
simulado; não substituem testar o serviço real de upload.

Após aplicar as migrações, validar com duas contas: publicar texto e imagem,
filtrar hashtag, curtir/descurtir, dar/desfazer Ignite, comentar, abrir perfil,
alterar etiqueta de turma, enviar mensagem e bloquear/desbloquear. Testar uma
terceira conta sem acesso à conversa e o celular com teclado aberto. Não enviar
mensagens ou criar publicações de teste em nome de usuários sem autorização.

Plataforma social escolar desenvolvida com Next.js, React, TypeScript, Tailwind CSS e Supabase.

## Executar no Windows

1. Instale o Node.js 24 LTS.
2. Copie `.env.example` para `.env.local` e preencha os dados públicos do Supabase.
3. Execute `npm ci`.
4. Execute `npm run dev`.
5. Abra `http://localhost:3000`.

O banco inicial está em `supabase/schema.sql`.

## Publicar na Vercel

Importe o repositório GitHub como um projeto Next.js, com a raiz na pasta do
repositório. O arquivo `vercel.json` fixa a instalação com `npm ci` e a compilação
com `npm run build`, usando `package-lock.json`. Node.js 24.x está definido em
`package.json`. Os arquivos pnpm são preservados para quem já usava esse gerenciador,
mas a publicação utiliza npm. Não configure `BONFIRE_BUILD_DIR` na Vercel.

Cadastre no painel da Vercel as duas variáveis de `.env.example`, com os valores
do seu Supabase. Não envie `.env.local` para o GitHub. Use somente a chave pública
anon/publishable; nunca uma chave service_role ou secret no navegador.
Após alterar variáveis públicas, gere uma nova publicação.

No Supabase, ajuste Site URL e Redirect URLs para o domínio publicado,
incluindo `https://SEU-DOMINIO/redefinir-senha`. Confira também envio de e-mails.
As migrações não são executadas automaticamente pela Vercel.

Antes de divulgar o endereço, teste cadastro, login, recuperação de senha,
comentários, denúncias, remoção/restauração e notificações com contas diferentes.
Os testes locais não substituem essa verificação no ambiente publicado.

Não altere o banco de produção para testar novas migrações: use um projeto
Supabase separado para desenvolvimento/testes. Publicações de preview também
devem usar esse banco separado quando houver testes que escrevam dados.

Configuração antiga de ESLint do template Next.js 16 foi retirada porque
esta versão validada usa Next.js 15 e não contém aquelas dependências.
`npm run typecheck` verifica tipos; não representa uma execução de ESLint.

## Editar e excluir tópicos

Em bancos existentes, aplique `supabase/migrations/20260921_posts_edit_delete.sql`.
O autor com acesso à categoria pode editar título/conteúdo ou excluir o tópico.
A exclusão também remove seus comentários, permanentemente, pelo relacionamento
`ON DELETE CASCADE`. Categoria, autor e campos de moderação não são editáveis.
A data de edição é calculada pelo banco. A migração pode ser reaplicada.

Após aplicar, valide com duas contas e um tópico descartável:

- O autor salva uma edição; recarregar mantém os valores e a indicação de edição.
- Cancelar a edição ou a confirmação de exclusão preserva o tópico.
- Outra conta não vê os controles e tentativas diretas de UPDATE/DELETE não alteram o registro.
- A API recusa título/conteúdo inválidos e alterações em autor, categoria ou bloqueio.
- Excluir remove o tópico e seus comentários e retorna à categoria.
- Se o tópico já foi removido, salvar/excluir deve mostrar erro, sem sucesso falso.

## Moderação de tópicos

Após a migração de edição/exclusão de tópicos, aplique
`supabase/migrations/20260921_posts_moderation.sql`. Em um banco novo, o schema
completo já inclui essas alterações. Migrações antigas não devem ser reaplicadas
depois das mais recentes; use o schema completo ou respeite essa ordem.

Coordenação e moderadores podem fixar/desafixar e bloquear/reabrir respostas.
Fixados aparecem primeiro na categoria; início e busca preservam a ordem de
recência e exibem os indicadores. Bloquear mantém os comentários existentes e
impede novos comentários de qualquer usuário, inclusive da equipe.
Alterações são atualizadas por Realtime, ao focar a janela e a cada 30 segundos.
Não há concessão de edição do texto de terceiros nem exclusão de terceiros.

Valide depois da migração com contas de aluno, professor e moderador:

- Moderador e coordenação conseguem fixar/desafixar e fechar/reabrir tópico alheio.
- Aluno e professor não veem os controles; chamada direta a `moderate_post` é recusada.
- Criar um tópico com flags de moderação pela API é recusado para aluno/professor.
- Alterar flags por UPDATE direto continua bloqueado; edição do texto próprio funciona.
- Uma aba de aluno aberta recebe o bloqueio; mesmo antes de atualizar, INSERT de
  comentário em tópico fechado é recusado no banco. Reabrir permite comentar.
- Fixar um tópico antigo o leva ao topo da categoria; desafixar restaura a ordem.
- Tópico inexistente retorna erro, sem mensagem de sucesso.

Testes locais de permissões (PostgreSQL em memória, sem acesso ao Supabase):

1. `npm install --prefix .test-tools --no-save --package-lock=false @electric-sql/pglite`
2. `npm run test:moderation`

O teste executa o schema e reaplica a migração, simulando as funções básicas de
autenticação do Supabase. Verifica permissões, bloqueio/reabertura, ordem dos
fixados e preservação da edição dos autores. Não testa transporte Realtime remoto.

## Avisos (configuração)

Para habilitar edição e exclusão, aplique também
`supabase/migrations/20260921_announcements_edit_delete.sql`.
Apenas o próprio autor, ainda com função de professor, coordenação ou moderador,
pode editar ou excluir. A edição mantém as validações de publicação e não altera
autor nem data de criação. A exclusão é permanente e pede confirmação.

Verifique com duas contas da equipe: o autor consegue salvar título, texto,
público e turma; outra conta não consegue editar/excluir o aviso, nem via API.
Teste também cancelar edição/exclusão, conteúdo vazio, turma vazia e remoção
do aviso em outra janela antes de salvar: não deve haver sucesso falso.

Para um banco existente, aplique `supabase/migrations/20260921_announcements.sql`
no SQL Editor depois das políticas de visibilidade do schema base.
A migração pode ser executada novamente. Para um banco novo, use o schema completo.

Em `/avisos`, alunos consultam os comunicados disponíveis para seu público.
Professores, coordenação e moderadores também podem publicar. Professores não
publicam para o público Moderação. O autor pode consultar seus próprios avisos,
inclusive quando destinados aos alunos. Funções são atribuídas pela administração
no banco; não use uma chave privilegiada no navegador.

Validação manual com contas distintas após aplicar a migração:

- Professor publica um aviso para alunos; aluno vê o aviso e outro professor não.
- Aluno de outra turma não vê um aviso destinado a uma turma diferente.
- Uma tentativa de publicação por aluno via API deve ser recusada.
- Um professor não pode publicar com outro autor nem para Moderação.
- Título/conteúdo vazios e aviso de turma sem turma devem ser recusados.

Para compilar sem interferir no servidor local, no PowerShell:
`$env:BONFIRE_BUILD_DIR='.next-build'; npm run build`.
Remova essa variável antes de executar `npm run start` para uma compilação padrão.

## Denúncias e fila de análise

No banco existente, após as migrações anteriores, execute o conteúdo de
`supabase/migrations/20260923_reports.sql` no SQL Editor do Supabase.
A migração é reaplicável e também está incluída no schema completo.
Não é necessário criar políticas manualmente nem mudar as chaves da aplicação.

- O botão **Denunciar** aparece em tópicos, comentários e mensagens de terceiros,
  incluindo o chat da página inicial. O motivo aceita de 10 a 2000 caracteres.
- O banco verifica a sessão, a existência do alvo e o acesso à categoria/sala.
  Não aceita conteúdo próprio, duplicatas pendentes do mesmo alvo ou mais de
  20 envios por usuário em uma hora.
- A área `/denuncias` e seu link no menu são destinados à coordenação e aos
  moderadores. A proteção real é feita por permissões e políticas no banco:
  alunos e professores não podem consultar a fila ou registrar decisões.
- A fila tem filtros e paginação de 20 itens. Use **Atualizar** para buscar
  novos envios ou decisões feitas em outra aba.
- O banco preserva até 2000 caracteres do conteúdo no momento do envio.
  Assim, editar ou excluir o alvo não apaga esse trecho da denúncia.
- Resolver ou descartar registra responsável e horário, sem editar ou excluir
  o conteúdo denunciado. Uma decisão já registrada não pode ser sobrescrita.
- O envio usa `submit_report`; a análise usa `review_report`. Escritas diretas
  na tabela são bloqueadas para usuários comuns, inclusive moderadores.

Testes locais: após instalar o PGlite conforme a seção de moderação, execute
`npm run test:reports`. Eles usam PostgreSQL descartável, sem acessar o projeto
Supabase nem suas credenciais. Execute também `npm test`,
`npm run test:moderation` e a compilação.

Após aplicar a migração, valide com contas diferentes:

1. Um aluno denuncia um tópico, um comentário e uma mensagem de outra conta.
   Repetir uma denúncia pendente deve mostrar erro, sem duplicação.
2. Aluno e professor não veem o link no menu; acessar `/denuncias` diretamente
   mostra acesso restrito, e consultar a tabela pela API não retorna denúncias.
3. Moderador ou coordenação consulta os motivos e trechos, resolve uma denúncia
   e descarta outra. Os filtros mostram as decisões depois de recarregar.
4. Edite/exclua um conteúdo de teste já denunciado: o trecho original permanece
   disponível para a equipe.
5. Abra a mesma denúncia em duas abas: a segunda tentativa de decisão deve
   informar que ela já foi analisada e pedir atualização.

Os testes locais não substituem essa validação com sessões reais no Supabase.

## Remoção reversível pela moderação

Após a migração de denúncias, execute
`supabase/migrations/20260923_content_removal.sql` no SQL Editor.
Respeite essa ordem: reaplicar a migração antiga de denúncias depois desta
reinstala a versão anterior da função de envio. O schema completo já contém
a versão atual. A migração nova pode ser reaplicada sem apagar conteúdo.

Na fila de denúncias, o painel **Moderação do conteúdo** permite remover e
restaurar tópicos, comentários e mensagens. Ambas as ações exigem motivo de
10 a 2000 caracteres e confirmação. Os controles também ficam disponíveis
nas denúncias resolvidas e descartadas. Encerrar uma denúncia e alterar a
visibilidade do conteúdo são decisões separadas.

A remoção é lógica: não apaga o texto. As políticas do banco ocultam o conteúdo
inclusive dos autores e moderadores nas consultas normais, buscas e contagens.
O painel da equipe mantém o trecho denunciado e as últimas 10 ações, com motivo,
nome do responsável no momento da ação e horário de São Paulo. O histórico
completo fica na tabela protegida `content_moderation_events`, sem permissão de
inserção, edição ou exclusão direta para usuários da aplicação.

Remover um tópico oculta também seus comentários. Restaurar o tópico não
restaura comentários removidos individualmente. A exclusão pelo autor de um
tópico com comentários removidos é bloqueada para evitar apagá-los em cascata.
Uma exclusão definitiva anterior não pode ser desfeita por esta funcionalidade.
Ações administrativas fora da aplicação não são cobertas pela restauração.

Consultas novas já respeitam a remoção; telas abertas podem manter dados
carregados até atualizar. Chats e a página do tópico consultam novamente ao
recuperar o foco e a cada 30 segundos. Não se deve depender exclusivamente de
eventos Realtime, pois o registro oculto deixa de passar nas políticas de leitura.

Valide com contas de aluno e moderação, usando conteúdos de teste:

1. Denuncie os três tipos e remova cada um informando um motivo.
2. Atualize a página do aluno e confira que o alvo desapareceu das consultas.
3. Restaure cada alvo pela mesma denúncia; confirme a preservação do texto.
4. Remova um comentário e depois seu tópico. Restaurar só o tópico deve manter
   esse comentário oculto. Restaure o comentário separadamente.
5. Consulte o histórico e teste uma segunda aba com estado desatualizado:
   tentar repetir a mesma ação deve pedir atualização, sem duplicar o histórico.
6. Aluno e professor não devem conseguir chamar `moderate_reported_content`
   ou `reported_content_state`, nem consultar a auditoria.

`npm run test:reports` inclui testes locais da atualização do banco, reaplicação,
remoção, restauração, permissões, auditoria e preservação dos comentários.

## Notificações dentro do Bonfire

Depois da remoção reversível, execute
`supabase/migrations/20260923_notifications.sql` no SQL Editor do Supabase.
O schema completo já inclui essa migração; ela pode ser reaplicada.
Somente eventos novos geram notificações, sem preencher o histórico antigo.

O sino do menu mostra a quantidade de notificações não lidas (até 99+ no
indicador). Em `/notificacoes`, a lista paginada permite consultar o motivo de
uma decisão e marcar cada notificação como lida. Abrir um link não marca
automaticamente a notificação como lida. As datas usam o horário de São Paulo.

- Um comentário de outra pessoa notifica o autor do tópico. Comentários próprios
  e edições não geram alertas. O aviso não copia o texto do comentário.
- Remover ou restaurar um tópico, comentário ou mensagem notifica seu autor.
  O motivo informado pela equipe é enviado integralmente. O formulário avisa
  para não incluir a identidade do denunciante nem informações internas.
- As notificações não contêm o motivo privado da denúncia nem a identidade
  do denunciante. Cada conta só lê e marca suas próprias notificações,
  inclusive quando pertence à equipe de moderação.
- A geração ocorre por gatilhos do banco na mesma transação da ação original,
  sem depender da página aberta. Clientes não podem criar, editar ou excluir
  notificações diretamente.
- O sino e a lista consultam novamente por Realtime, ao voltar à janela e a
  cada 30 segundos. Marcar como lida atualiza o contador da página imediatamente
  após nova consulta. São notificações internas, não push ou e-mail.
- Avisos existentes permanecem após a exclusão do conteúdo; os links continuam
  respeitando as permissões atuais e podem apontar para conteúdo indisponível.
  Excluir a conta remove suas notificações.

Teste com contas distintas após aplicar o SQL:

1. Crie um tópico com A e comente com B. Apenas A recebe o aviso no sino.
2. Marque o aviso como lido e recarregue: a leitura persiste e o contador diminui.
3. Comente no próprio tópico ou edite um comentário: não deve surgir novo aviso.
4. Denuncie um conteúdo de A e remova/restaure com um moderador. A deve receber
   as duas decisões, com motivo, mas sem identificação de quem denunciou.
5. Confira que B e o moderador não podem consultar nem marcar os avisos de A.
6. Saia da conta e entre com outra: o sino e a lista não devem manter avisos
   da conta anterior.

Teste automatizado: `npm run test:notifications`, com o mesmo PGlite local das
outras integrações. Para a suíte completa:
`node --test tests/*.test.cjs tests/*.integration.cjs`.
A validação com sessões reais no Supabase ainda deve ser feita após a migração.

## Recuperação de senha

O login possui **Esqueci minha senha**, que abre `/esqueci-senha`.
O e-mail é enviado pelo Supabase Auth. Não há nova migração SQL nem necessidade
de chave administrativa no navegador.

Configuração no painel Supabase:

1. Em **Authentication → URL Configuration**, confira o **Site URL** do ambiente.
2. Em **Redirect URLs**, adicione o endereço completo de retorno:
   `http://localhost:3000/redefinir-senha` no desenvolvimento, ajustando a porta
   se necessário; no ambiente publicado, use o domínio HTTPS real seguido de
   `/redefinir-senha`. O formulário usa a origem da página que o usuário abriu.
3. Preserve o link de verificação padrão `{{ .ConfirmationURL }}` no template
   **Reset Password**. Este projeto usa o fluxo implícito do cliente Supabase,
   recebendo os tokens no fragmento da URL. Templates personalizados de PKCE
   ou de token_hash exigem outra implementação; não os substitua silenciosamente.
4. Confira a configuração de envio de e-mail/SMTP, remetente e limites de envio
   do seu projeto. O envio real depende dessas configurações do Supabase.

A tela de solicitação mostra uma confirmação neutra, sem dizer se o endereço
possui conta. Após uma solicitação bem-sucedida, aguarda 60 segundos para permitir
reenviar; os limites efetivos continuam sendo os do Supabase.

Em `/redefinir-senha`, o link é validado com o Supabase antes de liberar o
formulário. A sessão de recuperação é isolada da conta já aberta no navegador,
fica apenas em memória e não é persistida. O fragmento é removido da barra de
endereço. Não registre nem compartilhe URLs de recuperação, tokens ou senhas.
Recarregar/fechar essa tela exige solicitar um novo link. Após salvar, a tela
confirma o resultado e oferece retorno ao login. A nova senha exige pelo menos
8 caracteres e confirmação; regras adicionais configuradas no Supabase continuam
valendo. As sessões normais de outras abas não são manipuladas por essa tela.

Teste manual com uma conta de teste e acesso ao e-mail:

- Solicite o link, abra o e-mail e salve uma nova senha; confirme o novo login.
- Confirme que a senha antiga não permite mais entrar.
- Abra `/redefinir-senha` diretamente: não deve exibir o formulário de senha.
- Use um link expirado/já utilizado: deve orientar a solicitar outro link.
- Teste senhas divergentes, curtas e iguais à atual; não deve indicar sucesso.
- Teste com outra conta aberta: a troca deve se aplicar somente à conta do link.
- Confira o endereço de retorno tanto localmente quanto no site publicado.

Os testes em `tests/passwordRecovery.test.cjs` usam respostas simuladas da
autenticação para validar o fluxo, sem enviar e-mails nem trocar senhas reais.
Execute a suíte completa com
`node --test tests/*.test.cjs tests/*.integration.cjs`.
O envio de e-mail e o login com a nova senha precisam da validação manual acima.

Referências oficiais:
[recuperação de senha](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
e [URLs de redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls).

## Contas temporárias e QR Code da apresentação

A página `/conta-temporaria` pede somente nome/apelido e tag. A identidade aparece
como `CharlieLegal#bubu`. O nome aceita 2–32 caracteres sem # ou caracteres de
controle. A tag aceita 1–4 letras ASCII/números, sem espaços, símbolos ou acentos,
e é exclusiva entre contas temporárias sem distinguir maiúsculas/minúsculas.
Nome/tag não são credenciais de login e não permitem recuperar uma sessão.

Cada visitante recebe uma conta individual do Supabase Anonymous Sign-Ins,
sem e-mail/senha/SMTP. A validade de 24 horas começa na criação e é aplicada
pelas políticas do banco, mesmo quando o token de autenticação ainda é válido.
Contas temporárias só acessam conteúdo `everyone`, podem publicar, comentar e
conversar, mas não acessam turmas restritas, avisos da equipe ou moderação.
O nome/tag e a validade não podem ser alterados pelo visitante.

### Preparar antes de liberar

1. Aplique `supabase/migrations/20260923_temporary_accounts.sql` depois das
   migrações anteriores. Não reaplique migrações antigas depois dela.
2. No Supabase Auth, habilite **Anonymous Sign-Ins**. Não desative a confirmação
   de e-mail das contas permanentes: é um fluxo independente.
3. Aplique também `supabase/migrations/20260923_temporary_tag_limit.sql` para limitar novas tags a 4 caracteres. Contas já existentes são preservadas.
4. Publique o código atualizado na Vercel.
5. Apenas quando estiver pronto para testes/apresentação, execute no SQL Editor:

```sql
update public.temporary_access_settings
set registration_enabled = true, access_enabled = true,
    duration_hours = 24, max_accounts = 200
where id = true;
```

O limite inicial é 200 contas temporárias no total, incluindo expiradas, e pode
ser ajustado até 1000. A migração inicia com inscrições fechadas; reaplicá-la
preserva as escolhas. A validação, exclusividade e limite são aplicados no
banco dentro da transação que cria o usuário, impedindo bypass do formulário.
O acesso dos participantes não depende de uma senha compartilhada no QR Code.

Abra `https://bonfire-iota.vercel.app/apresentacao` para exibir o QR no projetor
ou baixar o PNG para os slides. O QR é gerado localmente e contém somente o
endereço `/conta-temporaria` da origem atual, sem credenciais. Não use o QR gerado
em localhost na apresentação. A página estática não inclui dados de sessão;
os dados pessoais são buscados exclusivamente no navegador autenticado.

**Importante para uma turma no mesmo Wi-Fi:** o Supabase limita cadastros
anônimos por IP (padrão documentado: 30 por hora). Confira Anonymous Sign-Ins
em Authentication → Rate Limits e planeje um limite adequado ao público,
sem remover proteções indiscriminadamente. Teste com a rede da apresentação.
O limite total de contas do Bonfire não substitui o limite por IP do Supabase.

O Supabase recomenda CAPTCHA/Turnstile contra abuso. Este formulário ainda não
integra CAPTCHA: não ative o requisito global sem antes integrar o widget/token
aos formulários de autenticação. Por enquanto, destine a entrada a uma sessão
supervisionada, mantenha os limites e feche as inscrições após a apresentação.
Não é uma implementação pronta para cadastro anônimo irrestrito em larga escala.
[Referência oficial](https://supabase.com/docs/guides/auth/auth-anonymous).

### Encerrar sem apagar dados

Para fechar somente novas inscrições:

```sql
update public.temporary_access_settings set registration_enabled = false where id = true;
```

Para também bloquear todas as contas temporárias imediatamente:

```sql
update public.temporary_access_settings
set registration_enabled = false, access_enabled = false where id = true;
```

Expirar/bloquear não apaga contas, tags, mensagens nem tópicos. A limpeza futura
deve ser uma operação separada e revisada, pois excluir auth.users remove dados
associados por cascata. Não foi adicionada rotina de exclusão automática.
Contas permanentes não são desativadas por essas configurações.

### Testar antes de sexta

- Crie duas contas em navegadores/perfis diferentes, teste nomes/tags inválidos,
  tag repetida com outra caixa e retorno à mesma sessão ao recarregar.
- Publique um tópico, um comentário e uma mensagem. Confira autor e conteúdo
  na outra conta. Confirme que áreas restritas e moderação permanecem bloqueadas.
- Use `/perfil` e `/conta-temporaria` para verificar identidade e validade.
- Teste fechar inscrições, bloquear acesso e reabrir pelo painel SQL.
- Valide a expiração em um projeto Supabase de testes antes de usar dados reais.
- Execute `npm run test:temporary` ou a suíte completa. Os testes locais usam
  PostgreSQL descartável; criação de sessão Auth, limite por IP e celular real
  ainda precisam do teste conectado ao Supabase.
