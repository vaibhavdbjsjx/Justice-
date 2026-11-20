import 'package:flutter/cupertino.dart' show CupertinoDatePicker, CupertinoDatePickerMode, CupertinoTextThemeData, CupertinoTheme, CupertinoThemeData;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/models.dart';
import '../theme/theme.dart';
import 'ui.dart';

/// Opens a page in an in-app browser sheet, keeping the app underneath.
Future<void> openLink(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  if (!await launchUrl(uri, mode: LaunchMode.inAppBrowserView)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

Future<void> openExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// The iOS date wheel in a sheet, with Cancel and Done. Returns the chosen date.
Future<DateTime?> pickDate(
  BuildContext context, {
  DateTime? initial,
  required DateTime first,
  required DateTime last,
  String title = 'Date',
}) {
  var value = initial ?? DateTime.now();
  final today = DateTime(value.year, value.month, value.day);
  value = today.isBefore(first) ? first : (today.isAfter(last) ? last : today);
  return showLexaSheet<DateTime>(context, (sheet) {
    final theme = Theme.of(sheet);
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              TextButton(
                onPressed: () => Navigator.of(sheet).pop(),
                child: Text('Cancel', style: theme.textTheme.bodyLarge?.copyWith(color: sheet.mutedStrong)),
              ),
              Expanded(
                child: Text(title, textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
              ),
              TextButton(
                key: const Key('date-done'),
                onPressed: () => Navigator.of(sheet).pop(value),
                child: Text(
                  'Done',
                  style: theme.textTheme.bodyLarge?.copyWith(color: sheet.accentColor, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          SizedBox(
            height: 216,
            child: CupertinoTheme(
              data: CupertinoThemeData(
                brightness: theme.brightness,
                primaryColor: sheet.accentColor,
                textTheme: CupertinoTextThemeData(
                  dateTimePickerTextStyle: theme.textTheme.bodyLarge?.copyWith(fontSize: 21, height: 1.2),
                ),
              ),
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: value,
                minimumDate: first,
                maximumDate: last,
                onDateTimeChanged: (date) => value = date,
              ),
            ),
          ),
        ],
      ),
    );
  });
}

final _dateFormat = DateFormat.yMMMd();

String formatDate(DateTime date) => _dateFormat.format(date);

/// "Today", "Tomorrow", "In 9 days", "3 days overdue".
String dueLabel(Deadline deadline) {
  final days = deadline.daysLeft;
  if (days == null) return 'No date set';
  if (deadline.isDone) return formatDate(deadline.dueDate!);
  if (days < 0) {
    final overdue = -days;
    return '$overdue day${overdue == 1 ? '' : 's'} overdue';
  }
  if (days == 0) return 'Due today';
  if (days == 1) return 'Due tomorrow';
  if (days <= 30) return 'Due in $days days';
  return 'Due ${formatDate(deadline.dueDate!)}';
}

Color dueColor(BuildContext context, Deadline deadline) {
  final days = deadline.daysLeft;
  if (deadline.isDone || days == null) return context.mutedColor;
  if (days <= 1) return context.alertColor;
  if (days <= 7) return context.accentColor;
  return context.mutedColor;
}

const matterCategories = <(String, String, IconData)>[
  ('tenant-housing', 'Tenant & Housing', Icons.home_outlined),
  ('employment', 'Employment & Workplace', Icons.work_outline_rounded),
  ('contracts', 'Contracts & Agreements', Icons.handshake_outlined),
  ('consumer', 'Consumer Rights', Icons.shopping_bag_outlined),
  ('small-claims', 'Small Claims & Money Owed', Icons.payments_outlined),
  ('family', 'Family', Icons.family_restroom_outlined),
  ('immigration', 'Immigration', Icons.flight_land_outlined),
  ('criminal', 'Criminal', Icons.gavel_rounded),
  ('personal-injury', 'Personal Injury', Icons.healing_outlined),
  ('estate', 'Estate & Wills', Icons.description_outlined),
  ('business', 'Small Business', Icons.storefront_outlined),
  ('bankruptcy', 'Debt & Bankruptcy', Icons.account_balance_outlined),
  ('other', 'Something else', Icons.more_horiz_rounded),
];

String categoryLabel(String value) => matterCategories
    .firstWhere((c) => c.$1 == value, orElse: () => ('other', 'Uncategorized', Icons.folder_outlined))
    .$2;

IconData categoryIcon(String value) => matterCategories
    .firstWhere((c) => c.$1 == value, orElse: () => ('other', '', Icons.folder_outlined))
    .$3;
