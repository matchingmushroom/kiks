"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { AppUser, UserRole } from "@/types";
import { formatDate } from "@/lib/utils";
import {
  createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  setDoc, doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Plus, Edit2, X, Save, Search, Shield, LayoutGrid, List, Power, PowerOff, Key, Mail } from "lucide-react";

const ROLES: UserRole[] = ["admin", "manager", "staff", "accountant"];
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700 border-red-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  staff: "bg-green-50 text-green-700 border-green-200",
  accountant: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function AdminStaffPage() {
  const { data: users, loading } = useFirestore<AppUser>("users", {
    constraints: [orderBy("createdAt", "desc")],
    realtime: false,
  });
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDisabled, setShowDisabled] = useState(false);

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search);
    const matchActive = showDisabled || u.isActive !== false;
    return matchSearch && matchActive;
  });

  const openAdd = () => {
    setEmail(""); setPassword(""); setDisplayName(""); setPhone(""); setRole("staff"); setIsActive(true);
    setEditingId(null); setShowForm(true); setError("");
  };

  const openEdit = (u: AppUser) => {
    setEmail(u.email); setPassword(""); setDisplayName(u.displayName);
    setPhone(u.phone); setRole(u.role); setIsActive(u.isActive !== false);
    setEditingId(u.uid); setShowForm(true); setError("");
  };

  const handleSave = async () => {
    if (!displayName || !email) return;
    if (!editingId && !password) return;
    setSaving(true);
    setError("");
    try {
      const data = {
        displayName, phone, role, email, isActive,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      if (editingId) {
        await updateDoc(doc(db, "users", editingId), data);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          ...data, createdAt: Timestamp.fromDate(new Date()),
        });
      }
      setShowForm(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError("Failed to save staff member.");
      }
    }
    setSaving(false);
  };

  const toggleActive = async (u: AppUser) => {
    const newStatus = u.isActive === false;
    await updateDoc(doc(db, "users", u.uid), {
      isActive: newStatus,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
    } catch {
      alert("Failed to send password reset email.");
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Staff Management</h1>
            <p className="text-sm text-muted-foreground">{users.length} staff members</p>
          </div>
          <Button onClick={openAdd} variant="accent"><Plus className="h-4 w-4" /> Add Staff</Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name or email..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-border" />
            Show disabled
          </label>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-secondary">
                {editingId ? "Edit Staff" : "Add Staff"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                <input type="text" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {editingId ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <div className="flex gap-2">
                  <input type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={editingId ? "Min 6 chars to change" : "Min 6 characters"} />
                  {editingId && (
                    <button onClick={() => resetPassword(email)}
                      className="p-2 border border-border rounded-lg text-muted-foreground hover:text-primary hover:bg-muted"
                      title="Send password reset email">
                      <Key className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                <input type="text" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  minLength={10}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Role *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="capitalize">{r}</option>
                  ))}
                </select>
              </div>
              {editingId && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-border" />
                    {isActive ? "Active" : "Disabled"}
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} disabled={saving || !displayName || !email} variant="accent">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : editingId ? "Update" : "Create Staff"}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No staff found.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((u) => (
              <div key={u.uid} className={`bg-white border rounded-xl p-4 shadow-sm space-y-2 ${u.isActive === false ? "border-red-200 bg-red-50/30" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-secondary text-sm truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize border shrink-0 ${ROLE_COLORS[u.role] || ""}`}>
                    {u.role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{u.phone || "—"}</span>
                  <span className="text-muted-foreground">Joined {formatDate(u.createdAt)}</span>
                </div>
                {u.isActive === false && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    <PowerOff className="h-3 w-3" /> Disabled
                  </span>
                )}
                <div className="flex items-center gap-1 pt-1">
                  <button onClick={() => openEdit(u)}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleActive(u)}
                    className={`p-1.5 rounded ${u.isActive === false ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                    title={u.isActive === false ? "Enable user" : "Disable user"}>
                    {u.isActive === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => resetPassword(u.email)}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded" title="Send password reset email">
                    <Key className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left">
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Name</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Email</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Role</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Joined</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.uid} className={`hover:bg-muted/30 ${u.isActive === false ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-secondary">{u.displayName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${ROLE_COLORS[u.role] || ""}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="px-4 py-2.5">
                      {u.isActive === false ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          <PowerOff className="h-3 w-3" /> Disabled
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleActive(u)}
                        className={`p-1.5 rounded ${u.isActive === false ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                        title={u.isActive === false ? "Enable user" : "Disable user"}>
                        {u.isActive === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => resetPassword(u.email)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded" title="Send password reset email">
                        <Key className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
