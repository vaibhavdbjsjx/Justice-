"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MATTER_CATEGORIES } from "@/lib/matters/categories";
import {
  createMatter,
  updateMatter,
  type MatterInput,
} from "@/lib/matters/actions";
import {
  COUNTRIES,
  getSubdivisions,
  subdivisionLabel,
} from "@/lib/legal/countries";
import type { Matter, MatterStatus } from "@/lib/supabase/types";

/**
 * Create/edit form for a matter. Jurisdiction is re-askable per case (Part 1):
 * it defaults from the profile but each matter carries its own. Stored as
 * display names, consistent with profiles (Phase 2 decision).
 */
export function MatterForm({
  mode,
  matter,
  defaultCountry,
  defaultState,
}: {
  mode: "create" | "edit";
  matter?: Matter;
  /** Profile jurisdiction (display names) used to prefill on create. */
  defaultCountry: string | null;
  defaultState: string | null;
}) {
  const initialCountryName = matter?.jurisdiction_country ?? defaultCountry;
  const initialCountryCode =
    COUNTRIES.find((c) => c.name === initialCountryName)?.code ?? "";

  const [title, setTitle] = useState(matter?.title ?? "");
  const [category, setCategory] = useState(matter?.category ?? "");
  const [status, setStatus] = useState<MatterStatus>(matter?.status ?? "active");
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [region, setRegion] = useState(
    matter?.jurisdiction_state ?? defaultState ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subdivisions = useMemo(() => getSubdivisions(countryCode), [countryCode]);
  const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name ?? null;

  const submit = () => {
    setError(null);
    const input: MatterInput = {
      title,
      category,
      jurisdictionCountry: countryName,
      jurisdictionState: region || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createMatter(input)
          : await updateMatter(matter!.id, { ...input, status });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
      noValidate
    >
      <Field label="Title" htmlFor="matter-title" required
        hint="A short name you'll recognize — e.g. “Deposit dispute — Maple St”.">
        <Input
          id="matter-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this matter about?"
          required
        />
      </Field>

      <Field label="Category" htmlFor="matter-category" required>
        <Select
          id="matter-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose a category…
          </option>
          {MATTER_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      {mode === "edit" && (
        <Field label="Status" htmlFor="matter-status">
          <Select
            id="matter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MatterStatus)}
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Country"
          htmlFor="matter-country"
          hint="Where this matter's law applies — it can differ from your profile."
        >
          <Select
            id="matter-country"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setRegion("");
            }}
          >
            <option value="">Not set</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={subdivisionLabel(countryCode)} htmlFor="matter-region">
          {subdivisions.length > 0 ? (
            <Select
              id="matter-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={!countryCode}
            >
              <option value="">Not set</option>
              {subdivisions.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id="matter-region"
              value={region}
              maxLength={80}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={countryCode ? "Region (optional)" : "Choose a country first"}
              disabled={!countryCode}
            />
          )}
        </Field>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending || !title.trim() || !category}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create matter"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
