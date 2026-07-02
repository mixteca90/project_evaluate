import { getSql, isClosed } from "../lib/db";

async function main() {
  const sql = getSql();
  const [{ c: groups }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int as c FROM groups`;
  const [{ c: users }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int as c FROM users`;
  const [{ c: evals }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int as c FROM evaluations`;
  console.log({ groups, users, evals, closed: await isClosed() });
  await sql.end();
}

main();
