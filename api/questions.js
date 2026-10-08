function normalizeSupabaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  // Vercel variables are sometimes pasted with /rest/v1 included.
  return raw.replace(/\/rest\/v1$/i, "").replace(/\/+$/, "");
}
const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase ortam değişkenleri eksik. Vercel'de SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY kontrol edilmeli.");
  }
  if (!/^https:\/\//i.test(SUPABASE_URL) || /supabase\.com\/dashboard/i.test(SUPABASE_URL)) {
    throw new Error("SUPABASE_URL hatalı görünüyor. Vercel'e Supabase Project URL girilmeli (https://....supabase.co); Dashboard URL'si değil.");
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) },
  });
  const raw = await r.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!r.ok) {
    throw new Error(data?.message || data?.hint || data?.details || `Supabase ${r.status}`);
  }
  return data;
}

function adminAllowed(req) {
  const admins = String(process.env.ADMIN_EMAILS || "")
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const email = String(req.headers?.["x-user-email"] || "").trim().toLowerCase();
  return !!email && admins.includes(email);
}

function groupSummary(rows, includeIds) {
  const map = new Map();
  for (const row of rows) {
    const lesson = String(row.lesson || "").trim();
    const group = String(row.question_group || row.topic || "").trim();
    if (!lesson) continue;
    const key = `${lesson}\u0000${group}`;
    if (!map.has(key)) {
      map.set(key, {
        lesson,
        topic: String(row.topic || "").trim(),
        question_group: group,
        count: 0,
        ...(includeIds ? { question_ids: [] } : {}),
        first_created: row.created_at,
        last_created: row.created_at,
      });
    }
    const g = map.get(key);
    g.count++;
    if (includeIds) g.question_ids.push(row.id);
    if (row.created_at < g.first_created) g.first_created = row.created_at;
    if (row.created_at > g.last_created) g.last_created = row.created_at;
  }
  return [...map.values()].sort((a, b) =>
    String(a.first_created).localeCompare(String(b.first_created))
  );
}

export default async function(req, res) {
  try {
    if (req.method === "GET") {
      const q = req.query || {};

      if (q.health === "1") {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          return res.status(500).json({ ok: false, error: "Supabase ortam değişkenleri eksik." });
        }
        const rows = await supabase("questions?select=id&limit=1");
        return res.status(200).json({ ok: true, database: true, sample: Array.isArray(rows) ? rows.length : 0 });
      }

      if (q.summary === "1") {
        const base = [
          "select=id,lesson,topic,question_group,created_at",
          "order=created_at.asc"
        ];
        if (q.lesson) {
          base.push(`lesson=eq.${encodeURIComponent(String(q.lesson).trim())}`);
        }
        const all = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const rows = await supabase(`questions?${base.join("&")}&offset=${offset}&limit=${pageSize}`);
          const page = Array.isArray(rows) ? rows : [];
          all.push(...page);
          if (page.length < pageSize) break;
          if (offset >= 100000) break;
        }
        return res.status(200).json({
          summary: true,
          total: all.length,
          groups: groupSummary(all, q.home !== "1"),
        });
      }

      const params = [
        "select=id,lesson,topic,question_group,question,option_a,option_b,option_c,option_d,option_e,correct,difficulty,explanation,created_at",
        "order=created_at.asc",
        "limit=100000",
      ];
      if (q.lesson) {
        params.push(`lesson=eq.${encodeURIComponent(String(q.lesson).trim())}`);
      }
      if (q.topic) {
        const topic = String(q.topic).trim();
        const topicEncoded = encodeURIComponent(topic);
        const base = params.filter(x => !x.startsWith("order=") && !x.startsWith("limit="));
        const common = base.join("&");
        async function fetchPages(extraFilter) {
          const out = [];
          const pageSize = 1000;
          for (let offset = 0; ; offset += pageSize) {
            const rows = await supabase(`questions?${common}&${extraFilter}&order=created_at.asc&offset=${offset}&limit=${pageSize}`);
            const page = Array.isArray(rows) ? rows : [];
            out.push(...page);
            if (page.length < pageSize) break;
            if (offset >= 100000) break;
          }
          return out;
        }
        const [byGroup, byTopic] = await Promise.all([
          fetchPages(`question_group=eq.${topicEncoded}`),
          fetchPages(`topic=eq.${topicEncoded}`),
        ]);
        const seen = new Set();
        const rows = [...byGroup, ...byTopic]
          .filter(x => {
            if (seen.has(x.id)) return false;
            seen.add(x.id);
            return true;
          })
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

        return res.status(200).json(rows.map(x => ({
          ...x,
          options: [x.option_a, x.option_b, x.option_c, x.option_d, x.option_e],
        })));
      }

      const rows = await supabase(`questions?${params.join("&")}`);
      return res.status(200).json((Array.isArray(rows) ? rows : []).map(x => ({
        ...x,
        options: [x.option_a, x.option_b, x.option_c, x.option_d, x.option_e],
      })));
    }

    if (!adminAllowed(req)) return res.status(403).json({ error: "Yetkisiz" });

    const b = req.body || {};

    if (req.method === "DELETE") {
      if (!b.id) return res.status(400).json({ error: "ID gerekli" });
      await supabase(`questions?id=eq.${encodeURIComponent(b.id)}`, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PUT" || req.method === "POST") {
      if ((req.method === "PUT" && !b.id) || !b.lesson || !b.question ||
          !Array.isArray(b.options) || b.options.length !== 5 || !b.correct) {
        return res.status(400).json({ error: "Eksik alan" });
      }

      const payload = {
        lesson: b.lesson,
        topic: b.topic || "",
        question_group: b.question_group || "",
        question: b.question,
        option_a: b.options[0],
        option_b: b.options[1],
        option_c: b.options[2],
        option_d: b.options[3],
        option_e: b.options[4],
        correct: b.correct,
        difficulty: b.difficulty || "Orta",
        explanation: b.explanation || "",
      };

      if (req.method === "PUT") {
        await supabase(`questions?id=eq.${encodeURIComponent(b.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
        return res.status(200).json({ ok: true });
      }

      const rows = await supabase("questions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      return res.status(201).json(rows?.[0] || {});
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("questions API error:", err);
    return res.status(500).json({ error: err.message || "Soru servisi hatası" });
  }
}