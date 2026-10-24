"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Permanent, self-service account deletion (App Store 5.1.1(v)). Requires the
 * user to type DELETE to confirm, then calls the server route that removes the
 * auth user and cascades all their data.
 */
export function DeleteAccount({ isDemo }: { isDemo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    if (isDemo || !isSupabaseConfigured) {
      setError("Account deletion isn't available in this preview.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Deletion failed.");
      // Clear any client-side session, then leave the app.
      try {
        await createClient().auth.signOut();
      } catch {
        /* already signed out server-side */
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-alert/40 bg-alert-soft p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-alert" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="font-medium text-foreground">Delete account</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-strong">
            Permanently delete your account and all associated data — your
            matters, documents, conversations, and deadlines. This action cannot
            be undone.
          </p>

          {!open ? (
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={() => {
                setOpen(true);
                setError(null);
              }}
            >
              Delete my account
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              {error && <Alert tone="error">{error}</Alert>}
              <label className="block text-sm font-medium text-foreground" htmlFor="confirm-delete">
                Type <span className="font-mono text-alert">DELETE</span> to confirm
              </label>
              <Input
                id="confirm-delete"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="max-w-xs"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={confirm !== "DELETE" || pending}
                  onClick={handleDelete}
                >
                  {pending ? "Deleting…" : "Permanently delete"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setOpen(false);
                    setConfirm("");
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
