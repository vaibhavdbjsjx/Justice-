/// Row models mirroring the database schema. Parsing is tolerant, because jsonb
/// fields can be loose, and these classes hold data only: writes go through
/// Repository or the API client.
library;

String _s(dynamic v, [String fallback = '']) => v is String ? v : fallback;

List<String> _strings(dynamic v) {
  if (v is! List) return const [];
  return v.flatMap((item) {
    if (item is String) return [item];
    if (item is Map) {
      final country = item['country'];
      final state = item['state'];
      if (country is String) {
        return [state is String && state.isNotEmpty ? '$state, $country' : country];
      }
    }
    return const <String>[];
  }).toList();
}

extension _FlatMap<T> on List<T> {
  Iterable<R> flatMap<R>(Iterable<R> Function(T) f) => expand(f);
}

/// Parses a date-only column in local time, so a deadline doesn't shift a day
/// for anyone west of UTC.
DateTime? _localDate(dynamic v) {
  if (v is! String || v.isEmpty) return null;
  final parts = v.split('T').first.split('-');
  if (parts.length != 3) return DateTime.tryParse(v);
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}

String isoDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

class Profile {
  Profile({
    required this.userId,
    required this.role,
    this.fullName,
    this.country,
    this.state,
    required this.language,
    required this.onboardingCompleted,
    required this.hasConsentColumns,
    this.aiConsentAt,
    this.aiConsentProvider,
  });

  final String userId;
  final String role;
  final String? fullName;
  final String? country;
  final String? state;
  final String language;
  final bool onboardingCompleted;

  /// False until the launch migration has run on the database.
  final bool hasConsentColumns;
  final DateTime? aiConsentAt;
  final String? aiConsentProvider;

  bool get isLawyer => role == 'lawyer';

  String get firstName {
    final name = fullName?.trim() ?? '';
    return name.isEmpty ? '' : name.split(RegExp(r'\s+')).first;
  }

  String get jurisdictionLabel {
    final c = country;
    if (c == null || c.isEmpty) return 'Jurisdiction not set';
    final s = state;
    return s != null && s.isNotEmpty ? '$s, $c' : c;
  }

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        userId: _s(json['user_id']),
        role: _s(json['role'], 'consumer'),
        fullName: json['full_name'] as String?,
        country: json['country'] as String?,
        state: json['state_province'] as String?,
        language: _s(json['preferred_language'], 'en'),
        onboardingCompleted: json['onboarding_completed'] == true,
        hasConsentColumns: json.containsKey('ai_consent_at'),
        aiConsentAt: DateTime.tryParse(_s(json['ai_consent_at'])),
        aiConsentProvider: json['ai_consent_provider'] as String?,
      );
}

class Matter {
  Matter({
    required this.id,
    required this.title,
    required this.category,
    required this.status,
    this.jurisdictionCountry,
    this.jurisdictionState,
    required this.createdAt,
    this.userId,
  });

  final String id;
  final String title;
  final String category;
  final String status;
  final String? jurisdictionCountry;
  final String? jurisdictionState;
  final DateTime createdAt;
  final String? userId;

  factory Matter.fromJson(Map<String, dynamic> json) => Matter(
        id: _s(json['id']),
        title: _s(json['title'], 'Matter'),
        category: _s(json['category'], 'other'),
        status: _s(json['status'], 'active'),
        jurisdictionCountry: json['jurisdiction_country'] as String?,
        jurisdictionState: json['jurisdiction_state'] as String?,
        createdAt: DateTime.tryParse(_s(json['created_at'])) ?? DateTime.now(),
        userId: json['user_id'] as String?,
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
    required this.matterId,
    required this.title,
    this.dueDate,
    required this.status,
    this.matterTitle,
  });

  final String id;
  final String matterId;
  final String title;
  final DateTime? dueDate;
  final String status;
  final String? matterTitle;

  bool get isDone => status == 'completed';

  /// The last moment of the due date, in local time.
  DateTime? get dueAt => dueDate == null
      ? null
      : DateTime(dueDate!.year, dueDate!.month, dueDate!.day, 23, 59, 59);

  bool get overdue => !isDone && dueAt != null && dueAt!.isBefore(DateTime.now());

  bool get dueToday {
    final d = dueDate;
    if (d == null) return false;
    final now = DateTime.now();
    return d.year == now.year && d.month == now.month && d.day == now.day;
  }

  /// Whole calendar days from today. Negative when past.
  int? get daysLeft {
    final d = dueDate;
    if (d == null) return null;
    final now = DateTime.now();
    return d.difference(DateTime(now.year, now.month, now.day)).inDays;
  }

  factory Deadline.fromJson(Map<String, dynamic> json) {
    final matter = json['matters'];
    return Deadline(
      id: _s(json['id']),
      matterId: _s(json['matter_id']),
      title: _s(json['title']),
      dueDate: _localDate(json['due_date']),
      status: _s(json['status'], 'upcoming'),
      matterTitle: matter is Map ? matter['title'] as String? : null,
    );
  }
}

