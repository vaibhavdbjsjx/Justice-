import 'dart:async';
import 'package:flutter/services.dart';

/// A file brought in through a system picker, copied to temporary storage.
class PickedFile {
  PickedFile({
    required this.path,
    required this.name,
    required this.mimeType,
    required this.size,
  });

  final String path;
  final String name;
  final String mimeType;
  final int size;

  static PickedFile? fromMap(Map<dynamic, dynamic>? map) {
    if (map == null) return null;
    return PickedFile(
      path: map['path'] as String,
      name: map['name'] as String,
      mimeType: map['mimeType'] as String,
      size: (map['size'] as num?)?.toInt() ?? 0,
    );
  }
}

class StoreProduct {
  StoreProduct({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    this.period,
  });

  final String id;
  final String title;
  final String description;
  final String price;
  final String? period;
}

class StorePurchaseResult {
  StorePurchaseResult(this.status, this.transaction);

  /// purchased, cancelled, pending, unverified, or unavailable.
  final String status;
  final String? transaction;
}

class AnalysisFinished {
  AnalysisFinished(this.id, this.status, this.body);
  final String id;
  final int status;
  final String body;
}

/// Everything Dart asks of iOS, in one place. Off iOS, and in tests, the native
/// side doesn't exist, so each call simply reports that nothing happened.
class NativeBridge {
  NativeBridge._();

  static final NativeBridge instance = NativeBridge._();

  static const _channel = MethodChannel('app.lexa/native');
  static const _motionChannel = EventChannel('app.lexa/motion');

  final _links = StreamController<String>.broadcast();
  final _analysis = StreamController<AnalysisFinished>.broadcast();
  final _transactions = StreamController<String>.broadcast();

  Stream<String> get links => _links.stream;
  Stream<AnalysisFinished> get analysisFinished => _analysis.stream;
  Stream<String> get storeTransactions => _transactions.stream;

  void init() {
    _channel.setMethodCallHandler((call) async {
      final args = (call.arguments as Map?) ?? const {};
      switch (call.method) {
        case 'link.open':
          _links.add(args['link'] as String);
        case 'analysis.finished':
          _analysis.add(AnalysisFinished(
            args['id'] as String,
            (args['status'] as num).toInt(),
            args['body'] as String,
          ));
        case 'store.transaction':
          _transactions.add(args['transaction'] as String);
      }
      return null;
    });
  }

  Future<T?> _call<T>(String method, [Map<String, Object?>? args]) async {
    try {
      return await _channel.invokeMethod<T>(method, args);
    } on MissingPluginException {
      return null;
    }
  }

  Future<String?> initialLink() => _call<String>('link.initial');

  /// The version and build number from the app bundle, as "1.0.0 (1)".
  Future<String?> appVersion() => _call<String>('app.version');

  // ---- Live Activities -----------------------------------------------------

  Future<bool> liveActivitiesEnabled() async =>
      await _call<bool>('liveActivity.isEnabled') ?? false;

  Future<String?> startActivity({
    required String kind,
    required String title,
    required String headline,
    String? detail,
    int? expectedSeconds,
    DateTime? dueAt,
    String? deepLink,
  }) =>
      _call<String>('liveActivity.start', {
        'kind': kind,
        'title': title,
        'headline': headline,
        'detail': detail,
        'expectedSeconds': expectedSeconds,
        'dueAtMs': dueAt?.millisecondsSinceEpoch,
        'deepLink': deepLink,
      });

  Future<void> updateActivity(String id, {String? headline, String? detail}) =>
      _call('liveActivity.update', {
        'id': id,
        'headline': headline,
        'detail': detail,
      });

  Future<void> finishActivity(
    String id, {
    required bool succeeded,
    required String headline,
    String? detail,
  }) =>
      _call('liveActivity.finish', {
        'id': id,
        'succeeded': succeeded,
        'headline': headline,
        'detail': detail,
      });

  Future<void> endActivity(String id) => _call('liveActivity.end', {'id': id});

  Future<void> endWorkingActivities() => _call('liveActivity.endAllWorking');

  Future<String?> deadlineActivityId(String title) =>
      _call<String>('liveActivity.deadlineId', {'title': title});

  // ---- Notifications -------------------------------------------------------

