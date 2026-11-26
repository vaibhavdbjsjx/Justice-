import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/ui.dart';
import 'analysis_screen.dart';
import 'consent.dart';
import 'generate_screen.dart';
import 'paywall_screen.dart';

/// Picks a document and starts reading it. Plan and permission are checked first,
/// so nobody chooses a file only to be turned away afterward.
Future<void> startDocumentAnalysis(BuildContext context, {String? matterId}) async {
  final state = AppScope.read(context);
  if (!await ensureAiConsent(context)) return;
  if (!context.mounted) return;

  final billing = state.billing;
  if (billing != null && billing.isFree) {
    await showPaywall(
      context,
      reason: 'Document Intelligence is part of Plus. Upload any legal document and see what it really says.',
    );
    if (!context.mounted || (state.billing?.isFree ?? true)) return;
  }

  final canScan = await NativeBridge.instance.canScan();
  if (!context.mounted) return;

  final file = await showLexaSheet<PickedFile>(
    context,
    (sheet) => _SourceSheet(canScan: canScan),
  );
  if (file == null || !context.mounted) return;

  if (file.size > 20 * 1024 * 1024) {
    showToast(context, 'That file is over 20 MB. Try a smaller file or a clear photo of the key pages.');
    return;
  }

  await Navigator.of(context).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => AnalysisProgressScreen(file: file, matterId: matterId),
    ),
  );
  state.notifyDataChanged();
}

class _SourceSheet extends StatelessWidget {
  const _SourceSheet({required this.canScan});

  final bool canScan;

  Future<void> _pick(BuildContext context, Future<PickedFile?> Function() picker) async {
    final navigator = Navigator.of(context);
    final file = await picker();
    navigator.pop(file);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bridge = NativeBridge.instance;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 0, 6, 12),
            child: Text('Read a document', style: theme.textTheme.headlineMedium),
          ),
          SettingsGroup(
            children: [
              if (canScan)
                SettingsRow(
                  title: 'Scan with camera',
                  subtitle: 'For a paper notice, letter, or contract',
                  icon: Icons.document_scanner_outlined,
                  onTap: () => _pick(context, bridge.scanDocument),
                ),
              SettingsRow(
                title: 'Choose a file',
                subtitle: 'PDF or image, up to 20 MB',
                icon: Icons.folder_open_rounded,
                onTap: () => _pick(context, bridge.pickDocument),
              ),
              SettingsRow(
                title: 'Choose a photo',
                subtitle: 'A clear photo of the page',
                icon: Icons.photo_outlined,
                onTap: () => _pick(context, bridge.pickPhoto),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A document in a list: what it is and what was found.
class DocumentCard extends StatelessWidget {
  const DocumentCard({super.key, required this.document, required this.onChanged});

  final DocumentItem document;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final generated = document.type == 'generated';
    final flagged = document.annotations?['risky_or_unusual_clauses'];
    final hasFlags = flagged is List && flagged.isNotEmpty;

    return LexaCard(
      padding: const EdgeInsets.all(15),
      label: document.title,
      onTap: () async {
        await openDocument(context, document);
        onChanged();
      },
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(14)),
            child: Icon(
              generated ? Icons.edit_note_rounded : Icons.description_outlined,
              size: 22,
              color: context.accentColor,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(document.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(
                  formatDate(document.createdAt.toLocal()),
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Pill(
            document.summaryLine,
            tone: generated
                ? PillTone.neutral
                : hasFlags
                    ? PillTone.alert
                    : PillTone.success,
          ),
        ],
      ),
    );
  }
}

/// The document library.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<DocumentItem>? _documents;
  Object? _error;
  AppState? _state;
  String _query = '';

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
      final documents = await _state!.repo.documents();
      if (mounted) {
        setState(() {
          _documents = documents;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = AppScope.of(context);
    final documents = _documents;
    final query = _query.trim().toLowerCase();
    final visible = documents == null || query.isEmpty
        ? documents
        : documents.where((d) => d.title.toLowerCase().contains(query)).toList();

    return LexaPage(
      title: 'Documents',
      onRefresh: _load,
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            Reveal(
              child: _FeatureCard(
                icon: Icons.document_scanner_outlined,
                title: 'Read a document',
                body: 'See obligations, deadlines, and risky clauses in plain language.',
                onTap: () => startDocumentAnalysis(context),
                emphasized: true,
              ),
            ),
            const SizedBox(height: 10),
            Reveal(
              index: 1,
              child: _FeatureCard(
                icon: Icons.edit_note_rounded,
                title: state.profile?.isLawyer == true ? 'Draft a document' : 'Draft a letter',
                body: 'A first draft from your facts, with every assumption flagged.',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const GenerateScreen()),
                ),
              ),
            ),
            if (documents != null && documents.length > 4) ...[
              const SizedBox(height: 16),
              TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: const InputDecoration(
                  hintText: 'Search your documents',
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                ),
              ),
            ],
            const SizedBox(height: 4),
            if (_error != null && documents == null) ...[
              const SizedBox(height: 16),
              Note("Your documents couldn't be loaded just now.",
                  tone: NoteTone.error, action: 'Try again', onAction: _load),
            ] else if (documents == null) ...[
              const SizedBox(height: 22),
              const SkeletonCards(count: 3),
            ] else if (documents.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 26),
                child: Text(
                  'Your documents and drafts will appear here.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall,
                ),
              )
            else ...[
              const SectionLabel('Your library'),
              if (visible!.isEmpty)
                Text('No documents match that search.', style: theme.textTheme.bodySmall),
              for (var i = 0; i < visible.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Reveal(index: i, child: DocumentCard(document: visible[i], onChanged: _load)),
                ),
            ],
          ],
        ),
      ],
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.onTap,
    this.emphasized = false,
  });

  final IconData icon;
  final String title;
  final String body;
  final VoidCallback onTap;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onColor = theme.colorScheme.onSecondary;
    return LexaCard(
      onTap: onTap,
      label: title,
      color: emphasized ? context.accentColor : null,
      borderColor: emphasized ? context.accentColor : null,
      child: Row(
        children: [
          Icon(icon, size: 28, color: emphasized ? onColor : context.accentColor),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium?.copyWith(color: emphasized ? onColor : null)),
                const SizedBox(height: 2),
                Text(
                  body,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: emphasized ? onColor.withValues(alpha: 0.86) : null,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: emphasized ? onColor : context.mutedColor),
        ],
      ),
    );
  }
}
