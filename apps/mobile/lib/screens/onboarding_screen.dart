import 'dart:async';
import 'package:flutter/material.dart';
import '../native/native_bridge.dart';
import '../services/jurisdictions.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/pickers.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';
import 'consent.dart';

/// First-run setup: who you are, where you live, and whether Lexa may use AI on
/// your behalf. Jurisdiction is what makes every later answer precise.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _name = TextEditingController();
  final _bar = TextEditingController();
  String _role = 'consumer';
  String? _country;
  String? _state;
  String _language = 'en';
  final Set<String> _practiceAreas = {};
  ReferenceData? _data;
  int _step = 0;
  bool _busy = false;
  String? _error;

  int get _stepCount => _role == 'lawyer' ? 5 : 4;

  @override
  void initState() {
    super.initState();
    ReferenceData.load().then((data) {
      if (mounted) setState(() => _data = data);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _bar.dispose();
    super.dispose();
  }

  void _next() {
    setState(() {
      _error = null;
      _step++;
    });
  }

  void _back() {
    setState(() {
      _error = null;
      _step--;
    });
  }

  Future<void> _saveProfile() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      await state.repo.updateProfile({
        'role': _role,
        'full_name': _name.text.trim().isEmpty ? null : _name.text.trim(),
        'country': _country,
        'state_province': _state,
        'preferred_language': _language,
      });
      if (_role == 'lawyer') {
        await state.repo.saveLawyerProfile(
          practiceAreas: _practiceAreas.toList(),
          licensedJurisdictions: _country == null
              ? const []
              : [
                  {'country': _country, 'state': _state}
                ],
          barNumber: _bar.text.trim().isEmpty ? null : _bar.text.trim(),
        );
      }
      state.profile = await state.repo.profile();
      if (mounted) _next();
    } catch (_) {
      if (mounted) setState(() => _error = "We couldn't save your details just now. Please try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      await state.repo.updateProfile({'onboarding_completed': true});
      await state.refresh();
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "We couldn't finish setting up just now. Please try again.";
        });
      }
    }
  }

  Future<void> _agreeToAi() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).grantAiConsent();
      if (mounted) _next();
    } catch (_) {
      if (mounted) setState(() => _error = "We couldn't save that just now. Please try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enableReminders() async {
    final state = AppScope.read(context);
    final granted = await NativeBridge.instance.requestNotifications();
    if (granted) unawaited(state.setRemindersEnabled(true));
    await _finish();
  }

  @override
  Widget build(BuildContext context) {
    final steps = <Widget>[
      _aboutYou(context),
      _whereYouLive(context),
      if (_role == 'lawyer') _yourPractice(context),
      _aiPermission(context),
      _reminders(context),
    ];
    final progress = (_step + 1) / _stepCount;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 12, 22, 4),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 44,
                        child: _step > 0
                            ? IconActionButton(
                                icon: Icons.arrow_back_ios_new_rounded,
                                size: 18,
                                tooltip: 'Back',
                                onPressed: _busy ? null : _back,
                              )
                            : null,
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: TweenAnimationBuilder<double>(
                            tween: Tween(end: progress),
                            duration: LexaMotion.slow,
                            curve: LexaMotion.curve,
                            builder: (context, value, _) => LinearProgressIndicator(
                              value: value,
                              minHeight: 5,
                              backgroundColor: context.surfaceSunken,
                              color: context.accentColor,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 44),
                    ],
                  ),
                ),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: LexaMotion.slow,
                    switchInCurve: LexaMotion.curve,
                    switchOutCurve: Curves.easeIn,
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(animation),
                        child: child,
                      ),
                    ),
                    child: KeyedSubtree(key: ValueKey(_step), child: steps[_step.clamp(0, steps.length - 1)]),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _frame(BuildContext context, {
    required String title,
    String? body,
    required List<Widget> children,
    required List<Widget> footer,
  }) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(title, style: theme.textTheme.displaySmall),
                if (body != null) ...[
                  const SizedBox(height: 8),
                  Text(body, style: theme.textTheme.bodyLarge?.copyWith(color: context.mutedColor)),
                ],
                const SizedBox(height: 24),
                ...children,
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 8, 22, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                Note(_error!, tone: NoteTone.error),
                const SizedBox(height: 12),
              ],
              ...footer,
            ],
          ),
        ),
      ],
    );
  }

  Widget _roleCard(BuildContext context, String value, IconData icon, String title, String body) {
    final theme = Theme.of(context);
    final selected = _role == value;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Pressable(
        onTap: () => setState(() => _role = value),
        label: title,
        child: AnimatedContainer(
          duration: LexaMotion.base,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selected ? context.accentSoft : theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? context.accentColor : theme.colorScheme.outline,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, size: 24, color: context.accentColor),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleMedium),
                    const SizedBox(height: 2),
                    Text(body, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
              AnimatedOpacity(
                duration: LexaMotion.fast,
                opacity: selected ? 1 : 0,
                child: Icon(Icons.check_circle_rounded, color: context.accentColor, size: 22),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _aboutYou(BuildContext context) {
    return _frame(
      context,
      title: 'Welcome to Lexa',
      body: 'A couple of details so answers fit your situation.',
      children: [
        LabeledField(
          label: 'Your name',
          child: TextField(
            key: const Key('onboarding-name'),
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(hintText: 'Optional'),
          ),
        ),
        _roleCard(context, 'consumer', Icons.person_outline_rounded, 'For myself',
            'Understand a situation, a document, or my rights.'),
        _roleCard(context, 'lawyer', Icons.gavel_rounded, "I'm a legal professional",
            'Research, drafting, and client tools.'),
      ],
      footer: [LexaButton('Continue', key: const Key('onboarding-next'), onPressed: _next)],
    );
  }

  Widget _whereYouLive(BuildContext context) {
    return _frame(
      context,
      title: 'Where do you live?',
      body: 'The law changes from place to place. This scopes every answer, and you can change it per matter.',
      children: [
        JurisdictionFields(
          country: _country,
          state: _state,
          onChanged: (country, state) => setState(() {
            _country = country;
            _state = state;
          }),
        ),
        LabeledField(
          label: 'Answer language',
          child: PickerField(
            value: _data?.languageName(_language) ?? 'English',
            placeholder: 'English',
            icon: Icons.translate_rounded,
            onTap: () async {
              final data = _data;
              if (data == null) return;
              final picked = await showSearchPicker<Language>(
                context,
                title: 'Answer language',
                items: data.languages,
                label: (l) => l.name == l.nativeName ? l.name : '${l.name} · ${l.nativeName}',
              );
              if (picked != null) setState(() => _language = picked.code);
            },
          ),
        ),
      ],
      footer: [
        LexaButton(
          'Continue',
          key: const Key('onboarding-next'),
          onPressed: _country == null
              ? null
              : () {
                  if (_role == 'lawyer') {
                    _next();
                  } else {
                    _saveProfile();
                  }
                },
          busy: _busy,
        ),
      ],
    );
  }

  Widget _yourPractice(BuildContext context) {
    final areas = _data?.practiceAreas ?? const <String>[];
    return _frame(
      context,
      title: 'Your practice',
      body: 'Your profile appears in the lawyer directory once your enrollment is verified.',
      children: [
        LabeledField(
          label: 'Bar or enrollment number',
          child: TextField(controller: _bar, decoration: const InputDecoration(hintText: 'Optional for now')),
        ),
        Text('Practice areas', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final area in areas)
              Pressable(
                onTap: () => setState(() {
                  _practiceAreas.contains(area) ? _practiceAreas.remove(area) : _practiceAreas.add(area);
                }),
                label: area,
                child: Pill(area, tone: _practiceAreas.contains(area) ? PillTone.accent : PillTone.neutral),
              ),
          ],
        ),
      ],
      footer: [LexaButton('Continue', onPressed: _saveProfile, busy: _busy)],
    );
  }

  Widget _aiPermission(BuildContext context) {
    return _frame(
      context,
      title: 'Your data and AI',
      body: "Lexa's answers come from an AI service run by another company. We need your permission to share your content with them.",
      children: const [AiConsentBody()],
      footer: [
        LexaButton('I agree', key: const Key('consent-agree'), onPressed: _agreeToAi, busy: _busy),
        const SizedBox(height: 6),
        LexaButton(
          'Not now',
          key: const Key('consent-decline'),
          style: LexaButtonStyle.ghost,
          onPressed: _busy ? null : _next,
        ),
        const SizedBox(height: 6),
        Text(
          "Without this, the assistant and document tools stay off. Matters and deadlines still work, and you can change your mind in Account.",
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _reminders(BuildContext context) {
    final theme = Theme.of(context);
    return _frame(
      context,
      title: 'Never miss a deadline',
      body: 'Legal deadlines can be short and unforgiving. Lexa can remind you a week before, the day before, and the morning of.',
      children: [
        const SizedBox(height: 6),
        const ReminderScene(),
        const SizedBox(height: 18),
        Text(
          'Reminders stay on this device. You can turn them off at any time in Account.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall,
        ),
      ],
      footer: [
        LexaButton('Turn on reminders', key: const Key('reminders-on'), onPressed: _busy ? null : _enableReminders, busy: _busy),
        const SizedBox(height: 6),
        LexaButton(
          'Not now',
          key: const Key('reminders-skip'),
          style: LexaButtonStyle.ghost,
          onPressed: _busy ? null : _finish,
        ),
      ],
    );
  }
}
