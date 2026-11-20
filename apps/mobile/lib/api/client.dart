import 'dart:async';
import 'dart:convert';
import 'dart:io' show HttpClient, IOException;
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config.dart';
import '../models/models.dart';

/// A failure from the Lexa API, always with copy that's safe to show. Plan limits
/// and missing AI permission arrive as flags so screens can respond helpfully.
class ApiException implements Exception {
  ApiException(
    this.message, {
    this.upgrade = false,
    this.consentRequired = false,
    this.status,
  });

  final String message;
  final bool upgrade;
  final bool consentRequired;
  final int? status;

  @override
  String toString() => message;
}

/// An HTTP client that never reuses a connection idle for more than a few
/// seconds. Servers commonly close idle connections after about five seconds,
/// while Dart keeps them for fifteen. A request sent on a connection the server
/// has just closed fails before the server even sees it.
http.Client lexaHttpClient() =>
    IOClient(HttpClient()..idleTimeout = const Duration(seconds: 3));

const _calmRetry =
    "Lexa couldn't complete that request. Please try again in a moment.";
const _offline =
    "Lexa couldn't reach the server. Check your connection and try again.";

/// One piece of a streamed answer.
sealed class ChatEvent {}

class ChatDelta extends ChatEvent {
  ChatDelta(this.text);
  final String text;
}

class ChatSources extends ChatEvent {
  ChatSources(this.meta);
  final AnswerMeta meta;
}

/// Separates a grounded answer's text from the sources that follow it.
const _metaSeparator = '\u001e';

/// Calls the Next.js API routes. AI keys stay on the server; requests carry the
/// Supabase access token.
class LexaApi {
  LexaApi({http.Client? httpClient}) : _http = httpClient ?? lexaHttpClient();

  final http.Client _http;

  static const _shortTimeout = Duration(seconds: 20);
  static const _aiTimeout = Duration(seconds: 90);

  Uri _uri(String path) => Uri.parse('${AppConfig.apiBase}$path');

  Future<String?> _token() async {
    final auth = Supabase.instance.client.auth;
    final session = auth.currentSession;
    if (session == null) return null;
    if (session.isExpired) {
      try {
        final refreshed = await auth.refreshSession();
        return refreshed.session?.accessToken;
      } catch (_) {
        return session.accessToken;
      }
    }
    return session.accessToken;
  }

  /// The current access token, for requests made from native code.
  Future<String?> accessToken() => _token();

