export class ApiError extends Error {
  status: number | null; // null = network failure
  detail: string | null; // server-provided explanation, when there is one

  constructor(status: number | null, message: string, detail: string | null = null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail: string | null = null;
  try {
    const body = await response.json();
    if (typeof body.detail === "string") detail = body.detail;
    else if (Array.isArray(body.detail))
      detail = body.detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`.trim()
        )
        .join(" · ");
  } catch {
    // non-JSON error body
  }
  return new ApiError(response.status, `HTTP ${response.status}`, detail);
}

/** One call to the API: a network failure or an error status throws an ApiError. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(null, "network");
  }
  if (!response.ok) throw await toApiError(response);
  return response.json();
}

/** The browser's time zone, sent with every write: the API records it beside
 *  the time, and screens show the time in the zone it was written in. */
export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

/** GET; `signal` lets a newer request cancel this one (its answer is then dropped). */
export const fetchJson = <T>(url: string, init?: { signal?: AbortSignal }) => request<T>(url, init);

export const sendJson = <T>(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown) =>
  request<T>(url, { method, headers: { "Content-Type": "application/json", "X-Time-Zone": browserTz() },
    body: body === undefined ? undefined : JSON.stringify(body) });

/** A file upload (multipart), with the same time zone header as sendJson. */
export const sendForm = <T>(url: string, form: FormData) =>
  request<T>(url, { method: "POST", headers: { "X-Time-Zone": browserTz() }, body: form });

/** On a development build only: where the server is started from. */
const LOCAL = process.env.NODE_ENV === "development" ? " Running locally? Start tech-atlas: cd tech-atlas && ./start.sh" : "";

/** A human explanation of what went wrong and what to do about it: no
 *  answer at all, the server failing, or the server refusing (with its reason). */
export function explain(error: unknown): { title: string; hint: string } {
  const status = error instanceof ApiError ? error.status : null;
  const detail = error instanceof ApiError ? error.detail : null;
  if (status === null) {
    return {
      title: "The portal can't be reached",
      hint: "The browser got no answer. Check the network connection, then reload the page." + LOCAL,
    };
  }
  if (status >= 500) {
    return {
      title: "The radar's server couldn't answer",
      hint: (detail ?? `It may be restarting, or this request failed on it (HTTP ${status}). Try again in a minute; `
        + "if it keeps happening, tell the team that runs the radar.") + LOCAL,
    };
  }
  return {
    title: `The radar refused this request (HTTP ${status})`,
    hint: detail ?? "No reason was given. Reload the page; if it keeps happening, tell the team that runs the radar.",
  };
}

/** Why a request failed, in words: the API's own reason when it gave one. */
export const errorText = (e: unknown) => (e instanceof ApiError && e.detail ? e.detail : explain(e).title);

/** Tell listeners (the top bar's Changes count) that configuration was saved. */
export const CONFIG_CHANGED = "tech-lens:config-changed";
export function configChanged(): void {
  window.dispatchEvent(new Event(CONFIG_CHANGED));
}
