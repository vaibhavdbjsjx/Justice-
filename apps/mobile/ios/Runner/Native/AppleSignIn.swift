import AuthenticationServices
import CryptoKit
import UIKit

/// Native Sign in with Apple. Returns the identity token and the raw nonce so the
/// app can exchange them for a session with Supabase.
final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate,
  ASAuthorizationControllerPresentationContextProviding
{
  static let shared = AppleSignIn()

  private var completion: (([String: Any]?, Error?) -> Void)?
  private var rawNonce = ""

  func start(completion: @escaping ([String: Any]?, Error?) -> Void) {
    self.completion = completion
    rawNonce = UUID().uuidString + UUID().uuidString

    let request = ASAuthorizationAppleIDProvider().createRequest()
    request.requestedScopes = [.fullName, .email]
    request.nonce = SHA256.hash(data: Data(rawNonce.utf8))
      .map { String(format: "%02x", $0) }
      .joined()

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow } ?? ASPresentationAnchor()
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    guard
      let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
      let tokenData = credential.identityToken,
      let token = String(data: tokenData, encoding: .utf8)
    else {
      completion?(nil, nil)
      completion = nil
      return
    }
    var result: [String: Any] = ["idToken": token, "nonce": rawNonce]
    let name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .compactMap { $0 }
      .joined(separator: " ")
    if !name.isEmpty { result["fullName"] = name }
    completion?(result, nil)
    completion = nil
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithError error: Error
  ) {
    let cancelled = (error as? ASAuthorizationError)?.code == .canceled
    completion?(nil, cancelled ? nil : error)
    completion = nil
  }
}
