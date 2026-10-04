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

export async function fetchJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(null, "network");
  }
  if (!response.ok) throw await toApiError(response);
  return response.json();
}

export async function sendJson<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(null, "network");
  }
  if (!response.ok) throw await toApiError(response);
  return response.json();
}

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

/** Tell listeners (the top bar's Changes count) that configuration was saved. */
export const CONFIG_CHANGED = "tech-lens:config-changed";
export function configChanged(): void {
  window.dispatchEvent(new Event(CONFIG_CHANGED));
}
