// ============================================================================
// Lexa local backend — development and testing only. Never deployed.
//
// Runs the whole backend on this machine with no Docker and no cloud account, so
// the app can be exercised end to end (including sign-up and account deletion)
// without touching production data:
//
//   * a REAL embedded Postgres with the REAL migrations and RLS policies
//   * the small part of Supabase Auth, PostgREST, and Storage the app uses
//   * a scripted stand-in for the Gemini API, so no AI key or cost is involved
//
// Run:   npm run dev:backend        (from supabase/tests)
// Then:  see apps/web/.env.local.example.local-backend for the web settings.
//
// Answers from the stand-in are fixed text. They exercise the app; they say
// nothing about how accurate a real model is.
// ============================================================================
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeed } from "./local-backend-seed.mjs";
import { handleGemini } from "./local-backend-ai.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTTP_PORT = Number(process.env.LOCAL_BACKEND_PORT) || 54321;
const DB_PORT = 54330;
const DATA_DIR = join(__dirname, ".pgdata-local");
const STORAGE_DIR = join(__dirname, ".storage-local");
const CREDENTIALS_FILE = join(__dirname, "local-backend.credentials.json");

// Local-only signing secret. These keys are worthless outside this process.
const JWT_SECRET = "lexa-local-backend-only-not-a-real-secret";

// ---- JWT ---------------------------------------------------------------------
const b64 = (value) => Buffer.from(value).toString("base64url");

function signJwt(claims) {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(claims));
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  const [header, body, signature] = String(token).split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

const longLived = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
const ANON_KEY = signJwt({ role: "anon", iss: "lexa-local", exp: longLived });
const SERVICE_KEY = signJwt({ role: "service_role", iss: "lexa-local", exp: longLived });

// ---- Passwords ----------------------------------------------------------------
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function checkPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---- Database -----------------------------------------------------------------
const storageShim = `
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false, file_size_limit bigint
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
`;

let pool;

async function startDatabase() {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: DB_PORT,
    persistent: false,
  });
  await server.initialise();
  await server.start();

  pool = new pg.Pool({
    host: "127.0.0.1",
    port: DB_PORT,
    user: "postgres",
    password: "postgres",
    database: "postgres",
    max: 8,
  });

  await pool.query(readFileSync(join(__dirname, "auth_shim.sql"), "utf8"));
  await pool.query("alter table auth.users add column if not exists encrypted_password text");
  await pool.query("alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb");
  await pool.query(storageShim);

  const migrationsDir = join(__dirname, "..", "migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) await pool.query(readFileSync(join(migrationsDir, file), "utf8"));

  // Supabase's default grants for the service role.
  await pool.query(`
    grant usage on schema public to service_role;
    grant all on all tables in schema public to service_role;
    grant all on all sequences in schema public to service_role;
    grant all on auth.users to service_role;
  `);
  console.log(`[db] Postgres on ${DB_PORT}: ${files.length} migrations applied`);
  return server;
}

/** Runs `fn` as the given role, the way PostgREST evaluates RLS. */
async function asRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query(`set local role ${["anon", "authenticated", "service_role"].includes(claims.role) ? claims.role : "anon"}`);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---- PostgREST subset -----------------------------------------------------------
const ident = (name) => `"${String(name).replace(/"/g, '""')}"`;

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim());
}

async function relationship(client, base, other, hint) {
  const { rows } = await client.query(
    `select c.conname, src.relname as source, dst.relname as target,
            (select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as source_columns,
            (select array_agg(a.attname::text order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as target_columns
       from pg_constraint c
       join pg_class src on src.oid = c.conrelid
       join pg_class dst on dst.oid = c.confrelid
      where c.contype = 'f' and ((src.relname = $1 and dst.relname = $2) or (src.relname = $2 and dst.relname = $1))`,
    [base, other],
  );
  const match = hint ? rows.find((r) => r.conname === hint) : rows[0];
  if (!match) throw Object.assign(new Error(`No relationship between ${base} and ${other}`), { code: "PGRST200" });
  return match;
}

