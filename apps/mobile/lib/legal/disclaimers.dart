/// Canonical compliance copy (Part 1) — Dart mirror of
/// apps/web/src/lib/legal/disclaimers.ts. Keep the two in sync; this framing
/// is product logic, not a footer. Every AI legal output on mobile must be
/// accompanied by at least [disclaimerShort] (Part 10 hard requirement) —
/// the [AiLegalOutput] widget enforces it structurally.
library;

const disclaimerShort = 'Legal information, not legal advice.';

const disclaimerFull =
    'LexMind provides legal information to help you understand your situation '
    'and options — it is not legal advice. Using LexMind does not create an '
    'attorney–client relationship. Laws vary by jurisdiction and change over '
    'time; confirm anything important with a licensed lawyer in your area '
    'before you act, sign, or file.';

const reviewBeforeUseTitle = 'Review before use';
const reviewBeforeUseBody =
    'This document was drafted with AI assistance from the information you '
    'provided. It is a starting point, not a finished legal instrument. Have '
    'a licensed lawyer in the relevant jurisdiction review it before you '
    'sign, send, or file it.';

const professionalHelpNudge =
    'This looks like it could carry significant consequences. Consider '
    'speaking with a licensed lawyer in your jurisdiction before taking '
    'action — LexMind can help you find one.';

const highStakesKeywords = [
  'arrest',
  'arrested',
  'criminal',
  'custody',
  'deport',
  'immigration',
  'eviction hearing',
  'restraining order',
  'lawsuit',
  'sued',
  'court date',
  'warrant',
];

bool looksHighStakes(String? text) {
  if (text == null || text.isEmpty) return false;
  final lower = text.toLowerCase();
  return highStakesKeywords.any(lower.contains);
}
