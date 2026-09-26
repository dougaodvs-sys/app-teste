import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// Configuration & Constants
// =========================
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "studio_aurea_jwt_secret_dev_2026";
const ACCESS_MIN = 60 * 12; // 12 hours
const REFRESH_DAYS = 7;
const DEFAULT_STUDIO_ID = "default-studio";
const UPLOAD_DIR = path.resolve(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const user = (req as any).user;
    const studioSlug = user?.studio_id || "studio-aurea";
    const dest = path.join(UPLOAD_DIR, studioSlug, "logos");
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({ storage });

function uid(): string {
  return crypto.randomUUID();
}

function nowUtc(): string {
  return new Date().toISOString();
}

function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

function verifyPassword(pw: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(pw, hash);
  } catch {
    return false;
  }
}

function normPhone(v?: string | null): string {
  let d = (v || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) {
    d = d.substring(2);
  }
  return d;
}

function waPhone(raw?: string | null): string {
  let phone = (raw || "").replace(/\D/g, "");
  if (phone && !phone.startsWith("55") && phone.length <= 11) {
    phone = "55" + phone;
  }
  return phone;
}

const BR_TZ_OFFSET = -3;
function toBrDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getTime() + BR_TZ_OFFSET * 60 * 60 * 1000);
}

function fmtBr(iso: string): string {
  const d = toBrDate(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} às ${hours}:${mins}`;
}

// =========================
// In-Memory Database + Seed
// =========================
interface DBStore {
  studios: any[];
  users: any[];
  professionals: any[];
  services: any[];
  settings: any[];
  gallery: any[];
  blocks: any[];
  coupons: any[];
  appointments: any[];
  notifications: any[];
  login_events: any[];
  password_reset_tokens: any[];
}

const DATA_FILE = path.resolve(__dirname, "db_data.json");

function loadDb(): DBStore {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch {
      // fallback
    }
  }

  const defaultStudio = {
    id: DEFAULT_STUDIO_ID,
    name: "Studio Aurea",
    slug: "studio-aurea",
    active: true,
    license_expires_at: null,
    created_at: nowUtc(),
  };

  const meuStudio = {
    id: "studio-meu-id",
    name: "Meu Studio",
    slug: "meu-studio",
    active: true,
    license_expires_at: "2030-01-01T00:00:00Z",
    created_at: nowUtc(),
  };

  // Seed users:
  const superAdmin = {
    id: "user-super-admin-id",
    name: "Douglas (Super Admin)",
    email: "dvssystem@hotmail.com",
    phone: "",
    phone_digits: "",
    password_hash: hashPassword("Douglas0101"),
    role: "super_admin",
    studio_id: null,
    created_at: nowUtc(),
  };

  const managerMeuStudio = {
    id: "user-manager-meu-id",
    name: "Gerente Meu Studio",
    email: "gerente@meustudio.com",
    phone: "11999990000",
    phone_digits: "11999990000",
    password_hash: hashPassword("Studio@2026"),
    role: "manager",
    studio_id: "studio-meu-id",
    created_at: nowUtc(),
  };

  const proAna = {
    id: "pro-ana-id",
    name: "Ana Souza",
    email: "ana@meustudio.com",
    phone: "11988889999",
    phone_digits: "11988889999",
    password_hash: hashPassword("Pro@2026xx"),
    role: "professional",
    studio_id: "studio-meu-id",
    created_at: nowUtc(),
  };

  const clientCarla = {
    id: "client-carla-id",
    name: "Carla Dias",
    email: "carla@exemplo.com",
    phone: "11988887777",
    phone_digits: "11988887777",
    password_hash: hashPassword("Cliente@2026"),
    role: "client",
    studio_id: "studio-meu-id",
    referral_code: "CARLA1020",
    referral_rewarded: false,
    created_at: nowUtc(),
  };

  const managerStudioAurea = {
    id: "user-manager-aurea-id",
    name: "Gerente Studio Aurea",
    email: "gerente@studio.com",
    phone: "11988880000",
    phone_digits: "11988880000",
    password_hash: hashPassword("Studio@2026"),
    role: "manager",
    studio_id: DEFAULT_STUDIO_ID,
    created_at: nowUtc(),
  };

  const proPatricia = {
    id: "pro-patricia-id",
    name: "Patrícia Lima",
    email: "patricia@studio.com",
    phone: "11977778888",
    phone_digits: "11977778888",
    password_hash: hashPassword("Pro@2026xx"),
    role: "professional",
    studio_id: DEFAULT_STUDIO_ID,
    created_at: nowUtc(),
  };

  const svcDesignSobrancelha = {
    id: "svc-sobrancelha-id",
    name: "Design de Sobrancelha",
    duration_min: 45,
    cleanup_min: 15,
    price: 65.0,
    description: "Design com visagismo facial e alinhamento",
    image_url: "",
    active: true,
    professional_ids: ["pro-ana-id"],
    studio_id: "studio-meu-id",
    created_at: nowUtc(),
  };

  const svcCabelo = {
    id: "svc-cabelo-id",
    name: "Corte e Escova",
    duration_min: 60,
    cleanup_min: 15,
    price: 120.0,
    description: "Corte especializado com finalização",
    image_url: "",
    active: true,
    professional_ids: ["pro-patricia-id"],
    studio_id: DEFAULT_STUDIO_ID,
    created_at: nowUtc(),
  };

  const defaultWorkingHours = {
    mon: { open: "09:00", close: "18:00", closed: false },
    tue: { open: "09:00", close: "18:00", closed: false },
    wed: { open: "09:00", close: "18:00", closed: false },
    thu: { open: "09:00", close: "18:00", closed: false },
    fri: { open: "09:00", close: "18:00", closed: false },
    sat: { open: "09:00", close: "15:00", closed: false },
    sun: { open: "09:00", close: "18:00", closed: true },
  };

  const proAnaRecord = {
    id: "pro-ana-id",
    name: "Ana Souza",
    email: "ana@meustudio.com",
    phone: "11988889999",
    specialty: "Design de Sobrancelha & Micropigmentação",
    photo_url: "",
    service_ids: ["svc-sobrancelha-id"],
    working_hours: defaultWorkingHours,
    can_create_coupons: true,
    signal_percent: 30,
    active: true,
    studio_id: "studio-meu-id",
    created_at: nowUtc(),
  };

  const proPatriciaRecord = {
    id: "pro-patricia-id",
    name: "Patrícia Lima",
    email: "patricia@studio.com",
    phone: "11977778888",
    specialty: "Cabelos e Penteados",
    photo_url: "",
    service_ids: ["svc-cabelo-id"],
    working_hours: defaultWorkingHours,
    can_create_coupons: true,
    signal_percent: 30,
    active: true,
    studio_id: DEFAULT_STUDIO_ID,
    created_at: nowUtc(),
  };

  const settingsMeuStudio = {
    id: "settings-meu-id",
    key: "studio",
    studio_id: "studio-meu-id",
    name: "Meu Studio",
    logo_url: "/uploads/studio-aurea/logos/de790ae2-762f-4e4e-8b48-fb646662b16e.png",
    address: "Rua das Flores, 123 - Centro",
    phone: "(11) 98888-0000",
    whatsapp: "11988880000",
    email: "contato@meustudio.com",
    opening_hours: defaultWorkingHours,
    default_signal_percent: 30,
    referral_enabled: true,
    referral_discount_percent: 10,
    created_at: nowUtc(),
  };

  const settingsStudioAurea = {
    id: "settings-aurea-id",
    key: "studio",
    studio_id: DEFAULT_STUDIO_ID,
    name: "Studio Aurea",
    logo_url: "/uploads/studio-aurea/logos/de790ae2-762f-4e4e-8b48-fb646662b16e.png",
    address: "Av. Paulista, 1000 - Bela Vista",
    phone: "(11) 97777-0000",
    whatsapp: "11977770000",
    email: "contato@studioaurea.com",
    opening_hours: defaultWorkingHours,
    default_signal_percent: 30,
    referral_enabled: true,
    referral_discount_percent: 10,
    created_at: nowUtc(),
  };

  return {
    studios: [defaultStudio, meuStudio],
    users: [superAdmin, managerMeuStudio, proAna, clientCarla, managerStudioAurea, proPatricia],
    professionals: [proAnaRecord, proPatriciaRecord],
    services: [svcDesignSobrancelha, svcCabelo],
    settings: [settingsMeuStudio, settingsStudioAurea],
    gallery: [],
    blocks: [],
    coupons: [
      {
        id: "coupon-boas-vindas",
        code: "BOASVINDAS",
        discount_percent: 15,
        scope: "studio",
        professional_id: null,
        service_ids: [],
        min_value: 0,
        max_uses: 100,
        uses: 0,
        active: true,
        studio_id: "studio-meu-id",
        created_at: nowUtc(),
      },
    ],
    appointments: [],
    notifications: [],
    login_events: [],
    password_reset_tokens: [],
  };
}

let db = loadDb();

function saveDb(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save DB:", err);
  }
}

// Helpers
function serializeUser(user: any, token?: string | null): any {
  if (!user) return null;
  const { password_hash, _id, ...safe } = user;
  if (user.role === "professional") {
    const pro = db.professionals.find((p) => p.id === user.id || (user.email && p.email?.toLowerCase() === user.email.toLowerCase()));
    if (pro) {
      safe.pro_id = pro.id;
    }
  }
  if (typeof token === "string") {
    safe.token = token;
    safe.access_token = token;
  }
  return safe;
}

function makeAccess(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role, type: "access" },
    JWT_SECRET,
    { expiresIn: `${ACCESS_MIN}m` }
  );
}

function makeRefresh(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "refresh" },
    JWT_SECRET,
    { expiresIn: `${REFRESH_DAYS}d` }
  );
}

function setAuthCookies(res: Response, access: string, refresh: string): void {
  // Use sameSite: "none" and secure: true so cookies work inside cross-site iframes in AI Studio
  res.cookie("access_token", access, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: ACCESS_MIN * 60 * 1000,
    path: "/",
  });
  res.cookie("refresh_token", refresh, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { path: "/", secure: true, sameSite: "none" });
  res.clearCookie("refresh_token", { path: "/", secure: true, sameSite: "none" });
}

// Auth Middleware
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  if (!token && req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.type === "access") {
      const user = db.users.find((u) => u.id === decoded.sub);
      if (user) {
        (req as any).user = user;
      }
    }
  } catch {
    // expired or invalid token
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ detail: "Não autenticado" });
  }

  // Check studio status
  if (user.role !== "super_admin" && user.studio_id) {
    const studio = db.studios.find((s) => s.id === user.studio_id);
    if (!studio || studio.active === false) {
      return res.status(403).json({ detail: "Studio bloqueado" });
    }
    if (studio.license_expires_at) {
      const expires = new Date(studio.license_expires_at).getTime();
      if (expires < Date.now()) {
        return res.status(403).json({ detail: "Licença do studio expirada" });
      }
    }
  }

  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ detail: "Não autenticado" });
    }
    if (user.role === "super_admin" || roles.includes(user.role)) {
      return next();
    }
    return res.status(403).json({ detail: "Permissão insuficiente" });
  };
}

function tenantId(user: any): string | null {
  return user?.studio_id || null;
}

function filterTenant(items: any[], user: any): any[] {
  if (user.role === "super_admin") return items;
  if (user.role === "client") {
    return items.filter((it) => it.client_id === user.id || it.studio_id === user.studio_id);
  }
  return items.filter((it) => it.studio_id === user.studio_id);
}

// Service & professional lookup
function getService(id: string, studioId?: string | null): any {
  if (!id) return null;
  if (studioId) {
    const s = db.services.find((svc) => svc.id === id && svc.studio_id === studioId);
    if (s) return s;
  }
  return db.services.find((svc) => svc.id === id);
}

function getProfessional(id: string, studioId?: string | null): any {
  if (!id) return null;
  if (studioId) {
    const p = db.professionals.find((pro) => pro.id === id && pro.studio_id === studioId);
    if (p) return p;
    const u = db.users.find((usr) => usr.id === id && usr.studio_id === studioId);
    if (u) return u;
  }
  return db.professionals.find((p) => p.id === id) || db.users.find((u) => u.id === id);
}

function getProIdsForUser(user: any): string[] {
  if (!user) return [];
  const ids = new Set<string>();
  ids.add(user.id);
  const pro = db.professionals.find(
    (p) => p.id === user.id || (user.email && p.email?.toLowerCase() === user.email.toLowerCase())
  );
  if (pro) ids.add(pro.id);
  const u = db.users.find(
    (usr) => usr.id === user.id || (pro && usr.email?.toLowerCase() === pro.email?.toLowerCase())
  );
  if (u) ids.add(u.id);
  return Array.from(ids);
}

function buildSummary(appt: any): any {
  const settings = db.settings.find((st) => st.key === "studio" && st.studio_id === appt.studio_id) || {};
  const signalPercent = settings.default_signal_percent ?? 30;

  let subtotal = 0;
  const itemDetails = (appt.items || []).map((it: any) => {
    const svc = getService(it.service_id, appt.studio_id);
    const pro = getProfessional(it.professional_id, appt.studio_id);
    const price = svc ? svc.price : 0;
    subtotal += price;
    return {
      ...it,
      service_name: svc?.name || "?",
      duration_min: svc?.duration_min || 0,
      price,
      professional_name: pro?.name || "?",
    };
  });

  const discount = appt.discount || 0;
  const total = Math.max(0, subtotal - discount);
  const signalValue = Math.round(((total * signalPercent) / 100) * 100) / 100;

  return {
    ...appt,
    items: itemDetails,
    subtotal,
    discount,
    total,
    signal_percent: signalPercent,
    signal_value: signalValue,
  };
}

function logLoginEvent(userId: string, success: boolean, ip: string, ua: string): void {
  db.login_events.push({
    id: uid(),
    user_id: userId,
    success,
    ip: ip || "127.0.0.1",
    user_agent: ua || "",
    at: nowUtc(),
  });
  saveDb();
}

function pushNotification(userIdOrProId: string, title: string, body: string, apptId?: string, studioId?: string): void {
  let targetUserId = userIdOrProId;
  const user = db.users.find((u) => u.id === userIdOrProId);
  if (!user) {
    const pro = db.professionals.find((p) => p.id === userIdOrProId);
    if (pro) {
      const u = db.users.find((usr) => usr.email?.toLowerCase() === pro.email?.toLowerCase() || usr.id === pro.id);
      if (u) targetUserId = u.id;
    }
  }
  db.notifications.push({
    id: uid(),
    user_id: targetUserId,
    title,
    body,
    appointment_id: apptId || null,
    read: false,
    created_at: nowUtc(),
    studio_id: studioId || null,
  });
  saveDb();
}

// =========================
// Express Application Setup
// =========================
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);
app.use(authMiddleware);

// Serve uploads
app.use("/api/files", express.static(UPLOAD_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

const api = express.Router();

// =========================
// 1. Auth Endpoints
// =========================
api.post("/auth/register", (req: Request, res: Response) => {
  const { name, email, password, phone, referral_code, studio_slug } = req.body;
  if (!name || !password || !phone) {
    return res.status(400).json({ detail: "Dados incompletos" });
  }

  let studio = studio_slug
    ? db.studios.find((s) => s.slug === studio_slug && s.active !== false)
    : db.studios.find((s) => s.id === DEFAULT_STUDIO_ID);

  if (!studio) {
    studio = db.studios[0];
  }
  const studioId = studio ? studio.id : DEFAULT_STUDIO_ID;

  const phoneDigits = normPhone(phone);
  if (phoneDigits.length < 8) {
    return res.status(400).json({ detail: "Telefone inválido" });
  }

  const existingPhone = db.users.find(
    (u) => u.phone_digits === phoneDigits && u.role === "client" && u.studio_id === studioId
  );
  if (existingPhone) {
    return res.status(400).json({ detail: "Telefone já cadastrado. Faça login com telefone e senha." });
  }

  if (email) {
    const existingEmail = db.users.find((u) => u.email === email.toLowerCase() && u.studio_id === studioId);
    if (existingEmail) {
      return res.status(400).json({ detail: "E-mail já cadastrado" });
    }
  }

  let referredBy: string | null = null;
  if (referral_code) {
    const referrer = db.users.find(
      (u) => u.referral_code === referral_code.toUpperCase().trim() && u.studio_id === studioId
    );
    if (referrer) {
      referredBy = referrer.id;
    }
  }

  const user = {
    id: uid(),
    name,
    email: email ? email.toLowerCase() : null,
    phone,
    phone_digits: phoneDigits,
    password_hash: hashPassword(password),
    role: "client",
    studio_id: studioId,
    referred_by: referredBy,
    referral_rewarded: false,
    referral_code: `${name.substring(0, 4).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`,
    created_at: nowUtc(),
  };

  db.users.push(user);
  saveDb();

  const access = makeAccess(user.id, user.role);
  const refresh = makeRefresh(user.id);
  setAuthCookies(res, access, refresh);
  logLoginEvent(user.id, true, req.ip || "", req.headers["user-agent"] || "");
  return res.json(serializeUser(user, access));
});

api.post("/auth/login", (req: Request, res: Response) => {
  const { identifier, password, studio_slug } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ detail: "Informe identificador e senha" });
  }

  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  let user: any = null;

  if (isEmail) {
    const targetEmail = trimmed.toLowerCase();
    // Super admins can log in from anywhere
    user = db.users.find((u) => u.email === targetEmail && u.role === "super_admin");
    if (!user) {
      // Find staff in given studio or any studio
      if (studio_slug) {
        const studio = db.studios.find((s) => s.slug === studio_slug);
        if (studio) {
          user = db.users.find((u) => u.email === targetEmail && u.studio_id === studio.id);
        }
      }
      if (!user) {
        user = db.users.find((u) => u.email === targetEmail);
      }
    }
  } else {
    // Phone login for client
    const digits = normPhone(trimmed);
    if (studio_slug) {
      const studio = db.studios.find((s) => s.slug === studio_slug);
      if (studio) {
        user = db.users.find((u) => u.phone_digits === digits && u.studio_id === studio.id);
      }
    }
    if (!user) {
      user = db.users.find((u) => u.phone_digits === digits);
    }
  }

  if (!user || !verifyPassword(password, user.password_hash)) {
    if (user) {
      logLoginEvent(user.id, false, req.ip || "", req.headers["user-agent"] || "");
    }
    return res.status(400).json({ detail: "Credenciais inválidas" });
  }

  const access = makeAccess(user.id, user.role);
  const refresh = makeRefresh(user.id);
  setAuthCookies(res, access, refresh);
  logLoginEvent(user.id, true, req.ip || "", req.headers["user-agent"] || "");
  return res.json(serializeUser(user, access));
});

api.post("/auth/logout", (req: Request, res: Response) => {
  clearAuthCookies(res);
  return res.json({ status: "ok" });
});

api.post("/auth/refresh", (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token || req.body?.refresh_token;
  if (!token) return res.status(401).json({ detail: "Sem token de renovação" });
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.type === "refresh") {
      const user = db.users.find((u) => u.id === decoded.sub);
      if (!user) return res.status(401).json({ detail: "Usuário não encontrado" });
      const access = makeAccess(user.id, user.role);
      const refresh = makeRefresh(user.id);
      setAuthCookies(res, access, refresh);
      return res.json(serializeUser(user, access));
    }
  } catch {}
  return res.status(401).json({ detail: "Token de renovação inválido" });
});

api.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const token = (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : null) || req.cookies?.access_token;
  return res.json(serializeUser(user, token));
});

api.post("/auth/change-password", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 8) {
    return res.status(400).json({ detail: "A nova senha deve ter no mínimo 8 caracteres" });
  }

  if (!verifyPassword(current_password, user.password_hash)) {
    return res.status(400).json({ detail: "Senha atual incorreta" });
  }

  user.password_hash = hashPassword(new_password);
  user.password_changed_at = nowUtc();
  saveDb();
  return res.json({ ok: true });
});

api.get("/auth/login-history", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const history = db.login_events
    .filter((e) => e.user_id === user.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 50);
  return res.json(history);
});

api.post("/auth/forgot-password", (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ detail: "Informe o e-mail" });
  const user = db.users.find((u) => u.email === email.toLowerCase());
  if (user) {
    const token = crypto.randomUUID();
    db.password_reset_tokens.push({
      token,
      user_id: user.id,
      expires_at: Date.now() + 60 * 60 * 1000,
    });
    saveDb();
    console.log(`[PASSWORD RESET LINK]: /redefinir-senha?token=${token}`);
  }
  return res.json({ ok: true, message: "Se o e-mail existir, um link de recuperação foi enviado." });
});

api.post("/auth/reset-password", (req: Request, res: Response) => {
  const { token, new_password } = req.body;
  if (!token || !new_password || new_password.length < 8) {
    return res.status(400).json({ detail: "Token inválido ou senha muito curta (mínimo 8 caracteres)" });
  }

  const record = db.password_reset_tokens.find((t) => t.token === token && t.expires_at > Date.now());
  if (!record) {
    return res.status(400).json({ detail: "Token de recuperação inválido ou expirado" });
  }

  const user = db.users.find((u) => u.id === record.user_id);
  if (!user) {
    return res.status(404).json({ detail: "Usuário não encontrado" });
  }

  user.password_hash = hashPassword(new_password);
  user.password_changed_at = nowUtc();
  db.password_reset_tokens = db.password_reset_tokens.filter((t) => t.token !== token);
  saveDb();
  return res.json({ ok: true, message: "Senha redefinida com sucesso" });
});

// =========================
// 2. Settings Endpoints
// =========================
api.get("/settings", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  let settings = db.settings.find((st) => st.key === "studio" && st.studio_id === user.studio_id);
  if (!settings) {
    settings = db.settings.find((st) => st.key === "studio") || {};
  }
  return res.json(settings);
});

api.put("/settings", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  let settings = db.settings.find((st) => st.key === "studio" && st.studio_id === user.studio_id);
  if (!settings) {
    settings = { id: uid(), key: "studio", studio_id: user.studio_id, created_at: nowUtc() };
    db.settings.push(settings);
  }

  Object.assign(settings, req.body, { updated_at: nowUtc() });
  saveDb();
  return res.json(settings);
});

// =========================
// 3. Studios & Platform Admins (super_admin)
// =========================
api.get("/studios", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
  const list = db.studios.map((st) => {
    const manager = db.users.find((u) => u.studio_id === st.id && u.role === "manager");
    return {
      ...st,
      manager_id: manager?.id || null,
      manager_name: manager?.name || "",
      manager_email: manager?.email || "",
      manager_phone: manager?.phone || "",
    };
  });
  return res.json(list);
});

api.post("/studios", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
  const { name, active, license_expires_at, manager_name, manager_phone, manager_email, manager_password } = req.body;
  if (!name) return res.status(400).json({ detail: "Nome do studio obrigatório" });

  const id = uid();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const newStudio = {
    id,
    name,
    slug: `${slug}-${Math.floor(100 + Math.random() * 900)}`,
    active: active ?? true,
    license_expires_at: license_expires_at || null,
    created_at: nowUtc(),
  };
  db.studios.push(newStudio);

  if (manager_email && manager_password) {
    const managerUser = {
      id: uid(),
      name: manager_name || "Gerente",
      email: manager_email.toLowerCase(),
      phone: manager_phone || "",
      phone_digits: normPhone(manager_phone),
      password_hash: hashPassword(manager_password),
      role: "manager",
      studio_id: id,
      created_at: nowUtc(),
    };
    db.users.push(managerUser);
  }

  db.settings.push({
    id: uid(),
    key: "studio",
    studio_id: id,
    name,
    logo_url: "",
    address: "",
    phone: manager_phone || "",
    whatsapp: normPhone(manager_phone),
    email: manager_email || "",
    opening_hours: {
      mon: { open: "09:00", close: "18:00", closed: false },
      tue: { open: "09:00", close: "18:00", closed: false },
      wed: { open: "09:00", close: "18:00", closed: false },
      thu: { open: "09:00", close: "18:00", closed: false },
      fri: { open: "09:00", close: "18:00", closed: false },
      sat: { open: "09:00", close: "15:00", closed: false },
      sun: { open: "09:00", close: "18:00", closed: true },
    },
    default_signal_percent: 30,
    referral_enabled: true,
    referral_discount_percent: 10,
    created_at: nowUtc(),
  });

  saveDb();
  return res.json(newStudio);
});

api.put("/studios/:studio_id", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
  const { studio_id } = req.params;
  const studio = db.studios.find((s) => s.id === studio_id);
  if (!studio) return res.status(404).json({ detail: "Studio não encontrado" });

  const { name, active, license_expires_at, manager_name, manager_phone, manager_email, manager_password } = req.body;
  if (name !== undefined) studio.name = name;
  if (active !== undefined) studio.active = active;
  if (license_expires_at !== undefined) studio.license_expires_at = license_expires_at;

  let manager = db.users.find((u) => u.studio_id === studio_id && u.role === "manager");
  if (manager) {
    if (manager_name) manager.name = manager_name;
    if (manager_phone) {
      manager.phone = manager_phone;
      manager.phone_digits = normPhone(manager_phone);
    }
    if (manager_email) manager.email = manager_email.toLowerCase();
    if (manager_password) manager.password_hash = hashPassword(manager_password);
  } else if (manager_email && manager_password) {
    manager = {
      id: uid(),
      name: manager_name || "Gerente",
      email: manager_email.toLowerCase(),
      phone: manager_phone || "",
      phone_digits: normPhone(manager_phone),
      password_hash: hashPassword(manager_password),
      role: "manager",
      studio_id,
      created_at: nowUtc(),
    };
    db.users.push(manager);
  }

  saveDb();
  return res.json(studio);
});

api.get("/platform/admins", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
  const admins = db.users
    .filter((u) => u.role === "super_admin")
    .map((admin) => {
      const lastLogin = db.login_events
        .filter((e) => e.user_id === admin.id && e.success)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
      return {
        ...serializeUser(admin),
        last_login_at: lastLogin?.at || null,
        last_login_ip: lastLogin?.ip || null,
      };
    });
  return res.json(admins);
});

api.post("/platform/admins", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ detail: "Dados inválidos ou senha muito curta (mínimo 8 caracteres)" });
  }

  const existing = db.users.find((u) => u.email === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ detail: "E-mail já cadastrado" });
  }

  const admin = {
    id: uid(),
    name,
    email: email.toLowerCase(),
    phone: "",
    phone_digits: "",
    password_hash: hashPassword(password),
    role: "super_admin",
    studio_id: null,
    created_at: nowUtc(),
  };

  db.users.push(admin);
  saveDb();
  return res.json(serializeUser(admin));
});

api.delete("/platform/admins/:admin_id", requireAuth, requireRole("super_admin"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { admin_id } = req.params;
  if (user.id === admin_id) {
    return res.status(400).json({ detail: "Você não pode remover seu próprio acesso master" });
  }

  db.users = db.users.filter((u) => u.id !== admin_id);
  saveDb();
  return res.json({ ok: true });
});

// =========================
// 4. Public Studio Endpoints
// =========================
api.post("/public/studios/register", (req: Request, res: Response) => {
  const { name, manager_name, manager_phone, manager_email, manager_password } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ detail: "Nome do studio é obrigatório" });
  }
  if (!manager_name || !manager_name.trim()) {
    return res.status(400).json({ detail: "Nome do responsável é obrigatório" });
  }
  if (!manager_email || !manager_email.trim()) {
    return res.status(400).json({ detail: "E-mail de acesso é obrigatório" });
  }
  if (!manager_password || manager_password.length < 8) {
    return res.status(400).json({ detail: "A senha deve ter no mínimo 8 caracteres" });
  }

  const emailLower = manager_email.trim().toLowerCase();
  const existingUser = db.users.find((u) => u.email === emailLower);
  if (existingUser) {
    return res.status(400).json({ detail: "Este e-mail já está em uso na plataforma" });
  }

  const id = uid();
  const baseSlug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "studio";
  
  let slug = baseSlug;
  let counter = 1;
  while (db.studios.some((s) => s.slug === slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const newStudio = {
    id,
    name: name.trim(),
    slug,
    active: true,
    license_expires_at: null,
    created_at: nowUtc(),
  };
  db.studios.push(newStudio);

  // Is this email an admin email?
  const isSuper = emailLower === "dvssystem@hotmail.com" || emailLower === "dougaodvs@gmail.com";
  const managerUser = {
    id: uid(),
    name: manager_name.trim(),
    email: emailLower,
    phone: manager_phone || "",
    phone_digits: normPhone(manager_phone || ""),
    password_hash: hashPassword(manager_password),
    role: isSuper ? "super_admin" : "manager",
    studio_id: id,
    created_at: nowUtc(),
  };
  db.users.push(managerUser);

  // Settings
  db.settings.push({
    id: uid(),
    key: "studio",
    studio_id: id,
    name: name.trim(),
    slug,
    logo_url: "",
    address: "",
    phone: manager_phone || "",
    whatsapp: normPhone(manager_phone || ""),
    email: emailLower,
    opening_hours: {
      mon: { open: "09:00", close: "18:00", closed: false },
      tue: { open: "09:00", close: "18:00", closed: false },
      wed: { open: "09:00", close: "18:00", closed: false },
      thu: { open: "09:00", close: "18:00", closed: false },
      fri: { open: "09:00", close: "18:00", closed: false },
      sat: { open: "09:00", close: "15:00", closed: false },
      sun: { open: "09:00", close: "18:00", closed: true },
    },
    default_signal_percent: 30,
    referral_enabled: true,
    referral_discount_percent: 10,
    created_at: nowUtc(),
  });

  saveDb();

  const access = makeAccess(managerUser.id, managerUser.role);
  const refresh = makeRefresh(managerUser.id);
  setAuthCookies(res, access, refresh);
  logLoginEvent(managerUser.id, true, req.ip || "", req.headers["user-agent"] || "");

  return res.json({
    studio: newStudio,
    user: serializeUser(managerUser, access),
    token: access,
    access_token: access,
  });
});

api.get("/public/studios/:slug/config", (req: Request, res: Response) => {
  const { slug } = req.params;
  const studio = db.studios.find((s) => s.slug === slug || s.id === slug);
  if (!studio) {
    return res.status(404).json({ detail: "Studio não encontrado" });
  }

  const settings = db.settings.find((st) => st.key === "studio" && st.studio_id === studio.id) || {};
  return res.json({
    id: studio.id,
    name: settings.name || studio.name,
    slug: studio.slug,
    logo_url: settings.logo_url || "",
    address: settings.address || "",
    phone: settings.phone || "",
    whatsapp: settings.whatsapp || "",
    opening_hours: settings.opening_hours || {},
    referral_enabled: settings.referral_enabled !== false,
    referral_discount_percent: settings.referral_discount_percent ?? 10,
    active: studio.active !== false,
  });
});

api.get("/public/studios/:slug/manifest", (req: Request, res: Response) => {
  const { slug } = req.params;
  const studio = db.studios.find((s) => s.slug === slug || s.id === slug);
  const name = studio?.name || "Studio Aurea";
  return res.json({
    short_name: name,
    name: `${name} - Agendamento`,
    icons: [
      { src: "/pwa-icon.svg", sizes: "192x192 512x512", type: "image/svg+xml" },
    ],
    start_url: `/studio/${slug}`,
    display: "standalone",
    theme_color: "#000000",
    background_color: "#0a0a0a",
  });
});

// =========================
// 5. Uploads
// =========================
api.post("/upload", requireAuth, upload.single("file") as any, (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ detail: "Nenhum arquivo enviado" });
  }

  const user = (req as any).user;
  const studioSlug = user?.studio_id || "studio-aurea";
  const relativePath = `${studioSlug}/logos/${file.filename}`;
  return res.json({
    url: `/api/files/${relativePath}`,
    path: relativePath,
    filename: file.filename,
  });
});

// =========================
// =========================
// 6. Services Endpoints
// =========================
api.get("/services", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const services = filterTenant(db.services, user).filter((s) => s.active !== false).map((s) => {
    const pros = db.professionals.filter((p) =>
      (s.professional_ids || []).includes(p.id) || (p.service_ids || []).includes(s.id)
    );
    const proIds = Array.from(new Set([...(s.professional_ids || []), ...pros.map((p) => p.id)]));
    return {
      ...s,
      professional_ids: proIds,
      professional_names: pros.map((p) => p.name),
    };
  });
  return res.json(services);
});

api.post("/services", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, duration_min, cleanup_min, price, description, image_url, professional_ids } = req.body;
  if (!name || !duration_min || price === undefined) {
    return res.status(400).json({ detail: "Nome, duração e preço são obrigatórios" });
  }

  const sId = uid();
  const proIds = professional_ids || [];
  const service = {
    id: sId,
    name,
    duration_min: Number(duration_min),
    cleanup_min: Number(cleanup_min || 0),
    price: Number(price),
    description: description || "",
    image_url: image_url || "",
    active: true,
    professional_ids: proIds,
    studio_id: tenantId(user),
    created_at: nowUtc(),
  };

  db.services.push(service);

  // Sync with professionals
  proIds.forEach((pid: string) => {
    const pro = db.professionals.find((p) => p.id === pid);
    if (pro) {
      if (!pro.service_ids) pro.service_ids = [];
      if (!pro.service_ids.includes(sId)) pro.service_ids.push(sId);
    }
  });

  saveDb();
  return res.json(service);
});

api.put("/services/:sid", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { sid } = req.params;
  const service = db.services.find((s) => s.id === sid && s.studio_id === user.studio_id);
  if (!service) return res.status(404).json({ detail: "Serviço não encontrado" });

  Object.assign(service, req.body, { updated_at: nowUtc() });

  if (req.body.professional_ids) {
    const proIds: string[] = req.body.professional_ids;
    db.professionals.forEach((p) => {
      if (p.studio_id === user.studio_id) {
        if (!p.service_ids) p.service_ids = [];
        if (proIds.includes(p.id) && !p.service_ids.includes(sid)) {
          p.service_ids.push(sid);
        } else if (!proIds.includes(p.id) && p.service_ids.includes(sid)) {
          p.service_ids = p.service_ids.filter((id) => id !== sid);
        }
      }
    });
  }

  saveDb();
  return res.json(service);
});

api.delete("/services/:sid", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { sid } = req.params;
  db.services = db.services.filter((s) => !(s.id === sid && s.studio_id === user.studio_id));
  db.professionals.forEach((p) => {
    if (p.service_ids) {
      p.service_ids = p.service_ids.filter((id) => id !== sid);
    }
  });
  saveDb();
  return res.json({ ok: true });
});

api.put("/professionals/me/services", requireAuth, requireRole("professional"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { service_ids } = req.body;
  const pro = db.professionals.find((p) => p.id === user.id);
  if (pro) {
    pro.service_ids = service_ids || [];
    saveDb();
  }
  return res.json({ ok: true, service_ids });
});

// =========================
// 7. Professionals Endpoints
// =========================
api.get("/professionals", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const pros = filterTenant(db.professionals, user).map((p) => {
    const matchedServices = db.services.filter(
      (s) => (s.professional_ids || []).includes(p.id) || (p.service_ids || []).includes(s.id)
    );
    const serviceIds = Array.from(new Set([...(p.service_ids || []), ...matchedServices.map((s) => s.id)]));
    return {
      ...p,
      service_ids: serviceIds,
    };
  });
  return res.json(pros);
});

api.post("/professionals", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, email, password, phone, specialty, photo_url, service_ids, working_hours, can_create_coupons, signal_percent } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ detail: "Nome, e-mail e telefone são obrigatórios" });
  }

  const existing = db.professionals.find((p) => p.email === email.toLowerCase() && p.studio_id === user.studio_id);
  if (existing) {
    return res.status(400).json({ detail: "Profissional já cadastrado com este e-mail" });
  }

  const proId = uid();
  const proUser = {
    id: proId,
    name,
    email: email.toLowerCase(),
    phone,
    phone_digits: normPhone(phone),
    password_hash: hashPassword(password || "Pro@2026xx"),
    role: "professional",
    studio_id: user.studio_id,
    created_at: nowUtc(),
  };
  db.users.push(proUser);

  const sIds = service_ids || [];
  const professional = {
    id: proId,
    name,
    email: email.toLowerCase(),
    phone,
    specialty: specialty || "",
    photo_url: photo_url || "",
    service_ids: sIds,
    working_hours: working_hours || {},
    can_create_coupons: Boolean(can_create_coupons),
    signal_percent: signal_percent ?? 30,
    active: true,
    studio_id: user.studio_id,
    created_at: nowUtc(),
  };
  db.professionals.push(professional);

  // Sync with services
  sIds.forEach((sid: string) => {
    const svc = db.services.find((s) => s.id === sid);
    if (svc) {
      if (!svc.professional_ids) svc.professional_ids = [];
      if (!svc.professional_ids.includes(proId)) svc.professional_ids.push(proId);
    }
  });

  saveDb();
  return res.json(professional);
});

api.put("/professionals/:pid", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { pid } = req.params;
  const pro = db.professionals.find((p) => p.id === pid && p.studio_id === user.studio_id);
  if (!pro) return res.status(404).json({ detail: "Profissional não encontrado" });

  Object.assign(pro, req.body, { updated_at: nowUtc() });
  const proUser = db.users.find((u) => u.id === pid);
  if (proUser) {
    if (req.body.name) proUser.name = req.body.name;
    if (req.body.phone) {
      proUser.phone = req.body.phone;
      proUser.phone_digits = normPhone(req.body.phone);
    }
    if (req.body.password) {
      proUser.password_hash = hashPassword(req.body.password);
    }
  }

  if (req.body.service_ids) {
    const sIds: string[] = req.body.service_ids;
    db.services.forEach((s) => {
      if (s.studio_id === user.studio_id) {
        if (!s.professional_ids) s.professional_ids = [];
        if (sIds.includes(s.id) && !s.professional_ids.includes(pid)) {
          s.professional_ids.push(pid);
        } else if (!sIds.includes(s.id) && s.professional_ids.includes(pid)) {
          s.professional_ids = s.professional_ids.filter((id) => id !== pid);
        }
      }
    });
  }

  saveDb();
  return res.json(pro);
});

api.delete("/professionals/:pid", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const { pid } = req.params;
  db.professionals = db.professionals.filter((p) => !(p.id === pid && p.studio_id === user.studio_id));
  db.users = db.users.filter((u) => u.id !== pid);
  saveDb();
  return res.json({ ok: true });
});

// =========================
// 8. Clients Endpoints
// =========================
api.get("/clients", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role === "client") return res.status(403).json({ detail: "Sem permissão" });

  const clients = filterTenant(db.users, user)
    .filter((u) => u.role === "client")
    .map((u) => serializeUser(u));
  return res.json(clients);
});

// =========================
// 9. Blocks Endpoints
// =========================
api.get("/blocks", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { professional_id } = req.query;
  let blocks = filterTenant(db.blocks, user);
  if (professional_id) {
    blocks = blocks.filter((b) => b.professional_id === professional_id);
  } else if (user.role === "professional") {
    blocks = blocks.filter((b) => b.professional_id === user.id);
  }
  return res.json(blocks);
});

api.post("/blocks", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role === "client") return res.status(403).json({ detail: "Sem permissão" });
  const { professional_id, start, end, reason, kind } = req.body;
  if (!professional_id || !start || !end) {
    return res.status(400).json({ detail: "Dados incompletos" });
  }

  const block = {
    id: uid(),
    professional_id,
    start,
    end,
    reason: reason || "",
    kind: kind || "single",
    studio_id: user.studio_id,
    created_at: nowUtc(),
  };

  db.blocks.push(block);
  saveDb();
  return res.json(block);
});

api.delete("/blocks/:bid", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { bid } = req.params;
  db.blocks = db.blocks.filter((b) => !(b.id === bid && b.studio_id === user.studio_id));
  saveDb();
  return res.json({ ok: true });
});

// =========================
// 10. Coupons Endpoints
// =========================
api.get("/coupons", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  let coupons = filterTenant(db.coupons, user);
  if (user.role === "client") {
    coupons = coupons.filter(
      (c) => c.active && (!c.client_id || c.client_id === user.id)
    );
  }
  return res.json(coupons);
});

api.post("/coupons", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role === "client") return res.status(403).json({ detail: "Sem permissão" });

  const { code, discount_percent, scope, professional_id, service_ids, min_value, max_uses, valid_until } = req.body;
  if (!code || discount_percent === undefined) {
    return res.status(400).json({ detail: "Código e desconto são obrigatórios" });
  }

  const upperCode = code.toUpperCase().trim();
  const existing = db.coupons.find((c) => c.code === upperCode && c.studio_id === user.studio_id);
  if (existing) {
    return res.status(400).json({ detail: "Código de cupom já existe" });
  }

  const coupon = {
    id: uid(),
    code: upperCode,
    discount_percent: Number(discount_percent),
    scope: scope || "studio",
    professional_id: scope === "professional" ? (professional_id || user.id) : null,
    service_ids: service_ids || [],
    min_value: Number(min_value || 0),
    max_uses: max_uses ? Number(max_uses) : null,
    uses: 0,
    valid_until: valid_until || null,
    active: true,
    studio_id: user.studio_id,
    created_at: nowUtc(),
  };

  db.coupons.push(coupon);
  saveDb();
  return res.json(coupon);
});

api.delete("/coupons/:cid", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { cid } = req.params;
  db.coupons = db.coupons.filter((c) => !(c.id === cid && c.studio_id === user.studio_id));
  saveDb();
  return res.json({ ok: true });
});

api.post("/coupons/validate", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { code, items } = req.body;
  if (!code) return res.status(400).json({ detail: "Informe o cupom" });

  const coupon = db.coupons.find(
    (c) => c.code === code.toUpperCase().trim() && c.studio_id === user.studio_id && c.active
  );
  if (!coupon) {
    return res.status(400).json({ detail: "Cupom inválido ou expirado" });
  }

  let subtotal = 0;
  let eligibleSubtotal = 0;
  const appliesTo: number[] = [];

  (items || []).forEach((it: any, idx: number) => {
    const svc = getService(it.service_id, user.studio_id);
    const price = svc?.price || 0;
    subtotal += price;

    if (coupon.scope === "professional" && coupon.professional_id !== it.professional_id) {
      return;
    }
    if (coupon.service_ids && coupon.service_ids.length > 0 && !coupon.service_ids.includes(it.service_id)) {
      return;
    }
    appliesTo.push(idx);
    eligibleSubtotal += price;
  });

  if (appliesTo.length === 0) {
    return res.status(400).json({ detail: "Cupom não aplicável aos serviços selecionados" });
  }

  const discount = Math.round(((eligibleSubtotal * coupon.discount_percent) / 100) * 100) / 100;
  return res.json({
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    coupon,
    applies_to: appliesTo,
  });
});

// =========================
// 11. Availability Endpoints
// =========================
function computeSlotsForPro(
  pro: any,
  day: string,
  serviceId?: string,
  studioId?: string
): Array<{ time: string; start: string; period: string; available: boolean }> {
  const dowKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dObj = new Date(`${day}T12:00:00Z`);
  const dow = dowKeys[dObj.getUTCDay()];

  const settings = db.settings.find((st) => st.key === "studio" && st.studio_id === studioId) || {};
  const studioHours = settings.opening_hours || {};
  const dayHour = (pro.working_hours && pro.working_hours[dow]) || studioHours[dow] || { open: "09:00", close: "18:00", closed: dow === "sun" };

  if (dayHour.closed) {
    return [];
  }

  const [openH, openM = 0] = (dayHour.open || "09:00").split(":").map(Number);
  const [closeH, closeM = 0] = (dayHour.close || "18:00").split(":").map(Number);

  const svc = serviceId ? getService(serviceId, studioId) : null;
  const durationMin = svc?.duration_min || 30;

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const result: Array<{ time: string; start: string; period: string; available: boolean }> = [];

  for (let current = openMinutes; current + durationMin <= closeMinutes; current += 30) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;
    const slotStart = `${day}T${timeStr}:00Z`;
    const slotStartTime = new Date(slotStart).getTime();
    const slotEndTime = slotStartTime + durationMin * 60000;

    // 1. Check appointment conflicts
    const hasApptConflict = db.appointments.some((a) => {
      if (a.status === "cancelled" || a.status === "refused") return false;
      return (a.items || []).some((it: any) => {
        if (it.professional_id !== pro.id) return false;
        const itStart = new Date(it.start).getTime();
        const itSvc = getService(it.service_id, studioId);
        const itDuration = (itSvc?.duration_min || 30) * 60000;
        const itEnd = itStart + itDuration;
        return slotStartTime < itEnd && itStart < slotEndTime;
      });
    });

    if (hasApptConflict) continue;

    // 2. Check block conflicts
    const hasBlockConflict = db.blocks.some((b) => {
      if (b.professional_id !== pro.id) return false;
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      return slotStartTime < bEnd && bStart < slotEndTime;
    });

    if (hasBlockConflict) continue;

    const period = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
    result.push({
      time: timeStr,
      start: slotStart,
      period,
      available: true,
    });
  }

  return result;
}

api.get("/availability", (req: Request, res: Response) => {
  const { professional_id, service_id, day } = req.query as { professional_id?: string; service_id?: string; day?: string };
  if (!day) {
    return res.json({ slots: [] });
  }

  const user = (req as any).user;
  const studioId = user?.studio_id || DEFAULT_STUDIO_ID;

  if (professional_id) {
    const pro = getProfessional(professional_id, studioId);
    if (!pro) return res.json({ slots: [] });
    const slots = computeSlotsForPro(pro, day, service_id, studioId);
    return res.json({ slots: slots.map((s) => s.start) });
  }

  // If no professional specified, return all slots across eligible pros
  let pros = db.professionals.filter((p) => p.active !== false && (p.studio_id === studioId || !p.studio_id));
  if (service_id) {
    pros = pros.filter((p) => (p.service_ids || []).includes(service_id));
  }
  const allSlots = new Set<string>();
  for (const pro of pros) {
    const proSlots = computeSlotsForPro(pro, day, service_id, studioId);
    for (const s of proSlots) allSlots.add(s.start);
  }
  return res.json({ slots: Array.from(allSlots).sort() });
});

api.get("/availability/calendar", (req: Request, res: Response) => {
  const { day, service_id, professional_id, studio_slug } = req.query as {
    day?: string;
    service_id?: string;
    professional_id?: string;
    studio_slug?: string;
  };

  const user = (req as any).user;
  let studioId = user?.studio_id;
  if (!studioId && studio_slug) {
    const s = db.studios.find((st) => st.slug === studio_slug || st.id === studio_slug);
    if (s) studioId = s.id;
  }
  if (!studioId) studioId = DEFAULT_STUDIO_ID;

  const targetDay = day || new Date().toISOString().slice(0, 10);

  // Get active pros for studio
  let pros = db.professionals.filter((p) => p.active !== false && (p.studio_id === studioId || !p.studio_id));
  if (service_id) {
    pros = pros.filter((p) => (p.service_ids || []).includes(service_id));
  }
  if (professional_id) {
    pros = pros.filter((p) => p.id === professional_id);
  }

  const proResults = pros.map((pro) => {
    const slots = computeSlotsForPro(pro, targetDay, service_id, studioId);
    const proServices = (pro.service_ids || [])
      .map((sid: string) => getService(sid, studioId))
      .filter(Boolean);

    return {
      id: pro.id,
      name: pro.name,
      photo_url: pro.photo_url || "",
      specialty: pro.specialty || (proServices[0]?.name ? `Especialista em ${proServices[0].name}` : "Profissional"),
      services: proServices.map((s: any) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration_min: s.duration_min,
      })),
      total_openings: slots.length,
      periods: {
        morning: slots.filter((s) => s.period === "morning"),
        afternoon: slots.filter((s) => s.period === "afternoon"),
        evening: slots.filter((s) => s.period === "evening"),
      },
      slots,
    };
  });

  // Calculate 7-day summary
  const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const DOW_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const daysSummary: any[] = [];
  const baseDate = new Date(`${targetDay}T12:00:00Z`);

  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setUTCDate(baseDate.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay();

    // Sum openings across these pros for this date
    let totalCount = 0;
    for (const pro of pros) {
      const daySlots = computeSlotsForPro(pro, dateStr, service_id, studioId);
      totalCount += daySlots.length;
    }

    daysSummary.push({
      date: dateStr,
      day_num: d.getUTCDate(),
      weekday_short: DOW_SHORT[dayOfWeek],
      weekday_full: DOW_FULL[dayOfWeek],
      is_selected: dateStr === targetDay,
      total_openings: totalCount,
      has_openings: totalCount > 0,
    });
  }

  const studio = db.studios.find((s) => s.id === studioId);
  const svc = service_id ? getService(service_id, studioId) : null;

  return res.json({
    day: targetDay,
    studio_id: studioId,
    studio_name: studio?.name || "Studio Aurea",
    service: svc ? { id: svc.id, name: svc.name, duration_min: svc.duration_min, price: svc.price } : null,
    professionals: proResults,
    days_summary: daysSummary,
  });
});

api.get("/emergency-openings", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const { service_id, day } = req.query as { service_id: string; day: string };
  const user = (req as any).user;
  const pros = filterTenant(db.professionals, user);
  const openings: any[] = [];

  for (const pro of pros) {
    openings.push({
      professional_id: pro.id,
      professional_name: pro.name,
      start: `${day}T14:00:00Z`,
    });
    openings.push({
      professional_id: pro.id,
      professional_name: pro.name,
      start: `${day}T16:00:00Z`,
    });
  }

  return res.json({ service_id, day, openings });
});

// =========================
// 12. Appointments Endpoints
// =========================
api.get("/appointments", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  let appts = filterTenant(db.appointments, user);

  if (user.role === "professional") {
    const proIds = getProIdsForUser(user);
    appts = appts.filter(
      (a) => proIds.includes(a.professional_id) || (a.items || []).some((it: any) => proIds.includes(it.professional_id))
    );
  } else if (user.role === "client") {
    appts = appts.filter((a) => a.client_id === user.id);
  }

  const summaries = appts
    .map((a) => {
      const summary = buildSummary(a);
      if (user.role === "professional") {
        const proIds = getProIdsForUser(user);
        summary.items = (summary.items || []).filter((it: any) => proIds.includes(it.professional_id));
      }
      return summary;
    })
    .filter((s) => s.items && s.items.length > 0);

  return res.json(summaries);
});

api.post("/appointments", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { items, client_id, client_name, client_phone, notes, quick, force, coupon_code } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ detail: "Nenhum procedimento informado" });
  }

  let finalClientId = user.role === "client" ? user.id : client_id;
  let finalClientName = user.role === "client" ? user.name : client_name || "Cliente";
  let finalClientPhone = user.role === "client" ? user.phone : client_phone || "";

  if (finalClientId && !finalClientName) {
    const c = db.users.find((u) => u.id === finalClientId);
    if (c) {
      finalClientName = c.name;
      finalClientPhone = c.phone || finalClientPhone;
    }
  }

  const initialStatus = quick && ["manager", "professional"].includes(user.role) ? "confirmed" : "waiting";
  let studioId = user.studio_id || DEFAULT_STUDIO_ID;
  if (items[0]) {
    const firstSvc = db.services.find((s) => s.id === items[0].service_id);
    if (firstSvc && firstSvc.studio_id) {
      studioId = firstSvc.studio_id;
    } else {
      const firstPro = db.professionals.find((p) => p.id === items[0].professional_id);
      if (firstPro && firstPro.studio_id) studioId = firstPro.studio_id;
    }
  }

  let coupon: any = null;
  if (coupon_code) {
    coupon = db.coupons.find(
      (c) => c.code === coupon_code.toUpperCase().trim() && c.studio_id === studioId && c.active
    );
    if (coupon) {
      coupon.uses = (coupon.uses || 0) + 1;
    }
  }

  // Group items by professional_id so each professional receives their own booking & confirmation
  const byPro: Record<string, any[]> = {};
  for (const it of items) {
    const pid = it.professional_id;
    if (!byPro[pid]) {
      byPro[pid] = [];
    }
    byPro[pid].push(it);
  }

  const bookingGroupId = uid();
  const createdAppts: any[] = [];

  for (const [pid, proItems] of Object.entries(byPro)) {
    const apptId = uid();
    let proDiscount = 0;
    if (coupon) {
      let eligible = 0;
      for (const it of proItems) {
        if (coupon.scope === "professional" && coupon.professional_id !== it.professional_id) continue;
        if (coupon.service_ids && coupon.service_ids.length > 0 && !coupon.service_ids.includes(it.service_id)) continue;
        const svc = getService(it.service_id, studioId);
        eligible += svc?.price || 0;
      }
      proDiscount = Math.round(((eligible * coupon.discount_percent) / 100) * 100) / 100;
    }

    const appt = {
      id: apptId,
      booking_group_id: bookingGroupId,
      client_id: finalClientId || null,
      client_name: finalClientName,
      client_phone: finalClientPhone,
      professional_id: pid,
      items: proItems.map((it: any) => ({
        id: uid(),
        professional_id: it.professional_id,
        service_id: it.service_id,
        start: it.start,
        status: initialStatus,
      })),
      status: initialStatus,
      quick: Boolean(quick),
      forced: Boolean(force),
      coupon_code: coupon ? coupon.code : null,
      discount: proDiscount,
      notes: notes || "",
      signal_paid: false,
      created_by: user.id,
      created_at: nowUtc(),
      studio_id: studioId,
    };

    db.appointments.push(appt);
    createdAppts.push(appt);

    // Notify only this specific professional for their own service(s)
    const serviceNames = proItems
      .map((it) => getService(it.service_id, appt.studio_id)?.name || "procedimento")
      .join(", ");
    pushNotification(
      pid,
      quick ? "Encaixe confirmado" : "Nova solicitação de agendamento",
      `Cliente ${finalClientName} agendou ${serviceNames} para ${fmtBr(proItems[0].start)}.`,
      appt.id,
      appt.studio_id
    );
  }

  saveDb();

  const firstSummary = buildSummary(createdAppts[0]);
  return res.json({
    ...firstSummary,
    id: createdAppts[0].id,
    booking_group_id: bookingGroupId,
    created_appointment_ids: createdAppts.map((a) => a.id),
  });
});

api.post("/appointments/:aid/status", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { aid } = req.params;
  const { status, cancellation_reason } = req.body;
  const appt = db.appointments.find((a) => a.id === aid && (user.role === "super_admin" || a.studio_id === user.studio_id));
  if (!appt) return res.status(404).json({ detail: "Agendamento não encontrado" });

  appt.status = status;
  if (status === "cancelled") {
    appt.cancellation_reason = cancellation_reason || "Cancelado pelo usuário";
    appt.cancelled_at = nowUtc();
    appt.cancelled_by_id = user.id;
    appt.cancelled_by_name = user.name;
  }
  saveDb();

  if (appt.client_id) {
    const summary = buildSummary(appt);
    const serviceName = summary.items?.[0]?.service_name || "procedimento";
    const proName = summary.items?.[0]?.professional_name || "profissional";
    pushNotification(
      appt.client_id,
      status === "confirmed" ? "Agendamento confirmado ✨" : `Agendamento ${status}`,
      status === "confirmed"
        ? `Seu agendamento de ${serviceName} com ${proName} foi confirmado.`
        : `Status de ${serviceName} com ${proName} atualizado para ${status}.`,
      appt.id,
      appt.studio_id
    );
  }

  return res.json(buildSummary(appt));
});

api.post("/appointments/:aid/mark-signal-paid", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { aid } = req.params;
  const appt = db.appointments.find((a) => a.id === aid && (user.role === "super_admin" || a.studio_id === user.studio_id));
  if (!appt) return res.status(404).json({ detail: "Agendamento não encontrado" });

  appt.signal_paid = true;
  appt.status = "signal_paid";
  saveDb();

  return res.json(buildSummary(appt));
});

api.post("/appointments/:aid/reschedule", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { aid } = req.params;
  const { item_id, start, force } = req.body;
  const appt = db.appointments.find((a) => a.id === aid && (user.role === "super_admin" || a.studio_id === user.studio_id));
  if (!appt) return res.status(404).json({ detail: "Agendamento não encontrado" });

  const item = (appt.items || []).find((it: any) => it.id === item_id);
  if (!item) return res.status(404).json({ detail: "Procedimento não encontrado" });

  item.start = start;
  appt.rescheduled_at = nowUtc();
  appt.rescheduled_by = user.id;
  if (force) appt.forced = true;
  saveDb();

  return res.json(buildSummary(appt));
});

api.get("/appointments/reminders", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { day, professional_id } = req.query as { day?: string; professional_id?: string };
  const targetDay = day || new Date().toISOString().split("T")[0];

  const appts = filterTenant(db.appointments, user).filter((a) =>
    ["confirmed", "waiting", "signal_paid", "signal_pending"].includes(a.status)
  );

  const rows: any[] = [];
  appts.forEach((a) => {
    const summary = buildSummary(a);
    (summary.items || []).forEach((it: any) => {
      if (professional_id && it.professional_id !== professional_id) return;
      if (user.role === "professional" && it.professional_id !== user.id) return;

      const pPhone = waPhone(summary.client_phone);
      const text = `Olá, ${summary.client_name}! Lembramos do seu horário de ${it.service_name} com ${it.professional_name} em ${fmtBr(it.start)}.`;
      rows.push({
        appointment_id: a.id,
        item_id: it.id,
        start: it.start,
        client_name: summary.client_name,
        client_phone: pPhone,
        service_name: it.service_name,
        professional_id: it.professional_id,
        professional_name: it.professional_name,
        duration_min: it.duration_min,
        status: summary.status,
        quick: summary.quick,
        text,
        wa_url: pPhone ? `https://wa.me/${pPhone}?text=${encodeURIComponent(text)}` : "",
      });
    });
  });

  return res.json({ day: targetDay, label: targetDay, items: rows });
});

