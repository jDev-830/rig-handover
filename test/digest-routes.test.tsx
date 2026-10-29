import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
const app = createApp(config);

const line = (job: string, status: string, at: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

const good = [
  line('zeta/last', 'ok', '2026-10-29T01:00:00+01:00'),
  line('alpha/first', 'fail', '2026-10-29T01:10:00+01:00'),
  line('mid/job', 'ok', '2026-10-29T01:20:00+01:00', null),
];

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  writeFileSync(join(dir, '2026-01-01.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(join(dir, '2026-01-03.jsonl'), [good[0], '{"at": "truncated', good[1]].join('\n') + '\n');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const order = ['alpha/first', 'mid/job', 'zeta/last'];
const html = async (night: string) => {
  const res = await app.request(`/digest/${night}`);
  return { res, text: await res.text() };
};
const json = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as Night };
};
const jobsInHtml = (text: string) => [...text.matchAll(/<td>([a-z]+\/[a-z-]+)<\/td>/g)].map((m) => m[1]);

describe('GET /digest/:night', () => {
  it('200 with the table, jobs in order and the lane banner', async () => {
    const { res, text } = await html('2026-01-01');
    expect(res.status).toBe(200);
    expect(text).toContain('TEST-MARKER');
    expect(text).toContain('<table>');
    expect(jobsInHtml(text)).toEqual(order);
  });

  it('404 for a night with no file', async () => {
    const { res } = await html('2026-01-09');
    expect(res.status).toBe(404);
  });

  it('empty night says nothing ran', async () => {
    const { res, text } = await html('2026-01-02');
    expect(res.status).toBe(200);
    expect(text).toContain('nothing ran');
    expect(text).not.toContain('<table>');
  });

  it("bad line: still 200, good jobs shown, the didn't parse note", async () => {
    const { res, text } = await html('2026-01-03');
    expect(res.status).toBe(200);
    expect(jobsInHtml(text)).toEqual(['alpha/first', 'zeta/last']);
    expect(text.replace('&#39;', "'")).toContain("1 line didn't parse");
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with rows sorted by job and badLines 0', async () => {
    const { res, body } = await json('2026-01-01');
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(order);
    expect(body.rows[0]).toMatchObject({ job: 'alpha/first', lastStatus: 'fail', owner: 'rook', runs: 1 });
    expect(body.badLines).toBe(0);
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2026-01-09' });
  });

  it('empty night has no rows and no bad lines', async () => {
    const { res, body } = await json('2026-01-02');
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('bad line: still 200, good jobs there, badLines 1', async () => {
    const { res, body } = await json('2026-01-03');
    expect(res.status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/first', 'zeta/last']);
    expect(body.badLines).toBe(1);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const { text } = await html('2026-01-01');
    const { body } = await json('2026-01-01');
    expect(jobsInHtml(text)).toEqual(body.rows.map((r) => r.job));
  });
});
