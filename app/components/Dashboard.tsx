"use client";

import { useMemo, useState } from "react";
import type { CampaignRow, DashboardData, LeadRow } from "@/app/lib/dashboard-data";

type Props = {
  initialData: DashboardData;
};

type ColumnKey =
  | "createdAt"
  | "name"
  | "contact"
  | "source"
  | "campaign"
  | "adset"
  | "ad"
  | "form"
  | "qualified"
  | "scheduled"
  | "hasOffice"
  | "revenueRange"
  | "scheduleStatus"
  | "summary";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const number = new Intl.NumberFormat("pt-BR");

const leadColumns: { key: ColumnKey; label: string }[] = [
  { key: "createdAt", label: "Cadastro" },
  { key: "name", label: "Lead" },
  { key: "contact", label: "Contato" },
  { key: "source", label: "Origem" },
  { key: "campaign", label: "Campanha" },
  { key: "adset", label: "Conjunto" },
  { key: "ad", label: "Anúncio" },
  { key: "form", label: "Formulário" },
  { key: "qualified", label: "Qualificado" },
  { key: "scheduled", label: "Agendado" },
  { key: "hasOffice", label: "Tem escritório" },
  { key: "revenueRange", label: "Faturamento" },
  { key: "scheduleStatus", label: "Status agendamento" },
  { key: "summary", label: "Resumo IA" },
];

