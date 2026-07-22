"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Gavel, MessageSquareText } from "lucide-react";
import { COUNTRIES, getSubdivisions, subdivisionLabel } from "@/lib/legal/countries";
import { LANGUAGES } from "@/lib/i18n/languages";
import { PRACTICE_AREAS } from "@/lib/legal/practice-areas";
import { completeOnboarding } from "@/lib/auth/onboarding-actions";
import type { OnboardingInput } from "@/lib/auth/onboarding-types";
import type { UserRole } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RadioCard } from "@/components/ui/radio-card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Props = {
  isDemo?: boolean;
  initialFullName?: string;
};

export function OnboardingWizard({ isDemo = false, initialFullName = "" }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState(initialFullName);
  const [countryCode, setCountryCode] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [language, setLanguage] = useState("en");
  const [barNumber, setBarNumber] = useState("");
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(
    () => ["role", "jurisdiction", "profile", ...(role === "lawyer" ? ["professional"] : [])],
    [role],
  );
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const subdivisions = getSubdivisions(countryCode);

  const stepValid = (() => {
    switch (current) {
      case "role":
        return role !== null;
      case "jurisdiction":
        return countryCode !== "";
      case "profile":
        return fullName.trim().length > 0 && language !== "";
      case "professional":
        return practiceAreas.length > 0;
      default:
        return true;
    }
  })();

  function toggleArea(area: string) {
    setPracticeAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  async function finish() {
    setError(null);
    if (isDemo) {
      router.push("/dashboard");
      return;
    }
    setPending(true);
    const input: OnboardingInput = {
      role: role!,
      fullName,
      countryCode,
      stateProvince,
      language,
      barNumber: role === "lawyer" ? barNumber : undefined,
      practiceAreas: role === "lawyer" ? practiceAreas : undefined,
    };
    const res = await completeOnboarding(input);
    // On success the action redirects; only errors return here.
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-8 flex items-center gap-2" aria-hidden="true">
        {steps.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i <= step ? "bg-accent" : "bg-border",
            )}
          />
        ))}
      </div>

      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      {current === "role" && (
        <section className="animate-fade-in">
          <StepHeading
            title="How can we help you?"
            subtitle="This tailors your experience. You can always connect with a lawyer later."
          />
          <div role="radiogroup" aria-label="Account type" className="mt-6 space-y-3">
            <RadioCard
              selected={role === "consumer"}
              onSelect={() => setRole("consumer")}
              icon={<MessageSquareText className="h-5 w-5" />}
              title="I need legal help"
              description="Understand your situation, generate documents, and know when you need a lawyer."
            />
            <RadioCard
              selected={role === "lawyer"}
              onSelect={() => setRole("lawyer")}
              icon={<Gavel className="h-5 w-5" />}
              title="I'm a legal professional"
              description="Accelerate research and drafting, manage matters, and take on clients."
            />
          </div>
        </section>
      )}

      {current === "jurisdiction" && (
        <section className="animate-fade-in">
          <StepHeading
            title="Where do you need help?"
            subtitle="Laws vary by place, so Justice scopes everything to your jurisdiction."
          />
          <div className="mt-6 space-y-4">
            <Field label="Country" htmlFor="country" required>
              <Select
                id="country"
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setStateProvince("");
                }}
              >
                <option value="" disabled>
                  Select a country…
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            {countryCode && (
              <Field label={subdivisionLabel(countryCode)} htmlFor="region">
                {subdivisions.length > 0 ? (
                  <Select
                    id="region"
                    value={stateProvince}
                    onChange={(e) => setStateProvince(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {subdivisions.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id="region"
                    placeholder="State, province, or region"
                    value={stateProvince}
                    onChange={(e) => setStateProvince(e.target.value)}
                  />
                )}
              </Field>
            )}
          </div>
        </section>
      )}

      {current === "profile" && (
        <section className="animate-fade-in">
          <StepHeading
            title="A little about you"
            subtitle="So Justice can address you properly and respond in your language."
          />
          <div className="mt-6 space-y-4">
            <Field label="Full name" htmlFor="fullName" required>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <Field label="Preferred language" htmlFor="language" required>
              <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                    {l.nativeName !== l.name ? ` · ${l.nativeName}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>
      )}

      {current === "professional" && (
        <section className="animate-fade-in">
          <StepHeading
            title="Your practice"
            subtitle="This powers your marketplace profile and tailors research. You can refine it anytime."
          />
          <div className="mt-6 space-y-5">
            <Field
              label="Bar number"
              htmlFor="barNumber"
              hint="Used for verification. Your account stays unverified until we review it."
            >
              <Input
                id="barNumber"
                placeholder="e.g. 123456"
                value={barNumber}
                onChange={(e) => setBarNumber(e.target.value)}
              />
            </Field>
            <div>
              <p className="text-sm font-medium text-foreground">
                Practice areas <span className="text-alert">*</span>
              </p>
              <p className="mb-3 text-xs text-muted">Pick all that apply.</p>
              <div className="flex flex-wrap gap-2">
                {PRACTICE_AREAS.map((area) => {
                  const on = practiceAreas.includes(area);
                  return (
                    <button
                      key={area}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleArea(area)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150",
                        on
                          ? "border-accent bg-accent-soft text-foreground"
                          : "border-border-strong bg-surface text-muted-strong hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
          className={step === 0 ? "invisible" : ""}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        {isLast ? (
          <Button type="button" onClick={finish} disabled={!stepValid || pending}>
            {pending ? "Setting up…" : "Finish setup"}
            {!pending && <Check className="h-4 w-4" aria-hidden="true" />}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!stepValid}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}
