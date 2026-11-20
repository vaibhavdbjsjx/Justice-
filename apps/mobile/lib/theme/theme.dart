import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'tokens.g.dart';

/// Lexa's theme, built from the same generated tokens the web reads, so color
/// parity between platforms is structural. Fraunces carries the display moments;
/// Inter carries everything functional. Both ship inside the app, so nothing is
/// fetched from a font service at runtime.
const _serif = 'Fraunces';
const _sans = 'Inter';

class LexaMotion {
  const LexaMotion._();
  static const fast = Duration(milliseconds: 140);
  static const base = Duration(milliseconds: 240);
  static const slow = Duration(milliseconds: 460);
  static const curve = Cubic(0.22, 1, 0.36, 1);
}

TextTheme _textTheme(Color foreground, Color muted, Color strong) {
  TextStyle serif(double size, double height, double tracking, [FontWeight weight = FontWeight.w500]) =>
      TextStyle(
        fontFamily: _serif,
        fontSize: size,
        height: height,
        letterSpacing: tracking,
        fontWeight: weight,
        color: foreground,
      );
  TextStyle sans(double size, double height, FontWeight weight, Color color, [double tracking = 0]) =>
      TextStyle(
        fontFamily: _sans,
        fontSize: size,
        height: height,
        fontWeight: weight,
        color: color,
        letterSpacing: tracking,
      );

  return TextTheme(
    displayLarge: serif(44, 1.04, -1.1),
    displayMedium: serif(34, 1.08, -0.7),
    displaySmall: serif(28, 1.12, -0.5),
    headlineMedium: serif(23, 1.2, -0.3),
    titleLarge: serif(20, 1.25, -0.2),
    titleMedium: sans(16, 1.35, FontWeight.w600, foreground, -0.15),
    titleSmall: sans(14, 1.35, FontWeight.w600, foreground, -0.1),
    bodyLarge: sans(16, 1.55, FontWeight.w400, foreground, -0.1),
    bodyMedium: sans(15, 1.5, FontWeight.w400, strong, -0.05),
    bodySmall: sans(13, 1.42, FontWeight.w400, muted),
    labelLarge: sans(15, 1.2, FontWeight.w600, foreground, -0.1),
    labelMedium: sans(13, 1.2, FontWeight.w600, foreground),
    labelSmall: sans(11, 1.2, FontWeight.w600, muted, 0.5),
  );
}

ThemeData _build({
  required Brightness brightness,
  required Color background,
  required Color surface,
  required Color surfaceRaised,
  required Color surfaceSunken,
  required Color foreground,
  required Color muted,
  required Color mutedStrong,
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
    surfaceContainerHigh: surfaceRaised,
  );

  final text = _textTheme(foreground, muted, mutedStrong);
  final fieldRadius = BorderRadius.circular(14);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: _sans,
    scaffoldBackgroundColor: background,
    canvasColor: background,
    textTheme: text,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.android: CupertinoPageTransitionsBuilder(),
    }),
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: foreground,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: text.titleMedium,
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: border),
      ),
      margin: EdgeInsets.zero,
    ),
    dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: border)),
      enabledBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: border)),
      focusedBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: accent, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: alert)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: alert, width: 1.5)),
      hintStyle: text.bodyMedium?.copyWith(color: muted),
      labelStyle: text.bodyMedium?.copyWith(color: muted),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: accent,
      selectionColor: accent.withValues(alpha: 0.26),
      selectionHandleColor: accent,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surface,
      modalBackgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      constraints: const BoxConstraints(maxWidth: 620),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      titleTextStyle: text.titleLarge,
      contentTextStyle: text.bodyMedium,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: foreground,
      contentTextStyle: text.bodyMedium?.copyWith(color: background),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      elevation: 0,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: accent),
    switchTheme: SwitchThemeData(
      thumbColor: const WidgetStatePropertyAll(Colors.white),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? accent : surfaceSunken),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    datePickerTheme: DatePickerThemeData(
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      headerBackgroundColor: surface,
      headerForegroundColor: foreground,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
    ),
  );
}

final lexaLight = _build(
  brightness: Brightness.light,
  background: LightTokens.background,
  surface: LightTokens.surface,
  surfaceRaised: LightTokens.surfaceRaised,
  surfaceSunken: LightTokens.surfaceSunken,
  foreground: LightTokens.foreground,
  muted: LightTokens.muted,
  mutedStrong: LightTokens.mutedStrong,
  border: LightTokens.border,
  primary: LightTokens.primary,
  primaryForeground: LightTokens.primaryForeground,
  accent: LightTokens.accent,
  accentForeground: LightTokens.accentForeground,
  alert: LightTokens.alert,
);

final lexaDark = _build(
  brightness: Brightness.dark,
  background: DarkTokens.background,
  surface: DarkTokens.surface,
  surfaceRaised: DarkTokens.surfaceRaised,
  surfaceSunken: DarkTokens.surfaceSunken,
  foreground: DarkTokens.foreground,
  muted: DarkTokens.muted,
  mutedStrong: DarkTokens.mutedStrong,
  border: DarkTokens.border,
  primary: DarkTokens.primary,
  primaryForeground: DarkTokens.primaryForeground,
  accent: DarkTokens.accent,
  accentForeground: DarkTokens.accentForeground,
  alert: DarkTokens.alert,
);

/// Semantic colors that aren't on ColorScheme, resolved per brightness.
extension LexColors on BuildContext {
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  Color get mutedColor => isDark ? DarkTokens.muted : LightTokens.muted;
  Color get mutedStrong => isDark ? DarkTokens.mutedStrong : LightTokens.mutedStrong;
  Color get successColor => isDark ? DarkTokens.success : LightTokens.success;
  Color get surfaceSunken => isDark ? DarkTokens.surfaceSunken : LightTokens.surfaceSunken;
  Color get surfaceRaised => isDark ? DarkTokens.surfaceRaised : LightTokens.surfaceRaised;
  Color get borderStrong => isDark ? DarkTokens.borderStrong : LightTokens.borderStrong;
  Color get accentColor => isDark ? DarkTokens.accent : LightTokens.accent;
  Color get alertColor => isDark ? DarkTokens.alert : LightTokens.alert;
  Color get accentSoft => accentColor.withValues(alpha: isDark ? 0.18 : 0.12);
  Color get alertSoft => alertColor.withValues(alpha: isDark ? 0.18 : 0.1);
  Color get successSoft => successColor.withValues(alpha: isDark ? 0.18 : 0.14);
  List<BoxShadow> get softShadow => [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.32 : 0.06),
          blurRadius: 24,
          offset: const Offset(0, 10),
        ),
      ];
}
