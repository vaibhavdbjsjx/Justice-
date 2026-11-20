import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lexa_mobile/data/repository.dart';
import 'package:lexa_mobile/legal/disclaimers.dart';
import 'package:lexa_mobile/models/models.dart';
import 'package:lexa_mobile/services/reminders.dart';
import 'package:lexa_mobile/theme/tokens.g.dart';
import 'package:lexa_mobile/widgets/ai_legal_output.dart';
import 'package:lexa_mobile/widgets/markdown_lite.dart';

Widget _app(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('design tokens (generated from tokens.json)', () {
    test('light palette matches canonical values', () {
      expect(LightTokens.background, const Color(0xFFFAF9F5));
      expect(LightTokens.primary, const Color(0xFFC15F3C));
      expect(LightTokens.accent, const Color(0xFFC15F3C));
    });
    test('dark palette matches canonical values', () {
      expect(DarkTokens.background, const Color(0xFF1F1E1D));
      expect(DarkTokens.accent, const Color(0xFFE08E70));
    });
    test('type scale converted to px doubles', () {
      expect(TypeTokens.bodySize, 16.0);
      expect(TypeTokens.h1Size, 36.0);
      expect(TypeTokens.legalProseLineHeight, 1.75);
    });
  });

  group('compliance', () {
    testWidgets('AiLegalOutput always carries the disclaimer', (tester) async {
      await tester.pumpWidget(_app(const AiLegalOutput(child: Text('AI answer body'))));
      expect(find.text('AI answer body'), findsOneWidget);
      expect(find.text(disclaimerShort), findsOneWidget);
    });

    testWidgets('high stakes adds the professional-help nudge', (tester) async {
      await tester.pumpWidget(_app(const AiLegalOutput(highStakes: true, child: Text('AI answer body'))));
      expect(find.text(professionalHelpNudge), findsOneWidget);
    });

    testWidgets('lawyers see the research notice instead', (tester) async {
      await tester.pumpWidget(_app(const AiLegalOutput(lawyerAudience: true, child: Text('Body'))));
      expect(find.text(researchNotice), findsOneWidget);
      expect(find.text(disclaimerShort), findsNothing);
    });

    test('looksHighStakes matches the shared keyword list', () {
      expect(looksHighStakes('I was arrested last night'), isTrue);
      expect(looksHighStakes('my landlord kept my deposit'), isFalse);
      expect(looksHighStakes(null), isFalse);
    });
  });

  group('MarkdownLite', () {
    testWidgets('renders headings, bullets and bold', (tester) async {
      await tester.pumpWidget(_app(const MarkdownLite(
          '## Settled law\n- first point\n1. numbered\nPlain **bold** text')));
      expect(find.text('Settled law'), findsOneWidget);
      expect(find.textContaining('first point'), findsOneWidget);
      expect(find.textContaining('numbered'), findsOneWidget);
      expect(find.textContaining('Plain'), findsOneWidget);
    });

    testWidgets('does not show raw markdown markers', (tester) async {
      await tester.pumpWidget(_app(const MarkdownLite('**Lead sentence.** More text')));
      expect(find.textContaining('**'), findsNothing);
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
      expect(a.segments, isEmpty);
    });

    test('DocumentAnalysis reads the full shape', () {
      final a = DocumentAnalysis.fromJson(const {
        'document_type': 'Lease',
        'plain_language_summary': 'Summary',
        'jurisdiction_note': 'Note',
        'truncated': true,
        'segments': [
          {'id': 3, 'heading': 'Rent', 'text': 'Pay rent.'}
        ],
        'key_obligations': [
          {'party': 'You', 'obligation': 'Pay', 'deadline_if_any': null, 'segment_ids': [3]}
        ],
        'risky_or_unusual_clauses': [
          {'clause_excerpt_summary': 'Fee', 'why_flagged': 'Why', 'section_reference': 'S1', 'severity': 'high', 'segment_ids': [3]}
        ],
        'important_dates': [
          {'label': 'Start', 'date_text': 'Jan 1', 'iso_date': '2027-01-01', 'segment_ids': [3]}
        ],
      });
      expect(a.segments.single.id, 3);
      expect(a.riskyClauses.single.isHigh, isTrue);
      expect(a.importantDates.single.isoDate, DateTime(2027));
      expect(a.truncated, isTrue);
    });

    test('GeneratedDoc remembers where the server saved it', () {
      final g = GeneratedDoc.fromJson(const {'title': 'Draft', 'body_markdown': 'Body'}, documentId: 'doc-1');
      expect(g.documentId, 'doc-1');
      expect(GeneratedDoc.fromJson(const {'title': 'Draft'}).documentId, isNull);
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

    test('Lawyer reads both shapes of jurisdiction', () {
      final l = Lawyer.fromJson(const {
        'user_id': 'u',
        'practice_areas': ['Employment'],
        'licensed_jurisdictions': [
          {'country': 'United States', 'state': 'California'},
          'New York, United States',
        ],
        'profile': {'full_name': ' Test Lawyer '},
      });
      expect(l.name, 'Test Lawyer');
      expect(l.licensedJurisdictions, ['California, United States', 'New York, United States']);
    });
  });

  group('deadlines', () {
    Deadline due(int days, {String status = 'upcoming'}) {
      final now = DateTime.now();
      final date = DateTime(now.year, now.month, now.day + days);
      return Deadline.fromJson({
        'id': 'd',
        'matter_id': 'm',
        'title': 'T',
        'due_date': isoDate(date),
        'status': status,
      });
    }

    test('a date-only deadline stays on its calendar day', () {
      final d = Deadline.fromJson(const {'id': 'd', 'matter_id': 'm', 'title': 'T', 'due_date': '2027-03-09', 'status': 'upcoming'});
      expect(d.dueDate, DateTime(2027, 3, 9));
    });

    test('counts days left from the start of today', () {
      expect(due(0).daysLeft, 0);
      expect(due(0).dueToday, isTrue);
      expect(due(3).daysLeft, 3);
      expect(due(-2).daysLeft, -2);
    });

    test('due today is not yet overdue, but yesterday is', () {
      expect(due(0).overdue, isFalse);
      expect(due(-1).overdue, isTrue);
      expect(due(-1, status: 'completed').overdue, isFalse);
    });
  });

  group('reminders', () {
    testWidgets('nothing is scheduled while reminders are switched off', (tester) async {
      final calls = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('app.lexa/native'),
        (call) async {
          calls.add(call.method);
          return call.method == 'notifications.status' ? 'granted' : null;
        },
      );
      await Reminders(Repository(), () => false).reschedule();
      expect(calls, isEmpty);
    });
  });

  group('billing', () {
    test('reads plan and allowances', () {
      final b = BillingStatus.fromJson(const {
        'tier': 'free',
        'paymentsEnabled': true,
        'limits': {'chatMessages': 25, 'activeMatters': 1, 'generatedDocs': 3},
        'usage': {'chatMessages': 4, 'activeMatters': 1, 'generatedDocs': 0},
      });
      expect(b.isFree, isTrue);
      expect(b.chatLimit, 25);
      expect(b.chatUsed, 4);
    });

    test('treats a missing flag as payments on', () {
      expect(BillingStatus.fromJson(const {'tier': 'plus'}).paymentsEnabled, isTrue);
      expect(BillingStatus.fromJson(const {'tier': 'plus'}).tierLabel, 'Plus');
    });
  });

  group('answer sources', () {
    test('reads stored sources', () {
      final meta = AnswerMeta.fromJson(const {
        'sources': [
          {'url': 'https://example.gov/law', 'title': 'The law'},
          {'url': 'https://www.example.org/page'},
          {'title': 'no url is dropped'},
        ],
        'searchSuggestionsHtml': null,
      });
      expect(meta!.sources, hasLength(2));
      expect(meta.sources[0].label, 'The law');
      expect(meta.sources[1].label, 'example.org');
    });

    test('nothing useful stored means no sources', () {
      expect(AnswerMeta.fromJson(null), isNull);
      expect(AnswerMeta.fromJson(const {'refs': []}), isNull);
    });
  });
}
