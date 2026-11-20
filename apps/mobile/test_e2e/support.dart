// ignore_for_file: invalid_use_of_visible_for_testing_member
// Shared support for the end-to-end walkthrough. It runs the real app, against
// the local backend, on simulated devices, with no simulator. See walkthrough_test.dart.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lexa_mobile/api/client.dart';
import 'package:lexa_mobile/config.dart';
import 'package:lexa_mobile/main.dart';
import 'package:lexa_mobile/state/app_state.dart';
import 'package:lexa_mobile/widgets/ui.dart';
// ignore: depend_on_referenced_packages
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const outputDir = String.fromEnvironment('E2E_OUT', defaultValue: 'build/e2e');

/// A device to lay the app out on, in points.
class Device {
  const Device(
    this.name,
    this.size, {
    this.top = 0,
    this.bottom = 0,
    this.dark = false,
    this.textScale = 1,
    this.shotScale = 1.0,
  });

  final String name;
  final Size size;
  final double top;
  final double bottom;
  final bool dark;
  final double textScale;
  final double shotScale;
}

/// Local test accounts and admin access, written by the local backend on start.
class LocalStack {
  LocalStack._(this.url, this.anonKey, this.serviceKey, this.accounts);

  final String url;
  final String anonKey;
  final String serviceKey;
  final Map<String, dynamic> accounts;

  static LocalStack load() {
    final file = File('../../supabase/tests/local-backend.credentials.json');
    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    return LocalStack._(
      json['url'] as String,
      json['anonKey'] as String,
      json['serviceRoleKey'] as String,
      (json['accounts'] as Map).cast<String, dynamic>(),
    );
  }

  String email(String account) => (accounts[account] as Map)['email'] as String;
  String password(String account) => (accounts[account] as Map)['password'] as String;

  Future<List<dynamic>> sql(String statement, [List<Object?> params = const []]) async {
    final client = HttpClient();
    try {
      final request = await client.postUrl(Uri.parse('$url/__sql'));
      request.headers.set('Authorization', 'Bearer $serviceKey');
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({'sql': statement, 'params': params}));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode != 200) {
        throw StateError('SQL failed (${response.statusCode}): $body');
      }
      return jsonDecode(body) as List<dynamic>;
    } finally {
      client.close();
    }
  }
}

/// A local-only stand-in for what iOS provides. StoreKit transactions use the
/// Xcode environment, which only a non-production server accepts.
class FakeNative {
  final calls = <MethodCall>[];
  int _next = 0;

  /// What the next purchase returns: purchased, cancelled, pending, or unavailable.
  String purchaseOutcome = 'purchased';
  List<String> restorable = const [];
  bool liveActivities = true;
  bool canScan = true;
  bool offerProducts = true;
  late String pickedPath;
  String pickedName = 'Lease agreement.pdf';
  String pickedMime = 'application/pdf';
  int pickedSize = 0;

  static const channel = MethodChannel('app.lexa/native');

  List<MethodCall> named(String method) =>
      calls.where((c) => c.method == method).toList();

