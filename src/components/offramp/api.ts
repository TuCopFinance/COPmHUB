import { offrampErrorMessage } from "@/lib/offramp/messages";

/**
 * The form only talks to this site's /api/ramp, which relays to TuCOPRamp.
 * The party session rides in an httpOnly cookie the browser sends on its own.
 */

export class RampError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(offrampErrorMessage(code));
  }
}

export type RampResult<T> = { status: number; data: T };

/**
 * Idempotency-Key per action (path + body) that has not had a final answer
 * yet. A retry of the same action after a dropped connection, a 5xx or a
 * 409 idempotency_in_progress reuses the key, so the ramp creates it once.
 */
const pendingKeys = new Map<string, string>();

function isFinal(status: number, code: string | undefined): boolean {
  if (status === 0 || status >= 500) return false;
  return !(status === 409 && code === "idempotency_in_progress");
}

export async function ramp<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<RampResult<T>> {
  const json = body === undefined ? undefined : JSON.stringify(body);
  const action = method === "POST" ? `${path}\n${json ?? ""}` : null;
  const headers: Record<string, string> = {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  if (action) {
    let key = pendingKeys.get(action);
    if (!key) {
      key = crypto.randomUUID();
      pendingKeys.set(action, key);
    }
    headers["Idempotency-Key"] = key;
  }

  let response: Response;
  try {
    response = await fetch(`/api/ramp/${path}`, {
      method,
      headers,
      body: json,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new RampError(0, undefined);
  }
  const data = await response.json().catch(() => null);
  if (action && isFinal(response.status, data?.code)) pendingKeys.delete(action);
  if (!response.ok) throw new RampError(response.status, data?.code);
  return { status: response.status, data: data as T };
}

export async function signOutRamp(): Promise<void> {
  await fetch("/api/ramp/session", { method: "DELETE", credentials: "same-origin" }).catch(
    () => undefined,
  );
}
