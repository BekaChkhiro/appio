import auth from "@react-native-firebase/auth";
import { API_BASE_URL } from "./config";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const currentUser = auth().currentUser;
    if (!currentUser) return {};
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { body, headers: extraHeaders, ...rest } = options;

    const authHeader = await this.getAuthHeader();

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...authHeader,
      ...(extraHeaders as Record<string, string>),
    };

    // Only set Content-Type when there is a body
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 401 → force-refresh token and retry once
    if (response.status === 401) {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const freshToken = await currentUser.getIdToken(true);
        headers.Authorization = `Bearer ${freshToken}`;

        const retryResponse = await fetch(`${this.baseUrl}${path}`, {
          ...rest,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!retryResponse.ok) {
          throw new ApiError(retryResponse.status, await retryResponse.text());
        }
        return retryResponse.json() as Promise<T>;
      }
      throw new ApiError(401, "Not authenticated");
    }

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, body: string) {
    super(`API Error ${status}: ${body}`);
    this.name = "ApiError";
    this.status = status;
  }
}

export const api = new ApiClient(API_BASE_URL);
