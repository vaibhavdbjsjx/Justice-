import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Card raised className="p-6 sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Use at least 8 characters. You&rsquo;ll stay signed in on this device.
        </p>
      </div>
      <ResetPasswordForm />
    </Card>
  );
}
