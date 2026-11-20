import StoreKit
import StoreKitTest
import XCTest

@testable import Runner

/// Exercises the purchase flow against Lexa.storekit: buying, cancelling,
/// restoring, and expiring a subscription, through the same Store class the app
/// uses. Set LEXA_TEST_API (with LEXA_TEST_TOKEN) to also check the server unlocks
/// and relocks the plan.
final class StoreTests: XCTestCase {
  private let plus = "com.vaibhavsg.lexa.plus.monthly"
  private let professional = "com.vaibhavsg.lexa.professional.monthly"
  private var session: SKTestSession!

  override func setUpWithError() throws {
    session = try SKTestSession(configurationFileNamed: "Lexa")
    session.disableDialogs = true
    session.clearTransactions()
    session.resetToDefaultState()
    session.disableDialogs = true
  }

  override func tearDownWithError() throws {
    session.clearTransactions()
  }

  func testProductsMatchTheStorefront() async throws {
    let products = try await Store.shared.products(ids: [plus, professional])
    XCTAssertEqual(products.count, 2)
    let item = try XCTUnwrap(products.first { $0["id"] as? String == plus })
    XCTAssertEqual(item["title"] as? String, "Lexa Plus")
    XCTAssertEqual(item["period"] as? String, "month")
    XCTAssertTrue((item["price"] as? String)?.contains("9.99") == true)
  }

  func testYearlyPlansAreOnSale() async throws {
    let ids = ["com.vaibhavsg.lexa.plus.yearly", "com.vaibhavsg.lexa.professional.yearly"]
    let products = try await Store.shared.products(ids: ids)
    XCTAssertEqual(products.count, 2)
    XCTAssertTrue(products.allSatisfy { $0["period"] as? String == "year" })
  }

  func testUnknownProductIsReportedAsUnavailable() async throws {
    let result = try await Store.shared.purchase(id: "com.vaibhavsg.lexa.nope", accountToken: nil)
    XCTAssertEqual(result["status"] as? String, "unavailable")
  }

  func testBuyingGrantsAnEntitlementWithTheAccountToken() async throws {
    let account = UUID()
    let result = try await Store.shared.purchase(id: plus, accountToken: account)
    XCTAssertEqual(result["status"] as? String, "purchased")

    let signed = try XCTUnwrap(result["transaction"] as? String)
    let claims = try decodeClaims(signed)
    XCTAssertEqual(claims["productId"] as? String, plus)
    XCTAssertEqual((claims["appAccountToken"] as? String)?.lowercased(), account.uuidString.lowercased())

    let entitlements = await Store.shared.currentEntitlements()
    XCTAssertEqual(entitlements.count, 1)
    try await verifyServer(transactions: entitlements, expectedTier: "plus")
  }

  func testCancellingGrantsNothing() async throws {
    session.failTransactionsEnabled = true
    session.failureError = .paymentCancelled
    defer { session.failTransactionsEnabled = false }

    do {
      let result = try await Store.shared.purchase(id: plus, accountToken: nil)
      XCTAssertNotEqual(result["status"] as? String, "purchased")
    } catch {
      // StoreKit surfaces a forced failure as an error rather than a cancel.
    }
    let entitlements = await Store.shared.currentEntitlements()
    XCTAssertTrue(entitlements.isEmpty)
  }

  func testRestoreReturnsAnExistingSubscription() async throws {
    _ = try await session.buyProduct(identifier: plus)
    try await waitForEntitlement(count: 1)

    // AppStore.sync() needs a real Apple account, which a test session lacks, so
    // this checks what Restore reports afterward.
    let restored = await Store.shared.currentEntitlements()
    XCTAssertEqual(restored.count, 1)
    XCTAssertEqual(try decodeClaims(restored[0])["productId"] as? String, plus)
  }

  func testExpiryRemovesTheEntitlement() async throws {
    _ = try await Store.shared.purchase(id: plus, accountToken: nil)
    try await waitForEntitlement(count: 1)
    let active = await Store.shared.currentEntitlements()
    try await verifyServer(transactions: active, expectedTier: "plus")

    try session.expireSubscription(productIdentifier: plus)
    try await waitForEntitlement(count: 0)

    let claims = try decodeClaims(active[0])
    XCTAssertNotNil(claims["expiresDate"], "Subscriptions carry the date the server checks")
    let after = await Store.shared.currentEntitlements()
    XCTAssertTrue(after.isEmpty)

    // The expired transaction locks the plan again on the server.
    let latestResult = await Transaction.latest(for: plus)
    let latest = try XCTUnwrap(latestResult)
    try await verifyServer(transactions: [latest.jwsRepresentation], expectedTier: "free")
  }

  func testUpgradingWithinTheGroupKeepsOneSubscription() async throws {
    _ = try await Store.shared.purchase(id: plus, accountToken: nil)
    try await waitForEntitlement(count: 1)
    _ = try await Store.shared.purchase(id: professional, accountToken: nil)
    try await waitForEntitlement(count: 1, product: professional)
  }

  // MARK: Helpers

  private func waitForEntitlement(count: Int, product: String? = nil) async throws {
    for _ in 0..<40 {
      let current = await Store.shared.currentEntitlements()
      if current.count == count {
        if let product {
          if let first = current.first, try decodeClaims(first)["productId"] as? String == product { return }
        } else {
          return
        }
      }
      try await Task.sleep(for: .milliseconds(250))
    }
    XCTFail("Entitlements never reached \(count)")
  }

  private func decodeClaims(_ jws: String) throws -> [String: Any] {
    var payload = jws.split(separator: ".")[1]
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    while payload.count % 4 != 0 { payload += "=" }
    let data = try XCTUnwrap(Data(base64Encoded: payload))
    return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
  }

  private func verifyServer(transactions: [String], expectedTier: String) async throws {
    let env = ProcessInfo.processInfo.environment
    guard let base = env["LEXA_TEST_API"], let token = env["LEXA_TEST_TOKEN"] else { return }
    var request = URLRequest(url: try XCTUnwrap(URL(string: "\(base)/api/billing/apple/sync")))
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["transactions": transactions])
    let (data, response) = try await URLSession.shared.data(for: request)
    XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    let status = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    XCTAssertEqual(status["tier"] as? String, expectedTier)
  }
}
