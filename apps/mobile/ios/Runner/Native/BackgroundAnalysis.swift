import Foundation
import UIKit

/// Runs document analysis in a background URL session, so it carries on when
/// someone leaves the app. iOS completes the request and wakes the app, which then
/// settles the Live Activity and sends a notification. This is what lets the
/// Dynamic Island report a result without the app being open.
final class BackgroundAnalysis: NSObject, URLSessionDataDelegate {
  static let shared = BackgroundAnalysis()
  static let sessionIdentifier = "com.vaibhavsg.lexa.analysis"

  struct Job: Codable {
    var id: String
    var activityId: String?
    var title: String
    var bodyFile: String
  }

  /// Called with (jobId, statusCode, responseBody) when a request finishes.
  var onFinished: ((String, Int, String) -> Void)?
  /// Handed over by the app delegate when iOS wakes the app for this session.
  var systemCompletion: (() -> Void)?

  private var received: [Int: Data] = [:]
  private let lock = NSLock()

  private lazy var session: URLSession = {
    let configuration = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
    configuration.isDiscretionary = false
    configuration.sessionSendsLaunchEvents = true
    configuration.timeoutIntervalForRequest = 180
    configuration.timeoutIntervalForResource = 600
    return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }()

  func wake() {
    _ = session
  }

  /// Starts an upload from an already-built request body on disk.
  func start(
    url: URL,
    token: String,
    contentType: String,
    bodyFile: URL,
    title: String,
    expectedSeconds: TimeInterval
  ) -> String {
    let jobId = UUID().uuidString
    let activityId = LiveActivities.shared.start(
      kind: .analysis,
      title: title,
      headline: "Reading your document",
      detail: "Lexa is going through it clause by clause.",
      expectedSeconds: expectedSeconds,
      deepLink: "lexa://documents"
    )

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue(contentType, forHTTPHeaderField: "Content-Type")

    let task = session.uploadTask(with: request, fromFile: bodyFile)
    let job = Job(id: jobId, activityId: activityId, title: title, bodyFile: bodyFile.path)
    task.taskDescription = (try? JSONEncoder().encode(job)).flatMap { String(data: $0, encoding: .utf8) }
    task.resume()
    if let activityId { stepThroughStages(activityId: activityId) }
    return jobId
  }

  /// Friendly stages while the app is running. If the app is suspended the
  /// progress animation keeps moving on its own.
  private func stepThroughStages(activityId: String) {
    let stages: [(Double, String, String)] = [
      (7, "Finding obligations", "What you have to do, and by when."),
      (15, "Checking for risky clauses", "One-sided terms, waivers, and hidden fees."),
      (26, "Writing it in plain language", "Almost there."),
    ]
    for (delay, headline, detail) in stages {
      Task {
        try? await Task.sleep(for: .seconds(delay))
        await LiveActivities.shared.update(id: activityId, headline: headline, detail: detail)
      }
    }
  }

  // MARK: URLSession

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    lock.lock()
    received[dataTask.taskIdentifier, default: Data()].append(data)
    lock.unlock()
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    lock.lock()
    let data = received.removeValue(forKey: task.taskIdentifier) ?? Data()
    lock.unlock()

    guard
      let description = task.taskDescription?.data(using: .utf8),
      let job = try? JSONDecoder().decode(Job.self, from: description)
    else { return }
    try? FileManager.default.removeItem(atPath: job.bodyFile)

    let status = (task.response as? HTTPURLResponse)?.statusCode ?? 0
    let body = String(data: data, encoding: .utf8) ?? ""
    let succeeded = error == nil && status == 200

    // Keep the process alive long enough to settle the activity and notify.
    let background = BackgroundTask.begin(name: "lexa-analysis-finish")
    Task {
      await announce(job: job, succeeded: succeeded, body: body)
      await MainActor.run {
        self.onFinished?(job.id, error == nil ? status : 0, body)
        BackgroundTask.end(background)
      }
    }
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    DispatchQueue.main.async {
      self.systemCompletion?()
      self.systemCompletion = nil
    }
  }

  private func announce(job: Job, succeeded: Bool, body: String) async {
    var headline = "Your document is ready"
    var detail = "Tap to read the plain-language summary."
    var link = "lexa://documents"

    if succeeded,
      let data = body.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    {
      if let documentId = json["documentId"] as? String { link = "lexa://documents/\(documentId)" }
      let analysis = json["analysis"] as? [String: Any]
      let flagged = (analysis?["risky_or_unusual_clauses"] as? [Any])?.count ?? 0
      if flagged > 0 {
        detail = "\(flagged) clause\(flagged == 1 ? "" : "s") worth a closer look."
      }
    } else if !succeeded {
      headline = "Couldn't finish reading it"
      detail = "Nothing was lost. Open Lexa to try again."
    }

    let state = await MainActor.run { UIApplication.shared.applicationState }
    if state != .active {
      try? await Notifications.shared.schedule(
        id: "analysis-\(job.id)",
        title: headline,
        body: "\(job.title): \(detail)",
        at: nil,
        link: link,
        timeSensitive: false
      )
    }
    if let activityId = job.activityId {
      await LiveActivities.shared.finish(
        id: activityId,
        succeeded: succeeded,
        headline: headline,
        detail: detail,
        holdSeconds: state == .active ? 4 : 8
      )
    }
  }
}

/// Short background time to finish work already in progress.
enum BackgroundTask {
  static func begin(name: String) -> UIBackgroundTaskIdentifier {
    var identifier = UIBackgroundTaskIdentifier.invalid
    DispatchQueue.main.sync(execute: {
      identifier = UIApplication.shared.beginBackgroundTask(withName: name) {
        UIApplication.shared.endBackgroundTask(identifier)
        identifier = .invalid
      }
    })
    return identifier
  }

  static func end(_ identifier: UIBackgroundTaskIdentifier) {
    guard identifier != .invalid else { return }
    UIApplication.shared.endBackgroundTask(identifier)
  }
}