api.get("/appointments/:aid/whatsapp", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { aid } = req.params;
  const callerProIds = getProIdsForUser(user);
  const appt = db.appointments.find(
    (a) =>
      a.id === aid &&
      (user.role === "super_admin" ||
       a.studio_id === user.studio_id ||
       a.client_id === user.id ||
       callerProIds.includes(a.professional_id) ||
       (a.items || []).some((it: any) => callerProIds.includes(it.professional_id)))
  );
  if (!appt) return res.status(404).json({ detail: "Agendamento não encontrado" });

  const settings = db.settings.find((st) => st.key === "studio" && st.studio_id === appt.studio_id) || {};
  const studioName = settings.name || "Studio";

  const isSingle = req.query.single === "1" || req.query.single === "true";
  const relatedAppts = (!isSingle && appt.booking_group_id)
    ? db.appointments.filter((a) => a.booking_group_id === appt.booking_group_id)
    : [appt];

  const targets: any[] = [];

  // When manager/staff opens it, include target to notify client
  if (user.role !== "client") {
    const allItems: any[] = [];
    relatedAppts.forEach((a) => {
      const summary = buildSummary(a);
      (summary.items || []).forEach((it: any) => allItems.push(it));
    });
    const clientPhone = waPhone(appt.client_phone);
    const serviceList = allItems.map((it) => `${it.service_name} com ${it.professional_name}`).join(", ");
    const statusText = appt.status === "confirmed" ? "confirmado ✨" : appt.status;
    const clientText = `✨ *${studioName}* ✨\n\nOlá, ${appt.client_name}! Seu agendamento de *${serviceList}* está ${statusText} para ${fmtBr(allItems[0]?.start || "")}.\n\nAté breve! 🌸`;
    targets.push({
      role: "client",
      name: appt.client_name,
      phone: clientPhone,
      text: clientText,
      wa_url: clientPhone ? `https://wa.me/${clientPhone}?text=${encodeURIComponent(clientText)}` : "",
    });
  }

  // Collect all items across related appointments grouped strictly by each professional_id
  const itemsByPro: Record<string, { appt: any; items: any[] }> = {};
  for (const a of relatedAppts) {
    const summary = buildSummary(a);
    const apptItems = summary.items || [];
    for (const it of apptItems) {
      const pid = it.professional_id || a.professional_id;
      if (!pid) continue;
      if (!itemsByPro[pid]) {
        itemsByPro[pid] = { appt: a, items: [] };
      }
      itemsByPro[pid].items.push(it);
    }
    if (a.professional_id && !itemsByPro[a.professional_id]) {
      itemsByPro[a.professional_id] = { appt: a, items: [] };
    }
  }

  // Add individual confirmation target for each selected professional with only their services
  for (const [pid, group] of Object.entries(itemsByPro)) {
    // If logged in as professional, skip notifying oneself
    if (user.role === "professional" && callerProIds.includes(pid)) continue;

    const pro = db.professionals.find((p) => p.id === pid) ||
                db.users.find((u) => u.id === pid);
    const phone = waPhone(pro?.phone || (pro as any)?.phone_digits);
    const proName = pro?.name || group.items[0]?.professional_name || "Profissional";
    const firstName = proName.split(" ")[0];
    const clientName = group.appt.client_name || appt.client_name || "Cliente";
    const clientPhone = group.appt.client_phone || appt.client_phone || "";

    const lines: string[] = [
      `✨ *${studioName}* ✨`,
      "",
      `Olá, ${firstName}! Novo agendamento na sua agenda 💛`,
      "",
      `👤 Cliente: *${clientName}*`,
    ];

    if (clientPhone) {
      lines.push(`📱 WhatsApp da cliente: +${waPhone(clientPhone)}`);
    }
    lines.push("");

    for (const it of group.items) {
      lines.push(`💅 *${it.service_name}* — ${it.duration_min} min`);
      lines.push(`   📅 ${fmtBr(it.start)}`);
    }

    if (group.appt.notes || appt.notes) {
      lines.push("");
      lines.push(`📝 Observações: ${group.appt.notes || appt.notes}`);
    }

    lines.push("");
    lines.push("Aguardando confirmação! 🌸");

    const text = lines.join("\n");
    targets.push({
      role: "professional",
      professional_id: pid,
      name: proName,
      phone,
      text,
      wa_url: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : "",
    });
  }

  return res.json({
    appointment_id: aid,
    status: appt.status,
    quick: Boolean(appt.quick),
    targets,
  });
});