const defaultLeadColumns: ColumnKey[] = [
  "createdAt",
  "name",
  "contact",
  "source",
  "campaign",
  "qualified",
  "scheduled",
  "hasOffice",
  "revenueRange",
  "form",
];

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatFullDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function boolLabel(value: boolean | null) {
  if (value === null) return "-";
  return value ? "Sim" : "Não";
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

function LeadCell({ lead, column }: { lead: LeadRow; column: ColumnKey }) {
  if (column === "createdAt") return <span>{formatFullDate(lead.createdAt)}</span>;

  if (column === "contact") {
    return (
      <div className="stackCell">
        <b>{lead.phone}</b>
        <span>{lead.email}</span>
      </div>
    );
  }

  if (column === "qualified") return <span className={`badge ${lead.qualified ? "good" : ""}`}>{boolLabel(lead.qualified)}</span>;
  if (column === "scheduled") return <span className={`badge ${lead.scheduled ? "good" : ""}`}>{boolLabel(lead.scheduled)}</span>;
  if (column === "hasOffice") return <span className={`badge ${lead.hasOffice ? "good" : lead.hasOffice === false ? "bad" : ""}`}>{boolLabel(lead.hasOffice)}</span>;

  const value = lead[column];
  return <span className={column === "summary" ? "clampCell" : ""}>{typeof value === "string" ? value : "-"}</span>;
}

function MultiFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <details className="multiFilter">
      <summary>
        {label}
        <span>{selected.length ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}` : "Todos"}</span>
      </summary>
      <div className="multiFilterList">
        <button type="button" onClick={() => onChange([])}>Limpar</button>
        {options.map((option) => (
          <label key={option}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </details>
  );
}

function LeadsView({ data }: { data: DashboardData }) {
  const [leadView, setLeadView] = useState<"all" | "hot" | "low">("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [source, setSource] = useState("all");
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [adsets, setAdsets] = useState<string[]>([]);
  const [ads, setAds] = useState<string[]>([]);
  const [qualified, setQualified] = useState("all");
  const [scheduled, setScheduled] = useState("all");
  const [hasOffice, setHasOffice] = useState("all");
  const [revenues, setRevenues] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(defaultLeadColumns);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const uniqueSources = useMemo(() => [...new Set(data.leads.map((lead) => lead.source).filter(Boolean))].sort(), [data.leads]);
  const uniqueCampaigns = useMemo(() => [...new Set(data.leads.map((lead) => lead.campaign).filter((item) => item && item !== "-"))].sort(), [data.leads]);
  const uniqueAdsets = useMemo(() => [...new Set(data.leads.map((lead) => lead.adset).filter((item) => item && item !== "-"))].sort(), [data.leads]);
  const uniqueAds = useMemo(() => [...new Set(data.leads.map((lead) => lead.ad).filter((item) => item && item !== "-"))].sort(), [data.leads]);
  const uniqueRevenue = useMemo(() => [...new Set(data.leads.map((lead) => lead.revenueRange).filter((item) => item && item !== "-"))].sort(), [data.leads]);

  const filteredLeads = useMemo(() => {
    const now = Date.now();
    const maxAge = period === "all" || period === "custom" ? null : Number(period) * 24 * 60 * 60 * 1000;
    const startDate = customStart ? new Date(`${customStart}T00:00:00`).getTime() : null;
    const endDate = customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : null;
    const query = search.trim().toLowerCase();

    return data.leads.filter((lead) => {
      const createdAt = new Date(lead.createdAt).getTime();
      const text = `${lead.name} ${lead.phone} ${lead.email} ${lead.source} ${lead.campaign} ${lead.form} ${lead.summary}`.toLowerCase();

      if (leadView !== "all" && lead.quality !== leadView) return false;
      if (maxAge && now - createdAt > maxAge) return false;
      if (period === "custom" && startDate && createdAt < startDate) return false;
      if (period === "custom" && endDate && createdAt > endDate) return false;
      if (query && !text.includes(query)) return false;
      if (source !== "all" && lead.source !== source) return false;
      if (campaigns.length && !campaigns.includes(lead.campaign)) return false;
      if (adsets.length && !adsets.includes(lead.adset)) return false;
      if (ads.length && !ads.includes(lead.ad)) return false;
      if (qualified !== "all" && String(lead.qualified) !== qualified) return false;
      if (scheduled !== "all" && String(lead.scheduled) !== scheduled) return false;
      if (hasOffice !== "all" && String(lead.hasOffice) !== hasOffice) return false;
      if (revenues.length && !revenues.includes(lead.revenueRange)) return false;
      return true;
    });
  }, [ads, adsets, campaigns, customEnd, customStart, data.leads, hasOffice, leadView, period, qualified, revenues, scheduled, search, source]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hotLeads = filteredLeads.filter((lead) => lead.quality === "hot").length;
  const qualifiedLeads = filteredLeads.filter((lead) => lead.qualified).length;
  const scheduledLeads = filteredLeads.filter((lead) => lead.scheduled).length;
  const hotRate = filteredLeads.length ? (hotLeads / filteredLeads.length) * 100 : 0;
  const qualifiedRate = filteredLeads.length ? (qualifiedLeads / filteredLeads.length) * 100 : 0;
  const scheduledRate = filteredLeads.length ? (scheduledLeads / filteredLeads.length) * 100 : 0;

  function toggleColumn(column: ColumnKey) {
    setVisibleColumns((current) => {
      if (current.includes(column)) return current.filter((item) => item !== column);
      return [...current, column];
    });
  }

  return (
    <section className="leadsLayout">
      <div className="leadSummaryGrid">
        <MetricCard label="Leads filtrados" value={number.format(filteredLeads.length)} detail="Resultado dos filtros atuais" />
        <MetricCard label="Leads quentes" value={number.format(hotLeads)} detail={`${hotRate.toFixed(1)}% dos filtrados`} tone="warn" />
        <MetricCard label="Qualificados" value={number.format(qualifiedLeads)} detail={`${qualifiedRate.toFixed(1)}% dos filtrados`} tone="good" />
        <MetricCard label="Agendados" value={number.format(scheduledLeads)} detail={`${scheduledRate.toFixed(1)}% dos filtrados`} />
      </div>

      <section className="panel tablePanel">
        <div className="panelHead tools">
          <div>
            <p className="eyebrow">Leads</p>
            <h3>Lista operacional</h3>
          </div>
          <div className="segmented">
            <button className={leadView === "all" ? "active" : ""} onClick={() => { setLeadView("all"); setPage(1); }}>
              Todos
            </button>
            <button className={leadView === "hot" ? "active" : ""} onClick={() => { setLeadView("hot"); setPage(1); }}>
              Quentes
            </button>
            <button className={leadView === "low" ? "active" : ""} onClick={() => { setLeadView("low"); setPage(1); }}>
              Baixa qualidade
            </button>
          </div>
        </div>

        <div className="filtersGrid">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar lead" />
          <select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Personalizado</option>
            <option value="all">Todo histórico</option>
          </select>
          {period === "custom" ? (
            <>
              <input type="date" value={customStart} onChange={(event) => { setCustomStart(event.target.value); setPage(1); }} />
              <input type="date" value={customEnd} onChange={(event) => { setCustomEnd(event.target.value); setPage(1); }} />
            </>
          ) : null}
          <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
            <option value="all">Todas as origens</option>
            {uniqueSources.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={qualified} onChange={(event) => { setQualified(event.target.value); setPage(1); }}>
            <option value="all">Qualificação</option>
            <option value="true">Qualificados</option>
            <option value="false">Não qualificados</option>
          </select>
          <select value={scheduled} onChange={(event) => { setScheduled(event.target.value); setPage(1); }}>
            <option value="all">Agendamento</option>
            <option value="true">Agendados</option>
            <option value="false">Não agendados</option>
          </select>
          <select value={hasOffice} onChange={(event) => { setHasOffice(event.target.value); setPage(1); }}>
            <option value="all">Tem escritório?</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
            <option value="null">Sem informação</option>
          </select>
        </div>

        <div className="multiFiltersGrid">
          <MultiFilter label="Campanhas" options={uniqueCampaigns} selected={campaigns} onChange={(next) => { setCampaigns(next); setPage(1); }} />
          <MultiFilter label="Conjuntos" options={uniqueAdsets} selected={adsets} onChange={(next) => { setAdsets(next); setPage(1); }} />
          <MultiFilter label="Anúncios" options={uniqueAds} selected={ads} onChange={(next) => { setAds(next); setPage(1); }} />
          <MultiFilter label="Faturamento" options={uniqueRevenue} selected={revenues} onChange={(next) => { setRevenues(next); setPage(1); }} />
        </div>

        <details className="columnConfig">
          <summary>Configurar colunas</summary>
          <div>
            {leadColumns.map((column) => (
              <label key={column.key}>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                />
                {column.label}
              </label>
            ))}
          </div>
        </details>

        <div className="tableWrap">
          <table className="leadsTable">
            <thead>
              <tr>
                {visibleColumns.map((column) => <th key={column}>{leadColumns.find((item) => item.key === column)?.label}</th>)}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pagedLeads.map((lead) => (
                <tr key={lead.id} className={`lead-${lead.quality}`}>
                  {visibleColumns.map((column) => (
                    <td key={column}>
                      <LeadCell lead={lead} column={column} />
                    </td>
                  ))}
                  <td>
                    <button className="smallButton" onClick={() => setSelectedLead(lead)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="paginationBar">
          <span>
            Página {currentPage} de {totalPages} · {number.format(filteredLeads.length)} leads
          </span>
          <div>
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={30}>30 por página</option>
              <option value={50}>50 por página</option>
            </select>
            <button disabled={currentPage === 1} onClick={() => setPage((item) => Math.max(1, item - 1))}>Anterior</button>
            <button disabled={currentPage === totalPages} onClick={() => setPage((item) => Math.min(totalPages, item + 1))}>Próxima</button>
          </div>
        </div>
      </section>

      {selectedLead ? (
        <aside className="leadDrawer" aria-label="Detalhes do lead">
          <div className="drawerPanel">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Detalhes do lead</p>
                <h3>{selectedLead.name}</h3>
              </div>
              <button className="smallButton" onClick={() => setSelectedLead(null)}>Fechar</button>
            </div>
            <div className="drawerFacts">
              <span>Origem <b>{selectedLead.source}</b></span>
              <span>Campanha <b>{selectedLead.campaign}</b></span>
              <span>Qualificado <b>{boolLabel(selectedLead.qualified)}</b></span>
              <span>Agendado <b>{boolLabel(selectedLead.scheduled)}</b></span>
            </div>
            <p className="drawerSummary">{selectedLead.summary}</p>
            <div className="attributeList">
              {selectedLead.attributes.map((attr) => (
                <div key={`${selectedLead.id}-${attr.key}`}>
                  <span>{attr.key}</span>
                  <b>{attr.value}</b>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function DashboardOverview({ initialData }: Props) {
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
    <>
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
    </>
  );
}

export function Dashboard({ initialData }: Props) {
  const [tab, setTab] = useState<"dashboard" | "leads">("dashboard");

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

      <nav className="mainTabs" aria-label="Navegação do dashboard">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button className={tab === "leads" ? "active" : ""} onClick={() => setTab("leads")}>Leads</button>
      </nav>

      {tab === "dashboard" ? <DashboardOverview initialData={initialData} /> : <LeadsView data={initialData} />}
    </main>
  );
}
