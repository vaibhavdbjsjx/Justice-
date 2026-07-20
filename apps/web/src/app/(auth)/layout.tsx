import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="hidden items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          {children}
          <div className="mt-6">
            <DisclaimerBanner variant="compact" className="justify-center" />
          </div>
        </div>
      </main>
    </div>
  );
}
