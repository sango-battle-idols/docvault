// api/redirect.js
// GET /api/redirect?slug=training
//
// Looks up the current token for a slug.
// If expired or missing, auto-generates a fresh one and saves it.

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function makeToken(slug, doc) {
  const expiresAt = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days
  const token = Buffer.from(JSON.stringify({ slug, doc, expiresAt })).toString("base64url");
  return { token, expiresAt };
}

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  // Look up slug → doc mapping
  const slugRaw = await redis.get(`slug:${slug}`);
  if (!slugRaw) return res.status(404).json({ error: "not_found" });

  const { doc } = typeof slugRaw === "string" ? JSON.parse(slugRaw) : slugRaw;

  // Look up current token
  const tokenRaw = await redis.get(`token:${slug}`);
  let tokenData = tokenRaw
    ? (typeof tokenRaw === "string" ? JSON.parse(tokenRaw) : tokenRaw)
    : null;

  // Auto-renew if expired or missing
  if (!tokenData || Date.now() > tokenData.expiresAt) {
    const { token, expiresAt } = makeToken(slug, doc);
    tokenData = { token, expiresAt };
    await redis.set(`token:${slug}`, JSON.stringify(tokenData));
  }

  res.status(200).json({
    token: tokenData.token,
    expiresAt: new Date(tokenData.expiresAt).toISOString(),
  });
}
