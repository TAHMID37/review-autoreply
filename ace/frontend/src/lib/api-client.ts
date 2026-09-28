const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "review-autoreply:token";
const HTTP_NO_CONTENT = 204;

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Thin fetch wrapper: attaches the bearer token, throws ApiError with the
 *  backend's message on non-2xx so callers can show it directly. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // fetch only rejects when the request never completed — the API is down,
    // unreachable, or the browser blocked it (CORS). Say so plainly instead
    // of letting it surface as an unexplained generic failure.
    throw new ApiError(0, `Cannot reach the API at ${API_URL}. Is the backend running?`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // NestJS validation errors arrive as an array of messages; join them so
    // the UI shows readable text rather than "[object Object]".
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    throw new ApiError(response.status, message ?? response.statusText);
  }

  if (response.status === HTTP_NO_CONTENT) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