async function selectList(client, table, alias, select, counter) {
  const items = splitTopLevel(select || "*");
  const output = [];
  for (const item of items) {
    const embed = item.match(/^(?:([\w]+):)?([\w]+)(?:!([\w]+))?\((.*)\)$/s);
    if (!embed) {
      if (item === "*") output.push(`${alias}.*`);
      else {
        const [name, label] = item.includes(":") ? item.split(":").reverse() : [item, item];
        output.push(`${alias}.${ident(name)} as ${ident(label)}`);
      }
      continue;
    }
    const [, label, other, hint, inner] = embed;
    const rel = await relationship(client, table, other, hint);
    const childAlias = `e${counter.n++}`;
    const toOne = rel.source === table && rel.target === other;
    const join = rel.source_columns
      .map((col, i) =>
        toOne
          ? `${childAlias}.${ident(rel.target_columns[i])} = ${alias}.${ident(col)}`
          : `${childAlias}.${ident(col)} = ${alias}.${ident(rel.target_columns[i])}`,
      )
      .join(" and ");
    const name = ident(label || other);
    if (inner.trim() === "count") {
      output.push(`(select json_agg(c) from (select count(*)::int as count from public.${ident(other)} ${childAlias} where ${join}) c) as ${name}`);
      continue;
    }
    const childColumns = await selectList(client, other, childAlias, inner, counter);
    output.push(
      toOne
        ? `(select row_to_json(c) from (select ${childColumns} from public.${ident(other)} ${childAlias} where ${join} limit 1) c) as ${name}`
        : `coalesce((select json_agg(c) from (select ${childColumns} from public.${ident(other)} ${childAlias} where ${join}) c), '[]'::json) as ${name}`,
    );
  }
  return output.join(", ");
}

function columnRef(alias, column) {
  const path = column.match(/^(\w+)->>(\w+)$/);
  if (path) return `${alias}.${ident(path[1])}->>'${path[2].replace(/'/g, "''")}'`;
  return `${alias}.${ident(column)}`;
}

function parseListValue(value) {
  const inner = value.replace(/^\(/, "").replace(/\)$/, "");
  return inner === "" ? [] : inner.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
const COMPARE = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };

function buildWhere(query, alias, params) {
  const clauses = [];
  for (const [column, raw] of query.entries()) {
    if (RESERVED.has(column)) continue;
    const negate = raw.startsWith("not.");
    const body = negate ? raw.slice(4) : raw;
    const dot = body.indexOf(".");
    const op = body.slice(0, dot);
    const value = body.slice(dot + 1);
    const ref = columnRef(alias, column);
    let clause;
    if (op === "is") {
      clause = `${ref} is ${value === "null" ? "null" : value === "true" ? "true" : "false"}`;
    } else if (op === "in") {
      const list = parseListValue(value);
      if (list.length === 0) clause = "false";
      else {
        const holders = list.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        clause = `${ref}::text in (${holders.map((h) => `${h}::text`).join(", ")})`;
      }
    } else if (COMPARE[op]) {
      params.push(value);
      clause = `${ref} ${COMPARE[op]} $${params.length}`;
    } else {
      throw Object.assign(new Error(`Unsupported filter operator: ${op}`), { code: "PGRST100" });
    }
    clauses.push(negate ? `not (${clause})` : clause);
  }
  return clauses.length ? `where ${clauses.join(" and ")}` : "";
}

function buildOrder(query, alias) {
  const order = query.get("order");
  if (!order) return "";
  const terms = order.split(",").map((term) => {
    const [column, ...flags] = term.split(".");
    const dir = flags.includes("desc") ? "desc" : "asc";
    const nulls = flags.includes("nullsfirst") ? "nulls first" : flags.includes("nullslast") ? "nulls last" : "";
    return `${alias}.${ident(column)} ${dir} ${nulls}`;
  });
  return `order by ${terms.join(", ")}`;
}

function postgrestStatus(err) {
  const map = { "42501": 403, "23505": 409, "23503": 409, "23514": 400, "22P02": 400, "42703": 400, PGRST200: 400, PGRST100: 400 };
  return map[err.code] ?? 500;
}

