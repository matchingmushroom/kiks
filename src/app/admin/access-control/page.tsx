"use client";

import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useFirestore, orderBy, limit } from "@/hooks/useFirestore";
import { AppUser } from "@/types";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import UserCard from "./UserCard";

export default function AccessControlPage() {
  const { profile: currentUser } = useAuth();
  const { data: users, loading } = useFirestore<AppUser>("users", {
    constraints: [orderBy("createdAt", "desc")],
    realtime: false,
  });
  const [search, setSearch] = useState("");

  const nonAdminUsers = useMemo(
    () => users.filter((u) => u.role !== "admin" && u.uid !== currentUser?.uid),
    [users, currentUser?.uid]
  );

  const filtered = nonAdminUsers.filter((u) =>
    !search || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search)
  );

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-secondary">Access Control</h1>
            <p className="text-sm text-muted-foreground">Manage per-user permission overrides</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search users..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <p className="text-xs text-muted-foreground">
            <Shield className="h-3 w-3 inline mr-1" />
            Admin users have full access and cannot be edited here.
          </p>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No users found.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((user) => (
              <UserCard key={user.uid} user={user} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
