interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={[
        "bg-surface rounded-2xl border border-border shadow-sm p-lg",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
