#!/usr/bin/env node
// tokens.json → Dart (Phase 12). The Phase 1 deferral lands: tokens.json is
// canonical; web mirrors it in globals.css, Flutter consumes THIS generated
// file. Re-run after editing tokens.json:
//   node packages/design-tokens/generate-flutter.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, "tokens.json"), "utf8"));
const out = join(here, "..", "..", "apps", "mobile", "lib", "theme", "tokens.g.dart");

const dartColor = (hex) => `Color(0xFF${hex.replace("#", "").toUpperCase()})`;
const ident = (name) =>
  name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^2xl$/, "xxl");

const colorClass = (className, palette) =>
  [
    `class ${className} {`,
    `  const ${className}._();`,
    ...Object.entries(palette).map(
      ([k, v]) => `  static const ${ident(k)} = ${dartColor(v)};`,
    ),
    `}`,
  ].join("\n");

// Always a Dart double literal (fontSize etc. reject ints).
const remPx = (v) => (Math.round(parseFloat(v) * 16 * 10) / 10).toFixed(1);
const dartDouble = (v) => {
  const n = String(parseFloat(v));
  return n.includes(".") ? n : `${n}.0`;
};
const scaleEntries = Object.entries(tokens.typography.scale).filter(
  ([, v]) => typeof v === "object",
);

const dart = `// GENERATED from packages/design-tokens/tokens.json — do not edit.
// Regenerate: node packages/design-tokens/generate-flutter.mjs
// ignore_for_file: constant_identifier_names
import 'dart:ui' show Color;

${colorClass("BrandTokens", tokens.brand)}

${colorClass("LightTokens", tokens.semantic.light)}

${colorClass("DarkTokens", tokens.semantic.dark)}

class TypeTokens {
  const TypeTokens._();
  static const fontSerif = '${tokens.typography["font-serif"]}';
  static const fontSans = '${tokens.typography["font-sans"]}';
${scaleEntries
  .map(
    ([k, v]) =>
      `  static const ${ident(k)}Size = ${remPx(v.size)}; // px\n` +
      `  static const ${ident(k)}Height = ${dartDouble(v.line)};\n` +
      `  static const ${ident(k)}Weight = ${v.weight};`,
  )
  .join("\n")}
  static const legalProseLineHeight = ${dartDouble(
    tokens.typography.scale["legal-prose-line-height"],
  )};
}

class RadiusTokens {
  const RadiusTokens._();
${Object.entries(tokens.radius)
  .map(([k, v]) => `  static const ${ident(k)} = ${parseFloat(v)}.0;`)
  .join("\n")}
}

class MotionTokens {
  const MotionTokens._();
  static const durationFastMs = ${parseInt(tokens.motion["duration-fast"])};
  static const durationMs = ${parseInt(tokens.motion.duration)};
  static const durationSlowMs = ${parseInt(tokens.motion["duration-slow"])};
}
`;

writeFileSync(out, dart);
console.log(`wrote ${out}`);
