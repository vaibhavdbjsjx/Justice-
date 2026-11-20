import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api/client.dart';
import '../legal/disclaimers.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/ai_legal_output.dart';
import '../widgets/answer_sources.dart';
import '../widgets/markdown_lite.dart';
import '../widgets/report_sheet.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';
import 'consent.dart';
import 'lawyers_screen.dart';
import 'paywall_screen.dart';

class _Message {
  _Message(this.role, this.content, {this.meta});
  final String role;
  String content;
  AnswerMeta? meta;
}

const _suggestions = <(String, IconData, String)>[
  ('Tenant rights', Icons.home_outlined,
      'My landlord wants me to move out. What are my rights as a tenant, and what should I do first?'),
  ('Problem at work', Icons.work_outline_rounded,
      "I think I'm being treated unfairly at work. What are my options and what should I document?"),
  ('Before I sign', Icons.draw_outlined,
      "I've been given a contract to sign. What should I check before signing, and what are the warning signs?"),
  ('Money owed to me', Icons.payments_outlined,
      "Someone owes me money and won't pay. How does small claims court work, and is it worth it?"),
  ('Security deposit', Icons.key_outlined,
      'My landlord kept my security deposit after I moved out. What can I do to get it back?'),
  ('A faulty purchase', Icons.shopping_bag_outlined,
      'I bought something faulty and the seller refuses a refund. What are my rights?'),
];

const _researchSuggestions = <(String, IconData, String)>[
  ('Elements of a claim', Icons.account_tree_outlined,
      'What are the elements of a breach of contract claim in this jurisdiction, and the leading authorities?'),
  ('Limitations period', Icons.schedule_rounded,
      'What is the limitations period for a written contract claim here, and when does it start to run?'),
  ('Split of authority', Icons.call_split_rounded,
      'Is there a split of authority on the enforceability of non-compete clauses in this jurisdiction?'),
];

