// Server-side helpers for sharing a poll: its absolute URL and a QR code for it.
import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * The site's base URL. SITE_URL wins, so QR codes and copied links point at
 * production even when rendered on a Vercel preview; otherwise the request host.
 */
export async function siteBaseUrl(): Promise<string> {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function pollUrl(pollId: string): Promise<string> {
  return `${await siteBaseUrl()}/polls/${pollId}`;
}

/** The URL without its scheme, for printing under a QR code. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/** An SVG QR code for `text`, generated locally (no external service). */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
