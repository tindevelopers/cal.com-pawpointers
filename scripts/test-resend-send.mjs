#!/usr/bin/env node
/**
 * Test Resend email delivery using mail.pawpointers.com (or EMAIL_FROM from .env).
 *
 * Usage:
 *   node scripts/test-resend-send.mjs [to-email]
 *
 * Example:
 *   node scripts/test-resend-send.mjs you@example.com
 *
 * Requires in .env:
 *   RESEND_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");

function loadEnv() {
  try {
    const content = readFileSync(envPath, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const val = m[2].replace(/^["']|["']$/g, "").trim();
        env[m[1]] = val;
      }
    }
    return env;
  } catch (e) {
    console.error("Failed to read .env:", e.message);
    process.exit(1);
  }
}

const env = { ...loadEnv(), ...process.env };
const RESEND_API_KEY = env.RESEND_API_KEY;
const EMAIL_FROM = env.EMAIL_FROM;
const EMAIL_FROM_NAME = env.EMAIL_FROM_NAME || "Pawpointers";

if (!RESEND_API_KEY || !EMAIL_FROM) {
  console.error("Missing RESEND_API_KEY or EMAIL_FROM.");
  console.error("  Add to .env or pass: RESEND_API_KEY=re_xxx EMAIL_FROM=notifications@mail.pawpointers.com");
  console.error("  Ensure mail.pawpointers.com is verified in Resend dashboard: https://resend.com/domains");
  process.exit(1);
}

const to = process.argv[2] || "test@example.com";
const from = EMAIL_FROM_NAME ? `${EMAIL_FROM_NAME} <${EMAIL_FROM}>` : EMAIL_FROM;

console.log("Resend test send");
console.log("  From:", from);
console.log("  To:", to);
console.log("  API key:", RESEND_API_KEY ? `${RESEND_API_KEY.slice(0, 10)}...` : "(missing)");
console.log("");

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${RESEND_API_KEY}`,
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "Pawpointers – Resend test",
    html: "<p>If you received this, Resend is working with <strong>mail.pawpointers.com</strong>.</p><p>Sent at " + new Date().toISOString() + "</p>",
  }),
});

const json = await res.json();

if (!res.ok) {
  console.error("Resend API error:", res.status, res.statusText);
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

console.log("✓ Email sent successfully");
console.log("  ID:", json.id);
console.log("");
console.log("Check the inbox at", to, "(and spam folder).");
