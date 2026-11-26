import 'package:flutter/material.dart';
import '../native/native_bridge.dart';
import '../services/store_service.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';

/// Shows the plans, with App Store prices and everything Apple asks to be stated
/// before someone subscribes (Guideline 3.1.2). Skipped where payments are off.
Future<void> showPaywall(BuildContext context, {String? reason}) async {
  await Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => PaywallScreen(reason: reason),
    ),
  );
}

class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key, this.reason});

  final String? reason;

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  List<StoreProduct>? _products;
  bool _loadFailed = false;
  bool _busy = false;
  bool _restoring = false;
  String? _message;
  bool _messageIsError = true;
  bool _yearly = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _loadFailed = false);
    try {
      final products = await AppScope.read(context).store.products();
      if (mounted) {
        setState(() {
          _products = products;
          _loadFailed = products.isEmpty;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadFailed = true);
    }
  }

  Future<void> _buy(StoreProduct product) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    final state = AppScope.read(context);
    final navigator = Navigator.of(context);
    final outcome = await state.store.purchase(product.id);
    if (!mounted) return;
    switch (outcome.kind) {
      case PurchaseOutcomeKind.purchased:
        navigator.pop();
        return;
      case PurchaseOutcomeKind.cancelled:
        break;
      case PurchaseOutcomeKind.pending:
        _message = outcome.message;
        _messageIsError = false;
      case PurchaseOutcomeKind.failed:
        _message = outcome.message;
        _messageIsError = true;
    }
    setState(() => _busy = false);
  }

  Future<void> _restore() async {
    setState(() {
      _restoring = true;
      _message = null;
    });
    final state = AppScope.read(context);
    final navigator = Navigator.of(context);
    final outcome = await state.store.restore();
    if (!mounted) return;
    if (outcome.kind == PurchaseOutcomeKind.purchased) {
      navigator.pop();
      return;
    }
    setState(() {
      _restoring = false;
      _message = outcome.message;
      _messageIsError = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = AppScope.of(context);
    final lawyer = state.profile?.isLawyer ?? false;
    final monthlyId = lawyer ? state.remote.professionalProduct : state.remote.plusProduct;
    final yearlyId = lawyer ? state.remote.professionalYearlyProduct : state.remote.plusYearlyProduct;
    final features = lawyer ? state.remote.professionalFeatures : state.remote.plusFeatures;
    final products = _products;
    StoreProduct? monthly;
    StoreProduct? yearly;
    for (final p in products ?? const <StoreProduct>[]) {
      if (p.id == monthlyId) monthly = p;
      if (p.id == yearlyId) yearly = p;
    }
    // Yearly is offered only when the App Store returns it; otherwise monthly.
    final product = (_yearly && yearly != null) ? yearly : (monthly ?? yearly);
    final period = product?.period ?? 'month';

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: IconActionButton(
                      icon: Icons.close_rounded,
                      tooltip: 'Close',
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Reveal(child: Center(child: LexaCoin(size: 88, spin: false))),
                        const SizedBox(height: 18),
                        Reveal(
                          index: 1,
                          child: Text(
                            lawyer ? 'Lexa Professional' : 'Lexa Plus',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.displayMedium,
                          ),
                        ).center(),
                        const SizedBox(height: 8),
                        Reveal(
                          index: 2,
                          child: Text(
                            widget.reason ??
                                (lawyer
                                    ? 'Research, drafting, and client tools for your practice.'
                                    : 'Know where you stand, without limits.'),
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyLarge?.copyWith(color: context.mutedColor),
                          ),
                        ).center(),
                        const SizedBox(height: 22),
                        for (var i = 0; i < features.length; i++)
                          Reveal(
                            index: i + 3,
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 11),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(Icons.check_circle_rounded, size: 20, color: context.accentColor),
                                  const SizedBox(width: 11),
                                  Expanded(child: Text(features[i], style: theme.textTheme.bodyMedium)),
                                ],
                              ),
                            ),
                          ),
                        const SizedBox(height: 8),
                        Text(
                          'Lexa provides legal information, not legal advice. A subscription does not create an attorney-client relationship.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_message != null) ...[
                        Note(_message!, tone: _messageIsError ? NoteTone.error : NoteTone.info),
                        const SizedBox(height: 10),
                      ],
                      if (products == null && !_loadFailed)
                        const Skeleton(height: 54, radius: 16)
                      else if (product == null)
                        Note(
                          "Plans aren't available right now. Please check your connection and try again.",
                          tone: NoteTone.error,
                          action: 'Try again',
                          onAction: _load,
                        )
                      else ...[
                        if (monthly != null && yearly != null) ...[
                          _PeriodPicker(
                            yearly: product == yearly,
                            monthlyPrice: monthly.price,
                            yearlyPrice: yearly.price,
                            onChanged: _busy || _restoring ? null : (v) => setState(() => _yearly = v),
                          ),
                          const SizedBox(height: 12),
                        ],
                        Text(
                          '${product.price} per $period',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 10),
                        LexaButton(
                          'Subscribe',
                          key: const Key('paywall-subscribe'),
                          busy: _busy,
                          onPressed: _restoring ? null : () => _buy(product),
                        ),
                      ],
                      const SizedBox(height: 4),
                      LexaButton(
                        'Restore Purchases',
                        key: const Key('paywall-restore'),
                        style: LexaButtonStyle.ghost,
                        busy: _restoring,
                        onPressed: _busy ? null : _restore,
                      ),
                      Text(
                        'Renews automatically each $period at the price shown until cancelled. '
                        'Payment is charged to your Apple account. Cancel at least 24 hours before the renewal date in your Apple account settings.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(fontSize: 11),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _LegalLink('Terms of Use', state.remote.termsUrl),
                          Text('  ·  ', style: theme.textTheme.bodySmall),
                          _LegalLink('Privacy Policy', state.remote.privacyUrl),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Monthly or yearly billing. Prices come straight from the App Store.
class _PeriodPicker extends StatelessWidget {
  const _PeriodPicker({
    required this.yearly,
    required this.monthlyPrice,
    required this.yearlyPrice,
    required this.onChanged,
  });

  final bool yearly;
  final String monthlyPrice;
  final String yearlyPrice;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _PeriodOption(
            key: const Key('paywall-monthly'),
            label: 'Monthly',
            price: monthlyPrice,
            selected: !yearly,
            onTap: onChanged == null ? null : () => onChanged!(false),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _PeriodOption(
            key: const Key('paywall-yearly'),
            label: 'Yearly',
            price: yearlyPrice,
            selected: yearly,
            onTap: onChanged == null ? null : () => onChanged!(true),
          ),
        ),
      ],
    );
  }
}

class _PeriodOption extends StatelessWidget {
  const _PeriodOption({
    super.key,
    required this.label,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String price;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = context.accentColor;
    return Semantics(
      button: true,
      selected: selected,
      label: '$label, $price',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? accent : theme.dividerColor,
              width: selected ? 2 : 1,
            ),
            color: selected ? accent.withValues(alpha: 0.08) : null,
          ),
          child: Column(
            children: [
              Text(label, style: theme.textTheme.labelLarge),
              const SizedBox(height: 2),
              Text(price, style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor)),
            ],
          ),
        ),
      ),
    );
  }
}

extension on Widget {
  Widget center() => Center(child: this);
}

class _LegalLink extends StatelessWidget {
  const _LegalLink(this.label, this.url);

  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => openLink(url),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: context.accentColor,
              decoration: TextDecoration.underline,
              decorationColor: context.accentColor,
            ),
      ),
    );
  }
}
