import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config.dart';

/// Calls into the deployed Next.js API routes (Phase 12). AI keys stay
/// server-side; requests authenticate with the Supabase access token via
/// `Authorization: Bearer` (the web API's mobile transport). Server gate
/// errors arrive as {error, upgrade?} — surfaced as [ApiException].
class ApiException implements Exception {
  ApiException(this.message, {this.upgrade = false, this.status});
  final String message;
  final bool upgrade;
  final int? status;
  @override
  String toString() => message;
}

const _calmRetry =
    "Justice couldn't complete that request. Please try again in a moment.";

class LexmindApi {
  LexmindApi({http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  final http.Client _http;

  Map<String, String> _headers({bool json = true}) {
    final token =
        Supabase.instance.client.auth.currentSession?.accessToken;
    final bearer = token == null ? null : 'Bearer $token';
    return {
      if (json) 'Content-Type': 'application/json',
      'Authorization': ?bearer,
    };
  }

  Uri _uri(String path) => Uri.parse('${AppConfig.apiBase}$path');

  Never _throwFrom(int status, String body) {
    try {
      final data = jsonDecode(body) as Map<String, dynamic>;
      throw ApiException(
        (data['error'] as String?) ?? _calmRetry,
        upgrade: data['upgrade'] == true,
        status: status,
      );
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(_calmRetry, status: status);
    }
  }

  /// Streams assistant text deltas from POST /api/chat.
  Stream<String> chat({
    required String message,
    required List<Map<String, String>> history,
    String? matterId,
  }) async* {
    final request = http.Request('POST', _uri('/api/chat'))
      ..headers.addAll(_headers())
      ..body = jsonEncode({
        'message': message,
        'history': history,
        'matterId': ?matterId,
      });

    final response = await _http.send(request);
    if (response.statusCode != 200) {
      _throwFrom(
          response.statusCode, await response.stream.bytesToString());
    }
    yield* response.stream.transform(utf8.decoder);
  }

  /// Uploads a document for analysis (multipart, like the web uploader).
  Future<Map<String, dynamic>> analyzeDocument({
    required List<int> bytes,
    required String filename,
    String? matterId,
    String? title,
  }) async {
    final request =
        http.MultipartRequest('POST', _uri('/api/documents/analyze'))
          ..headers.addAll(_headers(json: false))
          ..files.add(
              http.MultipartFile.fromBytes('file', bytes, filename: filename))
          ..fields.addAll({
            'matterId': ?matterId,
            'title': ?title,
          });

    final response = await http.Response.fromStream(await _http.send(request));
    if (response.statusCode != 200) {
      _throwFrom(response.statusCode, response.body);
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Generates a document from a template + answers.
  Future<Map<String, dynamic>> generateDocument({
    required String template,
    required Map<String, String> answers,
    String? matterId,
  }) async {
    final response = await _http.post(
      _uri('/api/documents/generate'),
      headers: _headers(),
      body: jsonEncode({
        'template': template,
        'answers': answers,
        'matterId': ?matterId,
      }),
    );
    if (response.statusCode != 200) {
      _throwFrom(response.statusCode, response.body);
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
