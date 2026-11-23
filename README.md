# Bonfire

Plataforma social escolar desenvolvida com **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS** e **Supabase** (PostgreSQL, Auth, Realtime e Storage).

O projeto reúne feed social com texto, imagens, hashtags, curtidas e *Ignites*, fóruns por categoria, avisos institucionais, chats em grupo, mensagens diretas, notificações internas, contas temporárias com QR Code e painel completo de moderação, denúncias e aprovação de contas.

## Pré-requisitos

Antes de começar, você vai precisar de:

* **Node.js 24 LTS** (definido em `package.json` como `24.x`) e **npm**
* **Git**
* Uma conta e um projeto criado no **Supabase** (o plano gratuito é suficiente para desenvolvimento local)

## Como rodar o Bonfire na sua máquina

### 1\. Clone o repositório

```bash
git clone https://github.com/blueclaro/bonfire.git
cd bonfire
```

### 2\. Instale as dependências

```bash
npm ci
```

> O projeto mantém arquivos do `pnpm` por compatibilidade, mas o fluxo oficial de instalação local e deploy usa `npm ci` com `package-lock.json`.

### 3\. Configure as variáveis de ambiente

Copie o arquivo de exemplo para `.env.local`:

**Linux / macOS:**

```bash
cp .env.example .env.local
```

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env.local
```

Abra `.env.local` e preencha com os dados públicos do seu projeto Supabase (*Project Settings → API*):

```env
NEXT\_PUBLIC\_SUPABASE\_URL=https://SEU-PROJETO.supabase.co
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=SUA-CHAVE-PUBLICA
```

> \*\*Importante:\*\* use \*\*apenas\*\* a chave pública (`anon` / `publishable`). Nunca coloque uma chave `service\_role` ou `secret` no `.env.local`, e não envie esse arquivo para o GitHub.

### 4\. Configure o banco de dados no Supabase

Abra o **SQL Editor** do seu projeto Supabase e execute os scripts abaixo em uma **instalação nova**.

Primeiro, execute o schema base:

1. `supabase/schema.sql`

> O `schema.sql` já inclui as tabelas principais, políticas RLS, avisos, edição/moderação de tópicos, denúncias, remoção reversível, notificações e a base de contas temporárias. \*\*Não\*\* execute as migrações antigas de `20260921\_\*` nem `20260923\_\*` por cima dele.

Em seguida, execute as migrações posteriores **exatamente nesta ordem**:

1. `supabase/migrations/20260924\_social\_feed.sql`
2. `supabase/migrations/20260924\_social\_storage.sql`
3. `supabase/migrations/20260925\_school\_label\_letters\_numbers.sql`
4. `supabase/migrations/20260925\_social\_connections\_threads.sql`
5. `supabase/migrations/20260925\_permanent\_profile\_tags.sql`
6. `supabase/migrations/20260925\_ignite\_mentions.sql`
7. `supabase/migrations/20260925\_temporary\_posts\_visible\_to\_permanent\_users.sql`
8. `supabase/migrations/20260925\_user\_chat\_groups.sql`
9. `supabase/migrations/20260925\_staff\_remove\_sparks.sql`
10. `supabase/migrations/20261005\_account\_approval.sql`
11. `supabase/migrations/20261005\_fix\_account\_review\_queue.sql`
12. `supabase/migrations/20261005\_profile\_photos.sql`
13. `supabase/migrations/20261005\_required\_profile\_tags.sql`

> \*\*Observações:\*\*
> - A migração `20260925\_school\_label\_letters\_numbers.sql` substitui `20260925\_school\_label\_digits.sql`, que não precisa ser executada.
> - Os buckets privados de imagens (`post-images` e `avatars`) e suas políticas de acesso são criados automaticamente pelos scripts acima. Não é necessário torná-los públicos nem desabilitar RLS.

### 5\. Configure a autenticação no Supabase Auth

No painel do Supabase, ajuste os itens abaixo antes de testar cadastro e login:

1. **URLs de redirecionamento** (*Authentication → URL Configuration*):

   * **Site URL:** `http://localhost:3000`
   * **Redirect URLs:** adicione `http://localhost:3000/redefinir-senha`
2. **Template de confirmação de e-mail** (*Authentication → Email Templates → Confirm signup*):

   * O cadastro em `/cadastro/verificacao` usa verificação por código OTP. Copie o conteúdo de `supabase/templates/confirmation.html` (que exibe `{{ .Token }}`) para o template **Confirm signup**.
3. **Template de recuperação de senha** (*Authentication → Email Templates → Reset Password*):

   * Mantenha o link padrão `{{ .ConfirmationURL }}` (o projeto usa o fluxo implícito com tokens no fragmento da URL).
4. **Contas temporárias (opcional):**

   * Se quiser usar `/conta-temporaria` e o QR Code em `/apresentacao`, habilite **Anonymous Sign-Ins** em *Authentication → Providers* e libere o acesso no **SQL Editor**:

```sql
update public.temporary\_access\_settings
set registration\_enabled = true,
    access\_enabled = true,
    duration\_hours = 24,
    max\_accounts = 200
where id = true;
```

Para fechar novas inscrições temporárias depois sem apagar dados:

```sql
update public.temporary\_access\_settings
set registration\_enabled = false
where id = true;
```

