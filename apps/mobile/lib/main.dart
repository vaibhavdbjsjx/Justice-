import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api/client.dart';
import 'config.dart';
import 'native/native_bridge.dart';
import 'screens/auth_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/shell.dart';
import 'state/app_state.dart';
import 'theme/theme.dart';
import 'widgets/scenes.dart';
import 'widgets/ui.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  NativeBridge.instance.init();

  LicenseRegistry.addLicense(() async* {
    for (final font in ['Inter', 'Fraunces']) {
      final license = await rootBundle.loadString('assets/fonts/LICENSE-$font.txt');
      yield LicenseEntryWithLineBreaks([font], license);
    }
  });

  final state = AppState();
  if (AppConfig.isConfigured) {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      publishableKey: AppConfig.supabaseAnonKey,
      httpClient: lexaHttpClient(),
    );
    await state.loadPreferences();
    unawaited(state.start());
    unawaited(NativeBridge.instance.endWorkingActivities());
  }
  runApp(LexaApp(state: state));
}

class LexaApp extends StatelessWidget {
  const LexaApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: AnimatedBuilder(
        animation: state,
        builder: (context, _) => MaterialApp(
          title: 'Lexa',
          debugShowCheckedModeBanner: false,
          theme: lexaLight,
          darkTheme: lexaDark,
          themeMode: state.themeMode,
          // Large text is fully supported, within a range the layouts hold up at.
          builder: (context, child) => MediaQuery.withClampedTextScaling(
            maxScaleFactor: 1.35,
            child: child!,
          ),
          home: AppConfig.isConfigured ? const RootGate() : const _Unconfigured(),
        ),
      ),
    );
  }
}

/// Routes on sign-in state and setup progress.
class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, _) {
        final Widget child;
        if (state.session == null) {
          child = const AuthScreen();
        } else if (state.profile == null) {
          child = state.profileError == null
              ? const _Splash()
              : _Retry(onRetry: state.refresh);
        } else if (!state.profile!.onboardingCompleted) {
          child = const OnboardingScreen();
        } else {
          child = const AppShell();
        }
        return AnimatedSwitcher(
          duration: LexaMotion.slow,
          switchInCurve: LexaMotion.curve,
          child: KeyedSubtree(key: ValueKey(child.runtimeType), child: child),
        );
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: LexaCoin(size: 84)));
  }
}

class _Retry extends StatelessWidget {
  const _Retry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.read(context);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: EmptyView(
              icon: Icons.wifi_off_rounded,
              title: "Can't reach Lexa",
              body: 'Check your connection and try again. Your data is safe.',
              action: 'Try again',
              onAction: () {
                onRetry();
              },
            ).withSignOut(state),
          ),
        ),
      ),
    );
  }
}

extension on EmptyView {
  Widget withSignOut(AppState state) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          this,
          LexaButton('Sign out', style: LexaButtonStyle.ghost, expand: false, onPressed: state.signOut),
        ],
      );
}

class _Unconfigured extends StatelessWidget {
  const _Unconfigured();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: EmptyView(
            icon: Icons.settings_outlined,
            title: 'Lexa needs setup',
            body: 'This build has no backend configured. Build with --dart-define-from-file=config/production.json.',
          ),
        ),
      ),
    );
  }
}
