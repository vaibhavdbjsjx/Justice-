import 'package:flutter/material.dart';

/// Deliberately small markdown renderer for AI output: headings, bullet /
/// numbered lists, bold, paragraphs. Chosen over a markdown package to keep
/// the dependency surface tiny and the styling exactly on-token; the model
/// output is constrained prose, not arbitrary documents.
class MarkdownLite extends StatelessWidget {
  const MarkdownLite(this.data, {super.key});
  final String data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final blocks = <Widget>[];

    for (final rawLine in data.split('\n')) {
      final line = rawLine.trimRight();
      if (line.trim().isEmpty) {
        blocks.add(const SizedBox(height: 8));
        continue;
      }
      final heading = RegExp(r'^(#{1,4})\s+(.*)$').firstMatch(line);
      if (heading != null) {
        blocks.add(Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 2),
          child: Text(heading.group(2)!,
              style: theme.textTheme.titleMedium),
        ));
        continue;
      }
      final bullet = RegExp(r'^\s*[-*•]\s+(.*)$').firstMatch(line);
      final numbered = RegExp(r'^\s*(\d{1,3})[.)]\s+(.*)$').firstMatch(line);
      if (bullet != null || numbered != null) {
        final content = bullet?.group(1) ?? numbered!.group(2)!;
        final marker = bullet != null ? '•' : '${numbered!.group(1)}.';
        blocks.add(Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 3),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(marker,
                  style: theme.textTheme.bodyLarge?.copyWith(
                      color: theme.colorScheme.secondary,
                      fontWeight: FontWeight.w600)),
              const SizedBox(width: 8),
              Expanded(child: _inline(content, theme)),
            ],
          ),
        ));
        continue;
      }
      blocks.add(Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: _inline(line, theme),
      ));
    }

    return Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: blocks);
  }

  /// **bold** spans; everything else plain.
  Widget _inline(String text, ThemeData theme) {
    final base = theme.textTheme.bodyLarge!
        .copyWith(height: TypeTokensCompat.lineHeight);
    final spans = <TextSpan>[];
    var rest = text;
    final bold = RegExp(r'\*\*(.+?)\*\*');
    while (true) {
      final m = bold.firstMatch(rest);
      if (m == null) {
        if (rest.isNotEmpty) spans.add(TextSpan(text: rest));
        break;
      }
      if (m.start > 0) spans.add(TextSpan(text: rest.substring(0, m.start)));
      spans.add(TextSpan(
          text: m.group(1),
          style: const TextStyle(fontWeight: FontWeight.w600)));
      rest = rest.substring(m.end);
    }
    return Text.rich(TextSpan(style: base, children: spans));
  }
}

/// Legal prose wants generous leading (tokens.json legal-prose-line-height).
class TypeTokensCompat {
  static const lineHeight = 1.6;
}
