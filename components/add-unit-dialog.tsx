"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export function AddUnitDialog({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ number: "", bedrooms: "", bathrooms: "", rent_amount: "", notes: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rent = Number(form.rent_amount);
    if (!form.number.trim()) { toast.error("Unit number required."); return; }
    if (isNaN(rent) || rent <= 0) { toast.error("Enter a valid rent amount."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/units`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, rent_amount: rent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(`Unit ${form.number} added.`);
      setForm({ number: "", bedrooms: "", bathrooms: "", rent_amount: "", notes: "" });
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
        <Button><Plus className="h-4 w-4" /> Add unit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a unit</DialogTitle>
          <DialogDescription>Add a rentable unit to this property.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="u-num">Unit #</Label>
              <Input id="u-num" required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="A1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-bed">Beds</Label>
              <Input id="u-bed" type="number" min={0} value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-bath">Baths</Label>
              <Input id="u-bath" type="number" min={0} value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} placeholder="1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-rent">Monthly rent (UGX)</Label>
            <Input id="u-rent" type="number" min={1} required value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} placeholder="600000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="u-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ground floor, furnished" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
