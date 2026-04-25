import { ReactNode, useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Slide-up modal anchored to the bottom edge with rounded top corners and
 * a backdrop. Use this for "add item" forms or context menus instead of
 * centered web-style modals.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
          "transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />
      <div
        className={[
          "fixed left-1/2 -translate-x-1/2 bottom-0 z-50 w-full max-w-[430px]",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl pb-10 pt-2 px-5">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
          {title && (
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
