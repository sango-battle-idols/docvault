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

  // Get bgColor stored with the slug
  const slugRaw = await redis.get(`slug:${slug}`);
  const slugData = slugRaw
    ? (typeof slugRaw === "string" ? JSON.parse(slugRaw) : slugRaw)
    : null;
  const bgColor = slugData?.bgColor || null;

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
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Extract Google's style blocks for text colors
    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const docStyles = styleBlocks.map(b => b.replace(/<\/?style[^>]*>/gi, "")).join("\n");

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      content: bodyContent,
      bgColor,
      docStyles: docStyles || null,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
}
