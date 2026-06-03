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

interface Props {
  invoiceId: string;
  invoiceTotal: number;
  alreadyPaid: number;
}

export function PayForm({ invoiceId, invoiceTotal, alreadyPaid }: Props) {
  const router = useRouter();
  const balance = Math.max(0, invoiceTotal - alreadyPaid);

  const [method, setMethod] = useState<PaymentMethod>("mobile");
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState<string>(String(balance));
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
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount."); return;
    }
    if (amountNum > balance) {
      const ok = confirm(
        `You're paying ${formatCurrency(amountNum)} on a ${formatCurrency(balance)} balance.\n\n` +
        `The extra ${formatCurrency(amountNum - balance)} will be credited to your next invoice. Continue?`
      );
      if (!ok) return;
    }

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
        ? { amount: amountNum, phone, provider }
        : { amount: amountNum, provider: cardNetwork, cardNumber: cardNumber.replace(/\s/g,""), cardExpiry, cardName, method: "card" };

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

  if (step === "pending") {
    return (
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-amber-900">Payment submitted</h3>
        <p className="mt-2 text-sm text-amber-800">
          Your payment of <strong>{formatCurrency(Number(amount))}</strong> via{" "}
          <strong>{method === "mobile" ? provider : cardNetwork}</strong> has been submitted.
          You&apos;ll receive a receipt once your landlord approves it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-white p-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice balance</p>
        <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
        {alreadyPaid > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatCurrency(alreadyPaid)} already paid of {formatCurrency(invoiceTotal)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pay-amount">Amount to pay (UGX)</Label>
        <Input id="pay-amount" type="number" min={1} step={1}
          value={amount} onChange={(e) => setAmount(e.target.value)}
          className="text-lg font-semibold" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setAmount(String(balance))}
            className="rounded-md border bg-muted/40 px-3 py-1 text-xs hover:bg-muted">
            Pay full balance
          </button>
          {balance >= 2 && (
            <button type="button" onClick={() => setAmount(String(Math.floor(balance / 2)))}
              className="rounded-md border bg-muted/40 px-3 py-1 text-xs hover:bg-muted">
              Pay half
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMethod("mobile")}
          className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
            method === "mobile" ? "border-primary bg-primary/5 font-semibold" : "bg-white hover:border-primary")}>
          <Phone className="h-4 w-4" /> Mobile money
        </button>
        <button type="button" onClick={() => setMethod("card")}
          className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
            method === "card" ? "border-primary bg-primary/5 font-semibold" : "bg-white hover:border-primary")}>
          <CreditCard className="h-4 w-4" /> Card
        </button>
      </div>

      {method === "mobile" ? (
        <>
          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="grid grid-cols-3 gap-2">
              {MOBILE_PROVIDERS.map((p) => (
                <button key={p} type="button" onClick={() => setProvider(p)}
                  className={cn("rounded-lg border px-2 py-2 text-xs transition",
                    provider === p ? "border-primary bg-primary/5 font-semibold" : "bg-white hover:border-primary")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-phone">Phone</Label>
            <Input id="pay-phone" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="0700 000 000" />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Card network</Label>
            <div className="grid grid-cols-2 gap-2">
              {CARD_PROVIDERS.map((p) => (
                <button key={p} type="button" onClick={() => setCardNetwork(p)}
                  className={cn("rounded-lg border px-2 py-2 text-sm transition",
                    cardNetwork === p ? "border-primary bg-primary/5 font-semibold" : "bg-white hover:border-primary")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-num">Card number</Label>
            <Input id="card-num" value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="0000 0000 0000 0000" inputMode="numeric" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="card-exp">Expiry</Label>
              <Input id="card-exp" value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY" inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-cvv">CVV</Label>
              <Input id="card-cvv" value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123" inputMode="numeric" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-name">Name on card</Label>
            <Input id="card-name" value={cardName}
              onChange={(e) => setCardName(e.target.value)} placeholder="As shown on card" />
          </div>
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={step === "submitting"}>
        {step === "submitting" ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
        ) : (
          <><ShieldCheck className="h-4 w-4" /> Pay {formatCurrency(Number(amount) || 0)}</>
        )}
      </Button>
    </form>
  );
}
