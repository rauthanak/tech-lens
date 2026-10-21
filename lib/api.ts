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

export const fetchJson = <T>(url: string) => request<T>(url);

export const sendJson = <T>(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown) =>
  request<T>(url, { method, headers: { "Content-Type": "application/json", "X-Time-Zone": browserTz() },
    body: body === undefined ? undefined : JSON.stringify(body) });

/** A file upload (multipart), with the same time zone header as sendJson. */
export const sendForm = <T>(url: string, form: FormData) =>
  request<T>(url, { method: "POST", headers: { "X-Time-Zone": browserTz() }, body: form });

/** A human explanation of what went wrong and what to do about it. */
export function explain(error: unknown): { title: string; hint: string } {
  const status = error instanceof ApiError ? error.status : null;
  if (status === null || status >= 500) {
    return {
      title: "tech-atlas is not running",
      hint: "Nothing answered on port 8100. Start it in another terminal: cd tech-atlas && ./start.sh",
    };
  }
  return {
    title: `The backend returned an error (HTTP ${status})`,
    hint: "Check the tech-atlas terminal for the traceback.",
  };
}

/** Why a request failed, in words: the API's own reason when it gave one. */
export const errorText = (e: unknown) => (e instanceof ApiError && e.detail ? e.detail : explain(e).title);

/** Tell listeners (the top bar's Changes count) that configuration was saved. */
export const CONFIG_CHANGED = "tech-lens:config-changed";
export function configChanged(): void {
  window.dispatchEvent(new Event(CONFIG_CHANGED));
}
