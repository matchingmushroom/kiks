"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface PriceLabelProps {
  productName: string;
  sku: string;
  price: number;
  shopName?: string;
  website?: string;
}

export default function PriceLabel({ productName, sku, price, shopName = "Panchakanya Collections", website = "" }: PriceLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, sku, {
        format: "CODE128",
        width: 1.2,
        height: 28,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
      });
    }
  }, [sku]);

  return (
    <div className="price-label" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5mm", fontFamily: "Arial, Helvetica, sans-serif", width: "50.8mm", height: "25.4mm", border: "0.5px solid #ccc", borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ fontSize: "5px", fontWeight: 600, color: "#888", textAlign: "center", lineHeight: 1 }}>{shopName}</div>
      <div className="pl-name" style={{ fontSize: "8px", fontWeight: 700, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{productName}</div>
      <svg ref={svgRef} className="pl-barcode" style={{ maxWidth: "46mm", height: "10mm", margin: 0 }} />
      <div className="pl-sku" style={{ fontSize: "6px", color: "#555", textAlign: "center", letterSpacing: "0.3px" }}>{sku}</div>
      <div className="pl-mrp" style={{ fontSize: "10px", fontWeight: 700, textAlign: "center", marginTop: 0 }}>MRP: Rs. {price.toLocaleString("en-IN")}</div>
      {website && <div style={{ fontSize: "5px", color: "#888", textAlign: "center", lineHeight: 1 }}>{website}</div>}
    </div>
  );
}
