import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col px-6 py-8 md:px-16 md:py-12">
        <Link href="/" className="flex items-center gap-2 self-start">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="font-display text-lg font-semibold leading-none">m</span>
          </div>
          <span className="font-display text-base font-semibold">Mwenye Nyumba</span>
        </Link>

        <div className="my-auto w-full max-w-sm">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>

        <p className="mt-auto text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mwenye Nyumba
        </p>
      </div>

      {/* Right: visual */}
      <aside className="relative hidden overflow-hidden border-l border-border/60 bg-primary md:block">
        <div className="absolute inset-0 bg-[radial-gradient(at_20%_20%,hsl(38_92%_50%/0.25),transparent_50%),radial-gradient(at_80%_70%,hsl(38_92%_60%/0.1),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div />
          <blockquote className="max-w-md text-primary-foreground">
            <p className="font-display text-2xl italic leading-snug md:text-3xl">
              &ldquo;The best landlord I&apos;ve had in years.&rdquo;
            </p>
            <footer className="mt-4 text-sm tracking-wide text-primary-foreground/70">
              — every tenant who got a clean invoice on time
            </footer>
          </blockquote>
        </div>
      </aside>
    </main>
  );
}
