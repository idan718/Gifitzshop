// importing required modules
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');

// Initialize Express app
const port = 3001;
const app = express();
app.set('trust proxy', 1);

// Database file path
const DB_PATH = path.join(__dirname, 'DB.json');
const SESSIONS_PATH = path.join(__dirname, 'sessions.json');
const INVENTORY_PATH = path.join(__dirname, 'inventory.json');
const PURCHASES_PATH = path.join(__dirname, 'purchases.json');
const LOGIN_TICKETS_PATH = path.join(__dirname, 'loginTickets.json');
const CATEGORIES_PATH = path.join(__dirname, 'categories.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours of inactivity invalidates a session
const SESSION_CLOSE_GRACE_MS = Number(process.env.SESSION_CLOSE_GRACE_MS || 15_000);
const LOGIN_CODE_TTL_MS = Number(process.env.LOGIN_CODE_TTL_MS || 10 * 60 * 1000);
const MAX_SESSIONS_PER_USER = Number(process.env.MAX_SESSIONS_PER_USER || 1);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51RMLa82flqUWGmzSnvstRo7chn6psJfPMd45jLTQxpMuz52oMsA3x5ih9AdSWMtK2rYwW1AXUgjNtZOoApabg4X100UUTJa55A';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51RMLa82flqUWGmzS8X8Q118uzFbXmbsOPVpg9JygBIDMvloAoXpj2oCrs24sVWiVi4JaWidGLU9pNG3SoxRKuVnO00ex2sdStm';
const stripe = new Stripe(STRIPE_SECRET_KEY);
const SCRIPT_GUARD_PATTERN = /<\s*\/\?\s*script\b|<\s*iframe|javascript\s*:|vbscript\s*:|data\s*:[^,]*,|on\w+\s*=|srcdoc\s*=|eval\s*\(|Function\s*\(|setTimeout\s*\(|setInterval\s*\(/i;
const SAFE_URL_PROTOCOLS = ['http:', 'https:'];
const RELATIVE_URL_PATTERN = /^\/[A-Za-z0-9._/-]*$/;
const RELATIVE_FILE_SEGMENT_PATTERN = /^[A-Za-z0-9._/-]+$/;
const RELATIVE_PARENT_SEGMENT_PATTERN = /(?:^|\/)\.\.(?:\/|$)/;
const DATA_URI_IMAGE_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,[a-zA-Z0-9+/=\s]+$/i;
const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127(?:\.\d{1,3}){3}$/i,
  /^0\.0\.0\.0$/i,
  /^10(?:\.\d{1,3}){3}$/i,
  /^192\.168(?:\.\d{1,3}){2}$/i,
  /^172\.(1[6-9]|2[0-9]|3[0-1])(?:\.\d{1,3}){2}$/i,
  /^169\.254(?:\.\d{1,3}){2}$/i,
  /^::1$/i,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i
];
const MAX_ALLOWED_URL_LENGTH = Number(process.env.MAX_ALLOWED_URL_LENGTH || 2048);
const MAX_DATA_URI_LENGTH = Number(process.env.MAX_DATA_URI_LENGTH || 5_000_000);
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const MAX_CART_ITEM_QUANTITY = 20;
const MAX_ITEM_IMAGES = Number(process.env.MAX_ITEM_IMAGES || 8);
const VERIFICATION_CODE_TTL_MS = Number(process.env.VERIFICATION_CODE_TTL_MS || 5 * 60 * 1000);
const HUMAN_TIME_LOCALE = process.env.HUMAN_TIME_LOCALE || 'he-IL';
const HUMAN_TIME_TIMEZONE = process.env.HUMAN_TIME_TIMEZONE || 'Asia/Jerusalem';
const GLOBAL_RATE_LIMIT_WINDOW_MS = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const GLOBAL_RATE_LIMIT = Number(process.env.GLOBAL_RATE_LIMIT || 1000);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const AUTH_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT || 10);
const SMTP_HOST = process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io';
const SMTP_PORT = Number(process.env.SMTP_PORT || 2525);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_REQUIRE_TLS = process.env.SMTP_REQUIRE_TLS === 'true';

const globalLimiter = rateLimit({
  windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: GLOBAL_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'תדירות הבקשות חורגת מהמותר. נסו שוב בעוד מספר דקות.' })
});

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'בוצעו יותר מדי ניסיונות אימות. המתינו מעט ונסו שוב.' })
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(blockJavascriptPayload);
app.use(globalLimiter);

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    writeJSON(filePath, defaultValue);
  }
}

ensureFile(DB_PATH, []);
ensureFile(INVENTORY_PATH, []);
ensureFile(SESSIONS_PATH, []);
ensureFile(PURCHASES_PATH, []);
ensureFile(LOGIN_TICKETS_PATH, []);
ensureFile(CATEGORIES_PATH, []);

function readJSON(filePath, fallback = []) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadSessions() {
  return readJSON(SESSIONS_PATH, []);
}

function saveSessions(sessions) {
  writeJSON(SESSIONS_PATH, sessions);
}

function loadInventory() {
  return readJSON(INVENTORY_PATH, []).map(attachImageMetadata);
}

function saveInventory(items) {
  writeJSON(INVENTORY_PATH, items);
}

function loadUsers() {
  return readJSON(DB_PATH, []);
}

function saveUsers(users) {
  writeJSON(DB_PATH, users);
}

function loadPurchases() {
  return readJSON(PURCHASES_PATH, []);
}

function loadCategories() {
  return readJSON(CATEGORIES_PATH, []);
}

function saveCategories(categories) {
  writeJSON(CATEGORIES_PATH, categories);
}

function loadLoginTickets() {
  return readJSON(LOGIN_TICKETS_PATH, []);
}

function saveLoginTickets(tickets) {
  writeJSON(LOGIN_TICKETS_PATH, tickets);
}

function sanitizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/[<>`]/g, '').trim();
}

function isPrivateHostname(hostname) {
  if (!hostname) {
    return true;
  }
  const normalized = hostname.toLowerCase();
  if (PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  return normalized.endsWith('.local');
}

function sanitizeUrl(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const cleaned = sanitizeText(value);
  if (!cleaned) {
    return null;
  }
  const trimmed = cleaned.trim();
  if (!trimmed) {
    return null;
  }

  const lowerTrimmed = trimmed.toLowerCase();
  if (lowerTrimmed.startsWith('data:')) {
    if (trimmed.length > MAX_DATA_URI_LENGTH) {
      return null;
    }
    return DATA_URI_IMAGE_PATTERN.test(trimmed) ? trimmed : null;
  }

  if (trimmed.length > MAX_ALLOWED_URL_LENGTH) {
    return null;
  }

  if (!trimmed.includes('://')) {
    if (trimmed.includes('//')) {
      return null;
    }
    if (RELATIVE_PARENT_SEGMENT_PATTERN.test(trimmed)) {
      return null;
    }
    if (RELATIVE_URL_PATTERN.test(trimmed) || RELATIVE_FILE_SEGMENT_PATTERN.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (!SAFE_URL_PROTOCOLS.includes(protocol)) {
      return null;
    }
    if (isPrivateHostname(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function collectSafeImageValues(input) {
  if (input === null || input === undefined) {
    return { normalized: [], rejected: 0 };
  }
  const rawList = Array.isArray(input) ? input : [input];
  const normalized = [];
  let rejected = 0;
  for (const entry of rawList) {
    if (normalized.length >= MAX_ITEM_IMAGES) {
      break;
    }
    const safeValue = sanitizeUrl(entry);
    if (safeValue) {
      normalized.push(safeValue);
    } else {
      rejected += 1;
    }
  }
  return { normalized, rejected };
}

function isClearingImageValue(value) {
  if (value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'string') {
    return !sanitizeText(value);
  }
  return false;
}

function isSafeDataUri(value) {
  if (typeof value !== 'string') {
    return false;
  }
  if (value.length > MAX_DATA_URI_LENGTH) {
    return false;
  }
  return DATA_URI_IMAGE_PATTERN.test(value.trim());
}

function containsJavascriptPayload(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    if (isSafeDataUri(value)) {
      return false;
    }
    return SCRIPT_GUARD_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsJavascriptPayload);
  }
  if (typeof value === 'object') {
    return Object.values(value).some(containsJavascriptPayload);
  }
  return false;
}

function blockJavascriptPayload(req, res, next) {
  const includesJavascript = containsJavascriptPayload(req?.body) || containsJavascriptPayload(req?.query) || containsJavascriptPayload(req?.params);
  if (includesJavascript) {
    return res.status(400).json({ message: 'קלט לא יכול להכיל קוד JavaScript. הסירו את הקוד ונסו שוב.' });
  }
  return next();
}

function isEmptyOrScripted(value, { allowSpecial = false } = {}) {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  if (SCRIPT_GUARD_PATTERN.test(raw)) {
    return true;
  }
  const text = allowSpecial ? raw.trim() : sanitizeText(raw);
  return !text;
}

function getSafeText(value) {
  if (isEmptyOrScripted(value)) {
    return null;
  }
  return sanitizeText(value);
}

function normalizeImageList(input) {
  if (input === null || input === undefined) {
    return [];
  }
  const { normalized } = collectSafeImageValues(input);
  return normalized;
}

function attachImageMetadata(item) {
  const sourceImages = Array.isArray(item?.itemImages) && item.itemImages.length
    ? item.itemImages
    : item?.itemImage
      ? [item.itemImage]
      : [];
  const normalizedImages = normalizeImageList(sourceImages);
  return {
    ...item,
    itemImages: normalizedImages,
    itemImage: normalizedImages.length ? normalizedImages[0] : null
  };
}

function applyImageUpdate(target, images) {
  const normalized = normalizeImageList(images);
  target.itemImages = normalized;
  target.itemImage = normalized.length ? normalized[0] : null;
}

function formatHumanTimestamp(input) {
  const date = typeof input === 'number' ? new Date(input) : new Date(String(input));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(HUMAN_TIME_LOCALE, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: false,
      timeZone: HUMAN_TIME_TIMEZONE
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function validateRequiredFields(fields, res) {
  for (const { value, name, type } of fields) {
    if (type === 'email') {
      if (isEmptyOrScripted(value, { allowSpecial: true })) {
        res.status(400).json({ message: `${name} is invalid.` });
        return false;
      }
      const email = String(value).trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        res.status(400).json({ message: `${name} is invalid.` });
        return false;
      }
      continue;
    }

    if (type === 'password') {
      if (isEmptyOrScripted(value, { allowSpecial: true })) {
        res.status(400).json({ message: `${name} cannot be empty or contain scripts.` });
        return false;
      }
      continue;
    }

    if (isEmptyOrScripted(value)) {
      res.status(400).json({ message: `${name} cannot be empty or contain scripts.` });
      return false;
    }
  }
  return true;
}

function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function createSession(userId, options = {}) {
  const sessions = loadSessions();
  if (MAX_SESSIONS_PER_USER > 0) {
    const normalizedUserId = String(userId);
    const sameUserSessions = sessions
      .filter((session) => String(session.userId) === normalizedUserId)
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    const keepExistingCount = Math.max(0, MAX_SESSIONS_PER_USER - 1);
    const sessionsToKeep = sameUserSessions.slice(0, keepExistingCount);

    const filteredSessions = sessions.filter(
      (session) => String(session.userId) !== normalizedUserId
    );

    sessions.length = 0; // mutate array in place to avoid accidental reassignments
    sessions.push(...filteredSessions, ...sessionsToKeep);
  }
  const newSession = {
    id: generateSessionId(),
    userId,
    loggedIn: options.loggedIn !== undefined ? Boolean(options.loggedIn) : true,
    cart: [],
    lastSeen: Date.now(),
    admin: Boolean(options.admin),
    owner: Boolean(options.owner),
    closingSoonExpiresAt: null
  };
  sessions.push(newSession);
  saveSessions(sessions);
  return newSession;
}

function getSessionIdFromRequest(req) {
  const candidate = (req.body && req.body.sessionId) || req.query.sessionId || req.headers['x-session-id'] || null;
  return getSafeText(candidate);
}

function removeSession(sessionId) {
  const safeSessionId = getSafeText(sessionId);
  if (!safeSessionId) {
    return false;
  }
  const sessions = loadSessions();
  const filtered = sessions.filter((session) => session.id !== safeSessionId);
  if (filtered.length === sessions.length) {
    return false;
  }
  saveSessions(filtered);
  return true;
}

function getSession(sessionId) {
  const safeSessionId = getSafeText(sessionId);
  if (!safeSessionId) {
    return null;
  }
  const sessions = loadSessions();
  const index = sessions.findIndex((session) => session.id === safeSessionId);
  if (index === -1) {
    return null;
  }
  return { session: sessions[index], sessions, index };
}

function touchSession(sessionWrapper) {
  const { session, sessions, index } = sessionWrapper;
  session.lastSeen = Date.now();
  session.closingSoonExpiresAt = null;
  sessions[index] = session;
  saveSessions(sessions);
}

function removeUserSessions(userId) {
  const sessions = loadSessions();
  const filtered = sessions.filter((session) => String(session.userId) !== String(userId));
  if (filtered.length !== sessions.length) {
    saveSessions(filtered);
  }
}

function markSessionClosing(sessionId, graceMs = SESSION_CLOSE_GRACE_MS) {
  const safeSessionId = getSafeText(sessionId);
  if (!safeSessionId) {
    return null;
  }
  const wrapper = getSession(safeSessionId);
  if (!wrapper) {
    return null;
  }
  wrapper.session.closingSoonExpiresAt = Date.now() + Math.max(1_000, Number(graceMs) || SESSION_CLOSE_GRACE_MS);
  wrapper.sessions[wrapper.index] = wrapper.session;
  saveSessions(wrapper.sessions);
  return wrapper.session;
}

function createLoginTicket({ userId, code, admin, owner, method }) {
  const tickets = loadLoginTickets().filter(
    (ticket) => !(String(ticket.userId) === String(userId) && ticket.method === method)
  );
  const createdAt = Date.now();
  const expiresAt = createdAt + LOGIN_CODE_TTL_MS;
  const ticket = {
    id: generateSessionId(),
    userId,
    code: String(code),
    admin: Boolean(admin),
    owner: Boolean(owner),
    method: method || 'password',
    createdAt,
    createdAtHuman: formatHumanTimestamp(createdAt),
    expiresAt,
    expiresAtHuman: formatHumanTimestamp(expiresAt)
  };
  tickets.push(ticket);
  saveLoginTickets(tickets);
  return ticket;
}

function consumeLoginTicket(ticketId, code, method) {
  const safeTicketId = getSafeText(ticketId);
  const normalizedCode = sanitizeText(String(code ?? ''));
  if (!safeTicketId || !normalizedCode) {
    return { status: 'invalid' };
  }
  const tickets = loadLoginTickets();
  const index = tickets.findIndex((entry) => entry.id === safeTicketId);
  if (index === -1) {
    return { status: 'not_found' };
  }
  const ticket = tickets[index];
  if (method && ticket.method !== method) {
    return { status: 'method_mismatch' };
  }
  const now = Date.now();
  if (ticket.expiresAt && now > ticket.expiresAt) {
    tickets.splice(index, 1);
    saveLoginTickets(tickets);
    return { status: 'expired' };
  }
  if (String(ticket.code) !== normalizedCode) {
    return { status: 'mismatch' };
  }
  tickets.splice(index, 1);
  saveLoginTickets(tickets);
  return { status: 'ok', ticket };
}

function purgeExpiredLoginTickets() {
  const tickets = loadLoginTickets();
  if (!tickets.length) {
    return;
  }
  const now = Date.now();
  const fresh = tickets.filter((ticket) => !ticket.expiresAt || now <= ticket.expiresAt);
  if (fresh.length !== tickets.length) {
    saveLoginTickets(fresh);
  }
}

function requireAdminSession(req, res) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    res.status(401).json({ message: 'Session ID is required' });
    return null;
  }
  const wrapper = getSession(sessionId);
  if (!wrapper || !wrapper.session.loggedIn) {
    res.status(401).json({ message: 'Session not found or expired' });
    return null;
  }
  if (!wrapper.session.admin) {
    res.status(403).json({ message: 'Admin privileges required.' });
    return null;
  }
  return wrapper;
}

function requireOwnerSession(req, res) {
  const wrapper = requireAdminSession(req, res);
  if (!wrapper) {
    return null;
  }
  if (!wrapper.session.owner) {
    res.status(403).json({ message: 'Owner privileges required.' });
    return null;
  }
  return wrapper;
}

function generateTemporaryPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
}

function cleanupSessions() {
  const sessions = loadSessions();
  const now = Date.now();
  const fresh = sessions.filter((session) => {
    if (session.closingSoonExpiresAt && now >= session.closingSoonExpiresAt) {
      return false;
    }
    if (!session.loggedIn) {
      return false;
    }
    return now - (session.lastSeen || 0) <= SESSION_TTL_MS;
  });
  if (fresh.length !== sessions.length) {
    saveSessions(fresh);
  }
}

setInterval(() => {
  cleanupSessions();
  purgeExpiredLoginTickets();
}, 15 * 1000);

function normalizeCartItems(cart) {
  const inventory = loadInventory();
  let total = 0;
  const items = (cart || []).map((entry) => {
    const product = inventory.find((p) => String(p.id) === String(entry.id));
    const unitPrice = product ? Number(product.itemPriceILS) : Number(entry.priceILS);
    const priceILS = isNaN(unitPrice) ? 0 : unitPrice;
    const quantity = Number(entry.quantity) || 0;
    const subtotal = priceILS * quantity;
    total += subtotal;
    return {
      id: entry.id,
      name: entry.name || product?.itemName || 'Item',
      quantity,
      priceILS,
      subtotal,
      imageUrl: entry.imageUrl || product?.itemImages?.[0] || product?.itemImage || ''
    };
  });
  return { items, total };
}

// Nodemailer email sender
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: SMTP_REQUIRE_TLS,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
});

app.post('/contact-message', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!validateRequiredFields([
    { value: name, name: 'Name' },
    { value: email, name: 'Email', type: 'email' },
    { value: message, name: 'Message' }
  ], res)) {
    return;
  }

  const safeName = sanitizeText(name);
  const safeEmail = sanitizeText(email).toLowerCase();
  const safeMessage = sanitizeText(message);

  try {
    await transporter.sendMail({
      from: 'support@giftiz.com',
      to: 'giftizofficalsupport@gmail.com',
      subject: `New contact message from ${safeName}`,
      text: `From: ${safeName} <${safeEmail}>
Message:
${safeMessage}`
    });
    return res.status(200).json({ message: 'ההודעה נשלחה בהצלחה. נחזור אליכם בהקדם.' });
  } catch (error) {
    console.error('Contact email failed', error);
    return res.status(500).json({ message: 'שליחת ההודעה נכשלה. נסו שוב מאוחר יותר.' });
  }
});

app.get('/items', (req, res) => {
  const inventory = loadInventory();
  const rawCategory = req.query.categoryId;
  if (rawCategory === undefined) {
    return res.status(200).json(inventory);
  }

  const normalizedCategoryId = Number(rawCategory);
  if (!Number.isInteger(normalizedCategoryId)) {
    return res.status(400).json({ message: 'Invalid category filter.' });
  }

  const filtered = inventory.filter((item) => Number(item.categoryId) === normalizedCategoryId);
  return res.status(200).json(filtered);
});

app.get('/categories', (req, res) => {
  return res.status(200).json(loadCategories());
});

app.get('/search', (req, res) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
  const normalizedQuery = sanitizeText(rawQuery).toLowerCase();
  const rawCategoryId = req.query.categoryId;
  const hasCategoryFilter = rawCategoryId !== undefined;

  let normalizedCategoryId = null;
  if (hasCategoryFilter) {
    normalizedCategoryId = Number(rawCategoryId);
    if (!Number.isInteger(normalizedCategoryId)) {
      return res.status(400).json({ message: 'Invalid category filter.' });
    }
  }

  const categories = loadCategories();
  const items = loadInventory();
  const scopedItems = hasCategoryFilter
    ? items.filter((item) => Number(item.categoryId) === normalizedCategoryId)
    : items;

  const matchingItems = normalizedQuery
    ? scopedItems.filter((item) => {
        const name = typeof item.itemName === 'string' ? item.itemName : '';
        return name.toLowerCase().includes(normalizedQuery);
      })
    : hasCategoryFilter
      ? scopedItems
      : [];

  const matchingCategories = hasCategoryFilter
    ? []
    : normalizedQuery
      ? categories.filter((category) => (category?.name || '').toLowerCase().includes(normalizedQuery))
      : categories;

  return res.status(200).json({ items: matchingItems, categories: matchingCategories });
});
// signup endpoint (only save after email verification)
app.post('/signup', authLimiter, async (req, res) => {
  const { name, pwd, userEmail } = req.body;

  if (!validateRequiredFields([
    { value: name, name: 'Name' },
    { value: pwd, name: 'Password', type: 'password' },
    { value: userEmail, name: 'Email', type: 'email' }
  ], res)) {
    return;
  }

  const safeName = sanitizeText(name);
  const safeEmail = sanitizeText(userEmail).toLowerCase();
  const normalizedPassword = typeof pwd === 'string' ? pwd.trim() : String(pwd ?? '');

  fs.readFile(DB_PATH, 'utf8', async (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading database' });
    }

    let db = [];
    try {
      db = JSON.parse(data);
    } catch (parseErr) {
      return res.status(500).json({ message: 'Error parsing database' });
    }

    // Hash the password
    const hashedPwd = await bcrypt.hash(normalizedPassword, 10);

    if (db.some((u) => u.userEmail === safeEmail)) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate email verification code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

    // Try sending email first
    try {
      await transporter.sendMail({
        from: 'YOUR_EMAIL@gmail.com',
        to: safeEmail,
        subject: 'Verify your email',
        text: `Your verification code is: ${verificationCode}`
      });

      // Only save user after email successfully sent
      let newId = 1;
      if (db.length > 0) newId = db[db.length - 1].id + 1;

      const targetUser = {
        id: newId,
        name: safeName,
        pwd: hashedPwd,
        userEmail: safeEmail,
        admin: false,
        verified: false,
        verificationCode,
        verificationCodeExpiresAt: Date.now() + VERIFICATION_CODE_TTL_MS
      };

      db.push(targetUser);

      fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ message: 'Error writing to database' });
        }

        res.status(200).json({
          message: 'User signed up successfully, verification email sent',
          userId: targetUser.id
        });
      });

    } catch (emailErr) {
      return res.status(400).json({
        message: 'Email does not exist or cannot receive messages'
      });
    }
  });
});

// verify endpoint
// verify endpoint (delete user if wrong code)
app.post('/verify', authLimiter, (req, res) => {
  const { userId, code } = req.body;

  if (!validateRequiredFields([
    { value: userId, name: 'User ID' },
    { value: code, name: 'Verification code' }
  ], res)) {
    return;
  }

  const normalizedUserId = Number(userId);
  const normalizedCode = sanitizeText(String(code));
  if (!Number.isInteger(normalizedUserId)) {
    return res.status(400).json({ message: 'User ID is invalid.' });
  }

  fs.readFile(DB_PATH, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading database' });
    }

    let db = JSON.parse(data);
    const user = db.find(u => u.id === normalizedUserId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = Date.now();
    const storedCode = sanitizeText(String(user.verificationCode ?? ''));
    const isExpired = Boolean(user.verificationCodeExpiresAt) && now > Number(user.verificationCodeExpiresAt);

    if (isExpired) {
      delete user.verificationCode;
      delete user.verificationCodeExpiresAt;
      return fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ message: 'Failed to update verification status.' });
        }
        return res.status(410).json({ message: 'Verification code expired. Please request a new one.' });
      });
    }

    if (!storedCode || storedCode !== normalizedCode) {
      return res.status(400).json({ message: 'Invalid verification code. Please try again.' });
    }

    // Correct code → mark verified
    user.verified = true;
    delete user.verificationCode;
    delete user.verificationCodeExpiresAt;

    fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (writeErr) => {
      if (writeErr) {
        return res.status(500).json({ message: 'Failed to update verification status.' });
      }

      const session = createSession(user.id, { admin: Boolean(user.admin), owner: Boolean(user.owner) });
      res.status(200).json({
        message: 'Email verified successfully',
        sessionId: session.id,
        userId: user.id,
        admin: Boolean(user.admin)
      });
    });
  });
});


// login endpoint
app.post('/login', authLimiter, async (req, res) => {
  const { name, pwd } = req.body;

  if (!validateRequiredFields([
    { value: name, name: 'Name' },
    { value: pwd, name: 'Password', type: 'password' }
  ], res)) {
    return;
  }

  const safeName = sanitizeText(name);

  fs.readFile(DB_PATH, 'utf8', async (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading database' });
    }

    let db = JSON.parse(data);

    const user = db.find(u => u.name === safeName);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.verified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    // Compare hashed password
    const normalizedPassword = typeof pwd === 'string' ? pwd.trim() : String(pwd ?? '');
    const match = await bcrypt.compare(normalizedPassword, user.pwd);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const safeEmailTarget = sanitizeText(user.userEmail).toLowerCase();
    if (!safeEmailTarget) {
      return res.status(500).json({ message: 'User email is invalid.' });
    }

    const loginCode = String(Math.floor(100000 + Math.random() * 900000));
    try {
      await transporter.sendMail({
        from: 'security@giftiz.com',
        to: safeEmailTarget,
        subject: 'קוד אימות להתחברות Giftiz',
        text: `קוד האימות שלכם הוא: ${loginCode}`
      });
    } catch (emailErr) {
      console.error('Failed to send primary login code', emailErr);
      return res.status(500).json({ message: 'לא ניתן לשלוח קוד אימות כעת. נסו שוב בעוד מספר דקות.' });
    }

    const ticket = createLoginTicket({
      userId: user.id,
      code: loginCode,
      admin: Boolean(user.admin),
      owner: Boolean(user.owner),
      method: 'password'
    });

    return res.status(200).json({
      message: 'קוד האימות נשלח אליכם. הזינו אותו כדי להשלים את ההתחברות.',
      ticketId: ticket.id,
      requiresLoginCode: true
    });
  });
});

app.post('/login/verify-code', authLimiter, (req, res) => {
  const { ticketId, code } = req.body || {};
  if (!ticketId || !code) {
    return res.status(400).json({ message: 'נדרש מזהה אסימון וקוד אימות.' });
  }

  const result = consumeLoginTicket(ticketId, code, 'password');
  switch (result.status) {
    case 'invalid':
      return res.status(400).json({ message: 'הבקשה אינה תקינה.' });
    case 'not_found':
      return res.status(404).json({ message: 'הבקשה לא נמצאה או שפג תוקפה.' });
    case 'method_mismatch':
      return res.status(400).json({ message: 'סוג ההתחברות אינו תואם.' });
    case 'expired':
      return res.status(410).json({ message: 'תוקף קוד האימות פג. נסו שוב.' });
    case 'mismatch':
      return res.status(400).json({ message: 'קוד האימות שגוי.' });
    case 'ok':
      break;
    default:
      return res.status(500).json({ message: 'שגיאת התחברות לא צפויה.' });
  }

  const ticket = result.ticket;
  if (!ticket) {
    return res.status(500).json({ message: 'שגיאת התחברות לא צפויה.' });
  }

  const session = createSession(ticket.userId, {
    admin: Boolean(ticket.admin),
    owner: Boolean(ticket.owner),
    loggedIn: true
  });

  return res.status(200).json({
    message: 'האימות הושלם בהצלחה.',
    sessionId: session.id,
    userId: session.userId,
    admin: Boolean(session.admin),
    owner: Boolean(session.owner)
  });
});

app.post('/login-email', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!validateRequiredFields([
    { value: email, name: 'Email', type: 'email' }
  ], res)) {
    return;
  }

  const safeEmail = sanitizeText(email).toLowerCase();
  const users = loadUsers();
  const user = users.find((entry) => entry.userEmail === safeEmail);
  if (!user) {
    return res.status(404).json({ message: 'לא נמצא משתמש עם כתובת הדוא"ל הזו.' });
  }
  if (!user.verified) {
    return res.status(403).json({ message: 'החשבון עדיין לא אומת. אנא השלימו תהליך הרשמה.' });
  }

  const loginCode = String(Math.floor(100000 + Math.random() * 900000));
  try {
    await transporter.sendMail({
      from: 'security@giftiz.com',
      to: safeEmail,
      subject: 'קוד התחברות ל-Giftiz',
      text: `קוד ההתחברות החד-פעמי שלכם הוא: ${loginCode}`
    });
  } catch (error) {
    console.error('Failed to send email login code', error);
    return res.status(500).json({ message: 'לא ניתן לשלוח קוד אימות כרגע. נסו שוב בעוד מספר דקות.' });
  }

  const ticket = createLoginTicket({
    userId: user.id,
    code: loginCode,
    admin: Boolean(user.admin),
    owner: Boolean(user.owner),
    method: 'email'
  });

  return res.status(200).json({
    message: 'קוד אימות נשלח למייל. הזינו אותו כדי להשלים את ההתחברות.',
    ticketId: ticket.id,
    requiresEmailCode: true
  });
});

app.post('/login-email/verify-code', authLimiter, (req, res) => {
  const { ticketId, code } = req.body || {};
  if (!ticketId || !code) {
    return res.status(400).json({ message: 'נדרש מזהה אסימון וקוד אימות.' });
  }

  const result = consumeLoginTicket(ticketId, code, 'email');
  switch (result.status) {
    case 'invalid':
      return res.status(400).json({ message: 'הבקשה אינה תקינה.' });
    case 'not_found':
      return res.status(404).json({ message: 'הבקשה לא נמצאה או שפג תוקפה.' });
    case 'method_mismatch':
      return res.status(400).json({ message: 'סוג ההתחברות אינו תואם.' });
    case 'expired':
      return res.status(410).json({ message: 'תוקף קוד האימות פג. נסו שוב.' });
    case 'mismatch':
      return res.status(400).json({ message: 'קוד האימות שגוי.' });
    case 'ok':
      break;
    default:
      return res.status(500).json({ message: 'שגיאת התחברות לא צפויה.' });
  }

  const ticket = result.ticket;
  if (!ticket) {
    return res.status(500).json({ message: 'שגיאת התחברות לא צפויה.' });
  }

  const session = createSession(ticket.userId, {
    admin: Boolean(ticket.admin),
    owner: Boolean(ticket.owner),
    loggedIn: true
  });

  return res.status(200).json({
    message: 'התחברות הושלמה בהצלחה.',
    sessionId: session.id,
    userId: session.userId,
    admin: Boolean(session.admin),
    owner: Boolean(session.owner)
  });
});

// forgot-password endpoint
app.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!validateRequiredFields([
    { value: email, name: 'Email', type: 'email' }
  ], res)) {
    return;
  }

  const safeEmail = sanitizeText(email).toLowerCase();

  fs.readFile(DB_PATH, 'utf8', async (err, data) => {
    if (err) return res.status(500).json({ message: 'Error reading database' });

    let db = JSON.parse(data);
    const user = db.find(u => u.userEmail === safeEmail);
    if (!user) return res.status(404).json({ message: 'Email not found' });

    // generate temporary reset code
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = resetCode;

    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

    try {
      await transporter.sendMail({
        from: 'YOUR_EMAIL@gmail.com',
        to: safeEmail,
        subject: 'Password Reset Code',
        text: `Your password reset code is: ${resetCode}`
      });
      res.status(200).json({ message: 'Reset code sent to email' });
    } catch {
      res.status(500).json({ message: 'Failed to send email' });
    }
  });
});

app.post('/forgot-password/verify-code', authLimiter, (req, res) => {
  const { email, code } = req.body || {};
  if (!validateRequiredFields([
    { value: email, name: 'Email', type: 'email' },
    { value: code, name: 'Verification code' }
  ], res)) {
    return;
  }

  const safeEmail = sanitizeText(email).toLowerCase();
  const normalizedCode = sanitizeText(String(code));
  if (!normalizedCode) {
    return res.status(400).json({ message: 'Verification code is invalid.' });
  }

  const users = loadUsers();
  const user = users.find((entry) => entry.userEmail === safeEmail);
  if (!user || !user.resetCode) {
    return res.status(404).json({ message: 'Reset request not found.' });
  }

  if (String(user.resetCode) !== normalizedCode) {
    return res.status(400).json({ message: 'Verification code is incorrect.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetToken = resetToken;
  saveUsers(users);

  return res.status(200).json({ message: 'Verification successful. המשיכו להגדרת סיסמה חדשה.', resetToken });
});

app.post('/forgot-password/reset', authLimiter, async (req, res) => {
  const { email, resetToken, newPassword } = req.body || {};
  if (!validateRequiredFields([
    { value: email, name: 'Email', type: 'email' },
    { value: resetToken, name: 'Reset token' },
    { value: newPassword, name: 'New password', type: 'password' }
  ], res)) {
    return;
  }

  const safeEmail = sanitizeText(email).toLowerCase();
  const safeToken = sanitizeText(resetToken);
  if (!safeToken) {
    return res.status(400).json({ message: 'Reset token is invalid.' });
  }

  const normalizedPassword = typeof newPassword === 'string' ? newPassword.trim() : String(newPassword ?? '');
  if (!normalizedPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  const users = loadUsers();
  const user = users.find((entry) => entry.userEmail === safeEmail);
  if (!user || !user.resetToken) {
    return res.status(404).json({ message: 'Reset session not found.' });
  }

  if (user.resetToken !== safeToken) {
    return res.status(400).json({ message: 'Reset token is incorrect or expired.' });
  }

  try {
    const hashed = await bcrypt.hash(normalizedPassword, 10);
    user.pwd = hashed;
    delete user.resetToken;
    delete user.resetCode;
    saveUsers(users);
    removeUserSessions(user.id);
    return res.status(200).json({ message: 'הסיסמה עודכנה בהצלחה. התחברו באמצעות הסיסמה החדשה.' });
  } catch (error) {
    console.error('Failed to reset password', error);
    return res.status(500).json({ message: 'לא ניתן לעדכן את הסיסמה כעת.' });
  }
});

app.post('/logout', (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID is required' });
  }

  const removed = removeSession(sessionId);
  if (!removed) {
    return res.status(404).json({ message: 'Session not found' });
  }

  return res.status(200).json({ message: 'Logged out successfully' });
});

app.delete('/sessions/:sessionId', (req, res) => {
  const removed = removeSession(req.params.sessionId);
  if (!removed) {
    return res.status(404).json({ message: 'Session not found' });
  }
  return res.status(200).json({ message: 'Session deleted' });
});

app.post('/sessions/:sessionId/ping', (req, res) => {
  const wrapper = getSession(req.params.sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found' });
  }
  touchSession(wrapper);
  return res.status(200).json({ message: 'Session updated' });
});

app.post('/sessions/:sessionId/close-intent', (req, res) => {
  const session = markSessionClosing(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ message: 'Session not found' });
  }
  return res.status(200).json({ message: 'Session scheduled for closure.' });
});

app.get('/sessions/:sessionId/admin', (req, res) => {
  const wrapper = getSession(req.params.sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found' });
  }
  touchSession(wrapper);
  return res.status(200).json({
    admin: Boolean(wrapper.session.admin),
    owner: Boolean(wrapper.session.owner)
  });
});

app.get('/sessions/:sessionId/owner-access', (req, res) => {
  const wrapper = getSession(req.params.sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found' });
  }
  if (!wrapper.session.loggedIn) {
    return res.status(401).json({ message: 'Session expired or inactive' });
  }
  if (!wrapper.session.owner) {
    return res.status(403).json({ message: 'Owner privileges required.' });
  }
  touchSession(wrapper);
  return res.status(200).json({ owner: true });
});

app.get('/admin/inventory', (req, res) => {
  const wrapper = requireAdminSession(req, res);
  if (!wrapper) {
    return;
  }
  touchSession(wrapper);
  return res.status(200).json({ items: loadInventory() });
});

app.post('/admin/inventory', (req, res) => {
  const wrapper = requireAdminSession(req, res);
  if (!wrapper) {
    return;
  }

  const { itemName, itemQuantity, itemPriceILS, itemImages, itemImage, itemCategoryId } = req.body;
  if (!validateRequiredFields([
    { value: itemName, name: 'Item name' }
  ], res)) {
    return;
  }

  const quantity = Number(itemQuantity);
  const price = Number(itemPriceILS);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ message: 'Item quantity must be a non-negative number.' });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: 'Item price must be a non-negative number.' });
  }

  const normalizedCategoryId = Number(itemCategoryId);
  if (!Number.isInteger(normalizedCategoryId)) {
    return res.status(400).json({ message: 'Category is required.' });
  }
  const categories = loadCategories();
  if (!categories.some((category) => Number(category.id) === normalizedCategoryId)) {
    return res.status(400).json({ message: 'Category does not exist.' });
  }

  const rawImages = itemImages !== undefined ? itemImages : itemImage;
  const imagesProvided = rawImages !== undefined;
  let safeImagesResult = { normalized: [], rejected: 0 };
  if (imagesProvided) {
    safeImagesResult = collectSafeImageValues(rawImages);
    if (!safeImagesResult.normalized.length && safeImagesResult.rejected > 0 && !isClearingImageValue(rawImages)) {
      return res.status(400).json({ message: 'כל קישורי התמונות שסיפקתם נדחו. השתמשו בכתובות http/https תקפות שאינן מפנות לשרתים פנימיים.' });
    }
  }

  const inventory = loadInventory();
  const nextId = inventory.length ? Math.max(...inventory.map((item) => Number(item.id) || 0)) + 1 : 1;
  const newItem = {
    id: nextId,
    itemName: sanitizeText(itemName),
    itemQuantity: quantity,
    itemPriceILS: price,
    categoryId: normalizedCategoryId
  };
  applyImageUpdate(newItem, imagesProvided ? safeImagesResult.normalized : rawImages);
  inventory.push(newItem);
  saveInventory(inventory);
  touchSession(wrapper);
  return res.status(201).json({ message: 'Item added', item: newItem });
});

app.patch('/admin/inventory/:itemId', (req, res) => {
  const wrapper = requireAdminSession(req, res);
  if (!wrapper) {
    return;
  }

  const itemId = Number(req.params.itemId);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ message: 'Item id is invalid.' });
  }

  const { itemQuantity, itemPriceILS, itemImages, itemImage, itemCategoryId } = req.body || {};
  const hasQuantity = itemQuantity !== undefined;
  const hasPrice = itemPriceILS !== undefined;
  const rawImages = itemImages !== undefined ? itemImages : itemImage;
  const hasImages = rawImages !== undefined;
  const hasCategory = itemCategoryId !== undefined;
  if (!hasQuantity && !hasPrice && !hasImages && !hasCategory) {
    return res.status(400).json({ message: 'Provide quantity, price, images, or category to update.' });
  }

  const normalizedQuantity = hasQuantity ? Number(itemQuantity) : null;
  const normalizedPrice = hasPrice ? Number(itemPriceILS) : null;
  const normalizedCategoryId = hasCategory ? Number(itemCategoryId) : null;
  if (hasQuantity && (!Number.isFinite(normalizedQuantity) || normalizedQuantity < 0)) {
    return res.status(400).json({ message: 'Item quantity must be a non-negative number.' });
  }
  if (hasPrice && (!Number.isFinite(normalizedPrice) || normalizedPrice < 0)) {
    return res.status(400).json({ message: 'Item price must be a non-negative number.' });
  }
  if (hasCategory) {
    if (!Number.isInteger(normalizedCategoryId)) {
      return res.status(400).json({ message: 'Category is invalid.' });
    }
    const categories = loadCategories();
    if (!categories.some((category) => Number(category.id) === normalizedCategoryId)) {
      return res.status(400).json({ message: 'Category does not exist.' });
    }
  }

  const inventory = loadInventory();
  const item = inventory.find((entry) => Number(entry.id) === itemId);
  if (!item) {
    return res.status(404).json({ message: 'Item not found.' });
  }

  if (hasQuantity) {
    item.itemQuantity = normalizedQuantity;
  }
  if (hasPrice) {
    item.itemPriceILS = normalizedPrice;
  }
  if (hasCategory) {
    item.categoryId = normalizedCategoryId;
  }
  let safeImagesResult = { normalized: [], rejected: 0 };
  if (hasImages) {
    safeImagesResult = collectSafeImageValues(rawImages);
    if (!safeImagesResult.normalized.length && safeImagesResult.rejected > 0 && !isClearingImageValue(rawImages)) {
      return res.status(400).json({ message: 'כל קישורי התמונות שסופקו נדחו. השתמשו בכתובות http/https תקינות שאינן מפנות לכתובות פנימיות.' });
    }
  }

  if (hasImages) {
    applyImageUpdate(item, safeImagesResult.normalized);
  }

  saveInventory(inventory);
  touchSession(wrapper);
  return res.status(200).json({ message: 'Item updated', item });
});

app.delete('/admin/inventory/:itemId', (req, res) => {
  const wrapper = requireAdminSession(req, res);
  if (!wrapper) {
    return;
  }

  const itemId = Number(req.params.itemId);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ message: 'Item id is invalid.' });
  }

  const inventory = loadInventory();
  const index = inventory.findIndex((item) => Number(item.id) === itemId);
  if (index === -1) {
    return res.status(404).json({ message: 'Item not found.' });
  }

  const [removed] = inventory.splice(index, 1);
  saveInventory(inventory);
  touchSession(wrapper);
  return res.status(200).json({ message: 'Item removed', item: removed });
});

app.post('/owner/actions/add-admin', (req, res) => {
  const wrapper = requireOwnerSession(req, res);
  if (!wrapper) {
    return;
  }

  const { userId } = req.body || {};
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId)) {
    return res.status(400).json({ message: 'User ID is invalid.' });
  }

  const users = loadUsers();
  const user = users.find((entry) => Number(entry.id) === normalizedUserId);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if (user.owner) {
    return res.status(400).json({ message: 'Owner permissions cannot be modified via this action.' });
  }
  if (user.admin) {
    return res.status(400).json({ message: 'User already has admin privileges.' });
  }

  user.admin = true;
  saveUsers(users);
  removeUserSessions(normalizedUserId);
  touchSession(wrapper);
  return res.status(200).json({ message: 'Admin privileges granted. המשתמש יתבקש להתחבר מחדש כדי לקבל גישה.' });
});

app.post('/owner/actions/remove-admin', (req, res) => {
  const wrapper = requireOwnerSession(req, res);
  if (!wrapper) {
    return;
  }

  const { userId } = req.body || {};
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId)) {
    return res.status(400).json({ message: 'User ID is invalid.' });
  }

  const users = loadUsers();
  const user = users.find((entry) => Number(entry.id) === normalizedUserId);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if (user.owner) {
    return res.status(400).json({ message: 'Cannot modify the owner account.' });
  }
  if (!user.admin) {
    return res.status(400).json({ message: 'User is not an admin.' });
  }

  user.admin = false;
  saveUsers(users);
  removeUserSessions(normalizedUserId);
  touchSession(wrapper);
  return res.status(200).json({ message: 'Admin privileges removed. המשתמש יתבקש להתחבר מחדש ללא הרשאות מנהל.' });
});

app.delete('/owner/users/:userId', (req, res) => {
  const wrapper = requireOwnerSession(req, res);
  if (!wrapper) {
    return;
  }

  const normalizedUserId = Number(req.params.userId);
  if (!Number.isInteger(normalizedUserId)) {
    return res.status(400).json({ message: 'User ID is invalid.' });
  }

  const users = loadUsers();
  const index = users.findIndex((entry) => Number(entry.id) === normalizedUserId);
  if (index === -1) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if (users[index].owner) {
    return res.status(400).json({ message: 'Cannot delete the owner account.' });
  }

  const [removed] = users.splice(index, 1);
  saveUsers(users);
  removeUserSessions(normalizedUserId);
  touchSession(wrapper);
  return res.status(200).json({ message: 'User deleted.', user: { id: removed.id, userEmail: removed.userEmail } });
});

app.post('/owner/categories', (req, res) => {
  const wrapper = requireOwnerSession(req, res);
  if (!wrapper) {
    return;
  }

  const { name } = req.body || {};
  const safeName = sanitizeText(name);
  if (!safeName) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  const categories = loadCategories();
  if (categories.some((category) => category.name?.toLowerCase() === safeName.toLowerCase())) {
    return res.status(400).json({ message: 'Category already exists.' });
  }

  const nextId = categories.length ? Math.max(...categories.map((entry) => Number(entry.id) || 0)) + 1 : 1;
  const newCategory = { id: nextId, name: safeName };
  categories.push(newCategory);
  saveCategories(categories);
  touchSession(wrapper);
  return res.status(201).json({ message: 'Category created', category: newCategory });
});

app.delete('/owner/categories/:categoryId', (req, res) => {
  const wrapper = requireOwnerSession(req, res);
  if (!wrapper) {
    return;
  }

  const normalizedCategoryId = Number(req.params.categoryId);
  if (!Number.isInteger(normalizedCategoryId)) {
    return res.status(400).json({ message: 'Category id is invalid.' });
  }

  const categories = loadCategories();
  const index = categories.findIndex((category) => Number(category.id) === normalizedCategoryId);
  if (index === -1) {
    return res.status(404).json({ message: 'Category not found.' });
  }

  const inventory = loadInventory();
  if (inventory.some((item) => Number(item.categoryId) === normalizedCategoryId)) {
    return res.status(400).json({ message: 'Cannot delete category in use by an item.' });
  }

  const [removed] = categories.splice(index, 1);
  saveCategories(categories);
  touchSession(wrapper);
  return res.status(200).json({ message: 'Category deleted', category: removed });
});

app.get('/cart/:sessionId', (req, res) => {
  const wrapper = getSession(req.params.sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found' });
  }

  const { session } = wrapper;
  if (!Array.isArray(session.cart)) {
    session.cart = [];
  }
  touchSession(wrapper);
  return res.status(200).json({ cart: session.cart, userId: session.userId });
});

app.post('/cart/:sessionId/items', (req, res) => {
  const { id, name, quantity = 1, priceILS = 0, imageUrl = '' } = req.body;
  if (!id || !name) {
    return res.status(400).json({ message: 'Item id and name are required' });
  }

  if (!validateRequiredFields([
    { value: name, name: 'Item name' }
  ], res)) {
    return;
  }

  const safeItemId = getSafeText(id);
  if (!safeItemId) {
    return res.status(400).json({ message: 'Item id is invalid.' });
  }

  const wrapper = getSession(req.params.sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found' });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: 'Quantity must be a positive number.' });
  }
  const roundedQty = Math.floor(qty);
  const price = Number(priceILS) || 0;
  const inventory = loadInventory();
  const inventoryItem = inventory.find((item) => String(item.id) === String(safeItemId));
  const safeImage = sanitizeUrl(imageUrl);
  const normalizedImage = safeImage || inventoryItem?.itemImages?.[0] || inventoryItem?.itemImage || '';
  const normalizedName = sanitizeText(name) || inventoryItem?.itemName || 'Item';
  const { session } = wrapper;
  if (!Array.isArray(session.cart)) {
    session.cart = [];
  }

  const existing = session.cart.find((entry) => entry.id === safeItemId);
  const availableStock = inventoryItem ? Number(inventoryItem.itemQuantity) : Number.POSITIVE_INFINITY;
  const stockLimit = Number.isFinite(availableStock) ? Math.max(0, Math.floor(availableStock)) : MAX_CART_ITEM_QUANTITY;

  if (stockLimit <= 0) {
    return res.status(400).json({ message: 'המוצר אזל מהמלאי.' });
  }

  const maxAllowed = Math.min(MAX_CART_ITEM_QUANTITY, stockLimit);

  if (existing && existing.quantity > maxAllowed) {
    existing.quantity = maxAllowed;
  }

  const prospectiveTotal = roundedQty + (existing ? existing.quantity : 0);
  if (prospectiveTotal > maxAllowed) {
    return res.status(400).json({ message: `ניתן להזמין עד ${maxAllowed} יחידות מהמוצר הזה.` });
  }

  if (existing) {
    existing.quantity += roundedQty;
    if (!existing.imageUrl && normalizedImage) {
      existing.imageUrl = normalizedImage;
    }
    if (!existing.name && normalizedName) {
      existing.name = normalizedName;
    }
  } else {
    session.cart.push({ id: safeItemId, name: normalizedName, quantity: roundedQty, priceILS: price, imageUrl: normalizedImage });
  }

  touchSession(wrapper);
  return res.status(200).json({ cart: session.cart, message: 'Cart updated' });
});

app.delete('/cart/:sessionId/items/:itemId', (req, res) => {
  const wrapper = getSession(req.params.sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found' });
  }

  const safeItemId = getSafeText(req.params.itemId);
  if (!safeItemId) {
    return res.status(400).json({ message: 'Item id is invalid.' });
  }

  const { session } = wrapper;
  if (!Array.isArray(session.cart)) {
    session.cart = [];
  }

  const before = session.cart.length;
  session.cart = session.cart.filter((entry) => String(entry.id) !== String(safeItemId));
  if (session.cart.length === before) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  touchSession(wrapper);
  return res.status(200).json({ cart: session.cart, message: 'Item removed' });
});

app.post('/checkout/create-intent', async (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return res.status(400).json({ message: 'Session ID is required' });
  }

  const wrapper = getSession(sessionId);
  if (!wrapper || !wrapper.session.loggedIn) {
    return res.status(401).json({ message: 'Session not found or expired' });
  }

  const { session } = wrapper;
  if (!Array.isArray(session.cart) || session.cart.length === 0) {
    return res.status(400).json({ message: 'Cart is empty' });
  }

  try {
    const { items, total } = normalizeCartItems(session.cart);
    if (total <= 0) {
      return res.status(400).json({ message: 'Unable to calculate cart total' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'ils',
      metadata: { sessionId, userId: String(session.userId) },
      automatic_payment_methods: { enabled: true }
    });

    touchSession(wrapper);

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      amountILS: total,
      items
    });
  } catch (error) {
    console.error('Error creating payment intent', error);
    return res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

app.post('/checkout/complete', async (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const { paymentIntentId } = req.body || {};

  const safePaymentIntentId = getSafeText(paymentIntentId);

  if (!sessionId || !safePaymentIntentId) {
    return res.status(400).json({ message: 'Session ID and paymentIntentId are required' });
  }

  const wrapper = getSession(sessionId);
  if (!wrapper) {
    return res.status(404).json({ message: 'Session not found or expired' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(safePaymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    const { session } = wrapper;
    const { items, total } = normalizeCartItems(session.cart);
    if (total <= 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const purchases = loadPurchases();
    const purchaseId = purchases.length === 0 ? 1 : purchases[purchases.length - 1].id + 1;
    const users = readJSON(DB_PATH, []);
    const user = users.find((u) => u.id === session.userId);

    const purchaseCreatedAt = Date.now();
    const newPurchase = {
      id: purchaseId,
      userId: session.userId,
      userEmail: user?.userEmail || null,
      paymentIntentId: safePaymentIntentId,
      items,
      totalILS: total,
      createdAt: new Date(purchaseCreatedAt).toISOString(),
      createdAtHuman: formatHumanTimestamp(purchaseCreatedAt)
    };

    purchases.push(newPurchase);
    writeJSON(PURCHASES_PATH, purchases);

    const itemLines = items
      .map((entry) => `${entry.quantity || 0}× ${entry.name || 'פריט'} – ₪${Number(entry.priceILS || 0).toFixed(2)}`)
      .join('\n');
    const purchaserEmail = user?.userEmail || 'משתמש לא ידוע';
    const purchaseSummary = `מספר הזמנה: ${purchaseId}\nמשתמש: ${purchaserEmail}\nנרשם בתאריך: ${newPurchase.createdAtHuman || newPurchase.createdAt}\nסכום כולל: ₪${total.toFixed(2)}\n\nפריטים:\n${itemLines}`;

    try {
      await transporter.sendMail({
        from: 'sales@giftiz.com',
        to: 'giftizpurches@gmail.com',
        subject: 'Giftiz - רכישה חדשה באתר',
        text: purchaseSummary
      });
    } catch (emailErr) {
      console.error('Failed to send purchase summary email', emailErr);
    }

    session.cart = [];
    touchSession(wrapper);

    return res.status(200).json({ message: 'Purchase recorded', purchase: newPurchase });
  } catch (error) {
    console.error('Error completing checkout', error);
    return res.status(500).json({ message: 'Failed to finalize purchase' });
  }
});

app.get('/config/stripe', (req, res) => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    return res.status(500).json({ message: 'Stripe publishable key is not configured.' });
  }
  return res.status(200).json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'הבקשה גדולה מדי. צמצמו את התמונות ונסו שוב.' });
  }
  console.error('Unhandled server error:', err);
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  return res.status(status).json({ message: err?.message || 'שגיאה בלתי צפויה בשרת.' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
