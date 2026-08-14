"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Menu,
  Plus,
  Sparkles,
  UserCircle,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { CreditsWidget } from "@/components/creation/credits-widget";
import { UserMenu } from "@/components/layout/user-menu";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { trackEvent } from "@/lib/analytics";

export type WorkspaceView = "create" | "assets";

interface WorkspaceSidebarProps {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onNewCreate: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function WorkspaceMobileHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="flex h-14 items-center justify-between bg-background px-3 lg:hidden">
      <button type="button" onClick={onOpen} className="flex h-11 w-11 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/home" aria-label="Flownana home"><Logo size="md" showText /></Link>
      <div className="h-11 w-11" />
    </header>
  );
}

export function WorkspaceSidebar({
  view,
  onViewChange,
  onNewCreate,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: WorkspaceSidebarProps) {
  const { data: session, status } = useSession();
  const widthClass = collapsed ? "lg:w-16" : "lg:w-60";

  const navigate = (nextView: WorkspaceView) => {
    onViewChange(nextView);
    onMobileOpenChange(false);
  };

  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px] lg:hidden" onClick={() => onMobileOpenChange(false)} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 -translate-x-full flex-col border-r border-border bg-surface-soft transition-all duration-300 lg:static lg:translate-x-0 ${widthClass} ${mobileOpen ? "translate-x-0" : ""}`}>
        <div className={`flex h-16 items-center px-3 ${collapsed ? "lg:justify-center" : "justify-between"}`}>
          <Link href="/home" className="min-w-0" aria-label="Flownana home">
            <Logo size="md" showText={!collapsed} />
          </Link>
          <button type="button" onClick={() => onMobileOpenChange(false)} className="flex h-10 w-10 items-center justify-center rounded-ui text-muted-foreground lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-3">
          <button type="button" onClick={() => { onNewCreate(); onMobileOpenChange(false); }} className={`flex h-10 w-full items-center rounded-ui bg-primary text-sm font-medium text-white transition-all duration-300 hover:bg-primary-active active:scale-[0.98] ${collapsed ? "lg:justify-center lg:px-0" : "gap-2 px-3"}`} title="New Create">
            <Plus className="h-4 w-4 shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>New Create</span>
          </button>

          <nav className="space-y-1" aria-label="Creation workspace">
            {([
              { id: "create" as const, label: "Create", icon: Sparkles },
              { id: "assets" as const, label: "Assets", icon: FolderOpen },
            ]).map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.id)} className={`flex h-10 w-full items-center rounded-ui text-sm font-medium transition-all duration-300 ${collapsed ? "lg:justify-center lg:px-0" : "gap-3 px-3"} ${active ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`} title={item.label}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-border p-3">
          {status === "loading" ? (
            <div className="h-10 animate-pulse rounded-ui bg-background/70" />
          ) : session ? (
            <div className={`flex items-center ${collapsed ? "lg:flex-col lg:gap-2" : "gap-2"}`}>
              <CreditsWidget variant="sidebar" />
              <UserMenu align="left" compact user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
            </div>
          ) : (
            <button type="button" onClick={() => { trackEvent("signup_started", { source: "sidebar_avatar" }); signInForCurrentEnvironment(); }} className={`flex h-10 w-full items-center rounded-ui text-sm text-muted-foreground transition-all duration-300 hover:bg-background hover:text-foreground ${collapsed ? "lg:justify-center" : "gap-2 px-3"}`}>
              <UserCircle className="h-5 w-5" /><span className={collapsed ? "lg:hidden" : ""}>Sign in</span>
            </button>
          )}
          <button type="button" onClick={() => onCollapsedChange(!collapsed)} className="mt-3 hidden h-9 w-full items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-background hover:text-foreground lg:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="mr-2 h-4 w-4" /><span className="text-xs">Collapse</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
