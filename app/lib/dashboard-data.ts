export type CampaignRow = {
  id: string;
  name: string;
  level: "campaign" | "adset" | "ad" | "source";
  source: string;
  leads: number;
  qualified: number;
  qualificationRate: number;
  dailyBudget?: number;
  lastLeadAt?: string;
};

export type TrendRow = {
  date: string;
  leads: number;
  qualified: number;
};

export type FunnelStep = {
  label: string;
  value: number;
};

export type LeadRow = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  campaign: string;
  adset: string;
  ad: string;
  form: string;
  qualified: boolean;
  scheduled: boolean;
  hasOffice: boolean | null;
  revenueRange: string;
  scheduleStatus: string;
  summary: string;
  quality: "hot" | "low" | "regular";
  attributes: { key: string; value: string }[];
};

export type DashboardData = {
  updatedAt: string;
  source: "live" | "sample";
  totals: {
    leads: number;
    attributedLeads: number;
    attributes: number;
    qualified: number;
    qualificationRate: number;
    activeCampaigns: number;
    activeAdsets: number;
    activeAds: number;
  };
  funnel: FunnelStep[];
  trends: TrendRow[];
  sources: CampaignRow[];
  campaigns: CampaignRow[];
  leads: LeadRow[];
  insights: string[];
};

const headers = (key: string) => ({
  apikey: key,
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
});

