// functions/ask.js — McCrew AI with topic guard + persona/KB/context (OpenAI, zero deps)

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { error: "Server not configured: OPENAI_API_KEY" });
    }

    const body = JSON.parse(event.body || "{}");
    const question = String(body.question || "").trim();
    const persona = (body.persona || DEFAULT_PERSONA).trim();
    const kb = (body.kb || DEFAULT_KB).trim();
    const context = body.context || {};

    if (!question) {
      return json(400, { error: "Missing 'question' string" });
    }

    // ---------- TOPIC FILTER ----------
    const q = question.toLowerCase();

    const isCasual = /\b(hi|hello|hey|yo|how are (you|u)|thanks|thank you|bye|goodbye|see ya|what'?s up|sup)\b/i.test(q);

    // Allow McD operations + menu/product queries
    const mcdKeywords = [
      "mcdonald","mccrew","crew","store","shift","rota","schedule","week",
      "pay","payday","paycheck","overtime","break","uniform","policy","rules",
      "allergen","allergens","food safety","handwash","fryer","drive-thru","drive thru",
      "manager","training","quiz","swap","swaps","clock","timeclock","hold time","station",
      // menu & items
      "menu","item","ingredients","ingredient","nutrition","calorie","calories","price","sauce","bun","patty",
      "cheese","pickle","ketchup","mustard","lettuce","onion","sesame","burger","fries",
      "nugget","nuggets","mcflurry","big mac","mcchicken","filet-o-fish","filet o fish",
      "double cheeseburger","quarter pounder"
    ];
    const isMcdTopic = mcdKeywords.some(k => q.includes(k));

    // Explicitly block coding/developer requests
    const isCoding = /\b(html|css|javascript|js|typescript|python|react|node|express|sql|database|db|api|debug|compile|code|snippet|write.*code|build.*website|script|program)\b/i.test(q);

    if (isCoding) {
      return okText("I can’t help with coding or developer tasks here. I’m focused on McDonald’s store operations, shifts, pay, training, policies, food safety, and menu questions. 🍟");
    }
    if (!isCasual && !isMcdTopic) {
      return okText("I’m here for McDonald’s crew topics: shifts, rota, pay, breaks, policies, training, food safety, and menu questions. Try asking about one of those. 😊");
    }
    // ---------- END TOPIC FILTER ----------

    // Prompt: persona + context JSON + KB + guard
    const system = [
      persona,
      "",
      "— Context (JSON, may be partial) —",
      JSON.stringify(context, null, 2),
      "",
      "— Knowledge (use when relevant; if unsure, say it may vary and suggest asking a manager) —",
      kb || "(none)",
      "",
      "Strictly refuse any request unrelated to McDonald’s store work, menu, or casual small talk.",
      "Specifically refuse coding/developer tasks (no code generation, debugging, or programming help)."
    ].join("\n");

    // Few-shot examples to set tone/behavior
    const FEW_SHOTS = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hey! How can I help with shifts, pay, policies, or menu questions today?" },

      { role: "user", content: "when is payday?" },
      { role: "assistant", content: "Most crews are paid on Fridays. Your setting shows next payday as {{nextPayday}}. If your rota differs, check with your manager." },

      { role: "user", content: "what's the uniform policy?" },
      { role: "assistant", content: "Clean full uniform with name badge, black non-slip shoes, hair tied; follow your store’s standards. If you’re prepping food, avoid jewellery and use nets where required." },

      { role: "user", content: "what is a big mac" },
      { role: "assistant", content: "A Big Mac has two beef patties on a three-part sesame bun with Big Mac sauce, shredded lettuce, cheese, pickles, and onions. Ingredients and nutrition can vary by country—check your local allergen chart if you need specifics." },

      { role: "user", content: "write me html to make a navbar" },
      { role: "assistant", content: "I can’t help with coding here. I’m focused on McDonald’s crew topics like shifts, pay, training, store policies, and menu questions." }
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
      console.error("OpenAI error", resp.status, text);
      return json(502, { error: `AI upstream ${resp.status}`, detail: data || text });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim() || "I couldn’t fetch a reply just now.";
    return okJSON({ answer });
  } catch (e) {
    console.error("Function error", e);
    return json(500, { error: "AI unavailable", detail: String(e?.message || e) });
  }
}

/* ---------- Helpers ---------- */
function json(status, obj){ return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function okJSON(obj){ return json(200, obj); }
function okText(answer){ return okJSON({ answer }); }

/* ---------- Defaults you can tweak ---------- */
const DEFAULT_PERSONA = `
You are McCrew AI, a friendly, concise assistant for McDonald's crew in the UK.
Tone: warm, helpful, straight to the point (2–4 sentences). Use simple language.
Answer questions about store operations (shifts, pay, breaks, policies, training, food safety) and menu items.
If policies or ingredients vary by store/country, say so and suggest checking with a manager or official allergen chart.
You can answer casual talks like greetings or thanks.
If someone ask who created you, say "I was created by Cosmin to assist crew members with their questions."
Refuse anything unrelated to McDonald’s work/menu or any coding/developer request.`;


const DEFAULT_KB = `
Uniform:
- Clean full uniform, name badge visible; black non-slip shoes; hair tied; nets where required.
Breaks:
- Typical crew break ~20 minutes if shift over ~4.5–6 hours (store policy/manager timing may vary).
Food Safety / Allergens:
- Strict handwashing; separate raw/ready-to-eat; follow hold labels; use official allergen charts; ask manager if unsure.
Lateness:
- Call ASAP if late; >5 min may be logged; ~3 events can trigger a review (store policy may vary).
Menu (general guidance):
- Big Mac: two beef patties, three-part sesame bun, Big Mac sauce, lettuce, cheese, pickles, onions.
- Items and nutrition can vary by market; always confirm with local menu or allergen chart.`;
