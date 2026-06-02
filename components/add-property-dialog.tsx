"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, ChevronRight, ChevronLeft, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────
// Property taxonomy
// ─────────────────────────────────────────────

export const PROPERTY_CATEGORIES = [
  {
    value: "single_family",
    label: "Single-Family Home",
    description: "One dwelling on its own plot — bungalows, villas, stand-alone houses",
    icon: "🏠",
    subtypes: [
      { value: "bungalow",   label: "Bungalow" },
      { value: "villa",      label: "Villa" },
      { value: "standalone", label: "Stand-alone House" },
      { value: "townhouse",  label: "Townhouse / Row House" },
      { value: "maisonette", label: "Maisonette" },
    ],
  },
  {
    value: "multi_family",
    label: "Multi-Family Home",
    description: "Multiple separate dwellings — apartments, condominiums, blocks",
    icon: "🏢",
    subtypes: [
      { value: "apartment_block", label: "Apartment Block" },
      { value: "condominium",     label: "Condominium" },
      { value: "duplex",          label: "Duplex / Semi-detached" },
      { value: "triplex",         label: "Triplex" },
      { value: "bedsitters",      label: "Bedsitters Block" },
    ],
  },
  {
    value: "specialized",
    label: "Specialized Home",
    description: "Purpose-built residences — studios, servant quarters, guest houses",
    icon: "🏨",
    subtypes: [
      { value: "studio",           label: "Studio Apartment(s)" },
      { value: "servant_quarters", label: "Servant Quarters / Boy's Quarters" },
      { value: "guest_house",      label: "Guest House / Short-stay" },
      { value: "hostel",           label: "Hostel / Student Housing" },
    ],
  },
] as const;

export type PropertyCategoryValue = typeof PROPERTY_CATEGORIES[number]["value"];

export const TYPE_LABELS: Record<string, string> = Object.fromEntries([
  ...PROPERTY_CATEGORIES.flatMap((cat) =>
    cat.subtypes.map((sub) => [sub.value, sub.label] as [string, string])
  ),
  ...PROPERTY_CATEGORIES.map((cat) => [cat.value, cat.label] as [string, string]),
]);

// ─────────────────────────────────────────────
// Pattern inference from two examples
// ─────────────────────────────────────────────
// Strategy: tokenize each label into runs of letters / digits / punctuation.
// Both labels must produce the same shape. Each position then becomes a
// segment: text (identical strings), number range, or single-letter range.
// The "outer" counting segment (first encountered) is treated as the floor.

type Token =
  | { kind: "text"; value: string }
  | { kind: "number"; from: number; to: number; width: number; pad: boolean; isFloor: boolean }
  | { kind: "letter"; from: string; to: string; isFloor: boolean };

function tokenize(s: string): { kind: "L" | "N" | "T"; v: string }[] {
  const out: { kind: "L" | "N" | "T"; v: string }[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
      out.push({ kind: "L", v: s.slice(i, j) }); i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i; while (j < s.length && /[0-9]/.test(s[j])) j++;
      out.push({ kind: "N", v: s.slice(i, j) }); i = j;
    } else {
      let j = i; while (j < s.length && !/[A-Za-z0-9]/.test(s[j])) j++;
      out.push({ kind: "T", v: s.slice(i, j) }); i = j;
    }
  }
  return out;
}

type InferOutcome =
  | { ok: true;  segments: Token[] }
  | { ok: false; error: string };

