# Contribuindo com o Rabisco

Obrigado por querer ajudar! Qualquer contribuição conta: código, design, textos, testes, ideias e relatos de bugs.

## Antes de começar

- Procure nas [issues](../../issues) se já existe algo parecido.
- Para mudanças grandes, abra uma issue primeiro para conversarmos.
- Issues marcadas com `good first issue` são boas para começar.
- Leia o [Código de Conduta](CODE_OF_CONDUCT.md).

## Rodando o projeto

1. Faça um fork e clone.
2. Para mexer só no canvas: `npx serve web` e pronto, não precisa de backend.
3. Para mexer em salas, login ou galeria: crie **o seu próprio** projeto gratuito no Supabase, rode a migration de `supabase/migrations/` e preencha `web/config.local.js` (ignorado pelo Git). Veja [docs/SETUP.md](docs/SETUP.md).
4. Para mexer no bot: `cd bot && npm install`, copie `.env.example` para `.env` e use um bot de teste seu.

## Regras importantes

- **Nunca** commite segredos (tokens, `service_role`, URLs de webhook, `.env`). O GitHub bloqueia alguns, mas não todos. Se vazar algo, avise na hora para trocarmos a chave.
- Toda tabela nova precisa de **RLS** e de políticas explícitas na migration.
- Tudo que vem de outros usuários (traços, títulos, nomes) é **não confiável**: valide antes de usar e nunca coloque em `innerHTML` (use `textContent`).
- Migrations novas ficam em `supabase/migrations/` com numeração sequencial. Não edite migrations antigas.

## Padrão de código

- JavaScript moderno (ES modules), sem build obrigatório no front-end.
- Nomes de variáveis em português ou inglês, mas consistentes dentro do arquivo.
- Mantenha cada pincel/ferramenta isolado, para que seja fácil adicionar um novo sem mexer no resto.
- Antes de abrir o PR, rode `node --check` nos arquivos que alterou.

## Pull requests

1. Crie uma branch a partir de `main` (`feat/pincel-aerografo`, `fix/undo-na-sala`...).
2. Faça commits pequenos e com mensagens claras.
3. Preencha o template do PR e, se mudou a interface, anexe uma captura de tela.
4. A `main` é protegida: todo PR passa por revisão e pelo CI.

## Reportando vulnerabilidades

Não abra issue pública. Veja o [SECURITY.md](SECURITY.md).
