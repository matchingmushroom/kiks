"use client";

import { useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Database, AlertTriangle, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateSkuV2, generateModelCode } from "@/lib/sku-generator";
import { Product, Category } from "@/types";

interface MigrationResult {
  productId: string;
  name: string;
  oldSku: string;
  newSku: string;
  modelCode: string;
  status: "success" | "skipped" | "error";
  error?: string;
}

export default function MigrationPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[] | null>(null);
  const [stats, setStats] = useState<{ total: number; migrated: number; skipped: number; errors: number } | null>(null);

  const isNewFormat = (sku: string) => /^[0-9A-Z]{5}$/.test(sku);

  const runMigration = useCallback(async () => {
    if (!confirm("This will generate new 5-character Base-36 SKUs and Model Codes for all products. Existing products without the new format will be updated. Continue?")) return;
    setRunning(true);
    setResults(null);
    setStats(null);

    const res: MigrationResult[] = [];
    let migrated = 0, skipped = 0, errors = 0;

    try {
      const [prodSnap, catSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "categories")),
      ]);
      const products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      const catMap = new Map(catSnap.docs.map((d) => [d.id, d.data() as Category]));

      for (const p of products) {
        try {
          if (isNewFormat(p.sku) && p.modelCode) {
            res.push({ productId: p.id, name: p.name, oldSku: p.sku, newSku: p.sku, modelCode: p.modelCode, status: "skipped" });
            skipped++;
            continue;
          }

          const newSku = await generateSkuV2();
          let modelCode = p.modelCode;
          if (!modelCode) {
            const cat = catMap.get(p.categoryId);
            modelCode = await generateModelCode(cat?.shortCode || "XX");
          }

          await updateDoc(doc(db, "products", p.id), {
            sku: newSku,
            modelCode,
            legacySku: p.sku || "",
          });

          res.push({ productId: p.id, name: p.name, oldSku: p.sku || "", newSku, modelCode, status: "success" });
          migrated++;
        } catch (e: any) {
          res.push({ productId: p.id, name: p.name, oldSku: p.sku || "", newSku: "", modelCode: "", status: "error", error: e?.message || "Unknown" });
          errors++;
        }
      }
    } catch (e: any) {
      console.error("Migration failed", e);
    }

    setResults(res);
    setStats({ total: res.length, migrated, skipped, errors });
    setRunning(false);
  }, []);

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-secondary mb-2">SKU & Model Code Migration</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Migrate all products to the new 5-character Base-36 SKU format and auto-generated Model Codes.
          Existing products already in the new format will be skipped.
        </p>

        {/* Info card */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">What this does:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Generates a unique <strong>5-character Base-36 SKU</strong> (e.g., <code className="bg-amber-100 px-1 rounded">A1B2C</code>) for every product</li>
                <li>Generates a <strong>Model Code</strong> (e.g., <code className="bg-amber-100 px-1 rounded">R-001</code>) for products missing one</li>
                <li>Saves the old SKU in a <code className="bg-amber-100 px-1 rounded">legacySku</code> field for history</li>
                <li>Products already in the new format are skipped</li>
              </ul>
              <p className="mt-2 font-semibold">Note:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>This only updates the <code className="bg-amber-100 px-1 rounded">sku</code> and <code className="bg-amber-100 px-1 rounded">modelCode</code> fields on product documents</li>
                <li>Past sale/purchase records retain their original SKU values</li>
                <li>New products created going forward will automatically use the new format</li>
              </ul>
            </div>
          </div>
        </div>

        <Button onClick={runMigration} disabled={running} variant="accent" size="lg">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {running ? "Migrating..." : "Run Migration"}
        </Button>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mt-6 mb-6">
            <div className="bg-white border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-secondary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.migrated}</p>
              <p className="text-xs text-muted-foreground">Migrated</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        )}

        {/* Results table */}
        {results && results.length > 0 && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Product</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Old SKU</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">New SKU</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Model Code</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r) => (
                    <tr key={r.productId} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        {r.status === "success" ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                         r.status === "skipped" ? <ArrowRight className="h-4 w-4 text-amber-400" /> :
                         <XCircle className="h-4 w-4 text-red-500" />}
                      </td>
                      <td className="px-4 py-2 text-secondary font-medium">{r.name}</td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.oldSku}</td>
                      <td className="px-4 py-2 text-secondary font-mono text-xs">{r.newSku || "—"}</td>
                      <td className="px-4 py-2 text-secondary font-mono text-xs">{r.modelCode || "—"}</td>
                      <td className="px-4 py-2 text-red-500 text-xs">{r.error || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
