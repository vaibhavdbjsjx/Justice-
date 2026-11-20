import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import '../api/client.dart';
import '../legal/disclaimers.dart';
import '../models/models.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/ai_legal_output.dart';
import '../widgets/common.dart';
import '../widgets/markdown_lite.dart';
import '../widgets/report_sheet.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';
import 'consent.dart';
import 'paywall_screen.dart';

/// Professional instruments for lawyers. The instructions are free-form.
const _lawyerDocTypes = <(String, String, String, IconData)>[
  ('contract', 'Contract or agreement', 'Recitals, defined terms, and numbered clauses.', Icons.handshake_outlined),
  ('clause', 'Single clause', 'One drop-in clause for an existing agreement.', Icons.short_text_rounded),
  ('motion', 'Motion or application', 'Caption, grounds, argument, and prayer for relief.', Icons.gavel_rounded),
  ('memo', 'Legal memorandum', 'Question presented, brief answer, and discussion.', Icons.article_outlined),
  ('letter', 'Professional letter', 'Demand, advice, or engagement letter.', Icons.mail_outline_rounded),
];

/// Choose a template, answer a few questions, and get a first draft.
class GenerateScreen extends StatefulWidget {
  const GenerateScreen({super.key, this.matterId});

  final String? matterId;

  @override
  State<GenerateScreen> createState() => _GenerateScreenState();
}

