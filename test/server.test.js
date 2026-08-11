const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PROJECT_ROOT = path.join(__dirname, "..");

async function startServer() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "finance-dashboard-test-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "0",
      DATA_DIR: dataDir,
      MAX_JSON_BODY_BYTES: "1024"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start. ${stderr}`)), 10_000);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited with code ${code}. ${stderr}`));
    });
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(`http://127.0.0.1:${match[1]}`);
    });
  });

  return {
    baseUrl,
    dataDir,
    async stop() {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  };
}

function cookieFrom(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] || "";
}

test("auth, holdings, security, and static responses", async (t) => {
  const server = await startServer();
  t.after(() => server.stop());
  const request = (pathname, options = {}) => fetch(`${server.baseUrl}${pathname}`, options);

  const status = await request("/api/auth/status");
  assert.equal(status.status, 200);
  assert.equal(status.headers.get("x-content-type-options"), "nosniff");
  assert.equal(status.headers.get("x-frame-options"), "DENY");
  assert.deepEqual(await status.json(), {
    authenticated: false,
    hasUsers: false,
    recoveryEnabled: false,
    user: null
  });

  const blocked = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.com" },
    body: JSON.stringify({ username: "owner", password: "password123" })
  });
  assert.equal(blocked.status, 403);

  const registered = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.baseUrl },
    body: JSON.stringify({ username: "owner", password: "password123" })
  });
  assert.equal(registered.status, 200);
  const cookie = cookieFrom(registered);
  assert.match(registered.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);

  const created = await request("/api/holdings", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: server.baseUrl },
    body: JSON.stringify({ category: "cash", name: "Checking", amount: 1250 })
  });
  assert.equal(created.status, 200);
  const holdings = await created.json();
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].name, "Checking");

  const missingDelete = await request("/api/holdings/not-a-real-id", {
    method: "DELETE",
    headers: { cookie, origin: server.baseUrl }
  });
  assert.equal(missingDelete.status, 404);

  const afterMissingDelete = await request("/api/holdings", { headers: { cookie } });
  assert.equal((await afterMissingDelete.json()).length, 1);

  const oversized = await request("/api/holdings", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: server.baseUrl },
    body: JSON.stringify({ category: "cash", name: "x".repeat(1500) })
  });
  assert.equal(oversized.status, 413);

  const missingAsset = await request("/missing.js");
  assert.equal(missingAsset.status, 404);
  assert.equal(await missingAsset.text(), "Not found");

  const unauthenticatedReset = await request("/api/auth/reset-all-accounts", {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.baseUrl },
    body: JSON.stringify({ confirm: "DELETE ACCOUNTS" })
  });
  assert.equal(unauthenticatedReset.status, 401);

  const reset = await request("/api/auth/reset-all-accounts", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: server.baseUrl },
    body: JSON.stringify({ confirm: "DELETE ACCOUNTS" })
  });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { authenticated: false, hasUsers: false });
});
