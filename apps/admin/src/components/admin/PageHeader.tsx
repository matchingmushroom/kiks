import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backHref?: string;
}

export default function PageHeader({ title, subtitle, actions, backHref }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref} className="p-1.5 -ml-1.5 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({
  title, value, sub, icon, color = "accent", onClick, className = "",
}: {
  title: string; value: string; sub?: string; icon?: ReactNode; color?: string; onClick?: () => void; className?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    accent: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  };
  const c = colorMap[color] || colorMap.accent;
  return (
    <button onClick={onClick} className={`bg-white rounded-xl border ${c.border} p-4 text-left w-full hover:shadow-sm transition-all ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {icon && <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><span className={c.text}>{icon}</span></div>}
      </div>
      <p className="text-xl font-bold text-secondary">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
    </button>
  );
}

export function AdminCard({ children, title, action, className = "" }: { children: ReactNode; title?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border p-4 sm:p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-bold text-secondary">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