api.get("/appointments/:aid/invite", requireAuth, (req: Request, res: Response) => {
  const { aid } = req.params;
  const appt = db.appointments.find((a) => a.id === aid);
  if (!appt) return res.status(404).json({ detail: "Agendamento não encontrado" });

  const summary = buildSummary(appt);
  const phone = waPhone(summary.client_phone);
  const text = `✨ Studio Aurea ✨\nOlá, ${summary.client_name}! Seu horário está confirmado 💛\nTotal: R$ ${summary.total.toFixed(2)}`;
  return res.json({
    text,
    phone,
    wa_url: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : "",
  });
});

// =========================
// 13. Referrals Endpoints
// =========================
api.get("/referrals/me", requireAuth, requireRole("client"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const friends = db.users
    .filter((u) => u.referred_by === user.id)
    .map((u) => ({
      id: u.id,
      name: u.name,
      referral_rewarded: u.referral_rewarded,
      created_at: u.created_at,
    }));
  const coupons = db.coupons.filter((c) => c.client_id === user.id);
  return res.json({
    referral_code: user.referral_code || "AMIGA1234",
    friends,
    coupons,
  });
});

api.get("/referrals", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const referred = filterTenant(db.users, user).filter((u) => u.referred_by);
  const list = referred.map((u) => {
    const referrer = db.users.find((ref) => ref.id === u.referred_by);
    return {
      id: u.id,
      name: u.name,
      referred_by: u.referred_by,
      referrer_name: referrer?.name || "Desconhecido",
      referral_rewarded: Boolean(u.referral_rewarded),
    };
  });
  return res.json(list);
});

