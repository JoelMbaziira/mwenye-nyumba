import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { ReceiptDocument, type ReceiptData } from "@/lib/receipt-pdf";

interface Ctx { params: Promise<{ payment_id: string }> }

/**
 * GET /api/receipts/[payment_id]
 * Streams a PDF receipt for an approved payment. Public-by-link so tenants
 * can open it via WhatsApp/email without an account.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { payment_id } = await params;
  const supabase = createClient();

  const { data: payment, error } = await supabase
    .from("payments")
    .select(`
      id, receipt_no, approved_at, amount, provider, phone, status,
      invoice:invoices (
        id, period, amount, landlord_id,
        tenant:tenants ( id, name, email ),
        unit:units ( id, number, properties ( name, address ) )
      )
    `)
    .eq("id", payment_id)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  if (payment.status !== "approved" || !payment.receipt_no) {
    return NextResponse.json({ error: "Receipt not yet issued" }, { status: 404 });
  }

  const invoice: any = payment.invoice;
  const tenant: any  = invoice?.tenant;
  const unit: any    = invoice?.unit;
  const property: any = unit?.properties;

  const { data: paidRows } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoice.id)
    .eq("status", "approved");

  const totalPaid = (paidRows ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const balanceAfter = Math.max(0, Number(invoice.amount) - totalPaid);

  const { data: landlord } = await supabase
    .rpc("get_user_display_name", { uid: invoice.landlord_id });

  const data: ReceiptData = {
    receiptNo:          payment.receipt_no,
    approvedAt:         payment.approved_at,
    amount:             Number(payment.amount),
    provider:           payment.provider,
    phone:              payment.phone,
    tenantName:         tenant?.name ?? "Tenant",
    tenantEmail:        tenant?.email ?? null,
    unitNumber:         unit?.number ?? null,
    propertyName:       property?.name ?? null,
    propertyAddress:    property?.address ?? null,
    landlordName:       (landlord as any) ?? "Landlord",
    invoicePeriod:      invoice.period,
    invoiceTotal:       Number(invoice.amount),
    totalPaidOnInvoice: totalPaid,
    balanceAfter,
  };

  const buffer = await renderToBuffer(<ReceiptDocument data={data} />);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="${payment.receipt_no}.pdf"`,
      "Cache-Control":       "private, max-age=300",
    },
  });
}
