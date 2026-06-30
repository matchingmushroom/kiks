"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface PriceLabelProps {
  productName: string;
  sku: string;
  barcodeId?: string;
  price: number;
  shopName?: string;
  website?: string;
}

export default function PriceLabel({ productName, sku, barcodeId, price, shopName = "Panchakanya Collections", website = "" }: PriceLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const barcodeValue = barcodeId || sku;

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, barcodeValue, {
        format: "CODE128",
        width: 1,
        height: 24,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
      });
    }
  }, [sku]);

  return (
    <div className="price-label" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1mm 1.5mm", fontFamily: "Arial, Helvetica, sans-serif", width: "66mm", height: "25.4mm", boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ fontSize: "5px", fontWeight: 600, color: "#888", textAlign: "center", lineHeight: 1 }}>{shopName}</div>
      <div className="pl-name" style={{ fontSize: "7px", fontWeight: 700, textAlign: "center", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", maxHeight: "14px" }}>{productName}</div>
      <svg ref={svgRef} className="pl-barcode" style={{ maxWidth: "60mm", height: "9mm", margin: 0 }} />
      <div className="pl-sku" style={{ fontSize: "5px", color: "#555", textAlign: "center", letterSpacing: "0.3px" }}>{sku}</div>
      <div className="pl-mrp" style={{ fontSize: "9px", fontWeight: 700, textAlign: "center", marginTop: 0 }}>MRP: Rs. {price.toLocaleString("en-IN")}</div>
      {website && <div style={{ fontSize: "4.5px", color: "#888", textAlign: "center", lineHeight: 1 }}>{website}</div>}
    </div>
  );
}
