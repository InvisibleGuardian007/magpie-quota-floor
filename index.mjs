import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readQuotas, codexRows } from "./lib/quota.mjs";
import { readRouting } from "./lib/config.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(HERE, "ui");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function windowOf(row, wanted) {
  const win = (row.windows || []).find((w) => String(w.name || "").toLowerCase().includes(wanted));
  if (!win) return null;
  const used = typeof win.used === "number" ? win.used : null;
  const left = typeof win.remaining === "number" ? win.remaining : used === null ? null : Math.max(0, 100 - used);
  return { used, remaining: left, resetsAt: win.resetsAt || null };
}

// The order the gateway's keep() would put the seats in, worked out from the
// same numbers the page shows. A seat at or past 100 - floor sorts last.
function judge(used, floor, softCap) {
  if (used === null) return { tier: 2, why: "用量读不到，排在已读到的后面" };
  const limit = 100 - floor;
  if (used >= limit) return { tier: 3, why: "已到下限（" + used + "% ≥ " + limit + "%），排到最后" };
  if (softCap !== null && used >= softCap) return { tier: 1, why: "接近下限（" + used + "% ≥ " + softCap + "%），排在还宽松的后面" };
  return { tier: 0, why: "还宽裕，排在前面" };
}

async function buildState(options) {
  const floor = Number.isFinite(Number(options && options.floor)) ? Number(options.floor) : 1;
  const softRaw = options && options.softCap;
  const softCap = Number.isFinite(Number(softRaw)) ? Number(softRaw) : null;
  const routing = readRouting(options);
  const quotas = await readQuotas(options);
  const codex = codexRows(quotas).map((row) => {
    const five = windowOf(row, "hour");
    const week = windowOf(row, "day");
    const tight = [five, week].filter(Boolean).reduce((a, b) => (a === null || (b && b.remaining !== null && (a.remaining === null || b.remaining < a.remaining)) ? b : a), null);
    const used = tight && tight.used !== null ? tight.used : null;
    const hit = judge(used, floor, softCap);
    return {
      account: row.user || row.name || "(未命名)",
      plan: row.plan || "",
      five,
      week,
      used,
      tier: hit.tier,
      why: hit.why,
      resets: row.resets,
      error: row.error
    };
  });
  const others = quotas.rows.filter((row) => row.provider !== "codex").slice(0, 12).map((row) => ({
    provider: row.provider,
    account: row.user || row.name || "",
    windows: (row.windows || []).map((w) => ({ name: w.name, remaining: w.remaining }))
  }));
  return {
    ok: quotas.ok,
    error: quotas.error,
    gateway: quotas.gateway,
    floor,
    softCap,
    limit: 100 - floor,
    routing,
    codex,
    others,
    readAt: new Date().toISOString()
  };
}

function serveStatic(res, rel) {
  const clean = rel.replace(/^\/+/, "") || "index.html";
  const file = path.join(UI, clean);
  if (!file.startsWith(UI)) return json(res, 403, { error: "forbidden" });
  let body;
  try {
    body = fs.readFileSync(file);
  } catch {
    return json(res, 404, { error: "not found" });
  }
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'"
  });
  res.end(body);
}

function start(options) {
  const port = Number(options && options.port) || 4396;
  const host = "127.0.0.1";
  const server = http.createServer(async (req, res) => {
    const hostHeader = String(req.headers.host || "").toLowerCase();
    if (hostHeader !== host + ":" + port && hostHeader !== "localhost:" + port) return json(res, 403, { error: "bad host" });
    if (req.headers.origin === "null") {
      res.setHeader("access-control-allow-origin", "null");
      res.setHeader("access-control-allow-headers", "content-type");
      res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, "http://" + host + ":" + port);
    if (url.pathname === "/_floor/health") return json(res, 200, { app: "quota-floor", protocol: 1 });
    if (url.pathname === "/api/state") {
      try {
        return json(res, 200, await buildState(options));
      } catch (error) {
        return json(res, 500, { ok: false, error: String((error && error.message) || error) });
      }
    }
    return serveStatic(res, url.pathname);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve({ stop: () => server.close() }));
  });
}

export default {
  id: "magpie-quota-floor",
  async server(ctx, options) {
    return start(options || {});
  }
};
