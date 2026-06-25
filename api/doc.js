// api/doc.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { sn: token } = req.query;
  if (!token) return res.status(400).json({ error: "Missing sn" });

  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid_token" });
  }

  const { slug, doc, expiresAt } = payload;
  if (!slug || !doc || !expiresAt) return res.status(400).json({ error: "invalid_token" });

  if (Date.now() > expiresAt) {
    return res.status(410).json({ error: "expired" });
  }

  const tokenRaw = await redis.get(`token:${slug}`);
  const tokenData = tokenRaw
    ? (typeof tokenRaw === "string" ? JSON.parse(tokenRaw) : tokenRaw)
    : null;

  if (!tokenData || tokenData.token !== token) {
    return res.status(410).json({ error: "expired" });
  }

  try {
    const exportUrl = `https://docs.google.com/document/d/${doc}/export?format=html`;
    const response = await fetch(exportUrl, {
      headers: { "User-Agent": "DocVault/1.0" },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "fetch_failed",
        message: "Could not fetch the document. Make sure it is shared as 'Anyone with the link can view'.",
      });
    }

    const html = await response.text();

    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Extract background color from body tag style
    let bgColor = null;
    const bodyTagMatch = html.match(/<body([^>]*)>/i);
    if (bodyTagMatch) {
      const bodyAttrs = bodyTagMatch[1];
      const styleMatch = bodyAttrs.match(/style="([^"]*)"/i);
      if (styleMatch) {
        const bgMatch = styleMatch[1].match(/background-color\s*:\s*([^;]+)/i);
        if (bgMatch) bgColor = bgMatch[1].trim();
      }
    }

    // Fallback: check <style> blocks for body background-color
    if (!bgColor) {
      const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      for (const block of styleBlocks) {
        const m = block.match(/body\s*\{[^}]*background-color\s*:\s*([^;}\s]+)/i);
        if (m) { bgColor = m[1].trim(); break; }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      content: bodyContent,
      bgColor: bgColor || null,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
}