class AnswerSource {
  AnswerSource({required this.url, this.title});
  final String url;
  final String? title;

  String get label {
    final t = title;
    if (t != null && t.isNotEmpty) return t;
    return Uri.tryParse(url)?.host.replaceFirst('www.', '') ?? url;
  }
}

/// Where a grounded answer came from.
class AnswerMeta {
  AnswerMeta({required this.sources, this.searchSuggestionsHtml});
  final List<AnswerSource> sources;
  final String? searchSuggestionsHtml;

  bool get isEmpty => sources.isEmpty && (searchSuggestionsHtml ?? '').isEmpty;

  static AnswerMeta? fromJson(dynamic json) {
    if (json is! Map) return null;
    final raw = json['sources'];
    final html = json['searchSuggestionsHtml'];
    final sources = raw is List
        ? raw
            .whereType<Map<dynamic, dynamic>>()
            .where((s) => s['url'] is String)
            .map((s) => AnswerSource(
                url: s['url'] as String, title: s['title'] as String?))
            .toList()
        : <AnswerSource>[];
    final meta =
        AnswerMeta(sources: sources, searchSuggestionsHtml: html as String?);
    return meta.isEmpty ? null : meta;
  }
}

class ChatMessageRow {
  ChatMessageRow({required this.role, required this.content, this.meta});
  final String role;
  final String content;
  final AnswerMeta? meta;

  factory ChatMessageRow.fromJson(Map<String, dynamic> json) => ChatMessageRow(
        role: _s(json['role']),
        content: _s(json['content']),
        meta: AnswerMeta.fromJson(json['citations']),
      );
}

class DocumentItem {
  DocumentItem({
    required this.id,
    required this.matterId,
    required this.title,
    required this.type,
    required this.createdAt,
    this.annotations,
    this.matterTitle,
  });

  final String id;
  final String matterId;
  final String title;
  final String type;
  final DateTime createdAt;
  final Map<String, dynamic>? annotations;
  final String? matterTitle;

  factory DocumentItem.fromJson(Map<String, dynamic> json) {
    final matter = json['matters'];
    return DocumentItem(
      id: _s(json['id']),
      matterId: _s(json['matter_id']),
      title: _s(json['title'], 'Document'),
      type: _s(json['type'], 'uploaded'),
      createdAt: DateTime.tryParse(_s(json['created_at'])) ?? DateTime.now(),
      annotations: json['ai_annotations'] is Map<String, dynamic>
          ? json['ai_annotations'] as Map<String, dynamic>
          : null,
      matterTitle: matter is Map ? matter['title'] as String? : null,
    );
  }

  String? get kind => annotations?['kind'] as String?;
  bool get isAnalysis => type == 'uploaded' && annotations != null;
  bool get isGeneratedDraft => type == 'generated' && annotations != null;

  /// A one-line sense of what's inside, for lists.
  String get summaryLine {
    if (isAnalysis) {
      final flagged = annotations?['risky_or_unusual_clauses'];
      final count = flagged is List ? flagged.length : 0;
      return count == 0
          ? 'Nothing flagged'
          : '$count clause${count == 1 ? '' : 's'} flagged';
    }
    return 'Draft to review';
  }
}

class DocumentSegment {
  DocumentSegment(this.id, this.heading, this.text);
  final int id;
  final String? heading;
  final String text;
}