  /// granted, denied, or undetermined.
  Future<String> notificationStatus() async =>
      await _call<String>('notifications.status') ?? 'undetermined';

  Future<bool> requestNotifications() async =>
      await _call<bool>('notifications.request') ?? false;

  Future<void> scheduleNotification({
    required String id,
    required String title,
    required String body,
    DateTime? at,
    String? link,
    bool timeSensitive = false,
  }) =>
      _call('notifications.schedule', {
        'id': id,
        'title': title,
        'body': body,
        'atMs': at?.millisecondsSinceEpoch,
        'link': link,
        'timeSensitive': timeSensitive,
      });

  Future<void> cancelNotifications(String prefix) =>
      _call('notifications.cancelAll', {'prefix': prefix});

  // ---- App Store -----------------------------------------------------------

  Future<List<StoreProduct>> products(List<String> ids) async {
    final raw = await _call<List<dynamic>>('store.products', {'ids': ids});
    return (raw ?? const [])
        .cast<Map<dynamic, dynamic>>()
        .map((m) => StoreProduct(
              id: m['id'] as String,
              title: m['title'] as String,
              description: m['description'] as String,
              price: m['price'] as String,
              period: m['period'] as String?,
            ))
        .toList();
  }

  Future<StorePurchaseResult> purchase(String id, {String? accountToken}) async {
    final raw = await _call<Map<dynamic, dynamic>>(
        'store.purchase', {'id': id, 'accountToken': accountToken});
    return StorePurchaseResult(
      raw?['status'] as String? ?? 'unavailable',
      raw?['transaction'] as String?,
    );
  }

  Future<List<String>> storeEntitlements() async {
    final raw = await _call<List<dynamic>>('store.entitlements');
    return (raw ?? const []).cast<String>();
  }

  Future<List<String>> restorePurchases() async {
    final raw = await _call<List<dynamic>>('store.restore');
    return (raw ?? const []).cast<String>();
  }

  Future<void> manageSubscriptions() => _call('store.manage');

  // ---- Documents -----------------------------------------------------------

  Future<PickedFile?> pickDocument() async => PickedFile.fromMap(
      await _call<Map<dynamic, dynamic>>('picker.document'));

  Future<PickedFile?> pickPhoto() async =>
      PickedFile.fromMap(await _call<Map<dynamic, dynamic>>('picker.photo'));

  Future<PickedFile?> scanDocument() async =>
      PickedFile.fromMap(await _call<Map<dynamic, dynamic>>('picker.scan'));

  Future<bool> canScan() async => await _call<bool>('picker.canScan') ?? false;

  /// Starts an analysis that survives leaving the app. Returns the job id.
  Future<String?> startAnalysis({
    required String url,
    required String token,
    required String contentType,
    required String bodyPath,
    required String title,
    required int expectedSeconds,
  }) =>
      _call<String>('analysis.start', {
        'url': url,
        'token': token,
        'contentType': contentType,
        'bodyPath': bodyPath,
        'title': title,
        'expectedSeconds': expectedSeconds,
      });

  // ---- Sharing -------------------------------------------------------------

  Future<void> shareFile(String path) => _call('share.file', {'path': path});

  Future<void> shareText(String text) => _call('share.text', {'text': text});

  // ---- Sign in with Apple --------------------------------------------------

  /// Returns idToken, nonce, and possibly fullName, or null if cancelled.
  Future<Map<dynamic, dynamic>?> signInWithApple() =>
      _call<Map<dynamic, dynamic>>('appleSignIn.start');

  // ---- Background time -----------------------------------------------------

  Future<int?> beginBackgroundTime() => _call<int>('background.begin');

  Future<void> endBackgroundTime(int? id) async {
    if (id != null) await _call('background.end', {'id': id});
  }

  // ---- Motion --------------------------------------------------------------

  /// Device tilt as (pitch, roll) in radians. Empty where there's no motion data.
  Stream<(double, double)> get motion => _motionChannel
      .receiveBroadcastStream()
      .map((event) {
        final map = event as Map<dynamic, dynamic>;
        return ((map['pitch'] as num).toDouble(), (map['roll'] as num).toDouble());
      })
      .handleError((Object _) {});
}
