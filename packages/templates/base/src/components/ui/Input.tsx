import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Mobile-friendly text input. Tall (h-12), rounded, subtle gray background
 * — looks at home in iOS-style forms. Use inside a BottomSheet for new-item
 * forms.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        {...props}
        className={[
          "w-full h-12 px-4 rounded-xl text-base",
          "bg-gray-100 dark:bg-gray-800",
          "text-gray-900 dark:text-white",
          "placeholder:text-gray-400 dark:placeholder:text-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500",
          "transition-all duration-150",
          error ? "ring-2 ring-red-500" : "",
          className,
        ].join(" ")}
      />
      {error && (
        <p className="text-xs text-red-500 mt-1.5">{error}</p>
      )}
    </div>
  ),
);
Input.displayName = "Input";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, className = "", ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        {...props}
        className={[
          "w-full px-4 py-3 rounded-xl text-base",
          "bg-gray-100 dark:bg-gray-800",
          "text-gray-900 dark:text-white",
          "placeholder:text-gray-400 dark:placeholder:text-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500",
          "transition-all duration-150 resize-none",
          className,
        ].join(" ")}
      />
    </div>
  ),
);
TextArea.displayName = "TextArea";
