export async function handler() {
  return { statusCode: 200, body: JSON.stringify({ ok: true, env: !!process.env.OPENAI_API_KEY }) };
}
