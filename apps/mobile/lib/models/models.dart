/// Row models mirroring the Part 7 schema — tolerant fromJson (jsonb fields
/// may be loose), display helpers only. Mutations go through Supabase (RLS)
/// or the API routes; these classes never write.
library;

String _s(dynamic v, [String fallback = '']) =>
    v is String ? v : fallback;

class Matter {
  Matter({
    required this.id,
    required this.title,
    required this.category,
    required this.status,
    this.jurisdictionCountry,
    this.jurisdictionState,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String category;
  final String status;
  final String? jurisdictionCountry;
  final String? jurisdictionState;
  final DateTime createdAt;

  factory Matter.fromJson(Map<String, dynamic> json) => Matter(
        id: _s(json['id']),
        title: _s(json['title'], 'Matter'),
        category: _s(json['category'], 'other'),
        status: _s(json['status'], 'active'),
        jurisdictionCountry: json['jurisdiction_country'] as String?,
        jurisdictionState: json['jurisdiction_state'] as String?,
        createdAt:
            DateTime.tryParse(_s(json['created_at'])) ?? DateTime.now(),
      );

  String get jurisdictionLabel {
    if (jurisdictionCountry == null) return 'Jurisdiction not set';
    return jurisdictionState != null
        ? '$jurisdictionState, $jurisdictionCountry'
        : jurisdictionCountry!;
  }
}

class Deadline {
  Deadline({
    required this.id,
    required this.title,
    this.dueDate,
    required this.status,
  });

  final String id;
  final String title;
  final DateTime? dueDate;
  final String status;

  factory Deadline.fromJson(Map<String, dynamic> json) => Deadline(
        id: _s(json['id']),
        title: _s(json['title']),
        dueDate: json['due_date'] != null
            ? DateTime.tryParse(_s(json['due_date']))
            : null,
        status: _s(json['status'], 'upcoming'),
      );

  bool get overdue =>
      status == 'upcoming' &&
      dueDate != null &&
      dueDate!.isBefore(DateTime.now());
}

class ChatMessageRow {
  ChatMessageRow({required this.role, required this.content});
  final String role;
  final String content;

  factory ChatMessageRow.fromJson(Map<String, dynamic> json) =>
      ChatMessageRow(role: _s(json['role']), content: _s(json['content']));
}

class DocumentItem {
  DocumentItem({
    required this.id,
    required this.title,
    required this.type,
    required this.createdAt,
    this.annotations,
  });

  final String id;
  final String title;
  final String type; // uploaded | generated
  final DateTime createdAt;
  final Map<String, dynamic>? annotations;

  factory DocumentItem.fromJson(Map<String, dynamic> json) => DocumentItem(
        id: _s(json['id']),
        title: _s(json['title'], 'Document'),
        type: _s(json['type'], 'uploaded'),
        createdAt:
            DateTime.tryParse(_s(json['created_at'])) ?? DateTime.now(),
        annotations: json['ai_annotations'] is Map<String, dynamic>
            ? json['ai_annotations'] as Map<String, dynamic>
            : null,
      );

  String? get kind => annotations?['kind'] as String?;
  bool get isAnalysis => type == 'uploaded' && annotations != null;
  bool get isGeneratedDraft =>
      type == 'generated' && (kind == 'generated' || kind == 'lawyer_draft');
}

/// Structured analysis (Part 8 shape) — Document Intelligence detail.
class DocumentAnalysis {
  DocumentAnalysis({
    required this.documentType,
    required this.summary,
    required this.obligations,
    required this.riskyClauses,
    required this.importantDates,
  });

  final String documentType;
  final String summary;
  final List<Map<String, dynamic>> obligations;
  final List<Map<String, dynamic>> riskyClauses;
  final List<String> importantDates;

  static List<Map<String, dynamic>> _maps(dynamic v) => v is List
      ? v.whereType<Map<String, dynamic>>().toList()
      : const [];

  factory DocumentAnalysis.fromJson(Map<String, dynamic> json) =>
      DocumentAnalysis(
        documentType: _s(json['document_type'], 'Document'),
        summary: _s(json['plain_language_summary']),
        obligations: _maps(json['key_obligations']),
        riskyClauses: _maps(json['risky_or_unusual_clauses']),
        importantDates: json['important_dates'] is List
            ? (json['important_dates'] as List).whereType<String>().toList()
            : const [],
      );
}

/// A generated draft (Phase 6 shape).
class GeneratedDoc {
  GeneratedDoc({
    required this.title,
    required this.bodyMarkdown,
    required this.placeholders,
    required this.reviewFlags,
    this.jurisdictionCaveat,
  });

  final String title;
  final String bodyMarkdown;
  final List<String> placeholders;
  final List<String> reviewFlags;
  final String? jurisdictionCaveat;

  static List<String> _strings(dynamic v) =>
      v is List ? v.whereType<String>().toList() : const [];

  factory GeneratedDoc.fromJson(Map<String, dynamic> json) => GeneratedDoc(
        title: _s(json['title'], 'Draft'),
        bodyMarkdown: _s(json['body_markdown']),
        placeholders: _strings(json['placeholders']),
        reviewFlags: _strings(json['review_flags']),
        jurisdictionCaveat: json['jurisdiction_caveat'] as String?,
      );
}
