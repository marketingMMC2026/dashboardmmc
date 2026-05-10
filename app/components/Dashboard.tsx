"use client";

import { useMemo, useState } from "react";
import type { CampaignRow, DashboardData } from "@/app/lib/dashboard-data";

type Props = {
  initialData: DashboardData;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const number = new Intl.NumberFormat("pt-BR");

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="barTrack" aria-hidden="true">
      <div className="barFill" style={{ width: `${width}%` }} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <section className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function MiniTrend({ data }: { data: DashboardData["trends"] }) {
  const max = Math.max(...data.map((item) => item.leads), 1);
  const points = data
    .map((item, index) => {
      const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
      const y = 50 - (item.leads / max) * 42;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="trendChart" viewBox="0 0 100 56" preserveAspectRatio="none" role="img" aria-label="Evolução de leads">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RankingTable({ rows }: { rows: CampaignRow[] }) {
  const maxLeads = Math.max(...rows.map((row) => row.leads), 1);

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Origem</th>
            <th>Leads</th>
            <th>Qualificados</th>
            <th>Taxa</th>
            <th>Verba/dia</th>
            <th>Último lead</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.level}-${row.id}`}>
              <td>
                <div className="nameCell">
                  <b>{row.name}</b>
                  <span>{row.level}</span>
                </div>
              </td>
              <td>{row.source}</td>
              <td>
                <div className="barCell">
                  <span>{number.format(row.leads)}</span>
                  <Bar value={row.leads} max={maxLeads} />
                </div>
              </td>
              <td>{number.format(row.qualified)}</td>
              <td>{row.qualificationRate.toFixed(1)}%</td>
              <td>{row.dailyBudget ? currency.format(row.dailyBudget) : "-"}</td>
              <td>{formatDate(row.lastLeadAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard({ initialData }: Props) {
  const [view, setView] = useState<"campaigns" | "sources">("campaigns");
  const [query, setQuery] = useState("");

  const rows = view === "campaigns" ? initialData.campaigns : initialData.sources;
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => `${row.name} ${row.source} ${row.level}`.toLowerCase().includes(search));
  }, [query, rows]);

  const topRow = [...initialData.sources, ...initialData.campaigns].sort(
    (a, b) => b.qualificationRate - a.qualificationRate || b.qualified - a.qualified,
  )[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Agência · Performance</p>
          <h1>Dashboard de campanhas</h1>
        </div>
        <div className="statusPill">
          <span className={initialData.source === "live" ? "dot live" : "dot"} />
          {initialData.source === "live" ? "Dados ao vivo" : "Amostra inicial"}
        </div>
      </header>

      <section className="decisionPanel">
        <div>
          <p className="eyebrow">Decisão principal</p>
          <h2>{topRow ? `Prioridade: ${topRow.name}` : "Aguardando dados suficientes"}</h2>
          <p>
            Compare volume com taxa de qualificação antes de duplicar campanha. Aumente verba quando a campanha mantiver
            qualidade e consistência diária, não apenas pico de leads.
          </p>
        </div>
        <div className="insights">
          {initialData.insights.map((insight) => (
            <span key={insight}>{insight}</span>
          ))}
        </div>
      </section>

      <section className="metricsGrid">
        <MetricCard label="Leads" value={number.format(initialData.totals.leads)} detail="Captados no período disponível" />
        <MetricCard
          label="Atributos"
          value={number.format(initialData.totals.attributes)}
          detail={`${number.format(initialData.totals.attributedLeads)} leads enriquecidos`}
        />
        <MetricCard
          label="Qualificados"
          value={number.format(initialData.totals.qualified)}
          detail={`${initialData.totals.qualificationRate.toFixed(1)}% de qualificação`}
          tone="good"
        />
        <MetricCard
          label="Estrutura ativa"
          value={`${initialData.totals.activeCampaigns}/${initialData.totals.activeAdsets}/${initialData.totals.activeAds}`}
          detail="Campanhas, conjuntos e anúncios"
        />
        <MetricCard
          label="Melhor taxa"
          value={topRow ? `${topRow.qualificationRate.toFixed(1)}%` : "0%"}
          detail={topRow?.name ?? "Sem histórico"}
          tone="warn"
        />
      </section>

      <section className="analysisGrid">
        <div className="panel wide">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Evolução</p>
              <h3>Leads por dia</h3>
            </div>
            <span>{formatDate(initialData.updatedAt)}</span>
          </div>
          <MiniTrend data={initialData.trends} />
          <div className="trendBars">
            {initialData.trends.slice(-12).map((item) => (
              <div key={item.date}>
                <i style={{ height: `${Math.max(8, item.leads)}px` }} />
                <span>{formatDate(item.date)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Funil</p>
              <h3>Captação até qualificação</h3>
            </div>
          </div>
          <div className="funnel">
            {initialData.funnel.map((step, index) => (
              <div key={step.label} className="funnelStep">
                <span>{step.label}</span>
                <strong>{index === 2 ? `${step.value.toFixed(1)}%` : number.format(step.value)}</strong>
                {index < 2 ? <Bar value={step.value} max={initialData.funnel[0].value} /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel tablePanel">
        <div className="panelHead tools">
          <div>
            <p className="eyebrow">Ranking operacional</p>
            <h3>{view === "campaigns" ? "Campanhas, conjuntos e anúncios" : "Fontes de aquisição"}</h3>
          </div>
          <div className="controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar" />
            <div className="segmented">
              <button className={view === "campaigns" ? "active" : ""} onClick={() => setView("campaigns")}>
                Campanhas
              </button>
              <button className={view === "sources" ? "active" : ""} onClick={() => setView("sources")}>
                Fontes
              </button>
            </div>
          </div>
        </div>
        <RankingTable rows={filteredRows} />
      </section>
    </main>
  );
}
