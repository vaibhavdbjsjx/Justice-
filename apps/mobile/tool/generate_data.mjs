// Generates assets/data/jurisdictions.json from the web app's reference data, so
// the country and state lists have one source. Run with Node 24 or later:
//   node apps/mobile/tool/generate_data.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..", "..", "web", "src", "lib");
const { COUNTRIES } = await import(join(web, "legal", "countries.ts"));
const { LANGUAGES } = await import(join(web, "i18n", "languages.ts"));
const { PRACTICE_AREAS } = await import(join(web, "legal", "practice-areas.ts"));

writeFileSync(
  join(here, "..", "assets", "data", "jurisdictions.json"),
  `${JSON.stringify({ countries: COUNTRIES, languages: LANGUAGES, practiceAreas: PRACTICE_AREAS })}\n`,
);
console.log(`${COUNTRIES.length} countries, ${LANGUAGES.length} languages, ${PRACTICE_AREAS.length} practice areas`);
