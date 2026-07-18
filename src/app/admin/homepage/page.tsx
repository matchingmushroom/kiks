"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { HomeSection } from "@/types";
import {
  updateDoc, deleteDoc, doc, setDoc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Plus, ArrowUp, ArrowDown, Eye, EyeOff, Edit2, Trash2, X, Save,
  Layout, Image, Grid3X3, Sparkles, Code, ShoppingBag,
} from "lucide-react";

const SECTION_TYPES = [
  { value: "hero", label: "Hero Banner", icon: Image, desc: "Full-width banner with CTA button" },
  { value: "category_grid", label: "Category Grid", icon: Grid3X3, desc: "Grid of category cards" },
  { value: "featured_products", label: "Featured Products", icon: Sparkles, desc: "Grid of featured products" },
  { value: "new_arrivals", label: "New Arrivals", icon: Layout, desc: "Latest products" },
  { value: "combo_deals", label: "Combo Deals", icon: ShoppingBag, desc: "Grid of combo products" },
  { value: "custom_html", label: "Custom HTML", icon: Code, desc: "Raw HTML block" },
];

const typeConfigDefaults: Record<string, Record<string, unknown>> = {
  hero: { ctaText: "Shop Now", ctaLink: "/products", images: [""] },
  featured_products: { maxProducts: 8 },
  category_grid: {},
  new_arrivals: { maxDays: 30 },
  combo_deals: {},
  custom_html: { htmlContent: "" },
};

export default function AdminHomepagePage() {
  const { data: sections, loading } = useFirestore<HomeSection>("sections", {
    constraints: [orderBy("order", "asc")],
    realtime: true,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editForm, setEditForm] = useState<HomeSection | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = (section: HomeSection) => {
    setEditingId(section.id);
    setEditForm({ ...section });
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSave = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "sections", editForm.id), {
        ...editForm,
        updatedAt: Timestamp.fromDate(new Date()),
      }, { merge: true });
      closeEdit();
    } catch (e) {
      console.error("Save failed", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this section?")) return;
    await deleteDoc(doc(db, "sections", id));
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "sections", id), {
      isVisible: !current,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  };

  const moveOrder = async (id: string, newOrder: number) => {
    await updateDoc(doc(db, "sections", id), { order: newOrder, updatedAt: Timestamp.fromDate(new Date()) });
  };

  const addSection = async (type: string) => {
    const id = `${type}_${Date.now()}`;
    await setDoc(doc(db, "sections", id), {
      type,
      title: SECTION_TYPES.find((t) => t.value === type)?.label || type,
      subtitle: "",
      order: sections.length,
      isVisible: true,
      config: typeConfigDefaults[type] || {},
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
    setShowAdd(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateConfig = (key: string, value: any) => {
    if (!editForm) return;
    setEditForm({ ...editForm, config: { ...editForm.config, [key]: value } });
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    hero: <Image className="h-5 w-5" />,
    category_grid: <Grid3X3 className="h-5 w-5" />,
    featured_products: <Sparkles className="h-5 w-5" />,
    new_arrivals: <Layout className="h-5 w-5" />,
    combo_deals: <ShoppingBag className="h-5 w-5" />,
    custom_html: <Code className="h-5 w-5" />,
  };

  const typeColors: Record<string, string> = {
    hero: "bg-purple-50 text-purple-700 border-purple-200",
    category_grid: "bg-blue-50 text-blue-700 border-blue-200",
    featured_products: "bg-amber-50 text-amber-700 border-amber-200",
    new_arrivals: "bg-green-50 text-green-700 border-green-200",
    combo_deals: "bg-pink-50 text-pink-700 border-pink-200",
    custom_html: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Homepage Sections</h1>
            <p className="text-sm text-muted-foreground">Drag sections to reorder, or use arrows</p>
          </div>
          <Button onClick={() => setShowAdd(true)} variant="accent">
            <Plus className="h-4 w-4" /> Add Section
          </Button>
        </div>

        {/* Add Section Dialog */}
        {showAdd && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">Add New Section</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SECTION_TYPES.map((t) => (
                <button key={t.value} onClick={() => addSection(t.value)}
                  className="flex items-start gap-3 p-4 border border-border rounded-xl hover:border-primary hover:bg-muted/50 transition-colors text-left">
                  <div className="p-2 bg-muted rounded-lg text-primary flex-shrink-0">
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-secondary">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading sections...</p>
        ) : sections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No sections yet. Add your first section.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, i) => (
              <div key={section.id} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                {/* Section Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveOrder(section.id, section.order - 1)}
                      disabled={i === 0}
                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveOrder(section.id, section.order + 1)}
                      disabled={i === sections.length - 1}
                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="p-1.5 bg-muted rounded-lg text-muted-foreground flex-shrink-0">
                    {sectionIcons[section.type] || <Layout className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-secondary text-sm truncate">{section.title || "Untitled"}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize border ${typeColors[section.type] || ""}`}>
                        {section.type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{section.subtitle}</p>
                  </div>

                  <button onClick={() => toggleVisibility(section.id, section.isVisible)}
                    className={`p-1.5 rounded-lg transition-colors ${section.isVisible ? "text-green-600 hover:bg-green-50" : "text-muted-foreground hover:bg-muted"}`}
                    title={section.isVisible ? "Visible" : "Hidden"}>
                    {section.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>

                  <button onClick={() => openEdit(section)}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <button onClick={() => handleDelete(section.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Edit Form (inline, below header) */}
                {editingId === section.id && editForm && (
                  <div className="border-t border-border px-4 py-4 bg-gray-50/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
                        <input type="text" value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Subtitle</label>
                        <input type="text" value={editForm.subtitle}
                          onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </div>

                    {/* Type-specific fields */}
                    {editForm.type === "hero" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">CTA Button Text</label>
                            <input type="text" value={(editForm.config?.ctaText as string) || ""}
                              onChange={(e) => updateConfig("ctaText", e.target.value)}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">CTA Link</label>
                            <input type="text" value={(editForm.config?.ctaLink as string) || ""}
                              onChange={(e) => updateConfig("ctaLink", e.target.value)}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Background Image URL</label>
                          <input type="text" value={((editForm.config?.images as string[]) || [""])[0] || ""}
                            onChange={(e) => updateConfig("images", [e.target.value])}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                    )}

                    {editForm.type === "featured_products" && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Max Products to Show</label>
                        <input type="number" value={(editForm.config?.maxProducts as number) || 8}
                          onChange={(e) => updateConfig("maxProducts", Number(e.target.value))}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    )}

                    {editForm.type === "new_arrivals" && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Days (products added within this many days)</label>
                        <input type="number" value={(editForm.config?.maxDays as number) || 30}
                          onChange={(e) => updateConfig("maxDays", Number(e.target.value))}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    )}

                    {editForm.type === "custom_html" && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">HTML Content</label>
                        <textarea value={(editForm.config?.htmlContent as string) || ""}
                          onChange={(e) => updateConfig("htmlContent", e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                          rows={4} />
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleSave} disabled={saving} variant="accent">
                        <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button onClick={closeEdit} variant="outline">Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
