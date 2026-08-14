interface PageShellProps {
  children: React.ReactNode;
}

/**
 * Mobile-first flow container: full-screen column on phones,
 * a centered card on larger screens.
 */
export default function PageShell({ children }: PageShellProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-surface sm:my-xl sm:min-h-[640px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-border sm:shadow-sm">
      {children}
    </main>
  );
}
