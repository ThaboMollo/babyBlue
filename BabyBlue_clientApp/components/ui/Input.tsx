"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "h-12 w-full rounded-[12px] border border-border bg-surface px-4",
            "text-sm text-text-primary placeholder:text-text-secondary",
            "transition-colors duration-150",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            error ? "border-error focus:border-error focus:ring-error/20" : "",
            className,
          ].join(" ")}
          {...props}
        />
        {error && (
          <p className="text-xs text-error mt-0.5">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