async function handleRest(req, res, url, claims, body) {
  const table = url.pathname.replace("/rest/v1/", "");
  const prefer = req.headers.prefer || "";
  const wantObject = (req.headers.accept || "").includes("vnd.pgrst.object");
  const wantCount = prefer.includes("count=exact");
  const representation = prefer.includes("return=representation");
  const counter = { n: 0 };

  const result = await asRole(claims, async (client) => {
    const select = await selectList(client, table, "t", url.searchParams.get("select") || "*", counter);
    const params = [];
    const qualified = `public.${ident(table)}`;

    if (req.method === "GET" || req.method === "HEAD") {
      const where = buildWhere(url.searchParams, "t", params);
      const limit = url.searchParams.get("limit") ? `limit ${Number(url.searchParams.get("limit"))}` : "";
      const offset = url.searchParams.get("offset") ? `offset ${Number(url.searchParams.get("offset"))}` : "";
      const sql = `select coalesce(json_agg(r), '[]'::json) as rows from (select ${select} from ${qualified} t ${where} ${buildOrder(url.searchParams, "t")} ${limit} ${offset}) r`;
      const rows = req.method === "HEAD" ? [] : (await client.query(sql, params)).rows[0].rows;
      const total = wantCount
        ? Number((await client.query(`select count(*) from ${qualified} t ${where}`, params)).rows[0].count)
        : null;
      return { rows, total };
    }

    if (req.method === "POST") {
      const records = Array.isArray(body) ? body : [body];
      const columns = Object.keys(records[0] ?? {});
      const list = columns.map(ident).join(", ");
      params.push(JSON.stringify(records));
      const conflictTarget = url.searchParams.get("on_conflict");
      const conflict =
        prefer.includes("resolution=merge-duplicates") && conflictTarget
          ? `on conflict (${conflictTarget.split(",").map(ident).join(", ")}) do update set ${columns.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`
          : "";
      const sql = `with written as (insert into ${qualified} (${list}) select ${list} from json_populate_recordset(null::${qualified}, $1::json) ${conflict} returning *)
                   select coalesce(json_agg(r), '[]'::json) as rows from (select ${select} from written t) r`;
      return { rows: (await client.query(sql, params)).rows[0].rows, status: 201 };
    }

    if (req.method === "PATCH") {
      const columns = Object.keys(body ?? {});
      params.push(JSON.stringify(body));
      const where = buildWhere(url.searchParams, "t", params);
      const list = columns.map(ident).join(", ");
      const sql = `with written as (update ${qualified} t set (${list}) = (select ${list} from json_populate_record(null::${qualified}, $1::json)) ${where} returning t.*)
                   select coalesce(json_agg(r), '[]'::json) as rows from (select ${select} from written t) r`;
      return { rows: (await client.query(sql, params)).rows[0].rows };
    }

    if (req.method === "DELETE") {
      const where = buildWhere(url.searchParams, "t", params);
      const sql = `with written as (delete from ${qualified} t ${where} returning t.*)
                   select coalesce(json_agg(r), '[]'::json) as rows from (select ${select} from written t) r`;
      return { rows: (await client.query(sql, params)).rows[0].rows };
    }
    throw new Error(`Unsupported method ${req.method}`);
  });

  if (wantObject && result.rows.length !== 1 && req.method !== "HEAD") {
    return json(res, 406, {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
      details: `The result contains ${result.rows.length} rows`,
      hint: null,
    });
  }

  const headers = {};
  if (result.total !== null && result.total !== undefined) {
    headers["Content-Range"] = `${result.rows.length ? `0-${result.rows.length - 1}` : "*"}/${result.total}`;
  }
  const isWrite = req.method !== "GET" && req.method !== "HEAD";
  if (req.method === "HEAD" || (isWrite && !representation)) {
    res.writeHead(isWrite ? (result.status ?? 204) : 200, headers);
    return res.end();
  }
  json(res, result.status ?? 200, wantObject ? result.rows[0] : result.rows, headers);
}

// ---- Auth subset ----------------------------------------------------------------
const refreshTokens = new Map();
export const recoveryLog = [];

function userPayload(row) {
  const created = new Date(row.created_at).toISOString();
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email,
    email_confirmed_at: created,
    confirmed_at: created,
    phone: "",
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: created,
    updated_at: new Date().toISOString(),
  };
}

function sessionFor(row) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  const refresh = randomBytes(24).toString("hex");
  refreshTokens.set(refresh, row.id);
  return {
    access_token: signJwt({
      sub: row.id,
      email: row.email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + expiresIn,
      session_id: randomUUID(),
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
    }),
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: refresh,
    user: userPayload(row),
  };
}

const authError = (res, status, code, message) =>
  json(res, status, { code: status, error_code: code, msg: message, error: code, error_description: message, message });

