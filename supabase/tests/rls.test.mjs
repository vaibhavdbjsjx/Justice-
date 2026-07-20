// ============================================================================
// LexMind RLS verification (Part 10 hard requirement).
//
// Boots a REAL embedded Postgres (no Docker), applies the Supabase auth shim +
// the production migration, then impersonates users via SET LOCAL ROLE +
// request.jwt.claims (exactly how Supabase evaluates RLS) to prove:
//   * a consumer cannot read/alter another consumer's data
//   * a lawyer only sees matters explicitly shared via lawyer_client_links
//   * an UNLINKED lawyer sees none of another lawyer's clients' data
//   * a lawyer cannot self-grant access to a matter
//
// Run: npm run test:rls
// ============================================================================
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const shimSql = readFileSync(join(__dirname, "auth_shim.sql"), "utf8");
// Apply EVERY migration in order, exactly like `supabase db push` would.
const migrationsDir = join(__dirname, "..", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const PORT = 54329;
const DATA_DIR = join(__dirname, ".pgdata");

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${msg}\x1b[0m`);
  }
}

async function main() {
  // Fresh data dir each run.
  rmSync(DATA_DIR, { recursive: true, force: true });

  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: false,
  });

  await server.initialise();
  await server.start();

  const db = new pg.Client({
    host: "127.0.0.1",
    port: PORT,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  });
  await db.connect();

  try {
    console.log("\n\x1b[1mApplying auth shim + migrations…\x1b[0m");
    await db.query(shimSql);
    for (const file of migrationFiles) {
      await db.query(readFileSync(join(migrationsDir, file), "utf8"));
    }
    ok(true, `${migrationFiles.length} migrations + RLS policies applied cleanly`);

    // ---- Fixtures (as superuser — bypasses RLS) --------------------------
    const mkUser = async (email) =>
      (await db.query("insert into auth.users (email) values ($1) returning id", [email]))
        .rows[0].id;

    // handle_new_user trigger auto-creates profiles + subscriptions.
    const A = await mkUser("consumer-a@test.dev");
    const B = await mkUser("consumer-b@test.dev");
    const L = await mkUser("lawyer-l@test.dev");
    const L2 = await mkUser("lawyer-l2@test.dev");

    await db.query("update public.profiles set role='consumer', full_name='Consumer A', country='United States', state_province='California' where user_id=$1", [A]);
    await db.query("update public.profiles set role='consumer', full_name='Consumer B', country='United States', state_province='New York' where user_id=$1", [B]);
    await db.query("update public.profiles set role='lawyer', full_name='Lawyer L' where user_id=$1", [L]);
    await db.query("update public.profiles set role='lawyer', full_name='Lawyer L2' where user_id=$1", [L2]);

    await db.query("insert into public.lawyer_profiles (user_id, verification_status, bar_number) values ($1,'verified','BAR-L'),($2,'verified','BAR-L2')", [L, L2]);

    const matterA = (await db.query(
      "insert into public.matters (user_id, title, category) values ($1,'Landlord dispute','tenant') returning id",
      [A],
    )).rows[0].id;
    const matterB = (await db.query(
      "insert into public.matters (user_id, title, category) values ($1,'Employment contract','employment') returning id",
      [B],
    )).rows[0].id;

    await db.query("insert into public.chat_messages (matter_id, user_id, role, content) values ($1,$2,'user','My landlord wants me out in 7 days.')", [matterA, A]);
    await db.query("insert into public.documents (matter_id, uploaded_by, type, title) values ($1,$2,'uploaded','Lease.pdf')", [matterA, A]);
    await db.query("insert into public.deadlines (matter_id, title, due_date) values ($1,'Respond to notice', current_date + 14)", [matterA]);

    // Consent-based share: client A shares matterA with lawyer L.
    await db.query("insert into public.lawyer_client_links (lawyer_id, client_id, matter_id, status) values ($1,$2,$3,'active')", [L, A, matterA]);

    // ---- Impersonation helper -------------------------------------------
    const asUser = async (userId, fn) => {
      await db.query("begin");
      try {
        await db.query("set local role authenticated");
        await db.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        return await fn((sql, params) => db.query(sql, params));
      } finally {
        await db.query("rollback");
      }
    };
    const countAs = async (userId, sql, params) =>
      asUser(userId, async (q) => (await q(sql, params)).rowCount);
    const expectDenied = async (userId, label, sql, params) =>
      asUser(userId, async (q) => {
        try {
          await q(sql, params);
          ok(false, `${label} (expected RLS to block, but it succeeded)`);
        } catch (e) {
          ok(/row-level security|violates/i.test(e.message), `${label} — blocked (${e.message.split("\n")[0]})`);
        }
      });

    // ---------------------------------------------------------------------
    console.log("\n\x1b[1mConsumer ↔ consumer isolation\x1b[0m");
    ok((await countAs(A, "select 1 from public.matters where id=$1", [matterA])) === 1, "A sees own matterA");
    ok((await countAs(A, "select 1 from public.matters", [])) === 1, "A sees exactly 1 matter (only own)");
    ok((await countAs(B, "select 1 from public.matters where id=$1", [matterA])) === 0, "B cannot see A's matterA");
    ok((await countAs(B, "select 1 from public.chat_messages where matter_id=$1", [matterA])) === 0, "B cannot see A's chat messages");
    ok((await countAs(B, "select 1 from public.documents where matter_id=$1", [matterA])) === 0, "B cannot see A's documents");
    ok((await countAs(B, "select 1 from public.deadlines where matter_id=$1", [matterA])) === 0, "B cannot see A's deadlines");

    console.log("\n\x1b[1mLinked lawyer (L) — shared access only\x1b[0m");
    ok((await countAs(L, "select 1 from public.matters where id=$1", [matterA])) === 1, "L sees shared matterA");
    ok((await countAs(L, "select 1 from public.matters where id=$1", [matterB])) === 0, "L cannot see unshared matterB");
    ok((await countAs(L, "select 1 from public.chat_messages where matter_id=$1", [matterA])) === 1, "L sees matterA chat history");
    ok((await countAs(L, "select 1 from public.documents where matter_id=$1", [matterA])) === 1, "L sees matterA documents");

    console.log("\n\x1b[1mUNLINKED lawyer (L2) — the cross-lawyer firewall\x1b[0m");
    ok((await countAs(L2, "select 1 from public.matters", [])) === 0, "L2 sees no matters at all");
    ok((await countAs(L2, "select 1 from public.chat_messages where matter_id=$1", [matterA])) === 0, "L2 cannot see A's chat (another lawyer's client)");
    ok((await countAs(L2, "select 1 from public.documents where matter_id=$1", [matterA])) === 0, "L2 cannot see A's documents");
    ok((await countAs(L2, "select 1 from public.lawyer_client_links", [])) === 0, "L2 cannot see the A↔L link");

    console.log("\n\x1b[1mprofiles visibility\x1b[0m");
    ok((await countAs(B, "select 1 from public.profiles where user_id=$1", [A])) === 0, "B cannot see A's profile (unrelated consumer)");
    ok((await countAs(B, "select 1 from public.profiles where user_id=$1", [L])) === 1, "B can see verified lawyer L's profile (marketplace)");
    ok((await countAs(A, "select 1 from public.profiles where user_id=$1", [L])) === 1, "A (linked client) can see lawyer L's profile");
    ok((await countAs(L, "select 1 from public.profiles where user_id=$1", [A])) === 1, "L (linked lawyer) can see client A's profile");
    ok((await countAs(L2, "select 1 from public.profiles where user_id=$1", [A])) === 0, "L2 cannot see A's profile (not linked)");

    console.log("\n\x1b[1mlinks & subscriptions\x1b[0m");
    ok((await countAs(A, "select 1 from public.lawyer_client_links", [])) === 1, "A sees own link");
    ok((await countAs(L, "select 1 from public.lawyer_client_links", [])) === 1, "L sees own link");
    ok((await countAs(B, "select 1 from public.subscriptions", [])) === 1, "B sees exactly own subscription");
    ok((await countAs(B, "select 1 from public.subscriptions where user_id=$1", [A])) === 0, "B cannot see A's subscription");

    console.log("\n\x1b[1mWrite-escalation attempts (must be blocked)\x1b[0m");
    await expectDenied(B, "B inserting a message into A's matter",
      "insert into public.chat_messages (matter_id, user_id, role, content) values ($1,$2,'user','sneaky')", [matterA, B]);
    await expectDenied(B, "B spoofing a matter owned by A",
      "insert into public.matters (user_id, title) values ($1,'spoof')", [A]);
    await expectDenied(L2, "L2 self-granting access to A's matter",
      "insert into public.lawyer_client_links (lawyer_id, client_id, matter_id, status) values ($1,$1,$2,'active')", [L2, matterA]);
    await expectDenied(B, "B sharing A's matter without owning it",
      "insert into public.lawyer_client_links (lawyer_id, client_id, matter_id, status) values ($1,$2,$3,'active')", [L, B, matterA]);
    // UPDATE across a boundary with no permissive policy is a no-op (0 rows),
    // not an error — that is still a correct denial of the escalation.
    ok((await asUser(B, async (q) => (await q("update public.matters set title='hijacked' where id=$1", [matterA])).rowCount)) === 0,
      "B updating A's matter affects 0 rows");
    ok((await asUser(B, async (q) => (await q("update public.subscriptions set tier='professional' where user_id=$1", [B])).rowCount)) === 0,
      "B cannot escalate own subscription tier — no write policy, 0 rows");

    console.log("\n\x1b[1mPositive controls (legitimate access must work)\x1b[0m");
    ok((await asUser(A, async (q) => (await q("insert into public.chat_messages (matter_id, user_id, role, content) values ($1,$2,'user','legit') returning id", [matterA, A])).rowCount)) === 1,
      "A can post to own matter");
    ok((await asUser(A, async (q) => (await q("insert into public.lawyer_client_links (lawyer_id, client_id, matter_id, status) values ($1,$2,$3,'invited') returning lawyer_id", [L2, A, matterA])).rowCount)) === 1,
      "A can share own matter with a chosen lawyer (consent path)");
    ok((await countAs(A, "select 1 from public.profiles where user_id=$1", [A])) === 1, "A can read own profile");

    // ---- Phase 8: intake links + communication log ------------------------
    const linkL = (await db.query(
      "insert into public.intake_links (lawyer_id, label) values ($1,'Website footer') returning id, token",
      [L],
    )).rows[0];

    console.log("\n\x1b[1mIntake links (Phase 8) — lawyer-private\x1b[0m");
    ok(linkL.token.length >= 60, "token generated with high entropy in-database");
    ok((await countAs(L, "select 1 from public.intake_links", [])) === 1, "L sees own intake link");
    ok((await countAs(L2, "select 1 from public.intake_links", [])) === 0, "L2 cannot see L's intake links");
    ok((await countAs(A, "select 1 from public.intake_links", [])) === 0, "client A cannot read intake links (tokens resolve server-side only)");
    await expectDenied(B, "consumer B creating an intake link (lawyer-role gate)",
      "insert into public.intake_links (lawyer_id, label) values ($1,'nope')", [B]);
    await expectDenied(L2, "L2 creating a link owned by L",
      "insert into public.intake_links (lawyer_id, label) values ($1,'forged')", [L]);
    ok((await asUser(L2, async (q) => (await q("insert into public.intake_links (lawyer_id, label) values ($1,'L2 site') returning id", [L2])).rowCount)) === 1,
      "L2 can create their own intake link");
    ok((await asUser(L, async (q) => (await q("update public.intake_links set revoked_at=now() where id=$1", [linkL.id])).rowCount)) === 1,
      "L can revoke own link");
    ok((await asUser(L2, async (q) => (await q("update public.intake_links set revoked_at=now() where lawyer_id=$1", [L])).rowCount)) === 0,
      "L2 revoking L's links affects 0 rows");

    console.log("\n\x1b[1mCommunication log (Phase 8) — participants only, append-only\x1b[0m");
    await db.query("insert into public.client_messages (matter_id, sender_id, body) values ($1,$2,'Thanks for reaching out — send the lease when you can.')", [matterA, L]);
    const msgA = (await db.query(
      "insert into public.client_messages (matter_id, sender_id, body) values ($1,$2,'Uploaded! The hearing is on the 14th.') returning id",
      [matterA, A],
    )).rows[0].id;
    ok((await countAs(A, "select 1 from public.client_messages where matter_id=$1", [matterA])) === 2, "client A sees the full thread");
    ok((await countAs(L, "select 1 from public.client_messages where matter_id=$1", [matterA])) === 2, "linked lawyer L sees the full thread");
    ok((await countAs(B, "select 1 from public.client_messages", [])) === 0, "B sees no messages from A's thread");
    ok((await countAs(L2, "select 1 from public.client_messages where matter_id=$1", [matterA])) === 0, "unlinked L2 sees none of the thread");
    ok((await asUser(L, async (q) => (await q("insert into public.client_messages (matter_id, sender_id, body) values ($1,$2,'Noted.') returning id", [matterA, L])).rowCount)) === 1,
      "L can post to the shared thread as themself");
    await expectDenied(L, "L spoofing a message as client A",
      "insert into public.client_messages (matter_id, sender_id, body) values ($1,$2,'spoofed')", [matterA, A]);
    await expectDenied(B, "outsider B posting into A's thread",
      "insert into public.client_messages (matter_id, sender_id, body) values ($1,$2,'intruding')", [matterA, B]);
    // No UPDATE/DELETE grant exists at all — stronger than an RLS no-op.
    await asUser(A, async (q) => {
      try {
        await q("update public.client_messages set body='rewritten' where id=$1", [msgA]);
        ok(false, "sender rewriting the log (expected permission denied)");
      } catch (e) {
        ok(/permission denied/i.test(e.message), "even the sender cannot rewrite the log — no UPDATE grant");
      }
    });
    await asUser(A, async (q) => {
      try {
        await q("delete from public.client_messages where id=$1", [msgA]);
        ok(false, "sender deleting from the log (expected permission denied)");
      } catch (e) {
        ok(/permission denied/i.test(e.message), "even the sender cannot delete from the log — no DELETE grant");
      }
    });

    // ---- Phase 9: marketplace — verification is not self-serviceable ------
    console.log("\n\x1b[1mMarketplace (Phase 9) — column-level verification protection\x1b[0m");
    const L3 = await mkUser("lawyer-l3@test.dev");
    await db.query("update public.profiles set role='lawyer', full_name='Lawyer L3' where user_id=$1", [L3]);

    const denyColumn = async (userId, label, sql, params) =>
      asUser(userId, async (q) => {
        try {
          await q(sql, params);
          ok(false, `${label} (expected permission denied)`);
        } catch (e) {
          ok(/permission denied/i.test(e.message), `${label} — blocked (column grant)`);
        }
      });

    ok((await asUser(L, async (q) => (await q("update public.lawyer_profiles set bio='Tenant law, 15 years.', rate_range='$200-300/hr' where user_id=$1", [L])).rowCount)) === 1,
      "L can edit own marketplace profile (bio, rate)");
    await denyColumn(L, "L self-setting verification_status='verified'",
      "update public.lawyer_profiles set verification_status='verified' where user_id=$1", [L]);
    await denyColumn(L, "L inflating own rating_avg",
      "update public.lawyer_profiles set rating_avg=5.0 where user_id=$1", [L]);
    ok((await asUser(L3, async (q) => (await q("insert into public.lawyer_profiles (user_id, practice_areas, bar_number) values ($1,'[\"Family\"]'::jsonb,'BAR-L3') returning user_id", [L3])).rowCount)) === 1,
      "L3 can create own lawyer profile (allowed columns)");
    await denyColumn(L3, "L3 inserting a pre-verified profile",
      "update public.lawyer_profiles set verification_status='verified' where user_id=$1", [L3]);
    ok((await asUser(L3, async (q) => (await q("insert into public.lawyer_profiles (user_id, practice_areas) values ($1,'[\"Estate\"]'::jsonb) on conflict (user_id) do update set practice_areas=excluded.practice_areas returning user_id", [L3])).rowCount)) === 1,
      "onboarding-style upsert still works for allowed columns");
    ok((await countAs(A, "select 1 from public.lawyer_profiles where user_id=$1", [L3])) === 0,
      "consumer cannot see L3's UNVERIFIED profile (not in marketplace)");
    ok((await countAs(A, "select 1 from public.lawyer_profiles where user_id=$1", [L])) === 1,
      "consumer sees verified L in the marketplace");

    console.log("\n\x1b[1mUnauthenticated (no claims) sees nothing\x1b[0m");
    await db.query("begin");
    await db.query("set local role authenticated");
    const anonRows = (await db.query("select 1 from public.matters")).rowCount;
    await db.query("rollback");
    ok(anonRows === 0, "no auth.uid() → 0 matters visible");
  } finally {
    await db.end();
    await server.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
  }

  console.log(`\n\x1b[1mRLS results:\x1b[0m ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\x1b[31mFATAL\x1b[0m", e);
  process.exit(1);
});
