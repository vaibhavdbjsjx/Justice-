import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api/client.dart';
import '../config.dart';
import '../legal/disclaimers.dart';
import '../models/models.dart';
import '../theme/theme.dart';
import '../widgets/ai_legal_output.dart';
import '../widgets/markdown_lite.dart';

/// Documents (Phase 12): library + Document Intelligence upload/analysis +
/// generation. Reads go straight to Supabase (RLS); AI operations go through
/// the web API with the bearer token.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  final _api = LexmindApi();
  late Future<List<DocumentItem>> _future = _load();
  bool _uploading = false;
  String? _error;
  bool _upgradeHint = false;

  Future<List<DocumentItem>> _load() async {
    final rows = await Supabase.instance.client
        .from('documents')
        .select()
        .order('created_at', ascending: false);
    return rows.map(DocumentItem.fromJson).toList();
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _pickAndAnalyze() async {
    setState(() {
      _error = null;
      _upgradeHint = false;
    });
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
      withData: true,
    );
    final file = picked?.files.firstOrNull;
    if (file?.bytes == null) return;

    setState(() => _uploading = true);
    try {
      final result = await _api.analyzeDocument(
          bytes: file!.bytes!, filename: file.name);
      await _refresh();
      final analysisJson = result['analysis'];
      if (!mounted) return;
      if (analysisJson is Map<String, dynamic>) {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => AnalysisScreen(
            title: (result['title'] as String?) ?? file.name,
            analysis: DocumentAnalysis.fromJson(analysisJson),
          ),
        ));
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _upgradeHint = e.upgrade;
      });
    } catch (_) {
      setState(() => _error =
          "Justice couldn't finish reading that document. Nothing was lost — please try again.");
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final df = DateFormat.yMMMd();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Documents'),
        actions: [
          IconButton(
            tooltip: 'Generate a document',
            icon: const Icon(Icons.edit_note),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const GenerateScreen())),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading ? null : _pickAndAnalyze,
        icon: _uploading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.upload_file),
        label: Text(_uploading ? 'Analyzing…' : 'Analyze'),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: Column(
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
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
                      style: theme.textTheme.bodyMedium),
                ),
              ),
            Expanded(
              child: FutureBuilder<List<DocumentItem>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return ListView(
                      padding: const EdgeInsets.all(32),
                      children: [
                        const SizedBox(height: 60),
                        Text(
                          'Your documents couldn’t be loaded just now. Pull down to retry.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    );
                  }
                  final docs = snapshot.data ?? const <DocumentItem>[];
                  if (docs.isEmpty) {
                    return ListView(
                      padding: const EdgeInsets.all(32),
                      children: [
                        const SizedBox(height: 60),
                        Text(
                          'Upload a contract, notice, or court paper — Justice shows the obligations, deadlines, and risky clauses.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: docs.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final d = docs[i];
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: context.accentSoft,
                            child: Icon(
                              d.type == 'generated'
                                  ? Icons.edit_note
                                  : Icons.description_outlined,
                              size: 20,
                              color: theme.colorScheme.secondary,
                            ),
                          ),
                          title: Text(d.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleMedium),
                          subtitle: Text(
                            d.type == 'generated'
                                ? 'Draft — review before use · ${df.format(d.createdAt)}'
                                : df.format(d.createdAt),
                            style: theme.textTheme.bodySmall,
                          ),
                          onTap: () => _open(d),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _open(DocumentItem d) {
    if (d.isAnalysis) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => AnalysisScreen(
          title: d.title,
          analysis: DocumentAnalysis.fromJson(d.annotations!),
        ),
      ));
    } else if (d.isGeneratedDraft) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => DraftScreen(
            draft: GeneratedDoc.fromJson(d.annotations!)),
      ));
    }
  }
}

