import 'package:flutter/material.dart';
import '../theme/theme.dart';

/// A small markdown renderer for AI output: headings, bullet and numbered lists,
/// bold, and paragraphs, styled exactly on the design tokens. Model output here is
/// constrained prose, so a full markdown package would add little.
class MarkdownLite extends StatelessWidget {
  const MarkdownLite(this.data, {super.key, this.selectable = false, this.baseStyle});

  final String data;
  final bool selectable;
  final TextStyle? baseStyle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = baseStyle ?? theme.textTheme.bodyLarge!.copyWith(height: 1.58);
    final blocks = <Widget>[];

    Widget inline(String text) {
      final span = TextSpan(style: base, children: _spans(text));
      return selectable ? SelectableText.rich(span) : Text.rich(span);
    }

    for (final rawLine in data.split('\n')) {
      final line = rawLine.trimRight();
      if (line.trim().isEmpty) {
        if (blocks.isNotEmpty) blocks.add(const SizedBox(height: 10));
        continue;
      }
      final heading = RegExp(r'^(#{1,4})\s+(.*)$').firstMatch(line);
      if (heading != null) {
        blocks.add(Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 4),
          child: Text(heading.group(2)!.replaceAll('**', ''), style: theme.textTheme.titleMedium),
        ));
        continue;
      }
      final bullet = RegExp(r'^\s*[-*•]\s+(.*)$').firstMatch(line);
      final numbered = RegExp(r'^\s*(\d{1,3})[.)]\s+(.*)$').firstMatch(line);
      if (bullet != null || numbered != null) {
        final content = bullet?.group(1) ?? numbered!.group(2)!;
        blocks.add(Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 5),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 22,
                child: Text(
                  bullet != null ? '•' : '${numbered!.group(1)}.',
                  style: base.copyWith(color: context.accentColor, fontWeight: FontWeight.w600),
                ),
              ),
              Expanded(child: inline(content)),
            ],
          ),
        ));
        continue;
      }
      blocks.add(inline(line));
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: blocks);
  }

  /// **bold** spans; everything else plain.
  List<InlineSpan> _spans(String text) {
    final spans = <InlineSpan>[];
    var rest = text;
    final bold = RegExp(r'\*\*(.+?)\*\*');
    while (true) {
      final match = bold.firstMatch(rest);
      if (match == null) {
        if (rest.isNotEmpty) spans.add(TextSpan(text: rest));
        break;
      }
      if (match.start > 0) spans.add(TextSpan(text: rest.substring(0, match.start)));
      spans.add(TextSpan(text: match.group(1), style: const TextStyle(fontWeight: FontWeight.w600)));
      rest = rest.substring(match.end);
    }
    return spans;
  }
}
