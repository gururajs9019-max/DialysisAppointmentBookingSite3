import { createServer } from "node:http";
import { createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { createServer as createViteServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be configured before starting the appointment service.");
}

const schemaPromise = pool.query(`
  CREATE TABLE IF NOT EXISTS dialysis_appointments (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS portal_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor', 'admin')),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);
let staffUsersPromise;

const requiredFields = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "phone",
  "email",
  "medicalId",
  "appointmentDate",
  "appointmentTime",
  "dialysisType",
];

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function passwordsMatch(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = Buffer.from(hashPassword(password, salt).split(":")[1], "hex");
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function ensureStaffUsers() {
  if (!staffUsersPromise) {
    staffUsersPromise = (async () => {
      await schemaPromise;
      const accounts = [
        { username: "admin1", email: "admin1@kmcri.test", name: "Priya Sharma", role: "admin", password: process.env.STAFF_ADMIN_PASSWORD },
        { username: "doctor1", email: "doctor@kmcri.test", name: "Dr. Rajesh Verma", role: "doctor", password: process.env.STAFF_DOCTOR_PASSWORD },
      ].filter((account) => typeof account.password === "string" && account.password.length >= 12);
      for (const account of accounts) {
        await pool.query(
          `INSERT INTO portal_users (id, username, email, name, role, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE
           SET username = EXCLUDED.username,
               name = EXCLUDED.name,
               role = EXCLUDED.role,
               password_hash = EXCLUDED.password_hash`,
          [randomUUID(), account.username, account.email, account.name, account.role, hashPassword(account.password)],
        );
      }
    })();
  }
  await staffUsersPromise;
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function sessionCookie(user) {
  const value = signSession({ userId: user.id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return `kmcri_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${8 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function clearSessionCookie() {
  return "kmcri_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(";") ?? [];
  const found = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
  return found ? found.trim().slice(name.length + 1) : null;
}

async function getSessionUser(req) {
  const token = getCookie(req, "kmcri_session");
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.userId || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
    const result = await pool.query(
      "SELECT id, username, email, name, role FROM portal_users WHERE id = $1",
      [payload.userId],
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

async function requireStaff(req) {
  const user = await getSessionUser(req);
  if (!user) throw createHttpError(401, "Sign in is required to access saved appointments.");
  if (!["doctor", "admin"].includes(user.role)) throw createHttpError(403, "Your account is not authorised to access saved appointments.");
  return user;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "Unknown storage error";
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function validateAppointment(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Appointment data must be an object";
  }
  const missing = requiredFields.filter(
    (field) => typeof data[field] !== "string" || data[field].trim() === "",
  );
  return missing.length ? `Missing required fields: ${missing.join(", ")}` : null;
}

async function listAppointments() {
  await schemaPromise;
  const result = await pool.query(
    "SELECT data FROM dialysis_appointments ORDER BY (data->>'appointmentDate') ASC, (data->>'appointmentTime') ASC, created_at ASC",
  );
  return result.rows.map((row) => row.data);
}

async function loginStaff(input) {
  await ensureStaffUsers();
  if (!input || typeof input !== "object") throw createHttpError(400, "Login details are required.");
  const { role, identifier, password } = input;
  if (!["doctor", "admin"].includes(role) || typeof identifier !== "string" || typeof password !== "string") {
    throw createHttpError(400, "A staff role, username or email, and password are required.");
  }
  const result = await pool.query(
    `SELECT id, username, email, name, role, password_hash
     FROM portal_users
     WHERE role = $1 AND (username = $2 OR LOWER(email) = LOWER($2))`,
    [role, identifier.trim()],
  );
  const user = result.rows[0];
  if (!user || !passwordsMatch(password, user.password_hash)) {
    throw createHttpError(401, "Invalid username or password.");
  }
  return user;
}

async function createAppointment(input) {
  await schemaPromise;
  const validationError = validateAppointment(input);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const appointment = {
    ...input,
    id: randomUUID(),
    status: "upcoming",
    createdAt: now,
    location: typeof input.location === "string" && input.location.trim()
      ? input.location
      : "KMC-RI Hospital Dialysis Centre",
  };
  appointment.patientName = `${appointment.firstName} ${appointment.lastName}`.trim();
  appointment.patientMRN = appointment.medicalId;

  await pool.query(
    `INSERT INTO dialysis_appointments (id, data, status)
     VALUES ($1, $2::jsonb, $3)`,
    [appointment.id, appointment, appointment.status],
  );
  return appointment;
}

async function updateAppointment(id, updates) {
  await schemaPromise;
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    const error = new Error("Appointment changes must be an object");
    error.statusCode = 400;
    throw error;
  }
  const allowed = ["status", "appointmentDate", "appointmentTime", "dialysisType", "notes", "location"];
  const changes = Object.fromEntries(
    Object.entries(updates).filter(([key, value]) => allowed.includes(key) && typeof value === "string"),
  );
  if (changes.status && !["upcoming", "completed", "cancelled"].includes(changes.status)) {
    const error = new Error("Invalid appointment status");
    error.statusCode = 400;
    throw error;
  }
  if (!Object.keys(changes).length) {
    const error = new Error("No supported appointment changes were provided");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE dialysis_appointments
     SET data = data || $2::jsonb,
         status = COALESCE($3, status),
         updated_at = NOW()
     WHERE id = $1
     RETURNING data`,
    [id, changes, changes.status || null],
  );
  if (!result.rowCount) {
    const error = new Error("Appointment was not found");
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0].data;
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const user = await loginStaff(await readJson(req));
      const { password_hash, ...safeUser } = user;
      sendJson(res, 200, { user: safeUser }, { "Set-Cookie": sessionCookie(user) });
    } catch (error) {
      const status = error.statusCode || 503;
      sendJson(res, status, { error: errorMessage(error) });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    sendJson(res, 204, {}, { "Set-Cookie": clearSessionCookie() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/appointments") {
    try {
      await requireStaff(req);
      sendJson(res, 200, { appointments: await listAppointments() });
    } catch (error) {
      const status = error.statusCode || 503;
      if (status >= 500) console.error("Appointment load failed:", error);
      sendJson(res, status, { error: `Unable to load appointments: ${errorMessage(error)}` });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/appointments") {
    try {
      await requireStaff(req);
      sendJson(res, 201, { appointment: await createAppointment(await readJson(req)) });
    } catch (error) {
      const status = error.statusCode || 503;
      console.error("Appointment save failed:", error);
      sendJson(res, status, { error: `Unable to save appointment: ${errorMessage(error)}` });
    }
    return true;
  }

  const match = url.pathname.match(/^\/api\/appointments\/([^/]+)$/);
  if (req.method === "PATCH" && match) {
    try {
      await requireStaff(req);
      sendJson(res, 200, { appointment: await updateAppointment(decodeURIComponent(match[1]), await readJson(req)) });
    } catch (error) {
      const status = error.statusCode || 503;
      console.error("Appointment update failed:", error);
      sendJson(res, status, { error: `Unable to update appointment: ${errorMessage(error)}` });
    }
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "API route not found" });
    return true;
  }
  return false;
}

async function start() {
  let vite;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (await handleApi(req, res, url)) return;

    vite.middlewares(req, res, async () => {
      if (res.writableEnded) return;
      if (process.env.NODE_ENV === "production") {
        const requestedPath = normalize(join(__dirname, "..", "dist", url.pathname === "/" ? "index.html" : url.pathname));
        const distRoot = normalize(join(__dirname, "..", "dist"));
        if (requestedPath.startsWith(distRoot)) {
          try {
            const content = await readFile(requestedPath);
            res.end(content);
            return;
          } catch {
            const content = await readFile(join(distRoot, "index.html"));
            res.end(content);
            return;
          }
        }
      }
      res.statusCode = 404;
      res.end("Not found");
    });
  });

  vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "spa",
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Dialysis appointment server listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Unable to start application:", error);
  process.exitCode = 1;
});