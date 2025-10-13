// functions/ask.js — Personalizable McCrew AI (OpenAI via native fetch, zero deps)
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
    const question = (body.question || "").trim();
    const persona = (body.persona || DEFAULT_PERSONA).trim();
    const kb = (body.kb || DEFAULT_KB).trim();
    const context = body.context || {}; // e.g. {store:{name}, payConfig:{frequency,nextPayday}, employeeId}

    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'question' string" }) };
    }

    // Build system prompt with persona, context JSON and knowledge text
    const system = [
      persona,
      "",
      "— Context (JSON, may be partial) —",
      JSON.stringify(context, null, 2),
      "",
      "— Knowledge (use when relevant; if unsure, say it may vary and suggest asking a manager) —",
      kb || "(none)"
    ].join("\n");

    // Few-shot examples to lock tone and style
    const FEW_SHOTS = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hey! How can I help with shifts, pay, or policies today?" },

      { role: "user", content: "when is payday?" },
      { role: "assistant", content: "Most crews are paid on Fridays. Your setting shows next payday as {{nextPayday}}. If your rota differs, check with your manager." },

      { role: "user", content: "what's the uniform policy?" },
      { role: "assistant", content: "Clean full uniform with name badge, black non-slip shoes, hair tied; follow your store’s standards. If you’re prepping food, avoid jewellery and use nets where required." },

      { role: "user", content: "how long is my break" },
      { role: "assistant", content: "Typically ~20 minutes if your shift is over ~4.5–6 hours, but timing depends on rush periods and your manager’s plan." },

      // Action example: the assistant can propose a command
      { role: "user", content: "what's my shift today?" },
      { role: "assistant", content: "I can check that for you. If you’ve set your Employee ID, I can show today’s shift.\nJSON: {\"action\":\"/shift\"}" }
    ];

    const nextPayday = context?.payConfig?.nextPayday || "your next scheduled payday";
    const shots = FEW_SHOTS.map(m => ({
      role: m.role,
      content: (m.content || "").replace("{{nextPayday}}", nextPayday)
    }));

    const messages = [
      { role: "system", content: system },
      ...shots,
      { role: "user", content: question }
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.4,
        max_tokens: 220
      })
    });

    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }

    if (!resp.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `AI upstream ${resp.status}`, detail: data || text }) };
    }

    const answer = data?.choices?.[0]?.message?.content?.trim() || "I couldn’t fetch a reply just now.";
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "AI unavailable", detail: String(e?.message || e) }) };
  }
}

/* ======= Defaults (editable) ======= */
const DEFAULT_PERSONA = `
You are McCrew AI, a friendly, concise assistant for McDonald's crew in the UK.
Tone: warm, helpful, straight to the point (2–4 sentences). Use simple language.
If policies vary by store, say so and suggest checking with a manager.
Never invent legal/HR claims; keep guidance practical and safety-first.
When an in-app command would help, add a final line: JSON: {"action": "/shift"} (no extra words).
`;

const DEFAULT_KB = `
Uniform Policy:
- Clean full uniform, name badge visible.
- Black, non-slip shoes. Hair tied; beard nets where required.
- No smart watches/rings at food prep.

Breaks:
- Typical crew break: ~20 minutes if shift is over ~4.5–6 hours; timing varies with rush periods and manager plan.

Food Safety / Allergens:
- Strict handwashing between tasks; keep raw and ready-to-eat separate.
- Follow labels/hold times; use official allergen charts and confirm with a manager.

Lateness:
- Call ASAP if late. >5 min late may be logged. 3 events can trigger a review.
`;
