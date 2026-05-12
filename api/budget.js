import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  // Allow requests during local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const data = await kv.get("budget-data");
      return res.json({ data: data ?? null });
    } catch (err) {
      console.error("KV read error:", err);
      return res.status(500).json({ error: "Failed to load" });
    }
  }

  if (req.method === "POST") {
    try {
      await kv.set("budget-data", req.body.data);
      return res.json({ ok: true });
    } catch (err) {
      console.error("KV write error:", err);
      return res.status(500).json({ error: "Failed to save" });
    }
  }

  return res.status(405).end();
}
