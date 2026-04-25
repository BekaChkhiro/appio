type Environment = "development" | "staging" | "production";

const API_URLS: Record<Environment, string> = {
  development: "http://localhost:8000",
  staging: "https://api-staging.appio.app",
  production: "https://api.appio.app",
};

function getEnvironment(): Environment {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_ENV) {
    return process.env.NEXT_PUBLIC_API_ENV as Environment;
  }
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return "production";
  }
  return "development";
}

export function getApiBaseUrl(): string {
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_API_BASE_URL
  ) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  return API_URLS[getEnvironment()];
}

export function getAppBaseUrl(): string {
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_APP_BASE_URL
  ) {
    return process.env.NEXT_PUBLIC_APP_BASE_URL;
  }
  const env = getEnvironment();
  if (env === "development") return "http://localhost:3000";
  if (env === "staging") return "https://beta.appio.app";
  return "https://appio.app";
}

export function getUserContentDomain(): string {
  return "appiousercontent.com";
}
