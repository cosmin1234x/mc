// functions/ask.js — zero-dep OpenAI call
export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { question } = JSON.parse(event.body || "{}");
    if (!question || typeof question !== "string") {
      return { statusCode: 400, body: "Bad Request: missing 'question' string" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
    }

    const system = "You are McCrew AI, a helpful McDonald's crew assistant for UK stores. Be concise (2–4 sentences), professional, and pragmatic.";
    const user = `Question: ${question}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.4,
        max_tokens: 220
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("OpenAI HTTP", resp.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: "AI upstream error" }) };
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't find an answer.";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer })
    };
  } catch (e) {
    console.error("Function error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "AI unavailable" }) };
  }
}
