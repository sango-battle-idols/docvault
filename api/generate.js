// api/generate.js
// POST /api/generate
// Body: { "slug": "training", "doc": "GOOGLE_DOC_ID", "secret": "YOUR_ADMIN_SECRET" }

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { slug, doc, secret } = req.body || {};

  if (!slug)   return res.status(400).json({ error: "Missing slug" });
  if (!doc)    return res.status(400).json({ error: "Missing doc id" });
  if (secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: "Invalid secret" });

  const { token, expiresAt } = makeToken(slug, doc);

  // Persist slug → doc mapping forever
  await redis.set(`slug:${slug}`, JSON.stringify({ doc }));

  // Store current token
  await redis.set(`token:${slug}`, JSON.stringify({ token, expiresAt }));

  const base = process.env.SITE_URL || "https://your-site.vercel.app";

  res.status(200).json({
    permanentLink: `${base}/${slug}`,
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    note: "Share 'permanentLink' in Discord. Tokens auto-renew when expired."
  });
}
