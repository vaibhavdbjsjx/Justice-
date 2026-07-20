/**
 * Jurisdiction reference data. Global architecture, launch-focused data (Part 12):
 * full subdivisions for the initial focus markets (US, CA, AU, IN), and a broad
 * country list for everywhere else with a free-form region fallback.
 *
 * `subdivisionLabel` reflects local terminology (State / Province / etc.).
 */

export type Subdivision = { code: string; name: string };
export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  subdivisionLabel?: string;
  subdivisions?: Subdivision[];
};

const US_STATES: Subdivision[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

const CA_PROVINCES: Subdivision[] = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
].map(([code, name]) => ({ code, name }));

const AU_STATES: Subdivision[] = [
  ["ACT", "Australian Capital Territory"], ["NSW", "New South Wales"],
  ["NT", "Northern Territory"], ["QLD", "Queensland"], ["SA", "South Australia"],
  ["TAS", "Tasmania"], ["VIC", "Victoria"], ["WA", "Western Australia"],
].map(([code, name]) => ({ code, name }));

const IN_STATES: Subdivision[] = [
  ["AP", "Andhra Pradesh"], ["AR", "Arunachal Pradesh"], ["AS", "Assam"], ["BR", "Bihar"],
  ["CT", "Chhattisgarh"], ["DL", "Delhi"], ["GA", "Goa"], ["GJ", "Gujarat"], ["HR", "Haryana"],
  ["HP", "Himachal Pradesh"], ["JH", "Jharkhand"], ["KA", "Karnataka"], ["KL", "Kerala"],
  ["MP", "Madhya Pradesh"], ["MH", "Maharashtra"], ["MN", "Manipur"], ["ML", "Meghalaya"],
  ["MZ", "Mizoram"], ["NL", "Nagaland"], ["OR", "Odisha"], ["PB", "Punjab"], ["RJ", "Rajasthan"],
  ["SK", "Sikkim"], ["TN", "Tamil Nadu"], ["TG", "Telangana"], ["TR", "Tripura"],
  ["UP", "Uttar Pradesh"], ["UK", "Uttarakhand"], ["WB", "West Bengal"],
].map(([code, name]) => ({ code, name }));

// Countries with full subdivision support (initial focus markets) first.
export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", subdivisionLabel: "State", subdivisions: US_STATES },
  { code: "CA", name: "Canada", subdivisionLabel: "Province / Territory", subdivisions: CA_PROVINCES },
  { code: "GB", name: "United Kingdom", subdivisionLabel: "Nation", subdivisions: [
    { code: "ENG", name: "England" }, { code: "SCT", name: "Scotland" },
    { code: "WLS", name: "Wales" }, { code: "NIR", name: "Northern Ireland" },
  ] },
  { code: "AU", name: "Australia", subdivisionLabel: "State / Territory", subdivisions: AU_STATES },
  { code: "IN", name: "India", subdivisionLabel: "State / UT", subdivisions: IN_STATES },
  // Broader coverage (region captured free-form). Alphabetical.
  { code: "AR", name: "Argentina" }, { code: "AT", name: "Austria" }, { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" }, { code: "CL", name: "Chile" }, { code: "CO", name: "Colombia" },
  { code: "DK", name: "Denmark" }, { code: "EG", name: "Egypt" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "DE", name: "Germany" }, { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" }, { code: "HK", name: "Hong Kong SAR" }, { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" }, { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" }, { code: "KE", name: "Kenya" }, { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" }, { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" }, { code: "NO", name: "Norway" }, { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" }, { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" }, { code: "SA", name: "Saudi Arabia" }, { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" }, { code: "KR", name: "South Korea" }, { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" }, { code: "CH", name: "Switzerland" }, { code: "TH", name: "Thailand" },
  { code: "TR", name: "Türkiye" }, { code: "AE", name: "United Arab Emirates" },
  { code: "VN", name: "Vietnam" },
];

export function getCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code);
}

/** Subdivisions for a country by code, or [] if it uses free-form regions. */
export function getSubdivisions(code: string | null | undefined): Subdivision[] {
  return getCountry(code)?.subdivisions ?? [];
}

export function subdivisionLabel(code: string | null | undefined): string {
  return getCountry(code)?.subdivisionLabel ?? "State / Province / Region";
}
