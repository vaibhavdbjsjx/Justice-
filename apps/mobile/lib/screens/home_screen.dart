import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/cupertino.dart' show CupertinoSliverRefreshControl;
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';
import 'documents_screen.dart';
import 'generate_screen.dart';
import 'lawyers_screen.dart';
import 'matter_detail_screen.dart';
import 'paywall_screen.dart';

/// The overview: what's due, what's recent, and the fastest way into each tool.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _scroll = ScrollController();
  final _scrollProgress = ValueNotifier<double>(0);
  List<Deadline>? _deadlines;
  List<DocumentItem>? _documents;
  Object? _error;
  AppState? _state;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      _scrollProgress.value = (_scroll.offset / 300).clamp(0.0, 1.0);
    });
  }

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
    _scroll.dispose();
    _scrollProgress.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final state = _state!;
    try {
      final results = await Future.wait([state.repo.upcomingDeadlines(), state.repo.documents()]);
      if (!mounted) return;
      setState(() {
        _deadlines = results[0] as List<Deadline>;
        _documents = results[1] as List<DocumentItem>;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _refresh() async {
    await Future.wait([_load(), _state!.refreshBilling()]);
  }

  void _go(int tab) => _state!.tab.value = tab;

  void _push(Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = AppScope.of(context);
    final profile = state.profile;
    final billing = state.billing;
    final name = profile?.firstName ?? '';
    final media = MediaQuery.of(context);
    final deadlines = _deadlines;
    final documents = _documents;

    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final horizontal = contentPadding(constraints.maxWidth);
          return CustomScrollView(
            controller: _scroll,
            physics: lexaScrollPhysics,
            slivers: [
              CupertinoSliverRefreshControl(onRefresh: _refresh),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(horizontal, media.padding.top + 14, horizontal, 0),
                sliver: SliverToBoxAdapter(
                  child: Reveal(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.isEmpty ? 'How can Lexa help?' : 'Hello, $name',
                          style: theme.textTheme.displayMedium,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.place_outlined, size: 15, color: context.accentColor),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                profile?.jurisdictionLabel ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: ValueListenableBuilder<double>(
                  valueListenable: _scrollProgress,
                  builder: (context, progress, _) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: HeroStack(
                      height: math.min(constraints.maxWidth * 0.72, 300),
                      scrollProgress: progress,
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.symmetric(horizontal: horizontal),
                sliver: SliverList.list(
                  children: [
                    Reveal(
                      index: 1,
                      child: Pressable(
                        onTap: () => _go(1),
                        label: 'Ask Lexa',
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.surface,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: context.borderStrong),
                            boxShadow: context.softShadow,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  profile?.isLawyer == true
                                      ? 'Research a question of law…'
                                      : 'Describe your situation…',
                                  style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor),
                                ),
                              ),
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(color: context.accentColor, shape: BoxShape.circle),
                                child: Icon(Icons.arrow_upward_rounded, size: 19, color: theme.colorScheme.onSecondary),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (billing != null && billing.isFree && billing.paymentsEnabled) ...[
                      const SizedBox(height: 12),
                      Reveal(index: 2, child: _UsageCard(billing: billing)),
                    ],
                    const SizedBox(height: 14),
                    Reveal(
                      index: 3,
                      child: LayoutBuilder(
                        builder: (context, box) {
                          final columns = box.maxWidth >= 560 ? 4 : 2;
                          final actions = [
                            _QuickAction(
                              icon: Icons.document_scanner_outlined,
                              label: 'Read a document',
                              onTap: () => startDocumentAnalysis(context),
                            ),
                            _QuickAction(
                              icon: Icons.edit_note_rounded,
                              label: 'Draft a letter',
                              onTap: () => _push(const GenerateScreen()),
                            ),
                            _QuickAction(
                              icon: Icons.folder_open_rounded,
                              label: profile?.isLawyer == true ? 'Your clients' : 'Your matters',
                              onTap: () => _go(2),
                            ),
                            _QuickAction(
                              icon: Icons.gavel_rounded,
                              label: 'Find a lawyer',
                              onTap: () => _push(const LawyersScreen()),
                            ),
                          ];
                          const gap = 10.0;
                          final width = (box.maxWidth - gap * (columns - 1)) / columns;
                          return Wrap(
                            spacing: gap,
                            runSpacing: gap,
                            children: [for (final a in actions) SizedBox(width: width, child: a)],
                          );
                        },
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 18),
                      Note(
                        "Your overview couldn't be loaded just now.",
                        tone: NoteTone.error,
                        action: 'Try again',
                        onAction: _load,
                      ),
                    ],
                    if (deadlines == null && _error == null) ...[
                      const SizedBox(height: 26),
                      const SkeletonCards(count: 2, height: 72),
                    ],
                    if (deadlines != null && deadlines.isNotEmpty) ...[
                      const SectionLabel('Coming up'),
                      for (var i = 0; i < math.min(deadlines.length, 4); i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Reveal(
                            index: i,
                            child: DeadlineCard(
                              deadline: deadlines[i],
                              onChanged: _load,
                              onOpen: () => _push(MatterLoaderScreen(matterId: deadlines[i].matterId)),
                            ),
                          ),
                        ),
                    ],
                    if (documents != null && documents.isNotEmpty) ...[
                      SectionLabel('Recent documents', action: 'See all', onAction: () => _go(3)),
                      for (var i = 0; i < math.min(documents.length, 3); i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Reveal(
                            index: i,
                            child: DocumentCard(document: documents[i], onChanged: _load),
                          ),
                        ),
                    ],
                    SizedBox(height: media.padding.bottom + 28),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Room for the icon and two lines of label at the current text size.
    final lineHeight = MediaQuery.textScalerOf(context).scale(14) * 1.35;
    return Pressable(
      onTap: onTap,
      label: label,
      child: Container(
        height: math.max(94, 28 + 23 + 8 + lineHeight * 2),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: theme.colorScheme.outline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(icon, size: 23, color: context.accentColor),
            Text(label, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.billing});

  final BillingStatus billing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final used = billing.chatUsed.clamp(0, billing.chatLimit);
    final left = billing.chatLimit - used;
    return LexaCard(
      padding: const EdgeInsets.all(16),
      onTap: () => showPaywall(context),
      label: 'See plans',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '$left of ${billing.chatLimit} free questions left this month',
                  style: theme.textTheme.titleSmall,
                ),
              ),
              Text('See plans', style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: billing.chatLimit == 0 ? 0 : used / billing.chatLimit),
              duration: const Duration(milliseconds: 900),
              curve: LexaMotion.curve,
              builder: (context, value, _) => LinearProgressIndicator(
                value: value,
                minHeight: 6,
                backgroundColor: context.surfaceSunken,
                color: context.accentColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A deadline with its countdown, and live tracking once it's due today.
class DeadlineCard extends StatefulWidget {
  const DeadlineCard({
    super.key,
    required this.deadline,
    required this.onChanged,
    this.onOpen,
    this.showMatter = true,
  });

  final Deadline deadline;
  final VoidCallback onChanged;
  final VoidCallback? onOpen;
  final bool showMatter;

  @override
  State<DeadlineCard> createState() => _DeadlineCardState();
}

class _DeadlineCardState extends State<DeadlineCard> {
  String? _activityId;
  bool _saving = false;
  bool _canTrack = false;

  @override
  void initState() {
    super.initState();
    final bridge = NativeBridge.instance;
    bridge.deadlineActivityId(widget.deadline.title).then((id) {
      if (mounted && id != null) setState(() => _activityId = id);
    });
    if (widget.deadline.dueToday && !widget.deadline.isDone) {
      bridge.liveActivitiesEnabled().then((enabled) {
        if (mounted && enabled) setState(() => _canTrack = true);
      });
    }
  }

  Future<void> _toggleDone() async {
    final state = AppScope.read(context);
    final deadline = widget.deadline;
    setState(() => _saving = true);
    try {
      await state.repo.setDeadlineStatus(deadline.id, deadline.isDone ? 'upcoming' : 'completed');
      if (_activityId != null) {
        await NativeBridge.instance.endActivity(_activityId!);
        _activityId = null;
      }
      unawaited(state.reminders.reschedule());
      state.notifyDataChanged();
      widget.onChanged();
    } catch (_) {
      if (mounted) showToast(context, "That couldn't be saved. Please try again.");
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _track() async {
    final bridge = NativeBridge.instance;
    if (_activityId != null) {
      await bridge.endActivity(_activityId!);
      if (mounted) setState(() => _activityId = null);
      return;
    }
    final deadline = widget.deadline;
    final id = await bridge.startActivity(
      kind: 'deadline',
      title: deadline.title,
      headline: 'Due today',
      detail: deadline.matterTitle,
      dueAt: deadline.dueAt,
      deepLink: 'lexa://matters/${deadline.matterId}',
    );
    if (mounted) setState(() => _activityId = id);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final deadline = widget.deadline;
    final canTrack = _canTrack && deadline.dueToday && !deadline.isDone;

    return LexaCard(
      padding: const EdgeInsets.fromLTRB(6, 8, 14, 8),
      onTap: widget.onOpen,
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                tooltip: deadline.isDone ? 'Mark as not done' : 'Mark as done',
                onPressed: _saving ? null : _toggleDone,
                icon: AnimatedSwitcher(
                  duration: LexaMotion.base,
                  child: Icon(
                    deadline.isDone ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                    key: ValueKey(deadline.isDone),
                    size: 24,
                    color: deadline.isDone ? context.successColor : context.borderStrong,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      deadline.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        decoration: deadline.isDone ? TextDecoration.lineThrough : null,
                        color: deadline.isDone ? context.mutedColor : null,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text.rich(
                      TextSpan(
                        style: theme.textTheme.bodySmall,
                        children: [
                          TextSpan(
                            text: dueLabel(deadline),
                            style: TextStyle(color: dueColor(context, deadline), fontWeight: FontWeight.w600),
                          ),
                          if (widget.showMatter && deadline.matterTitle != null)
                            TextSpan(text: ' · ${deadline.matterTitle}'),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (canTrack)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 0, 6),
              child: LexaButton(
                _activityId == null ? 'Track live on your Lock Screen' : 'Stop tracking',
                icon: _activityId == null ? Icons.timer_outlined : Icons.stop_circle_outlined,
                style: _activityId == null ? LexaButtonStyle.secondary : LexaButtonStyle.ghost,
                compact: true,
                onPressed: _track,
              ),
            ),
        ],
      ),
    );
  }
}
