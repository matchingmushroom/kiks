"use client";

import { Truck, RotateCcw, ShieldCheck, Headphones } from "lucide-react";

const features = [
  { icon: Truck, label: "Free Shipping", desc: "On orders above Rs. 5000" },
  { icon: RotateCcw, label: "Easy Returns", desc: "7-day return policy" },
  { icon: ShieldCheck, label: "Secure Payment", desc: "100% secure checkout" },
  { icon: Headphones, label: "24/7 Support", desc: "Dedicated support team" },
];

export default function TrustBar() {
  return (
    <section className="py-10 bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.label} className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <f.icon className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
