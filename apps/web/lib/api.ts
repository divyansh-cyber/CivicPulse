// Thin wrapper around fetch that prepends the API base URL and
// injects the JWT from localStorage automatically.

const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cp_token");
}

export { getToken };

interface RequestOptions extends RequestInit {
  auth?: boolean; // default true — attach JWT header
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOpts.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...fetchOpts, headers });
  
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      !res.ok
        ? `Server error (${res.status}): Please check backend URL connection.`
        : "Received invalid non-JSON response from server."
    );
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export function saveAuth(token: string, user: object) {
  localStorage.setItem("cp_token", token);
  localStorage.setItem("cp_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("cp_token");
  localStorage.removeItem("cp_user");
}

export function getUser<T = Record<string, unknown>>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cp_user");
  return raw ? (JSON.parse(raw) as T) : null;
}
