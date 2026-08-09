import { ApiError, getJson, postJson } from "@/lib/api";

export type UserRole = "USER" | "ADMIN";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  createdAt?: string;
};

type UserResponse = {
  user: AuthUser;
};

const LEGACY_AUTH_STORAGE_KEY = "playable-factory-ai.auth";

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "number" &&
    typeof user.username === "string" &&
    typeof user.email === "string" &&
    (user.role === "USER" || user.role === "ADMIN")
  );
}

function userFromResponse(response: UserResponse): AuthUser {
  if (!isAuthUser(response.user)) {
    throw new ApiError("The API returned an invalid user response.", 500);
  }
  return response.user;
}

export function clearLegacyAuthStorage(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  }
}

/** Authenticates with the API and relies on its HttpOnly Set-Cookie response. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await postJson<UserResponse>("/auth/login", { email, password });
  return userFromResponse(response);
}

/** Restores the current browser session from the backend profile endpoint. */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await getJson<UserResponse>("/auth/profile");
  return userFromResponse(response);
}

/** Clears the backend session cookie and any legacy local authentication data. */
export async function logout(): Promise<void> {
  try {
    await postJson<{ message: string }>("/auth/logout");
  } finally {
    clearLegacyAuthStorage();
  }
}

/** Returns the appropriate UX landing page for an authenticated role. */
export function getHomeRoute(role: UserRole): "/chat" | "/admin" {
  return role === "ADMIN" ? "/admin" : "/chat";
}
