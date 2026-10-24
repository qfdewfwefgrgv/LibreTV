import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 用户存储（服务端，仅 Node runtime）：
 * - 数据落在 DATA_DIR/users.json，Docker 部署时把宿主机目录挂进 /app/data，重建容器不丢账号；
 * - 密码用 scrypt + 随机盐哈希，文件里不出现明文；
 * - 内置开发者账号 developer，密码取 DEV_PASSWORD（默认 libretv-dev）。
 */

export type Role = 'guest' | 'user' | 'admin' | 'developer';
export type StoredRole = Exclude<Role, 'guest'>;

export interface StoredUser {
  id: string;
  username: string;
  /** 邮箱登录绑定（可选） */
  email?: string;
  /** 手机号登录绑定（可选） */
  phone?: string;
  passwordHash: string;
  salt: string;
  role: StoredRole;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  role: StoredRole;
  createdAt: number;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEV_USERNAME = process.env.DEV_USERNAME || 'developer';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function readUsers(): StoredUser[] {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  ensureDir();
  const tmp = `${USERS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmp, USERS_FILE);
}

/** 内置开发者账号：不存在则创建（密码来自 DEV_PASSWORD） */
export function ensureDeveloper(): StoredUser {
  const users = readUsers();
  const existing = users.find((u) => u.username === DEV_USERNAME);
  if (existing) {
    if (existing.role !== 'developer') {
      existing.role = 'developer';
      writeUsers(users);
    }
    return existing;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const password = process.env.DEV_PASSWORD || 'libretv-dev';
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username: DEV_USERNAME,
    passwordHash: hashPassword(password, salt),
    salt,
    role: 'developer',
    createdAt: Date.now(),
  };
  users.push(user);
  writeUsers(users);
  return user;
}

/**
 * 内置管理员账号：不存在则创建（密码来自 ADMIN_PASSWORD，默认 19438）。
 * 授予 developer 角色，拥有全部权限（用户管理、角色分配等）。
 * 若账号已存在但被降权，自动恢复为 developer。
 */
export function ensureAdmin(): StoredUser {
  const users = readUsers();
  const existing = users.find((u) => u.username === ADMIN_USERNAME);
  if (existing) {
    if (existing.role !== 'developer') {
      existing.role = 'developer';
      writeUsers(users);
    }
    return existing;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const password = process.env.ADMIN_PASSWORD || '19438';
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username: ADMIN_USERNAME,
    passwordHash: hashPassword(password, salt),
    salt,
    role: 'developer',
    createdAt: Date.now(),
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function toPublic(u: StoredUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: u.createdAt,
  };
}

export function listUsers(): PublicUser[] {
  ensureDeveloper();
  ensureAdmin();
  return readUsers()
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toPublic);
}

export function findById(id: string): StoredUser | null {
  return readUsers().find((u) => u.id === id) ?? null;
}

export function findByUsername(username: string): StoredUser | null {
  return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

/** 账号密码校验：成功返回用户，失败返回 null */
export function verifyCredentials(username: string, password: string): StoredUser | null {
  ensureDeveloper();
  ensureAdmin();
  const user = findByUsername(username);
  if (!user) return null;
  const input = hashPassword(password, user.salt);
  const a = Buffer.from(input);
  const b = Buffer.from(user.passwordHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return user;
}

function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 20) return '用户名长度需在 3~20 个字符之间';
  if (!/^[\w\u4e00-\u9fa5-]+$/.test(username)) return '用户名只能包含字母、数字、下划线、短横线或中文';
  return null;
}

/** 按邮箱/手机号查用户（验证码登录用） */
export function findByContact(channel: 'email' | 'sms', target: string): StoredUser | null {
  const value = target.trim().toLowerCase();
  return (
    readUsers().find((u) =>
      channel === 'email'
        ? (u.email || '').toLowerCase() === value
        : (u.phone || '').replace(/\D/g, '') === value.replace(/\D/g, '')
    ) ?? null
  );
}

/** 生成一个未被占用的用户名（验证码首次登录自动建号） */
function uniqueUsername(base: string): string {
  const clean = base.replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 16);
  let name = clean.length >= 3 ? clean : `user_${clean || 'guest'}`.slice(0, 20);
  if (name.toLowerCase() === DEV_USERNAME.toLowerCase()) name = `${name}_1`;
  if (name.toLowerCase() === ADMIN_USERNAME.toLowerCase()) name = `${name}_1`;
  let candidate = name;
  let n = 1;
  while (findByUsername(candidate)) {
    candidate = `${name.slice(0, 17)}_${n++}`;
  }
  return candidate;
}

/** 验证码登录：联系方式没注册过就自动建一个普通账号 */
export function ensureContactUser(channel: 'email' | 'sms', target: string): StoredUser {
  ensureDeveloper();
  ensureAdmin();
  const existing = findByContact(channel, target);
  if (existing) return existing;

  const base = channel === 'email' ? target.split('@')[0] : `用户${target.slice(-4)}`;
  const username = uniqueUsername(base);
  const salt = crypto.randomBytes(16).toString('hex');
  // 验证码账号没有密码：给一段随机口令的哈希，避免空密码可猜
  const passwordHash = hashPassword(crypto.randomBytes(24).toString('hex'), salt);
  const users = readUsers();
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username,
    email: channel === 'email' ? target : undefined,
    phone: channel === 'sms' ? target : undefined,
    passwordHash,
    salt,
    role: 'user',
    createdAt: Date.now(),
  };
  users.push(user);
  writeUsers(users);
  return user;
}

/** 注册：返回错误信息或用户 */
export function registerUser(
  username: string,
  password: string,
  contact?: { channel: 'email' | 'sms'; target: string }
): { user?: StoredUser; error?: string } {
  ensureDeveloper();
  ensureAdmin();
  const name = username.trim();
  const nameError = validateUsername(name);
  if (nameError) return { error: nameError };
  if (password.length < 6) return { error: '密码至少 6 位' };
  if (name.toLowerCase() === DEV_USERNAME.toLowerCase()) return { error: '该用户名已被保留' };
  if (name.toLowerCase() === ADMIN_USERNAME.toLowerCase()) return { error: '该用户名已被保留' };
  if (findByUsername(name)) return { error: '用户名已存在' };
  if (contact && findByContact(contact.channel, contact.target)) {
    return { error: contact.channel === 'email' ? '该邮箱已绑定其他账号' : '该手机号已绑定其他账号' };
  }

  const users = readUsers();
  const salt = crypto.randomBytes(16).toString('hex');
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username: name,
    email: contact?.channel === 'email' ? contact.target : undefined,
    phone: contact?.channel === 'sms' ? contact.target : undefined,
    passwordHash: hashPassword(password, salt),
    salt,
    role: 'user',
    createdAt: Date.now(),
  };
  users.push(user);
  writeUsers(users);
  return { user };
}

/** 修改角色：developer 可设置任意非 developer 账号；admin 只能设置普通用户为管理员/取消 */
export function setUserRole(
  targetId: string,
  role: 'user' | 'admin',
  operator: { id: string; role: StoredRole }
): { user?: PublicUser; error?: string; status?: number } {
  const users = readUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return { error: '用户不存在', status: 404 };
  if (target.role === 'developer') return { error: '开发者账号的角色不可修改', status: 403 };
  if (operator.role !== 'developer' && operator.role !== 'admin') {
    return { error: '没有管理权限', status: 403 };
  }
  if (operator.role === 'admin' && target.id === operator.id) {
    return { error: '不能修改自己的角色', status: 403 };
  }
  target.role = role;
  writeUsers(users);
  return { user: toPublic(target) };
}

export function toIdentity(u: StoredUser) {
  return { sub: u.id, username: u.username, role: u.role };
}