### 6\. Inicie o servidor local

```bash
npm run dev
```

Abra [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) no navegador.

### 7\. Aprove sua primeira conta administradora

Por padrão, toda conta permanente criada em `/cadastro` entra com cargo `student` e status `pending` (aguardando aprovação da moderação).

Depois de criar sua primeira conta e confirmar o e-mail em `/cadastro/verificacao`, aprove e promova essa conta diretamente no **SQL Editor** do Supabase (substituindo `seuusuario#tag` pelo nome de usuário e tag cadastrados):

```sql
update public.profiles
set role = 'coordination',
    approval\_status = 'approved'
where lower(username) = 'seuusuario#tag';
```

Os cargos válidos no banco são `student`, `teacher`, `coordination` e `moderator`. Com uma conta `coordination` ou `moderator`, você já consegue aprovar novos usuários em `/moderacao` e analisar denúncias em `/denuncias`.

## Comandos disponíveis

|Comando|Descrição|
|-|-|
|`npm run dev`|Inicia o servidor de desenvolvimento em `http://localhost:3000`|
|`npm run build`|Gera o build de produção do Next.js|
|`npm run start`|Sobe o servidor usando o build de produção|
|`npm run typecheck`|Executa a verificação de tipos TypeScript (`tsc --noEmit`)|
|`npm test`|Roda os testes unitários (`tests/\*.test.cjs`)|
|`npm run test:moderation`|Testes de integração de moderação de tópicos|
|`npm run test:approval`|Testes de integração de aprovação de contas|
|`npm run test:photos`|Testes unitários e de integração de fotos de perfil|
|`npm run test:reports`|Testes de integração de denúncias e remoção reversível|
|`npm run test:notifications`|Testes de integração de notificações|
|`npm run test:temporary`|Testes unitários e de integração de contas temporárias|

> \*\*Build paralelo no Windows (PowerShell):\*\* se quiser testar o build sem interferir no `npm run dev` aberto, rode `$env:BONFIRE\_BUILD\_DIR='.next-build'; npm run build`. Remova a variável antes de usar `npm run start`.

## Como rodar os testes de integração

Os testes unitários (`npm test`) rodam direto sem configuração extra.

Já os testes de integração (`tests/\*.integration.cjs`) usam um PostgreSQL descartável em memória com **PGlite**, sem acessar seu projeto real no Supabase. Para instalá-lo em `.test-tools` e rodar a suíte completa:

```bash
npm install --prefix .test-tools --no-save --package-lock=false @electric-sql/pglite
node --test tests/\*.test.cjs tests/\*.integration.cjs
```

## Estrutura do projeto

```text
bonfire/
├── public/                 # Ícones, imagens e GIFs da interface
├── src/
│   ├── app/                # Rotas do Next.js App Router (feed, fóruns, chats, mensagens, moderação, etc.)
│   ├── components/         # Componentes React reutilizáveis
│   ├── data/               # Dados auxiliares
│   └── lib/                # Cliente Supabase, regras de perfil, notificações e utilitários
├── supabase/
│   ├── schema.sql          # Schema consolidado para novas instalações
│   ├── migrations/         # Migrações incrementais de banco e Storage
│   └── templates/          # Template HTML do e-mail de confirmação com código OTP
├── tests/                  # Testes unitários (.test.cjs) e de integração com PGlite (.integration.cjs)
├── .env.example            # Modelo das variáveis de ambiente
├── next.config.ts          # Configuração do Next.js
└── vercel.json             # Configuração de build/instalação na Vercel
```

## Deploy na Vercel

1. Importe o repositório na Vercel como um projeto **Next.js** (a raiz é a própria pasta do repositório).
2. O arquivo `vercel.json` já define `npm ci` e `npm run build`, usando Node.js `24.x`. Não defina `BONFIRE\_BUILD\_DIR` na Vercel.
3. Cadastre `NEXT\_PUBLIC\_SUPABASE\_URL` e `NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY` nas variáveis de ambiente da Vercel (use um projeto Supabase separado para ambientes de teste/preview).
4. No painel do Supabase (*Authentication → URL Configuration*), atualize a **Site URL** para o domínio publicado e adicione `https://SEU-DOMINIO/redefinir-senha` em **Redirect URLs**.
5. Lembre-se de que as migrações SQL em `supabase/` não rodam automaticamente pela Vercel e precisam ser aplicadas manualmente no Supabase.

## Problemas comuns

* **"Configure o arquivo `.env.local` antes de cadastrar":** verifique se o arquivo está na raiz do projeto com o nome exato `.env.local` e reinicie o `npm run dev` após salvar.
* **Conta presa na tela de aprovação após o cadastro:** comportamento esperado para novos usuários. Execute o `UPDATE` da etapa 7 no SQL Editor do Supabase para aprovar sua primeira conta.
* **E-mail de cadastro chega sem código numérico:** confira se o template **Confirm signup** no Supabase Auth foi atualizado com o conteúdo de `supabase/templates/confirmation.html` (`{{ .Token }}`).
* **Erro ao acessar `/conta-temporaria`:** verifique se **Anonymous Sign-Ins** está ativado no Supabase Auth e se `registration\_enabled` e `access\_enabled` estão como `true` na tabela `public.temporary\_access\_settings`.

