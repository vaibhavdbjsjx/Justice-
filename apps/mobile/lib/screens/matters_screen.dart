import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';
import '../theme/theme.dart';
import 'chat_screen.dart';

const _categories = <(String, String)>[
  ('tenant-housing', 'Tenant & Housing'),
  ('employment', 'Employment & Workplace'),
  ('contracts', 'Contracts & Agreements'),
  ('consumer', 'Consumer Rights'),
  ('small-claims', 'Small Claims & Money Owed'),
  ('family', 'Family'),
  ('immigration', 'Immigration'),
  ('criminal', 'Criminal'),
  ('personal-injury', 'Personal Injury'),
  ('estate', 'Estate & Wills'),
  ('business', 'Small Business'),
  ('bankruptcy', 'Debt & Bankruptcy'),
  ('other', 'Something else'),
];

String categoryLabel(String value) =>
    _categories.firstWhere((c) => c.$1 == value,
        orElse: () => ('other', 'Uncategorized')).$2;

/// Matters (Phase 12): list + create via Supabase directly (RLS enforces
/// ownership; the same free-tier cap the web enforces applies via policy on
/// the server side of AI calls — creation itself mirrors web behavior).
class MattersScreen extends StatefulWidget {
  const MattersScreen({super.key});

  @override
  State<MattersScreen> createState() => _MattersScreenState();
}

class _MattersScreenState extends State<MattersScreen> {
  late Future<List<Matter>> _future = _load();

  Future<List<Matter>> _load() async {
    final rows = await Supabase.instance.client
        .from('matters')
        .select()
        .not('category', 'in', '(general,research)')
        .order('created_at', ascending: false);
    return rows.map(Matter.fromJson).toList();
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Matters')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
              MaterialPageRoute(builder: (_) => const NewMatterScreen()));
          if (created == true) _refresh();
        },
        icon: const Icon(Icons.add),
        label: const Text('New matter'),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Matter>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _Message(
                  'Your matters couldn’t be loaded just now. Pull to retry.');
            }
            final matters = snapshot.data ?? const [];
            if (matters.isEmpty) {
              return _Message(
                  'No matters yet. Start one to keep a situation’s conversation, documents, and deadlines together.');
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: matters.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final m = matters[i];
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 6),
                    leading: CircleAvatar(
                      backgroundColor: context.accentSoft,
                      child: Icon(Icons.folder_outlined,
                          color: theme.colorScheme.secondary, size: 20),
                    ),
                    title: Text(m.title,
                        style: theme.textTheme.titleMedium),
                    subtitle: Text(
                      '${categoryLabel(m.category)} · ${m.jurisdictionLabel}',
                      style: theme.textTheme.bodySmall,
                    ),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => MatterDetailScreen(matter: m)),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 60),
        Text(text,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class NewMatterScreen extends StatefulWidget {
  const NewMatterScreen({super.key});

  @override
  State<NewMatterScreen> createState() => _NewMatterScreenState();
}

class _NewMatterScreenState extends State<NewMatterScreen> {
  final _title = TextEditingController();
  String _category = 'tenant-housing';
  bool _busy = false;
  String? _error;

  Future<void> _create() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Give the matter a short title.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final client = Supabase.instance.client;
      await client.from('matters').insert({
        'user_id': client.auth.currentUser!.id,
        'title': title,
        'category': _category,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "That couldn't be saved. Please try again.";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New matter')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.error)),
            ),
          TextField(
            controller: _title,
            decoration: const InputDecoration(
                hintText: 'e.g. Security deposit dispute'),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            initialValue: _category,
            items: _categories
                .map((c) =>
                    DropdownMenuItem(value: c.$1, child: Text(c.$2)))
                .toList(),
            onChanged: (v) => setState(() => _category = v ?? 'other'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _create,
            child: Text(_busy ? 'Creating…' : 'Create matter'),
          ),
        ],
      ),
    );
  }
}

/// Matter workspace: scoped chat + deadlines (read/toggle) in tabs.
class MatterDetailScreen extends StatefulWidget {
  const MatterDetailScreen({super.key, required this.matter});
  final Matter matter;

  @override
  State<MatterDetailScreen> createState() => _MatterDetailScreenState();
}

class _MatterDetailScreenState extends State<MatterDetailScreen> {
  late Future<List<Deadline>> _deadlines = _load();

  Future<List<Deadline>> _load() async {
    final rows = await Supabase.instance.client
        .from('deadlines')
        .select()
        .eq('matter_id', widget.matter.id)
        .order('due_date', ascending: true);
    return rows.map(Deadline.fromJson).toList();
  }

  Future<void> _toggle(Deadline d) async {
    await Supabase.instance.client.from('deadlines').update({
      'status': d.status == 'completed' ? 'upcoming' : 'completed'
    }).eq('id', d.id);
    setState(() => _deadlines = _load());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final df = DateFormat.yMMMd();
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.matter.title),
          bottom: const TabBar(
              tabs: [Tab(text: 'Conversation'), Tab(text: 'Deadlines')]),
        ),
        body: TabBarView(
          children: [
            ChatScreen(
                matterId: widget.matter.id,
                matterTitle: widget.matter.title),
            FutureBuilder<List<Deadline>>(
              future: _deadlines,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return const _Message(
                      'Deadlines couldn’t be loaded just now. Please try again.');
                }
                final items = snapshot.data ?? const <Deadline>[];
                if (items.isEmpty) {
                  return const _Message(
                      'No deadlines yet. Add dates you can’t afford to miss from the web app.');
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final d = items[i];
                    return Card(
                      child: CheckboxListTile(
                        value: d.status == 'completed',
                        onChanged: (_) => _toggle(d),
                        title: Text(d.title,
                            style: theme.textTheme.bodyLarge?.copyWith(
                              decoration: d.status == 'completed'
                                  ? TextDecoration.lineThrough
                                  : null,
                            )),
                        subtitle: d.dueDate == null
                            ? null
                            : Text(
                                df.format(d.dueDate!),
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: d.overdue
                                      ? theme.colorScheme.error
                                      : null,
                                  fontWeight:
                                      d.overdue ? FontWeight.w600 : null,
                                ),
                              ),
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
