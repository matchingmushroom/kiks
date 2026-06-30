"use client";

import { Sparkles, Feather, Heart, Gem } from "lucide-react";

const features = [
  { icon: Sparkles, label: "Trendy Designs", desc: "Latest fashion collections" },
  { icon: Feather, label: "Lightweight", desc: "Comfortable all-day wear" },
  { icon: Heart, label: "Hypoallergenic", desc: "Safe for sensitive skin" },
  { icon: Gem, label: "Affordable Luxury", desc: "Premium look, great value" },
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
