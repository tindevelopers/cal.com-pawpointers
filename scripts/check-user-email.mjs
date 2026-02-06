#!/usr/bin/env node
/**
 * Check if an email exists in the User table.
 * Usage: railway run node scripts/check-user-email.mjs <email>
 * Example: railway run node scripts/check-user-email.mjs gene@tin.info
 */
import pg from "pg";
const { Client } = pg;

const email = (process.argv[2] || "gene@tin.info").toLowerCase();
// Use DATABASE_PUBLIC_URL for local/railway run (private URL only works inside Railway)
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Need DATABASE_PUBLIC_URL or DATABASE_URL. For local: get public URL from Railway Postgres service Variables tab.");
  process.exit(1);
}
const client = new Client({ connectionString: url });

await client.connect();
const res = await client.query(
  'SELECT id, email, name, "emailVerified" FROM "User" WHERE email = $1',
  [email]
);
await client.end();

const user = res.rows[0] || null;
console.log(JSON.stringify(user, null, 2));