class Obligation {
  Obligation(this.party, this.obligation, this.deadline, this.segmentIds);
  final String party;
  final String obligation;
  final String? deadline;
  final List<int> segmentIds;
}

class RiskyClause {
  RiskyClause(this.summary, this.why, this.section, this.severity, this.segmentIds);
  final String summary;
  final String why;
  final String? section;
  final String severity;
  final List<int> segmentIds;
  bool get isHigh => severity == 'high';
}

class ImportantDate {
  ImportantDate(this.label, this.dateText, this.isoDate, this.segmentIds);
  final String label;
  final String dateText;
  final DateTime? isoDate;
  final List<int> segmentIds;
}

List<int> _ints(dynamic v) =>
    v is List ? v.whereType<num>().map((n) => n.toInt()).toList() : const [];

/// The structured reading of a document.
class DocumentAnalysis {
  DocumentAnalysis({
    required this.documentType,
    required this.summary,
    required this.jurisdictionNote,
    required this.truncated,
    required this.segments,
    required this.obligations,
    required this.riskyClauses,
    required this.importantDates,
  });

  final String documentType;
  final String summary;
  final String? jurisdictionNote;
  final bool truncated;
  final List<DocumentSegment> segments;
  final List<Obligation> obligations;
  final List<RiskyClause> riskyClauses;
  final List<ImportantDate> importantDates;

  static List<Map<String, dynamic>> _maps(dynamic v) =>
      v is List ? v.whereType<Map<String, dynamic>>().toList() : const [];

  factory DocumentAnalysis.fromJson(Map<String, dynamic> json) =>
      DocumentAnalysis(
        documentType: _s(json['document_type'], 'Document'),
        summary: _s(json['plain_language_summary']),
        jurisdictionNote: json['jurisdiction_note'] as String?,
        truncated: json['truncated'] == true,
        segments: _maps(json['segments'])
            .map((s) => DocumentSegment(
                  (s['id'] as num?)?.toInt() ?? 0,
                  s['heading'] as String?,
                  _s(s['text']),
                ))
            .toList(),
        obligations: _maps(json['key_obligations'])
            .map((o) => Obligation(
                  _s(o['party']),
                  _s(o['obligation']),
                  o['deadline_if_any'] as String?,
                  _ints(o['segment_ids']),
                ))
            .toList(),
        riskyClauses: _maps(json['risky_or_unusual_clauses'])
            .map((r) => RiskyClause(
                  _s(r['clause_excerpt_summary']),
                  _s(r['why_flagged']),
                  r['section_reference'] as String?,
                  _s(r['severity'], 'caution'),
                  _ints(r['segment_ids']),
                ))
            .toList(),
        importantDates: _maps(json['important_dates'])
            .map((d) => ImportantDate(
                  _s(d['label']),
                  _s(d['date_text']),
                  _localDate(d['iso_date']),
                  _ints(d['segment_ids']),
                ))
            .toList(),
      );
}

/// A generated draft.
class GeneratedDoc {
  GeneratedDoc({
    required this.title,
    required this.bodyMarkdown,
    required this.placeholders,
    required this.reviewFlags,
    this.jurisdictionCaveat,
    this.documentId,
  });

  final String title;
  final String bodyMarkdown;
  final List<String> placeholders;
  final List<String> reviewFlags;
  final String? jurisdictionCaveat;

  /// Where the server saved it, when it did.
  final String? documentId;

  factory GeneratedDoc.fromJson(Map<String, dynamic> json, {String? documentId}) =>
      GeneratedDoc(
        title: _s(json['title'], 'Draft'),
        bodyMarkdown: _s(json['body_markdown']),
        placeholders: _strings(json['placeholders']),
        reviewFlags: _strings(json['review_flags']),
        jurisdictionCaveat: json['jurisdiction_caveat'] as String?,
        documentId: documentId,
      );
}

class TemplateField {
  TemplateField(this.name, this.label, this.kind, this.required, this.hint, this.placeholder);
  final String name;
  final String label;
  final String kind;
  final bool required;
  final String? hint;
  final String? placeholder;
}

class DocTemplate {
  DocTemplate(this.slug, this.name, this.description, this.fields);
  final String slug;
  final String name;
  final String description;
  final List<TemplateField> fields;

