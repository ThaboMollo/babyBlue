"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

export default function Toast({
  message,
  type = "success",
  duration = 4000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className={[
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg",
        "transition-all duration-300",
        type === "success"
          ? "bg-emerald-50 border border-accent/30 text-accent-dark"
          : "bg-red-50 border border-error/30 text-error",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      ].join(" ")}
      role="alert"
    >
      {type === "success" ? (
        <CheckCircle size={18} />
      ) : (
        <XCircle size={18} />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="ml-2 text-current opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
