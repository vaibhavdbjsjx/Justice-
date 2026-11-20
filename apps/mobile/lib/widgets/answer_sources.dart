import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/models.dart';
import '../theme/theme.dart';
import 'common.dart';
import 'ui.dart';

/// Where a grounded answer came from. Google's terms require its Search
/// Suggestions to appear unmodified, at the width of the answer, whenever the
/// answer does, and tapping one must go straight to Google.
class AnswerSources extends StatelessWidget {
  const AnswerSources({super.key, required this.meta});

  final AnswerMeta meta;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final html = meta.searchSuggestionsHtml ?? '';
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (meta.sources.isNotEmpty) ...[
            Text('SOURCES', style: theme.textTheme.labelSmall),
            const SizedBox(height: 7),
            for (final source in meta.sources)
              Pressable(
                onTap: () => openLink(source.url),
                label: source.label,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      Icon(Icons.link_rounded, size: 15, color: context.accentColor),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          source.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(color: context.accentColor),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
          if (html.isNotEmpty) ...[
            const SizedBox(height: 8),
            SearchSuggestionsView(html: html),
          ],
        ],
      ),
    );
  }
}

class SearchSuggestionsView extends StatefulWidget {
  const SearchSuggestionsView({super.key, required this.html});

  final String html;

  @override
  State<SearchSuggestionsView> createState() => _SearchSuggestionsViewState();
}

class _SearchSuggestionsViewState extends State<SearchSuggestionsView> {
  late final WebViewController _controller = WebViewController()
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    ..setBackgroundColor(Colors.transparent)
    ..setNavigationDelegate(NavigationDelegate(
      onNavigationRequest: (request) {
        if (request.url.startsWith('http')) {
          openExternal(request.url);
          return NavigationDecision.prevent;
        }
        return NavigationDecision.navigate;
      },
    ))
    ..loadHtmlString(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">${widget.html}</body>',
    );

  @override
  Widget build(BuildContext context) {
    return SizedBox(height: 76, child: WebViewWidget(controller: _controller));
  }
}