  factory DocTemplate.fromJson(Map<String, dynamic> json) => DocTemplate(
        _s(json['slug']),
        _s(json['name']),
        _s(json['description']),
        (json['fields'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map((f) => TemplateField(
                  _s(f['name']),
                  _s(f['label'], _s(f['name'])),
                  _s(f['kind'], 'text'),
                  f['required'] == true,
                  f['hint'] as String?,
                  f['placeholder'] as String?,
                ))
            .toList(),
      );
}

class Lawyer {
  Lawyer({
    required this.userId,
    required this.name,
    required this.practiceAreas,
    required this.licensedJurisdictions,
    this.rateRange,
    this.rating,
    this.bio,
  });

  final String userId;
  final String name;
  final List<String> practiceAreas;
  final List<String> licensedJurisdictions;
  final String? rateRange;
  final double? rating;
  final String? bio;

  factory Lawyer.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'];
    final name = profile is Map ? (profile['full_name'] as String?)?.trim() : null;
    return Lawyer(
      userId: _s(json['user_id']),
      name: name == null || name.isEmpty ? 'Lexa lawyer' : name,
      practiceAreas: _strings(json['practice_areas']),
      licensedJurisdictions: _strings(json['licensed_jurisdictions']),
      rateRange: json['rate_range'] as String?,
      rating: (json['rating_avg'] as num?)?.toDouble(),
      bio: json['bio'] as String?,
    );
  }
}

class ClientMessage {
  ClientMessage(this.senderId, this.body, this.createdAt);
  final String senderId;
  final String body;
  final DateTime createdAt;

  factory ClientMessage.fromJson(Map<String, dynamic> json) => ClientMessage(
        _s(json['sender_id']),
        _s(json['body']),
        DateTime.tryParse(_s(json['created_at'])) ?? DateTime.now(),
      );
}

/// A matter a client has shared with a lawyer.
class ClientLink {
  ClientLink({
    required this.matter,
    required this.clientId,
    required this.clientName,
    required this.status,
  });

  final Matter matter;
  final String clientId;
  final String clientName;
  final String status;

  factory ClientLink.fromJson(Map<String, dynamic> json) {
    final client = json['client'];
    final name = client is Map ? (client['full_name'] as String?)?.trim() : null;
    return ClientLink(
      matter: Matter.fromJson((json['matters'] as Map).cast<String, dynamic>()),
      clientId: _s(json['client_id']),
      clientName: name == null || name.isEmpty ? 'Client' : name,
      status: _s(json['status'], 'invited'),
    );
  }
}

class BillingStatus {
  BillingStatus({
    required this.tier,
    this.source,
    this.renewsAt,
    required this.paymentsEnabled,
    required this.chatLimit,
    required this.chatUsed,
    required this.mattersLimit,
    required this.mattersUsed,
    required this.draftsLimit,
    required this.draftsUsed,
  });

  final String tier;
  final String? source;
  final DateTime? renewsAt;
  final bool paymentsEnabled;
  final int chatLimit;
  final int chatUsed;
  final int mattersLimit;
  final int mattersUsed;
  final int draftsLimit;
  final int draftsUsed;

  bool get isFree => tier == 'free';

  String get tierLabel => switch (tier) {
        'plus' => 'Plus',
        'professional' => 'Professional',
        _ => 'Free',
      };

