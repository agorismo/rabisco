# Segurança

## Reportando uma vulnerabilidade

**Não abra uma issue pública.** Use o *Private vulnerability reporting* do GitHub: aba **Security → Report a vulnerability** deste repositório. Respondemos assim que possível e damos crédito a quem reportar, se desejar.

## Modelo de segurança

O site é estático e público. Isso significa que **qualquer pessoa pode ver o código e a chave `anon`/publishable do Supabase** — isso é esperado. A proteção dos dados vem de:

- **RLS (Row Level Security)** ativa em todas as tabelas, com políticas explícitas
- Permissões de coluna restritas (ninguém altera o próprio `role`)
- Limite de posts por hora por usuário (trigger no banco)
- Bucket de imagens com limite de 2 MB e apenas `image/png`, com upload só na pasta do próprio usuário
- Validação de tudo que chega por salas em tempo real (cor, tamanho, número de pontos)
- Exibição de conteúdo de usuários sempre com `textContent`, nunca `innerHTML`
- Avisos no Discord com menções desativadas (`allowed_mentions`)

## O que NUNCA deve estar no repositório

| Segredo | Onde fica |
|---|---|
| `service_role` key do Supabase | Apenas em Edge Functions (injetada pelo Supabase) |
| Token do bot do Discord | `.env` do bot / secrets da hospedagem |
| Client secret do OAuth do Discord | Painel do Supabase (Authentication → Providers) |
| URL do webhook do Discord | `supabase secrets set` |
| `WEBHOOK_SECRET` | `supabase secrets set` e cabeçalho do Database Webhook |

## Checklist de mantenedor

- [ ] Ativar **Secret scanning** e **Push protection** (Settings → Code security)
- [ ] Ativar **Private vulnerability reporting**
- [ ] Proteger a branch `main` (exigir PR e revisão)
- [ ] Ativar o Dependabot para `bot/` e para os workflows
- [ ] Conferir que a RLS está ativa em todas as tabelas (`select tablename, rowsecurity from pg_tables where schemaname = 'public';`)

## Se algum segredo vazar

1. **Troque a chave imediatamente** (Developer Portal do Discord, painel do Supabase, novo webhook). Apagar o commit não adianta: o histórico do Git continua acessível.
2. Atualize os secrets nos lugares onde ela é usada.
3. Se necessário, limpe o histórico com `git filter-repo` e avise os contribuidores.
