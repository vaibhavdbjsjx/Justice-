import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 py-8 sm:items-center">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
