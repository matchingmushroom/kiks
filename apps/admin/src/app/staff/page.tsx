"use client";

import { useState, useEffect } from "react";
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
import { Plus, Edit2, X, Save, Search, Shield, LayoutGrid, List, Power, PowerOff, Key, Mail, MoreVertical, Trash2, AlertTriangle } from "lucide-react";

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
    realtime: true,
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);

  useEffect(() => { if (openMenuId) { const handler = () => setOpenMenuId(null); window.addEventListener("click", handler); return () => window.removeEventListener("click", handler); } }, [openMenuId]);
  const [detailStaff, setDetailStaff] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search);
    const matchActive = showDisabled || (!u.deletedAt && u.isActive !== false);
    return matchSearch && matchActive;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await updateDoc(doc(db, "users", deleteTarget.uid), {
        isActive: false,
        deletedAt: Timestamp.fromDate(new Date()),
        deletedBy: auth.currentUser?.uid || "",
        updatedAt: Timestamp.fromDate(new Date()),
      });
      setDeleteTarget(null);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

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
            Show disabled/deleted
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
              <div key={u.uid} className={`bg-white border rounded-xl p-3 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow ${u.isActive === false ? "border-red-200 bg-red-50/30" : "border-border"}`}>
                <div onClick={() => setDetailStaff(u)} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-secondary text-sm truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === u.uid ? null : u.uid); }} className="p-1 text-muted-foreground hover:bg-muted rounded">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenuId === u.uid && (
                      <div className="absolute right-0 top-8 z-20 bg-white border border-border rounded-lg shadow-lg py-1 w-36"
                        onMouseLeave={() => setOpenMenuId(null)}>
                        <button onClick={() => { openEdit(u); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted">
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                        </button>
                        {!u.deletedAt && (
                          <button onClick={() => { setDeleteTarget(u); setOpenMenuId(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-red-50 text-red-600">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div onClick={() => setDetailStaff(u)} className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${ROLE_COLORS[u.role] || ""}`}>{u.role}</span>
                  <span>{u.phone || "—"}</span>
                  <span>Joined {formatDate(u.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.deletedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      <Trash2 className="h-3 w-3" /> Deleted
                    </span>
                  ) : u.isActive === false ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      <PowerOff className="h-3 w-3" /> Disabled
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Active</span>
                  )}
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-border">
                  <button onClick={(e) => { e.stopPropagation(); toggleActive(u); }}
                    className={`p-1.5 rounded ${u.isActive === false ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                    title={u.isActive === false ? "Enable user" : "Disable user"}>
                    {u.isActive === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); resetPassword(u.email); }}
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
                  <tr key={u.uid} onClick={() => setDetailStaff(u)} className={`hover:bg-muted/30 cursor-pointer ${u.isActive === false ? "bg-red-50/30" : ""}`}>
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
                      <button onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleActive(u); }}
                        className={`p-1.5 rounded ${u.isActive === false ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                        title={u.isActive === false ? "Enable user" : "Disable user"}>
                        {u.isActive === false ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); resetPassword(u.email); }}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded" title="Send password reset email">
                        <Key className="h-3.5 w-3.5" />
                      </button>
                      {!u.deletedAt && (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Delete staff">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailStaff && (
          <DetailModal title="Staff Details" onClose={() => setDetailStaff(null)}>
            <div className="space-y-3 text-sm">
              <Row label="UID" value={detailStaff.uid} />
              <Row label="Name" value={detailStaff.displayName} />
              <Row label="Email" value={detailStaff.email} />
              <Row label="Role" value={detailStaff.role} />
              <Row label="Phone" value={detailStaff.phone || "—"} />
              <Row label="Status" value={detailStaff.deletedAt ? "Deleted" : detailStaff.isActive !== false ? "Active" : "Disabled"} />
              <Row label="Joined" value={formatDate(detailStaff.createdAt)} />
            </div>
          </DetailModal>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-100"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                <h2 className="text-lg font-bold text-secondary">Delete Staff</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                This will disable <strong>{deleteTarget.displayName}</strong> and mark them as deleted.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                To fully remove the Firebase Auth account, go to Firebase Console → Authentication → Users and delete them there.
              </p>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setDeleteTarget(null)} variant="outline">Cancel</Button>
                <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground text-xs shrink-0 mr-4">{label}</span>
      <span className="text-right text-secondary">{value}</span>
    </div>
  );
}

function DetailModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
