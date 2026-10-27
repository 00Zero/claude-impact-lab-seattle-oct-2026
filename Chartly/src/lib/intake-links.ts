import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";

// Tokens are HMAC(secret, link id): unguessable without the secret, never
// stored, and re-derivable so contractors can copy a link again later.
// Rotating INTAKE_LINK_SECRET invalidates every existing link.
function getSecret() {
  const secret = process.env.INTAKE_LINK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "INTAKE_LINK_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return secret;
}

export function deriveIntakeToken(linkId: string) {
  return createHmac("sha256", getSecret())
    .update(`intake-link:${linkId}`)
    .digest("base64url");
}

// Derived tokens are 32-byte HMACs in base64url.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isIntakeToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export function hashIntakeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newIntakeLink() {
  const id = randomUUID();
  const token = deriveIntakeToken(id);
  return { id, token, tokenHash: hashIntakeToken(token) };
}

// Base URL for links customers open. Set SITE_URL in production so links
// don't depend on the incoming request's host header.
export async function getSiteUrl() {
  const configured = process.env.SITE_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function intakeUrl(linkId: string) {
  return `${await getSiteUrl()}/i/${deriveIntakeToken(linkId)}`;
}
