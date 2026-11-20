import ActivityKit
import Foundation

/// Starts, updates, and ends Lexa's Live Activities.
final class LiveActivities {
  static let shared = LiveActivities()

  var isEnabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

  private func activity(id: String) -> Activity<LexaActivityAttributes>? {
    Activity<LexaActivityAttributes>.activities.first { $0.id == id }
  }

  /// Starts an activity, or returns nil where the device or user doesn't allow one.
  @discardableResult
  func start(
    kind: LexaActivityAttributes.Kind,
    title: String,
    headline: String,
    detail: String? = nil,
    expectedSeconds: TimeInterval? = nil,
    dueAt: Date? = nil,
    deepLink: String? = nil
  ) -> String? {
    guard isEnabled else { return nil }
    let now = Date()
    let state = LexaActivityAttributes.ContentState(
      phase: dueAt == nil ? .working : .counting,
      headline: headline,
      detail: detail,
      startedAt: now,
      expectedEnd: expectedSeconds.map { now.addingTimeInterval($0) },
      dueAt: dueAt
    )
    // Past this point a working activity can't be sure it's current, so the
    // widget switches to "open Lexa" rather than showing a frozen state.
    let staleDate = dueAt ?? expectedSeconds.map { now.addingTimeInterval($0 + 90) }
    do {
      let activity = try Activity.request(
        attributes: LexaActivityAttributes(kind: kind, title: title, deepLink: deepLink),
        content: .init(state: state, staleDate: staleDate),
        pushType: nil
      )
      return activity.id
    } catch {
      NSLog("[Lexa] Live Activity not started: \(error.localizedDescription)")
      return nil
    }
  }

  func update(id: String, headline: String?, detail: String?) async {
    guard let activity = activity(id: id) else { return }
    var state = activity.content.state
    if let headline { state.headline = headline }
    if let detail { state.detail = detail }
    await activity.update(.init(state: state, staleDate: activity.content.staleDate))
  }

  /// Settles an activity with a result. The alert makes the Dynamic Island pop
  /// open with the news, the way a delivery app announces an arrival.
  func finish(
    id: String,
    succeeded: Bool,
    headline: String,
    detail: String?,
    deepLink: String? = nil,
    holdSeconds: TimeInterval = 6
  ) async {
    guard let activity = activity(id: id) else { return }
    var state = activity.content.state
    state.phase = succeeded ? .done : .failed
    state.headline = headline
    state.detail = detail
    state.expectedEnd = nil
    let content = ActivityContent(state: state, staleDate: nil)
    await activity.update(
      content,
      alertConfiguration: AlertConfiguration(
        title: LocalizedStringResource(stringLiteral: headline),
        body: LocalizedStringResource(stringLiteral: detail ?? activity.attributes.title),
        sound: .default
      )
    )
    try? await Task.sleep(for: .seconds(holdSeconds))
    await activity.end(content, dismissalPolicy: .after(.now.addingTimeInterval(20 * 60)))
  }

  func end(id: String) async {
    await activity(id: id)?.end(nil, dismissalPolicy: .immediate)
  }

  /// Clears anything left over from a previous run that can no longer update.
  func endAllWorking() async {
    for activity in Activity<LexaActivityAttributes>.activities
    where activity.content.state.phase == .working {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  func activeDeadlineId(title: String) -> String? {
    Activity<LexaActivityAttributes>.activities.first {
      $0.attributes.kind == .deadline && $0.attributes.title == title
    }?.id
  }
}
