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

export async function ramp<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<RampResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/ramp/${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new RampError(0, undefined);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new RampError(response.status, data?.code);
  return { status: response.status, data: data as T };
}

export async function signOutRamp(): Promise<void> {
  await fetch("/api/ramp/session", { method: "DELETE", credentials: "same-origin" }).catch(
    () => undefined,
  );
}
