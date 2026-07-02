import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __evalSql: ReturnType<typeof postgres> | undefined;
}

// Vercel 서버리스 환경에서는 함수 인스턴스마다 커넥션이 새로 생기므로
// prepare(false) + 소량 커넥션으로 Supabase pooler(6543)와 궁합을 맞춘다.
// DATABASE_URL 체크는 실제 쿼리 시점(getSql 호출 시)에만 하여, 빌드 타임 모듈 로딩이
// 환경변수 미설정으로 실패하지 않도록 한다.
function createConnection() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다. Supabase 연결 문자열을 .env.local / Vercel 환경변수에 넣어주세요.");
  }
  return postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
}

export function getSql() {
  if (!global.__evalSql) {
    global.__evalSql = createConnection();
  }
  return global.__evalSql;
}

export async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      leader TEXT NOT NULL,
      members TEXT NOT NULL,
      topic TEXT NOT NULL,
      self_report_completed TEXT NOT NULL DEFAULT '',
      self_report_plan TEXT NOT NULL DEFAULT '',
      self_report_ai TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student','instructor')),
      group_id INTEGER REFERENCES groups(id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS evaluations (
      id SERIAL PRIMARY KEY,
      evaluator_id INTEGER NOT NULL REFERENCES users(id),
      group_id INTEGER NOT NULL REFERENCES groups(id),
      item_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
      comment TEXT NOT NULL DEFAULT '',
      submitted INTEGER NOT NULL DEFAULT 0,
      anon_label INTEGER,
      is_locked INTEGER NOT NULL DEFAULT 0,
      submitted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE (evaluator_id, group_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS aggregated_results (
      group_id INTEGER PRIMARY KEY REFERENCES groups(id),
      per_item_final_score TEXT NOT NULL,
      total_score DOUBLE PRECISION NOT NULL,
      rank INTEGER,
      trimmed_evaluator_ids TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'FINAL',
      finalized_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
}

export async function isClosed(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql<{ value: string }[]>`SELECT value FROM app_state WHERE key = 'closed'`;
  return rows[0]?.value === "1";
}
