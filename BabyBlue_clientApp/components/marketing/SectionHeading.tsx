interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "center" | "left";
}

export default function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
        {title}
      </h2>
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-text-secondary sm:text-lg">
          {intro}
        </p>
      )}
    </div>
  );
}
