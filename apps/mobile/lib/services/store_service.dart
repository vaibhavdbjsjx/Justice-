import 'dart:async';
import '../api/client.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';

class PurchaseOutcome {
  PurchaseOutcome(this.kind, [this.message]);
  final PurchaseOutcomeKind kind;
  final String? message;
}

enum PurchaseOutcomeKind { purchased, cancelled, pending, failed }

/// App Store subscriptions. StoreKit handles the payment, and the server verifies
/// Apple's signature before unlocking anything, so the plan on the account is
/// always the source of truth.
class StoreService {
  StoreService(this._api, this._state) {
    NativeBridge.instance.storeTransactions.listen((signed) {
      unawaited(_sync([signed]));
    });
  }

  final LexaApi _api;
  final AppState _state;

  NativeBridge get _bridge => NativeBridge.instance;

  Future<List<StoreProduct>> products() => _bridge.products([
        _state.remote.plusProduct,
        _state.remote.professionalProduct,
        _state.remote.plusYearlyProduct,
        _state.remote.professionalYearlyProduct,
      ]);

  Future<BillingStatus?> _sync(List<String> transactions) async {
    if (transactions.isEmpty || _state.session == null) return null;
    try {
      final status = await _api.syncAppleTransactions(transactions);
      _state.setBilling(status);
      return status;
    } catch (_) {
      // Entitlements are re-sent on the next launch, so nothing is lost.
      return null;
    }
  }

  /// Renewals and expiries that happened while the app was closed.
  Future<void> syncEntitlements() async {
    if (_state.session == null) return;
    await _sync(await _bridge.storeEntitlements());
  }

  Future<PurchaseOutcome> purchase(String productId) async {
    final StorePurchaseResult result;
    try {
      result = await _bridge.purchase(productId, accountToken: _state.user?.id);
    } catch (_) {
      return PurchaseOutcome(PurchaseOutcomeKind.failed,
          "The App Store couldn't complete that. You haven't been charged.");
    }
    switch (result.status) {
      case 'purchased':
        try {
          _state.setBilling(
              await _api.syncAppleTransactions([result.transaction!]));
          return PurchaseOutcome(PurchaseOutcomeKind.purchased);
        } on ApiException {
          return PurchaseOutcome(PurchaseOutcomeKind.failed,
              "Your purchase went through, but we couldn't confirm it just now. Check your connection, then tap Restore Purchases.");
        }
      case 'cancelled':
        return PurchaseOutcome(PurchaseOutcomeKind.cancelled);
      case 'pending':
        return PurchaseOutcome(PurchaseOutcomeKind.pending,
            'This purchase is waiting for approval. Your plan updates as soon as it goes through.');
      default:
        return PurchaseOutcome(PurchaseOutcomeKind.failed,
            "This plan isn't available right now. Please try again later.");
    }
  }

  /// Restore Purchases. Returns the active plan, or null if nothing was found.
  Future<PurchaseOutcome> restore() async {
    final List<String> transactions;
    try {
      transactions = await _bridge.restorePurchases();
    } catch (_) {
      return PurchaseOutcome(PurchaseOutcomeKind.failed,
          "We couldn't reach the App Store. Please try again.");
    }
    if (transactions.isEmpty) {
      return PurchaseOutcome(PurchaseOutcomeKind.failed,
          'No active subscription was found for this Apple account.');
    }
    final status = await _sync(transactions);
    if (status == null) {
      return PurchaseOutcome(PurchaseOutcomeKind.failed,
          "We couldn't confirm that with the App Store. Please try again.");
    }
    return PurchaseOutcome(PurchaseOutcomeKind.purchased);
  }

  Future<void> manageSubscriptions() => _bridge.manageSubscriptions();
}
