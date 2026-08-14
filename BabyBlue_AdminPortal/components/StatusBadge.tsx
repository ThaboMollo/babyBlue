import type { AppointmentStatus } from "@/types";

const config: Record<AppointmentStatus, { label: string; className: string }> = {
  waiting: {
    label: "Waiting",
    className: "bg-gray-100 text-gray-700",
  },
  in_consultation: {
    label: "In Consultation",
    className: "bg-blue-100 text-[#0B5AA8]",
  },
  done: {
    label: "Done",
    className: "bg-emerald-100 text-[#0FAE7B]",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-400",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-yellow-100 text-yellow-700",
  },
};

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, className } = config[status] ?? config.scheduled;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
