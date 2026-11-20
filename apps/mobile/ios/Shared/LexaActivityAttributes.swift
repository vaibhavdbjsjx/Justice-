import ActivityKit
import Foundation

/// The data behind Lexa's Live Activities: Dynamic Island and Lock Screen. Shared
/// by the app, which starts and updates them, and the widget extension, which
/// draws them.
struct LexaActivityAttributes: ActivityAttributes {
  enum Kind: String, Codable, Hashable {
    case analysis
    case drafting
    case answer
    case deadline
  }

  enum Phase: String, Codable, Hashable {
    case working
    case done
    case failed
    case counting
  }

  struct ContentState: Codable, Hashable {
    var phase: Phase
    var headline: String
    var detail: String?
    var startedAt: Date
    /// Drives a smooth progress animation that needs no further updates, so it
    /// keeps moving even while the app is suspended.
    var expectedEnd: Date?
    /// The moment a deadline countdown reaches zero.
    var dueAt: Date?
  }

  var kind: Kind
  var title: String
  var deepLink: String?
}