  Future<Map<String, String>> _headers({bool json = true}) async {
    final token = await _token();
    return {
      if (json) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Map<String, dynamic> _decode(String body) {
    try {
      return jsonDecode(body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(_calmRetry);
    }
  }

  Never _throwFrom(int status, String body) {
    Map<String, dynamic>? data;
    try {
      data = jsonDecode(body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(_calmRetry, status: status);
    }
    throw ApiException(
      (data['error'] as String?) ?? _calmRetry,
      upgrade: data['upgrade'] == true,
      consentRequired: data['consentRequired'] == true,
      status: status,
    );
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    Map<String, dynamic>? body,
    Duration timeout = _shortTimeout,
  }) async {
    final http.Response response;
    try {
      response = await _http
          .post(_uri(path),
              headers: await _headers(),
              body: body == null ? null : jsonEncode(body))
          .timeout(timeout);
    } on TimeoutException {
      throw ApiException(_calmRetry);
    } on http.ClientException {
      throw ApiException(_offline);
    } on IOException {
      throw ApiException(_offline);
    }
    if (response.statusCode != 200) _throwFrom(response.statusCode, response.body);
    return _decode(response.body);
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final http.Response response;
    try {
      response = await _http
          .get(_uri(path), headers: await _headers(json: false))
          .timeout(_shortTimeout);
    } on TimeoutException {
      throw ApiException(_calmRetry);
    } on http.ClientException {
      throw ApiException(_offline);
    } on IOException {
      throw ApiException(_offline);
    }
    if (response.statusCode != 200) _throwFrom(response.statusCode, response.body);
    return _decode(response.body);
  }

  // ---- Assistant -----------------------------------------------------------

  /// Streams an answer from POST /api/chat. Text arrives as it's written, and a
  /// grounded answer ends with the sources it drew on.
  Stream<ChatEvent> chat({
    required String message,
    required List<Map<String, String>> history,
    String? matterId,
    String audience = 'consumer',
  }) async* {
    final request = http.Request('POST', _uri('/api/chat'))
      ..headers.addAll(await _headers())
      ..body = jsonEncode({
        'message': message,
        'history': history,
        'audience': audience,
        'matterId': ?matterId,
      });

    final http.StreamedResponse response;
    try {
      response = await _http.send(request).timeout(_aiTimeout);
    } on TimeoutException {
      throw ApiException(_calmRetry);
    } on http.ClientException {
      throw ApiException(_offline);
    } on IOException {
      throw ApiException(_offline);
    }
    if (response.statusCode != 200) {
      _throwFrom(response.statusCode, await response.stream.bytesToString());
    }

    String? metaBuffer;
    await for (final chunk
        in response.stream.transform(utf8.decoder).timeout(_aiTimeout)) {
      if (metaBuffer != null) {
        metaBuffer += chunk;
        continue;
      }
      final split = chunk.indexOf(_metaSeparator);
      if (split == -1) {
        yield ChatDelta(chunk);
      } else {
        if (split > 0) yield ChatDelta(chunk.substring(0, split));
        metaBuffer = chunk.substring(split + 1);
      }
    }
    if (metaBuffer != null) {
      try {
        final meta = AnswerMeta.fromJson(jsonDecode(metaBuffer));
        if (meta != null) yield ChatSources(meta);
      } catch (_) {
        // The answer itself arrived. Losing the source list isn't worth an error.
      }
    }
  }

  // ---- Documents -----------------------------------------------------------

  Uri get analyzeUrl => _uri('/api/documents/analyze');

  Future<GeneratedDoc> generateDocument({
    required String template,
    required Map<String, String> answers,
    String? matterId,
  }) async {
    final data = await _post(
      '/api/documents/generate',
      body: {
        'template': template,
        'answers': answers,
        'matterId': ?matterId,
      },
      timeout: _aiTimeout,
    );
    return GeneratedDoc.fromJson(
      (data['generated'] as Map).cast<String, dynamic>(),
      documentId: data['documentId'] as String?,
    );
  }

  Future<List<DocTemplate>> templates() async {
    final data = await _get('/api/documents/templates');
    return (data['templates'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(DocTemplate.fromJson)
        .toList();
  }

  /// Returns a PDF or Word file carrying the draft notice and review block.
  Future<Uint8List> exportDocument({
    required String title,
    required String bodyMarkdown,
    required String format,
  }) async {
    final http.Response response;
    try {
      response = await _http
          .post(
            _uri('/api/documents/export'),
            headers: await _headers(),
            body: jsonEncode(
                {'title': title, 'body_markdown': bodyMarkdown, 'format': format}),
          )
          .timeout(_aiTimeout);
    } on TimeoutException {
      throw ApiException(_calmRetry);
    } on http.ClientException {
      throw ApiException(_offline);
    } on IOException {
      throw ApiException(_offline);
    }
    if (response.statusCode != 200) _throwFrom(response.statusCode, response.body);
    return response.bodyBytes;
  }

  // ---- Lawyer tools --------------------------------------------------------

  Future<GeneratedDoc> draftForLawyer({
    required String docType,
    required String instructions,
    String? matterId,
  }) async {
    final data = await _post(
      '/api/drafting/draft',
      body: {
        'docType': docType,
        'instructions': instructions,
        'matterId': ?matterId,
      },
      timeout: _aiTimeout,
    );
    final generated = data['generated'] ?? data['document'] ?? data;
    return GeneratedDoc.fromJson(
      (generated as Map).cast<String, dynamic>(),
      documentId: data['documentId'] as String?,
    );
  }

  // ---- Account -------------------------------------------------------------

  Future<RemoteConfig> appConfig() async {
    final response = await _http.get(_uri('/api/app-config')).timeout(_shortTimeout);
    if (response.statusCode != 200) {
      throw ApiException(_calmRetry, status: response.statusCode);
    }
    return RemoteConfig.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
      AppConfig.apiBase,
    );
  }

  Future<BillingStatus> billingStatus() async =>
      BillingStatus.fromJson(await _get('/api/billing/status'));

  Future<BillingStatus> syncAppleTransactions(List<String> transactions) async {
    final data = await _post(
      '/api/billing/apple/sync',
      body: {'transactions': transactions},
      timeout: const Duration(seconds: 30),
    );
    return BillingStatus.fromJson(data);
  }

  Future<void> grantAiConsent() => _post('/api/consent');

  Future<void> withdrawAiConsent() async {
    final http.Response response;
    try {
      response = await _http
          .delete(_uri('/api/consent'), headers: await _headers())
          .timeout(_shortTimeout);
    } on TimeoutException {
      throw ApiException(_calmRetry);
    } on http.ClientException {
      throw ApiException(_offline);
    } on IOException {
      throw ApiException(_offline);
    }
    if (response.statusCode != 200) _throwFrom(response.statusCode, response.body);
  }

  Future<void> report({
    required String kind,
    required String reason,
    String? details,
    String? excerpt,
    String? referenceId,
  }) =>
      _post('/api/reports', body: {
        'kind': kind,
        'reason': reason,
        'details': ?details,
        'excerpt': ?excerpt,
        'referenceId': ?referenceId,
      });

  Future<void> requestPasswordReset(String email) =>
      _post('/api/auth/request-reset', body: {'email': email});

  /// Returns whether an App Store subscription outlives the account, so the app
  /// can point the person to Apple's subscription settings.
  Future<bool> deleteAccount() async {
    final data = await _post('/api/account/delete');
    return data['appleSubscription'] == true;
  }

  Future<Matter> createMatter({
    required String title,
    required String category,
    String? country,
    String? state,
  }) async {
    final data = await _post('/api/matters', body: {
      'title': title,
      'category': category,
      'jurisdictionCountry': ?country,
      'jurisdictionState': ?state,
    });
    return Matter.fromJson((data['matter'] as Map).cast<String, dynamic>());
  }
}
