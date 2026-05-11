import { NextResponse } from "next/server";

type AnalysisRequest = {
  mode?: string;
  customPrompt?: string;
  period?: string;
  summary?: unknown;
  previousSummary?: unknown;
  ranking?: unknown;
  trend?: unknown;
  decision?: unknown;
};

function modeLabel(mode?: string) {
  if (mode === "diagnosis") return "diagnosticar quedas, gargalos e perda de qualidade";
  if (mode === "creative") return "comparar campanha, conjunto e anúncio para encontrar padrões de qualidade";
  return "decidir onde aumentar, reduzir ou pausar verba";
}

function extractText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (payload.output_text) return payload.output_text;
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "A análise por IA já está pronta, mas falta configurar a chave OPENAI_API_KEY no Vercel.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as AnalysisRequest;
  const model = process.env.OPENAI_MODEL || "gpt-5.2";
  const input = {
    periodo: body.period,
    objetivo: modeLabel(body.mode),
    comando_especifico: body.customPrompt || "Sem comando específico.",
    resumo_periodo_atual: body.summary,
    resumo_periodo_anterior: body.previousSummary,
    ranking_atual: body.ranking,
    tendencia_recente: body.trend,
    destaques_calculados: body.decision,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: [
        "Voce e um expert senior em performance de marketing, midia paga, funil comercial e vendas para agencias.",
        "Analise os dados com foco em decisao pratica: aumentar verba, manter, pausar, investigar ou testar criativos.",
        "Nao invente numeros. Use apenas os dados enviados.",
        "Responda em portugues do Brasil, direto e executivo.",
        "Estruture em: leitura do periodo, principais vencedores, pontos de atencao, proximas acoes.",
      ].join("\n"),
      input: JSON.stringify(input),
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "A OpenAI respondeu com erro ao gerar a análise. Verifique a chave e o modelo configurado." },
      { status: 502 },
    );
  }

  const payload = await response.json();
  const analysis = extractText(payload);

  return NextResponse.json({
    analysis: analysis || "A IA não retornou texto para esta análise.",
  });
}
