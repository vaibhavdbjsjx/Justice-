import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/ui.dart';
import 'chat_screen.dart';
import 'documents_screen.dart';
import 'home_screen.dart';
import 'lawyers_screen.dart';
import 'matters_screen.dart';

/// Opens a matter by id, for links from notifications and Live Activities.
class MatterLoaderScreen extends StatefulWidget {
  const MatterLoaderScreen({super.key, required this.matterId});

  final String matterId;

  @override
  State<MatterLoaderScreen> createState() => _MatterLoaderScreenState();
}

class _MatterLoaderScreenState extends State<MatterLoaderScreen> {
  late final Future<Matter?> _future = AppScope.read(context).repo.matter(widget.matterId);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Matter?>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(appBar: AppBar(), body: const CenteredLoader());
        }
        final matter = snapshot.data;
        if (matter == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyView(
              icon: Icons.folder_off_outlined,
              title: "This matter isn't available",
              body: 'It may have been deleted.',
            ),
          );
        }
        return MatterDetailScreen(matter: matter);
      },
    );
  }
}

/// One situation in one place: the conversation, the deadlines, and the documents.
class MatterDetailScreen extends StatefulWidget {
  const MatterDetailScreen({super.key, required this.matter, this.initialTab = 0, this.clientView = false, this.clientId});

  final Matter matter;
  final int initialTab;

  /// A lawyer viewing a client's shared matter.
  final bool clientView;
  final String? clientId;

  @override
  State<MatterDetailScreen> createState() => _MatterDetailScreenState();
}

class _MatterDetailScreenState extends State<MatterDetailScreen> with SingleTickerProviderStateMixin {
  late Matter _matter = widget.matter;
  late final TabController _tabs = TabController(
    length: widget.clientView ? 3 : 4,
    vsync: this,
    initialIndex: widget.initialTab,
  );

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _edit() async {
    final saved = await showLexaSheet<Matter>(context, (_) => MatterFormSheet(matter: _matter));
    if (saved != null && mounted) setState(() => _matter = saved);
  }

  Future<void> _setStatus(String status) async {
    final state = AppScope.read(context);
    try {
      await state.repo.updateMatter(_matter.id, {'status': status});
      final updated = await state.repo.matter(_matter.id);
      state.notifyDataChanged();
      if (mounted && updated != null) setState(() => _matter = updated);
    } catch (_) {
      if (mounted) showToast(context, "That couldn't be saved. Please try again.");
    }
  }

  Future<void> _delete() async {
    final navigator = Navigator.of(context);
    final state = AppScope.read(context);
    final confirmed = await confirmAction(
      context,
      title: 'Delete this matter?',
      body: 'Its conversation, documents, and deadlines will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!confirmed) return;
    try {
      await state.repo.deleteMatter(_matter.id);
      unawaited(state.reminders.reschedule());
      state.notifyDataChanged();
      navigator.pop();
    } catch (_) {
      if (mounted) showToast(context, "That couldn't be deleted. Please try again.");
    }
  }

  void _showMenu() {
    final resolved = _matter.status == 'resolved';
    showLexaSheet<void>(
      context,
      (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: SettingsGroup(
          children: [
            SettingsRow(
              title: 'Edit details',
              icon: Icons.edit_outlined,
              onTap: () {
                Navigator.of(sheet).pop();
                _edit();
              },
            ),
            SettingsRow(
              title: resolved ? 'Reopen matter' : 'Mark as resolved',
              icon: resolved ? Icons.replay_rounded : Icons.check_circle_outline_rounded,
              onTap: () {
                Navigator.of(sheet).pop();
                _setStatus(resolved ? 'active' : 'resolved');
              },
            ),
            SettingsRow(
              title: 'Find a lawyer for this',
              icon: Icons.gavel_rounded,
              onTap: () {
                Navigator.of(sheet).pop();
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => LawyersScreen(matter: _matter)),
                );
              },
            ),
            SettingsRow(
              title: 'Delete matter',
              icon: Icons.delete_outline_rounded,
              destructive: true,
              onTap: () {
                Navigator.of(sheet).pop();
                _delete();
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tabs = <String>[
      if (!widget.clientView) 'Conversation',
      'Deadlines',
      'Documents',
      'Messages',
    ];
    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            Text(_matter.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleMedium),
            Text(
              _matter.jurisdictionLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(fontSize: 11.5),
            ),
          ],
        ),
        actions: [
          if (!widget.clientView)
            IconActionButton(icon: Icons.more_horiz_rounded, tooltip: 'More', onPressed: _showMenu),
          const SizedBox(width: 4),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.center,
          labelColor: context.accentColor,
          unselectedLabelColor: context.mutedColor,
          indicatorColor: context.accentColor,
          dividerColor: theme.colorScheme.outline,
          labelStyle: theme.textTheme.titleSmall,
          unselectedLabelStyle: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w500),
          tabs: [for (final tab in tabs) Tab(text: tab, height: 42)],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          if (!widget.clientView)
            ChatScreen(matterId: _matter.id, matterTitle: _matter.title, embedded: true),
          _DeadlinesTab(matter: _matter),
          _DocumentsTab(matter: _matter, readOnly: widget.clientView),
          MessagesTab(matter: _matter, clientView: widget.clientView),
        ],
      ),
    );
  }
}

