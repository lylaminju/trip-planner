import { createHmac } from "node:crypto";

import { guestSessionSecret } from "./guest-session";

// IPv6 clients rotate freely inside their /64, so bucket by the first four
// hextets before hashing to keep one household one bucket.
const IPV6_BUCKET_HEXTETS = 4;
// Domain separator so the guest-cookie secret and the IP salt never produce
// interchangeable MACs.
const IP_HASH_CONTEXT = "guest-ip";

// Salted hash of the platform-reported client IP. Recorded on guest usage rows
// for abuse analysis only — never enforced, and the raw IP is never stored.
// Returns null when no trusted header or secret is available (fails closed to
// "unknown" rather than trusting spoofable input).
export function hashedRequestIp(request: Request): string | null {
  const secret = guestSessionSecret();
  if (!secret) return null;

  const ip = clientIpFromHeaders(request.headers);
  if (!ip) return null;

  return createHmac("sha256", `${IP_HASH_CONTEXT}:${secret}`)
    .update(bucketIp(ip))
    .digest("hex");
}

function clientIpFromHeaders(headers: Headers): string | null {
  // x-real-ip is set by the hosting platform from the connecting socket;
  // fall back to the first x-forwarded-for hop (spoofable, acceptable for
  // record-only analysis).
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  const firstHop = forwarded?.split(",")[0]?.trim();
  return firstHop ? firstHop : null;
}

function bucketIp(ip: string): string {
  if (!ip.includes(":")) return ip;

  return expandIpv6Hextets(ip).slice(0, IPV6_BUCKET_HEXTETS).join(":");
}

// Expands "::" so bucketing sees the true leading hextets.
function expandIpv6Hextets(ip: string): string[] {
  const IPV6_HEXTET_COUNT = 8;
  const [head = "", tail = ""] = ip.split("::", 2);
  const headParts = head ? head.split(":") : [];
  if (!ip.includes("::")) return headParts;

  const tailParts = tail ? tail.split(":") : [];
  const missing = IPV6_HEXTET_COUNT - headParts.length - tailParts.length;
  return [
    ...headParts,
    ...Array.from({ length: Math.max(missing, 0) }, () => "0"),
    ...tailParts,
  ];
}
