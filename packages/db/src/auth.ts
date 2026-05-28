import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { Database } from './client';
import * as schema from './schema/index';

// ── Web Crypto PBKDF2 password hashing (Workers-compatible) ─────────────────
// scrypt (Better Auth default) exceeds Cloudflare Workers CPU time limit.
// PBKDF2-SHA256 with 100k iterations uses hardware-accelerated Web Crypto.

async function pbkdf2Hash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...new Uint8Array(derived)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function pbkdf2Verify(hash: string, password: string): Promise<boolean> {
  if (!hash.startsWith('pbkdf2:')) return false;
  const parts = hash.split(':');
  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(parts[2].match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const expected = parts[3];
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  const actual = [...new Uint8Array(derived)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export interface AuthEmailPayload {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

function emailWrap(content: string) {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">${content}</div>`;
}

// ── Auth options interface ──────────────────────────────────────────────────

export interface CreateAuthOpts {
  baseURL?: string;
  trustedOrigins?: string[];
  secret?: string;
  sendEmail?: (payload: AuthEmailPayload) => Promise<void>;
  google?: { clientId: string; clientSecret: string };
  apple?: { clientId: string; clientSecret: string };
  microsoft?: { clientId: string; clientSecret: string };
}

/**
 * Create a Better Auth instance backed by the given Drizzle database.
 * Call once per isolate (lazy-cached in each app's getAuth()).
 */
export function createAuth(db: Database, opts?: CreateAuthOpts) {
  const sendEmail = opts?.sendEmail;

  // Build social providers dynamically from env
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (opts?.google) socialProviders.google = opts.google;
  if (opts?.apple) socialProviders.apple = opts.apple;
  if (opts?.microsoft) socialProviders.microsoft = opts.microsoft;

  return betterAuth({
    baseURL: opts?.baseURL,
    secret: opts?.secret,
    trustedOrigins: opts?.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        ...schema,
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications
      },
      usePlural: true
    }),
    user: {
      fields: {
        emailVerified: 'verified',
        image: 'avatar',
        createdAt: 'created',
        updatedAt: 'updated'
      },
      additionalFields: {
        role: { type: 'string', required: false, input: false },
        plan: { type: 'string', required: false, input: false },
        onboardingComplete: {
          type: 'boolean',
          required: false,
          input: false
        },
        acceptPolicies: {
          type: 'boolean',
          required: false,
          input: false
        },
        accountStatus: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: 'active'
        },
        trialClaimed: {
          type: 'boolean',
          required: false,
          input: false
        },
        stripeCustomerId: {
          type: 'string',
          required: false,
          input: false
        }
      }
    },
    session: {},
    account: {},
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: {
        hash: pbkdf2Hash,
        verify: ({ hash, password }) => pbkdf2Verify(hash, password)
      },
      sendResetPassword: async ({ user, url }) => {
        if (!sendEmail) {
          console.warn('[Auth] Missing sendEmail provider; skipping reset password email.');
          return;
        }
        await sendEmail({
          to: { email: user.email, name: user.name },
          subject: 'Reset your password — Quant Orion',
          html: emailWrap(
            [
              '<h2 style="color:#1f2937">Password Reset</h2>',
              `<p>Hi ${user.name},</p>`,
              '<p>Click the button below to reset your password. This link expires in 1 hour.</p>',
              `<a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Reset Password</a>`,
              '<p style="margin-top:24px;color:#6b7280;font-size:13px">If you didn\'t request this, you can safely ignore this email.</p>'
            ].join('')
          ),
          text: `Hi ${user.name},\n\nReset your password using this link (expires in 1 hour):\n${url}\n\nIf you didn't request this, you can ignore this email.`
        });
      }
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        if (!sendEmail) {
          console.warn('[Auth] Missing sendEmail provider; skipping verification email.');
          return;
        }
        await sendEmail({
          to: { email: user.email, name: user.name },
          subject: 'Verify your email — Quant Orion',
          html: emailWrap(
            [
              '<h2 style="color:#1f2937">Email Verification</h2>',
              `<p>Hi ${user.name},</p>`,
              '<p>Click the button below to verify your email address.</p>',
              `<a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Verify Email</a>`,
              '<p style="margin-top:24px;color:#6b7280;font-size:13px">If you didn\'t create an account, you can safely ignore this email.</p>'
            ].join('')
          ),
          text: `Hi ${user.name},\n\nVerify your email using this link:\n${url}\n\nIf you didn't create an account, you can ignore this email.`
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true
    },
    socialProviders,
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (!sendEmail) {
            console.warn(`[Auth] Missing sendEmail provider; skipping ${type} OTP email.`);
            return;
          }
          const subjects: Record<string, string> = {
            'sign-in': 'Your sign-in code — Quant Orion',
            'email-verification': 'Verify your email — Quant Orion',
            'forget-password': 'Password reset code — Quant Orion'
          };
          const descriptions: Record<string, string> = {
            'sign-in': 'Use this code to sign in to your account.',
            'email-verification': 'Use this code to verify your email address.',
            'forget-password': 'Use this code to reset your password.'
          };
          await sendEmail({
            to: { email, name: email },
            subject: subjects[type] || 'Your code — Quant Orion',
            html: emailWrap(
              [
                '<h2 style="color:#1f2937">Your Verification Code</h2>',
                `<p>${descriptions[type] || 'Use this code to continue.'}</p>`,
                `<div style="margin:24px 0;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#6366f1;background:#f3f4f6;padding:16px;border-radius:8px">${otp}</div>`,
                '<p style="color:#6b7280;font-size:13px">This code expires in 5 minutes. If you didn\'t request this, you can safely ignore this email.</p>'
              ].join('')
            ),
            text: `${descriptions[type] || 'Use this code to continue.'}\n\nCode: ${otp}\n\nThis code expires in 5 minutes.`
          });
        },
        disableSignUp: false
      })
    ]
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Normalized user shape set on `event.locals.user` by both web and admin hooks.
 * Matches Better Auth's user output with our additionalFields.
 * During migration, PB-sourced users are normalized to this same shape.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: string | null;
  plan: string | null;
  onboardingComplete: boolean;
  accountStatus: string | null;
  acceptPolicies: boolean;
  trialClaimed: boolean;
  stripeCustomerId: string | null;
}
