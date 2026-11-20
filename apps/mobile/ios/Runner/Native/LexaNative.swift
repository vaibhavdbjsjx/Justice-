import Flutter
import UIKit

/// The bridge between Dart and iOS: one method channel routing to focused helpers.
final class LexaNative: NSObject {
  static let shared = LexaNative()

  private var channel: FlutterMethodChannel?
  private var motionChannel: FlutterEventChannel?
  private let motion = Motion()
  private var pendingLink: String?

  func attach(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "app.lexa/native", binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, result in
      self?.handle(call, result: result)
    }
    self.channel = channel

    let motionChannel = FlutterEventChannel(name: "app.lexa/motion", binaryMessenger: messenger)
    motionChannel.setStreamHandler(motion)
    self.motionChannel = motionChannel

    Notifications.shared.onOpenLink = { [weak self] link in self?.open(link: link) }
    BackgroundAnalysis.shared.onFinished = { [weak self] id, status, body in
      self?.channel?.invokeMethod("analysis.finished", arguments: ["id": id, "status": status, "body": body])
    }
    Store.shared.onTransaction = { [weak self] signed in
      self?.channel?.invokeMethod("store.transaction", arguments: ["transaction": signed])
    }
    Store.shared.startListening()
    BackgroundAnalysis.shared.wake()
  }

  /// A lexa:// link from a notification or Live Activity.
  func open(link: String) {
    if let channel {
      channel.invokeMethod("link.open", arguments: ["link": link]) { [weak self] response in
        // Dart wasn't listening yet: hold it for when the app asks.
        if response is FlutterError || (response as? NSObject) === FlutterMethodNotImplemented {
          self?.pendingLink = link
        }
      }
    } else {
      pendingLink = link
    }
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]

    func runAsync(_ work: @escaping () async throws -> Any?) {
      Task { @MainActor in
        do {
          result(try await work())
        } catch {
          result(FlutterError(code: "native", message: error.localizedDescription, details: nil))
        }
      }
    }

    switch call.method {
    case "link.initial":
      result(pendingLink)
      pendingLink = nil

    case "app.version":
      let info = Bundle.main.infoDictionary
      let version = info?["CFBundleShortVersionString"] as? String ?? ""
      let build = info?["CFBundleVersion"] as? String ?? ""
      result("\(version) (\(build))")

    // MARK: Live Activities
    case "liveActivity.isEnabled":
      result(LiveActivities.shared.isEnabled)
    case "liveActivity.start":
      let kind = LexaActivityAttributes.Kind(rawValue: args["kind"] as? String ?? "") ?? .answer
      result(
        LiveActivities.shared.start(
          kind: kind,
          title: args["title"] as? String ?? "Lexa",
          headline: args["headline"] as? String ?? "Working on it",
          detail: args["detail"] as? String,
          expectedSeconds: (args["expectedSeconds"] as? NSNumber)?.doubleValue,
          dueAt: (args["dueAtMs"] as? NSNumber).map { Date(timeIntervalSince1970: $0.doubleValue / 1000) },
          deepLink: args["deepLink"] as? String
        ))
    case "liveActivity.update":
      runAsync {
        await LiveActivities.shared.update(
          id: args["id"] as? String ?? "",
          headline: args["headline"] as? String,
          detail: args["detail"] as? String
        )
        return nil
      }
    case "liveActivity.finish":
      runAsync {
        await LiveActivities.shared.finish(
          id: args["id"] as? String ?? "",
          succeeded: args["succeeded"] as? Bool ?? true,
          headline: args["headline"] as? String ?? "Done",
          detail: args["detail"] as? String
        )
        return nil
      }
    case "liveActivity.end":
      runAsync {
        await LiveActivities.shared.end(id: args["id"] as? String ?? "")
        return nil
      }
    case "liveActivity.endAllWorking":
      runAsync {
        await LiveActivities.shared.endAllWorking()
        return nil
      }
    case "liveActivity.deadlineId":
      result(LiveActivities.shared.activeDeadlineId(title: args["title"] as? String ?? ""))

    // MARK: Notifications
    case "notifications.status":
      runAsync { await Notifications.shared.status() }
    case "notifications.request":
      runAsync { await Notifications.shared.request() }
    case "notifications.schedule":
      runAsync {
        try await Notifications.shared.schedule(
          id: args["id"] as? String ?? UUID().uuidString,
          title: args["title"] as? String ?? "Lexa",
          body: args["body"] as? String ?? "",
          at: (args["atMs"] as? NSNumber).map { Date(timeIntervalSince1970: $0.doubleValue / 1000) },
          link: args["link"] as? String,
          timeSensitive: args["timeSensitive"] as? Bool ?? false
        )
        return nil
      }
    case "notifications.cancelAll":
      runAsync {
        await Notifications.shared.cancelAll(prefix: args["prefix"] as? String ?? "")
        return nil
      }

    // MARK: App Store
    case "store.products":
      runAsync { try await Store.shared.products(ids: args["ids"] as? [String] ?? []) }
    case "store.purchase":
      runAsync {
        try await Store.shared.purchase(
          id: args["id"] as? String ?? "",
          accountToken: (args["accountToken"] as? String).flatMap(UUID.init(uuidString:))
        )
      }
    case "store.entitlements":
      runAsync { await Store.shared.currentEntitlements() }
    case "store.restore":
      runAsync { try await Store.shared.restore() }
    case "store.manage":
      runAsync {
        try await Store.shared.manageSubscriptions()
        return nil
      }

    // MARK: Documents
    case "picker.document":
      Pickers.shared.pickDocument { result($0) }
    case "picker.photo":
      Pickers.shared.pickPhoto { result($0) }
    case "picker.scan":
      Pickers.shared.scan { result($0) }
    case "picker.canScan":
      result(Pickers.shared.canScan)
    case "analysis.start":
      guard
        let urlString = args["url"] as? String,
        let url = URL(string: urlString),
        let token = args["token"] as? String,
        let bodyPath = args["bodyPath"] as? String
      else {
        result(FlutterError(code: "args", message: "Missing analysis arguments", details: nil))
        return
      }
      result(
        BackgroundAnalysis.shared.start(
          url: url,
          token: token,
          contentType: args["contentType"] as? String ?? "application/octet-stream",
          bodyFile: URL(fileURLWithPath: bodyPath),
          title: args["title"] as? String ?? "Your document",
          expectedSeconds: (args["expectedSeconds"] as? NSNumber)?.doubleValue ?? 35
        ))

    // MARK: Sharing
    case "share.file":
      share(items: [URL(fileURLWithPath: args["path"] as? String ?? "")], result: result)
    case "share.text":
      share(items: [args["text"] as? String ?? ""], result: result)

    // MARK: Sign in with Apple
    case "appleSignIn.start":
      AppleSignIn.shared.start { value, error in
        if let error {
          result(FlutterError(code: "apple", message: error.localizedDescription, details: nil))
        } else {
          result(value)
        }
      }

    // MARK: Background time
    case "background.begin":
      result(BackgroundTask.begin(name: "lexa-streaming").rawValue)
    case "background.end":
      if let raw = (args["id"] as? NSNumber)?.intValue {
        BackgroundTask.end(UIBackgroundTaskIdentifier(rawValue: raw))
      }
      result(nil)

    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func share(items: [Any], result: @escaping FlutterResult) {
    let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
    var top = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow }?
      .rootViewController
    while let presented = top?.presentedViewController { top = presented }
    // On iPad a share sheet needs an anchor.
    if let popover = controller.popoverPresentationController, let view = top?.view {
      popover.sourceView = view
      popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
      popover.permittedArrowDirections = []
    }
    top?.present(controller, animated: true) { result(nil) }
  }
}
