import { getApiBaseUrl } from "@appio/config";
import type { ApiError } from "./types";

type GetToken = (forceRefresh?: boolean) => Promise<string | null>;

let _getToken: GetToken = async () => null;

export function setTokenProvider(fn: GetToken) {
  _getToken = fn;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  _retried = false
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const token = await _getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let error: ApiError;
    try {
      error = await res.json();
    } catch {
      error = { detail: `Request failed with status ${res.status}` };
    }

    // 401 → try a force-refresh of the Firebase token once, then retry the
    // request. This recovers transparently from expired tokens without the
    // caller needing to know about auth at all.
    if (res.status === 401 && !_retried && token) {
      const fresh = await _getToken(true);
      if (fresh && fresh !== token) {
        return request<T>(path, options, true);
      }
      throw new AuthError(error.detail);
    }

    if (res.status === 401) {
      throw new AuthError(error.detail);
    }

    throw new ApiRequestError(error.detail, res.status, error.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class AuthError extends Error {
  name = "AuthError" as const;
}

export class ApiRequestError extends Error {
  name = "ApiRequestError" as const;
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
