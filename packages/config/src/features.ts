/**
 * Feature flags — used for gradual rollout and A/B testing.
 * In production, these will be controlled by PostHog.
 */

const defaults: Record<string, boolean> = {
  marketplace: false,
  visual_edit: false,
  push_notifications: false,
  store_export: false,
  conversational_refinement: false,
};

export function isFeatureEnabled(key: string): boolean {
  // Check environment override first
  if (typeof process !== "undefined") {
    const envKey = `NEXT_PUBLIC_FF_${key.toUpperCase()}`;
    const envVal = process.env[envKey];
    if (envVal !== undefined) return envVal === "true";
  }

  return defaults[key] ?? false;
}
