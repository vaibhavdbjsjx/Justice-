import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api/client.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../services/analysis_service.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/ai_legal_output.dart';
import '../widgets/report_sheet.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';
import 'chat_screen.dart';
import 'consent.dart';
import 'generate_screen.dart';
import 'matters_screen.dart';
import 'paywall_screen.dart';

/// Opens whichever view a stored document needs.
Future<void> openDocument(BuildContext context, DocumentItem document) async {
  final annotations = document.annotations;
  final Widget? screen;
  if (document.isAnalysis) {
    screen = AnalysisScreen(
      title: document.title,
      analysis: DocumentAnalysis.fromJson(annotations!),
      documentId: document.id,
      matterId: document.matterId,
    );
  } else if (document.isGeneratedDraft) {
    screen = DraftScreen(draft: GeneratedDoc.fromJson(annotations!), documentId: document.id);
  } else {
    screen = null;
  }
  if (screen == null) {
    showToast(context, "This document can't be opened on this device yet.");
    return;
  }
  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen!));
}

/// Opens a document by id, for links from notifications and Live Activities.
class DocumentLoaderScreen extends StatefulWidget {
  const DocumentLoaderScreen({super.key, required this.documentId});

  final String documentId;

  @override
  State<DocumentLoaderScreen> createState() => _DocumentLoaderScreenState();
}

class _DocumentLoaderScreenState extends State<DocumentLoaderScreen> {
  late final Future<DocumentItem?> _future = AppScope.read(context).repo.document(widget.documentId);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DocumentItem?>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(appBar: AppBar(), body: const CenteredLoader());
        }
        final document = snapshot.data;
        if (document != null && document.isAnalysis) {
          return AnalysisScreen(
            title: document.title,
            analysis: DocumentAnalysis.fromJson(document.annotations!),
            documentId: document.id,
            matterId: document.matterId,
          );
        }
        if (document != null && document.isGeneratedDraft) {
          return DraftScreen(draft: GeneratedDoc.fromJson(document.annotations!), documentId: document.id);
        }
        return Scaffold(
          appBar: AppBar(),
          body: const EmptyView(
            icon: Icons.description_outlined,
            title: "This document isn't available",
            body: 'It may have been deleted.',
          ),
        );
      },
    );
  }
}

/// The wait while a document is read: a scene in depth, honest stages, and word
/// that it's safe to leave because the Dynamic Island keeps watch.
class AnalysisProgressScreen extends StatefulWidget {
  const AnalysisProgressScreen({super.key, required this.file, this.matterId});

  final PickedFile file;
  final String? matterId;

  @override
  State<AnalysisProgressScreen> createState() => _AnalysisProgressScreenState();
}

class _AnalysisProgressScreenState extends State<AnalysisProgressScreen> {
  static const _stages = [
    'Reading your document',
    'Finding obligations and deadlines',
    'Checking for risky clauses',
    'Writing it in plain language',
  ];

  int _stage = 0;
  Timer? _timer;
  String? _error;
  bool _upgrade = false;
  bool _liveActivities = false;

