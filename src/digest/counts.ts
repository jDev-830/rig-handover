import type { Night } from './types.js';

// Per job by its last status: ok = jobs ending ok, fail = jobs ending fail, retry = retry lines (Σ retries).
export function nightCounts(night: Night): { ok: number; retry: number; fail: number } {
  return {
    ok: night.rows.filter((r) => r.lastStatus === 'ok').length,
    retry: night.rows.reduce((sum, r) => sum + r.retries, 0),
    fail: night.rows.filter((r) => r.lastStatus === 'fail').length,
  };
}
