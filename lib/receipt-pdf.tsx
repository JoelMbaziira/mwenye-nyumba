/**
 * Receipt PDF — rendered with @react-pdf/renderer.
 * Install:  npm i @react-pdf/renderer
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface ReceiptData {
  receiptNo: string;
  approvedAt: string;
  amount: number;
  provider: string;
  phone: string | null;
  tenantName: string;
  tenantEmail: string | null;
  unitNumber: string | null;
  propertyName: string | null;
  propertyAddress: string | null;
  landlordName: string;
  invoicePeriod: string;
  invoiceTotal: number;
  totalPaidOnInvoice: number;
  balanceAfter: number;
}

const styles = StyleSheet.create({
  page:      { padding: 48, fontFamily: "Helvetica", fontSize: 11, color: "#111" },
  brand:     { fontSize: 18, fontWeight: 700, color: "#15803d" },
  brandSub:  { fontSize: 9, color: "#666", marginTop: 2 },
  title:     { fontSize: 22, fontWeight: 700, marginTop: 24 },
  meta:      { color: "#666", marginTop: 4 },
  hr:        { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 18 },
  row:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  col:       { flex: 1 },
  label:     { color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
  value:     { fontSize: 11, marginTop: 2 },
  amountBox: { backgroundColor: "#ecfdf5", padding: 14, borderRadius: 6, marginVertical: 14 },
  amountLg:  { fontSize: 24, fontWeight: 700, color: "#15803d" },
  footer:    { position: "absolute", bottom: 36, left: 48, right: 48, textAlign: "center", color: "#999", fontSize: 8 },
});

function fmt(n: number) { return "UGX " + new Intl.NumberFormat("en-UG").format(Math.round(n)); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-UG", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function fmtPeriod(p: string) {
  const [y, m] = p.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const paidInFull = data.balanceAfter <= 0;
  return (
    <Document title={`Receipt ${data.receiptNo}`} author={data.landlordName}
      subject={`Rent receipt for ${data.tenantName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Mwenye Nyumba</Text>
        <Text style={styles.brandSub}>Property management for Uganda</Text>
        <Text style={styles.title}>Payment Receipt</Text>
        <Text style={styles.meta}>{data.receiptNo} · Issued {fmtDate(data.approvedAt)}</Text>

        <View style={styles.amountBox}>
          <Text style={styles.label}>Amount received</Text>
          <Text style={styles.amountLg}>{fmt(data.amount)}</Text>
          <Text style={{ marginTop: 4, color: "#15803d", fontSize: 10 }}>
            via {data.provider}{data.phone ? ` · ${data.phone}` : ""}
          </Text>
        </View>

        <View style={styles.hr} />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Received from</Text>
            <Text style={styles.value}>{data.tenantName}</Text>
            {data.tenantEmail && <Text style={{ ...styles.value, color: "#666" }}>{data.tenantEmail}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Received by</Text>
            <Text style={styles.value}>{data.landlordName}</Text>
          </View>
        </View>

        <View style={{ ...styles.row, marginTop: 14 }}>
          <View style={styles.col}>
            <Text style={styles.label}>Property</Text>
            <Text style={styles.value}>{data.propertyName ?? "—"}</Text>
            {data.propertyAddress && (
              <Text style={{ ...styles.value, color: "#666" }}>{data.propertyAddress}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Unit</Text>
            <Text style={styles.value}>{data.unitNumber ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.hr} />

        <Text style={styles.label}>Invoice details</Text>
        <View style={{ ...styles.row, marginTop: 8 }}>
          <Text>Period</Text><Text>{fmtPeriod(data.invoicePeriod)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Invoice total</Text><Text>{fmt(data.invoiceTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Total paid to date</Text><Text>{fmt(data.totalPaidOnInvoice)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={{ fontWeight: 700 }}>Balance remaining</Text>
          <Text style={{ fontWeight: 700, color: paidInFull ? "#15803d" : "#b45309" }}>
            {paidInFull ? "PAID IN FULL" : fmt(data.balanceAfter)}
          </Text>
        </View>

        <Text style={styles.footer}>
          This is an electronically generated receipt. Receipt no. {data.receiptNo}.
        </Text>
      </Page>
    </Document>
  );
}
