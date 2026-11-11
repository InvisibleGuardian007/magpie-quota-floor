// floor.gateway.js — a magpie routing that keeps the last `floor` percent of
// every seat's allowance. Runs on moejs: one file, nothing imported, 20 ms.
//
// A seat is { key, account, known, learns, used, soon, pace, weight, resting, tokens }
// where used is the share of the binding limit already spent (0-100), known
// says the usage was read, resting when it is resting after a failure, and
// tokens what it was sent lately. A strategy only returns the order to try
// them in, so it cannot refuse a request: it puts the seats near the floor
// last, and magpie tries the others first.

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// 0 first try, 4 only when nothing else is left.
const tierOf = (s, limit, soft) => {
  if (num(s.resting) !== null && s.resting > 0) return 4; // cooling after a failure
  if (!s.known) return 2; // usage unknown: don't guess it is fine
  const used = num(s.used);
  if (used === null) return 2;
  if (used >= limit) return 3; // at or past the floor
  if (soft !== null && soft < limit && used >= soft) return 1; // close to it
  return 0;
};

export const strategies = {
  // Keep a floor: the seats still above it, least used first.
  keep(pool, seats, options) {
    const opts = options || {};
    const floor = clamp(num(opts.floor) === null ? 1 : opts.floor, 0, 50);
    const rawSoft = num(opts.softCap);
    const soft = rawSoft === null ? null : clamp(rawSoft, 0, 100);
    const limit = 100 - floor;
    const tokens = (s) => num(s.tokens) || 0;
    const used = (s) => (num(s.used) === null ? 101 : s.used);
    return seats
      .map((s, i) => ({ i, t: tierOf(s, limit, soft), u: used(s), k: tokens(s) }))
      .sort((a, b) => a.t - b.t || a.u - b.u || a.k - b.k || a.i - b.i)
      .map((x) => x.i);
  },
};
