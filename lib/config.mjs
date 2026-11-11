import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function magpieDir(options) {
  const given = String((options && options.configDir) || process.env.MAGPIE_CONFIG_DIR || "").trim();
  return given || path.join(os.homedir(), ".config", "magpie");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// What magpie will do with a request now: the group's routing, whether a turn
// sticks to the account that served it, and the floor this plugin was given.
export function readRouting(options) {
  const dir = magpieDir(options);
  const providers = readJson(path.join(dir, "providers.json"));
  const plugins = readJson(path.join(dir, "plugins.json"));
  if (!providers) return { ok: false, dir, groups: [], options: {}, error: "providers.json 读不到" };
  const groups = Array.isArray(providers.groups) ? providers.groups : [];
  let mine = {};
  const list = Array.isArray(plugins && plugins.plugins) ? plugins.plugins : [];
  for (const item of list) {
    const spec = String((item && (item.spec || item.name)) || "");
    if (/magpie-plugins[\\/]quota-floor$/.test(spec) || /quota-floor/.test(spec)) mine = (item && item.options) || {};
  }
  const rows = groups.map((group) => {
    const members = Array.isArray(group.members) ? group.members : [];
    return {
      id: String(group.id || group.name || ""),
      routing: String(group.routing || ""),
      affinity: String(group.affinity || group.stays || ""),
      classifier: group.classifier ? String(group.classifier) : "",
      members: members.map((m) => (typeof m === "string" ? m : String((m && (m.provider + "/" + m.model)) || ""))).filter(Boolean),
      rules: Array.isArray(group.rules) ? group.rules.length : 0
    };
  });
  const withCodex = rows.filter((row) => row.members.some((m) => m.startsWith("codex/")));
  const ranked = withCodex.slice().sort((a, b) => {
    const score = (row) => (row.routing.startsWith("quota-floor/") ? 0 : 1) + (row.id === "in-common-use" ? 0 : 1);
    return score(a) - score(b);
  });
  return { ok: true, dir, options: mine, groups: ranked.length ? ranked : rows.slice(0, 4), error: null };
}