  factory BillingStatus.fromJson(Map<String, dynamic> json) {
    final limits = (json['limits'] as Map?) ?? const {};
    final usage = (json['usage'] as Map?) ?? const {};
    int n(Map<dynamic, dynamic> m, String k) => (m[k] as num?)?.toInt() ?? 0;
    return BillingStatus(
      tier: _s(json['tier'], 'free'),
      source: json['source'] as String?,
      renewsAt: DateTime.tryParse(_s(json['renewsAt'])),
      paymentsEnabled: json['paymentsEnabled'] != false,
      chatLimit: n(limits, 'chatMessages'),
      chatUsed: n(usage, 'chatMessages'),
      mattersLimit: n(limits, 'activeMatters'),
      mattersUsed: n(usage, 'activeMatters'),
      draftsLimit: n(limits, 'generatedDocs'),
      draftsUsed: n(usage, 'generatedDocs'),
    );
  }
}

const _freeTierNotice =
    "On the free tier Google may use what's sent to improve its products, and people at Google may read it. "
    'Please leave out sensitive details such as ID numbers, bank details, or health information.';

/// Public settings from the server, with safe values until they arrive.
class RemoteConfig {
  RemoteConfig({
    this.aiProvider = 'gemini',
    this.aiLabel = 'Google (Gemini)',
    this.webSearch = true,
    this.aiReviewNotice = _freeTierNotice,
    this.paymentsEnabled = true,
    this.plusProduct = 'com.vaibhavsg.lexa.plus.monthly',
    this.professionalProduct = 'com.vaibhavsg.lexa.professional.monthly',
    this.plusYearlyProduct = 'com.vaibhavsg.lexa.plus.yearly',
    this.professionalYearlyProduct = 'com.vaibhavsg.lexa.professional.yearly',
    this.plusFeatures = const [
      'Unlimited assistant conversations',
      'Unlimited matters, organized with deadlines',
      'Unlimited drafts from every template',
      'Document Intelligence for any legal document',
    ],
    this.professionalFeatures = const [
      'Everything in Plus',
      'Research accelerator with citation discipline',
      'Drafting assistant for first drafts and redlines',
      'Client and case management with secure messaging',
    ],
    required this.termsUrl,
    required this.privacyUrl,
    required this.disclaimerUrl,
    required this.supportUrl,
    this.supportEmail = 'support@lexa.app',
  });

  final String aiProvider;
  final String aiLabel;
  final bool webSearch;

  /// Shown with the AI permission when the provider may review what's sent.
  final String? aiReviewNotice;
  final bool paymentsEnabled;
  final String plusProduct;
  final String professionalProduct;
  final String plusYearlyProduct;
  final String professionalYearlyProduct;
  final List<String> plusFeatures;
  final List<String> professionalFeatures;
  final String termsUrl;
  final String privacyUrl;
  final String disclaimerUrl;
  final String supportUrl;
  final String supportEmail;

  factory RemoteConfig.defaults(String base) => RemoteConfig(
        termsUrl: '$base/terms',
        privacyUrl: '$base/privacy',
        disclaimerUrl: '$base/disclaimer',
        supportUrl: '$base/contact',
      );

  factory RemoteConfig.fromJson(Map<String, dynamic> json, String base) {
    final ai = (json['ai'] as Map?) ?? const {};
    final products = (json['products'] as Map?) ?? const {};
    final legal = (json['legal'] as Map?) ?? const {};
    final plans = (json['plans'] as Map?) ?? const {};
    final features = (plans['features'] as Map?) ?? const {};
    final fallback = RemoteConfig.defaults(base);
    return RemoteConfig(
      aiProvider: ai['provider'] as String? ?? fallback.aiProvider,
      aiLabel: ai['label'] as String? ?? fallback.aiLabel,
      webSearch: ai['webSearch'] != false,
      aiReviewNotice: ai.containsKey('reviewNotice') ? ai['reviewNotice'] as String? : fallback.aiReviewNotice,
      paymentsEnabled: json['paymentsEnabled'] != false,
      plusProduct: products['plus'] as String? ?? fallback.plusProduct,
      professionalProduct:
          products['professional'] as String? ?? fallback.professionalProduct,
      plusYearlyProduct: products['plusYearly'] as String? ?? fallback.plusYearlyProduct,
      professionalYearlyProduct:
          products['professionalYearly'] as String? ?? fallback.professionalYearlyProduct,
      plusFeatures: _strings(features['plus']).isEmpty
          ? fallback.plusFeatures
          : _strings(features['plus']),
      professionalFeatures: _strings(features['professional']).isEmpty
          ? fallback.professionalFeatures
          : _strings(features['professional']),
      termsUrl: legal['terms'] as String? ?? fallback.termsUrl,
      privacyUrl: legal['privacy'] as String? ?? fallback.privacyUrl,
      disclaimerUrl: legal['disclaimer'] as String? ?? fallback.disclaimerUrl,
      supportUrl: legal['support'] as String? ?? fallback.supportUrl,
      supportEmail: json['supportEmail'] as String? ?? fallback.supportEmail,
    );
  }
}
