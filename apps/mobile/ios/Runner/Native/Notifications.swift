import Foundation
import UserNotifications

/// Local notifications for deadlines and finished work. Permission is requested
/// only when someone turns reminders on; nothing in the app requires it.
final class Notifications: NSObject, UNUserNotificationCenterDelegate {
  static let shared = Notifications()

  var onOpenLink: ((String) -> Void)?

  func install() {
    UNUserNotificationCenter.current().delegate = self
  }

  func status() async -> String {
    let settings = await UNUserNotificationCenter.current().notificationSettings()
    switch settings.authorizationStatus {
    case .authorized, .provisional, .ephemeral: return "granted"
    case .denied: return "denied"
    default: return "undetermined"
    }
  }

  func request() async -> Bool {
    (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
  }

  func schedule(
    id: String,
    title: String,
    body: String,
    at date: Date?,
    link: String?,
    timeSensitive: Bool
  ) async throws {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    content.threadIdentifier = "lexa"
    content.interruptionLevel = timeSensitive ? .timeSensitive : .active
    if let link { content.userInfo = ["link": link] }

    var trigger: UNNotificationTrigger?
    if let date {
      guard date > Date() else { return }
      let parts = Calendar.current.dateComponents(
        [.year, .month, .day, .hour, .minute, .second],
        from: date
      )
      trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
    }
    try await UNUserNotificationCenter.current().add(
      UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    )
  }

  func cancelAll(prefix: String) async {
    let center = UNUserNotificationCenter.current()
    let ids = await center.pendingNotificationRequests()
      .map(\.identifier)
      .filter { $0.hasPrefix(prefix) }
    center.removePendingNotificationRequests(withIdentifiers: ids)
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .list, .sound]
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    if let link = response.notification.request.content.userInfo["link"] as? String {
      await MainActor.run { onOpenLink?(link) }
    }
  }
}
