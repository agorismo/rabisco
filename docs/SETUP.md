# Guia de configuração

Tudo abaixo cabe nos planos gratuitos. Você só precisa do backend se quiser salas, login e galeria; o canvas funciona sem nada.

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e rode `supabase/migrations/0001_init.sql`.
3. Em **Table Editor**, confira que todas as tabelas (`profiles`, `posts`, `likes`, `comments`, `reports`) mostram **RLS enabled**.
4. Em **Project Settings → API**, copie a **URL** e a chave **anon / publishable**. Essas duas podem ir para o site.

## 2. Login com Discord

1. No [Discord Developer Portal](https://discord.com/developers/applications), crie um aplicativo.
2. Em **OAuth2**, adicione como *Redirect* a URL de callback que aparece em **Supabase → Authentication → Providers → Discord**.
3. Copie *Client ID* e *Client Secret* para esse mesmo painel do Supabase e ative o provedor. O client secret fica só no painel, nunca no repositório.
4. Em **Authentication → URL Configuration**, ponha a URL do seu site em *Site URL* e em *Redirect URLs* (ex.: `https://seu-usuario.github.io/rabisco/`, e `http://localhost:3000` para testes).

## 3. Site no GitHub Pages

1. Edite `web/config.js` com a URL e a chave anon do projeto oficial (são públicas).
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**. O workflow `pages.yml` publica a pasta `web/` a cada push na `main`.

Para desenvolver com o **seu** projeto sem mexer no `config.js`, copie `web/config.local.example.js` para `web/config.local.js` (o Git ignora esse arquivo).

## 4. Aviso automático no Discord (opcional)

1. No canal desejado: **Editar canal → Integrações → Webhooks → Novo webhook** e copie a URL (ela é um segredo).
2. Com a [CLI do Supabase](https://supabase.com/docs/guides/cli) logada e ligada ao projeto (`supabase link`):

   ```bash
   supabase secrets set WEBHOOK_SECRET="$(openssl rand -hex 24)" \
     DISCORD_WEBHOOK_URL="cole-a-url-do-webhook" \
     SITE_URL="https://seu-usuario.github.io/rabisco"
   supabase functions deploy notify-discord
   ```

   Anote o valor gerado para `WEBHOOK_SECRET`; você vai usá-lo no passo seguinte.
3. Em **Database → Webhooks → Create a new hook**: tabela `posts`, evento **Insert**, tipo **Supabase Edge Functions** (ou HTTP Request para a URL da função), método `POST`, e o cabeçalho `x-webhook-secret` com o valor do passo anterior.

## 5. Bot do Discord (opcional)

1. No mesmo aplicativo do Developer Portal (ou em outro), abra **Bot** e gere o token.
2. Convide o bot com os escopos `bot` e `applications.commands`. Ele não precisa de permissões especiais além de enviar mensagens e inserir links/embeds.
3. Configure e rode:

   ```bash
   cd bot
   cp .env.example .env   # preencha os valores
   npm install
   npm start
   ```

   O bot usa **apenas a chave anon** e só lê posts públicos.
4. Hospedagem: ele precisa ficar ligado. Opções: seu PC, Render, Railway, Fly.io ou uma VPS. Configure as variáveis de ambiente no painel da hospedagem (nunca no repositório).

## 6. Primeiro moderador

Depois de entrar no site uma vez, rode no SQL Editor:

```sql
update public.profiles set role = 'mod' where id = '<seu uuid em Authentication → Users>';
```

## 7. Ao abrir o repositório ao público

- [ ] Settings → Code security: ativar **Secret scanning**, **Push protection**, **Dependabot** e **Private vulnerability reporting**
- [ ] Settings → Branches: regra para `main` exigindo PR e o check de CI
- [ ] Conferir que nenhum `.env` ou `config.local.js` foi commitado: `git ls-files | grep -E "\.env|config\.local"` deve voltar vazio (exceto `.env.example`)
