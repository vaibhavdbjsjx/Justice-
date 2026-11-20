import ActivityKit
import SwiftUI
import WidgetKit

private enum Brand {
  static let orange = Color(red: 0xC1 / 255, green: 0x5F / 255, blue: 0x3C / 255)
  static let bright = Color(red: 0xE0 / 255, green: 0x8E / 255, blue: 0x70 / 255)
  static let ink = Color(red: 0x1F / 255, green: 0x1E / 255, blue: 0x1D / 255)
  static let sage = Color(red: 0x8F / 255, green: 0xAE / 255, blue: 0x83 / 255)
  static let alert = Color(red: 0xE8 / 255, green: 0x70 / 255, blue: 0x5A / 255)
}

struct LexaLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LexaActivityAttributes.self) { context in
      LockScreenView(context: context)
        .activityBackgroundTint(Brand.ink.opacity(0.92))
        .activitySystemActionForegroundColor(.white)
        .widgetURL(deepLink(context))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            LexaMark(size: 22)
            Text(kindLabel(context.attributes.kind))
              .font(.caption.weight(.semibold))
              .foregroundStyle(Brand.bright)
          }
          .padding(.leading, 4)
          .padding(.top, 2)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ExpandedTrailing(context: context)
            .padding(.trailing, 4)
            .padding(.top, 2)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text(context.attributes.title)
              .font(.headline)
              .foregroundStyle(.white)
              .lineLimit(1)
            Text(statusLine(context))
              .font(.subheadline)
              .foregroundStyle(.white.opacity(0.72))
              .lineLimit(2)
              .contentTransition(.opacity)
            ProgressLine(state: context.state)
              .padding(.top, 2)
          }
          .padding(.horizontal, 6)
          .padding(.top, 2)
        }
      } compactLeading: {
        LexaMark(size: 20)
      } compactTrailing: {
        CompactTrailing(state: context.state)
      } minimal: {
        CompactTrailing(state: context.state)
      }
      .keylineTint(Brand.orange)
      .widgetURL(deepLink(context))
    }
  }

  private func deepLink(_ context: ActivityViewContext<LexaActivityAttributes>) -> URL? {
    context.attributes.deepLink.flatMap(URL.init(string:))
  }
}

private func kindLabel(_ kind: LexaActivityAttributes.Kind) -> String {
  switch kind {
  case .analysis: return "Document"
  case .drafting: return "Drafting"
  case .answer: return "Assistant"
  case .deadline: return "Deadline"
  }
}

private func statusLine(_ context: ActivityViewContext<LexaActivityAttributes>) -> String {
  if context.isStale, context.state.phase == .working {
    return "Open Lexa to see the result."
  }
  return context.state.detail ?? context.state.headline
}

/// The Lexa balance mark, tinted to the brand color.
private struct LexaMark: View {
  let size: CGFloat

  var body: some View {
    Image("LexaMark")
      .resizable()
      .renderingMode(.template)
      .scaledToFit()
      .frame(width: size, height: size)
      .foregroundStyle(Brand.bright)
  }
}

/// A ring that fills on its own between two dates, or a settled state icon.
private struct CompactTrailing: View {
  let state: LexaActivityAttributes.ContentState

  var body: some View {
    switch state.phase {
    case .done:
      Image(systemName: "checkmark.circle.fill")
        .foregroundStyle(Brand.sage)
        .transition(.scale.combined(with: .opacity))
    case .failed:
      Image(systemName: "exclamationmark.circle.fill")
        .foregroundStyle(Brand.alert)
    case .counting:
      if let dueAt = state.dueAt, dueAt > .now {
        Text(timerInterval: Date.now...dueAt, countsDown: true, showsHours: true)
          .font(.caption2.monospacedDigit().weight(.semibold))
          .foregroundStyle(Brand.bright)
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 52)
      } else {
        Image(systemName: "clock.badge.exclamationmark")
          .foregroundStyle(Brand.alert)
      }
    case .working:
      if let end = state.expectedEnd, end > state.startedAt {
        ProgressView(
          timerInterval: state.startedAt...end,
          countsDown: false,
          label: { EmptyView() },
          currentValueLabel: { EmptyView() }
        )
        .progressViewStyle(.circular)
        .tint(Brand.bright)
        .frame(width: 20, height: 20)
      } else {
        ProgressView().tint(Brand.bright)
      }
    }
  }
}

private struct ExpandedTrailing: View {
  let context: ActivityViewContext<LexaActivityAttributes>

  var body: some View {
    let state = context.state
    switch state.phase {
    case .done:
      Label("Ready", systemImage: "checkmark.circle.fill")
        .labelStyle(.titleAndIcon)
        .font(.caption.weight(.semibold))
        .foregroundStyle(Brand.sage)
    case .failed:
      Label("Stopped", systemImage: "exclamationmark.circle.fill")
        .font(.caption.weight(.semibold))
        .foregroundStyle(Brand.alert)
    case .counting:
      if let dueAt = state.dueAt, dueAt > .now {
        Text(timerInterval: Date.now...dueAt, countsDown: true, showsHours: true)
          .font(.title3.monospacedDigit().weight(.semibold))
          .foregroundStyle(.white)
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 110)
      } else {
        Text("Due now")
          .font(.caption.weight(.semibold))
          .foregroundStyle(Brand.alert)
      }
    case .working:
      Text(timerInterval: state.startedAt...Date.distantFuture, countsDown: false)
        .font(.caption.monospacedDigit().weight(.medium))
        .foregroundStyle(.white.opacity(0.72))
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 60)
    }
  }
}

/// A bar that advances by itself, so it stays alive with the app suspended.
private struct ProgressLine: View {
  let state: LexaActivityAttributes.ContentState

  var body: some View {
    switch state.phase {
    case .working:
      if let end = state.expectedEnd, end > state.startedAt {
        ProgressView(
          timerInterval: state.startedAt...end,
          countsDown: false,
          label: { EmptyView() },
          currentValueLabel: { EmptyView() }
        )
        .progressViewStyle(.linear)
        .tint(Brand.bright)
      }
    case .done:
      ProgressView(value: 1).progressViewStyle(.linear).tint(Brand.sage)
    case .counting, .failed:
      EmptyView()
    }
  }
}

private struct LockScreenView: View {
  let context: ActivityViewContext<LexaActivityAttributes>

  var body: some View {
    let state = context.state
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .center, spacing: 12) {
        ZStack {
          Circle().fill(Brand.orange.opacity(0.22))
          LexaMark(size: 22)
        }
        .frame(width: 40, height: 40)

        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.title)
            .font(.headline)
            .foregroundStyle(.white)
            .lineLimit(1)
          Text(statusLine(context))
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.72))
            .lineLimit(2)
        }
        Spacer(minLength: 8)
        ExpandedTrailing(context: context)
      }
      ProgressLine(state: state)
    }
    .padding(16)
  }
}