  @override
  void initState() {
    super.initState();
    NativeBridge.instance.liveActivitiesEnabled().then((enabled) {
      if (mounted) setState(() => _liveActivities = enabled);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _run() async {
    setState(() {
      _error = null;
      _upgrade = false;
      _stage = 0;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 7), (_) {
      if (_stage < _stages.length - 1) setState(() => _stage++);
    });

    final state = AppScope.read(context);
    final navigator = Navigator.of(context);
    try {
      final result = await AnalysisService(state.api, state.repo).analyze(
        file: widget.file,
        matterId: widget.matterId,
      );
      HapticFeedback.mediumImpact();
      state.notifyDataChanged();
      if (!mounted) return;
      navigator.pushReplacement(
        MaterialPageRoute(
          builder: (_) => AnalysisScreen(
            title: result.title,
            analysis: result.analysis,
            documentId: result.documentId,
            matterId: result.matterId,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.consentRequired) {
        await state.refresh();
        if (mounted && await ensureAiConsent(context)) {
          _run();
          return;
        }
      }
      if (mounted) {
        setState(() {
          _error = e.message;
          _upgrade = e.upgrade;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = "Lexa couldn't finish reading that document. Nothing was lost. Please try again.");
      }
    } finally {
      _timer?.cancel();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final size = MediaQuery.sizeOf(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(26),
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerRight,
                    child: IconActionButton(
                      icon: Icons.close_rounded,
                      tooltip: _error == null ? 'Keep reading in the background' : 'Close',
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                  ),
                  const Spacer(),
                  if (_error == null) ...[
                    DocumentScanScene(size: size.height < 720 ? 240 : 320),
                    const SizedBox(height: 34),
                    AnimatedSwitcher(
                      duration: LexaMotion.slow,
                      switchInCurve: LexaMotion.curve,
                      child: Text(
                        _stages[_stage],
                        key: ValueKey(_stage),
                        textAlign: TextAlign.center,
                        style: theme.textTheme.headlineMedium,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _liveActivities
                          ? "You can leave the app. Lexa keeps reading, shows its progress in the Dynamic Island and on your Lock Screen, and lets you know when it's ready."
                          : "You can leave the app. Lexa keeps reading and lets you know when it's ready.",
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor),
                    ),
                  ] else ...[
                    EmptyView(
                      icon: _upgrade ? Icons.workspace_premium_outlined : Icons.description_outlined,
                      title: _upgrade ? 'This is a Plus feature' : "Couldn't finish reading it",
                      body: _error!,
                    ),
                    LexaButton(
                      _upgrade ? 'See plans' : 'Try again',
                      onPressed: _upgrade ? () => showPaywall(context) : _run,
                    ),
                  ],
                  const Spacer(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The reading of a document: a summary first, then what's flagged, what you owe,
/// and when, with each finding tied back to the original text.
class AnalysisScreen extends StatefulWidget {
  const AnalysisScreen({
    super.key,
    required this.title,
    required this.analysis,
    this.documentId,
    this.matterId,
  });

  final String title;
  final DocumentAnalysis analysis;
  final String? documentId;
  final String? matterId;

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen> {
  final _segmentKeys = <int, GlobalKey>{};
  Set<int> _highlighted = {};

  GlobalKey _keyFor(int id) => _segmentKeys.putIfAbsent(id, GlobalKey.new);

  /// Shows where a finding comes from, in the original text.
  void _showInDocument(List<int> ids) {
    if (ids.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _highlighted = ids.toSet());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _segmentKeys[ids.first]?.currentContext;
      if (target != null && target.mounted) {
        Scrollable.ensureVisible(target, duration: LexaMotion.slow, curve: LexaMotion.curve, alignment: 0.2);
      }
    });
  }

  Future<void> _addDate(ImportantDate date) async {
    final matterId = widget.matterId;
    if (matterId == null) return;
    final saved = await showLexaSheet<bool>(
      context,
      (_) => DeadlineFormSheet(matterId: matterId, initialTitle: date.label, initialDate: date.isoDate),
    );
    if (saved == true && mounted) showToast(context, 'Added to your deadlines');
  }

  Future<void> _delete() async {
    final id = widget.documentId;
    if (id == null) return;
    final navigator = Navigator.of(context);
    final state = AppScope.read(context);
    final confirmed = await confirmAction(
      context,
      title: 'Delete this document?',
      body: 'Its analysis will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!confirmed) return;
    try {
      await state.repo.deleteDocument(id);
      state.notifyDataChanged();
      navigator.pop();
    } catch (_) {
      if (mounted) showToast(context, "That couldn't be deleted. Please try again.");
    }
  }

  void _ask() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatScreen(
          matterId: widget.matterId,
          matterTitle: widget.title,
        ),
      ),
    );
  }

  Widget _findings(BuildContext context) {
    final theme = Theme.of(context);
    final analysis = widget.analysis;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Reveal(
          child: Row(
            children: [
              Expanded(
                child: Text(analysis.documentType, style: theme.textTheme.headlineMedium),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Reveal(
          index: 1,
          child: LexaCard(
            child: AiLegalOutput(child: Text(analysis.summary, style: theme.textTheme.bodyLarge)),
          ),
        ),
        if (analysis.jurisdictionNote != null) ...[
          const SizedBox(height: 10),
          Reveal(index: 2, child: Note(analysis.jurisdictionNote!)),
        ],
        if (analysis.truncated) ...[
          const SizedBox(height: 10),
          const Note('This document is long, so the original text below shows only the parts behind each finding.'),
        ],
        if (analysis.riskyClauses.isNotEmpty) ...[
          SectionLabel('Worth a closer look (${analysis.riskyClauses.length})'),
          for (var i = 0; i < analysis.riskyClauses.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Reveal(index: i, child: _ClauseCard(clause: analysis.riskyClauses[i], onShow: _showInDocument)),
            ),
        ],
        if (analysis.obligations.isNotEmpty) ...[
          const SectionLabel('What each side must do'),
          LexaCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < analysis.obligations.length; i++) ...[
                  if (i > 0) Divider(height: 1, indent: 16, color: theme.colorScheme.outline),
                  _ObligationRow(obligation: analysis.obligations[i], onShow: _showInDocument),
                ],
              ],
            ),
          ),
        ],
        if (analysis.importantDates.isNotEmpty) ...[
          const SectionLabel('Important dates'),
          LexaCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < analysis.importantDates.length; i++) ...[
                  if (i > 0) Divider(height: 1, indent: 16, color: theme.colorScheme.outline),
                  _DateRow(
                    date: analysis.importantDates[i],
                    onAdd: widget.matterId == null ? null : () => _addDate(analysis.importantDates[i]),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _original(BuildContext context) {
    final theme = Theme.of(context);
    final segments = widget.analysis.segments;
    if (segments.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel('Original text'),
        LexaCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final segment in segments)
                AnimatedContainer(
                  key: _keyFor(segment.id),
                  duration: LexaMotion.slow,
                  curve: LexaMotion.curve,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _highlighted.contains(segment.id) ? context.accentSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (segment.heading != null && segment.heading!.isNotEmpty) ...[
                        Text(segment.heading!, style: theme.textTheme.titleSmall),
                        const SizedBox(height: 3),
                      ],
                      SelectableText(segment.text, style: theme.textTheme.bodyMedium?.copyWith(height: 1.6)),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1000;
    final actions = <Widget>[
      if (wide && widget.matterId != null)
        IconActionButton(
          icon: Icons.chat_bubble_outline_rounded,
          tooltip: 'Ask about this document',
          onPressed: _ask,
        ),
      IconActionButton(
        icon: Icons.ios_share_rounded,
        tooltip: 'Share summary',
        onPressed: () => NativeBridge.instance.shareText('${widget.title}\n\n${widget.analysis.summary}'),
      ),
      IconActionButton(
        icon: Icons.flag_outlined,
        tooltip: 'Report a problem',
        onPressed: () => showReportSheet(
          context,
          kind: 'ai_document',
          excerpt: widget.analysis.summary,
          referenceId: widget.documentId,
        ),
      ),
      if (widget.documentId != null)
        IconActionButton(icon: Icons.delete_outline_rounded, tooltip: 'Delete', onPressed: _delete),
    ];

    if (wide) {
      // Findings beside the document, so a tap lights up its source in place.
      return Scaffold(
        appBar: AppBar(title: Text(widget.title), actions: actions),
        body: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ListView(padding: const EdgeInsets.fromLTRB(28, 16, 14, 40), children: [_findings(context)]),
            ),
            Expanded(
              child: ListView(padding: const EdgeInsets.fromLTRB(14, 0, 28, 40), children: [_original(context)]),
            ),
          ],
        ),
      );
    }

    return LexaPage(
      title: widget.title,
      actions: actions,
      bottom: widget.matterId == null
          ? null
          : LexaButton('Ask about this document', icon: Icons.chat_bubble_outline_rounded, onPressed: _ask),
      slivers: [
        // One piece, not a lazy list: "Show in document" scrolls to text far
        // below, which has to exist already for the scroll to find it.
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              _findings(context),
              _original(context),
            ],
          ),
        ),
      ],
    );
  }
}

class _ClauseCard extends StatelessWidget {
  const _ClauseCard({required this.clause, required this.onShow});

  final RiskyClause clause;
  final ValueChanged<List<int>> onShow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LexaCard(
      onTap: clause.segmentIds.isEmpty ? null : () => onShow(clause.segmentIds),
      label: clause.summary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(
                clause.isHigh ? 'High concern' : 'Caution',
                tone: clause.isHigh ? PillTone.alert : PillTone.accent,
                icon: clause.isHigh ? Icons.warning_amber_rounded : Icons.flag_outlined,
              ),
              if (clause.section != null) ...[
                const SizedBox(width: 8),
                Expanded(child: Text(clause.section!, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall)),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(clause.summary, style: theme.textTheme.titleSmall),
          const SizedBox(height: 4),
          Text(clause.why, style: theme.textTheme.bodyMedium),
          if (clause.segmentIds.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Show in document', style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor)),
          ],
        ],
      ),
    );
  }
}

class _ObligationRow extends StatelessWidget {
  const _ObligationRow({required this.obligation, required this.onShow});

  final Obligation obligation;
  final ValueChanged<List<int>> onShow;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Pressable(
      scale: 0.99,
      onTap: obligation.segmentIds.isEmpty ? null : () => onShow(obligation.segmentIds),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(obligation.party.toUpperCase(), style: theme.textTheme.labelSmall),
            const SizedBox(height: 4),
            Text(obligation.obligation, style: theme.textTheme.bodyMedium),
            if (obligation.deadline != null && obligation.deadline!.isNotEmpty) ...[
              const SizedBox(height: 5),
              Row(
                children: [
                  Icon(Icons.schedule_rounded, size: 14, color: context.accentColor),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      obligation.deadline!,
                      style: theme.textTheme.bodySmall?.copyWith(color: context.accentColor),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DateRow extends StatelessWidget {
  const _DateRow({required this.date, this.onAdd});

  final ImportantDate date;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(15, 12, 8, 12),
      child: Row(
        children: [
          Icon(Icons.event_outlined, size: 20, color: context.accentColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(date.label, style: theme.textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(date.dateText, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          if (onAdd != null)
            IconActionButton(
              icon: Icons.add_alert_outlined,
              size: 20,
              tooltip: 'Add to deadlines',
              color: context.accentColor,
              onPressed: onAdd,
            ),
        ],
      ),
    );
  }
}
