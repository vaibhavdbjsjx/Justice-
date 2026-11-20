import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    super.scene(scene, willConnectTo: session, options: connectionOptions)
    routeLexaLink(from: connectionOptions.urlContexts)
  }

  override func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    super.scene(scene, openURLContexts: URLContexts)
    routeLexaLink(from: URLContexts)
  }

  /// Taps on a Live Activity arrive as lexa:// links. Anything else, such as an
  /// auth callback, belongs to the plugins handled by super.
  private func routeLexaLink(from contexts: Set<UIOpenURLContext>) {
    guard let url = contexts.first?.url, url.scheme == "lexa" else { return }
    LexaNative.shared.open(link: url.absoluteString)
  }
}
