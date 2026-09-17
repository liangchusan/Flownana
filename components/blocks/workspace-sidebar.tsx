"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FolderOpen,
  Home,
  Image as ImageIcon,
  Menu,
  PanelLeft,
  UserCircle,
  Video,
  X,
} from "lucide-react";
import { AgentHistory } from "@/components/blocks/agent/agent-history";
import { Logo } from "@/components/ui/logo";
import { CreditsWidget } from "@/components/creation/credits-widget";
import { UserMenu } from "@/components/layout/user-menu";
import { signInForCurrentEnvironment } from "@/lib/auth-sign-in";
import { trackEvent } from "@/lib/analytics";
import {
  WORKSPACE_PATHS,
  type WorkspaceDestination,
} from "@/lib/workspace-navigation";

export type WorkspaceView = "create" | "assets";

interface WorkspaceSidebarProps {
  activeSection: WorkspaceDestination;
  onWorkspaceNavigate?: (destination: Exclude<WorkspaceDestination, "home" | "agent">) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}
const NAV_ITEMS = [
  { id: "home" as const, label: "Home", icon: Home },
  { id: "image" as const, label: "Image", icon: ImageIcon },
  { id: "video" as const, label: "Video", icon: Video },
  { id: "assets" as const, label: "Assets", icon: FolderOpen },
];

export function WorkspaceMobileHeader({ onOpen, showLogo = true }: { onOpen: () => void; showLogo?: boolean }) {
  return (
    <header className="flex h-14 items-center justify-between bg-background px-3 lg:hidden">
      <button type="button" onClick={onOpen} className="flex h-11 w-11 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      {showLogo && <Link href={WORKSPACE_PATHS.home} aria-label="Flownana home"><Logo size="compact" showText /></Link>}
      <div className="h-11 w-11" />
    </header>
  );
}

export function WorkspaceSidebar({
  activeSection,
  onWorkspaceNavigate,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: WorkspaceSidebarProps) {
  const { data: session, status } = useSession();
  const widthClass = collapsed ? "lg:w-16" : "lg:w-[260px]";

  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px] lg:hidden" onClick={() => onMobileOpenChange(false)} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] -translate-x-full flex-col border-r border-border bg-surface-soft transition-all duration-300 lg:static lg:translate-x-0 ${widthClass} ${mobileOpen ? "translate-x-0" : ""}`}>
        <div className="relative flex h-16 items-center px-3">
          <Link href={WORKSPACE_PATHS.home} className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`} aria-label="Flownana home">
            <Logo size="compact" showText={!collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className={`absolute top-3 hidden h-8 w-8 items-center justify-center rounded-ui bg-transparent text-muted-foreground transition-all duration-300 hover:bg-surface-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:flex ${collapsed ? "left-4" : "right-3"}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button type="button" onClick={() => onMobileOpenChange(false)} className="flex h-10 w-10 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <nav className="space-y-1" aria-label="Creation workspace">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={WORKSPACE_PATHS[item.id]}
                  prefetch={onWorkspaceNavigate ? undefined : true}
                  onClick={(event) => {
                    if (item.id !== "home" && onWorkspaceNavigate) {
                      event.preventDefault();
                      onWorkspaceNavigate(item.id);
                    }
                    onMobileOpenChange(false);
                  }}
                  className={`flex h-10 w-full items-center rounded-ui text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${collapsed ? "lg:justify-center lg:px-0" : "gap-3 px-3"} ${active ? "bg-surface-strong text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={collapsed ? "lg:hidden" : ""}><AgentHistory onNavigate={() => onMobileOpenChange(false)} /></div>
        </div>

        <div className="p-3">
          {status === "loading" ? (
            <div className="h-10 animate-pulse rounded-ui bg-background/70" />
          ) : session ? (
            <div className={`flex flex-col gap-2 ${collapsed ? "lg:items-center" : ""}`}>
              <CreditsWidget variant="sidebar" compact={collapsed} />
              <UserMenu align="left" compact={collapsed} variant="sidebar" user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
            </div>
          ) : (
            <button type="button" onClick={() => { trackEvent("signup_started", { source: "sidebar_avatar" }); signInForCurrentEnvironment(); }} className={`flex h-10 w-full items-center rounded-ui text-sm text-muted-foreground transition-all duration-300 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${collapsed ? "lg:justify-center" : "gap-2 px-3"}`}>
              <UserCircle className="h-5 w-5" /><span className={collapsed ? "lg:hidden" : ""}>Sign in</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
