import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const videos = await sql`SELECT * FROM motion_videos ORDER BY created_at DESC`;
  console.log("Motion Videos in DB:");
  console.log(JSON.stringify(videos, null, 2));
  await sql.end();
}

main();
