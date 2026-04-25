declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => string;
      isNativePlatform: () => boolean;
    };
  }
}

export function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!window.Capacitor;
}

export function isWeb(): boolean {
  return !isCapacitor();
}

export function isIOS(): boolean {
  return isCapacitor() && window.Capacitor!.getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return isCapacitor() && window.Capacitor!.getPlatform() === "android";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as unknown as { standalone: boolean }).standalone)
  );
}
