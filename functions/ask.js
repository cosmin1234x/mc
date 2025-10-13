// functions/ask.js — OpenAI via native fetch + robust errors + debug echo
export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY env var");
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured: no OPENAI_API_KEY" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const question = (body.question || "").trim();

    if (!question) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'question' string" }) };
    }

    // Quick debug mode: send {"question":"...", "debug":true} to see raw shape
    const debug = !!body.debug;

    // Compose prompt
    const system = "You are McCrew AI, a helpful McDonald's crew assistant for UK stores. Be concise (2–4 sentences), friendly, and practical.";
    const messages = [
      { role: "system", content: system },
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

    const text = await resp.text(); // read raw for better logging
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!resp.ok) {
      console.error("OpenAI error", resp.status, text);
      return { statusCode: 502, body: JSON.stringify({ error: `AI upstream ${resp.status}`, detail: data || text }) };
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      console.error("No answer in OpenAI response", data);
      return { statusCode: 200, body: JSON.stringify({ answer: "I couldn’t fetch a reply just now. Please ask again." }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(debug ? { answer, raw: data } : { answer })
    };
  } catch (e) {
    console.error("Function error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "AI unavailable", detail: String(e && e.message || e) }) };
  }
}