  void install() {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(channel, _handle);
    messenger.setMockMethodCallHandler(
      const MethodChannel('app.lexa/motion'),
      (call) async => null,
    );
    messenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => Directory.systemTemp.path,
    );
    final file = File('${Directory.systemTemp.path}/lexa-e2e-lease.pdf');
    file.writeAsBytesSync(utf8.encode('%PDF-1.4\n% local test document\n%%EOF\n'));
    pickedPath = file.path;
    pickedSize = file.lengthSync();
  }

  void freshPick() {
    // The app removes a picked file once it's been sent, as on a device.
    final file = File(pickedPath);
    if (!file.existsSync()) {
      file.writeAsBytesSync(utf8.encode('%PDF-1.4\n% local test document\n%%EOF\n'));
    }
  }

  String _fakeTransaction(String productId, String? accountToken) {
    String encode(Object value) =>
        base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
    final now = DateTime.now().millisecondsSinceEpoch;
    final payload = {
      'transactionId': 'local-${now}1',
      'originalTransactionId': 'local-$now',
      'bundleId': 'com.vaibhavsg.lexa',
      'productId': productId,
      'purchaseDate': now,
      'originalPurchaseDate': now,
      'expiresDate': now + const Duration(days: 30).inMilliseconds,
      'quantity': 1,
      'type': 'Auto-Renewable Subscription',
      'inAppOwnershipType': 'PURCHASED',
      'signedDate': now,
      'environment': 'Xcode',
      'appAccountToken': ?accountToken,
    };
    return '${encode({'alg': 'ES256', 'x5c': <String>[]})}.${encode(payload)}.local';
  }

  Future<Object?> _handle(MethodCall call) async {
    calls.add(call);
    final args = (call.arguments as Map?) ?? const {};
    switch (call.method) {
      case 'app.version':
        return '1.0.0 (1)';
      case 'liveActivity.isEnabled':
        return liveActivities;
      case 'liveActivity.start':
        return 'activity-${++_next}';
      case 'notifications.status':
        return 'granted';
      case 'notifications.request':
        return true;
      case 'store.products':
        if (!offerProducts) return <Object?>[];
        return [
          {
            'id': 'com.vaibhavsg.lexa.plus.monthly',
            'title': 'Lexa Plus',
            'description': 'Unlimited answers and document reading',
            'price': r'$9.99',
            'period': 'month',
          },
          {
            'id': 'com.vaibhavsg.lexa.professional.monthly',
            'title': 'Lexa Professional',
            'description': 'Research, drafting, and client tools',
            'price': r'$39.99',
            'period': 'month',
          },
        ];
      case 'store.purchase':
        if (purchaseOutcome == 'purchased') {
          return {
            'status': 'purchased',
            'transaction': _fakeTransaction(
              args['id'] as String,
              args['accountToken'] as String?,
            ),
          };
        }
        return {'status': purchaseOutcome};
      case 'store.entitlements':
        return <String>[];
      case 'store.restore':
        return restorable;
      case 'picker.canScan':
        return canScan;
      case 'picker.document':
      case 'picker.scan':
      case 'picker.photo':
        freshPick();
        return {
          'path': pickedPath,
          'name': pickedName,
          'mimeType': pickedMime,
          'size': pickedSize,
        };
      case 'analysis.start':
        final id = 'job-${++_next}';
        unawaited(_runAnalysis(id, args));
        return id;
      case 'background.begin':
        return ++_next;
    }
    return null;
  }

  /// Sends the body the way BackgroundAnalysis.swift does, then reports back.
  Future<void> _runAnalysis(String id, Map<dynamic, dynamic> args) async {
    var status = 0;
    var body = '';
    final client = HttpClient();
    try {
      final request = await client.postUrl(Uri.parse(args['url'] as String));
      request.headers.set('Authorization', 'Bearer ${args['token']}');
      request.headers.set('Content-Type', args['contentType'] as String);
      request.add(File(args['bodyPath'] as String).readAsBytesSync());
      final response = await request.close();
      status = response.statusCode;
      body = await response.transform(utf8.decoder).join();
    } catch (_) {
      status = 0;
    } finally {
      client.close();
    }
    deliver('analysis.finished', {'id': id, 'status': status, 'body': body});
  }

  /// Delivers a call from iOS to Dart.
  void deliver(String method, Map<String, Object?> args) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .handlePlatformMessage(
      channel.name,
      channel.codec.encodeMethodCall(MethodCall(method, args)),
      (_) {},
    );
  }
}

Future<void> loadBundledFonts() async {
  final manifest = jsonDecode(await rootBundle.loadString('FontManifest.json')) as List;
  for (final family in manifest.cast<Map<String, dynamic>>()) {
    final loader = FontLoader(family['family'] as String);
    for (final font in (family['fonts'] as List).cast<Map<String, dynamic>>()) {
      loader.addFont(rootBundle.load(font['asset'] as String));
    }
    await loader.load();
  }
}

var _supabaseReady = false;

Future<void> ensureSupabase() async {
  if (_supabaseReady) return;
  _supabaseReady = true;
  SharedPreferences.setMockInitialValues({});
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
    httpClient: lexaHttpClient(),
    authOptions: const FlutterAuthClientOptions(detectSessionInUri: false),
  );
}

/// Drives one device through the app, photographing each screen and collecting
/// anything that goes wrong along the way.
class Walker {
  Walker(this.tester, this.device, this.native);

  final WidgetTester tester;
  final Device device;
  final FakeNative native;
  final problems = <String>[];
  final _boundary = GlobalKey();

  String screen = 'start';
  late AppState state;
  FlutterExceptionHandler? _previousOnError;
  late bool _previousDisableShadows;

  LiveTestWidgetsFlutterBinding get _binding =>
      tester.binding as LiveTestWidgetsFlutterBinding;

  /// Starts the app. Any signed-in session from an earlier run is cleared first.
  Future<void> launch() async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    _previousDisableShadows = debugDisableShadows;
    debugDisableShadows = false;
    tester.testTextInput.register();

