/*  node-fetch-mirror
    Mirrors any path to an origin host and relays ALL origin headers.
    Author: <you>
    ────────────────────────────────────────────────────────────
    Configuration (environment variables)
      ORIGIN_SCHEME  http  | https
      ORIGIN_HOST    e.g. moz.com
      ORIGIN_PORT    80    | 443 (optional; defaults by scheme)
      // PLATFORM sets LISTEN_PORT automatically (Render, Fly.io, etc.)
*/

import { createServer } from 'node:http';
import { request } from 'undici';

// ── ENV & defaults ───────────────────────────────
const ORIGIN_SCHEME = process.env.ORIGIN_SCHEME ?? 'https';
const ORIGIN_HOST   = process.env.ORIGIN_HOST   ?? 'moz.com';
const ORIGIN_PORT   = process.env.ORIGIN_PORT   ?? (ORIGIN_SCHEME === 'https' ? 443 : 80);
const LISTEN_PORT   = process.env.PORT          ?? 3000;

// Only hop‑by‑hop headers must be stripped (RFC 7230 §6.1)
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

// ── Main HTTP server ─────────────────────────────
createServer(async (req, res) => {
  try {
    // Build origin URL (same path & query)
    const originUrl = `${ORIGIN_SCHEME}://${ORIGIN_HOST}:${ORIGIN_PORT}${req.url}`;

    // Clone client headers to send upstream
    const upstreamHeaders = { ...req.headers };
    // Override host header so origin TLS/SNI matches
    upstreamHeaders.host = ORIGIN_HOST;

    // Make upstream request (streaming, keep method & body)
    const upstream = await request(originUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: req,
      // Allow redirect? choose based on need:
      redirect: 'manual',
      // A pooled agent is automatic in undici
    });

    // Relay status & headers back to client
    res.writeHead(upstream.statusCode, filterHeaders(upstream.headers));

    // Stream body
    upstream.body.pipe(res);

    upstream.body.on('error', (err) => {
      console.error('Upstream body error:', err);
      res.destroy(err);
    });
  } catch (err) {
    console.error('Proxy error:', err);
    if (!res.headersSent) res.writeHead(502);
    res.end('Bad Gateway');
  }
}).listen(LISTEN_PORT, () =>
  console.log(`Mirror listening on :${LISTEN_PORT} → ${ORIGIN_SCHEME}://${ORIGIN_HOST}:${ORIGIN_PORT}`)
);

// ── Helper: strip hop‑by‑hop headers ─────────────
function filterHeaders(headers) {
  const filtered = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) filtered[k] = v;
  }
  return filtered;
}
