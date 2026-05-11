import { NextResponse } from "next/server";

type MakeMetricBundle = {
  dimensions?: {
    date?: string;
    accountId?: string;
    accountName?: string;
    campaignId?: string;
    campaignName?: string;
    adGroupId?: string;
    adGroupName?: string;
    adId?: string;
    adName?: string;
  };
  metrics?: Record<string, unknown>;
};

type MediaMetricRow = ReturnType<typeof normalizeBundle>;

const headers = (key: string) => ({
  apikey: key,
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  prefer: "resolution=merge-duplicates,return=representation",
});

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: unknown) {
  return Math.round(toNumber(value));
}

function normalizeBundle(bundle: MakeMetricBundle) {
  const dimensions = bundle.dimensions ?? {};
  const metrics = bundle.metrics ?? {};

  return {
    platform: "google_ads",
    account_id: String(dimensions.accountId ?? ""),
    account_name: dimensions.accountName ?? null,
    campaign_id: dimensions.campaignId ? String(dimensions.campaignId) : null,
    campaign_name: dimensions.campaignName ?? null,
    adset_id: dimensions.adGroupId ? String(dimensions.adGroupId) : null,
    adset_name: dimensions.adGroupName ?? null,
    ad_id: dimensions.adId ? String(dimensions.adId) : null,
    ad_name: dimensions.adName ?? null,
    date: dimensions.date,
    spend: toNumber(metrics.cost),
    cost_micros: metrics.costMicros ? toInteger(metrics.costMicros) : null,
    impressions: toInteger(metrics.impressions),
    clicks: toInteger(metrics.clicks),
    engagements: toInteger(metrics.engagements),
    conversions: toNumber(metrics.conversions),
    all_conversions: toNumber(metrics.allConversions),
    conversions_value: toNumber(metrics.conversionsValue),
    phone_calls: toInteger(metrics.phoneCalls),
    search_impression_share: metrics.searchImpressionShare === undefined ? null : toNumber(metrics.searchImpressionShare),
    search_top_impression_share: metrics.searchTopImpressionShare === undefined ? null : toNumber(metrics.searchTopImpressionShare),
    search_absolute_top_impression_share:
      metrics.searchAbsoluteTopImpressionShare === undefined ? null : toNumber(metrics.searchAbsoluteTopImpressionShare),
    raw: bundle,
  };
}

export async function POST(request: Request) {
  const secret = process.env.MEDIA_SYNC_SECRET;
  const sentSecret = request.headers.get("x-media-sync-secret");

  if (!secret || sentSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const body = await request.json();
  const bundles: MakeMetricBundle[] = Array.isArray(body) ? body : Array.isArray(body.bundles) ? body.bundles : [body];
  const rows: MediaMetricRow[] = bundles.map(normalizeBundle).filter((row: MediaMetricRow) => row.account_id && row.date);

  if (!rows.length) {
    return NextResponse.json({ error: "No valid metric rows were received." }, { status: 400 });
  }

  const response = await fetch(
    `${url}/rest/v1/ad_daily_metrics?on_conflict=platform,account_id,date,campaign_id,adset_id,ad_id`,
    {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify(rows),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: `Supabase write failed: ${response.status}`, detail: await response.text() },
      { status: 502 },
    );
  }

  const saved = await response.json();

  return NextResponse.json({
    ok: true,
    received: bundles.length,
    saved: Array.isArray(saved) ? saved.length : rows.length,
  });
}
