import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:justice_mobile/legal/disclaimers.dart';
import 'package:justice_mobile/models/models.dart';
import 'package:justice_mobile/theme/tokens.g.dart';
import 'package:justice_mobile/widgets/ai_legal_output.dart';
import 'package:justice_mobile/widgets/markdown_lite.dart';

void main() {
  group('design tokens (generated from tokens.json)', () {
    test('light palette matches canonical values', () {
      expect(LightTokens.background, const Color(0xFFFAF7F2));
      expect(LightTokens.primary, const Color(0xFF0B1D2E));
      expect(LightTokens.accent, const Color(0xFFB08D57));
    });
    test('dark palette matches canonical values', () {
      expect(DarkTokens.background, const Color(0xFF12181F));
      expect(DarkTokens.accent, const Color(0xFFC6A56E));
    });
    test('type scale converted to px doubles', () {
      expect(TypeTokens.bodySize, 16.0);
      expect(TypeTokens.h1Size, 36.0);
      expect(TypeTokens.legalProseLineHeight, 1.75);
    });
  });

  group('compliance (Part 10 hard requirement)', () {
    testWidgets('AiLegalOutput always carries the disclaimer',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: AiLegalOutput(child: Text('AI answer body')),
        ),
      ));
      expect(find.text('AI answer body'), findsOneWidget);
      expect(find.text(disclaimerShort), findsOneWidget);
    });

    testWidgets('high-stakes adds the professional-help nudge',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: AiLegalOutput(
              highStakes: true, child: Text('AI answer body')),
        ),
      ));
      expect(find.text(professionalHelpNudge), findsOneWidget);
    });

    test('looksHighStakes matches the shared keyword list', () {
      expect(looksHighStakes('I was arrested last night'), isTrue);
      expect(looksHighStakes('my landlord kept my deposit'), isFalse);
      expect(looksHighStakes(null), isFalse);
    });
  });

  group('MarkdownLite', () {
    testWidgets('renders headings, bullets and bold', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: MarkdownLite(
              '## Settled law\n- first point\n1. numbered\nPlain **bold** text'),
        ),
      ));
      expect(find.text('Settled law'), findsOneWidget);
      expect(find.text('first point'), findsOneWidget);
      expect(find.text('numbered'), findsOneWidget);
      expect(find.textContaining('Plain'), findsOneWidget);
    });
  });

  group('models tolerate loose json', () {
    test('DocumentAnalysis with missing fields', () {
      final a = DocumentAnalysis.fromJson(const {
        'document_type': 'lease',
        'plain_language_summary': 'A lease.',
      });
      expect(a.obligations, isEmpty);
      expect(a.riskyClauses, isEmpty);
      expect(a.importantDates, isEmpty);
    });

    test('GeneratedDoc keeps placeholders and flags', () {
      final g = GeneratedDoc.fromJson(const {
        'title': 'Demand letter',
        'body_markdown': 'Dear [NAME]',
        'placeholders': ['[NAME]'],
        'review_flags': ['Check the cure period'],
        'jurisdiction_caveat': null,
      });
      expect(g.placeholders, ['[NAME]']);
      expect(g.reviewFlags, hasLength(1));
      expect(g.jurisdictionCaveat, isNull);
    });

    test('Matter jurisdiction label', () {
      final m = Matter.fromJson(const {
        'id': 'x',
        'title': 'T',
        'category': 'contracts',
        'status': 'active',
        'jurisdiction_country': 'United States',
        'jurisdiction_state': 'California',
        'created_at': '2026-07-05T00:00:00Z',
      });
      expect(m.jurisdictionLabel, 'California, United States');
    });
  });
}
