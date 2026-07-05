"use client";

import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { formatNumber } from "@/lib/utils";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyCg4QIFqPfE.ttf", fontWeight: 400 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 35, fontSize: 9, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingBottom: 15, borderBottom: "1.5 solid #1e3a5f" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 45, height: 45, objectFit: "contain" },
  shopName: { fontSize: 16, fontWeight: "bold", color: "#1e3a5f" },
  tagline: { fontSize: 7, color: "#666", marginTop: 1 },
  titleBox: { alignItems: "flex-end" },
  title: { fontSize: 13, fontWeight: "bold", color: "#1e3a5f" },
  subtitle: { fontSize: 7, color: "#888", marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#1e3a5f", marginTop: 14, marginBottom: 5 },
  table: { width: "100%", marginTop: 0, marginBottom: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1e3a5f", padding: "5 8", width: "100%" },
  tableHeaderCell: { fontSize: 7, color: "#fff", fontWeight: "bold" },
  tableRow: { flexDirection: "row", padding: "4 8", borderBottom: "1 solid #eee", width: "100%" },
  tableRowAlt: { flexDirection: "row", padding: "4 8", borderBottom: "1 solid #eee", backgroundColor: "#f8f9fa", width: "100%" },
  tableCell: { fontSize: 7.5 },
  colLabel: { flex: 1.5 },
  colRight: { flex: 1, textAlign: "right" },
  netPositive: { color: "#16a34a", fontWeight: "bold" },
  netNegative: { color: "#dc2626", fontWeight: "bold" },
  chartImage: { width: "100%", height: 110, marginTop: 4 },
  pieImage: { width: 280, height: 150, alignSelf: "center", marginTop: 6 },
  footer: { position: "absolute", bottom: 30, left: 35, right: 35, borderTop: "1 solid #ccc", paddingTop: 6, fontSize: 7, color: "#999", textAlign: "center" },
});

interface InvCategory {
  name: string;
  value: number;
}

interface PartnerReportPDFProps {
  logoUrl: string;
  shopName: string;
  tagline: string;
  period: string;
  todaySale: number;
  mtdSale: number;
  ytdSale: number;
  todayPurchase: number;
  mtdPurchase: number;
  ytdPurchase: number;
  netToday: number;
  netMtd: number;
  netYtd: number;
  inventoryValue: number;
  inventoryByCategory: InvCategory[];
  barChartUrl?: string;
  pieChartUrl?: string;
}

export default function PartnerReportPDF(data: PartnerReportPDFProps) {
  const netRow = (label: string, today: number, mtd: number, ytd: number) => (
    <View style={[styles.tableRow, styles.tableRowAlt]}>
      <Text style={[styles.tableCell, styles.colLabel]}>{label}</Text>
      <Text style={[styles.tableCell, styles.colRight, today >= 0 ? styles.netPositive : styles.netNegative]}>Rs. {formatNumber(today)}</Text>
      <Text style={[styles.tableCell, styles.colRight, mtd >= 0 ? styles.netPositive : styles.netNegative]}>Rs. {formatNumber(mtd)}</Text>
      <Text style={[styles.tableCell, styles.colRight, ytd >= 0 ? styles.netPositive : styles.netNegative]}>Rs. {formatNumber(ytd)}</Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={data.logoUrl || "/logo.svg"} style={styles.logo} />
            <View>
              <Text style={styles.shopName}>{data.shopName}</Text>
              {data.tagline && <Text style={styles.tagline}>{data.tagline}</Text>}
            </View>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>Partner Report</Text>
            <Text style={styles.subtitle}>{data.period}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colLabel]}>Metric</Text>
            <Text style={[styles.tableHeaderCell, styles.colRight]}>Today</Text>
            <Text style={[styles.tableHeaderCell, styles.colRight]}>This Month</Text>
            <Text style={[styles.tableHeaderCell, styles.colRight]}>This Year</Text>
          </View>
          <View style={styles.tableRow}>
      <Text style={[styles.tableCell, styles.colLabel]}>Sales</Text>
      <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(data.todaySale)}</Text>
      <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(data.mtdSale)}</Text>
      <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(data.ytdSale)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colLabel]}>Purchases</Text>
            <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(data.todayPurchase)}</Text>
            <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(data.mtdPurchase)}</Text>
            <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(data.ytdPurchase)}</Text>
          </View>
          {netRow("Net", data.netToday, data.netMtd, data.netYtd)}
        </View>

        {data.barChartUrl && (
          <>
            <Text style={styles.sectionTitle}>Sales Trend (Last 30 Days)</Text>
            <Image src={data.barChartUrl} style={styles.chartImage} />
          </>
        )}

        <Text style={styles.sectionTitle}>Inventory by Category (at Cost)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colLabel]}>Category</Text>
            <Text style={[styles.tableHeaderCell, styles.colRight]}>Value</Text>
            <Text style={[styles.tableHeaderCell, styles.colRight]}>Share</Text>
          </View>
          {data.inventoryByCategory.slice(0, 10).map((c, i) => (
            <View key={c.name} style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
              <Text style={[styles.tableCell, styles.colLabel]} numberOfLines={1}>{c.name}</Text>
              <Text style={[styles.tableCell, styles.colRight]}>Rs. {formatNumber(c.value)}</Text>
              <Text style={[styles.tableCell, styles.colRight]}>{((c.value / (data.inventoryValue || 1)) * 100).toFixed(1)}%</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.tableRowAlt]}>
            <Text style={[styles.tableCell, styles.colLabel, { fontWeight: "bold" }]}>Total</Text>
            <Text style={[styles.tableCell, styles.colRight, { fontWeight: "bold", color: "#16a34a" }]}>Rs. {formatNumber(data.inventoryValue)}</Text>
            <Text style={[styles.tableCell, styles.colRight, { fontWeight: "bold" }]}>100%</Text>
          </View>
        </View>

        {data.pieChartUrl && <Image src={data.pieChartUrl} style={styles.pieImage} />}

        <Text style={styles.footer}>
          Generated on {new Date().toLocaleString("en-IN")} | {data.shopName}
        </Text>
      </Page>
    </Document>
  );
}
