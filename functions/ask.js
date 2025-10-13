// functions/ask.js — McCrew AI with topic guard (only McDonald's ops + casual chat)
export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured: OPENAI_API_KEY" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const question = String(body.question || "").trim();
    const persona = (body.persona || DEFAULT_PERSONA).trim();
    const kb = (body.kb || DEFAULT_KB).trim();
    const context = body.context || {};

    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'question' string" }) };
    }

    // ---------- TOPIC FILTER ----------
    const q = question.toLowerCase();

    // casual chit-chat we allow
    const isCasual = /\b(hi|hello|hey|yo|how are (you|u)|thanks|thank you|bye|goodbye|see ya|what'?s up|sup)\b/i.test(q);

    // mcdonald’s/store ops keywords we allow
    const mcdKeywords = [
      "mcdonald", "mccrew", "crew", "store", "shift", "rota", "schedule", "week",
      "pay", "payday", "paycheck", "overtime", "break", "uniform", "policy", "rules",
      "allergen", "food safety", "handwash", "fryer", "drive-thru", "drive thru",
      "manager", "training", "quiz", "swap", "swaps", "clock", "timeclock", "hold time",
      "burger", "fries", "station"
    ];
    const isMcdTopic = mcdKeywords.some(k => q.includes(k));

    // coding/tech block
    const isCoding = /\b(html|css|javascript|js|typescript|python|react|node|express|sql|database|api|debug|compile|code|snippet|write.*code|build.*website|script)\b/i.test(q);

    if (isCoding) {
      return okText("I can’t help with coding or developer tasks here. I’m focused on McDonald’s store operations, shifts, pay, training, and policies. Ask me about those or just say hi. 🍟");
    }
    if (!isCasual && !isMcdTopic) {
      return okText("I’m here for McDonald’s crew topics: shifts, rota, pay, breaks, policies, training, food safety, and day-to-day store questions. Try asking about one of those. 😊");
    }
    // ---------- END TOPIC FILTER ----------

    // Build system prompt
    const system = [
      persona,
      "",
      "— Context (JSON, may be partial) —",
      JSON.stringify(context, null, 2),
      "",
      "— Knowledge (use when relevant; if unsure, say it may vary and suggest asking a manager) —",
      kb || "(none)",
      "",
      "Refuse any request that is unrelated to McDonald’s crew work or casual small talk. ",
      "Specifically refuse coding/developer tasks (no HTML/CSS/JS/Python, no code generation, no debugging)."
    ].join("\n");

    // Few-shot to set tone
    const FEW_SHOTS = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hey! How can I help with shifts, pay, or policies today?" },

      { role: "user", content: "when is payday?" },
      { role: "assistant", content: "Most crews are paid on Fridays. Your setting shows next payday as {{nextPayday}}. If your rota differs, check with your manager." },

      { role: "user", content: "what's the uniform policy?" },
      { role: "assistant", content: "Clean full uniform with name badge, black non-slip shoes, hair tied; follow your store’s standards. If you’re prepping food, avoid jewellery and use nets where required." },

      { role: "user", content: "write me html to make a navbar" },
      { role: "assistant", content: "I can’t help with coding here. I’m focused on McDonald’s crew topics like shifts, pay, training, and store policies." }
    ];
    const nextPayday = context?.payConfig?.nextPayday || "your next scheduled payday";
    const shots = FEW_SHOTS.map(m => ({ role: m.role, content: m.content.replace("{{nextPayday}}", nextPayday) }));

    const messages = [
      { role: "system", content: system },
      ...shots,
      { role: "user", content: question }
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.4, max_tokens: 220 })
    });

    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    if (!resp.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `AI upstream ${resp.status}`, detail: data || text }) };
    }

    const answer = data?.choices?.[0]?.message?.content?.trim() || "I couldn’t fetch a reply just now.";
    return okJSON({ answer });
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "AI unavailable", detail: String(e?.message || e) }) };
  }
}

function okText(msg){ return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer: msg }) }; }
function okJSON(obj){ return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }

/* ===== Defaults you can tune ===== */
const DEFAULT_PERSONA = `
You are McCrew AI, a friendly, concise assistant for McDonald's crew in the UK.
Tone: warm, helpful, straight to the point (2–4 sentences). Use simple language.
Refuse anything unrelated to McDonald’s store work or casual greetings.
Never provide or discuss computer code or developer tasks.`;

const DEFAULT_KB = `
Uniform:
- Clean full uniform, name badge visible; black non-slip shoes; hair tied; nets where required.

Breaks:
- Typical crew break ~20 minutes if shift over ~4.5–6 hours (store policy/manager timing may vary).

Food Safety / Allergens:
- Strict handwashing; separate raw/ready-to-eat; follow hold labels; use official allergen charts; ask manager if unsure.

Lateness:
- Call ASAP if late; >5 min may be logged; ~3 events can trigger a review (store policy may vary).`;
