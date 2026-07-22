import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tokens.g.dart';

/// Justice theme (Part 5) built from the generated tokens — the same palette
/// the web reads from tokens.json, so light/dark parity is structural.
/// Fraunces stays reserved for gravitas moments (titles, document surfaces);
/// Inter carries functional UI.

TextTheme _textTheme(Color foreground, Color muted) {
  final serif = GoogleFonts.fraunces(
    fontWeight: FontWeight.w500,
    color: foreground,
  );
  final sans = GoogleFonts.inter(color: foreground);
  return TextTheme(
    displaySmall: serif.copyWith(
        fontSize: TypeTokens.h1Size, height: TypeTokens.h1Height),
    headlineMedium: serif.copyWith(
        fontSize: TypeTokens.h2Size, height: TypeTokens.h2Height),
    titleLarge: serif.copyWith(
        fontSize: TypeTokens.h3Size,
        height: TypeTokens.h3Height,
        fontWeight: FontWeight.w600),
    titleMedium: sans.copyWith(fontSize: 16, fontWeight: FontWeight.w600),
    bodyLarge: sans.copyWith(
        fontSize: TypeTokens.bodySize, height: TypeTokens.bodyHeight),
    bodyMedium: sans.copyWith(
        fontSize: TypeTokens.smallSize, height: TypeTokens.smallHeight),
    bodySmall: sans.copyWith(
        fontSize: TypeTokens.captionSize,
        height: TypeTokens.captionHeight,
        color: muted),
    labelLarge: sans.copyWith(fontSize: 15, fontWeight: FontWeight.w600),
  );
}

ThemeData _build({
  required Brightness brightness,
  required Color background,
  required Color surface,
  required Color surfaceSunken,
  required Color foreground,
  required Color muted,
  required Color border,
  required Color primary,
  required Color primaryForeground,
  required Color accent,
  required Color accentForeground,
  required Color alert,
}) {
  final scheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: primaryForeground,
    secondary: accent,
    onSecondary: accentForeground,
    error: alert,
    onError: Colors.white,
    surface: surface,
    onSurface: foreground,
    outline: border,
    surfaceContainerHighest: surfaceSunken,
  );

  final radius = BorderRadius.circular(RadiusTokens.lg);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: background,
    textTheme: _textTheme(foreground, muted),
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: foreground,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: GoogleFonts.fraunces(
        fontSize: 22,
        fontWeight: FontWeight.w500,
        color: foreground,
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(RadiusTokens.xl),
        side: BorderSide(color: border),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
          borderRadius: radius, borderSide: BorderSide(color: border)),
      enabledBorder: OutlineInputBorder(
          borderRadius: radius, borderSide: BorderSide(color: border)),
      focusedBorder: OutlineInputBorder(
          borderRadius: radius, borderSide: BorderSide(color: accent, width: 1.5)),
      hintStyle: GoogleFonts.inter(color: muted, fontSize: 15),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: accentForeground,
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: foreground,
        minimumSize: const Size(48, 48),
        side: BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    dividerTheme: DividerThemeData(color: border, thickness: 1),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: accent.withValues(alpha: 0.16),
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: primary,
      contentTextStyle:
          GoogleFonts.inter(color: primaryForeground, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: radius),
    ),
  );
}

final justiceLight = _build(
  brightness: Brightness.light,
  background: LightTokens.background,
  surface: LightTokens.surface,
  surfaceSunken: LightTokens.surfaceSunken,
  foreground: LightTokens.foreground,
  muted: LightTokens.muted,
  border: LightTokens.border,
  primary: LightTokens.primary,
  primaryForeground: LightTokens.primaryForeground,
  accent: LightTokens.accent,
  accentForeground: LightTokens.accentForeground,
  alert: LightTokens.alert,
);

final justiceDark = _build(
  brightness: Brightness.dark,
  background: DarkTokens.background,
  surface: DarkTokens.surface,
  surfaceSunken: DarkTokens.surfaceSunken,
  foreground: DarkTokens.foreground,
  muted: DarkTokens.muted,
  border: DarkTokens.border,
  primary: DarkTokens.primary,
  primaryForeground: DarkTokens.primaryForeground,
  accent: DarkTokens.accent,
  accentForeground: DarkTokens.accentForeground,
  alert: DarkTokens.alert,
);

/// Semantic colors that aren't on ColorScheme, resolved per brightness.
extension LexColors on BuildContext {
  bool get _dark => Theme.of(this).brightness == Brightness.dark;
  Color get mutedColor => _dark ? DarkTokens.muted : LightTokens.muted;
  Color get mutedStrong =>
      _dark ? DarkTokens.mutedStrong : LightTokens.mutedStrong;
  Color get successColor => _dark ? DarkTokens.success : LightTokens.success;
  Color get surfaceSunken =>
      _dark ? DarkTokens.surfaceSunken : LightTokens.surfaceSunken;
  Color get accentSoft => (_dark ? DarkTokens.accent : LightTokens.accent)
      .withValues(alpha: 0.14);
}
