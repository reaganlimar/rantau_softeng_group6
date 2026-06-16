const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const port = Number(process.env.PORT || 4173);
const root = __dirname;
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "rantau.sqlite");
let database;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      token TEXT,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function userFromRow(row) {
  if (!row) return null;
  return {
    username: row.username,
    password: row.password,
    token: row.token,
    state: JSON.parse(row.state_json)
  };
}

function getUserByUsername(username) {
  return userFromRow(database.prepare("SELECT * FROM users WHERE username = ?").get(username));
}

function getUserByToken(token) {
  return userFromRow(database.prepare("SELECT * FROM users WHERE token = ?").get(token));
}

function insertUser(username, password, token, state) {
  database.prepare(`
    INSERT INTO users (username, password, token, state_json)
    VALUES (?, ?, ?, ?)
  `).run(username, password, token, JSON.stringify(state));
}

function updateUser(username, values) {
  database.prepare(`
    UPDATE users
    SET password = ?, token = ?, state_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `).run(values.password, values.token, JSON.stringify(values.state), username);
}

function renameUser(oldUsername, newUsername) {
  database.prepare(`
    UPDATE users
    SET username = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `).run(newUsername, oldUsername);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function publicState(user) {
  const state = structuredClone(user.state);
  state.profile.password = "";
  return state;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readBody(req);
    const { state } = body;
    const username = state?.profile?.username?.trim();
    const password = state?.profile?.password?.trim();
    if (!username || !password) return sendJson(res, 400, { error: "Username and password are required." });

    if (getUserByUsername(username)) return sendJson(res, 409, { error: "Username already exists." });

    const token = randomUUID();
    const user = {
      username,
      password,
      token,
      state: {
        ...state,
        isLoggedIn: true
      }
    };
    insertUser(username, password, token, user.state);
    return sendJson(res, 201, { token, state: publicState(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const username = body.username?.trim();
    const password = body.password?.trim();
    const user = getUserByUsername(username);
    if (!user || user.password !== password) return sendJson(res, 401, { error: "Invalid username or password." });

    user.token = randomUUID();
    user.state.isLoggedIn = true;
    updateUser(username, user);
    return sendJson(res, 200, { token: user.token, state: publicState(user) });
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = getUserByToken(token);
    if (!user) return sendJson(res, 401, { error: "Not logged in." });
    return sendJson(res, 200, { state: publicState(user) });
  }

  if (req.method === "PUT" && url.pathname === "/api/state") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const body = await readBody(req);
    const user = getUserByToken(token);
    if (!user) return sendJson(res, 401, { error: "Not logged in." });

    const username = user.username;
    const nextState = body.state;
    if (!nextState) return sendJson(res, 400, { error: "State is required." });

    user.state = {
      ...nextState,
      isLoggedIn: true,
      profile: {
        ...nextState.profile,
        password: user.password
      }
    };
    if (nextState.profile?.username && nextState.profile.username !== username) {
      const newUsername = nextState.profile.username;
      if (getUserByUsername(newUsername)) return sendJson(res, 409, { error: "Username already exists." });
      renameUser(username, newUsername);
      user.username = newUsername;
    }
    updateUser(user.username, user);
    return sendJson(res, 200, { state: publicState(user) });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestPath = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(root, requestPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(await fs.readFile(filePath));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) return await handleApi(req, res);
    return await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Server error." });
  }
});

ensureDb().then(() => {
  server.listen(port, () => {
    console.log(`RantaU running at http://127.0.0.1:${port}`);
  });
});
