const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiErrorBody = {
  message?: string;
};

type ApiRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) return null;
  return response.json();
}

/**
 * Sends a credentialed request to the configured API and normalizes failures.
 *
 * Accepts an API path, an HTTP method, and an optional JSON body.
 */
export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Unable to reach the API. Make sure the backend is running.", 0);
  }

  const data = await readJson(response);
  if (!response.ok) {
    const error = data as ApiErrorBody | null;
    throw new ApiError(error?.message ?? "The request could not be completed.", response.status);
  }

  return data as TResponse;
}

/** Performs a credentialed GET request. */
export function getJson<TResponse>(path: string): Promise<TResponse> {
  return apiRequest<TResponse>(path);
}

/** Performs a credentialed POST request with an optional JSON body. */
export function postJson<TResponse>(
  path: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { method: "POST", body });
}
