import StoreKit
import UIKit

/// App Store subscriptions through StoreKit 2. Signed transactions go to Lexa's
/// server, which verifies them against Apple's root certificate before unlocking
/// anything. The app never decides on its own that someone has paid.
final class Store {
  static let shared = Store()

  var onTransaction: ((String) -> Void)?
  private var updates: Task<Void, Never>?

  /// Renewals, refunds, and purchases made elsewhere arrive here at any time.
  func startListening() {
    guard updates == nil else { return }
    updates = Task.detached {
      for await update in Transaction.updates {
        if case .verified(let transaction) = update {
          await transaction.finish()
          let signed = update.jwsRepresentation
          await MainActor.run { Store.shared.onTransaction?(signed) }
        }
      }
    }
  }

  func products(ids: [String]) async throws -> [[String: Any]] {
    try await Product.products(for: ids).map { product in
      var item: [String: Any] = [
        "id": product.id,
        "title": product.displayName,
        "description": product.description,
        "price": product.displayPrice,
      ]
      if let period = product.subscription?.subscriptionPeriod {
        item["period"] = Self.describe(period)
      }
      return item
    }
  }

  /// Returns a status of purchased, cancelled, pending, or unverified.
  func purchase(id: String, accountToken: UUID?) async throws -> [String: Any] {
    guard let product = try await Product.products(for: [id]).first else {
      return ["status": "unavailable"]
    }
    let options: Set<Product.PurchaseOption> = accountToken.map { [.appAccountToken($0)] } ?? []
    switch try await product.purchase(options: options) {
    case .success(let verification):
      guard case .verified(let transaction) = verification else {
        return ["status": "unverified"]
      }
      await transaction.finish()
      return ["status": "purchased", "transaction": verification.jwsRepresentation]
    case .userCancelled:
      return ["status": "cancelled"]
    case .pending:
      return ["status": "pending"]
    @unknown default:
      return ["status": "cancelled"]
    }
  }

  /// Signed transactions for every subscription the Apple account currently has.
  func currentEntitlements() async -> [String] {
    var signed: [String] = []
    for await entitlement in Transaction.currentEntitlements {
      if case .verified = entitlement { signed.append(entitlement.jwsRepresentation) }
    }
    return signed
  }

  /// Restore Purchases: asks the App Store to sync, then reports what's active.
  func restore() async throws -> [String] {
    try await AppStore.sync()
    return await currentEntitlements()
  }

  @MainActor
  func manageSubscriptions() async throws {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
    guard let scene else { return }
    try await AppStore.showManageSubscriptions(in: scene)
  }

  private static func describe(_ period: Product.SubscriptionPeriod) -> String {
    let unit: String
    switch period.unit {
    case .day: unit = "day"
    case .week: unit = "week"
    case .month: unit = "month"
    case .year: unit = "year"
    @unknown default: unit = "period"
    }
    return period.value == 1 ? unit : "\(period.value) \(unit)s"
  }
}