api.post("/referrals/manual", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const { referrer_id, referred_id } = req.body;
  const user = (req as any).user;
  const coupon = {
    id: uid(),
    code: `INDICA${Math.floor(100000 + Math.random() * 900000)}`,
    discount_percent: 10,
    scope: "studio",
    client_id: referrer_id,
    active: true,
    uses: 0,
    max_uses: 1,
    studio_id: user.studio_id,
    created_at: nowUtc(),
  };
  db.coupons.push(coupon);
  saveDb();
  return res.json(coupon);
});

// =========================
// 14. Notifications Endpoints
// =========================
api.get("/notifications", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const notifs = db.notifications
    .filter((n) => n.user_id === user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json(notifs);
});

api.post("/notifications/:nid/read", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { nid } = req.params;
  const notif = db.notifications.find((n) => n.id === nid && n.user_id === user.id);
  if (notif) {
    notif.read = true;
    saveDb();
  }
  return res.json({ ok: true });
});

// =========================
// 15. Dashboard & Reports
// =========================
api.get("/dashboard", requireAuth, requireRole("manager"), (req: Request, res: Response) => {
  const user = (req as any).user;
  const appts = filterTenant(db.appointments, user);
  const active = appts.filter((a) => !["cancelled", "refused"].includes(a.status));

  let totalScheduled = 0;
  let totalSignals = 0;

  active.forEach((a) => {
    const s = buildSummary(a);
    totalScheduled += s.total;
    if (a.signal_paid) {
      totalSignals += s.signal_value;
    }
  });

  const totalClients = filterTenant(db.users, user).filter((u) => u.role === "client").length;
  const couponsUsed = appts.filter((a) => a.coupon_code).length;

  return res.json({
    today: active.length,
    week: active.length,
    month: active.length,
    confirmed: appts.filter((a) => a.status === "confirmed").length,
    waiting: appts.filter((a) => a.status === "waiting").length,
    cancelled: appts.filter((a) => ["cancelled", "refused"].includes(a.status)).length,
    total_scheduled: Math.round(totalScheduled * 100) / 100,
    signals_received: Math.round(totalSignals * 100) / 100,
    remaining: Math.round((totalScheduled - totalSignals) * 100) / 100,
    total_clients: totalClients,
    coupons_used: couponsUsed,
  });
});

api.get("/reports/monthly", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { month } = req.query as { month?: string };
  const targetMonth = month || new Date().toISOString().substring(0, 7);

  const appts = filterTenant(db.appointments, user);
  let gross = 0;
  let discount = 0;
  let net = 0;
  const statuses: any = { open: 0, waiting: 0, confirmed: 0, completed: 0, cancelled: 0 };

  appts.forEach((a) => {
    const s = buildSummary(a);
    gross += s.subtotal;
    discount += s.discount;
    net += s.total;
    statuses[a.status] = (statuses[a.status] || 0) + 1;
  });

  return res.json({
    month: targetMonth,
    appointments: appts.length,
    statuses,
    gross: Math.round(gross * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    net: Math.round(net * 100) / 100,
    cancellations: [],
    professionals: [],
  });
});

// =========================
// Mount API Router
// =========================
app.use("/api", api);

// =========================
// Vite Dev Server / Static Hosting
// =========================
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Studio Aurea] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
