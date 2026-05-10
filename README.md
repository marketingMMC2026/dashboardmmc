# Dashboard MMC

Dashboard interno para analise de leads, campanhas e qualificacao comercial.

## Objetivo

Analisar a evolucao do funil por fonte, campanha, conjunto, anuncio e atributos do lead. A camada principal de enriquecimento vem de `lead_attributes`, ligada pelo `lead_id`.

## Rodar localmente

1. Instale as dependencias.
2. Copie `.env.example` para `.env.local`.
3. Preencha `SUPABASE_SERVICE_ROLE_KEY` com a chave segura do Supabase.
4. Rode `npm run dev`.

## Variaveis no Vercel

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Use a service role key apenas no servidor/Vercel. Ela nunca deve virar variavel `NEXT_PUBLIC_`.
