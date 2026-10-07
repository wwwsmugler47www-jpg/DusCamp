const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase ortam değişkenleri eksik.");
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await r.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!r.ok) {
    const message =
      data?.message ||
      data?.hint ||
      data?.details ||
      `Supabase ${r.status}`;

    throw new Error(message);
  }

  return data;
}

function adminAllowed(req) {
  const admins = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  const email = String(
    req.headers?.["x-user-email"] || ""
  ).trim().toLowerCase();

  return !!email && admins.includes(email);
}

function groupSummary(rows, includeIds) {
  const map = new Map();

  for (const row of rows) {
    const key =
      `${row.lesson}\u0000${row.question_group || row.topic || ""}`;

    if (!map.has(key)) {
      map.set(key, {
        lesson: row.lesson,
        topic: row.topic || "",
        question_group: row.question_group || "",
        count: 0,
        ...(includeIds ? { question_ids: [] } : {}),
        first_created: row.created_at,
        last_created: row.created_at,
      });
    }

    const g = map.get(key);

    g.count++;

    if (includeIds) {
      g.question_ids.push(row.id);
    }

    if (row.created_at < g.first_created) {
      g.first_created = row.created_at;
    }

    if (row.created_at > g.last_created) {
      g.last_created = row.created_at;
    }
  }

  return [...map.values()].sort((a, b) =>
    String(a.first_created).localeCompare(
      String(b.first_created)
    )
  );
}

export default async function(req, res) {
  try {

    /* =========================
       GET
       ========================= */

    if (req.method === "GET") {
      const q = req.query || {};

      /* ---------- SUMMARY ---------- */

      if (q.summary === "1") {

        const lessonFilter = q.lesson
          ? `&lesson=eq.${encodeURIComponent(q.lesson)}`
          : "";

        const rows = await supabase(
          `questions?select=id,lesson,topic,question_group,created_at&order=created_at.asc${lessonFilter}`
        );

        return res.status(200).json({
          summary: true,
          groups: groupSummary(
            Array.isArray(rows) ? rows : [],
            q.home !== "1"
          ),
        });
      }

      /* ---------- QUESTIONS ---------- */

      const params = [
        "select=id,lesson,topic,question_group,question,option_a,option_b,option_c,option_d,option_e,correct,difficulty,explanation,created_at",
        "order=created_at.asc",
      ];

      if (q.lesson) {
        params.push(
          `lesson=eq.${encodeURIComponent(q.lesson)}`
        );
      }

      const rows = await supabase(
        `questions?${params.join("&")}`
      );

      const filtered = q.topic
        ? rows.filter(
            x =>
              (x.question_group || "") === q.topic ||
              (x.topic || "") === q.topic
          )
        : rows;

      return res.status(200).json(
        filtered.map(x => ({
          ...x,
          options: [
            x.option_a,
            x.option_b,
            x.option_c,
            x.option_d,
            x.option_e,
          ],
        }))
      );
    }

    /* =========================
       ADMIN CHECK
       ========================= */

    if (!adminAllowed(req)) {
      return res.status(403).json({
        error: "Yetkisiz",
      });
    }

    const b = req.body || {};

    /* =========================
       DELETE
       ========================= */

    if (req.method === "DELETE") {

      if (!b.id) {
        return res.status(400).json({
          error: "ID gerekli",
        });
      }

      await supabase(
        `questions?id=eq.${encodeURIComponent(b.id)}`,
        {
          method: "DELETE",
        }
      );

      return res.status(200).json({
        ok: true,
      });
    }

    /* =========================
       UPDATE
       ========================= */

    if (req.method === "PUT") {

      if (
        !b.id ||
        !b.lesson ||
        !b.question ||
        !Array.isArray(b.options) ||
        b.options.length !== 5 ||
        !b.correct
      ) {
        return res.status(400).json({
          error: "Eksik alan",
        });
      }

      await supabase(
        `questions?id=eq.${encodeURIComponent(b.id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
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
          }),
        }
      );

      return res.status(200).json({
        ok: true,
      });
    }

    /* =========================
       INSERT
       ========================= */

    if (req.method === "POST") {

      if (
        !b.lesson ||
        !b.question ||
        !Array.isArray(b.options) ||
        b.options.length !== 5 ||
        !b.correct
      ) {
        return res.status(400).json({
          error: "Eksik alan",
        });
      }

      const rows = await supabase(
        "questions",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
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
          }),
        }
      );

      return res.status(201).json(
        rows?.[0] || {}
      );
    }

    return res.status(405).json({
      error: "Method not allowed",
    });

  } catch (err) {

    console.error(
      "questions API error:",
      err
    );

    return res.status(500).json({
      error:
        err.message ||
        "Soru servisi hatası",
    });
  }
}
