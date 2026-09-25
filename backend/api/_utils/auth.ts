import type { VercelRequest } from '@vercel/node';
import crypto from 'crypto';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
}

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'campusmind-d65c1';
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache for Google's public certificates
let cachedCertificates: Record<string, string> = {};
let certsExpiryTime = 0;

/**
 * Fetch and cache Google's public x509 certificates used to sign Firebase ID tokens.
 */
async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiryTime && Object.keys(cachedCertificates).length > 0) {
    return cachedCertificates;
  }

  try {
    const res = await fetch(GOOGLE_CERTS_URL, {
      headers: { 'User-Agent': 'CampusMind-Auth/1.0' },
    });

    if (!res.ok) {
      console.warn(`[Auth] Failed to fetch Google public certs: ${res.status}`);
      return cachedCertificates;
    }

    const data = (await res.json()) as Record<string, string>;
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    cachedCertificates = data;
    certsExpiryTime = now + maxAgeSeconds * 1000;
    return cachedCertificates;
  } catch (err) {
    console.warn('[Auth] Exception while fetching Google public certs:', err);
    return cachedCertificates;
  }
}

/**
 * Decode a base64url-encoded string
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Verify a Firebase ID Token using Google's public signing keys and RFC 7519 rules.
 */
export async function verifyFirebaseIdToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    name?: string;
    user_id?: string;
  };

  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }

  // 1. Verify standard JWT claims
  if (header.alg !== 'RS256' || !header.kid) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // Expiration check
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
    return null;
  }

  // Issued-at check (with 5 minute tolerance for clock skew)
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) {
    return null;
  }

  // Audience & Issuer check
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== expectedIssuer) {
    return null;
  }

  // Subject / UID check
  const uid = payload.sub || payload.user_id;
  if (!uid || typeof uid !== 'string') {
    return null;
  }

  // 2. Cryptographic signature check with Google public certs
  try {
    const certs = await fetchGooglePublicKeys();
    const certPem = certs[header.kid];

    if (certPem) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${headerB64}.${payloadB64}`);
      const isValid = verifier.verify(certPem, sigB64, 'base64url');
      if (!isValid) {
        return null;
      }
    } else {
      // If cert not yet in cache or Google rotated, attempt one force-refresh
      certsExpiryTime = 0;
      const freshCerts = await fetchGooglePublicKeys();
      const freshCertPem = freshCerts[header.kid];
      if (freshCertPem) {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        const isValid = verifier.verify(freshCertPem, sigB64, 'base64url');
        if (!isValid) {
          return null;
        }
      } else {
        // Unknown signing key
        return null;
      }
    }
  } catch (verifyErr) {
    console.error('[Auth] Cryptographic verification failed:', verifyErr);
    return null;
  }

  return {
    uid,
    email: payload.email,
    name: payload.name,
  };
}

/**
 * Authentication Middleware: Extracts Bearer token from request and verifies it.
 */
export async function verifyAuth(req: VercelRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const token = parts[1];
  return await verifyFirebaseIdToken(token);
}

// ---------------- RATE LIMITING ----------------
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodically clean up stale rate-limit buckets (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }, 300_000);
  if (timer.unref) {
    timer.unref();
  }
}

/**
 * Sliding-window rate limiter per UID.
 * Default: 30 requests per 60 seconds.
 */
export function checkRateLimit(
  uid: string,
  limit: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(uid);

  if (!existing || now >= existing.resetAt) {
    rateLimitStore.set(uid, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}
