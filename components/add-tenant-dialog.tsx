"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  unitId?: string;
  propertyId?: string;
  trigger?: React.ReactNode;
}

export function AddTenantDialog({ unitId, propertyId, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", national_id: "", emergency_contact: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error("Name and email are required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, unit_id: unitId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Tenant added.");
      setForm({ name: "", email: "", phone: "", national_id: "", emergency_contact: "" });
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="lg"><Plus className="h-4 w-4" /> Add tenant</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a tenant</DialogTitle>
          <DialogDescription>
            {unitId ? "This tenant will be assigned to this unit." : "Assign the tenant to a unit from the property page."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-name">Full name</Label>
            <Input id="t-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-email">Email</Label>
            <Input id="t-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="t-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+256 7XX XXX XXX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-id">National ID <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="t-id" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} placeholder="CM12345678..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-emerg">Emergency contact <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="t-emerg" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="John Doe · +256 7XX XXX XXX" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
