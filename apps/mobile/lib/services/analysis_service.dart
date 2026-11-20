import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../api/client.dart';
import '../data/repository.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';

/// The result of reading a document.
class AnalysisResult {
  AnalysisResult({
    required this.documentId,
    required this.matterId,
    required this.title,
    required this.analysis,
  });

  final String? documentId;
  final String? matterId;
  final String title;
  final DocumentAnalysis analysis;
}

/// Sends a document for analysis through a background session on iOS, so reading
/// carries on (and the Dynamic Island keeps reporting) after someone leaves the
/// app. Files larger than a request body allows go through storage first.
class AnalysisService {
  AnalysisService(this._api, this._repo);

  final LexaApi _api;
  final Repository _repo;

  /// Hosted functions reject request bodies above roughly 4.5 MB.
  static const directUploadLimit = 4 * 1024 * 1024;
  static const maxFileBytes = 20 * 1024 * 1024;

  /// Long enough to start the Live Activity's progress honestly. Real time varies,
  /// and the activity settles the moment the answer arrives.
  static int estimateSeconds(int bytes) =>
      (25 + bytes / (1024 * 1024) * 5).clamp(25, 55).round();

  Future<AnalysisResult> analyze({
    required PickedFile file,
    String? title,
    String? matterId,
  }) async {
    if (file.size > maxFileBytes) {
      throw ApiException(
          "That file is over 20 MB. Try a smaller file or a clear photo of the key pages.");
    }
    final token = await _api.accessToken();
    if (token == null) {
      throw ApiException('Your session has expired. Please sign in again.');
    }
    final displayTitle = (title?.trim().isNotEmpty ?? false)
        ? title!.trim()
        : file.name.replaceFirst(RegExp(r'\.[^.]+$'), '');

    final directory = await getTemporaryDirectory();
    final bodyFile = File(
        '${directory.path}/lexa-analysis-${DateTime.now().microsecondsSinceEpoch}');
    final String contentType;

    if (file.size > directUploadLimit) {
      final String storagePath;
      try {
        storagePath = await _repo.uploadForAnalysis(
          localPath: file.path,
          filename: file.name,
          mimeType: file.mimeType,
        );
      } catch (_) {
        throw ApiException(
            'That file is too large to upload right now. Try one under 4 MB, or a clear photo of the key pages.');
      }
      contentType = 'application/json';
      await bodyFile.writeAsString(jsonEncode({
        'storagePath': storagePath,
        'filename': file.name,
        'mimeType': file.mimeType,
        'title': displayTitle,
        'matterId': ?matterId,
      }));
    } else {
      final boundary = 'lexa${DateTime.now().microsecondsSinceEpoch}';
      contentType = 'multipart/form-data; boundary=$boundary';
      final sink = bodyFile.openWrite();
      void field(String name, String value) {
        sink.write('--$boundary\r\n'
            'Content-Disposition: form-data; name="$name"\r\n\r\n'
            '$value\r\n');
      }

      field('title', displayTitle);
      if (matterId != null) field('matterId', matterId);
      sink.write('--$boundary\r\n'
          'Content-Disposition: form-data; name="file"; filename="${file.name.replaceAll('"', '')}"\r\n'
          'Content-Type: ${file.mimeType}\r\n\r\n');
      await sink.addStream(File(file.path).openRead());
      sink.write('\r\n--$boundary--\r\n');
      await sink.close();
    }

    final bridge = NativeBridge.instance;
    final finished = Completer<AnalysisFinished>();
    String? jobId;
    final pending = <AnalysisFinished>[];
    final subscription = bridge.analysisFinished.listen((event) {
      if (event.id == jobId) {
        if (!finished.isCompleted) finished.complete(event);
      } else if (jobId == null) {
        pending.add(event);
      }
    });

    try {
      jobId = await bridge.startAnalysis(
        url: _api.analyzeUrl.toString(),
        token: token,
        contentType: contentType,
        bodyPath: bodyFile.path,
        title: displayTitle,
        expectedSeconds: estimateSeconds(file.size),
      );
      if (jobId == null) {
        throw ApiException("This device can't read documents right now.");
      }
      for (final event in pending) {
        if (event.id == jobId && !finished.isCompleted) finished.complete(event);
      }
      // Server work is capped near a minute, so this only trips on lost networks.
      final event = await finished.future.timeout(const Duration(minutes: 4),
          onTimeout: () => AnalysisFinished(jobId!, 0, ''));
      return _parse(event, displayTitle);
    } finally {
      await subscription.cancel();
      await File(file.path).delete().catchError((Object _) => File(file.path));
    }
  }

  AnalysisResult _parse(AnalysisFinished event, String title) {
    Map<String, dynamic>? data;
    try {
      data = jsonDecode(event.body) as Map<String, dynamic>;
    } catch (_) {
      // Handled below, by status.
    }
    if (event.status != 200) {
      throw ApiException(
        (data?['error'] as String?) ??
            (event.status == 0
                ? "Lexa couldn't reach the server. Check your connection and try again."
                : "Lexa couldn't finish reading that document. Nothing was lost. Please try again."),
        upgrade: data?['upgrade'] == true,
        consentRequired: data?['consentRequired'] == true,
        status: event.status,
      );
    }
    final analysis = data?['analysis'];
    if (analysis is! Map<String, dynamic>) {
      throw ApiException(
          "Lexa couldn't finish reading that document. Nothing was lost. Please try again.");
    }
    return AnalysisResult(
      documentId: data?['documentId'] as String?,
      matterId: data?['matterId'] as String?,
      title: data?['title'] as String? ?? title,
      analysis: DocumentAnalysis.fromJson(analysis),
    );
  }
}
