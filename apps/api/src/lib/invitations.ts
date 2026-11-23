import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { invitations } from '../db/schema';

export const INVITE_COOKIE = 'gym_invite';
const INVITE_COOKIE_TTL_S = 30 * 60;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid typos

export function hashCode(code: string) {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 16 random characters (80 bits), shown as XXXX-XXXX-XXXX-XXXX. */
export function generateCode() {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return chars.match(/.{4}/g)!.join('-');
}

export async function createInvitation(
  db: Database,
  opts: { createdBy?: string | null; email?: string | null; days?: number } = {},
) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + (opts.days ?? 7) * 86_400_000);
  const [row] = await db
    .insert(invitations)
    .values({ codeHash: hashCode(code), createdBy: opts.createdBy ?? null, email: opts.email?.toLowerCase() ?? null, expiresAt })
    .returning({ id: invitations.id });
  return { id: row!.id, code, expiresAt };
}

function usable(code: string) {
  return and(
    eq(invitations.codeHash, hashCode(code)),
    isNull(invitations.usedAt),
    isNull(invitations.revokedAt),
    gt(invitations.expiresAt, sql`now()`),
  );
}

export async function checkInvitation(db: Database, code: string) {
  const [row] = await db.select({ email: invitations.email }).from(invitations).where(usable(code));
  return row ? { valid: true as const, email: row.email } : { valid: false as const };
}

/**
 * Atomically consumes a code for `email`. Returns false if the code is unknown, used, revoked,
 * expired or bound to another email. A single UPDATE prevents two sign-ups using one code.
 */
export async function consumeInvitation(db: Database, code: string, email: string) {
  const lower = email.toLowerCase();
  const rows = await db
    .update(invitations)
    .set({ usedAt: sql`now()`, usedEmail: lower })
    .where(and(usable(code), sql`(${invitations.email} is null or ${invitations.email} = ${lower})`))
    .returning({ id: invitations.id });
  return rows.length === 1;
}

export async function linkInvitationToUser(db: Database, email: string, userId: string) {
  await db
    .update(invitations)
    .set({ usedBy: userId })
    .where(and(eq(invitations.usedEmail, email.toLowerCase()), isNull(invitations.usedBy)));
}

/** Signed, short-lived cookie carrying an invite code across the Google OAuth redirect. */
export function signInviteCookie(code: string, secret: string, now = Date.now()) {
  const payload = `${normalizeCode(code)}.${Math.floor(now / 1000) + INVITE_COOKIE_TTL_S}`;
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function readInviteCookie(value: string | undefined, secret: string, now = Date.now()) {
  if (!value) return null;
  const [code, exp, mac] = value.split('.');
  if (!code || !exp || !mac) return null;
  const expected = createHmac('sha256', secret).update(`${code}.${exp}`).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) * 1000 < now) return null;
  return code;
}

export function inviteCookieHeader(value: string, secure: boolean) {
  return `${INVITE_COOKIE}=${value}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=${INVITE_COOKIE_TTL_S}${secure ? '; Secure' : ''}`;
}

export function getCookie(headers: Headers | undefined | null, name: string) {
  const raw = headers?.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}