class _DeadlinesTab extends StatefulWidget {
  const _DeadlinesTab({required this.matter});

  final Matter matter;

  @override
  State<_DeadlinesTab> createState() => _DeadlinesTabState();
}

class _DeadlinesTabState extends State<_DeadlinesTab> with AutomaticKeepAliveClientMixin {
  List<Deadline>? _items;
  Object? _error;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final items = await AppScope.read(context).repo.deadlines(widget.matter.id);
      if (mounted) {
        setState(() {
          _items = items;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _add() async {
    final saved = await showLexaSheet<bool>(context, (_) => DeadlineFormSheet(matterId: widget.matter.id));
    if (saved == true) _load();
  }

  Future<void> _delete(Deadline deadline) async {
    final state = AppScope.read(context);
    try {
      await state.repo.deleteDeadline(deadline.id);
      unawaited(state.reminders.reschedule());
      state.notifyDataChanged();
      _load();
    } catch (_) {
      if (mounted) showToast(context, "That couldn't be deleted. Please try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final items = _items;
    return LayoutBuilder(builder: (context, constraints) {
      final horizontal = contentPadding(constraints.maxWidth);
      return ListView(
        padding: EdgeInsets.fromLTRB(horizontal, 16, horizontal, MediaQuery.paddingOf(context).bottom + 24),
        children: [
          LexaButton('Add a deadline', key: const Key('deadline-add'), icon: Icons.add_rounded, style: LexaButtonStyle.secondary, compact: true, onPressed: _add),
          const SizedBox(height: 14),
          if (_error != null && items == null)
            Note("Deadlines couldn't be loaded just now.", tone: NoteTone.error, action: 'Try again', onAction: _load)
          else if (items == null)
            const SkeletonCards(count: 3, height: 72)
          else if (items.isEmpty)
            const EmptyView(
              icon: Icons.event_available_outlined,
              title: 'No deadlines yet',
              body: "Add the dates you can't afford to miss, and Lexa can remind you.",
            )
          else
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Reveal(
                  index: i,
                  child: Dismissible(
                    key: ValueKey(items[i].id),
                    direction: DismissDirection.endToStart,
                    confirmDismiss: (_) => confirmAction(
                      context,
                      title: 'Delete this deadline?',
                      body: items[i].title,
                      confirmLabel: 'Delete',
                      destructive: true,
                    ),
                    onDismissed: (_) => _delete(items[i]),
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 22),
                      decoration: BoxDecoration(color: context.alertSoft, borderRadius: BorderRadius.circular(20)),
                      child: Icon(Icons.delete_outline_rounded, color: context.alertColor),
                    ),
                    child: DeadlineCard(deadline: items[i], onChanged: _load, showMatter: false),
                  ),
                ),
              ),
        ],
      );
    });
  }
}

class _DocumentsTab extends StatefulWidget {
  const _DocumentsTab({required this.matter, this.readOnly = false});

  final Matter matter;
  final bool readOnly;

  @override
  State<_DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<_DocumentsTab> with AutomaticKeepAliveClientMixin {
  List<DocumentItem>? _items;
  Object? _error;
  AppState? _state;

  @override
  bool get wantKeepAlive => true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final state = AppScope.read(context);
    if (!identical(state, _state)) {
      _state?.dataVersion.removeListener(_load);
      _state = state;
      state.dataVersion.addListener(_load);
      _load();
    }
  }

  @override
  void dispose() {
    _state?.dataVersion.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await _state!.repo.documentsForMatter(widget.matter.id);
      if (mounted) {
        setState(() {
          _items = items;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final items = _items;
    return LayoutBuilder(builder: (context, constraints) {
      final horizontal = contentPadding(constraints.maxWidth);
      return ListView(
        padding: EdgeInsets.fromLTRB(horizontal, 16, horizontal, MediaQuery.paddingOf(context).bottom + 24),
        children: [
          if (!widget.readOnly) ...[
            LexaButton(
              'Read a document',
              icon: Icons.document_scanner_outlined,
              style: LexaButtonStyle.secondary,
              compact: true,
              onPressed: () => startDocumentAnalysis(context, matterId: widget.matter.id),
            ),
            const SizedBox(height: 14),
          ],
          if (_error != null && items == null)
            Note("Documents couldn't be loaded just now.", tone: NoteTone.error, action: 'Try again', onAction: _load)
          else if (items == null)
            const SkeletonCards(count: 2)
          else if (items.isEmpty)
            const EmptyView(
              icon: Icons.description_outlined,
              title: 'No documents yet',
              body: 'Upload a contract, notice, or court paper and Lexa will explain it.',
            )
          else
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Reveal(index: i, child: DocumentCard(document: items[i], onChanged: _load)),
              ),
        ],
      );
    });
  }
}

/// The private thread between a client and the lawyer they've shared a matter with.
class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key, required this.matter, this.clientView = false});

  final Matter matter;
  final bool clientView;

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab> with AutomaticKeepAliveClientMixin {
  final _input = TextEditingController();
  List<ClientMessage>? _messages;
  String? _lawyerName;
  bool _sending = false;
  String? _error;
  AppState? _state;

  @override
  bool get wantKeepAlive => true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final state = AppScope.read(context);
    if (!identical(state, _state)) {
      _state?.dataVersion.removeListener(_load);
      _state = state;
      state.dataVersion.addListener(_load);
      _load();
    }
  }

  @override
  void dispose() {
    _state?.dataVersion.removeListener(_load);
    _input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final repo = _state!.repo;
    try {
      final results = await Future.wait([
        repo.clientMessages(widget.matter.id),
        repo.linkedLawyerName(widget.matter.id),
      ]);
      if (mounted) {
        setState(() {
          _messages = results[0] as List<ClientMessage>;
          _lawyerName = results[1] as String?;
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = "Messages couldn't be loaded just now.");
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await AppScope.read(context).repo.sendClientMessage(widget.matter.id, text);
      _input.clear();
      await _load();
    } catch (_) {
      if (mounted) showToast(context, "That didn't send. Please try again.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final theme = Theme.of(context);
    final state = AppScope.of(context);
    final messages = _messages;
    final me = state.user?.id;
    final linked = widget.clientView || _lawyerName != null;

    return LayoutBuilder(builder: (context, constraints) {
      final horizontal = contentPadding(constraints.maxWidth);
      if (messages != null && !linked) {
        return ListView(
          padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: 16),
          children: [
            EmptyView(
              icon: Icons.forum_outlined,
              title: 'Work with a lawyer',
              body: "Share this matter with a verified lawyer and you'll be able to message them here.",
              action: 'Find a lawyer',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => LawyersScreen(matter: widget.matter)),
              ),
            ),
          ],
        );
      }
      return Column(
        children: [
          Expanded(
            child: _error != null && messages == null
                ? Padding(
                    padding: EdgeInsets.all(horizontal),
                    child: Note(_error!, tone: NoteTone.error, action: 'Try again', onAction: _load),
                  )
                : messages == null
                    ? const CenteredLoader()
                    : messages.isEmpty
                        ? ListView(
                            children: [
                              EmptyView(
                                icon: Icons.forum_outlined,
                                title: 'No messages yet',
                                body: widget.clientView
                                    ? 'Introduce yourself to your client.'
                                    : '${_lawyerName ?? 'Your lawyer'} will reply here.',
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: EdgeInsets.symmetric(horizontal: horizontal, vertical: 14),
                            itemCount: messages.length,
                            itemBuilder: (context, i) {
                              final message = messages[i];
                              final mine = message.senderId == me;
                              return Align(
                                alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(maxWidth: constraints.maxWidth * 0.8),
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 9),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: mine ? theme.colorScheme.primary : theme.colorScheme.surface,
                                      borderRadius: BorderRadius.circular(17),
                                      border: mine ? null : Border.all(color: theme.colorScheme.outline),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          message.body,
                                          style: theme.textTheme.bodyMedium?.copyWith(
                                            color: mine ? theme.colorScheme.onPrimary : null,
                                          ),
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          DateFormat.MMMd().add_jm().format(message.createdAt.toLocal()),
                                          style: theme.textTheme.bodySmall?.copyWith(
                                            fontSize: 10.5,
                                            color: mine
                                                ? theme.colorScheme.onPrimary.withValues(alpha: 0.75)
                                                : null,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              horizontal,
              10,
              horizontal,
              // The Scaffold hides the keyboard's height from its body, so ask the window.
              View.of(context).viewInsets.bottom > 0 ? 10 : MediaQuery.paddingOf(context).bottom + 10,
            ),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.colorScheme.outline))),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 8000,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(hintText: 'Write a message…', counterText: ''),
                  ),
                ),
                const SizedBox(width: 8),
                IconActionButton(
                  icon: Icons.send_rounded,
                  tooltip: 'Send',
                  color: context.accentColor,
                  onPressed: _sending ? null : _send,
                ),
              ],
            ),
          ),
        ],
      );
    });
  }
}