export function inferPattern(first: string, last: string): InferOutcome {
  const a = first.trim(), b = last.trim();
  return { ok: false, error: "Type a first unit name." };
  if (!b) return { ok: false, error: "Type a last unit name (e.g. the highest-numbered)." };

  const ta = tokenize(a), tb = tokenize(b);
  if (ta.length !== tb.length) {
    return { error: `"${a}" and "${b}" don't follow the same shape.` };
  }

  const segs: Token[] = [];
  let floorAssigned = false;

  for (let k = 0; k < ta.length; k++) {
    const x = ta[k], y = tb[k];
    if (x.kind !== y.kind) {
      return { error: `Pieces don't match between "${a}" and "${b}".` };
    }
    if (x.kind === "T") {
      if (x.v !== y.v) return { error: `Punctuation differs between the two examples.` };
      segs.push({ kind: "text", value: x.v });
    } else if (x.kind === "N") {
      const from = parseInt(x.v, 10);
      const to = parseInt(y.v, 10);
      if (to < from) return { error: `"${y.v}" should be greater than "${x.v}".` };
      const pad = x.v.length === y.v.length && (x.v.length > 1 || x.v.startsWith("0"));
      const width = Math.max(x.v.length, y.v.length);
      const isFloor = !floorAssigned;
      if (isFloor) floorAssigned = true;
      segs.push({ kind: "number", from, to, width, pad, isFloor });
    } else { // letters
      if (x.v.length === 1 && y.v.length === 1) {
        const from = x.v.toUpperCase(), to = y.v.toUpperCase();
        if (to.charCodeAt(0) < from.charCodeAt(0)) {
          return { error: `"${y.v}" should come after "${x.v}" in the alphabet.` };
        }
        const isFloor = !floorAssigned;
        if (isFloor) floorAssigned = true;
        segs.push({ kind: "letter", from, to, isFloor });
      } else if (x.v === y.v) {
        // identical multi-letter run — treat as fixed text (e.g. "Apt")
        segs.push({ kind: "text", value: x.v });
      } else {
        return { error: `Can't auto-detect a range from "${x.v}" to "${y.v}".` };
      }
    }
  }
  return { segments: segs };
}

export interface GeneratedUnit { label: string; floor: string | null; }

// Expand a single segment to its string values.
function expandSegment(seg: Token): string[] {
  if (seg.kind === "text") return [seg.value];
  if (seg.kind === "number") {
    const out: string[] = [];
    for (let i = seg.from; i <= seg.to && out.length < 2000; i++) {
      out.push(String(i).padStart(seg.pad ? seg.width : 0, "0"));
    }
    return out;
  }
  const out: string[] = [];
  const a = seg.from.charCodeAt(0) - 65, b = seg.to.charCodeAt(0) - 65;
  for (let i = a; i <= b; i++) out.push(String.fromCharCode(65 + i));
  return out;
}

// Floor values (or [null] if no floor segment was inferred).
export function floorValuesFromSegments(segs: Token[]): string[] {
  const floor = segs.find((s) => s.kind !== "text" && (s as Exclude<Token, { kind: "text" }>).isFloor);
  return floor ? expandSegment(floor) : [];
}

// How many units per floor the *pattern* implies (the inner cross-product).
export function innerCountFromSegments(segs: Token[]): number {
  let n = 1;
  for (const s of segs) {
    if (s.kind === "text") continue;
    if (s.isFloor) continue;
    n *= expandSegment(s).length;
  }
  return n;
}

// Generate units, with optional per-floor count overrides.
// overrides: map of floor value → number of units (e.g. { "A": 4, "F": 2 }).
// Empty string or undefined for a floor means "use the pattern default".
function generateFromSegments(
  segs: Token[],
  overrides: Record<string, string> = {},
): GeneratedUnit[] {
  if (segs.length === 0) return [];

  const floorSeg = segs.find(
    (s) => s.kind !== "text" && (s as Exclude<Token, { kind: "text" }>).isFloor
  );
  const innerSegs = segs.filter((s) => s !== floorSeg);

  // Order in the label: figure out which segments come before/after the floor.
  const floorIndex = floorSeg ? segs.indexOf(floorSeg) : -1;
  const beforeFloor = floorSeg ? segs.slice(0, floorIndex).filter((s) => s !== floorSeg) : innerSegs;
  const afterFloor = floorSeg ? segs.slice(floorIndex + 1) : [];

  function cross(list: Token[]): string[] {
    let out = [""];
    for (const s of list) {
      const parts = expandSegment(s);
      const next: string[] = [];
      for (const c of out) for (const p of parts) next.push(c + p);
      out = next;
      if (out.length > 5000) break;
    }
    return out;
  }

  const beforeParts = cross(beforeFloor);
  const afterParts = cross(afterFloor);
  const innerCombos: string[] = [];
  for (const b of beforeParts) for (const a of afterParts) innerCombos.push(b + "|" + a);
  // We rebuild per-floor: prefix + floor + suffix

  const fVals = floorSeg ? expandSegment(floorSeg) : [null as unknown as string];
  const out: GeneratedUnit[] = [];

  for (const fv of fVals) {
    const o = overrides[fv ?? ""];
    const limit = o !== undefined && o !== "" && Number(o) >= 0
      ? Math.min(Number(o), innerCombos.length)
      : innerCombos.length;
    for (let i = 0; i < limit && out.length < 5000; i++) {
      const [before, after] = innerCombos[i].split("|");
      const label = floorSeg ? before + fv + after : before + after;
      out.push({ label, floor: floorSeg ? fv : null });
    }
  }
  return out;
}