/// The assistant. Streams answers as they're written and saves on the server, so
/// the conversation is there next time, on any device. In a matter it stays with
/// that matter; for lawyers it runs the research prompt.
class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    this.matterId,
    this.matterTitle,
    this.audience = 'consumer',
    this.embedded = false,
    this.initialQuestion,
  });

  final String? matterId;
  final String? matterTitle;
  final String audience;

  /// True inside another screen that already provides a header.
  final bool embedded;

  /// Asked right away, for jumping in from a document.
  final String? initialQuestion;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _focus = FocusNode();
  final List<_Message> _messages = [];
  StreamSubscription<ChatEvent>? _stream;
  bool _loading = true;
  bool _streaming = false;
  bool _pinned = true;
  bool _showJump = false;
  String? _error;
  bool _upgradeHint = false;

  String? _activityId;
  int? _backgroundTask;
  bool _inBackground = false;

  bool get _isResearch => widget.audience == 'lawyer';

  bool get _highStakes =>
      _messages.any((m) => m.role == 'user' && looksHighStakes(m.content));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadHistory());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stream?.cancel();
    _input.dispose();
    _scroll.dispose();
    _focus.dispose();
    super.dispose();
  }

  /// Leaving mid-answer keeps it going for the short time iOS allows, with a Live
  /// Activity showing progress. The server saves the answer either way.
  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycle) {
    final bridge = NativeBridge.instance;
    if (lifecycle == AppLifecycleState.paused) {
      _inBackground = true;
      if (_streaming && _backgroundTask == null) {
        bridge.beginBackgroundTime().then((id) => _backgroundTask = id);
        bridge
            .startActivity(
              kind: 'answer',
              title: widget.matterTitle ?? 'Your question',
              headline: 'Lexa is writing your answer',
              detail: "It'll be waiting in the app when it's done.",
              expectedSeconds: 25,
              deepLink: 'lexa://ask',
            )
            .then((id) => _activityId = id);
      }
    } else if (lifecycle == AppLifecycleState.resumed) {
      _inBackground = false;
      final activity = _activityId;
      if (activity != null) {
        bridge.endActivity(activity);
        _activityId = null;
      }
      bridge.endBackgroundTime(_backgroundTask);
      _backgroundTask = null;
      if (!_streaming) _loadHistory();
    }
  }

  Future<void> _settleBackgroundWork({required bool succeeded}) async {
    final bridge = NativeBridge.instance;
    final activity = _activityId;
    _activityId = null;
    if (activity != null) {
      await bridge.finishActivity(
        activity,
        succeeded: succeeded,
        headline: succeeded ? 'Your answer is ready' : "Couldn't finish that answer",
        detail: succeeded ? 'Tap to read it.' : 'Open Lexa to try again.',
      );
    }
    if (_inBackground && succeeded) {
      await bridge.scheduleNotification(
        id: 'answer-${DateTime.now().millisecondsSinceEpoch}',
        title: 'Your answer is ready',
        body: widget.matterTitle ?? 'Tap to read it.',
        link: 'lexa://ask',
      );
    }
    await bridge.endBackgroundTime(_backgroundTask);
    _backgroundTask = null;
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final distance = _scroll.position.maxScrollExtent - _scroll.offset;
    _pinned = distance < 120;
    final show = distance > 240;
    if (show != _showJump) setState(() => _showJump = show);
  }

  Future<void> _loadHistory() async {
    final state = AppScope.read(context);
    try {
      var matterId = widget.matterId;
      matterId ??= await state.repo.defaultMatterId(_isResearch ? 'research' : 'general');
      final rows = matterId == null ? <ChatMessageRow>[] : await state.repo.messages(matterId);
      if (!mounted || _streaming) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(rows.map((r) => _Message(r.role, r.content, meta: r.meta)));
        _loading = false;
      });
      _jumpToEnd();
    } catch (_) {
      // An empty conversation still works, and a new message will retry.
      if (mounted) setState(() => _loading = false);
    }
    final first = widget.initialQuestion;
    if (first != null && mounted && _messages.isEmpty && !_streaming) _send(first);
  }

  void _jumpToEnd({bool animate = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      final end = _scroll.position.maxScrollExtent;
      if (animate) {
        _scroll.animateTo(end, duration: LexaMotion.slow, curve: LexaMotion.curve);
      } else {
        _scroll.jumpTo(end);
      }
    });
  }

  Future<void> _send(String raw) async {
    final text = raw.trim();
    if (text.isEmpty || _streaming) return;

    if (!await ensureAiConsent(context)) return;
    if (!mounted) return;

    final state = AppScope.read(context);
    final history =
        _messages.map((m) => {'role': m.role, 'content': m.content}).toList();

    HapticFeedback.lightImpact();
    setState(() {
      _error = null;
      _upgradeHint = false;
      _input.clear();
      _messages.add(_Message('user', text));
      _streaming = true;
      _pinned = true;
    });
    _jumpToEnd(animate: true);

    final assistant = _Message('assistant', '');
    var added = false;
    var failed = false;

    void finish() {
      if (!mounted) return;
      setState(() {
        _streaming = false;
        _messages.removeWhere((m) => m.role == 'assistant' && m.content.isEmpty);
      });
      unawaited(_settleBackgroundWork(succeeded: !failed && added));
      unawaited(state.refreshBilling());
    }

    _stream = state.api
        .chat(
          message: text,
          history: history,
          matterId: widget.matterId,
          audience: widget.audience,
        )
        .listen(
      (event) {
        if (!mounted) return;
        setState(() {
          switch (event) {
            case ChatDelta(:final text):
              if (!added) {
                _messages.add(assistant);
                added = true;
              }
              assistant.content += text;
            case ChatSources(:final meta):
              assistant.meta = meta;
          }
        });
        if (_pinned) _jumpToEnd();
      },
      onError: (Object error) async {
        failed = true;
        if (!mounted) return;
        if (error is ApiException) {
          if (error.consentRequired) {
            // Permission lapsed or the provider changed: ask, then send again.
            _messages.removeWhere((m) => m.role == 'user' && m.content == text && m == _messages.last);
            finish();
            _input.text = text;
            await state.refresh();
            if (mounted && await ensureAiConsent(context)) _send(text);
            return;
          }
          setState(() {
            _error = error.message;
            _upgradeHint = error.upgrade;
          });
        } else {
          setState(() {
            _error = added
                ? 'The connection dropped before the answer finished. Your conversation is safe. Please try again.'
                : "Lexa couldn't complete that response. Your conversation is safe. Please try again in a moment.";
          });
        }
        finish();
      },
      onDone: finish,
      cancelOnError: true,
    );
  }

  void _stop() {
    _stream?.cancel();
    setState(() {
      _streaming = false;
      _messages.removeWhere((m) => m.role == 'assistant' && m.content.isEmpty);
    });
    unawaited(_settleBackgroundWork(succeeded: false));
  }

  @override
  Widget build(BuildContext context) {
    final body = LayoutBuilder(builder: (context, constraints) {
      final horizontal = contentPadding(constraints.maxWidth);
      return Column(
        children: [
          Expanded(child: _conversation(context, horizontal)),
          _composer(context, horizontal),
        ],
      );
    });

    if (widget.embedded) return body;

    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: Navigator.of(context).canPop(),
        title: Text(
          widget.matterTitle ?? (_isResearch ? 'Research' : 'Ask Lexa'),
          style: theme.textTheme.titleMedium,
        ),
      ),
      body: body,
    );
  }

  Widget _conversation(BuildContext context, double horizontal) {
    if (_loading) {
      return Padding(
        padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: 18),
        child: const SkeletonCards(count: 2, height: 96),
      );
    }
    if (_messages.isEmpty && !_streaming) {
      return _EmptyState(
        horizontal: horizontal,
        matterTitle: widget.matterTitle,
        research: _isResearch,
        jurisdiction: AppScope.of(context).profile?.jurisdictionLabel,
        onPick: _send,
        error: _error,
        upgradeHint: _upgradeHint,
      );
    }

    final webSearch = AppScope.of(context).remote.webSearch;
    final showThinking = _streaming && _messages.last.role == 'user';
    final count = _messages.length + (showThinking ? 1 : 0) + (_error != null ? 1 : 0);

    return Stack(
      children: [
        ListView.builder(
          controller: _scroll,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(horizontal, 14, horizontal, 14),
          itemCount: count,
          itemBuilder: (context, i) {
            if (i < _messages.length) return _bubble(context, i);
            if (showThinking && i == _messages.length) {
              return Padding(
                padding: const EdgeInsets.only(top: 6, bottom: 10),
                child: Reveal(child: ThinkingRow(webSearch: webSearch)),
              );
            }
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: _ErrorNote(message: _error!, upgrade: _upgradeHint),
            );
          },
        ),
        Positioned(
          right: horizontal,
          bottom: 10,
          child: AnimatedSlide(
            duration: LexaMotion.base,
            curve: LexaMotion.curve,
            offset: _showJump ? Offset.zero : const Offset(0, 1.6),
            child: AnimatedOpacity(
              duration: LexaMotion.base,
              opacity: _showJump ? 1 : 0,
              child: Pressable(
                scale: 0.9,
                label: 'Jump to latest',
                onTap: () => _jumpToEnd(animate: true),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: Theme.of(context).colorScheme.outline),
                    boxShadow: context.softShadow,
                  ),
                  child: const Icon(Icons.arrow_downward_rounded, size: 19),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _bubble(BuildContext context, int i) {
    final theme = Theme.of(context);
    final message = _messages[i];
    final isLast = i == _messages.length - 1;

    if (message.role == 'user') {
      return Reveal(
        distance: 10,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Align(
            alignment: Alignment.centerRight,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 11),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  borderRadius: BorderRadius.circular(19).copyWith(bottomRight: const Radius.circular(6)),
                ),
                child: SelectableText(
                  message.content,
                  style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onPrimary, height: 1.42),
                ),
              ),
            ),
          ),
        ),
      );
    }

    final streamingThis = _streaming && isLast;
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(color: context.accentSoft, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: const LexaMark(size: 16),
              ),
              const SizedBox(width: 8),
              Text('Lexa', style: theme.textTheme.labelMedium),
            ],
          ),
          const SizedBox(height: 8),
          AiLegalOutput(
            highStakes: _highStakes && isLast && !_streaming,
            lawyerAudience: _isResearch,
            onFindLawyer: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const LawyersScreen()),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MarkdownLite(message.content, selectable: !streamingThis),
                if (message.meta != null && !streamingThis) AnswerSources(meta: message.meta!),
              ],
            ),
          ),
          if (!streamingThis)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  _AnswerAction(
                    icon: Icons.copy_rounded,
                    label: 'Copy',
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: message.content));
                      showToast(context, 'Copied');
                    },
                  ),
                  _AnswerAction(
                    icon: Icons.ios_share_rounded,
                    label: 'Share',
                    onTap: () => NativeBridge.instance.shareText(message.content),
                  ),
                  _AnswerAction(
                    icon: Icons.flag_outlined,
                    label: 'Report',
                    onTap: () => showReportSheet(context, kind: 'ai_answer', excerpt: message.content),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _composer(BuildContext context, double horizontal) {
    final theme = Theme.of(context);
    final media = MediaQuery.of(context);
    // The Scaffold hides the keyboard's height from its body, so ask the window.
    final keyboard = View.of(context).viewInsets.bottom > 0;
    return Container(
      padding: EdgeInsets.fromLTRB(
        horizontal,
        10,
        horizontal,
        keyboard ? 10 : media.padding.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: theme.colorScheme.outline)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              key: const Key('chat-input'),
              controller: _input,
              focusNode: _focus,
              minLines: 1,
              maxLines: 5,
              maxLength: 8000,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: _isResearch ? 'Ask a research question…' : 'Describe your situation…',
                counterText: '',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(color: theme.colorScheme.outline),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(color: context.borderStrong),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(color: context.accentColor, width: 1.5),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(width: 8),
          Pressable(
            scale: 0.88,
            label: _streaming ? 'Stop' : 'Send',
            onTap: _streaming
                ? _stop
                : _input.text.trim().isEmpty
                    ? null
                    : () => _send(_input.text),
            child: AnimatedContainer(
              key: const Key('chat-send'),
              duration: LexaMotion.base,
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: _streaming || _input.text.trim().isNotEmpty ? context.accentColor : context.surfaceSunken,
                shape: BoxShape.circle,
              ),
              child: AnimatedSwitcher(
                duration: LexaMotion.fast,
                child: Icon(
                  _streaming ? Icons.stop_rounded : Icons.arrow_upward_rounded,
                  key: ValueKey(_streaming),
                  size: 22,
                  color: _streaming || _input.text.trim().isNotEmpty
                      ? theme.colorScheme.onSecondary
                      : context.mutedColor,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnswerAction extends StatelessWidget {
  const _AnswerAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      scale: 0.92,
      onTap: onTap,
      label: label,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 8, 18, 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: context.mutedColor),
            const SizedBox(width: 5),
            Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.message, required this.upgrade});

  final String message;
  final bool upgrade;

  @override
  Widget build(BuildContext context) {
    return Note(
      message,
      tone: upgrade ? NoteTone.info : NoteTone.error,
      action: upgrade ? 'See plans' : null,
      onAction: upgrade ? () => showPaywall(context) : null,
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.horizontal,
    required this.onPick,
    this.matterTitle,
    this.research = false,
    this.jurisdiction,
    this.error,
    this.upgradeHint = false,
  });

  final double horizontal;
  final void Function(String) onPick;
  final String? matterTitle;
  final bool research;
  final String? jurisdiction;
  final String? error;
  final bool upgradeHint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final suggestions = research ? _researchSuggestions : _suggestions;
    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(horizontal, 24, horizontal, 16),
      children: [
        const Reveal(child: Center(child: LexaCoin(size: 74, spin: false))),
        const SizedBox(height: 18),
        Reveal(
          index: 1,
          child: Text(
            matterTitle != null
                ? "Let's work on this matter"
                : research
                    ? 'Research accelerator'
                    : 'How can we help?',
            textAlign: TextAlign.center,
            style: theme.textTheme.displaySmall,
          ),
        ),
        const SizedBox(height: 8),
        Reveal(
          index: 2,
          child: Text(
            matterTitle != null
                ? 'Everything you discuss here stays with $matterTitle.'
                : research
                    ? 'Settled law separated from open questions, with every authority flagged for you to verify.'
                    : 'Describe your situation in plain language. Answers are scoped to ${jurisdiction ?? 'your jurisdiction'} and explained without the jargon.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 16),
          _ErrorNote(message: error!, upgrade: upgradeHint),
        ],
        const SizedBox(height: 22),
        if (matterTitle == null)
          LayoutBuilder(
            builder: (context, box) {
              const gap = 9.0;
              final columns = box.maxWidth >= 520 ? 2 : 1;
              final width = (box.maxWidth - gap * (columns - 1)) / columns;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  for (var i = 0; i < suggestions.length; i++)
                    SizedBox(
                      width: width,
                      child: Reveal(
                        index: i + 3,
                        child: Pressable(
                          onTap: () => onPick(suggestions[i].$3),
                          label: suggestions[i].$1,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: theme.colorScheme.outline),
                            ),
                            child: Row(
                              children: [
                                Icon(suggestions[i].$2, size: 20, color: context.accentColor),
                                const SizedBox(width: 12),
                                Expanded(child: Text(suggestions[i].$1, style: theme.textTheme.titleSmall)),
                                Icon(Icons.north_east_rounded, size: 15, color: context.mutedColor),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        const SizedBox(height: 16),
        const DisclaimerBanner(),
      ],
    );
  }
}