class _GenerateScreenState extends State<GenerateScreen> {
  late final Future<List<DocTemplate>> _templates = AppScope.read(context).api.templates();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lawyer = AppScope.of(context).profile?.isLawyer ?? false;
    return LexaPage(
      title: 'Draft',
      subtitle: 'A starting point, never a finished legal document.',
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            if (lawyer) ...[
              const SectionLabel('Professional drafting'),
              for (var i = 0; i < _lawyerDocTypes.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Reveal(
                    index: i,
                    child: _TemplateCard(
                      title: _lawyerDocTypes[i].$2,
                      body: _lawyerDocTypes[i].$3,
                      icon: _lawyerDocTypes[i].$4,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => _LawyerDraftForm(
                            slug: _lawyerDocTypes[i].$1,
                            name: _lawyerDocTypes[i].$2,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              const SectionLabel('Templates'),
            ],
            FutureBuilder<List<DocTemplate>>(
              future: _templates,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const SkeletonCards(count: 4);
                }
                if (snapshot.hasError) {
                  return Text(
                    "Templates couldn't be loaded. Check your connection and try again.",
                    style: theme.textTheme.bodyMedium,
                  );
                }
                final templates = snapshot.data!;
                return Column(
                  children: [
                    for (var i = 0; i < templates.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Reveal(
                          index: i,
                          child: _TemplateCard(
                            title: templates[i].name,
                            body: templates[i].description,
                            icon: Icons.description_outlined,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => _TemplateForm(template: templates[i], matterId: widget.matterId),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ],
    );
  }
}

class _TemplateCard extends StatelessWidget {
  const _TemplateCard({required this.title, required this.body, required this.icon, required this.onTap});

  final String title;
  final String body;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LexaCard(
      padding: const EdgeInsets.all(15),
      onTap: onTap,
      label: title,
      child: Row(
        children: [
          Icon(icon, size: 24, color: context.accentColor),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(body, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: context.mutedColor),
        ],
      ),
    );
  }
}

class _TemplateForm extends StatefulWidget {
  const _TemplateForm({required this.template, this.matterId});

  final DocTemplate template;
  final String? matterId;

  @override
  State<_TemplateForm> createState() => _TemplateFormState();
}

class _TemplateFormState extends State<_TemplateForm> {
  late final Map<String, TextEditingController> _answers = {
    for (final field in widget.template.fields) field.name: TextEditingController(),
  };
  String? _error;

  @override
  void dispose() {
    for (final controller in _answers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate(TemplateField field) async {
    final now = DateTime.now();
    FocusScope.of(context).unfocus();
    final picked = await pickDate(
      context,
      title: field.label,
      initial: now,
      first: DateTime(now.year - 20),
      last: DateTime(now.year + 20, 12, 31),
    );
    if (picked != null) _answers[field.name]!.text = formatDate(picked);
  }

  Future<void> _generate() async {
    for (final field in widget.template.fields) {
      if (field.required && _answers[field.name]!.text.trim().isEmpty) {
        setState(() => _error = 'Please fill in "${field.label}".');
        return;
      }
    }
    setState(() => _error = null);
    FocusScope.of(context).unfocus();
    if (!await ensureAiConsent(context) || !mounted) return;

    final state = AppScope.read(context);
    final answers = {
      for (final entry in _answers.entries)
        if (entry.value.text.trim().isNotEmpty) entry.key: entry.value.text.trim(),
    };
    await Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _DraftingScreen(
          title: widget.template.name,
          run: () => state.api.generateDocument(
            template: widget.template.slug,
            answers: answers,
            matterId: widget.matterId,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LexaPage(
      title: widget.template.name,
      slivers: [
        SliverList.list(
          children: [
            Text(widget.template.description, style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor)),
            const SizedBox(height: 18),
            for (final field in widget.template.fields)
              LabeledField(
                label: field.label,
                required: field.required,
                hint: field.hint,
                child: TextField(
                  controller: _answers[field.name],
                  minLines: field.kind == 'textarea' ? 4 : 1,
                  maxLines: field.kind == 'textarea' ? 8 : 2,
                  readOnly: field.kind == 'date',
                  onTap: field.kind == 'date' ? () => _pickDate(field) : null,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: field.placeholder ?? '',
                    suffixIcon: field.kind == 'date' ? const Icon(Icons.event_outlined, size: 19) : null,
                  ),
                ),
              ),
            if (_error != null) ...[
              Note(_error!, tone: NoteTone.error),
              const SizedBox(height: 12),
            ],
            LexaButton('Draft it', key: const Key('draft-submit'), icon: Icons.auto_awesome_outlined, onPressed: _generate),
            const SizedBox(height: 10),
            Text(
              'Missing facts become [PLACEHOLDERS], and every judgment call is flagged for you to review.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ],
    );
  }
}

class _LawyerDraftForm extends StatefulWidget {
  const _LawyerDraftForm({required this.slug, required this.name});

  final String slug;
  final String name;

  @override
  State<_LawyerDraftForm> createState() => _LawyerDraftFormState();
}

class _LawyerDraftFormState extends State<_LawyerDraftForm> {
  final _instructions = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _instructions.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final text = _instructions.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Describe what you need drafted.');
      return;
    }
    setState(() => _error = null);
    FocusScope.of(context).unfocus();
    if (!await ensureAiConsent(context) || !mounted) return;
    final state = AppScope.read(context);
    await Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _DraftingScreen(
          title: widget.name,
          run: () => state.api.draftForLawyer(docType: widget.slug, instructions: text),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LexaPage(
      title: widget.name,
      slivers: [
        SliverList.list(
          children: [
            LabeledField(
              label: 'Instructions',
              required: true,
              hint: 'Parties, position to take, governing law, and any authorities to rely on.',
              child: TextField(
                controller: _instructions,
                minLines: 7,
                maxLines: 14,
                textCapitalization: TextCapitalization.sentences,
              ),
            ),
            if (_error != null) ...[
              Note(_error!, tone: NoteTone.error),
              const SizedBox(height: 12),
            ],
            LexaButton('Draft it', icon: Icons.auto_awesome_outlined, onPressed: _generate),
          ],
        ),
      ],
    );
  }
}

/// The wait while a draft is written, carried through the Dynamic Island so
/// leaving the app doesn't mean losing track of it.
class _DraftingScreen extends StatefulWidget {
  const _DraftingScreen({required this.title, required this.run});

  final String title;
  final Future<GeneratedDoc> Function() run;

  @override
  State<_DraftingScreen> createState() => _DraftingScreenState();
}

class _DraftingScreenState extends State<_DraftingScreen> {
  String? _error;
  bool _upgrade = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  Future<void> _start() async {
    setState(() {
      _error = null;
      _upgrade = false;
    });
    final state = AppScope.read(context);
    final navigator = Navigator.of(context);
    final bridge = NativeBridge.instance;
    final background = await bridge.beginBackgroundTime();
    final activity = await bridge.startActivity(
      kind: 'drafting',
      title: widget.title,
      headline: 'Writing your first draft',
      detail: 'Your facts go in, and anything missing becomes a placeholder.',
      expectedSeconds: 22,
      deepLink: 'lexa://documents',
    );

    try {
      final draft = await widget.run();
      HapticFeedback.mediumImpact();
      if (activity != null) {
        await bridge.finishActivity(
          activity,
          succeeded: true,
          headline: 'Your draft is ready',
          detail: 'Review it before you send anything.',
        );
      }
      state.notifyDataChanged();
      state.refreshBilling();
      if (!mounted) return;
      navigator.pushReplacement(MaterialPageRoute(
        builder: (_) => DraftScreen(draft: draft, documentId: draft.documentId),
      ));
    } on ApiException catch (e) {
      if (activity != null) await bridge.endActivity(activity);
      if (!mounted) return;
      if (e.consentRequired) {
        await state.refresh();
        if (mounted && await ensureAiConsent(context)) {
          await _start();
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
      if (activity != null) await bridge.endActivity(activity);
      if (mounted) {
        setState(() => _error = "Lexa couldn't complete that request. Please try again in a moment.");
      }
    } finally {
      await bridge.endBackgroundTime(background);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
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
                      tooltip: 'Close',
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                  ),
                  const Spacer(),
                  if (_error == null) ...[
                    const DraftingScene(),
                    const SizedBox(height: 30),
                    Text('Writing your first draft', textAlign: TextAlign.center, style: theme.textTheme.headlineMedium),
                    const SizedBox(height: 8),
                    Text(
                      'Missing facts become placeholders, and judgment calls get flagged for review.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor),
                    ),
                  ] else ...[
                    EmptyView(
                      icon: _upgrade ? Icons.workspace_premium_outlined : Icons.edit_note_rounded,
                      title: _upgrade ? "You've reached your plan's limit" : "That draft couldn't be completed",
                      body: _error!,
                    ),
                    LexaButton(_upgrade ? 'See plans' : 'Try again', onPressed: _upgrade ? () => showPaywall(context) : _start),
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

/// A generated draft: the review notice first, the checklist beside it, and
/// export to PDF or Word through the share sheet.
class DraftScreen extends StatefulWidget {
  const DraftScreen({super.key, required this.draft, this.documentId});

  final GeneratedDoc draft;
  final String? documentId;

  @override
  State<DraftScreen> createState() => _DraftScreenState();
}

class _DraftScreenState extends State<DraftScreen> {
  String? _exporting;

  Future<void> _export(String format) async {
    setState(() => _exporting = format);
    final api = AppScope.read(context).api;
    try {
      final bytes = await api.exportDocument(
        title: widget.draft.title,
        bodyMarkdown: widget.draft.bodyMarkdown,
        format: format,
      );
      final directory = await getTemporaryDirectory();
      final safeTitle = widget.draft.title.replaceAll(RegExp(r'[^\w -]+'), '').trim();
      final file = File('${directory.path}/${safeTitle.isEmpty ? 'Draft' : safeTitle}.$format');
      await file.writeAsBytes(bytes);
      await NativeBridge.instance.shareFile(file.path);
    } on ApiException catch (e) {
      if (mounted) showToast(context, e.message);
    } catch (_) {
      if (mounted) showToast(context, "That document couldn't be exported. Please try again.");
    } finally {
      if (mounted) setState(() => _exporting = null);
    }
  }

  Future<void> _delete() async {
    final id = widget.documentId;
    if (id == null) return;
    final navigator = Navigator.of(context);
    final state = AppScope.read(context);
    final confirmed = await confirmAction(
      context,
      title: 'Delete this draft?',
      body: 'It will be permanently deleted.',
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final draft = widget.draft;
    return LexaPage(
      title: draft.title,
      actions: [
        IconActionButton(
          icon: Icons.copy_rounded,
          tooltip: 'Copy',
          onPressed: () {
            Clipboard.setData(ClipboardData(text: draft.bodyMarkdown));
            showToast(context, 'Copied');
          },
        ),
        IconActionButton(
          icon: Icons.flag_outlined,
          tooltip: 'Report a problem',
          onPressed: () => showReportSheet(
            context,
            kind: 'ai_document',
            excerpt: draft.bodyMarkdown,
            referenceId: widget.documentId,
          ),
        ),
        if (widget.documentId != null)
          IconActionButton(icon: Icons.delete_outline_rounded, tooltip: 'Delete', onPressed: _delete),
      ],
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            Reveal(
              child: Container(
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(reviewBeforeUseTitle, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text(reviewBeforeUseBody, style: theme.textTheme.bodySmall?.copyWith(color: context.mutedStrong)),
                  ],
                ),
              ),
            ),
            if (draft.placeholders.isNotEmpty || draft.reviewFlags.isNotEmpty) ...[
              const SectionLabel('Before you send this'),
              Reveal(
                index: 1,
                child: LexaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (draft.placeholders.isNotEmpty) ...[
                        Text('Fill these in', style: theme.textTheme.titleSmall),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [for (final p in draft.placeholders) Pill(p, tone: PillTone.accent)],
                        ),
                      ],
                      if (draft.reviewFlags.isNotEmpty) ...[
                        if (draft.placeholders.isNotEmpty) const SizedBox(height: 14),
                        Text('Check these', style: theme.textTheme.titleSmall),
                        const SizedBox(height: 8),
                        for (final flag in draft.reviewFlags)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 7),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.flag_outlined, size: 15, color: context.accentColor),
                                const SizedBox(width: 8),
                                Expanded(child: Text(flag, style: theme.textTheme.bodyMedium)),
                              ],
                            ),
                          ),
                      ],
                      if (draft.jurisdictionCaveat != null) ...[
                        const SizedBox(height: 4),
                        Text(draft.jurisdictionCaveat!, style: theme.textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
              ),
            ],
            const SectionLabel('Your draft'),
            Reveal(
              index: 2,
              child: LexaCard(
                child: AiLegalOutput(child: MarkdownLite(draft.bodyMarkdown, selectable: true)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: LexaButton(
                    'Export PDF',
                    icon: Icons.picture_as_pdf_outlined,
                    style: LexaButtonStyle.secondary,
                    busy: _exporting == 'pdf',
                    onPressed: _exporting == null ? () => _export('pdf') : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: LexaButton(
                    'Export Word',
                    icon: Icons.description_outlined,
                    style: LexaButtonStyle.secondary,
                    busy: _exporting == 'docx',
                    onPressed: _exporting == null ? () => _export('docx') : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Both include the draft notice and a lawyer review block.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ],
    );
  }
}
