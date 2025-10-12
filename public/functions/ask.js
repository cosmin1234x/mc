// functions/ask.js — McCrew AI backend using OpenAI (ESM)
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function handler(event) {
  // Basic validation
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { question, history } = JSON.parse(event.body || "{}");
    if (!question || typeof question !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'question'." }) };
    }

    const system = `You are McCrew AI, a helpful McDonald's crew assistant for the UK.
- Be concise (2–4 sentences).
- Use friendly tone, simple language.
- Prefer UK terms: shift, rota, break, payday (Fri).
- If policy could vary by store, say so and suggest checking with a manager.`;

    // Optional short context memory (last 6 turns)
    const msgs = [{ role: "system", content: system }];
    if (Array.isArray(history)) {
      for (const m of history.slice(-6)) {
        if (!m || !m.role || !m.content) continue;
        msgs.push({ role: m.role, content: String(m.content).slice(0, 2000) });
      }
    }
    msgs.push({ role: "user", content: question });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: msgs,
      max_tokens: 220,
      temperature: 0.4
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn’t think of a good answer.";
    return {
      statusCode: 200,
      body: JSON.stringify({ answer })
    };
  } catch (err) {
    console.error("AI error:", err?.response?.data || err.message || err);
    const safe = (err && err.message) ? err.message : "AI unavailable.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: safe })
    };
  }
}
