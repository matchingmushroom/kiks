"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface PriceLabelProps {
  productName: string;
  sku: string;
  price: number;
}

export default function PriceLabel({ productName, sku, price }: PriceLabelProps) {
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
    <div className="price-label">
      <div className="pl-name">{productName}</div>
      <svg ref={svgRef} className="pl-barcode" />
      <div className="pl-sku">{sku}</div>
      <div className="pl-mrp">MRP: Rs. {price.toLocaleString("en-IN")}</div>
    </div>
  );
}
