import { getDirectSql } from "../lib/db";

async function main() {
  const sql = getDirectSql();
  await sql`TRUNCATE TABLE aggregated_results`;
  await sql`TRUNCATE TABLE evaluations`;
  await sql`DELETE FROM app_state WHERE key = 'closed'`;
  console.log("리허설 데이터 초기화 완료 (groups/users는 유지, evaluations/aggregated_results/마감상태만 삭제)");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
