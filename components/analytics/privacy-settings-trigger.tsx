"use client";

import type { ButtonHTMLAttributes } from "react";
import { PRIVACY_SETTINGS_EVENT } from "@/lib/analytics-preferences";

export function PrivacySettingsTrigger({ children = "Privacy settings", onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented) window.dispatchEvent(new Event(PRIVACY_SETTINGS_EVENT));
  }}>{children}</button>;
}
