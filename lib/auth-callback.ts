export function getCurrentAuthCallbackUrl(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}