function generateFromList(text: string): GeneratedUnit[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label, floor: null }));
}

// ─────────────────────────────────────────────
// Naming state — two modes only
// ─────────────────────────────────────────────

type NameMode = "pattern" | "list";

interface NamingState {
  mode: NameMode;
  first: string;
  last: string;
  list: string;
  varyByFloor: boolean;
  perFloor: Record<string, string>; // floor value → count (string for input)
}

const INITIAL_NAMING: NamingState = {
  mode: "pattern", first: "", last: "", list: "",
  varyByFloor: false, perFloor: {},
};

function generateUnits(n: NamingState): { units: GeneratedUnit[]; error?: string } {
  if (n.mode === "list") return { units: generateFromList(n.list) };
  if (!n.first && !n.last) return { units: [] };
  const res = inferPattern(n.first, n.last);
  if (!res.ok) return { units: [], error: res.error };
  const overrides = n.varyByFloor ? n.perFloor : {};
  return { units: generateFromSegments(res.segments, overrides) };
}

function previewUnits(n: NamingState) {
  const { units, error } = generateUnits(n);
  const labels = units.map((u) => u.label);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const l of labels) { if (seen.has(l) && !dupes.includes(l)) dupes.push(l); seen.add(l); }
  const sample = labels.length <= 7 ? labels : [...labels.slice(0, 5), "…", ...labels.slice(-2)];
  return { sample, total: labels.length, dupes, error };
}

// ─────────────────────────────────────────────
// Rent categories
// ─────────────────────────────────────────────

interface UnitType { id: string; name: string; rent: string; bedrooms: string; bathrooms: string; }
const newType = (name = "", rent = ""): UnitType => ({
  id: Math.random().toString(36).slice(2, 9), name, rent, bedrooms: "", bathrooms: "",
});

// ─────────────────────────────────────────────
// Drafts + steps
// ─────────────────────────────────────────────

interface DraftUnit { key: string; number: string; floor: string | null; typeId: string; rentOverride: string; }

type Step = "category" | "subtype" | "details" | "units" | "review";

