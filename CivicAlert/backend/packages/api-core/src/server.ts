import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomInt } from "node:crypto";
import { database, findActorForToken, hashPassword, issueSession, seedDemoAccounts, verifyPassword, type Actor } from "./database.js";

type Portal = "resident" | "cepalco" | "water";
type Locals = { actor?: Actor };
type Row = Record<string, unknown>;
const utilities: Record<Exclude<Portal, "resident">, string> = { cepalco: "CEPALCO", water: "Water District" };

function required(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value.trim();
}

function publicActor(actor: Actor) {
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    utility: actor.utility,
    phoneNumber: actor.phone_number ?? "",
    address: actor.address ?? "",
    barangay: actor.barangay ?? "",
    district: actor.district ?? "",
    city: actor.city ?? "",
    postalCode: actor.postal_code ?? "",
    profileImage: actor.profile_image ?? null,
    smsAlerts: Boolean(actor.sms_alerts),
    maintenanceAlerts: Boolean(actor.notify_maintenance),
    emailDigest: Boolean(actor.notify_email_digest),
  };
}

function decorateRows<T extends Row>(rows: T[]): T[] {
  return rows.map(row => {
    const decorated: Row = { ...row };
    for (const [key, value] of Object.entries(row)) {
      const outputKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
      decorated[outputKey] = value;
    }
    return decorated as T;
  });
}

