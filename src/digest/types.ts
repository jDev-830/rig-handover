// Plan morning-digest § 1. The contract every part of § 2 builds against: commit this first.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One job's night. Times keep the log's offset (styleguide); the view shows a null owner as —.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// A night as read: rows sorted by job, plus the lines that didn't parse (counted, never thrown).
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null when runs/<night>.jsonl doesn't exist (the routes answer 404). An empty file gives no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
