// functions/ask.js — McCrew AI backend using OpenAI
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // store this in Netlify env vars
});

export async function handler(event) {
  try {
    const { question } = JSON.parse(event.body);

    const prompt = `
You are McCrew AI, a friendly assistant for McDonald's crew members.
Answer concisely (2–4 sentences). Stay professional, helpful, and kind.
Use UK terms (like 'shift', 'break', 'payday').
Question: "${question}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 180,
    });

    const answer = completion.choices[0].message.content.trim();
    return {
      statusCode: 200,
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    console.error("AI error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI unavailable. Try again later." }),
    };
  }
}