export function createApi(portal: Portal) {
  seedDemoAccounts();
  const app = express();
  app.disable("x-powered-by");
  const configuredOrigins = process.env.CORS_ORIGIN?.split(",").map(origin => origin.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => {
      const localDevelopmentOrigin = process.env.NODE_ENV !== "production" && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin || "");
      if (!origin || (configuredOrigins ? configuredOrigins.includes(origin) : localDevelopmentOrigin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) => res.json({ ok: true, portal, service: "CivicAlert API" }));
  app.get("/content", (_req, res) => {
    const rows = database.prepare("SELECT content_key, content_value FROM ui_copy ORDER BY content_key").all() as Array<{ content_key: string; content_value: string }>;
    const settings = database.prepare("SELECT settings_json FROM portal_settings WHERE portal = ?").get(portal) as { settings_json: string } | undefined;
    if (!settings) return res.status(500).json({ error: `Portal content for ${portal} is unavailable.` });
    return res.json({ copy: Object.fromEntries(rows.map(row => [row.content_key, row.content_value])), settings: JSON.parse(settings.settings_json) });
  });
  if (portal === "resident") {
    app.get("/auth/me", authenticate("resident"), (_req, res: Response<unknown, Locals>) => res.json({ actor: publicActor(res.locals.actor!) }));
  } else {
    app.get("/auth/me", requireUtility(utilities[portal]), (_req, res: Response<unknown, Locals>) => res.json({ actor: publicActor(res.locals.actor!) }));
  }
  app.post("/auth/login", (req, res) => {
    try {
      const email = required(req.body?.email, "Email").toLowerCase();
      const password = required(req.body?.password, "Password");
      const expectedRole = portal === "resident" ? "resident" : "admin";
      const user = database.prepare("SELECT id, name, email, password_hash, role, utility, phone_number, address, barangay, district, city, postal_code, profile_image, sms_alerts, notify_maintenance, notify_email_digest, terms_accepted_at FROM users WHERE email = ? AND role = ? AND (utility IS ? OR utility = ?)").get(
        email, expectedRole, portal === "resident" ? null : utilities[portal], portal === "resident" ? "" : utilities[portal],
      ) as (Actor & { password_hash: string }) | undefined;
      if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: "Email or password is incorrect." });
      const { password_hash: _secret, ...actor } = user;
      return res.json({ token: issueSession(user.id), actor: publicActor(actor) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid sign-in request." });
    }
  });

  if (portal === "resident") {
    app.patch("/auth/profile", authenticate("resident"), (req, res: Response<unknown, Locals>) => {
      try {
        const name = required(req.body?.name, "Full name");
        const email = required(req.body?.email, "Email").toLowerCase();
        const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
        const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
        const barangay = typeof req.body?.barangay === "string" ? req.body.barangay.trim() : "";
        const district = typeof req.body?.district === "string" ? req.body.district.trim() : "";
        const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
        const postalCode = typeof req.body?.postalCode === "string" ? req.body.postalCode.trim() : "";
        const smsAlerts = typeof req.body?.smsAlerts === "boolean" ? Number(req.body.smsAlerts) : res.locals.actor!.sms_alerts ?? 1;
        const maintenanceAlerts = typeof req.body?.maintenanceAlerts === "boolean" ? Number(req.body.maintenanceAlerts) : res.locals.actor!.notify_maintenance ?? 1;
        const emailDigest = typeof req.body?.emailDigest === "boolean" ? Number(req.body.emailDigest) : res.locals.actor!.notify_email_digest ?? 1;
        const profileImage = req.body?.profileImage;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
        if (phoneNumber.length > 40 || address.length > 240 || barangay.length > 100 || district.length > 80 || city.length > 100 || postalCode.length > 20 || name.length > 120) {
          return res.status(400).json({ error: "One or more profile fields are too long." });
        }
        if (profileImage !== null && profileImage !== undefined &&
            (typeof profileImage !== "string" || profileImage.length > 1_500_000 ||
             !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profileImage))) {
          return res.status(400).json({ error: "Choose a JPEG, PNG, or WebP profile image under 1 MB." });
        }
        const imageToSave = profileImage === undefined ? res.locals.actor!.profile_image ?? null : profileImage;
        const result = database.prepare(`
          UPDATE users SET name = ?, email = ?, phone_number = ?, address = ?, barangay = ?, district = ?, city = ?, postal_code = ?, profile_image = ?, sms_alerts = ?, notify_maintenance = ?, notify_email_digest = ?
          WHERE id = ? AND role = 'resident'
        `).run(name, email, phoneNumber, address, barangay, district, city, postalCode, imageToSave, smsAlerts, maintenanceAlerts, emailDigest, res.locals.actor!.id);
        if (!Number(result.changes)) return res.status(404).json({ error: "Resident account not found." });
        const actor = database.prepare("SELECT id, name, email, role, utility, phone_number, address, barangay, district, city, postal_code, profile_image, sms_alerts, notify_maintenance, notify_email_digest, terms_accepted_at FROM users WHERE id = ?").get(res.locals.actor!.id) as Actor;
        return res.json({ actor: publicActor(actor) });
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint")) return res.status(409).json({ error: "An account with this email already exists." });
        return res.status(400).json({ error: error instanceof Error ? error.message : "Could not update resident profile." });
      }
    });
    app.post("/auth/password", authenticate("resident"), (req, res: Response<unknown, Locals>) => {
      try {
        const currentPassword = required(req.body?.currentPassword, "Current password");
        const newPassword = required(req.body?.newPassword, "New password");
        if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
        const user = database.prepare("SELECT password_hash FROM users WHERE id = ? AND role = 'resident'").get(res.locals.actor!.id) as { password_hash: string } | undefined;
        if (!user || !verifyPassword(currentPassword, user.password_hash)) return res.status(401).json({ error: "Current password is incorrect." });
        if (verifyPassword(newPassword, user.password_hash)) return res.status(400).json({ error: "Choose a password you have not used before." });
        database.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), res.locals.actor!.id);
        return res.json({ ok: true });
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "Could not change password." });
      }
    });
    app.post("/auth/register", (req, res) => {
      try {
        const name = required(req.body?.name, "Name");
        const email = required(req.body?.email, "Email").toLowerCase();
        const password = required(req.body?.password, "Password");
        const phoneNumber = required(req.body?.phoneNumber, "Mobile telephone");
        const address = required(req.body?.address, "Street address");
        const barangay = required(req.body?.barangay, "Barangay");
        const district = required(req.body?.district, "District");
        const city = required(req.body?.city, "City");
        const postalCode = required(req.body?.postalCode, "Postal code");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
        if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
        if (name.length > 120 || phoneNumber.length > 40 || address.length > 240 || barangay.length > 100 || district.length > 80 || city.length > 100 || postalCode.length > 20) {
          return res.status(400).json({ error: "One or more registration fields are too long." });
        }
        if (req.body?.termsAccepted !== true) return res.status(400).json({ error: "Please accept the resident terms and privacy policy." });
        const smsAlerts = req.body?.smsAlerts === false ? 0 : 1;
        const id = Number(database.prepare(`
          INSERT INTO users (name, email, password_hash, role, utility, phone_number, address, barangay, district, city, postal_code, sms_alerts, terms_accepted_at)
          VALUES (?, ?, ?, 'resident', NULL, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(name, email, hashPassword(password), phoneNumber, address, barangay, district, city, postalCode, smsAlerts).lastInsertRowid);
        const actor: Actor = { id, name, email, role: "resident", utility: null, phone_number: phoneNumber, address, barangay, district, city, postal_code: postalCode, sms_alerts: smsAlerts, notify_maintenance: 1, notify_email_digest: 1 };
        return res.status(201).json({ token: issueSession(id), actor: publicActor(actor) });
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint")) return res.status(409).json({ error: "An account with this email already exists." });
        return res.status(400).json({ error: error instanceof Error ? error.message : "Could not create account." });
      }
    });
    app.get("/advisories", (_req, res) => res.json(decorateRows(database.prepare("SELECT id, reference, title, utility, type, area, status, details, created_at FROM advisories ORDER BY id DESC").all() as Row[])));
    app.get("/work-orders", (_req, res) => {
      const rows = database.prepare("SELECT id, reference, title, utility, area, status, starts_at, ends_at FROM work_orders ORDER BY starts_at").all() as Row[];
      return res.json(decorateRows(rows));
    });
    app.post("/reports", authenticate("resident"), (req, res: Response<unknown, Locals>) => {
      try {
        const utility = required(req.body?.utility, "Utility");
        if (!["CEPALCO", "Water District"].includes(utility)) return res.status(400).json({ error: "Choose a valid utility." });
        const title = required(req.body?.issue, "Issue");
        const area = required(req.body?.area, "Service area");
        const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
        const reference = `CAS-R-${Date.now().toString(36).toUpperCase()}${randomInt(10, 99)}`;
        const id = Number(database.prepare("INSERT INTO reports (reference, user_id, title, utility, area, details) VALUES (?, ?, ?, ?, ?, ?)").run(reference, res.locals.actor!.id, title, utility, area, details).lastInsertRowid);
        return res.status(201).json({ id, reference, title, utility, area, details, status: "Received" });
      } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Could not submit report." }); }
    });
    app.get("/reports/mine", authenticate("resident"), (_req, res: Response<unknown, Locals>) => {
      const rows = database.prepare("SELECT id, reference, title, utility, area, status, created_at FROM reports WHERE user_id = ? ORDER BY id DESC").all(res.locals.actor!.id) as Row[];
      return res.json(decorateRows(rows));
    });
  } else {
    const utility = utilities[portal];
    app.get("/advisories", requireUtility(utility), (_req, res) => {
      const rows = database.prepare("SELECT id, reference, title, utility, type, area, status, details, created_at FROM advisories WHERE utility = ? ORDER BY id DESC").all(utility) as Row[];
      return res.json(decorateRows(rows));
    });
    app.post("/advisories", requireUtility(utility), (req, res) => {
      try {
        const title = required(req.body?.title, "Advisory title");
        const area = required(req.body?.area, "Affected service area");
        const details = required(req.body?.details, "Public update");
        const type = typeof req.body?.type === "string" ? req.body.type : "Service disruption";
        const reference = `${portal === "water" ? "WD" : "CE"}-${Date.now().toString(36).toUpperCase()}`;
        const id = Number(database.prepare("INSERT INTO advisories (reference, title, utility, type, area, details) VALUES (?, ?, ?, ?, ?, ?)").run(reference, title, utility, type, area, details).lastInsertRowid);
        return res.status(201).json({ id, reference, title, utility, type, area, status: "Monitoring", details });
      } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Could not publish advisory." }); }
    });
    app.patch("/advisories/:id/status", requireUtility(utility), (req, res) => {
      const status = req.body?.status;
      if (!["Monitoring", "Under investigation", "Crew dispatched", "Resolved"].includes(status)) return res.status(400).json({ error: "Unsupported advisory status." });
      const result = database.prepare("UPDATE advisories SET status = ? WHERE id = ? AND utility = ?").run(status, Number(req.params.id), utility);
      return Number(result.changes) ? res.json({ ok: true }) : res.status(404).json({ error: "Advisory not found." });
    });
    app.get("/work-orders", requireUtility(utility), (_req, res) => {
      const rows = database.prepare("SELECT id, reference, title, utility, area, status, starts_at, ends_at FROM work_orders WHERE utility = ? ORDER BY starts_at").all(utility) as Row[];
      return res.json(decorateRows(rows));
    });
    app.post("/work-orders", requireUtility(utility), (req, res) => {
      try {
        const title = required(req.body?.title, "Work order title");
        const area = required(req.body?.area, "Affected service area");
        const startsAt = required(req.body?.startsAt, "Start time");
        const endsAt = required(req.body?.endsAt, "End time");
        const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
        if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) return res.status(400).json({ error: "End time must be later than start time." });
        const reference = `${portal === "water" ? "WD" : "CE"}-WO-${Date.now().toString(36).toUpperCase()}`;
        const id = Number(database.prepare("INSERT INTO work_orders (reference, title, utility, area, description, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(reference, title, utility, area, description, startsAt, endsAt).lastInsertRowid);
        return res.status(201).json({ id, reference, title, utility, area, description, startsAt, endsAt, status: "Scheduled" });
      } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Could not create work order." }); }
    });
    app.get("/reports", requireUtility(utility), (_req, res) => {
      const rows = database.prepare("SELECT id, reference, title, utility, area, status, created_at FROM reports WHERE utility = ? ORDER BY id DESC").all(utility) as Row[];
      return res.json(decorateRows(rows));
    });
    app.patch("/reports/:id/status", requireUtility(utility), (req, res) => {
      const status = req.body?.status;
      if (!["Received", "Under investigation", "Crew dispatched", "Resolved"].includes(status)) return res.status(400).json({ error: "Unsupported report status." });
      const result = database.prepare("UPDATE reports SET status = ? WHERE id = ? AND utility = ?").run(status, Number(req.params.id), utility);
      return Number(result.changes) ? res.json({ ok: true }) : res.status(404).json({ error: "Report not found." });
    });
    if (portal === "water") {
      app.get("/network", requireUtility(utility), (_req, res) => {
        const rows = database.prepare("SELECT district, area, pressure_psi, reservoir_percent, recorded_at FROM network_readings WHERE utility = ? ORDER BY id").all(utility) as Row[];
        return res.json(decorateRows(rows));
      });
    }
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${portal}-api]`, error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  });
  return app;
}

function authenticate(expectedRole: Actor["role"]) {
  return (req: Request, res: Response<unknown, Locals>, next: NextFunction) => {
    const authorization = req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const actor = token ? findActorForToken(token) : undefined;
    if (!actor || actor.role !== expectedRole) return res.status(401).json({ error: "Please sign in to continue." });
    res.locals.actor = actor;
    next();
  };
}

function requireUtility(utility: string) {
  return (req: Request, res: Response<unknown, Locals>, next: NextFunction) => {
    const authorization = req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const actor = token ? findActorForToken(token) : undefined;
    if (!actor || actor.role !== "admin" || actor.utility !== utility) return res.status(401).json({ error: "A matching utility administrator must sign in." });
    res.locals.actor = actor;
    next();
  };
}
