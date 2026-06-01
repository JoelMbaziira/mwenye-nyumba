"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

const TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial",  label: "Commercial" },
  { value: "multifamily", label: "Multifamily" },
  { value: "mixed_use",   label: "Mixed Use" },
  { value: "short_term",  label: "Short-term Rental" },
  { value: "industrial",  label: "Industrial" },
  { value: "land",        label: "Land" },
];

export function AddPropertyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", type: "residential", description: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Property name is required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Property added.");
      setForm({ name: "", address: "", type: "residential", description: "" });
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
        <Button size="lg"><Plus className="h-4 w-4" /> Add property</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>You can add units and tenants after.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Property name</Label>
            <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nakawa Apartments" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-address">Address <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="p-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Plot 12, Nakawa, Kampala" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
