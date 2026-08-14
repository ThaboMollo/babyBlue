import type { AppointmentStatus } from "@/lib/supabase/types";

interface BadgeProps {
  status: AppointmentStatus;
}

const statusConfig: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-slate-100 text-slate-600",
  },
  waiting: {
    label: "Waiting",
    className: "bg-slate-100 text-slate-700",
  },
  in_consultation: {
    label: "In consultation",
    className: "bg-blue-50 text-primary font-semibold",
  },
  done: {
    label: "Done",
    className: "bg-emerald-50 text-accent-dark font-semibold",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-500",
  },
};

export default function Badge({ status }: BadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-sm",
        config.className,
      ].join(" ")}
    >
      {config.label}
    </span>
  );
}
