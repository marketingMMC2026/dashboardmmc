"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
  "adset",
  "qualified",
  "scheduled",
  "hasOffice",
  "revenueRange",
  "form",
];

const lockedLeadColumns: ColumnKey[] = ["adset"];

const defaultColumnWidths: Record<ColumnKey, number> = {
  createdAt: 126,
  name: 210,
  contact: 190,
  source: 180,
  campaign: 260,
  adset: 320,
  ad: 260,
  form: 210,
  qualified: 112,
  scheduled: 112,
  hasOffice: 132,
  revenueRange: 140,
  scheduleStatus: 180,
  summary: 260,
};

const validColumnKeys = new Set<ColumnKey>(leadColumns.map((column) => column.key));
const leadColumnsStorageKey = "dashboard.leads.columns";
const leadColumnWidthsStorageKey = "dashboard.leads.columnWidths";

type PeriodValue = "7" | "30" | "90" | "custom" | "all";
type DateRange = { start: number | null; end: number | null; label: string };
type AnalysisImage = { name: string; dataUrl: string };

function normalizeVisibleColumns(columns: ColumnKey[]) {
  const next = columns.filter((column) => validColumnKeys.has(column));
  for (const column of lockedLeadColumns) {
    if (!next.includes(column)) {
      const campaignIndex = next.indexOf("campaign");
      next.splice(campaignIndex >= 0 ? campaignIndex + 1 : next.length, 0, column);
    }
  }
  return next.length ? next : defaultLeadColumns;
}

function loadVisibleColumns() {
  if (typeof window === "undefined") return defaultLeadColumns;

  try {
    const stored = window.localStorage.getItem(leadColumnsStorageKey);
    if (!stored) return defaultLeadColumns;
    const parsed = JSON.parse(stored) as ColumnKey[];
    return normalizeVisibleColumns(Array.isArray(parsed) ? parsed : defaultLeadColumns);
  } catch {
    return defaultLeadColumns;
  }
}

