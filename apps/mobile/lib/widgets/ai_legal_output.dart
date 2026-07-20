import 'package:flutter/material.dart';
import '../legal/disclaimers.dart';
import '../theme/theme.dart';

/// Structural guarantee that AI legal output never renders without its
/// compliance context (Part 1 / Part 10) — the mobile twin of the web's
/// `<AiLegalOutput>`. Wrap ANY AI-generated legal content in this.
class AiLegalOutput extends StatelessWidget {
  const AiLegalOutput({
    super.key,
    required this.child,
    this.highStakes = false,
  });

  final Widget child;
  final bool highStakes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        child,
        if (highStakes) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: theme.colorScheme.error.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: theme.colorScheme.error.withValues(alpha: 0.35)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.person_search_outlined,
                    size: 16, color: theme.colorScheme.error),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(professionalHelpNudge,
                      style: theme.textTheme.bodyMedium),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.only(top: 6),
          decoration: BoxDecoration(
            border: Border(
                top: BorderSide(color: theme.colorScheme.outline, width: 0.8)),
          ),
          child: Text(
            disclaimerShort,
            style: theme.textTheme.bodySmall
                ?.copyWith(fontSize: 11, color: context.mutedColor),
          ),
        ),
      ],
    );
  }
}

/// The persistent banner variant for screen tops (DisclaimerBanner parity).
class DisclaimerBanner extends StatelessWidget {
  const DisclaimerBanner({super.key, this.full = false});
  final bool full;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: context.accentSoft,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.balance, size: 14, color: theme.colorScheme.secondary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              full ? disclaimerFull : disclaimerShort,
              style: theme.textTheme.bodySmall?.copyWith(fontSize: 11.5),
            ),
          ),
        ],
      ),
    );
  }
}
