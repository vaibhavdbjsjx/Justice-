import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api/client.dart';
import '../legal/disclaimers.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';

String friendlyAuthError(String message) {
  final m = message.toLowerCase();
  if (m.contains('invalid login credentials')) {
    return "That email or password doesn't match our records. Please try again.";
  }
  if (m.contains('email not confirmed')) {
    return 'Please confirm your email address first. Check your inbox for the link.';
  }
  if (m.contains('already registered') || m.contains('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (m.contains('password should be') || m.contains('weak password')) {
    return 'Please choose a stronger password, with at least 8 characters.';
  }
  if (m.contains('rate limit') || m.contains('too many')) {
    return 'Too many attempts just now. Please wait a moment and try again.';
  }
  if (m.contains('network') || m.contains('socket') || m.contains('host lookup')) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong on our end. Please try again in a moment.';
}

final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Welcome, sign in, and sign up.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _signUp = true;
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (!_emailPattern.hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'Use a password of at least 8 characters.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    final auth = Supabase.instance.client.auth;
    try {
      if (_signUp) {
        final result = await auth.signUp(email: email, password: password);
        if (result.session == null && mounted) {
          setState(() => _notice = 'Almost there. Confirm your email, then sign in here.');
        }
      } else {
        await auth.signInWithPassword(email: email, password: password);
      }
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e.message));
    } catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e.toString()));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInWithApple() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final credential = await NativeBridge.instance.signInWithApple();
      if (credential == null) return;
      final response = await Supabase.instance.client.auth.signInWithIdToken(
        provider: OAuthProvider.apple,
        idToken: credential['idToken'] as String,
        nonce: credential['nonce'] as String,
      );
      final name = credential['fullName'] as String?;
      if (name != null && response.user != null && mounted) {
        await AppScope.read(context).repo.updateProfile({'full_name': name});
      }
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e.message));
    } catch (_) {
      if (mounted) {
        setState(() => _error = "Sign in with Apple didn't go through. Please try again.");
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _forgot() {
    showLexaSheet<void>(context, (sheet) => _ForgotPasswordSheet(initialEmail: _email.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = AppScope.of(context);
    final size = MediaQuery.sizeOf(context);
    final wide = size.width >= 820;

    final form = AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Reveal(
            index: 1,
            child: Text(
              'Understand your legal situation in minutes.',
              style: wide ? theme.textTheme.displayLarge : theme.textTheme.displayMedium,
            ),
          ),
          const SizedBox(height: 10),
          Reveal(
            index: 2,
            child: Text(
              'Plain-language answers scoped to where you live, with the sources behind them.',
              style: theme.textTheme.bodyLarge?.copyWith(color: context.mutedColor),
            ),
          ),
          const SizedBox(height: 26),
          Reveal(
            index: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  Note(_error!, tone: NoteTone.error),
                  const SizedBox(height: 12),
                ],
                if (_notice != null) ...[
                  Note(_notice!, tone: NoteTone.success),
                  const SizedBox(height: 12),
                ],
                _AppleButton(onPressed: _busy ? null : _signInWithApple),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Expanded(child: Divider()),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('or with email', style: theme.textTheme.bodySmall),
                    ),
                    const Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  key: const Key('auth-email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(hintText: 'you@example.com'),
                ),
                const SizedBox(height: 10),
                TextField(
                  key: const Key('auth-password'),
                  controller: _password,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  autofillHints: [_signUp ? AutofillHints.newPassword : AutofillHints.password],
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    hintText: _signUp ? 'Create a password' : 'Password',
                    suffixIcon: IconButton(
                      tooltip: _obscure ? 'Show password' : 'Hide password',
                      icon: Icon(
                        _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        size: 20,
                        color: context.mutedColor,
                      ),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                if (!_signUp)
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: _forgot,
                      child: Text('Forgot password?',
                          style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor)),
                    ),
                  )
                else
                  const SizedBox(height: 14),
                LexaButton(
                  _signUp ? 'Create account' : 'Sign in',
                  key: const Key('auth-submit'),
                  onPressed: _submit,
                  busy: _busy,
                ),
                const SizedBox(height: 4),
                TextButton(
                  key: const Key('auth-toggle'),
                  onPressed: () => setState(() {
                    _signUp = !_signUp;
                    _error = null;
                    _notice = null;
                  }),
                  child: Text(
                    _signUp ? 'Already have an account? Sign in' : 'New to Lexa? Create an account',
                    style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor),
                  ),
                ),
                const SizedBox(height: 8),
                Text.rich(
                  TextSpan(
                    style: theme.textTheme.bodySmall?.copyWith(fontSize: 12),
                    children: [
                      const TextSpan(text: 'By continuing you agree to our '),
                      WidgetSpan(
                        child: GestureDetector(
                          onTap: () => openLink(state.remote.termsUrl),
                          child: Text('Terms',
                              style: theme.textTheme.bodySmall?.copyWith(fontSize: 12, color: context.accentColor)),
                        ),
                      ),
                      const TextSpan(text: ' and '),
                      WidgetSpan(
                        child: GestureDetector(
                          onTap: () => openLink(state.remote.privacyUrl),
                          child: Text('Privacy Policy',
                              style: theme.textTheme.bodySmall?.copyWith(fontSize: 12, color: context.accentColor)),
                        ),
                      ),
                      const TextSpan(text: '.'),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  disclaimerFull,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Scaffold(
      body: SafeArea(
        child: wide
            ? Row(
                children: [
                  const Expanded(child: Center(child: Reveal(child: HeroStack(height: 420)))),
                  Expanded(
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(36),
                        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: form),
                      ),
                    ),
                  ),
                ],
              )
            : SingleChildScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(22, 4, 22, 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Reveal(child: HeroStack(height: size.height < 720 ? 210 : 300)),
                    const SizedBox(height: 4),
                    form,
                  ],
                ),
              ),
      ),
    );
  }
}

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet({required this.initialEmail});

  final String initialEmail;

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  late final _email = TextEditingController(text: widget.initialEmail);
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim();
    if (!_emailPattern.hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).api.requestPasswordReset(email);
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Reset your password', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text("We'll email you a secure link to choose a new one.", style: theme.textTheme.bodyMedium),
          const SizedBox(height: 18),
          if (_sent)
            Note(
              'If an account exists for ${_email.text.trim()}, a reset link is on its way. Check your inbox and spam folder.',
              tone: NoteTone.success,
            )
          else ...[
            if (_error != null) ...[
              Note(_error!, tone: NoteTone.error),
              const SizedBox(height: 12),
            ],
            TextField(
              key: const Key('reset-email'),
              controller: _email,
              autofocus: widget.initialEmail.isEmpty,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(hintText: 'you@example.com'),
            ),
            const SizedBox(height: 14),
            LexaButton('Email me a reset link', onPressed: _send, busy: _busy),
          ],
        ],
      ),
    );
  }
}

/// Sign in with Apple, styled per Apple's guidelines: solid black (white in dark mode).
class _AppleButton extends StatelessWidget {
  const _AppleButton({this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fg = dark ? Colors.black : Colors.white;
    return SizedBox(
      height: 50,
      child: FilledButton(
        key: const Key('auth-apple'),
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: dark ? Colors.white : Colors.black,
          foregroundColor: fg,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.apple, size: 22, color: fg),
            const SizedBox(width: 8),
            Text(
              'Sign in with Apple',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: fg),
            ),
          ],
        ),
      ),
    );
  }
}
