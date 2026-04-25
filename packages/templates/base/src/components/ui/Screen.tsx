import { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  /** Optional override for the inner background. Defaults to white / dark gray-950. */
  className?: string;
}

/**
 * The outermost container for every app screen. Constrains the app to a
 * phone-sized frame and centers it on wide viewports so the result looks
 * like a real mobile app, not a stretched website.
 *
 * Always wrap your App.tsx contents in <Screen>.
 */
export function Screen({ children, className = "" }: ScreenProps) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black antialiased font-sans text-gray-900 dark:text-white">
      <div
        className={[
          "mx-auto max-w-[430px] min-h-screen relative overflow-hidden",
          "bg-white dark:bg-gray-950",
          className,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