async function handleAuth(req, res, url, claims, body) {
  const path = url.pathname.replace("/auth/v1", "");

  if (req.method === "POST" && path === "/signup") {
    if (!body?.email || !body?.password) return authError(res, 422, "validation_failed", "Signup requires a valid password");
    if (String(body.password).length < 6) return authError(res, 422, "weak_password", "Password should be at least 6 characters.");
    const email = String(body.email).trim().toLowerCase();
    const existing = await pool.query("select id from auth.users where email = $1", [email]);
    if (existing.rows.length) return authError(res, 422, "user_already_exists", "User already registered");
    const { rows } = await pool.query(
      "insert into auth.users (email, encrypted_password) values ($1, $2) returning *",
      [email, hashPassword(String(body.password))],
    );
    return json(res, 200, sessionFor(rows[0]));
  }

  if (req.method === "POST" && path === "/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const { rows } = await pool.query("select * from auth.users where email = $1", [email]);
      if (!rows[0] || !checkPassword(String(body?.password ?? ""), rows[0].encrypted_password)) {
        return authError(res, 400, "invalid_credentials", "Invalid login credentials");
      }
      return json(res, 200, sessionFor(rows[0]));
    }
    if (grant === "refresh_token") {
      const userId = refreshTokens.get(body?.refresh_token);
      if (!userId) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      refreshTokens.delete(body.refresh_token);
      const { rows } = await pool.query("select * from auth.users where id = $1", [userId]);
      if (!rows[0]) return authError(res, 400, "user_not_found", "User not found");
      return json(res, 200, sessionFor(rows[0]));
    }
    return authError(res, 400, "unsupported_grant_type", "Unsupported grant type");
  }

  if (req.method === "POST" && path === "/logout") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "POST" && (path === "/recover" || path === "/otp")) {
    recoveryLog.push({ path, email: body?.email, at: new Date().toISOString() });
    console.log(`[auth] ${path} email would be sent to ${body?.email}`);
    return json(res, 200, {});
  }

  if (path === "/user" && (req.method === "GET" || req.method === "PUT")) {
    if (!claims.sub) return authError(res, 401, "no_authorization", "This endpoint requires a valid Bearer token");
    if (req.method === "PUT" && body?.password) {
      await pool.query("update auth.users set encrypted_password = $1 where id = $2", [hashPassword(String(body.password)), claims.sub]);
    }
    const { rows } = await pool.query("select * from auth.users where id = $1", [claims.sub]);
    if (!rows[0]) return authError(res, 403, "user_not_found", "User from sub claim in JWT does not exist");
    return json(res, 200, userPayload(rows[0]));
  }

  const adminUser = path.match(/^\/admin\/users\/([\w-]+)$/);
  if (adminUser && claims.role === "service_role") {
    if (req.method === "DELETE") {
      await pool.query("delete from auth.users where id = $1", [adminUser[1]]);
      return json(res, 200, {});
    }
    const { rows } = await pool.query("select * from auth.users where id = $1", [adminUser[1]]);
    return rows[0] ? json(res, 200, userPayload(rows[0])) : authError(res, 404, "user_not_found", "User not found");
  }

  authError(res, 404, "not_found", `No auth route for ${req.method} ${path}`);
}

// ---- Storage subset -------------------------------------------------------------
async function handleStorage(req, res, url, claims, rawBody) {
  const match = url.pathname.match(/^\/storage\/v1\/object(?:\/authenticated)?\/([\w-]+)(?:\/(.*))?$/);
  if (!match) return json(res, 404, { error: "not_found", message: "Unknown storage route" });
  const [, bucket, objectPath = ""] = match;
  const decoded = decodeURIComponent(objectPath);
  const allowed = (p) => claims.role === "service_role" || (claims.sub && p.startsWith(`${claims.sub}/`));
  const onDisk = (p) => join(STORAGE_DIR, bucket, p.replace(/\.\./g, "_"));

  if (req.method === "POST" || req.method === "PUT") {
    if (!allowed(decoded)) return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    mkdirSync(dirname(onDisk(decoded)), { recursive: true });
    writeFileSync(onDisk(decoded), extractMultipartFile(req, rawBody));
    writeFileSync(`${onDisk(decoded)}.type`, multipartType(req, rawBody));
    return json(res, 200, { Key: `${bucket}/${decoded}`, Id: randomUUID() });
  }
  if (req.method === "GET") {
    if (!allowed(decoded)) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    try {
      const data = readFileSync(onDisk(decoded));
      let type = "application/octet-stream";
      try {
        type = readFileSync(`${onDisk(decoded)}.type`, "utf8");
      } catch {
        // Older object without a recorded type.
      }
      res.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
      return res.end(data);
    } catch {
      return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    }
  }
  if (req.method === "DELETE") {
    const prefixes = JSON.parse(rawBody.toString() || "{}").prefixes ?? [];
    for (const p of prefixes) {
      if (allowed(p)) {
        rmSync(onDisk(p), { force: true });
        rmSync(`${onDisk(p)}.type`, { force: true });
      }
    }
    return json(res, 200, prefixes.map((name) => ({ name })));
  }
  json(res, 405, { message: "Method not allowed" });
}

