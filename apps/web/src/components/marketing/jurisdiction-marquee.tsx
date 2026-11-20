const PLACES = [
  "United States",
  "India",
  "United Kingdom",
  "Canada",
  "Australia",
  "Ireland",
  "New Zealand",
  "Singapore",
  "South Africa",
  "Germany",
  "France",
  "Mexico",
  "Brazil",
  "Japan",
  "Nigeria",
  "United Arab Emirates",
];

/** A slow band of places. Pauses under reduced motion via the global rule. */
export function JurisdictionMarquee() {
  const row = [...PLACES, ...PLACES];
  return (
    <section aria-label="Lexa works across 249 countries and territories" className="overflow-hidden border-b border-border py-5">
      <div
        aria-hidden="true"
        className="animate-marquee flex w-max gap-10 whitespace-nowrap"
        style={{
          maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        }}
      >
        {row.map((place, i) => (
          <span key={`${place}-${i}`} className="font-display text-xl text-muted">
            {place}
          </span>
        ))}
      </div>
    </section>
  );
}
