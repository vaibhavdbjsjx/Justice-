import 'package:flutter/material.dart';
import '../legal/disclaimers.dart';
import '../theme/theme.dart';

/// Structural guarantee that AI legal output never renders without its compliance
/// context: the mobile twin of the web's `AiLegalOutput`. Wrap ANY AI-generated
/// legal content in this.
class AiLegalOutput extends StatelessWidget {
  const AiLegalOutput({
    super.key,
    required this.child,
    this.highStakes = false,
    this.onFindLawyer,
    this.lawyerAudience = false,
  });

  final Widget child;
  final bool highStakes;
  final VoidCallback? onFindLawyer;

  /// Lawyers see the research notice in place of the consumer disclaimer.
  final bool lawyerAudience;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        child,
        if (highStakes && !lawyerAudience) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: context.accentSoft,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.gavel_rounded, size: 17, color: context.accentColor),
                    const SizedBox(width: 9),
                    Expanded(child: Text(professionalHelpNudge, style: theme.textTheme.bodySmall?.copyWith(color: context.mutedStrong))),
                  ],
                ),
                if (onFindLawyer != null) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: onFindLawyer,
                    child: Text('Find a lawyer', style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor)),
                  ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 11),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.balance_rounded, size: 13, color: context.mutedColor),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                lawyerAudience ? researchNotice : disclaimerShort,
                style: theme.textTheme.bodySmall?.copyWith(fontSize: 11.5),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A persistent one-line reminder for screens that hold legal content.
class DisclaimerBanner extends StatelessWidget {
  const DisclaimerBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.balance_rounded, size: 13, color: context.mutedColor),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            disclaimerShort,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11.5),
          ),
        ),
      ],
    );
  }
}
