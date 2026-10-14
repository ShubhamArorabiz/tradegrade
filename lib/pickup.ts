import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pickup code is derived from the order id with a server secret, so it is
 * never stored where the seller could read it. The buyer's page computes it on
 * the server and shows it as a QR (and as 6 digits under the QR).
 */
export function pickupCode(orderId: string) {
  const secret = process.env.PICKUP_CODE_SECRET;
  if (!secret) throw new Error("PICKUP_CODE_SECRET is not set");
  const digest = createHmac("sha256", secret).update(orderId).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function pickupQrPayload(orderId: string) {
  return `TG1:${orderId}:${pickupCode(orderId)}`;
}

/** Accepts either the QR payload or the typed 6 digits. */
export function checkPickupInput(orderId: string, input: string) {
  const trimmed = input.trim();
  let code = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("TG1:")) {
    const [, qrOrder, qrCode] = trimmed.split(":");
    if (qrOrder !== orderId) return { ok: false as const, reason: "wrong_order" as const };
    code = qrCode ?? "";
  }
  const expected = Buffer.from(pickupCode(orderId));
  const given = Buffer.from(code.padEnd(6, "x").slice(0, 6));
  return timingSafeEqual(expected, given)
    ? { ok: true as const }
    : { ok: false as const, reason: "bad_code" as const };
}
