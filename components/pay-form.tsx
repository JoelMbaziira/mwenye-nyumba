"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

const PROVIDERS = ["MTN MoMo", "Airtel Money", "M-Pesa"] as const;

export function PayForm({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<string>("");
  const [step, setStep] = useState<"form" | "confirming">("form");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provider) {
      toast.error("Choose a mobile money provider.");
      return;
    }
    setStep("confirming");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      toast.success("Payment recorded.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
      setStep("form");
    }
  }

  if (step === "confirming") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/20">
          <Phone className="h-5 w-5 text-accent-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold">Check your phone</h3>
        <p className="text-sm text-muted-foreground">
          A {provider} prompt has been sent to <span className="font-medium text-foreground">{phone}</span>.
          Enter your PIN to authorise {formatCurrency(amount)}.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Awaiting confirmation…
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="provider">Mobile money provider</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger id="provider">
            <SelectValue placeholder="Choose a provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+256 7XX XXX XXX"
        />
      </div>

      <Button type="submit" size="lg" variant="accent" className="w-full">
        Pay {formatCurrency(amount)}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        Simulated — no real charge.
      </p>
    </form>
  );
}
