import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/utils";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyCg4QIFqPfE.ttf", fontWeight: 400 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30, paddingBottom: 20, borderBottom: "1 solid #ccc" },
  shopName: { fontSize: 18, fontWeight: "bold" },
  titleBox: { alignItems: "flex-end" },
  title: { fontSize: 24, fontWeight: "bold", color: "#b8860b" },
  subtitle: { fontSize: 10, color: "#666", marginTop: 4 },
  row: { flexDirection: "row", marginBottom: 20 },
  col: { flex: 1 },
  label: { color: "#666", marginBottom: 2, fontSize: 8 },
  value: { fontSize: 10, marginBottom: 4 },
  table: { marginTop: 10, marginBottom: 20 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f5", padding: "6 8", borderBottom: "1 solid #ccc" },
  tableHeaderCell: { fontSize: 8, color: "#666", fontWeight: "bold" },
  tableRow: { flexDirection: "row", padding: "6 8", borderBottom: "1 solid #eee" },
  tableCell: { fontSize: 9 },
  colDesc: { width: "40%" },
  colWt: { width: "10%", textAlign: "center" },
  colQty: { width: "10%", textAlign: "center" },
  colRate: { width: "15%", textAlign: "right" },
  colAmt: { width: "15%", textAlign: "right" },
  totals: { marginTop: 10, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", padding: "3 0", width: "40%" },
  totalLabel: { flex: 1, textAlign: "right", paddingRight: 20, fontSize: 10 },
  totalValue: { width: 100, textAlign: "right", fontSize: 10 },
  grandTotal: { fontWeight: "bold", fontSize: 12, color: "#b8860b" },
  amountWords: { marginTop: 8, fontSize: 9, color: "#666", fontStyle: "italic", textAlign: "right" },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40, borderTop: "1 solid #ccc", paddingTop: 10, fontSize: 8, color: "#666", textAlign: "center" },
  warranty: { marginTop: 20, padding: 10, backgroundColor: "#f9f9f9", fontSize: 9 },
  terms: { marginTop: 10, fontSize: 9, color: "#666" },
});

interface InvoiceItem {
  productName: string;
  weight: number;
  purity?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface InvoicePDFProps {
  shopName: string;
  shopTagline: string;
  logoUrl: string;
  invoiceNumber: string;
  type: string;
  customer: { name: string; phone: string; address: string };
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  cashReceived?: number;
  balanceDue?: number;
  warranty: { period: string; terms: string };
  notes: string;
  termsAndConditions: string;
  date: string;
  validUntil?: string;
}

export default function InvoicePDF(data: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.shopName}>{data.shopName}</Text>
            <Text style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{data.shopTagline}</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>{data.type === "invoice" ? "INVOICE" : "ESTIMATE"}</Text>
            <Text style={styles.subtitle}>#{data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>BILL TO</Text>
            <Text style={styles.value}>{data.customer.name}</Text>
            <Text style={styles.value}>{data.customer.phone}</Text>
            <Text style={styles.value}>{data.customer.address}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>DATE</Text>
            <Text style={styles.value}>{data.date}</Text>
            {data.type === "estimate" && data.validUntil && (
              <>
                <Text style={styles.label}>VALID UNTIL</Text>
                <Text style={styles.value}>{data.validUntil}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colWt]}>Wt(g)</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colRate]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmt]}>Amount</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colDesc]}>{item.productName}</Text>
              <Text style={[styles.tableCell, styles.colWt]}>{item.weight}g</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colRate]}>Rs.{item.unitPrice.toLocaleString("ne-NP")}</Text>
              <Text style={[styles.tableCell, styles.colAmt]}>Rs.{item.subtotal.toLocaleString("ne-NP")}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>Rs.{data.subtotal.toLocaleString("ne-NP")}</Text>
          </View>
          {data.discountAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: "red" }]}>Discount</Text>
              <Text style={[styles.totalValue, { color: "red" }]}>-Rs.{data.discountAmount.toLocaleString("ne-NP")}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.grandTotal]}>Total</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>Rs.{data.totalAmount.toLocaleString("ne-NP")}</Text>
          </View>
          {data.type === "invoice" && (data.cashReceived ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: "green" }]}>Cash Received</Text>
              <Text style={[styles.totalValue, { color: "green" }]}>Rs.{(data.cashReceived ?? 0).toLocaleString("ne-NP")}</Text>
            </View>
          )}
          {data.type === "invoice" && (data.balanceDue ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: "red" }]}>Balance Due</Text>
              <Text style={[styles.totalValue, { color: "red" }]}>Rs.{(data.balanceDue ?? 0).toLocaleString("ne-NP")}</Text>
            </View>
          )}
        </View>

        <Text style={styles.amountWords}>Amount in words: {amountInWords(data.totalAmount)}</Text>

        {data.warranty.period && (
          <View style={styles.warranty}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Warranty: {data.warranty.period}</Text>
            <Text>{data.warranty.terms}</Text>
          </View>
        )}

        {data.notes && (
          <View style={styles.terms}>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        {data.termsAndConditions && (
          <View style={styles.terms}>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Terms & Conditions</Text>
            <Text>{data.termsAndConditions}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Thank you for your business! • {data.shopName}
        </Text>
      </Page>
    </Document>
  );
}