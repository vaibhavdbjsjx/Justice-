import 'package:flutter/material.dart';
import '../api/client.dart';
import '../legal/disclaimers.dart';
import '../widgets/ai_legal_output.dart';
import '../widgets/markdown_lite.dart';

class _Msg {
  _Msg(this.role, this.content);
  final String role;
  String content;
}

const _suggestedQuestions = <(String, String)>[
  (
    'Tenant rights',
    'My landlord wants me to move out. What are my rights as a tenant, and what should I do first?'
  ),
  (
    'Problem at work',
    "I think I'm being treated unfairly at work. What are my options and what should I document?"
  ),
  (
    'Before I sign a contract',
    "I've been given a contract to sign. What should I check before signing, and what are the warning signs?"
  ),
  (
    'Someone owes me money',
    "Someone owes me money and won't pay. How does small claims court work, and is it worth it?"
  ),
];

/// Consumer assistant (Phase 12): streams from /api/chat with the Supabase
/// bearer token; persistence happens server-side exactly like web. Every
/// assistant turn renders inside [AiLegalOutput] (Part 10 hard requirement).
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, this.matterId, this.matterTitle});

  final String? matterId;
  final String? matterTitle;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _api = LexmindApi();
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_Msg> _messages = [];
  bool _streaming = false;
  String? _error;
  bool _upgradeHint = false;

  bool get _highStakes =>
      _messages.any((m) => m.role == 'user' && looksHighStakes(m.content));

  Future<void> _send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || _streaming) return;

    final history = _messages
        .map((m) => {'role': m.role, 'content': m.content})
        .toList();
    setState(() {
      _error = null;
      _upgradeHint = false;
      _input.clear();
      _messages.add(_Msg('user', text));
      _streaming = true;
    });

    final assistant = _Msg('assistant', '');
    try {
      var added = false;
      await for (final delta in _api.chat(
          message: text, history: history, matterId: widget.matterId)) {
        if (!mounted) return;
        setState(() {
          if (!added) {
            _messages.add(assistant);
            added = true;
          }
          assistant.content += delta;
        });
        _autoscroll();
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _upgradeHint = e.upgrade;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            "LexMind couldn't complete that response. Your conversation is safe — please try again in a moment.");
      }
    } finally {
      if (mounted) {
        setState(() {
          _streaming = false;
          _messages.removeWhere(
              (m) => m.role == 'assistant' && m.content.isEmpty);
        });
      }
    }
  }

  void _autoscroll() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(widget.matterTitle ?? 'Assistant')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: const DisclaimerBanner(),
            ),
            Expanded(
              child: _messages.isEmpty
                  ? _EmptyState(onPick: _send, matter: widget.matterTitle)
                  : ListView.separated(
                      controller: _scroll,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 14),
                      itemBuilder: (context, i) {
                        final m = _messages[i];
                        if (m.role == 'user') {
                          return Align(
                            alignment: Alignment.centerRight,
                            child: Container(
                              constraints: BoxConstraints(
                                  maxWidth: MediaQuery.of(context).size.width *
                                      0.82),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primary,
                                borderRadius: BorderRadius.circular(14)
                                    .copyWith(
                                        bottomRight:
                                            const Radius.circular(4)),
                              ),
                              child: Text(m.content,
                                  style: theme.textTheme.bodyLarge?.copyWith(
                                      color:
                                          theme.colorScheme.onPrimary)),
                            ),
                          );
                        }
                        final last = i == _messages.length - 1;
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.surface,
                            borderRadius: BorderRadius.circular(14)
                                .copyWith(topLeft: const Radius.circular(4)),
                            border:
                                Border.all(color: theme.colorScheme.outline),
                          ),
                          child: AiLegalOutput(
                            highStakes: _highStakes && last && !_streaming,
                            child: MarkdownLite(m.content),
                          ),
                        );
                      },
                    ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: (_upgradeHint
                            ? theme.colorScheme.secondary
                            : theme.colorScheme.error)
                        .withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _upgradeHint
                        ? '$_error Manage your plan from the web app.'
                        : _error!,
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 5,
                      textInputAction: TextInputAction.send,
                      onSubmitted: _send,
                      decoration: const InputDecoration(
                          hintText: 'Describe your situation…'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed:
                        _streaming ? null : () => _send(_input.text),
                    icon: Icon(_streaming
                        ? Icons.hourglass_top
                        : Icons.arrow_upward),
                    style: IconButton.styleFrom(
                      backgroundColor: theme.colorScheme.secondary,
                      foregroundColor: theme.colorScheme.onSecondary,
                      minimumSize: const Size(48, 48),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onPick, this.matter});
  final void Function(String) onPick;
  final String? matter;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 24),
        Icon(Icons.balance, size: 40, color: theme.colorScheme.secondary),
        const SizedBox(height: 14),
        Text(
          matter != null ? "Let's work on this matter" : 'How can we help?',
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Text(
          matter != null
              ? 'Everything you discuss here stays with $matter.'
              : 'Describe your situation in plain language — answers are scoped to your jurisdiction and explained without the jargon.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium,
        ),
        const SizedBox(height: 24),
        if (matter == null)
          ..._suggestedQuestions.map(
            ((String, String) chip) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(
                onPressed: () => onPick(chip.$2),
                style: OutlinedButton.styleFrom(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12)),
                child: Row(
                  children: [
                    Icon(Icons.chevron_right,
                        size: 18, color: theme.colorScheme.secondary),
                    const SizedBox(width: 6),
                    Expanded(
                        child: Text(chip.$1,
                            style: theme.textTheme.bodyLarge)),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 8),
        Text(
          'LexMind provides legal information — not legal advice.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
