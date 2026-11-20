// Renders the real paywall with the App Store prices, for the subscription
// review screenshot in App Store Connect. Run with:
//   flutter test test/paywall_screenshot_test.dart --update-goldens
// Simulator builds can't load App Store products, so this stands in for one.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lexa_mobile/models/models.dart';
import 'package:lexa_mobile/screens/paywall_screen.dart';
import 'package:lexa_mobile/state/app_state.dart';
import 'package:lexa_mobile/theme/theme.dart';

Future<void> _loadFonts() async {
  final fonts = {
    'Inter': ['Regular', 'Medium', 'SemiBold', 'Bold'],
    'Fraunces': ['Regular', 'Medium', 'SemiBold'],
  };
  for (final entry in fonts.entries) {
    final loader = FontLoader(entry.key);
    for (final weight in entry.value) {
      loader.addFont(rootBundle.load('assets/fonts/${entry.key}-$weight.ttf'));
    }
    await loader.load();
  }
  final icons = FontLoader('MaterialIcons');
  // FLUTTER_ROOT is set by `flutter test`.
  final sdk = Platform.environment['FLUTTER_ROOT']!;
  final iconFile = File(
    '$sdk/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  icons.addFont(Future.value(ByteData.view(iconFile.readAsBytesSync().buffer)));
  await icons.load();
}

void main() {
  for (final lawyer in [false, true]) {
    testWidgets('paywall with App Store prices (lawyer: $lawyer)', (
      tester,
    ) async {
      await tester.runAsync(_loadFonts);
      tester.view.physicalSize = const Size(1206, 2622);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('app.lexa/native'),
        (call) async {
          if (call.method != 'store.products') return null;
          return [
            {
              'id': 'com.vaibhavsg.lexa.plus.monthly',
              'title': 'Lexa Plus Monthly',
              'description': '',
              'price': r'$9.99',
              'period': 'month',
            },
            {
              'id': 'com.vaibhavsg.lexa.plus.yearly',
              'title': 'Lexa Plus Yearly',
              'description': '',
              'price': r'$79.99',
              'period': 'year',
            },
            {
              'id': 'com.vaibhavsg.lexa.professional.monthly',
              'title': 'Lexa Professional Monthly',
              'description': '',
              'price': r'$39.99',
              'period': 'month',
            },
            {
              'id': 'com.vaibhavsg.lexa.professional.yearly',
              'title': 'Lexa Professional Yearly',
              'description': '',
              'price': r'$349.99',
              'period': 'year',
            },
          ];
        },
      );

      final state = AppState();
      if (lawyer) {
        state.profile = Profile(
          userId: 'review',
          role: 'lawyer',
          language: 'en',
          onboardingCompleted: true,
          hasConsentColumns: true,
        );
      }
      await tester.pumpWidget(
        AppScope(
          state: state,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: lexaLight,
            home: const PaywallScreen(),
          ),
        ),
      );
      for (var i = 0; i < 30; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile(
          '../../../store-screenshots/review/paywall-${lawyer ? 'professional' : 'plus'}.png',
        ),
      );
    });
  }
}