/// Document Intelligence detail (Part 4.1): summary, obligations, risky
/// clauses with severity, important dates — inside the compliance wrapper.
class AnalysisScreen extends StatelessWidget {
  const AnalysisScreen(
      {super.key, required this.title, required this.analysis});
  final String title;
  final DocumentAnalysis analysis;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(analysis.documentType.toUpperCase(),
              style: theme.textTheme.bodySmall
                  ?.copyWith(letterSpacing: 1.1)),
          const SizedBox(height: 10),
          AiLegalOutput(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(analysis.summary, style: theme.textTheme.bodyLarge),
                if (analysis.obligations.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text('Key obligations',
                      style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ...analysis.obligations.map((o) => _Tile(
                        icon: Icons.assignment_turned_in_outlined,
                        title: '${o['party'] ?? ''}'.isEmpty
                            ? '${o['obligation'] ?? ''}'
                            : '${o['party']}: ${o['obligation'] ?? ''}',
                        subtitle: (o['deadline_if_any'] as String?)
                                    ?.isNotEmpty ==
                                true
                            ? 'Deadline: ${o['deadline_if_any']}'
                            : null,
                      )),
                ],
                if (analysis.riskyClauses.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text('Flagged clauses',
                      style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ...analysis.riskyClauses.map((r) => _Tile(
                        icon: Icons.warning_amber_outlined,
                        iconColor: theme.colorScheme.error,
                        title: '${r['clause_excerpt_summary'] ?? ''}',
                        subtitle: '${r['why_flagged'] ?? ''}',
                      )),
                ],
                if (analysis.importantDates.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text('Important dates',
                      style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ...analysis.importantDates.map((d) => _Tile(
                      icon: Icons.event_outlined, title: d)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile(
      {required this.icon, required this.title, this.subtitle, this.iconColor});
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon,
              size: 17, color: iconColor ?? theme.colorScheme.secondary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.bodyLarge),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Generation (Phase 6 backend, Phase 12 mobile flow)
// ---------------------------------------------------------------------------

class _TemplateInfo {
  _TemplateInfo(this.slug, this.name, this.description, this.fields);
  final String slug;
  final String name;
  final String description;
  final List<Map<String, dynamic>> fields;
}

class GenerateScreen extends StatefulWidget {
  const GenerateScreen({super.key});

  @override
  State<GenerateScreen> createState() => _GenerateScreenState();
}

class _GenerateScreenState extends State<GenerateScreen> {
  final _api = LexmindApi();
  late final Future<List<_TemplateInfo>> _templates = _loadTemplates();
  _TemplateInfo? _selected;
  final Map<String, TextEditingController> _answers = {};
  bool _busy = false;
  String? _error;

  Future<List<_TemplateInfo>> _loadTemplates() async {
    final token =
        Supabase.instance.client.auth.currentSession?.accessToken;
    final res = await http.get(
      Uri.parse('${AppConfig.apiBase}/api/documents/templates'),
      headers: {if (token != null) 'Authorization': 'Bearer $token'},
    );
    if (res.statusCode != 200) {
      throw ApiException('Templates couldn’t be loaded. Please try again.');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (data['templates'] as List)
        .whereType<Map<String, dynamic>>()
        .map((t) => _TemplateInfo(
              t['slug'] as String,
              t['name'] as String,
              (t['description'] as String?) ?? '',
              (t['fields'] as List)
                  .whereType<Map<String, dynamic>>()
                  .toList(),
            ))
        .toList();
  }

  Future<void> _generate() async {
    final template = _selected;
    if (template == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final answers = {
        for (final e in _answers.entries)
          if (e.value.text.trim().isNotEmpty) e.key: e.value.text.trim()
      };
      final result = await _api.generateDocument(
          template: template.slug, answers: answers);
      final generated = result['generated'];
      if (generated is Map<String, dynamic> && mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(
          builder: (_) =>
              DraftScreen(draft: GeneratedDoc.fromJson(generated)),
        ));
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() =>
            _error = "That draft couldn't be completed. Please try again.");
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
          title: Text(_selected == null
              ? 'Generate a document'
              : _selected!.name)),
      body: FutureBuilder<List<_TemplateInfo>>(
        future: _templates,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(
                    'Templates couldn’t be loaded. Check your connection and try again.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium),
              ),
            );
          }
          final templates = snapshot.data!;
          if (_selected == null) {
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: templates.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final t = templates[i];
                return Card(
                  child: ListTile(
                    title:
                        Text(t.name, style: theme.textTheme.titleMedium),
                    subtitle: Text(t.description,
                        style: theme.textTheme.bodySmall),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => setState(() {
                      _selected = t;
                      _answers.clear();
                      for (final f in t.fields) {
                        _answers[f['name'] as String] =
                            TextEditingController();
                      }
                    }),
                  ),
                );
              },
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!,
                      style:
                          TextStyle(color: theme.colorScheme.error)),
                ),
              ..._selected!.fields.map((f) {
                final name = f['name'] as String;
                final label = (f['label'] as String?) ?? name;
                final required = f['required'] == true;
                final kind = f['kind'] as String?; // text | textarea | date
                final multiline = kind == 'textarea';
                final hint = f['hint'] as String?;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Text(label, style: theme.textTheme.titleMedium),
                        if (required)
                          Text(' *',
                              style: TextStyle(color: theme.colorScheme.error)),
                      ]),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _answers[name],
                        minLines: multiline ? 4 : 1,
                        maxLines: multiline ? 8 : 2,
                        keyboardType: kind == 'date'
                            ? TextInputType.datetime
                            : TextInputType.text,
                        decoration: InputDecoration(
                            hintText: (f['placeholder'] as String?) ?? ''),
                      ),
                      if (hint != null && hint.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(hint, style: theme.textTheme.bodySmall),
                        ),
                    ],
                  ),
                );
              }),
              FilledButton(
                onPressed: _busy ? null : _generate,
                child: Text(_busy ? 'Drafting…' : 'Draft it'),
              ),
              const SizedBox(height: 10),
              Text(
                'Missing facts become [PLACEHOLDERS]; every judgment call is flagged for review.',
                style: theme.textTheme.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Generated draft view: ReviewBeforeUse leads, checklist beside the draft.
class DraftScreen extends StatelessWidget {
  const DraftScreen({super.key, required this.draft});
  final GeneratedDoc draft;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(draft.title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: context.accentSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(reviewBeforeUseTitle,
                    style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(reviewBeforeUseBody,
                    style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (draft.placeholders.isNotEmpty || draft.reviewFlags.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Before you send this',
                        style: theme.textTheme.titleMedium),
                    const SizedBox(height: 8),
                    ...draft.placeholders.map((p) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(p,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                  fontFamily: 'monospace',
                                  color: theme.colorScheme.error)),
                        )),
                    ...draft.reviewFlags.map((f) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.flag_outlined,
                                  size: 15,
                                  color: theme.colorScheme.secondary),
                              const SizedBox(width: 8),
                              Expanded(
                                  child: Text(f,
                                      style:
                                          theme.textTheme.bodyMedium)),
                            ],
                          ),
                        )),
                    if (draft.jurisdictionCaveat != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(draft.jurisdictionCaveat!,
                            style: theme.textTheme.bodySmall),
                      ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: AiLegalOutput(child: MarkdownLite(draft.bodyMarkdown)),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Export as PDF/DOCX from the web app — both carry the draft notice and a lawyer review block.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
