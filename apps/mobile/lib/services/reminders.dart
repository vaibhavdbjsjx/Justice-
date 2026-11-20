import '../data/repository.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';

/// Local reminders for deadlines, a week before, the day before, and the morning
/// of. Rebuilt whenever deadlines change, and capped because iOS only keeps a
/// limited number of pending notifications per app.
class Reminders {
  Reminders(this._repo, this._enabled);

  final Repository _repo;

  /// The switch in Account. System permission alone isn't enough to schedule.
  final bool Function() _enabled;

  static const _prefix = 'deadline-';
  static const _maxDeadlines = 18;
  static const _reminderHour = 9;

  Future<void> clear() => NativeBridge.instance.cancelNotifications(_prefix);

  Future<void> reschedule() async {
    final bridge = NativeBridge.instance;
    if (!_enabled() || await bridge.notificationStatus() != 'granted') return;

    final List<Deadline> deadlines;
    try {
      deadlines = await _repo.upcomingDeadlines();
    } catch (_) {
      return;
    }
    await clear();

    final soon = deadlines.where((d) => d.dueDate != null).take(_maxDeadlines);
    for (final deadline in soon) {
      final due = deadline.dueDate!;
      final reminders = <(int, String, bool)>[
        (7, 'Due in a week', false),
        (1, 'Due tomorrow', true),
        (0, 'Due today', true),
      ];
      for (final (daysBefore, title, urgent) in reminders) {
        final at = DateTime(
            due.year, due.month, due.day - daysBefore, _reminderHour);
        if (at.isBefore(DateTime.now())) continue;
        await bridge.scheduleNotification(
          id: '$_prefix${deadline.id}-$daysBefore',
          title: title,
          body: deadline.matterTitle == null
              ? deadline.title
              : '${deadline.title} · ${deadline.matterTitle}',
          at: at,
          link: 'lexa://matters/${deadline.matterId}',
          timeSensitive: urgent,
        );
      }
    }
  }
}
