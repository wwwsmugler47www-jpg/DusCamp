const SOURCE_URL = "https://dentatest.hatchable.site/api/export-questions";
const MIGRATION_TOKEN = "DTX-2026-11024-TRANSFER-8f4c2a91";

function normalizeSupabaseUrl(value) {
  const raw = String(value || "").trim().replace(/\\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.origin : "";
  } catch (_) {
    return "";
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase ortam değişkenleri eksik.");
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const raw = await r.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
  if (!r.ok) {
    const err = new Error(data?.message || data?.details || data?.hint || ("Supabase " + r.status));
    err.code = data?.code || null; err.details = data?.details || null; err.hint = data?.hint || null; err.status = r.status; err.raw = raw;
    throw err;
  }
  return data;
}

export default async function(req, res) {
  try {
    const offset = Math.max(0, Number.parseInt(req.body?.offset ?? req.query?.offset ?? "0", 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.body?.limit ?? req.query?.limit ?? "50", 10) || 50));

    const source = await fetch(SOURCE_URL + "?token=" + encodeURIComponent(MIGRATION_TOKEN) + "&offset=" + offset + "&limit=" + limit);
    const sourceText = await source.text();
    let sourceData;
    try { sourceData = JSON.parse(sourceText); } catch (_) { sourceData = null; }
    if (!source.ok || !sourceData?.rows) {
      throw new Error("Hatchable soru aktarım kaynağı cevap vermedi.");
    }

    const sourceRows = Array.isArray(sourceData.rows)
      ? sourceData.rows
      : (Array.isArray(sourceData.rows?.rows) ? sourceData.rows.rows : []);

    const rows = sourceRows.map((r) => ({
      id: r.id,
      lesson: r.lesson,
      topic: r.topic || "",
      question_group: r.question_group || "",
      question: r.question,
      option_a: r.option_a,
      option_b: r.option_b,
      option_c: r.option_c,
      option_d: r.option_d,
      option_e: r.option_e,
      correct: r.correct,
      difficulty: r.difficulty || "Orta",
      explanation: r.explanation || "",
      created_at: r.created_at || new Date().toISOString(),
    }));

    if (rows.length) {
      // Keep each Vercel invocation short: one source page and one Supabase write.
      // The admin page persists next_offset and calls this endpoint repeatedly.
      try {
        await supabase("questions", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(rows),
        });
      } catch (e) {
        const extra = [e?.code && ("code="+e.code), e?.details && ("details="+e.details), e?.hint && ("hint="+e.hint)].filter(Boolean).join(" | ");
        throw new Error("Supabase kayıt hatası (sorular " + (offset + 1) + "-" + (offset + rows.length) + "): " + (e.message || e) + (extra ? " | " + extra : ""));
      }
    }

    return res.status(200).json({
      ok: true,
      offset,
      imported: rows.length,
      done: !!sourceData.done,
      next_offset: offset + rows.length,
    });
  } catch (err) {
    console.error("migration error:", err);
    return res.status(500).json({ error: err.message || "Migration failed" });
  }
}