interface FormState { category: string; type: string; name: string; address: string; description: string; }
const INITIAL_FORM: FormState = { category: "", type: "", name: "", address: "", description: "" };

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function AddPropertyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("category");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [naming, setNaming] = useState<NamingState>(INITIAL_NAMING);
  const [types, setTypes] = useState<UnitType[]>([newType("Standard", "")]);
  const [drafts, setDrafts] = useState<DraftUnit[]>([]);

  const selectedCategory = PROPERTY_CATEGORIES.find((c) => c.value === form.category);
  const isSingleFamily = selectedCategory?.value === "single_family";
  const preview = useMemo(() => previewUnits(naming), [naming]);
  const defaultTypeId = types[0]?.id ?? "";

  // Floors derived from the current pattern (empty until both examples parse).
  const floorInfo = useMemo(() => {
    if (naming.mode !== "pattern") return { floors: [] as string[], defaultCount: 0 };
    const res = inferPattern(naming.first, naming.last);
    if (!res.ok) return { floors: [], defaultCount: 0 };
    return {
      floors: floorValuesFromSegments(res.segments),
      defaultCount: innerCountFromSegments(res.segments),
    };
  }, [naming.mode, naming.first, naming.last]);

  function reset() {
    setForm(INITIAL_FORM); setNaming(INITIAL_NAMING); setTypes([newType("Standard", "")]);
    setDrafts([]); setStep("category");
  }
  function handleOpenChange(v: boolean) { setOpen(v); if (!v) reset(); }
  function handleCategorySelect(v: string) { setForm((f) => ({ ...f, category: v, type: "" })); setStep("subtype"); }
  function handleSubtypeSelect(v: string) {
    setForm((f) => ({ ...f, type: v }));
    if (selectedCategory?.value === "single_family") {
      setNaming({ mode: "list", first: "", last: "", list: "House", varyByFloor: false, perFloor: {} });
    } else {
      setNaming(INITIAL_NAMING);
    }
    setStep("details");
  }
  function handleDetailsNext() {
    if (!form.name.trim()) { toast.error("Property name is required."); return; }
    setStep("units");
  }

  function updateType(id: string, patch: Partial<UnitType>) {
    setTypes((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function addType() { setTypes((ts) => [...ts, newType()]); }
  function removeType(id: string) {
    if (types.length === 1) return;
    setTypes((ts) => ts.filter((t) => t.id !== id));
    setDrafts((ds) => ds.map((d) => (d.typeId === id ? { ...d, typeId: defaultTypeId } : d)));
  }

  function handleGenerate() {
    const { units, error } = generateUnits(naming);
    if (error) { toast.error(error); return; }
    if (units.length === 0) { toast.error("Add at least one unit first."); return; }
    if (preview.dupes.length > 0) {
      toast.error(`Duplicate labels: ${preview.dupes.join(", ")}.`); return;
    }
    if (!types.some((t) => Number(t.rent) > 0)) {
      toast.error("Give at least one rent category an amount."); return;
    }
    setDrafts(units.map((u, i) => ({
      key: `${u.label}-${i}`, number: u.label, floor: u.floor,
      typeId: defaultTypeId, rentOverride: "",
    })));
    setStep("review");
  }

  function updateDraft(key: string, patch: Partial<DraftUnit>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDraft(key: string) { setDrafts((ds) => ds.filter((d) => d.key !== key)); }
  function assignFloorType(floor: string | null, typeId: string) {
    setDrafts((ds) => ds.map((d) => (d.floor === floor ? { ...d, typeId, rentOverride: "" } : d)));
  }
  function rentFor(d: DraftUnit): number {
    if (d.rentOverride !== "" && Number(d.rentOverride) > 0) return Number(d.rentOverride);
    const t = types.find((x) => x.id === d.typeId);
    return Number(t?.rent) || 0;
  }

  async function handleSubmit(skip = false) {
    if (!form.name.trim()) { toast.error("Property name is required."); return; }
    const wantsUnits = !skip && drafts.length > 0;
    if (wantsUnits) {
      const bad = drafts.find((d) => rentFor(d) <= 0);
      if (bad) { toast.error(`Unit "${bad.number}" has no rent set.`); return; }
      const labels = drafts.map((d) => d.number.trim());
      const dup = labels.find((l, i) => labels.indexOf(l) !== i);
      if (dup) { toast.error(`Duplicate unit label "${dup}".`); return; }
    }

    setLoading(true);
    try {
      const propRes = await fetch("/api/properties", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), address: form.address.trim() || null,
          type: form.type || form.category, description: form.description.trim() || null,
        }),
      });
      const propData = await propRes.json();
      if (!propRes.ok) throw new Error(propData.error || "Failed to create property");
      const property = propData.property;

      if (wantsUnits) {
        let created = 0;
        for (const d of drafts) {
          const t = types.find((x) => x.id === d.typeId);
          const r = await fetch(`/api/properties/${property.id}/units`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({
              property_id: property.id, landlord_id: property.landlord_id,
              number: d.number.trim(), floor: d.floor,
              bedrooms: t?.bedrooms ? Number(t.bedrooms) : null,
              bathrooms: t?.bathrooms ? Number(t.bathrooms) : null,
              rent_amount: rentFor(d), status: "vacant",
            }),
          });
          if (r.ok) created++;
          else { const ud = await r.json(); toast.warning(`Unit "${d.number}": ${ud.error ?? "failed"}`); }
        }
        toast.success(`Property added with ${created} unit${created !== 1 ? "s" : ""}.`);
      } else {
        toast.success("Property added.");
      }
      setOpen(false); reset(); router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  const draftsByFloor = useMemo(() => {
    const map = new Map<string, DraftUnit[]>();
    for (const d of drafts) {
      const k = d.floor === null ? "—" : d.floor;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return Array.from(map.entries());
  }, [drafts]);

  const totalRent = drafts.reduce((s, d) => s + rentFor(d), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg"><Plus className="h-4 w-4" /> Add property</Button>
      </DialogTrigger>

      <DialogContent className={`${step === "review" ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>
            {step === "category" && "What kind of property is this?"}
            {step === "subtype"  && `Choose the specific type of ${selectedCategory?.label?.toLowerCase()}.`}
            {step === "details"  && "Name and location of the property."}
            {step === "units"    && "Tell us how your units are named."}
            {step === "review"   && "Review and adjust each unit before saving."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 */}
        {step === "category" && (
          <div className="space-y-2 py-1">
            {PROPERTY_CATEGORIES.map((cat) => (
              <button key={cat.value} type="button" onClick={() => handleCategorySelect(cat.value)}
                className="flex w-full items-start gap-3 rounded-lg border bg-white px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="text-2xl leading-none">{cat.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cat.description}</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 self-center text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2 */}
        {step === "subtype" && selectedCategory && (
          <div className="space-y-1.5 py-1">
            {selectedCategory.subtypes.map((sub) => (
              <button key={sub.value} type="button" onClick={() => handleSubtypeSelect(sub.value)}
                className={`flex w-full items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-left text-sm transition hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${form.type === sub.value ? "border-primary bg-primary/5 font-semibold" : ""}`}>
                {sub.label}<ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("category")}>
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>{selectedCategory?.icon}</span>
              <span>{selectedCategory?.label} → {selectedCategory?.subtypes.find((s) => s.value === form.type)?.label}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Property name</Label>
              <Input id="p-name" required autoFocus value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={isSingleFamily ? "Nakawa Villa" : "Nakawa Apartments"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-address">Address <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="p-address" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Plot 12, Nakawa, Kampala" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="p-desc" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Gated compound, borehole water" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep("subtype")}>
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button type="button" onClick={handleDetailsNext}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4 — the simple one */}
        {step === "units" && (
          <div className="space-y-4">
            {isSingleFamily ? (
              <div className="space-y-2">
                <Label htmlFor="sf-label">Unit label</Label>
                <Input id="sf-label" value={naming.list}
                  onChange={(e) => setNaming({ ...naming, mode: "list", list: e.target.value })} placeholder="House" />
              </div>
            ) : (
              <>
                {/* Mode tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNaming({ ...naming, mode: "pattern" })}
                    className={`rounded-lg border px-3 py-2 text-left transition hover:border-primary ${naming.mode === "pattern" ? "border-primary bg-primary/5" : "bg-white"}`}>
                    <div className="text-sm font-semibold">They follow a pattern</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">1A–4D, A01–F12, Apt 1–Apt 12…</div>
                  </button>
                  <button type="button" onClick={() => setNaming({ ...naming, mode: "list" })}
                    className={`rounded-lg border px-3 py-2 text-left transition hover:border-primary ${naming.mode === "list" ? "border-primary bg-primary/5" : "bg-white"}`}>
                    <div className="text-sm font-semibold">They have names</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Rose Cottage, Haven, The Nook…</div>
                  </button>
                </div>

                {naming.mode === "pattern" ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Type your <strong>first</strong> unit name and your <strong>last</strong> unit name. We&apos;ll figure out everything in between.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="first">First unit</Label>
                        <Input id="first" value={naming.first}
                          onChange={(e) => setNaming({ ...naming, first: e.target.value })}
                          placeholder="1A" autoComplete="off" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last">Last unit</Label>
                        <Input id="last" value={naming.last}
                          onChange={(e) => setNaming({ ...naming, last: e.target.value })}
                          placeholder="4D" autoComplete="off" />
                      </div>
                    </div>

                    <details className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                      <summary className="cursor-pointer font-medium text-muted-foreground">See examples</summary>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        <li><code className="rounded bg-white px-1.5 py-0.5">1A</code> → <code className="rounded bg-white px-1.5 py-0.5">4D</code> gives 1A, 1B … 4D (16 units, 4 floors)</li>
                        <li><code className="rounded bg-white px-1.5 py-0.5">A01</code> → <code className="rounded bg-white px-1.5 py-0.5">F12</code> gives A01 … F12 (72 units, 6 floors)</li>
                        <li><code className="rounded bg-white px-1.5 py-0.5">Apt 1</code> → <code className="rounded bg-white px-1.5 py-0.5">Apt 12</code> gives Apt 1 … Apt 12</li>
                        <li><code className="rounded bg-white px-1.5 py-0.5">101</code> → <code className="rounded bg-white px-1.5 py-0.5">412</code> gives 101 … 412</li>
                      </ul>
                    </details>

                    {/* Per-floor count override — appears only when a floor pattern is detected */}
                    {floorInfo.floors.length > 0 && (
                      <div className="space-y-2">
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={naming.varyByFloor}
                            onChange={(e) => {
                              const on = e.target.checked;
                              const seed: Record<string, string> = {};
                              if (on) for (const f of floorInfo.floors) seed[f] = naming.perFloor[f] ?? "";
                              setNaming({ ...naming, varyByFloor: on, perFloor: on ? seed : naming.perFloor });
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
                          />
                          <span>
                            Some floors have a different number of units
                            <span className="block text-[11px] text-muted-foreground">
                              e.g. ground floor has shops, top floor has fewer units
                            </span>
                          </span>
                        </label>

                        {naming.varyByFloor && (
                          <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                            <p className="text-[11px] text-muted-foreground">
                              Leave a floor blank to use the default ({floorInfo.defaultCount}).
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {floorInfo.floors.map((f) => (
                                <div key={f} className="flex items-center gap-1.5">
                                  <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
                                    {f}
                                  </span>
                                  <Input
                                    type="number" min={0} className="h-8"
                                    value={naming.perFloor[f] ?? ""}
                                    placeholder={String(floorInfo.defaultCount)}
                                    onChange={(e) =>
                                      setNaming({
                                        ...naming,
                                        perFloor: { ...naming.perFloor, [f]: e.target.value },
                                      })
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="name-list">One unit name per line</Label>
                    <textarea id="name-list" rows={6} value={naming.list}
                      onChange={(e) => setNaming({ ...naming, list: e.target.value })}
                      placeholder={"Rose Cottage\nThe Nook\nHaven\nFlat 3"}
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  </div>
                )}

                {/* Preview */}
                <div className="rounded-md border bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                  {preview.error ? (
                    <p className="mt-1 text-xs text-red-600">{preview.error}</p>
                  ) : preview.total > 0 ? (
                    <>
                      <p className="mt-1 font-mono text-sm break-words">{preview.sample.join("   ")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{preview.total} unit{preview.total !== 1 ? "s" : ""} total</p>
                      {preview.dupes.length > 0 && <p className="mt-1 text-xs text-red-600">Duplicates: {preview.dupes.join(", ")}</p>}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {naming.mode === "pattern"
                        ? "Type your first and last unit names above."
                        : "Type your unit names above."}
                    </p>
                  )}
                </div>

                {/* Rent categories */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Rent categories</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addType}>
                      <Plus className="h-3.5 w-3.5" /> Add category
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Add one per price point (e.g. Single, Double, Triple). You&apos;ll assign units to them on the next screen.
                  </p>
                  {types.map((t, i) => (
                    <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
                      <div className="space-y-1">
                        {i === 0 && <span className="text-[11px] text-muted-foreground">Name</span>}
                        <Input value={t.name} placeholder="Single" onChange={(e) => updateType(t.id, { name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        {i === 0 && <span className="text-[11px] text-muted-foreground">Rent (UGX)</span>}
                        <Input type="number" min={1} className="w-32" value={t.rent} placeholder="600000"
                          onChange={(e) => updateType(t.id, { rent: e.target.value })} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" disabled={types.length === 1}
                        onClick={() => removeType(t.id)} className="text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("details")} className="order-last sm:order-first">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={loading} onClick={() => handleSubmit(true)}>Skip for now</Button>
                <Button type="button" onClick={handleGenerate}>Review units <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {/* Step 5 — review */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {drafts.length} unit{drafts.length !== 1 ? "s" : ""} · expected monthly total{" "}
                <strong className="text-foreground">UGX {totalRent.toLocaleString()}</strong>
              </span>
            </div>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium">Floor</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Rent (UGX)</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {draftsByFloor.map(([floorKey, rows]) => (
                    <FloorGroup key={floorKey} floorKey={floorKey} rows={rows} types={types}
                      rentFor={rentFor} onUpdate={updateDraft} onRemove={removeDraft}
                      onAssignFloor={(typeId) => assignFloorType(floorKey === "—" ? null : floorKey, typeId)} />
                  ))}
                </tbody>
              </table>
            </div>
            {drafts.length === 0 && <p className="text-center text-sm text-muted-foreground">All units removed — go back to add some, or skip.</p>}
            <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("units")} className="order-last sm:order-first">
                <ChevronLeft className="h-3.5 w-3.5" /> Back to setup
              </Button>
              <Button type="button" disabled={loading || drafts.length === 0} onClick={() => handleSubmit(false)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${drafts.length} unit${drafts.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Review-table floor group
// ─────────────────────────────────────────────

function FloorGroup({
  floorKey, rows, types, rentFor, onUpdate, onRemove, onAssignFloor,
}: {
  floorKey: string; rows: DraftUnit[]; types: UnitType[];
  rentFor: (d: DraftUnit) => number;
  onUpdate: (key: string, patch: Partial<DraftUnit>) => void;
  onRemove: (key: string) => void;
  onAssignFloor: (typeId: string) => void;
}) {
  return (
    <>
      <tr className="border-t bg-muted/20">
        <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {floorKey === "—" ? "Units" : `Floor ${floorKey}`} · {rows.length}
        </td>
        <td colSpan={3} className="px-3 py-1.5 text-right">
          <select defaultValue=""
            onChange={(e) => { if (e.target.value) onAssignFloor(e.target.value); e.currentTarget.value = ""; }}
            className="rounded border bg-white px-2 py-1 text-xs text-muted-foreground">
            <option value="">Set whole floor to…</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name || "Unnamed"}</option>)}
          </select>
        </td>
      </tr>
      {rows.map((d) => (
        <tr key={d.key} className="border-t">
          <td className="px-3 py-1.5">
            <Input value={d.number} className="h-8" onChange={(e) => onUpdate(d.key, { number: e.target.value })} />
          </td>
          <td className="px-3 py-1.5 text-xs text-muted-foreground">{d.floor ?? "—"}</td>
          <td className="px-3 py-1.5">
            <select value={d.typeId} onChange={(e) => onUpdate(d.key, { typeId: e.target.value, rentOverride: "" })}
              className="h-8 w-full rounded border bg-white px-2 text-sm">
              {types.map((t) => <option key={t.id} value={t.id}>{t.name || "Unnamed"}</option>)}
            </select>
          </td>
          <td className="px-3 py-1.5">
            <Input type="number" min={1} className="h-8 w-28" value={d.rentOverride}
              placeholder={String(rentFor({ ...d, rentOverride: "" }) || "")}
              onChange={(e) => onUpdate(d.key, { rentOverride: e.target.value })} />
          </td>
          <td className="px-3 py-1.5 text-right">
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(d.key)}
              className="h-7 w-7 text-muted-foreground hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </td>
        </tr>
      ))}
    </>
  );
}