function loadColumnWidths() {
  if (typeof window === "undefined") return defaultColumnWidths;

  try {
    const stored = window.localStorage.getItem(leadColumnWidthsStorageKey);
    const parsed = stored ? JSON.parse(stored) as Partial<Record<ColumnKey, number>> : {};
    return {
      ...defaultColumnWidths,
      ...Object.fromEntries(
        Object.entries(parsed).filter(([key, value]) => validColumnKeys.has(key as ColumnKey) && typeof value === "number"),
      ),
    };
  } catch {
    return defaultColumnWidths;
  }
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatFullDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function boolLabel(value: boolean | null) {
  if (value === null) return "-";
  return value ? "Sim" : "Não";
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function metricDelta(current: number, previous: number, suffix = "") {
  const diff = current - previous;
  const signal = diff > 0 ? "+" : "";
  return `${signal}${diff.toFixed(1)}${suffix} vs período anterior`;
}

function metricCountDelta(current: number, previous: number) {
  const diff = current - previous;
  const signal = diff > 0 ? "+" : "";
  return `${signal}${number.format(diff)} vs período anterior`;
}

function buildPeriodRange(period: PeriodValue, customStart: string, customEnd: string): DateRange {
  if (period === "all") return { start: null, end: null, label: "Todo histórico" };

  if (period === "custom") {
    return {
      start: customStart ? new Date(`${customStart}T00:00:00`).getTime() : null,
      end: customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : null,
      label: "Período personalizado",
    };
  }

  const days = Number(period);
  const end = Date.now();
  return {
    start: end - days * 24 * 60 * 60 * 1000,
    end,
    label: `Últimos ${days} dias`,
  };
}

function previousRange(range: DateRange): DateRange {
  if (!range.start || !range.end) return { start: null, end: null, label: "Sem comparação" };
  const duration = range.end - range.start;
  return {
    start: range.start - duration,
    end: range.start - 1,
    label: "Período anterior",
  };
}

function inRange(date: string, range: DateRange) {
  const time = new Date(date).getTime();
  if (range.start && time < range.start) return false;
  if (range.end && time > range.end) return false;
  return true;
}

function summarizeLeads(leads: LeadRow[]) {
  const hot = leads.filter((lead) => lead.quality === "hot").length;
  const qualified = leads.filter((lead) => lead.qualified).length;
  const scheduled = leads.filter((lead) => lead.scheduled).length;
  const withOffice = leads.filter((lead) => lead.hasOffice === true).length;

  return {
    total: leads.length,
    hot,
    qualified,
    scheduled,
    withOffice,
    hotRate: pct(hot, leads.length),
    qualificationRate: pct(qualified, leads.length),
    scheduledRate: pct(scheduled, leads.length),
    officeRate: pct(withOffice, leads.length),
  };
}

function buildTrendRows(leads: LeadRow[]) {
  const rows = new Map<string, { date: string; leads: number; qualified: number }>();
  for (const lead of leads) {
    const date = new Date(lead.createdAt).toISOString().slice(0, 10);
    const row = rows.get(date) ?? { date, leads: 0, qualified: 0 };
    row.leads += 1;
    row.qualified += lead.qualified ? 1 : 0;
    rows.set(date, row);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-45);
}

function buildRankingRows(leads: LeadRow[], level: CampaignRow["level"]): CampaignRow[] {
  const groups = new Map<string, { ids: Set<string>; source: string; lastLeadAt?: string; qualified: number }>();

  for (const lead of leads) {
    const name =
      level === "source" ? lead.source :
      level === "campaign" ? lead.campaign :
      level === "adset" ? lead.adset :
      lead.ad;

    if (!name || name === "-") continue;

    const key = `${level}:${name}`;
    const group = groups.get(key) ?? { ids: new Set<string>(), source: lead.source, qualified: 0 };
    if (!group.ids.has(lead.id) && lead.qualified) group.qualified += 1;
    group.ids.add(lead.id);
    group.lastLeadAt = !group.lastLeadAt || lead.createdAt > group.lastLeadAt ? lead.createdAt : group.lastLeadAt;
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      id: key,
      name: key.slice(key.indexOf(":") + 1),
      level,
      source: group.source,
      leads: group.ids.size,
      qualified: group.qualified,
      qualificationRate: pct(group.qualified, group.ids.size),
      lastLeadAt: group.lastLeadAt,
    }))
    .sort((a, b) => b.qualified - a.qualified || b.qualificationRate - a.qualificationRate || b.leads - a.leads)
    .slice(0, 30);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadLeadsCsv(leads: LeadRow[]) {
  const baseColumns: { key: string; label: string; value: (lead: LeadRow) => unknown }[] = [
    { key: "id", label: "id", value: (lead) => lead.id },
    { key: "createdAt", label: "data_cadastro", value: (lead) => formatFullDateTime(lead.createdAt) },
    { key: "name", label: "nome", value: (lead) => lead.name },
    { key: "phone", label: "telefone", value: (lead) => lead.phone },
    { key: "email", label: "email", value: (lead) => lead.email },
    { key: "source", label: "origem", value: (lead) => lead.source },
    { key: "campaign", label: "campanha", value: (lead) => lead.campaign },
    { key: "adset", label: "conjunto", value: (lead) => lead.adset },
    { key: "ad", label: "anuncio", value: (lead) => lead.ad },
    { key: "form", label: "formulario", value: (lead) => lead.form },
    { key: "qualified", label: "qualificado", value: (lead) => boolLabel(lead.qualified) },
    { key: "scheduled", label: "agendado", value: (lead) => boolLabel(lead.scheduled) },
    { key: "hasOffice", label: "tem_escritorio", value: (lead) => boolLabel(lead.hasOffice) },
    { key: "revenueRange", label: "faturamento", value: (lead) => lead.revenueRange },
    { key: "scheduleStatus", label: "status_agendamento", value: (lead) => lead.scheduleStatus },
    { key: "quality", label: "qualidade", value: (lead) => lead.quality },
    { key: "summary", label: "resumo_ia", value: (lead) => lead.summary },
  ];
  const attributeKeys = [...new Set(leads.flatMap((lead) => lead.attributes.map((attr) => attr.key)))].sort();
  const header = [...baseColumns.map((column) => column.label), ...attributeKeys.map((key) => `atributo_${key}`)];
  const rows = leads.map((lead) => {
    const attrs = new Map(lead.attributes.map((attr) => [attr.key, attr.value]));
    return [
      ...baseColumns.map((column) => column.value(lead)),
      ...attributeKeys.map((key) => attrs.get(key) ?? ""),
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function imageToDataUrl(file: File): Promise<AnalysisImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Não foi possível processar a imagem."));
      image.onload = () => {
        const maxSize = 1400;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          name: file.name,
          dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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
  if (column === "createdAt") return <span>{formatFullDateTime(lead.createdAt)}</span>;

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
  const [period, setPeriod] = useState<PeriodValue>("30");
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
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadVisibleColumns);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(loadColumnWidths);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const uniqueSources = useMemo(() => [...new Set(data.leads.map((lead) => lead.source).filter(Boolean))].sort(), [data.leads]);
  const uniqueCampaigns = useMemo(() => [...new Set(data.leads.map((lead) => lead.campaign).filter((item) => item && item !== "-"))].sort(), [data.leads]);
  const uniqueAdsets = useMemo(() => [...new Set(data.leads.map((lead) => lead.adset).filter((item) => item && item !== "-"))].sort(), [data.leads]);
  const uniqueAds = useMemo(() => [...new Set(data.leads.map((lead) => lead.ad).filter((item) => item && item !== "-"))].sort(), [data.leads]);
  const uniqueRevenue = useMemo(() => [...new Set(data.leads.map((lead) => lead.revenueRange).filter((item) => item && item !== "-"))].sort(), [data.leads]);

  const currentRange = useMemo(() => buildPeriodRange(period, customStart, customEnd), [customEnd, customStart, period]);
  const lastRange = useMemo(() => previousRange(currentRange), [currentRange]);

  const applyLeadFilters = (lead: LeadRow, range: DateRange) => {
    const query = search.trim().toLowerCase();
    const text = `${lead.name} ${lead.phone} ${lead.email} ${lead.source} ${lead.campaign} ${lead.adset} ${lead.ad} ${lead.form} ${lead.summary}`.toLowerCase();

    if (!inRange(lead.createdAt, range)) return false;
    if (leadView !== "all" && lead.quality !== leadView) return false;
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
  };

  const filteredLeads = useMemo(
    () => data.leads.filter((lead) => applyLeadFilters(lead, currentRange)),
    [ads, adsets, campaigns, currentRange, data.leads, hasOffice, leadView, qualified, revenues, scheduled, search, source],
  );
  const previousLeads = useMemo(
    () => data.leads.filter((lead) => applyLeadFilters(lead, lastRange)),
    [ads, adsets, campaigns, data.leads, hasOffice, lastRange, leadView, qualified, revenues, scheduled, search, source],
  );

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const summary = summarizeLeads(filteredLeads);
  const previousSummary = summarizeLeads(previousLeads);
  const tableWidth = visibleColumns.reduce((total, column) => total + (columnWidths[column] ?? defaultColumnWidths[column]), 92);

  useEffect(() => {
    window.localStorage.setItem(leadColumnsStorageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    window.localStorage.setItem(leadColumnWidthsStorageKey, JSON.stringify(columnWidths));
  }, [columnWidths]);

  function toggleColumn(column: ColumnKey) {
    if (lockedLeadColumns.includes(column)) return;
    setVisibleColumns((current) => {
      if (current.includes(column)) return current.filter((item) => item !== column);
      return normalizeVisibleColumns([...current, column]);
    });
  }

  function startColumnResize(column: ColumnKey, event: ReactMouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[column] ?? defaultColumnWidths[column];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(520, Math.max(86, startWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({ ...current, [column]: nextWidth }));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <section className="leadsLayout">
      <div className="leadSummaryGrid">
        <MetricCard label="Leads filtrados" value={number.format(summary.total)} detail={metricCountDelta(summary.total, previousSummary.total)} />
        <MetricCard label="Leads quentes" value={number.format(summary.hot)} detail={`${summary.hotRate.toFixed(1)}% · ${metricDelta(summary.hotRate, previousSummary.hotRate, " p.p.")}`} tone="warn" />
        <MetricCard label="Qualificados" value={number.format(summary.qualified)} detail={`${summary.qualificationRate.toFixed(1)}% · ${metricDelta(summary.qualificationRate, previousSummary.qualificationRate, " p.p.")}`} tone="good" />
        <MetricCard label="Agendados" value={number.format(summary.scheduled)} detail={`${summary.scheduledRate.toFixed(1)}% · ${metricDelta(summary.scheduledRate, previousSummary.scheduledRate, " p.p.")}`} />
      </div>

      <section className="comparisonPanel">
        <div>
          <span>Atual</span>
          <b>{number.format(summary.total)} leads</b>
          <small>{summary.qualificationRate.toFixed(1)}% qualificados · {summary.scheduledRate.toFixed(1)}% agendados</small>
        </div>
        <div>
          <span>Período anterior</span>
          <b>{number.format(previousSummary.total)} leads</b>
          <small>{previousSummary.qualificationRate.toFixed(1)}% qualificados · {previousSummary.scheduledRate.toFixed(1)}% agendados</small>
        </div>
      </section>

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
          <select value={period} onChange={(event) => { setPeriod(event.target.value as PeriodValue); setPage(1); }}>
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
            <option value="null">Sem informação</option>
          </select>
          <select value={scheduled} onChange={(event) => { setScheduled(event.target.value); setPage(1); }}>
            <option value="all">Agendamento</option>
            <option value="true">Agendados</option>
            <option value="false">Não agendados</option>
            <option value="null">Sem informação</option>
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
                  disabled={lockedLeadColumns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                />
                {column.label}
              </label>
            ))}
          </div>
        </details>

        <div className="exportBar">
          <span>Exporta os leads filtrados com todos os campos de cadastro e atributos disponíveis.</span>
          <button className="smallButton" onClick={() => downloadLeadsCsv(filteredLeads)} disabled={!filteredLeads.length}>
            Exportar CSV
          </button>
        </div>

        <div className="tableWrap">
          <table className="leadsTable resizableTable" style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
            <colgroup>
              {visibleColumns.map((column) => (
                <col key={column} style={{ width: `${columnWidths[column] ?? defaultColumnWidths[column]}px` }} />
              ))}
              <col style={{ width: "92px" }} />
            </colgroup>
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column} className={lockedLeadColumns.includes(column) ? "lockedColumn" : ""}>
                    <span className="thLabel">{leadColumns.find((item) => item.key === column)?.label}</span>
                    <span
                      className="resizeHandle"
                      role="separator"
                      aria-label={`Ajustar largura de ${leadColumns.find((item) => item.key === column)?.label}`}
                      onMouseDown={(event) => startColumnResize(column, event)}
                    />
                  </th>
                ))}
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
  const [view, setView] = useState<CampaignRow["level"]>("campaign");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodValue>("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [analysisMode, setAnalysisMode] = useState("scale");
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analysisImages, setAnalysisImages] = useState<AnalysisImage[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "error">("idle");

  const currentRange = useMemo(() => buildPeriodRange(period, customStart, customEnd), [customEnd, customStart, period]);
  const lastRange = useMemo(() => previousRange(currentRange), [currentRange]);
  const currentLeads = useMemo(() => initialData.leads.filter((lead) => inRange(lead.createdAt, currentRange)), [currentRange, initialData.leads]);
  const previousLeads = useMemo(() => initialData.leads.filter((lead) => inRange(lead.createdAt, lastRange)), [initialData.leads, lastRange]);
  const summary = summarizeLeads(currentLeads);
  const previousSummary = summarizeLeads(previousLeads);
  const trendRows = buildTrendRows(currentLeads);
  const rows = buildRankingRows(currentLeads, view);
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => `${row.name} ${row.source} ${row.level}`.toLowerCase().includes(search));
  }, [query, rows]);

  const topRow = [...buildRankingRows(currentLeads, "campaign"), ...buildRankingRows(currentLeads, "adset"), ...buildRankingRows(currentLeads, "ad")]
    .filter((row) => row.leads >= 2)
    .sort((a, b) => b.qualificationRate - a.qualificationRate || b.qualified - a.qualified)[0];

  const funnel = [
    { label: "Leads captados", value: summary.total },
    { label: "Leads quentes", value: summary.hot },
    { label: "Qualificados", value: summary.qualified },
    { label: "Agendados", value: summary.scheduled },
  ];
  const levelLabel = view === "campaign" ? "Campanhas" : view === "adset" ? "Conjuntos" : view === "ad" ? "Anúncios" : "Fontes";
  const volumeWinner = [...rows].sort((a, b) => b.leads - a.leads)[0];
  const qualityWinner = rows.filter((row) => row.leads >= 2).sort((a, b) => b.qualificationRate - a.qualificationRate)[0];
  const attentionRow = [...rows]
    .filter((row) => row.leads >= 5)
    .sort((a, b) => a.qualificationRate - b.qualificationRate || b.leads - a.leads)[0];

  async function runAiAnalysis() {
    setAnalysisStatus("loading");
    setAnalysis("");

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: analysisMode,
          customPrompt: analysisPrompt,
          period: currentRange.label,
          summary,
          previousSummary,
          ranking: rows.slice(0, 12),
          trend: trendRows.slice(-14),
          images: analysisImages,
          decision: {
            volumeWinner,
            qualityWinner,
            attentionRow,
          },
        }),
      });
      const payload = (await response.json()) as { analysis?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível gerar a análise.");
      setAnalysis(payload.analysis || "");
      setAnalysisStatus("idle");
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysis(error instanceof Error ? error.message : "Não foi possível gerar a análise.");
    }
  }

  async function addAnalysisImages(files: FileList | null) {
    if (!files?.length) return;
    setAnalysisStatus("idle");
    try {
      const nextImages = await Promise.all([...files].slice(0, 3).map((file) => imageToDataUrl(file)));
      setAnalysisImages((current) => [...current, ...nextImages].slice(0, 3));
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysis(error instanceof Error ? error.message : "Não foi possível anexar a imagem.");
    }
  }

  return (
    <>
      <section className="panel filterPanel">
        <div>
          <p className="eyebrow">Período de análise</p>
          <h3>{currentRange.label}</h3>
        </div>
        <div className="filtersInline">
          <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodValue)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Personalizado</option>
            <option value="all">Todo histórico</option>
          </select>
          {period === "custom" ? (
            <>
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </>
          ) : null}
        </div>
      </section>

      <section className="metricsGrid">
        <MetricCard label="Leads" value={number.format(summary.total)} detail={metricCountDelta(summary.total, previousSummary.total)} />
        <MetricCard label="Leads quentes" value={number.format(summary.hot)} detail={`${summary.hotRate.toFixed(1)}% · ${metricDelta(summary.hotRate, previousSummary.hotRate, " p.p.")}`} tone="warn" />
        <MetricCard
          label="Qualificados"
          value={number.format(summary.qualified)}
          detail={`${summary.qualificationRate.toFixed(1)}% · ${metricDelta(summary.qualificationRate, previousSummary.qualificationRate, " p.p.")}`}
          tone="good"
        />
        <MetricCard
          label="Agendados"
          value={number.format(summary.scheduled)}
          detail={`${summary.scheduledRate.toFixed(1)}% · ${metricDelta(summary.scheduledRate, previousSummary.scheduledRate, " p.p.")}`}
        />
        <MetricCard
          label="Melhor taxa do recorte"
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
          <MiniTrend data={trendRows.length ? trendRows : [{ date: new Date().toISOString(), leads: 0, qualified: 0 }]} />
          <div className="trendBars">
            {trendRows.slice(-12).map((item) => (
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
            {funnel.map((step, index) => (
              <div key={step.label} className="funnelStep">
                <span>{step.label}</span>
                <strong>{number.format(step.value)}</strong>
                <small>{pct(step.value, summary.total).toFixed(1)}% dos leads</small>
                <Bar value={step.value} max={summary.total} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="decisionGrid">
        <div className="decisionCard">
          <span>Maior volume</span>
          <b>{volumeWinner?.name ?? "Sem dados"}</b>
          <small>{volumeWinner ? `${number.format(volumeWinner.leads)} leads no recorte` : "Aguardando período com leads"}</small>
        </div>
        <div className="decisionCard">
          <span>Melhor qualidade</span>
          <b>{qualityWinner?.name ?? "Sem dados"}</b>
          <small>{qualityWinner ? `${qualityWinner.qualificationRate.toFixed(1)}% de qualificação` : "Precisa de pelo menos 2 leads"}</small>
        </div>
        <div className="decisionCard">
          <span>Ponto de atenção</span>
          <b>{attentionRow?.name ?? "Sem dados"}</b>
          <small>{attentionRow ? `${attentionRow.qualificationRate.toFixed(1)}% com ${number.format(attentionRow.leads)} leads` : "Nenhum item com volume mínimo"}</small>
        </div>
      </section>

      <section className="panel aiPanel">
        <div className="panelHead tools">
          <div>
            <p className="eyebrow">Análise por IA</p>
            <h3>Leitura estratégica do período</h3>
          </div>
          <button className="smallButton" onClick={runAiAnalysis} disabled={analysisStatus === "loading" || !summary.total}>
            {analysisStatus === "loading" ? "Analisando..." : "Gerar análise"}
          </button>
        </div>
        <div className="aiControls">
          <select value={analysisMode} onChange={(event) => setAnalysisMode(event.target.value)}>
            <option value="scale">Onde aumentar verba</option>
            <option value="diagnosis">Diagnóstico de queda ou gargalo</option>
            <option value="creative">Campanha, conjunto e anúncio</option>
          </select>
          <textarea
            value={analysisPrompt}
            onChange={(event) => setAnalysisPrompt(event.target.value)}
            placeholder="Pergunte algo específico para a IA analisar neste período"
          />
        </div>
        <div className="imageUpload">
          <label>
            Anexar imagem
            <input type="file" accept="image/*" multiple onChange={(event) => addAnalysisImages(event.target.files)} />
          </label>
          {analysisImages.length ? (
            <div className="imagePreviewList">
              {analysisImages.map((image) => (
                <span key={image.name}>
                  {image.name}
                  <button type="button" onClick={() => setAnalysisImages((current) => current.filter((item) => item !== image))}>
                    Remover
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <small>Use até 3 imagens, como print de campanha, criativo ou relatório.</small>
          )}
        </div>
        <div className={`aiResult ${analysisStatus === "error" ? "error" : ""}`}>
          {analysis || "A análise vai considerar o período selecionado, o funil, o comparativo anterior e o ranking atual."}
        </div>
      </section>

      <section className="panel tablePanel">
        <div className="panelHead tools">
          <div>
            <p className="eyebrow">Ranking operacional</p>
            <h3>{levelLabel}</h3>
          </div>
          <div className="controls">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar" />
            <div className="segmented">
              <button className={view === "campaign" ? "active" : ""} onClick={() => setView("campaign")}>
                Campanhas
              </button>
              <button className={view === "adset" ? "active" : ""} onClick={() => setView("adset")}>
                Conjuntos
              </button>
              <button className={view === "ad" ? "active" : ""} onClick={() => setView("ad")}>
                Anúncios
              </button>
              <button className={view === "source" ? "active" : ""} onClick={() => setView("source")}>
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
