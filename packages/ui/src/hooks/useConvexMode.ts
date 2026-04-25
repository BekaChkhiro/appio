import { createContext, useContext, type ReactNode, createElement } from "react";

export type ConvexMode = "sandbox" | "published";

// A sentinel is used as the default so `useConvexMode` can detect callers
// rendering outside a `ConvexModeProvider` and warn in development.
// Consumers still get a safe `"sandbox"` fallback at runtime — the intent
// is surfacing the missing provider during dev, not hard-failing prod UI.
const MISSING_PROVIDER = Symbol("useConvexMode.missingProvider");
type InternalMode = ConvexMode | typeof MISSING_PROVIDER;

const ConvexModeContext = createContext<InternalMode>(MISSING_PROVIDER);

export function ConvexModeProvider({
  mode,
  children,
}: {
  mode: ConvexMode;
  children: ReactNode;
}) {
  return createElement(ConvexModeContext.Provider, { value: mode }, children);
}

export function useConvexMode(): ConvexMode {
  const value = useContext(ConvexModeContext);
  if (value === MISSING_PROVIDER) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[@appio/ui] useConvexMode() called outside a ConvexModeProvider. " +
          'Defaulting to "sandbox". Wrap your app in <ConvexClientProvider> ' +
          "(or a bare <ConvexModeProvider mode=...>) to silence this warning.",
      );
    }
    return "sandbox";
  }
  return value;
}
