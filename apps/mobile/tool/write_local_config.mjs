// Writes config/local.json so the app can run against the local backend:
//   node supabase/tests/local-backend.mjs   (start it first)
//   node apps/mobile/tool/write_local_config.mjs
//   flutter run --dart-define-from-file=config/local.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const creds = JSON.parse(readFileSync(join(root, "supabase", "tests", "local-backend.credentials.json"), "utf8"));
writeFileSync(
  join(here, "..", "config", "local.json"),
  `${JSON.stringify({
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: creds.anonKey,
    LEXA_API_BASE: process.env.LEXA_API_BASE || "http://127.0.0.1:3100",
  }, null, 2)}\n`,
);
