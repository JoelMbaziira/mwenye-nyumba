"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Phone, CreditCard, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const MOBILE_PROVIDERS = ["MTN MoMo", "Airtel Money", "M-Pesa"] as const;
const CARD_PROVIDERS   = ["Visa", "Mastercard"] as const;
type PaymentMethod = "mobile" | "card";
type Step = "form" | "submitting" | "pending";

export function PayForm({ invoiceId, amount }: { invoiceId: string; amount: number }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("mobile");
  const [step, setStep] = useState<Step>("form");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNetwork, setCardNetwork] = useState("");

  function formatCardNumber(v: string) { return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(); }
  function formatExpiry(v: string) { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0,2) + "/" + d.slice(2) : d; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "mobile") {
      if (!provider) { toast.error("Choose a provider."); return; }
      if (!phone)    { toast.error("Enter your phone number."); return; }
    } else {
      if (!cardNetwork)                             { toast.error("Choose a card network."); return; }
      if (cardNumber.replace(/\s/g,"").length < 16) { toast.error("Enter a valid card number."); return; }
      if (cardExpiry.length < 5)                    { toast.error("Enter a valid expiry date."); return; }
      if (cardCvv.length < 3)                       { toast.error("Enter a valid CVV."); return; }
      if (!cardName.trim())                         { toast.error("Enter the name on your card."); return; }
    }

    setStep("submitting");

    try {
      const body = method === "mobile"
        ? { phone, provider }
        : { provider: cardNetwork, cardNumber: cardNumber.replace(/\s/g,""), cardExpiry, cardName, method: "card" };

      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      setStep("pending");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
      setStep("form");
    }
  }

  // ── Pending confirmation state ─────────────────────────────────────────────
  if (step === "pending") {
    return (
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-amber-900">Payment submitted</h3>
        <p className="mt-2 text-sm text-amber-800">
          Your payment of <strong>{formatCurrency(amount)}</strong> via{" "}
          <strong>{method === "mobile" ? provider : cardNetwork}</strong> has been submitted.
        </p>
        <p className="mt-1 text-sm text-amber-700">
          The landlord will review and confirm it shortly. You&apos;ll receive a receipt once approved.
        </p>
      </div>
    );
  }

  // ── Submitting ─────────────────────────────────────────────────────────────
  if (step === "submitting") {
    return (
      <div className="space-y-4 py-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Submitting payment…</p>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Method tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
        {(["mobile", "card"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)}
            className={cn("flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all",
              method === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {m === "mobile" ? <Phone className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            {m === "mobile" ? "Mobile Money" : "Card"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {method === "mobile" ? (
          <>
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="grid grid-cols-3 gap-2">
                {MOBILE_PROVIDERS.map((p) => (
                  <button key={p} type="button" onClick={() => setProvider(p)}
                    className={cn("rounded-lg border px-2 py-2.5 text-xs font-semibold text-center transition-all",
                      provider === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                    <span className="block text-base leading-none mb-0.5">{p === "MTN MoMo" ? "🟡" : p === "Airtel Money" ? "🔴" : "🟢"}</span>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256 7XX XXX XXX" />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Card network</Label>
              <div className="grid grid-cols-2 gap-2">
                {CARD_PROVIDERS.map((n) => (
                  <button key={n} type="button" onClick={() => setCardNetwork(n)}
                    className={cn("rounded-lg border px-3 py-2.5 text-xs font-semibold text-center transition-all",
                      cardNetwork === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                    <span className="block text-base leading-none mb-0.5">💳</span>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Card number</Label>
              <Input type="text" inputMode="numeric" required value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Input type="text" inputMode="numeric" required value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} />
              </div>
              <div className="space-y-2">
                <Label>CVV</Label>
                <Input type="text" inputMode="numeric" required value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" maxLength={4} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name on card</Label>
              <Input type="text" required value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="JOHN DOE" className="uppercase" />
            </div>
          </>
        )}

        <Button type="submit" size="lg" className="w-full mt-2 bg-primary hover:bg-primary/90">
          Submit payment — {formatCurrency(amount)}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Your payment will be confirmed by the landlord.
        </p>
      </form>
    </div>
  );
}
