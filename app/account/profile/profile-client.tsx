"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowLeft,
  Camera,
  Loader2,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/components/blocks/app-toast-provider";
import {
  getAvatarValidationError,
  MAX_AVATAR_BYTES,
} from "@/lib/account-profile";
import { clearCachedBillingSummary } from "@/lib/billing-summary-client";

type ProfileUser = {
  name: string;
  email: string;
  image: string | null;
  hasCustomAvatar: boolean;
};

function cropAvatar(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const targetSize = Math.min(640, sourceSize);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("This browser could not process the selected photo."));
        return;
      }
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        targetSize,
        targetSize
      );
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("This browser could not process the selected photo."));
            return;
          }
          resolve(
            new File([blob], "profile.webp", {
              type: "image/webp",
              lastModified: Date.now(),
            })
          );
        },
        "image/webp",
        0.9
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });
}

export function AccountProfileClient({ initialUser }: { initialUser: ProfileUser }) {
  const { update } = useSession();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialUser.name);
  const [savedName, setSavedName] = useState(initialUser.name);
  const [image, setImage] = useState(initialUser.image);
  const [hasCustomAvatar, setHasCustomAvatar] = useState(
    initialUser.hasCustomAvatar
  );
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length === 0
      ? "Display name is required."
      : trimmedName.length > 80
        ? "Display name must be 80 characters or less."
        : null;
  const nameChanged = trimmedName !== savedName;
  const avatarLabel = trimmedName || initialUser.email;
  const avatarInitial = avatarLabel.charAt(0).toUpperCase() || "U";

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameError || !nameChanged) return;
    setSavingName(true);
    setProfileError(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not update the display name.");
      }
      setName(data.user.name);
      setSavedName(data.user.name);
      await update({ user: { name: data.user.name, image } });
      showToast({ message: "Your display name has been updated.", variant: "success" });
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Could not update the display name."
      );
    } finally {
      setSavingName(false);
    }
  }

  async function uploadAvatar(file: File) {
    const validationError = getAvatarValidationError(file);
    if (validationError) {
      setProfileError(validationError);
      return;
    }
    setUploadingAvatar(true);
    setProfileError(null);
    try {
      const cropped = await cropAvatar(file);
      if (cropped.size > MAX_AVATAR_BYTES) {
        throw new Error("The processed profile photo is larger than 5 MB.");
      }
      const formData = new FormData();
      formData.append("avatar", cropped);
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not update the profile photo.");
      }
      setImage(data.user.image);
      setHasCustomAvatar(true);
      await update({ user: { name: savedName, image: data.user.image } });
      showToast({ message: "Your profile photo has been updated.", variant: "success" });
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Could not update the profile photo."
      );
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    setProfileError(null);
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not remove the profile photo.");
      }
      setImage(data.user.image);
      setHasCustomAvatar(false);
      await update({ user: { name: savedName, image: data.user.image } });
      showToast({ message: "Your Google photo or initial is now in use.", variant: "success" });
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Could not remove the profile photo."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not delete the account.");
      }
      clearCachedBillingSummary();
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete the account."
      );
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/home" aria-label="Flownana home">
            <Logo size="md" showText />
          </Link>
          <Link
            href="/ai-image"
            className="inline-flex h-10 items-center gap-2 rounded-ui px-3 text-sm text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Create
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Account
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium text-foreground sm:text-display-lg">
          Profile
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Manage the identity shown across your Flownana workspace.
        </p>

        <Card className="mt-8">
          <CardHeader className="border-b border-border">
            <CardTitle>Profile photo</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-strong text-2xl font-semibold text-foreground">
                {image ? (
                  <Image
                    src={image}
                    alt={avatarLabel}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  avatarInitial
                )}
                {uploadingAvatar && (
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/45 text-background">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  JPG, PNG or WebP, up to 5 MB
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Photos are centered and cropped to a square automatically.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {hasCustomAvatar ? (
                      <Camera className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {hasCustomAvatar ? "Change photo" : "Upload photo"}
                  </Button>
                  {hasCustomAvatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={removeAvatar}
                      disabled={uploadingAvatar}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-5">
          <CardHeader className="border-b border-border">
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={saveName} className="space-y-5">
              <div>
                <label htmlFor="display-name" className="mb-2 block text-sm font-medium text-foreground">
                  Display name
                </label>
                <Input
                  id="display-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  required
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "display-name-error" : undefined}
                />
                {nameError && (
                  <p id="display-name-error" className="mt-2 text-xs text-destructive">
                    {nameError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="account-email" className="mb-2 block text-sm font-medium text-foreground">
                  Email
                </label>
                <Input id="account-email" value={initialUser.email} disabled />
              </div>

              {profileError && (
                <p className="rounded-ui bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {profileError}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={Boolean(nameError) || !nameChanged || savingName}
                >
                  {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="mt-10 border-t border-destructive/25 pt-8">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h2 className="text-lg font-medium text-destructive">Danger Zone</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Deleting your account permanently removes your creations, media, and remaining credits. Active subscriptions are canceled first. Payments are not refunded.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="mt-4"
                onClick={() => {
                  setDeleteConfirmation("");
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete account
              </Button>
            </div>
          </div>
        </section>
      </main>

      {deleteOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="relative w-full rounded-t-ui-xl border border-border bg-background p-5 shadow-float sm:max-w-md sm:rounded-ui-xl sm:p-7"
          >
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-ui text-muted-foreground transition-all duration-300 hover:bg-surface-soft hover:text-foreground"
              aria-label="Close delete account confirmation"
              disabled={deleting}
            >
              <X className="h-5 w-5" />
            </button>
            <h2 id="delete-account-title" className="pr-10 text-xl font-medium text-foreground">
              Permanently delete account?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This removes your account, generated media, and credits. It cannot be undone. Type <strong className="text-foreground">DELETE</strong> to continue.
            </p>
            <label htmlFor="delete-confirmation" className="mt-5 block text-sm font-medium text-foreground">
              Confirmation
            </label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="DELETE"
              className="mt-2"
              disabled={deleting}
              autoComplete="off"
            />
            {deleteError && (
              <p className="mt-3 rounded-ui bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteAccount}
                disabled={deleteConfirmation !== "DELETE" || deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete permanently
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
