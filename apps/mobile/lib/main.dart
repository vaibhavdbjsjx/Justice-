import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'screens/auth_screen.dart';
import 'screens/shell.dart';
import 'theme/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (AppConfig.isConfigured) {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      publishableKey: AppConfig.supabaseAnonKey,
    );
  }
  runApp(const JusticeApp());
}

class JusticeApp extends StatelessWidget {
  const JusticeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Justice',
      debugShowCheckedModeBanner: false,
      theme: justiceLight,
      darkTheme: justiceDark,
      themeMode: ThemeMode.system,
      home: AppConfig.isConfigured ? const _AuthGate() : const _Unconfigured(),
    );
  }
}

/// Routes on live auth state: signed out → AuthScreen, signed in → shell.
class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = Supabase.instance.client.auth.currentSession;
        if (session == null) return const AuthScreen();
        return const AppShell();
      },
    );
  }
}

class _Unconfigured extends StatelessWidget {
  const _Unconfigured();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.balance, size: 44, color: theme.colorScheme.secondary),
              const SizedBox(height: 16),
              Text('Justice', style: theme.textTheme.displaySmall),
              const SizedBox(height: 12),
              Text(
                'This build has no backend configured.\n'
                'Run with --dart-define=SUPABASE_URL=… '
                '--dart-define=SUPABASE_ANON_KEY=… '
                '--dart-define=JUSTICE_API_BASE=…',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