async function readTable<T>(
  table: string,
  select: string,
  limit = 5000,
): Promise<T[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const rows: T[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`,
      {
        headers: {
          ...headers(key),
          "range-unit": "items",
          range: `${offset}-${Math.min(offset + pageSize - 1, limit - 1)}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Supabase read failed for ${table}: ${response.status}`);
    }

    const page = (await response.json()) as T[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

function pct(part: number, total: number) {
  return total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0;
}

function asString(value: unknown, fallback = "Sem nome") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function parseBudget(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount / 100 : undefined;
}

function cleanAttribute(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "empty") return undefined;
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) return undefined;
  return trimmed;
}

function isTruthy(value: unknown) {
  const cleaned = cleanAttribute(value)?.toLowerCase();
  return cleaned === "true" || cleaned === "yes" || cleaned === "sim";
}

function isFalsy(value: unknown) {
  const cleaned = cleanAttribute(value)?.toLowerCase();
  return cleaned === "false" || cleaned === "no" || cleaned === "nao" || cleaned === "não";
}

function normalizeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAttribute(attrs: Map<string, string> | undefined, keys: string[]) {
  if (!attrs) return "";
  for (const key of keys) {
    const value = cleanAttribute(attrs.get(key));
    if (value) return value;
  }
  return "";
}

function normalizeBoolean(attrs: Map<string, string> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = attrs?.get(key);
    if (isTruthy(value)) return true;
    if (isFalsy(value)) return false;
  }
  return null;
}

function isScheduledStatus(status: string) {
  const normalized = status
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized.includes("agendado") || normalized.includes("quer agendar");
}

function meaningful(value: string) {
  return Boolean(value && value !== "-" && value !== "Sem nome" && !value.includes("{{"));
}

function normalizePhoneKey(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits.length >= 8 ? `phone:${digits}` : "";
}

function normalizeEmailKey(email: string) {
  const cleaned = email.trim().toLowerCase();
  return cleaned && cleaned !== "-" && cleaned.includes("@") ? `email:${cleaned}` : "";
}

function leadIdentityKey(lead: LeadRow) {
  return normalizePhoneKey(lead.phone) || normalizeEmailKey(lead.email) || `id:${lead.id}`;
}

function pickRicher(current: string, next: string) {
  if (!meaningful(current)) return next;
  if (!meaningful(next)) return current;
  return next.length > current.length ? next : current;
}

function mergeSource(current: string, next: string) {
  if (!meaningful(current)) return next;
  if (!meaningful(next) || current.toLowerCase() === next.toLowerCase()) return current;
  const parts = current.split(" + ");
  return parts.some((part) => part.toLowerCase() === next.toLowerCase()) ? current : `${current} + ${next}`;
}

function mergeNullableBoolean(current: boolean | null, next: boolean | null) {
  if (current === true || next === true) return true;
  if (current === false || next === false) return false;
  return null;
}

function mergeQuality(current: LeadRow["quality"], next: LeadRow["quality"]) {
  if (current === "hot" || next === "hot") return "hot";
  if (current === "low" && next === "low") return "low";
  return "regular";
}

function mergeAttributes(current: LeadRow["attributes"], next: LeadRow["attributes"]) {
  const merged = new Map(current.map((attr) => [attr.key, attr.value]));
  for (const attr of next) {
    if (!meaningful(merged.get(attr.key) ?? "")) merged.set(attr.key, attr.value);
  }
  return [...merged.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function mergeSummaries(current: string, next: string) {
  if (!meaningful(current)) return next;
  if (!meaningful(next) || current === next) return current;
  return current.includes(next) ? current : `${current} | ${next}`;
}

function mergeLeadRows(current: LeadRow, next: LeadRow): LeadRow {
  const first = next.createdAt < current.createdAt ? next : current;
  const source = first === next ? mergeSource(next.source, current.source) : mergeSource(current.source, next.source);

  return {
    id: first.id,
    createdAt: first.createdAt,
    name: pickRicher(current.name, next.name),
    phone: pickRicher(current.phone, next.phone),
    email: pickRicher(current.email, next.email),
    source,
    campaign: pickRicher(current.campaign, next.campaign),
    adset: pickRicher(current.adset, next.adset),
    ad: pickRicher(current.ad, next.ad),
    form: pickRicher(current.form, next.form),
    qualified: current.qualified || next.qualified,
    scheduled: current.scheduled || next.scheduled,
    hasOffice: mergeNullableBoolean(current.hasOffice, next.hasOffice),
    revenueRange: pickRicher(current.revenueRange, next.revenueRange),
    scheduleStatus: pickRicher(current.scheduleStatus, next.scheduleStatus),
    summary: mergeSummaries(current.summary, next.summary),
    quality: mergeQuality(current.quality, next.quality),
    attributes: mergeAttributes(current.attributes, next.attributes),
  };
}

function dedupeLeadRows(rows: LeadRow[]) {
  const byIdentity = new Map<string, LeadRow>();

  for (const row of rows) {
    const key = leadIdentityKey(row);
    const current = byIdentity.get(key);
    byIdentity.set(key, current ? mergeLeadRows(current, row) : row);
  }

  return [...byIdentity.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildRow(
  id: string,
  name: string,
  level: CampaignRow["level"],
  source: string,
  leadIds: Set<string>,
  qualifiedIds: Set<string>,
  dailyBudget?: number,
  lastLeadAt?: string,
): CampaignRow {
  const leads = leadIds.size;
  const qualified = [...leadIds].filter((leadId) => qualifiedIds.has(leadId)).length;

  return {
    id,
    name,
    level,
    source,
    leads,
    qualified,
    qualificationRate: pct(qualified, leads),
    dailyBudget,
    lastLeadAt,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [leads, sources, integrations, assets, attributes] = await Promise.all([
      readTable<{ id: string; created_at: string; qualification: boolean | null }>(
        "leads",
        "id,created_at,qualification",
      ),
      readTable<{
        lead_id: string | null;
        integration_id: string | null;
        source_type: string | null;
        campaign_asset_id: string | null;
        adset_asset_id: string | null;
        ad_asset_id: string | null;
        external_campaign_id: string | null;
        external_adset_id: string | null;
        external_ad_id: string | null;
        created_at: string;
      }>("lead_sources", "lead_id,integration_id,source_type,campaign_asset_id,adset_asset_id,ad_asset_id,external_campaign_id,external_adset_id,external_ad_id,created_at"),
      readTable<{ id: string; provider: string }>("integrations", "id,provider"),
      readTable<{
        id: string;
        asset_type: "campaign" | "adset" | "ad";
        name: string | null;
        status: string | null;
        metadata: Record<string, unknown> | null;
      }>("marketing_assets", "id,asset_type,name,status,metadata"),
      readTable<{
        lead_id: string | null;
        key: string;
        value: string | null;
        created_at: string;
      }>("lead_attributes", "lead_id,key,value,created_at", 10000),
    ]);

    const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
    const attrsByLead = new Map<string, Map<string, string>>();
    const rowsByAttribute = new Map<string, { ids: Set<string>; last?: string; source: string }>();

    for (const attr of attributes) {
      if (!attr.lead_id || !leadMap.has(attr.lead_id)) continue;
      const cleaned = cleanAttribute(attr.value);
      if (!cleaned) continue;
      const leadAttrs = attrsByLead.get(attr.lead_id) ?? new Map<string, string>();
      leadAttrs.set(attr.key, cleaned);
      attrsByLead.set(attr.lead_id, leadAttrs);

      if (["utm_campaign", "utm_source", "utm_medium", "form_name", "faixa_faturamento", "agendamento_status"].includes(attr.key)) {
        const label = normalizeLabel(cleaned);
        const bucketKey = `${attr.key}:${label}`;
        const bucket = rowsByAttribute.get(bucketKey) ?? {
          ids: new Set<string>(),
          source: attr.key,
        };
        bucket.ids.add(attr.lead_id);
        bucket.last = !bucket.last || attr.created_at > bucket.last ? attr.created_at : bucket.last;
        rowsByAttribute.set(bucketKey, bucket);
      }
    }

    const qualifiedIds = new Set(
      leads
        .filter((lead) => {
          const attrs = attrsByLead.get(lead.id);
          return lead.qualification || isTruthy(attrs?.get("lead_qualificado_"));
        })
        .map((lead) => lead.id),
    );
    const providerById = new Map(integrations.map((item) => [item.id, item.provider]));
    const assetById = new Map(assets.map((asset) => [asset.id, asset]));
    const rowsBySource = new Map<string, { ids: Set<string>; last?: string; provider: string }>();
    const rowsByAsset = new Map<string, { ids: Set<string>; last?: string }>();
    const mediaByLead = new Map<
      string,
      {
        source: string;
        campaign: string;
        adset: string;
        ad: string;
      }
    >();

    for (const source of sources) {
      if (!source.lead_id || !leadMap.has(source.lead_id)) continue;

      const provider = source.integration_id ? providerById.get(source.integration_id) : undefined;
      const label = source.source_type || provider || "Fonte não classificada";
      const sourceBucket = rowsBySource.get(label) ?? {
        ids: new Set<string>(),
        provider: provider || label,
      };
      sourceBucket.ids.add(source.lead_id);
      sourceBucket.last = !sourceBucket.last || source.created_at > sourceBucket.last ? source.created_at : sourceBucket.last;
      rowsBySource.set(label, sourceBucket);

      if (!mediaByLead.has(source.lead_id)) {
        const campaignAsset = source.campaign_asset_id ? assetById.get(source.campaign_asset_id) : undefined;
        const adsetAsset = source.adset_asset_id ? assetById.get(source.adset_asset_id) : undefined;
        const adAsset = source.ad_asset_id ? assetById.get(source.ad_asset_id) : undefined;
        mediaByLead.set(source.lead_id, {
          source: label,
          campaign: asString(campaignAsset?.name, source.external_campaign_id || ""),
          adset: asString(adsetAsset?.name, source.external_adset_id || ""),
          ad: asString(adAsset?.name, source.external_ad_id || ""),
        });
      }

      for (const assetId of [source.campaign_asset_id, source.adset_asset_id, source.ad_asset_id]) {
        if (!assetId) continue;
        const assetBucket = rowsByAsset.get(assetId) ?? { ids: new Set<string>() };
        assetBucket.ids.add(source.lead_id);
        assetBucket.last = !assetBucket.last || source.created_at > assetBucket.last ? source.created_at : assetBucket.last;
        rowsByAsset.set(assetId, assetBucket);
      }
    }

    const campaigns = [...rowsByAsset.entries()]
      .map(([assetId, bucket]) => {
        const asset = assetById.get(assetId);
        return buildRow(
          assetId,
          asString(asset?.name),
          asset?.asset_type ?? "ad",
          "Meta Ads",
          bucket.ids,
          qualifiedIds,
          parseBudget(asset?.metadata?.daily_budget),
          bucket.last,
        );
      })
      .sort((a, b) => b.qualified - a.qualified || b.leads - a.leads)
      .slice(0, 12);

    const sourceRows = [...rowsBySource.entries()]
      .map(([label, bucket]) =>
        buildRow(label, label, "source", bucket.provider, bucket.ids, qualifiedIds, undefined, bucket.last),
      )
      .concat(
        [...rowsByAttribute.entries()].map(([key, bucket]) => {
          const label = key.slice(key.indexOf(":") + 1);
          return buildRow(key, label, "source", bucket.source, bucket.ids, qualifiedIds, undefined, bucket.last);
        }),
      )
      .sort((a, b) => b.qualified - a.qualified || b.leads - a.leads)
      .slice(0, 30);

    const meta = sourceRows.find((row) => row.name === "meta_ads" || row.source === "META");
    const best = [...sourceRows, ...campaigns].sort(
      (a, b) => b.qualificationRate - a.qualificationRate || b.qualified - a.qualified,
    )[0];
    const leadRows: LeadRow[] = leads
      .map((lead) => {
        const attrs = attrsByLead.get(lead.id);
        const media = mediaByLead.get(lead.id);
        const scheduleStatus = firstAttribute(attrs, ["agendamento_status", "data_agendamento"]);
        const scheduled = isScheduledStatus(scheduleStatus);
        const hasOffice = normalizeBoolean(attrs, ["tem_escritorio_", "Tem Escritório"]);
        const qualified = qualifiedIds.has(lead.id);
        const phone = firstAttribute(attrs, ["phone_number", "WhatsApp", "numero_whatsapp", "telefone", "phone"]);
        const email = firstAttribute(attrs, ["email", "E-mail"]);
        const revenueRange = normalizeLabel(
          firstAttribute(attrs, [
            "faixa_faturamento",
            "Faturamento médio mensal",
            "Qual é o seu faturamento médio mensal?",
            "qual_o_faturamento_mensal_de_sua_contabilidade?",
            "qual_faturamento_mensal_de_sua_contabilidade?",
          ]),
        );
        const allAttributes = [...(attrs?.entries() ?? [])]
          .map(([key, value]) => ({ key, value }))
          .sort((a, b) => a.key.localeCompare(b.key));
        const isHot = qualified || scheduled || hasOffice === true || Boolean(revenueRange && !revenueRange.toLowerCase().includes("menos"));
        const missingCoreData = !phone || !email || email.includes("{{");
        const quality: LeadRow["quality"] = isHot ? "hot" : missingCoreData || hasOffice === false ? "low" : "regular";

        return {
          id: lead.id,
          createdAt: lead.created_at,
          name: firstAttribute(attrs, ["full_name", "Nome completo", "Nome", "name"]) || "Sem nome",
          phone: phone || "-",
          email: email || "-",
          source: media?.source || firstAttribute(attrs, ["utm_source"]) || "Sem origem",
          campaign: media?.campaign || firstAttribute(attrs, ["utm_campaign"]) || "-",
          adset: media?.adset || firstAttribute(attrs, ["utm_medium"]) || "-",
          ad: media?.ad || "-",
          form: firstAttribute(attrs, ["form_name"]) || "-",
          qualified,
          scheduled,
          hasOffice,
          revenueRange: revenueRange || "-",
          scheduleStatus: scheduleStatus || "-",
          summary: firstAttribute(attrs, ["summary_ia", "all_data"]) || "-",
          quality,
          attributes: allAttributes,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const uniqueLeadRows = dedupeLeadRows(leadRows);
    const totalLeads = uniqueLeadRows.length;
    const totalQualified = uniqueLeadRows.filter((lead) => lead.qualified).length;
    const uniqueTrendsByDate = new Map<string, TrendRow>();

    for (const lead of uniqueLeadRows) {
      const date = new Date(lead.createdAt).toISOString().slice(0, 10);
      const row = uniqueTrendsByDate.get(date) ?? { date, leads: 0, qualified: 0 };
      row.leads += 1;
      row.qualified += lead.qualified ? 1 : 0;
      uniqueTrendsByDate.set(date, row);
    }

    return {
      updatedAt: new Date().toISOString(),
      source: "live",
      totals: {
        leads: totalLeads,
        attributedLeads: attrsByLead.size,
        attributes: attributes.length,
        qualified: totalQualified,
        qualificationRate: pct(totalQualified, totalLeads),
        activeCampaigns: assets.filter((asset) => asset.asset_type === "campaign" && asset.status === "ACTIVE").length,
        activeAdsets: assets.filter((asset) => asset.asset_type === "adset" && asset.status === "ACTIVE").length,
        activeAds: assets.filter((asset) => asset.asset_type === "ad" && asset.status === "ACTIVE").length,
      },
      funnel: [
        { label: "Leads captados", value: totalLeads },
        { label: "Leads qualificados", value: totalQualified },
        { label: "Taxa de qualificação", value: pct(totalQualified, totalLeads) },
      ],
      trends: [...uniqueTrendsByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-45),
      sources: sourceRows,
      campaigns,
      leads: uniqueLeadRows,
      insights: [
        best ? `${best.name} lidera em taxa de qualificação (${best.qualificationRate}%).` : "Ainda não há volume suficiente para apontar uma vencedora.",
        `${uniqueLeadRows.length} contatos únicos aparecem no dashboard; cadastros repetidos por telefone ou e-mail são consolidados na lista.`,
        meta ? `Meta Ads concentra ${meta.leads} leads; acompanhe a qualidade antes de ampliar verba.` : "Meta Ads ainda não apareceu como fonte principal no recorte atual.",
      ],
    };
  } catch {
    return sampleDashboardData;
  }
}

export const sampleDashboardData: DashboardData = {
  updatedAt: "2026-05-10T22:15:00.000Z",
  source: "sample",
  totals: {
    leads: 1149,
    attributedLeads: 1149,
    attributes: 6000,
    qualified: 37,
    qualificationRate: 3.2,
    activeCampaigns: 1,
    activeAdsets: 5,
    activeAds: 12,
  },
  funnel: [
    { label: "Leads captados", value: 1149 },
    { label: "Leads qualificados", value: 37 },
    { label: "Taxa de qualificação", value: 3.2 },
  ],
  trends: [
    { date: "2026-04-01", leads: 18, qualified: 2 },
    { date: "2026-04-08", leads: 30, qualified: 1 },
    { date: "2026-04-15", leads: 46, qualified: 1 },
    { date: "2026-04-22", leads: 73, qualified: 4 },
    { date: "2026-04-29", leads: 58, qualified: 3 },
    { date: "2026-05-06", leads: 68, qualified: 5 },
    { date: "2026-05-10", leads: 31, qualified: 2 },
  ],
  sources: [
    { id: "meta_ads", name: "Meta Ads", level: "source", source: "META", leads: 886, qualified: 22, qualificationRate: 2.5 },
    { id: "site", name: "Site / formulários", level: "source", source: "MEUSITECONTABIL.COM.BR", leads: 131, qualified: 11, qualificationRate: 8.4 },
    { id: "manychat", name: "Manychat", level: "source", source: "MANYCHAT", leads: 35, qualified: 18, qualificationRate: 51.4 },
  ],
  campaigns: [
    { id: "120213129522200506", name: "[CA][25/11/25]- SITE - [LEAD] [ONGOING]", level: "campaign", source: "Meta Ads", leads: 886, qualified: 22, qualificationRate: 2.5 },
    { id: "120246295582850506", name: "NOVO FORM. [CJ][21/04/26][INSTA][AMPLO LAL]", level: "adset", source: "Meta Ads", leads: 124, qualified: 7, qualificationRate: 5.6, dailyBudget: 10 },
    { id: "120245793385070506", name: "[CJ][12/04/26][INSTA][TESTECRIATIVOS]", level: "adset", source: "Meta Ads", leads: 101, qualified: 4, qualificationRate: 4, dailyBudget: 30 },
  ],
  leads: [
    {
      id: "8d75b675-4616-4e48-945a-e0f5494001fb",
      createdAt: "2026-05-10T20:47:16.325Z",
      name: "Mônica",
      phone: "5591980784796",
      email: "-",
      source: "manychat",
      campaign: "-",
      adset: "-",
      ad: "-",
      form: "-",
      qualified: false,
      scheduled: true,
      hasOffice: true,
      revenueRange: "menos 10K",
      scheduleStatus: "agendado",
      summary: "Status agendamento: Agendado. Tem escritório: Sim.",
      quality: "hot",
      attributes: [
        { key: "agendamento_status", value: "agendado" },
        { key: "faixa_faturamento", value: "menos_10K" },
        { key: "tem_escritorio_", value: "true" },
      ],
    },
    {
      id: "4912dfd9-2fd1-4630-95e4-be11fc481032",
      createdAt: "2026-05-10T18:58:09.496Z",
      name: "Gustavo",
      phone: "5533998542823",
      email: "-",
      source: "manychat",
      campaign: "-",
      adset: "-",
      ad: "-",
      form: "-",
      qualified: false,
      scheduled: true,
      hasOffice: true,
      revenueRange: "30k a 80k",
      scheduleStatus: "agendado",
      summary: "Status agendamento: Agendado. Faixa de Faturamento: 30k a 80k.",
      quality: "hot",
      attributes: [
        { key: "agendamento_status", value: "agendado" },
        { key: "faixa_faturamento", value: "30k_a_80k" },
        { key: "tem_escritorio_", value: "true" },
      ],
    },
  ],
  insights: [
    "Manychat tem a maior taxa de qualificação no retrato inicial, apesar do volume menor.",
    "Meta Ads concentra o volume, mas precisa ser comparado por qualidade antes de ampliar verba.",
    "O próximo passo é cruzar custo real por campanha para decidir aumento de verba com base em CPL qualificado.",
  ],
};
