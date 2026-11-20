// Starts the web app against the local backend (see local-backend.mjs). Reads the
// keys the backend writes on start, so start the backend first.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const credentials = join(here, "local-backend.credentials.json");
const port = process.env.PORT || "3100";

async function backendReady() {
  try {
    return (await fetch("http://127.0.0.1:54321/__health")).ok;
  } catch {
    return false;
  }
}

for (let i = 0; i < 60 && !(await backendReady()); i++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!existsSync(credentials)) throw new Error("Start the local backend first.");
const { anonKey, serviceRoleKey } = JSON.parse(readFileSync(credentials, "utf8"));

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  GEMINI_API_KEY: "local-test-key",
  GEMINI_BASE_URL: "http://127.0.0.1:54321/v1beta",
  NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
  APPLE_ALLOW_LOCAL_TRANSACTIONS: "true",
  // Empty beats any real key in .env.local, so tests can never spend money.
  OPENAI_API_KEY: "",
};

const web = join(here, "..", "..", "apps", "web");
const next = spawn(join(web, "node_modules", ".bin", "next"), ["dev", "-p", port], {
  cwd: web,
  env,
  stdio: "inherit",
});
next.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}
