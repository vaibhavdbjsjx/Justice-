/// Build-time configuration. Only public values live here: the Supabase anon key
/// is safe in a client because row-level security protects the data, and every
/// secret key stays on the server.
///
///   flutter run --dart-define-from-file=config/production.json
class AppConfig {
  const AppConfig._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBase = String.fromEnvironment(
    'LEXA_API_BASE',
    defaultValue: 'http://localhost:3000',
  );

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
