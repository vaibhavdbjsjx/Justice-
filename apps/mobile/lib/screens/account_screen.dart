import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api/client.dart';
import '../legal/disclaimers.dart';
import '../native/native_bridge.dart';
import '../services/jurisdictions.dart';
import '../services/store_service.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/pickers.dart';
import '../widgets/ui.dart';
import 'consent.dart';
import 'paywall_screen.dart';

/// Profile, plan, privacy, and account controls. Deleting an account lives here,
/// in the app, as Guideline 5.1.1(v) requires.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  String _version = '';
  bool _restoring = false;

  @override
  void initState() {
    super.initState();
    NativeBridge.instance.appVersion().then((version) {
      if (mounted && version != null) setState(() => _version = version);
    });
  }

  Future<void> _toggleReminders(bool value) async {
    final state = AppScope.read(context);
    final bridge = NativeBridge.instance;
    if (!value) {
      await state.setRemindersEnabled(false);
      return;
    }
    final status = await bridge.notificationStatus();
    final granted = status == 'granted' || (status == 'undetermined' && await bridge.requestNotifications());
    if (granted) {
      await state.setRemindersEnabled(true);
    } else if (mounted) {
      showToast(context, 'Turn on notifications for Lexa in Settings to get reminders.');
    }
  }

  Future<void> _toggleConsent() async {
    final state = AppScope.read(context);
    try {
      if (state.hasAiConsent) {
        final confirmed = await confirmAction(
          context,
          title: 'Withdraw permission?',
          body: 'The assistant and document tools will stay off until you give it again. Your matters and deadlines still work.',
          confirmLabel: 'Withdraw',
          destructive: true,
        );
        if (confirmed) await state.withdrawAiConsent();
      } else {
        await ensureAiConsent(context);
      }
    } catch (_) {
      if (mounted) showToast(context, "We couldn't save that just now. Please try again.");
    }
  }

  Future<void> _restore() async {
    setState(() => _restoring = true);
    final outcome = await AppScope.read(context).store.restore();
    if (!mounted) return;
    setState(() => _restoring = false);
    showToast(
      context,
      outcome.kind == PurchaseOutcomeKind.purchased ? 'Your subscription is restored.' : (outcome.message ?? 'Nothing to restore.'),
    );
  }

  Future<void> _delete() async {
    final state = AppScope.read(context);
    final confirmed = await confirmAction(
      context,
      title: 'Delete your account?',
      body: 'This permanently deletes your account and everything in it: matters, documents, conversations, and deadlines. It cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    showDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (_) => const PopScope(canPop: false, child: Center(child: CircularProgressIndicator())),
    );
    final rootNavigator = Navigator.of(context, rootNavigator: true);
    try {
      final hadAppleSubscription = await state.api.deleteAccount();
      rootNavigator.pop();
      if (hadAppleSubscription && mounted) {
        await showDialog<void>(
          context: context,
          useRootNavigator: true,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Your account is deleted'),
            content: const Text(
              "Your App Store subscription is separate and keeps renewing until you cancel it. Apple doesn't allow apps to cancel it for you.",
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Close'),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop();
                  NativeBridge.instance.manageSubscriptions();
                },
                child: const Text('Manage subscription'),
              ),
            ],
          ),
        );
      }
      await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
    } on ApiException catch (e) {
      rootNavigator.pop();
      if (mounted) showToast(context, e.message);
    } catch (_) {
      rootNavigator.pop();
      if (mounted) showToast(context, "We couldn't delete your account just now. Please try again or contact support.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = AppScope.of(context);
    final profile = state.profile;
    final billing = state.billing;
    const showPlans = true;
    final hasConsent = state.hasAiConsent;

    Widget planRow() {
      if (billing == null) {
        return const Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 20));
      }
      if (billing.isFree) {
        return SettingsRow(
          title: 'Free plan',
          subtitle: '${billing.chatUsed} of ${billing.chatLimit} questions used this month',
          icon: Icons.workspace_premium_outlined,
          trailing: Text('Upgrade', style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor)),
          onTap: () => showPaywall(context),
        );
      }
      final renews = billing.renewsAt == null ? null : formatDate(billing.renewsAt!.toLocal());
      return SettingsRow(
        title: 'Lexa ${billing.tierLabel}',
        subtitle: billing.source == 'apple'
            ? (renews == null ? 'Billed through the App Store' : 'Renews or ends $renews')
            : 'Bought on the web. Manage it from your account on the web.',
        icon: Icons.workspace_premium_rounded,
        onTap: billing.source == 'apple' ? () => NativeBridge.instance.manageSubscriptions() : null,
      );
    }

    return LexaPage(
      title: 'Account',
      onRefresh: state.refresh,
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            Reveal(
              child: SettingsGroup(
                children: [
                  SettingsRow(
                    title: profile?.fullName?.trim().isNotEmpty == true ? profile!.fullName! : 'Your profile',
                    subtitle: state.user?.email,
                    icon: Icons.person_outline_rounded,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                    ),
                  ),
                  SettingsRow(
                    title: 'Jurisdiction',
                    subtitle: profile?.jurisdictionLabel,
                    icon: Icons.place_outlined,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                    ),
                  ),
                ],
              ),
            ),
            if (showPlans) ...[
              const SectionLabel('Plan'),
              Reveal(
                index: 1,
                child: SettingsGroup(
                  children: [
                    planRow(),
                    SettingsRow(
                      title: 'Restore Purchases',
                      icon: Icons.restore_rounded,
                      trailing: _restoring ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : null,
                      onTap: _restoring ? null : _restore,
                    ),
                  ],
                ),
              ),
            ],
            const SectionLabel('Preferences'),
            Reveal(
              index: 2,
              child: SettingsGroup(
                children: [
                  SettingsRow(
                    title: 'Deadline reminders',
                    subtitle: 'A week before, the day before, and the morning of',
                    icon: Icons.notifications_none_rounded,
                    trailing: Switch.adaptive(
                      value: state.remindersEnabled,
                      activeTrackColor: context.accentColor,
                      onChanged: _toggleReminders,
                    ),
                  ),
                  SettingsRow(
                    title: 'Appearance',
                    subtitle: switch (state.themeMode) {
                      ThemeMode.light => 'Light',
                      ThemeMode.dark => 'Dark',
                      ThemeMode.system => 'Match system',
                    },
                    icon: Icons.contrast_rounded,
                    onTap: () async {
                      final picked = await showSearchPicker<ThemeMode>(
                        context,
                        title: 'Appearance',
                        items: ThemeMode.values,
                        selected: state.themeMode,
                        label: (m) => switch (m) {
                          ThemeMode.light => 'Light',
                          ThemeMode.dark => 'Dark',
                          ThemeMode.system => 'Match system',
                        },
                      );
                      if (picked != null) await state.setThemeMode(picked);
                    },
                  ),
                ],
              ),
            ),
            const SectionLabel('Privacy'),
            Reveal(
              index: 3,
              child: SettingsGroup(
                children: [
                  SettingsRow(
                    title: 'AI data sharing',
                    subtitle: hasConsent
                        ? 'On. Your questions and documents go to ${state.remote.aiLabel} so Lexa can answer.'
                        : 'Off. The assistant and document tools need this.',
                    icon: Icons.shield_outlined,
                    trailing: Switch.adaptive(
                      key: const Key('consent-switch'),
                      value: hasConsent,
                      activeTrackColor: context.accentColor,
                      onChanged: (_) => _toggleConsent(),
                    ),
                  ),
                  SettingsRow(
                    title: 'Privacy Policy',
                    icon: Icons.privacy_tip_outlined,
                    onTap: () => openLink(state.remote.privacyUrl),
                  ),
                  SettingsRow(
                    title: 'Terms of Use',
                    icon: Icons.description_outlined,
                    onTap: () => openLink(state.remote.termsUrl),
                  ),
                  SettingsRow(
                    title: 'Legal disclaimer',
                    icon: Icons.balance_rounded,
                    onTap: () => openLink(state.remote.disclaimerUrl),
                  ),
                ],
              ),
            ),
            const SectionLabel('Help'),
            SettingsGroup(
              children: [
                SettingsRow(
                  title: 'Contact support',
                  icon: Icons.mail_outline_rounded,
                  onTap: () => openLink(state.remote.supportUrl),
                ),
                SettingsRow(
                  title: 'Licenses',
                  icon: Icons.code_rounded,
                  onTap: () => showLicensePage(context: context, applicationName: 'Lexa', applicationVersion: _version, useRootNavigator: true),
                ),
              ],
            ),
            const SizedBox(height: 18),
            SettingsGroup(
              children: [
                SettingsRow(
                  title: 'Sign out',
                  icon: Icons.logout_rounded,
                  onTap: () async {
                    final confirmed = await confirmAction(
                      context,
                      title: 'Sign out?',
                      body: 'You can sign back in at any time.',
                      confirmLabel: 'Sign out',
                    );
                    if (confirmed) await state.signOut();
                  },
                ),
                SettingsRow(
                  key: const Key('delete-account'),
                  title: 'Delete account',
                  icon: Icons.delete_outline_rounded,
                  destructive: true,
                  onTap: _delete,
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(disclaimerFull, textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(fontSize: 11)),
            const SizedBox(height: 8),
            Text('Lexa $_version', textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(fontSize: 11)),
          ],
        ),
      ],
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _name = TextEditingController();
  String? _country;
  String? _stateName;
  String _language = 'en';
  ReferenceData? _data;
  bool _initialized = false;
  bool _busy = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    final profile = AppScope.read(context).profile;
    _name.text = profile?.fullName ?? '';
    _country = profile?.country;
    _stateName = profile?.state;
    _language = profile?.language ?? 'en';
    ReferenceData.load().then((data) {
      if (mounted) setState(() => _data = data);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    final navigator = Navigator.of(context);
    try {
      await state.repo.updateProfile({
        'full_name': _name.text.trim().isEmpty ? null : _name.text.trim(),
        'country': _country,
        'state_province': _stateName,
        'preferred_language': _language,
      });
      await state.refresh();
      navigator.pop();
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "We couldn't save that just now. Please try again.";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return LexaPage(
      title: 'Profile',
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 4),
            LabeledField(
              label: 'Your name',
              child: TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(hintText: 'Optional'),
              ),
            ),
            JurisdictionFields(
              country: _country,
              state: _stateName,
              onChanged: (country, state) => setState(() {
                _country = country;
                _stateName = state;
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
            if (_error != null) ...[
              Note(_error!, tone: NoteTone.error),
              const SizedBox(height: 12),
            ],
            LexaButton('Save changes', onPressed: _save, busy: _busy),
          ],
        ),
      ],
    );
  }
}
