/// Build-time configuration (no secrets in the repo):
///
/// flutter run --dart-define=SUPABASE_URL=https://xyz.supabase.co \
///             --dart-define=SUPABASE_ANON_KEY=eyJ... \
///             --dart-define=LEXMIND_API_BASE=https://app.lexmind.com
///
/// The API base is the deployed Next.js app — AI calls go through its route
/// handlers (keys stay server-side), authenticated with the Supabase JWT.
class AppConfig {
  const AppConfig._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBase = String.fromEnvironment(
    'LEXMIND_API_BASE',
    defaultValue: 'http://localhost:3000',
  );

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