    final view = tester.view;
    view.devicePixelRatio = 1;
    view.physicalSize = device.size;
    view.padding = FakeViewPadding(top: device.top, bottom: device.bottom);
    view.viewPadding = FakeViewPadding(top: device.top, bottom: device.bottom);
    await _binding.setSurfaceSize(device.size);
    tester.platformDispatcher.platformBrightnessTestValue =
        device.dark ? Brightness.dark : Brightness.light;
    tester.platformDispatcher.textScaleFactorTestValue = device.textScale;

    _previousOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      final summary = details.exceptionAsString().split('\n').take(2).join(' ');
      final line = '[${device.name}/$screen] $summary';
      problems.add(line);
      debugPrint('PROBLEM $line');
    };

    await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);

    state = AppState();
    await state.loadPreferences();
    unawaited(state.start());
    await tester.pumpWidget(
      RepaintBoundary(key: _boundary, child: LexaApp(state: state)),
    );
    await wait(900);
  }

  Future<void> finish() async {
    await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 100));
    state.dispose();

    FlutterError.onError = _previousOnError;
    debugDefaultTargetPlatformOverride = null;
    debugDisableShadows = _previousDisableShadows;
    tester.testTextInput.unregister();
    tester.view.reset();
    tester.platformDispatcher.clearAllTestValues();
    await _binding.setSurfaceSize(null);
  }

  Future<void> wait([int ms = 500]) =>
      tester.pump(Duration(milliseconds: ms));

  Future<void> shot(String name, {int settle = 700}) async {
    if (settle > 0) await wait(settle);
    await tester.pump();
    final object = _boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final ui.Image image = await object.toImage(pixelRatio: device.shotScale);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    Directory(outputDir).createSync(recursive: true);
    File('$outputDir/${device.name}--$name.png')
        .writeAsBytesSync(data!.buffer.asUint8List());
  }

  void step(String name) {
    screen = name;
    debugPrint('[${device.name}] $name');
  }

  void expectThat(bool condition, String what) {
    if (!condition) {
      final line = '[${device.name}/$screen] expected: $what';
      problems.add(line);
      debugPrint('PROBLEM $line');
    }
  }

  void note(String message) => debugPrint('[${device.name}/$screen] $message');

  Finder pressable(String label) =>
      find.byWidgetPredicate((w) => w is Pressable && w.label == label);

  Finder get _verticalScrollables => find.byWidgetPredicate(
        (w) => w is Scrollable && axisDirectionToAxis(w.axisDirection) == Axis.vertical,
      );

  /// Waits for something to appear, for up to [seconds].
  Future<void> until(Finder finder, {int seconds = 45}) async {
    final stop = DateTime.now().add(Duration(seconds: seconds));
    while (DateTime.now().isBefore(stop)) {
      await tester.pump(const Duration(milliseconds: 120));
      if (finder.evaluate().isNotEmpty) return;
    }
    await shot('TIMEOUT-$screen', settle: 0);
    throw TestFailure('[${device.name}/$screen] timed out waiting for $finder');
  }

  /// Waits until iOS has been asked to do something [count] times.
  Future<void> untilNative(String method, {int count = 1, int seconds = 45}) async {
    final stop = DateTime.now().add(Duration(seconds: seconds));
    while (DateTime.now().isBefore(stop)) {
      await tester.pump(const Duration(milliseconds: 150));
      if (native.named(method).length >= count) return;
    }
    expectThat(false, '$method to be called $count time(s)');
  }

  Future<void> untilGone(Finder finder, {int seconds = 45}) async {
    final stop = DateTime.now().add(Duration(seconds: seconds));
    while (DateTime.now().isBefore(stop)) {
      await tester.pump(const Duration(milliseconds: 120));
      if (finder.evaluate().isEmpty) return;
    }
    await shot('TIMEOUT-$screen', settle: 0);
    throw TestFailure('[${device.name}/$screen] still showing $finder');
  }

  /// Scrolls the frontmost list until the target is built, then into view.
  Future<void> reveal(Finder finder) async {
    // Down first, then back up: long lists only build what's near the screen.
    for (final step in const [-340.0, 340.0]) {
      for (var i = 0; i < 24 && finder.evaluate().isEmpty; i++) {
        final lists = _verticalScrollables.hitTestable();
        if (lists.evaluate().isEmpty) break;
        await tester.drag(lists.last, Offset(0, step), warnIfMissed: false);
        await wait(240);
      }
    }
    if (finder.evaluate().isEmpty) {
      await shot('MISSING-$screen', settle: 0);
      throw TestFailure('[${device.name}/$screen] could not find $finder');
    }
    await Scrollable.ensureVisible(
      finder.evaluate().last,
      alignment: 0.5,
      duration: const Duration(milliseconds: 120),
    );
    await wait(260);
  }

  Future<void> scrollBy(double distance) async {
    final lists = _verticalScrollables.hitTestable();
    if (lists.evaluate().isEmpty) return;
    await tester.drag(lists.last, Offset(0, -distance), warnIfMissed: false);
    await wait(420);
  }

  Future<void> scrollToTop() async {
    for (var i = 0; i < 6; i++) {
      final lists = _verticalScrollables.hitTestable();
      if (lists.evaluate().isEmpty) return;
      await tester.drag(lists.last, const Offset(0, 900), warnIfMissed: false);
      await wait(120);
    }
    await wait(500);
  }

  Future<void> tapFinder(Finder finder, {bool scroll = true}) async {
    if (scroll) {
      await reveal(finder);
    } else if (finder.evaluate().isEmpty) {
      await until(finder, seconds: 10);
    }
    final target = finder.hitTestable();
    if (target.evaluate().isEmpty) {
      await shot('UNREACHABLE-$screen', settle: 0);
      throw TestFailure('[${device.name}/$screen] $finder is covered or off screen');
    }
    await tester.tap(target.last);
    await wait(380);
  }

  Future<void> press(String label, {bool scroll = true}) =>
      tapFinder(pressable(label), scroll: scroll);

  Future<void> tapText(String text, {bool scroll = true}) =>
      tapFinder(find.text(text), scroll: scroll);

  Future<void> tapKey(String key, {bool scroll = true}) =>
      tapFinder(find.byKey(Key(key)), scroll: scroll);

  Future<void> type(Finder field, String text) async {
    await reveal(field);
    await tester.enterText(field.last, text);
    await wait(180);
  }

  Future<void> typeKey(String key, String text) => type(find.byKey(Key(key)), text);

  /// The search box of the picker sheet showing now.
  Finder get sheetField => find.descendant(
        of: find.byType(BottomSheet).last,
        matching: find.byType(TextField),
      );

  /// Chooses an item from a searchable picker sheet.
  Future<void> pick(String item, {bool search = true}) async {
    await until(find.byType(BottomSheet));
    await wait(420);
    if (search) await type(sheetField.first, item);
    await tapFinder(
      find.descendant(of: find.byType(BottomSheet).last, matching: pressable(item)),
    );
    await wait(420);
  }

  /// Opens one of a matter's tabs (Conversation, Deadlines, Documents, Messages).
  Future<void> matterTab(String label) => tapFinder(
        find.descendant(of: find.byType(TabBar), matching: find.text(label)),
        scroll: false,
      );

  /// Opens a top-level section from the tab bar or the sidebar.
  Future<void> openTab(String label) async {
    final tab = pressable(label).hitTestable();
    if (tab.evaluate().isEmpty) {
      await shot('NO-TAB-$label', settle: 0);
      throw TestFailure('[${device.name}/$screen] no tab named $label');
    }
    await tester.tap(tab.last);
    await wait(500);
  }

  Future<void> goBack() async {
    final back = pressable('Back').hitTestable();
    if (back.evaluate().isNotEmpty) {
      await tester.tap(back.last);
    } else {
      final button = find.byType(BackButton).hitTestable();
      if (button.evaluate().isNotEmpty) {
        await tester.tap(button.last);
      } else {
        final close = pressable('Close').hitTestable();
        await tester.tap(close.last);
      }
    }
    await wait(700);
  }

  Future<void> dismissSheet() async {
    final navigator = tester.state<NavigatorState>(
      find.descendant(
        of: find.byType(MaterialApp),
        matching: find.byType(Navigator),
      ).first,
    );
    navigator.pop();
    await wait(600);
  }

  /// Shows the keyboard as iOS would report it, to check that nothing hides.
  Future<void> withKeyboard(Future<void> Function() body, {double height = 336}) async {
    final view = tester.view;
    view.viewInsets = FakeViewPadding(bottom: height);
    view.padding = FakeViewPadding(top: device.top);
    await wait(500);
    await body();
    view.viewInsets = FakeViewPadding.zero;
    view.padding = FakeViewPadding(top: device.top, bottom: device.bottom);
    await wait(500);
  }

  Future<void> signIn(String email, String password) async {
    step('sign in');
    if (find.byKey(const Key('auth-toggle')).evaluate().isEmpty) {
      await until(find.byKey(const Key('auth-toggle')));
    }
    if (find.text('Forgot password?').evaluate().isEmpty) {
      await tapKey('auth-toggle');
    }
    await typeKey('auth-email', email);
    await typeKey('auth-password', password);
    await tapKey('auth-submit');
  }
}

String uniqueEmail(String prefix) =>
    '$prefix-${DateTime.now().millisecondsSinceEpoch}@lexa.test';

/// A password for a throwaway account on the local backend.
String throwawayPassword() =>
    'Local-${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}';
