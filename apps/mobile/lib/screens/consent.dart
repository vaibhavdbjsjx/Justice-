import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/ui.dart';

/// Explains exactly what goes to the AI provider and asks for permission
/// (App Store Guideline 5.1.2(i)). Declining leaves everything else working.
class AiConsentBody extends StatelessWidget {
  const AiConsentBody({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = AppScope.read(context);
    Widget row(IconData icon, String title, String body) => Padding(
          padding: const EdgeInsets.only(bottom: 15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(11)),
                child: Icon(icon, size: 18, color: context.accentColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 2),
                    Text(body, style: theme.textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        row(Icons.upload_outlined, 'What is sent',
            'The questions you ask, the documents you upload, the details you enter for drafts, and your country or state.'),
        row(Icons.business_outlined, 'Who receives it',
            '${state.remote.aiLabel}, which processes it to produce your answer.'
            '${state.remote.aiReviewNotice == null ? '' : ' ${state.remote.aiReviewNotice}'}'),
        row(Icons.shield_outlined, 'Why',
            'Only to answer you. We never sell your data, and you can withdraw permission at any time in Account.'),
        GestureDetector(
          onTap: () => openLink('${state.remote.privacyUrl}#ai-processing'),
          child: Text(
            'Read the Privacy Policy',
            style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor),
          ),
        ),
      ],
    );
  }
}

/// Returns true once permission is in place, asking if it isn't yet.
Future<bool> ensureAiConsent(BuildContext context) async {
  final state = AppScope.read(context);
  if (state.hasAiConsent) return true;
  final agreed = await showLexaSheet<bool>(context, (sheet) => const _ConsentSheet());
  return agreed ?? false;
}

class _ConsentSheet extends StatefulWidget {
  const _ConsentSheet();

  @override
  State<_ConsentSheet> createState() => _ConsentSheetState();
}

class _ConsentSheetState extends State<_ConsentSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _agree() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).grantAiConsent();
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "We couldn't save that just now. Please try again.";
        });
      }
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
          Text('Before Lexa answers', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            "Lexa's answers come from an AI service run by another company. We need your permission to share your content with them.",
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          const AiConsentBody(),
          const SizedBox(height: 20),
          if (_error != null) ...[
            Note(_error!, tone: NoteTone.error),
            const SizedBox(height: 12),
          ],
          LexaButton('I agree', onPressed: _agree, busy: _busy),
          const SizedBox(height: 6),
          LexaButton(
            'Not now',
            style: LexaButtonStyle.ghost,
            onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    );
  }
}
