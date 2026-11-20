import 'package:flutter/material.dart';
import '../api/client.dart';
import '../state/app_state.dart';
import 'ui.dart';

/// Report an AI answer or a profile. Guideline 1.2 asks for this, and it's also
/// how a wrong answer gets caught.
Future<void> showReportSheet(
  BuildContext context, {
  required String kind,
  String? excerpt,
  String? referenceId,
}) {
  return showLexaSheet<void>(
    context,
    (sheet) => _ReportSheet(kind: kind, excerpt: excerpt, referenceId: referenceId),
  );
}

class _ReportSheet extends StatefulWidget {
  const _ReportSheet({required this.kind, this.excerpt, this.referenceId});

  final String kind;
  final String? excerpt;
  final String? referenceId;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  static const _answerReasons = [
    'Inaccurate or out of date',
    'Wrong jurisdiction',
    'Harmful or offensive',
    'Something else',
  ];
  static const _profileReasons = [
    'Not a real lawyer',
    'Misleading information',
    'Abusive or offensive',
    'Something else',
  ];

  late final List<String> _reasons =
      widget.kind == 'lawyer_profile' ? _profileReasons : _answerReasons;
  late String _reason = _reasons.first;
  final _details = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      await state.api.report(
        kind: widget.kind,
        reason: _reason,
        details: _details.text.trim().isEmpty ? null : _details.text.trim(),
        excerpt: widget.excerpt,
        referenceId: widget.referenceId,
      );
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = '${e.message} You can also email ${state.remote.supportEmail}.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_sent ? 'Thanks for telling us' : "What's wrong?", style: theme.textTheme.headlineMedium),
          const SizedBox(height: 14),
          if (_sent) ...[
            Text('We review every report. If it needs a reply, we will write to your account email.',
                style: theme.textTheme.bodyMedium),
            const SizedBox(height: 18),
            LexaButton('Done', onPressed: () => Navigator.of(context).pop()),
          ] else ...[
            SettingsGroup(
              children: [
                for (final reason in _reasons)
                  SettingsRow(
                    title: reason,
                    onTap: () => setState(() => _reason = reason),
                    trailing: reason == _reason
                        ? Icon(Icons.check_rounded, size: 20, color: theme.colorScheme.secondary)
                        : const SizedBox(width: 20),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _details,
              minLines: 2,
              maxLines: 4,
              maxLength: 2000,
              decoration: const InputDecoration(hintText: 'Add any details (optional)', counterText: ''),
            ),
            const SizedBox(height: 12),
            if (_error != null) ...[
              Note(_error!, tone: NoteTone.error),
              const SizedBox(height: 12),
            ],
            LexaButton('Send report', onPressed: _send, busy: _busy),
          ],
        ],
      ),
    );
  }
}
