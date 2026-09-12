"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import { accountRequestHeaders, getAccountScope } from "@/lib/account-scope";
import { useAccountOperation } from "@/lib/use-account-operation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
type Conversation = { id: string; title: string };
const iconClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
export function AgentHistory({ onNavigate }: { onNavigate: () => void }) {
  const { data: session } = useSession();
  const scope = getAccountScope(session?.user), path = usePathname();
  const router = useRouter(), operation = useAccountOperation();
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [rows, setRows] = useState<Conversation[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: "rename" | "delete"; row: Conversation; scope: string | null } | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setRows([]); setMenu(null); setDialog(null); setBusy(false);
    if (!scope) return;
    const abort = new AbortController();
    const read = async () => { try { const res = await fetch("/api/agent", { headers: accountRequestHeaders(scope), signal: abort.signal, cache: "no-store" }); const data = await res.json(); if (!abort.signal.aborted && res.ok && data.accountScope === scope) { setRows(data.conversations); setLoadedScope(scope); } } catch { /* Preserve the last successful history while offline. */ } };
    void read();
    const interval = window.setInterval(() => { if (!document.hidden) void read(); }, 15000);
    window.addEventListener("agent-conversations-changed", read);
    return () => { abort.abort(); window.clearInterval(interval); window.removeEventListener("agent-conversations-changed", read); };
  }, [scope, path]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest("[data-conversation-actions]")) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);
  const open = (kind: "rename" | "delete", row: Conversation) => { setMenu(null); setError(""); setTitle(row.title); setDialog({ kind, row, scope }); };
  const save = async () => {
    if (!dialog || busy || dialog.scope !== scope) return;
    const op = operation.capture(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { ...op.headers, "Content-Type": "application/json" }, signal: op.signal, body: JSON.stringify({ action: dialog.kind, conversationId: dialog.row.id, ...(dialog.kind === "rename" ? { title: title.trim() } : {}) }) });
      const data = await response.json(); if (op.signal.aborted) return;
      if (!response.ok) throw new Error(data.error ?? "Could not update the conversation.");
      setDialog(null); window.dispatchEvent(new Event("agent-conversations-changed"));
      if (dialog.kind === "delete" && path === `/agent/${dialog.row.id}`) { router.push("/agent"); onNavigate(); }
      else router.refresh();
    } catch (e) { if (!op.signal.aborted) setError(e instanceof Error ? e.message : "Please try again."); }
    finally { if (!op.signal.aborted) setBusy(false); }
  };
  return <section className="mt-6" aria-label="Recent conversations">
    <div className="flex items-center gap-1 px-1">
      <button type="button" aria-expanded={!collapsed} aria-controls="recent-agent-conversations" onClick={() => { setCollapsed(!collapsed); setMenu(null); }} className="flex min-h-11 min-w-0 flex-1 items-center gap-1 rounded-ui px-2 text-xs text-muted-foreground transition-all duration-300 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">Recent conversations<ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-all duration-300 ${collapsed ? "-rotate-90" : ""}`} /></button>
      <Link href="/agent" onClick={onNavigate} aria-label="New conversation" title="New conversation" className={iconClass}><SquarePen className="h-4 w-4" /></Link>
    </div>
    <div id="recent-agent-conversations" hidden={collapsed} className="space-y-1">
      {(loadedScope === scope ? rows : []).map(row => <div key={row.id} className={`group relative flex min-h-11 items-center rounded-ui transition-all duration-300 hover:bg-background ${path === `/agent/${row.id}` ? "bg-background" : ""}`}>
        <Link href={`/agent/${row.id}`} onClick={onNavigate} title={row.title} aria-current={path === `/agent/${row.id}` ? "page" : undefined} className="min-w-0 flex-1 truncate rounded-ui px-3 py-3 text-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary">{row.title}</Link>
        <div data-conversation-actions className="relative">
          <button type="button" aria-label={`Options for ${row.title}`} aria-expanded={menu === row.id} onClick={() => setMenu(menu === row.id ? null : row.id)} className={`${iconClass} ${menu === row.id ? "" : "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"}`}><MoreHorizontal className="h-4 w-4" /></button>
          {menu === row.id && <div className="absolute right-0 top-full z-20 w-36 rounded-ui border border-border bg-background p-1 shadow-float">
            <button type="button" onClick={() => open("rename", row)} className="flex min-h-11 w-full items-center gap-2 rounded-ui px-3 text-sm transition-all duration-300 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary"><Pencil className="h-4 w-4" />Rename</button>
            <button type="button" onClick={() => open("delete", row)} className="flex min-h-11 w-full items-center gap-2 rounded-ui px-3 text-sm text-destructive transition-all duration-300 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary"><Trash2 className="h-4 w-4" />Delete</button>
          </div>}
        </div>
      </div>)}
    </div>
    {dialog && dialog.scope === scope && <Modal onClose={() => { if (!busy) setDialog(null); }} dismissible={!busy} aria-label={dialog.kind === "rename" ? "Rename conversation" : "Delete conversation"} className="flex items-center justify-center bg-surface-dark/30 p-4"><div className="w-full max-w-sm space-y-4 rounded-ui-xl bg-background p-5">
      <h2 className="text-lg font-medium">{dialog.kind === "rename" ? "Rename conversation" : "Delete conversation?"}</h2>
      {dialog.kind === "rename" ? <><label htmlFor="history-conversation-title" className="sr-only">Conversation title</label><input id="history-conversation-title" value={title} maxLength={100} disabled={busy} onChange={e => setTitle(e.target.value)} className="h-11 w-full rounded-ui border border-border bg-background px-3 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50" /></> : <p className="break-words text-sm text-muted-foreground">Delete “{dialog.row.title}”? Generated work stays in Assets.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button><Button variant={dialog.kind === "delete" ? "destructive" : "default"} disabled={busy || (dialog.kind === "rename" && !title.trim())} onClick={() => void save()}>{busy ? "Saving…" : dialog.kind === "rename" ? "Save" : "Delete"}</Button></div>
    </div></Modal>}
  </section>;
}
