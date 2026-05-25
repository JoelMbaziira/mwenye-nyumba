import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Receipt, Send, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="font-display text-lg font-semibold leading-none">m</span>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Mwenye Nyumba
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            For landlords. Built in Uganda.
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl">
            Rent reminders,
            <br />
            <span className="italic text-muted-foreground">sent right.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Register your tenants, send invoices by email, and watch payments
            land in a clean dashboard. No paper. No chasing. No nonsense.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/login">I already have one</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Three steps */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="container grid gap-8 py-16 md:grid-cols-3 md:py-24">
          <Step
            num="01"
            icon={<Receipt className="h-5 w-5" />}
            title="Register your tenants"
            body="Add each tenant once — name, unit, rent. Edit any time."
          />
          <Step
            num="02"
            icon={<Send className="h-5 w-5" />}
            title="Send a reminder"
            body="One click sends an emailed invoice with a payment link."
          />
          <Step
            num="03"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="See who paid"
            body="Your dashboard updates the moment a tenant settles up."
          />
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Mwenye Nyumba</span>
          <span className="font-mono text-xs">v0.1 demo</span>
        </div>
      </footer>
    </main>
  );
}

function Step({
  num,
  icon,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative">
      <span className="font-mono text-xs tracking-widest text-muted-foreground">
        {num}
      </span>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-accent/15 text-accent-foreground">
          {icon}
        </span>
        <h3 className="font-display text-xl font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </div>
  );
}
