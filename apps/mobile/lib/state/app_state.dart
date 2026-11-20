import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api/client.dart';
import '../config.dart';
import '../data/repository.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../services/reminders.dart';
import '../services/store_service.dart';

/// App-wide state: who's signed in, their profile and plan, and preferences.
class AppState extends ChangeNotifier {
  AppState({LexaApi? api, Repository? repository})
      : api = api ?? LexaApi(),
        repo = repository ?? Repository();

  final LexaApi api;
  final Repository repo;

  late final StoreService store = StoreService(api, this);
  late final Reminders reminders = Reminders(repo, () => remindersEnabled);

  SharedPreferences? _prefs;
  StreamSubscription<AuthState>? _authSubscription;

  RemoteConfig remote = RemoteConfig.defaults(AppConfig.apiBase);
  Profile? profile;
  BillingStatus? billing;
  bool loadingProfile = false;
  Object? profileError;

  /// True once the server's settings have arrived, rather than the bundled ones.
  bool remoteLoaded = false;
  Future<void>? _refreshing;
  ThemeMode themeMode = ThemeMode.system;

  /// Which top-level tab is showing.
  final ValueNotifier<int> tab = ValueNotifier(0);

  /// Bumped when data changes somewhere other screens should reload from.
  final ValueNotifier<int> dataVersion = ValueNotifier(0);

  void notifyDataChanged() => dataVersion.value++;

  Session? get session => Supabase.instance.client.auth.currentSession;
  User? get user => Supabase.instance.client.auth.currentUser;

  Future<void> loadPreferences() async {
    _prefs = await SharedPreferences.getInstance();
    themeMode = switch (_prefs?.getString('themeMode')) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> start() async {
    unawaited(_loadRemoteConfig());

    _authSubscription =
        Supabase.instance.client.auth.onAuthStateChange.listen((state) {
      switch (state.event) {
        case AuthChangeEvent.signedIn:
        case AuthChangeEvent.initialSession:
        case AuthChangeEvent.userUpdated:
          if (state.session != null) unawaited(refresh());
        case AuthChangeEvent.signedOut:
          profile = null;
          billing = null;
          profileError = null;
          tab.value = 0;
          unawaited(reminders.clear());
          notifyListeners();
        default:
          break;
      }
    });
    if (session != null) await refresh();
  }

  Future<void> _loadRemoteConfig() async {
    try {
      remote = await api.appConfig();
      remoteLoaded = true;
      notifyListeners();
    } catch (_) {
      // The bundled defaults keep the app working until the next launch.
    }
  }

  /// Reloads profile and plan, and quietly re-syncs any App Store subscription.
  /// Calls that overlap share one load, so launch doesn't do this work twice.
  Future<void> refresh() =>
      _refreshing ??= _refresh().whenComplete(() => _refreshing = null);

  Future<void> _refresh() async {
    loadingProfile = profile == null;
    profileError = null;
    if (loadingProfile) notifyListeners();
    try {
      final loaded = await repo.profile();
      profile = loaded;
      // A session whose account no longer exists: offer a way out, not a spinner.
      if (loaded == null) profileError = StateError('No profile for this account');
    } catch (error) {
      // Keep whatever was loaded; the root screen offers a retry if nothing was.
      profileError = error;
    }
    loadingProfile = false;
    notifyListeners();
    unawaited(refreshBilling());
    unawaited(store.syncEntitlements());
    unawaited(reminders.reschedule());
  }

  Future<void> refreshBilling() async {
    try {
      billing = await api.billingStatus();
      notifyListeners();
    } catch (_) {
      // Plan details are optional for rendering; gates live on the server.
    }
  }

  void setBilling(BillingStatus status) {
    billing = status;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    notifyListeners();
    await _prefs?.setString('themeMode', mode.name);
  }

  bool get remindersEnabled => _prefs?.getBool('reminders') ?? false;

  Future<void> setRemindersEnabled(bool value) async {
    await _prefs?.setBool('reminders', value);
    notifyListeners();
    if (value) {
      await reminders.reschedule();
    } else {
      await reminders.clear();
    }
  }

  // ---- AI permission (App Store Guideline 5.1.2(i)) ------------------------

  bool get hasAiConsent {
    final p = profile;
    if (p == null) return false;
    if (p.hasConsentColumns) {
      if (p.aiConsentAt == null) return false;
      // Until the server says which provider is in use, trust the recorded choice.
      return !remoteLoaded || p.aiConsentProvider == remote.aiProvider;
    }
    // The server can't record it yet, so the choice is remembered on the device.
    return _prefs?.getString('aiConsentProvider') == remote.aiProvider;
  }

  Future<void> grantAiConsent() async {
    await _prefs?.setString('aiConsentProvider', remote.aiProvider);
    if (profile?.hasConsentColumns ?? false) await api.grantAiConsent();
    profile = await repo.profile();
    notifyListeners();
  }

  Future<void> withdrawAiConsent() async {
    await _prefs?.remove('aiConsentProvider');
    if (profile?.hasConsentColumns ?? false) await api.withdrawAiConsent();
    profile = await repo.profile();
    notifyListeners();
  }

  Future<void> signOut() async {
    await NativeBridge.instance.endWorkingActivities();
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {
      // Signed out on this device already. The server session simply expires.
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}

/// Hands AppState down the widget tree and rebuilds dependents when it changes.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
      : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  /// For callbacks and other places that shouldn't rebuild on changes.
  static AppState read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