/** Storage clients send either the raw file or a multipart form holding it. */
function extractMultipartFile(req, raw) {
  const boundary = (req.headers["content-type"] || "").match(/boundary=(.+)$/)?.[1];
  if (!boundary) return raw;
  const marker = Buffer.from(`--${boundary}`);
  let start = raw.indexOf(marker);
  while (start !== -1) {
    const next = raw.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = raw.subarray(start + marker.length, next);
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd !== -1 && part.subarray(0, headerEnd).toString().includes("filename=")) {
      return part.subarray(headerEnd + 4, part.length - 2);
    }
    start = next;
  }
  return raw;
}

function multipartType(req, raw) {
  const contentType = req.headers["content-type"] || "application/octet-stream";
  if (!contentType.includes("multipart/")) return contentType;
  const found = raw.subarray(0, 2048).toString("latin1").match(/Content-Type:\s*([^\r\n]+)/i);
  return found ? found[1].trim() : "application/octet-stream";
}

// ---- HTTP ---------------------------------------------------------------------
function json(res, status, payload, headers = {}) {
  const text = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(text);
}

function claimsFrom(req) {
  const bearer = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = (bearer && verifyJwt(bearer)) || (req.headers.apikey && verifyJwt(req.headers.apikey));
  return claims || { role: "anon" };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Expose-Headers", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://127.0.0.1:${HTTP_PORT}`);
  try {
    const raw = await readBody(req);
    const isJson = (req.headers["content-type"] || "").includes("json");
    const body = isJson && raw.length ? JSON.parse(raw.toString()) : null;
    const claims = claimsFrom(req);

    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url, claims, body);
    if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url, claims, body);
    if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(req, res, url, claims, raw);
    if (url.pathname.startsWith("/v1beta/")) return await handleGemini(req, res, url, body);
    if (url.pathname === "/__health") return json(res, 200, { ok: true });
    if (url.pathname === "/__recovery-log") return json(res, 200, recoveryLog);
    if (url.pathname === "/__sql" && claims.role === "service_role") {
      const { rows } = await pool.query(body.sql, body.params ?? []);
      return json(res, 200, rows);
    }
    json(res, 404, { message: `No route for ${req.method} ${url.pathname}` });
  } catch (err) {
    console.error(`[http] ${req.method} ${req.url}:`, err.message);
    if (res.headersSent) return res.end();
    json(res, postgrestStatus(err), { code: err.code ?? "XX000", message: err.message, details: err.detail ?? null, hint: err.hint ?? null });
  }
});

// ---- Boot -----------------------------------------------------------------------
const db = await startDatabase();
const credentials = await buildSeed(pool, hashPassword);
writeFileSync(CREDENTIALS_FILE, `${JSON.stringify({ ...credentials, anonKey: ANON_KEY, serviceRoleKey: SERVICE_KEY, url: `http://127.0.0.1:${HTTP_PORT}` }, null, 2)}\n`);

// Hosted Supabase keeps idle connections open far longer than Node's 5 second
// default. Matching that avoids clients reusing a socket the server just closed.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(`[http] Local backend on http://127.0.0.1:${HTTP_PORT}`);
  console.log(`[http] Keys and test accounts written to ${CREDENTIALS_FILE}`);
});

async function shutdown() {
  server.close();
  await pool.end().catch(() => {});
  await db.stop().catch(() => {});
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
