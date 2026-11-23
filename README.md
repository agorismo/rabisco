# 🖍️ Rabisco

Um paint online, aberto e colaborativo. Desenhe sozinho ou com amigos em tempo real, publique seus desenhos, remixe os dos outros e receba tudo no Discord.

> Projeto open source (MIT). Contribuições são muito bem-vindas — veja o [CONTRIBUTING](CONTRIBUTING.md).

## O que já tem (v0.1)

- Canvas com traço suave (Pointer Events + [perfect-freehand](https://github.com/steveruizok/perfect-freehand)), com suporte a caneta, toque e mouse
- Lápis, marcador e borracha, cores e tamanho
- Desfazer / refazer, exportar PNG, salvar e abrir `.json`
- **Salas colaborativas** (`?sala=abc123`) com Supabase Realtime: o que viaja é o *traço*, não pixels
- Login com Discord, **publicar** desenhos e **galeria** pública
- **Remix**: abrir um desenho publicado e continuar a partir dele (`?remix=<id>`)
- Banco com **RLS**, limite de posts por hora, base de moderação e denúncias
- Bot de Discord (`/desenhar`, `/galeria`) e aviso automático de novos posts via webhook

## Estrutura

```
web/        site estático (GitHub Pages): index.html, app.js, galeria.html
supabase/   migrations (tabelas + RLS + storage) e Edge Function notify-discord
bot/        bot do Discord (Node + Eris)
docs/       guia de configuração
.github/    workflows (deploy no Pages, CI) e templates
```

## Rodando local (sem backend)

O canvas funciona sozinho, sem nenhuma configuração:

```bash
npx serve web
# ou: python -m http.server -d web 8000
```

Abra `http://localhost:3000` (ou `:8000`). Salas, login e galeria só aparecem quando o Supabase está configurado.

## Com backend (salas, login, galeria)

Siga o [docs/SETUP.md](docs/SETUP.md). Resumo:

1. Crie um projeto gratuito no [Supabase](https://supabase.com)
2. Rode `supabase/migrations/0001_init.sql` no SQL Editor
3. Copie `web/config.local.example.js` para `web/config.local.js` e preencha a URL e a chave **anon/publishable** (esse arquivo é ignorado pelo Git)
4. Ative o provedor Discord em *Authentication → Providers*

## Segurança em uma linha

A chave `anon` é pública por design; quem protege os dados é a **RLS** no banco. Segredos (token do bot, `service_role`, webhooks) **nunca** entram no repositório. Detalhes em [SECURITY.md](SECURITY.md).

## Roadmap

- [ ] Camadas, zoom e pan, formas, balde
- [ ] Curtidas e comentários na interface (as tabelas já existem)
- [ ] Replay/timelapse dos desenhos
- [ ] Ordenação consistente entre clientes com CRDT (Yjs)
- [ ] Desafio diário e mural estilo r/place
- [ ] Painel de moderação

## Licença

[MIT](LICENSE). Se a comunidade preferir que versões modificadas e hospedadas continuem abertas, dá para migrar para AGPL-3.0 — a discussão deve acontecer antes das primeiras contribuições externas.
