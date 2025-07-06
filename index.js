/*  Forward‑proxy server
    Author: Gj4meZ
    All comments in English (per user preference)             */

import http from 'http';
import { createProxyServer } from 'http-proxy';
import { WebSocketServer, WebSocket } from 'ws';

// === Configuration via environment variables ===
const TARGET_HOST = process.env.TARGET_HOST || '127.0.0.1';
const TARGET_PORT = process.env.TARGET_PORT || '8080';
// Public port on the CDN platform (Fly.io sets PORT automatically)
const LISTEN_PORT = process.env.PORT || 3000;

// Create an HTTP‑Proxy that also understands WebSockets
const proxy = createProxyServer({
  target: `http://${TARGET_HOST}:${TARGET_PORT}`,
  ws: true,
  changeOrigin: true,
});

// Standard HTTP requests
const server = http.createServer((req, res) => {
  proxy.web(req, res, (err) => {
    console.error('Proxy HTTP error:', err);
    res.writeHead(502);
    res.end('Bad gateway');
  });
});

// WebSocket upgrade (ws:// or wss://)
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, (err) => {
    console.error('Proxy WS error:', err);
    socket.end();
  });
});

// Start listening
server.listen(LISTEN_PORT, () => {
  console.log(`Forward proxy listening on :${LISTEN_PORT} → ${TARGET_HOST}:${TARGET_PORT}`);
});
