export interface Stat {
  value: string;
  label: string;
}

export default function StatsBand({ stats }: { stats: Stat[] }) {
  return (
    <section className="bg-primary-dark">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:py-16">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center lg:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-white lg:text-5xl">
              {stat.value}
            </p>
            <p className="mt-2 text-sm leading-snug text-blue-100">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
