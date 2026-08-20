"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FileWarning, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMediaRetryParam, isVercelBlobUrl } from "@/lib/media-retry";
import { cn } from "@/lib/utils";

const MAX_BLOB_RETRIES = 3;
const RETRY_DELAY_MS = 1_500;

type MediaLoadState = "ready" | "retrying" | "failed";

export function ResilientMedia({
  creationId,
  url,
  label = "Media",
  className,
  children,
}: {
  creationId: string;
  url: string;
  label?: string;
  className?: string;
  children: (props: {
    src: string;
    onError: () => void;
    onReady: () => void;
  }) => ReactNode;
}) {
  const [source, setSource] = useState(url);
  const [loadState, setLoadState] = useState<MediaLoadState>("ready");
  const blobRetryCount = useRef(0);
  const providerRefreshAttempted = useRef(false);
  const handlingError = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const refreshController = useRef<AbortController | null>(null);

  const clearPendingWork = useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    refreshController.current?.abort();
    refreshController.current = null;
  }, []);

  useEffect(() => {
    clearPendingWork();
    setSource(url);
    setLoadState("ready");
    blobRetryCount.current = 0;
    providerRefreshAttempted.current = false;
    handlingError.current = false;

    return clearPendingWork;
  }, [clearPendingWork, creationId, url]);

  const markReady = useCallback(() => {
    handlingError.current = false;
    setLoadState("ready");
  }, []);

  const refreshProviderUrl = useCallback(async () => {
    providerRefreshAttempted.current = true;
    handlingError.current = true;
    setLoadState("retrying");

    const controller = new AbortController();
    refreshController.current?.abort();
    refreshController.current = controller;

    try {
      const response = await fetch("/api/creations/media-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creationId, url }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as {
        url?: string;
      } | null;
      if (!response.ok || !data?.url?.trim()) {
        throw new Error("Media refresh failed");
      }
      setSource(data.url);
      handlingError.current = false;
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      handlingError.current = false;
      setLoadState("failed");
    } finally {
      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    }
  }, [creationId, url]);

  const retryBlob = useCallback(() => {
    blobRetryCount.current += 1;
    handlingError.current = true;
    setLoadState("retrying");
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      setSource(addMediaRetryParam(url, Date.now()));
      handlingError.current = false;
    }, RETRY_DELAY_MS);
  }, [url]);

  const handleError = useCallback(() => {
    if (handlingError.current) return;

    if (isVercelBlobUrl(url)) {
      if (blobRetryCount.current < MAX_BLOB_RETRIES) {
        retryBlob();
      } else {
        setLoadState("failed");
      }
      return;
    }

    if (!providerRefreshAttempted.current) {
      void refreshProviderUrl();
      return;
    }

    setLoadState("failed");
  }, [refreshProviderUrl, retryBlob, url]);

  const retryManually = useCallback(() => {
    clearPendingWork();
    blobRetryCount.current = 0;
    providerRefreshAttempted.current = false;
    handlingError.current = false;

    if (isVercelBlobUrl(url)) {
      setSource(addMediaRetryParam(url, Date.now()));
      setLoadState("retrying");
      return;
    }

    void refreshProviderUrl();
  }, [clearPendingWork, refreshProviderUrl, url]);

  if (loadState === "failed") {
    return (
      <div
        className={cn(
          "flex min-h-48 w-full flex-col items-center justify-center bg-surface-soft px-5 text-center",
          className
        )}
        role="status"
      >
        <FileWarning className="h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">{label} could not load</p>
        <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
        <Button type="button" variant="outline" size="sm" onClick={retryManually} className="mt-4 gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {children({ src: source, onError: handleError, onReady: markReady })}
      {loadState === "retrying" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-dark/80" role="status" aria-label={`Retrying ${label.toLowerCase()}`}>
          <div className="flex items-center gap-2 rounded-full bg-stone-950/75 px-3 py-2 text-xs font-medium text-white">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reconnecting…
          </div>
        </div>
      )}
    </>
  );
}
