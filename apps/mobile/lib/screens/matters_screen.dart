import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator;
import 'package:flutter/material.dart';
import '../api/client.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/pickers.dart';
import '../widgets/ui.dart';
import 'matter_detail_screen.dart';
import 'paywall_screen.dart';

/// A matter holds one situation's conversation, documents, and deadlines.
class MattersScreen extends StatefulWidget {
  const MattersScreen({super.key});

  @override
  State<MattersScreen> createState() => _MattersScreenState();
}

class _MattersScreenState extends State<MattersScreen> {
  List<Matter>? _matters;
  Object? _error;
  AppState? _state;

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
      final matters = await _state!.repo.matters();
      if (mounted) {
        setState(() {
          _matters = matters;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _create() async {
    final created = await showLexaSheet<Matter>(context, (_) => const MatterFormSheet());
    if (created != null && mounted) {
      await _load();
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => MatterDetailScreen(matter: created)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final matters = _matters;
    final active = matters?.where((m) => m.status == 'active').toList() ?? const <Matter>[];
    final closed = matters?.where((m) => m.status != 'active').toList() ?? const <Matter>[];

    return LexaPage(
      title: 'Matters',
      onRefresh: _load,
      actions: [
        IconActionButton(icon: Icons.add_rounded, size: 26, tooltip: 'New matter', onPressed: _create),
      ],
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            if (_error != null && matters == null)
              Note("Your matters couldn't be loaded just now.",
                  tone: NoteTone.error, action: 'Try again', onAction: _load)
            else if (matters == null)
              const SkeletonCards(count: 4)
            else if (matters.isEmpty)
              EmptyView(
                icon: Icons.folder_open_rounded,
                title: 'Start your first matter',
                body: "Keep a situation's conversation, documents, and deadlines together in one place.",
                action: 'New matter',
                onAction: _create,
              )
            else ...[
              for (var i = 0; i < active.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Reveal(index: i, child: _MatterCard(matter: active[i], onChanged: _load)),
                ),
              if (closed.isNotEmpty) ...[
                const SectionLabel('Closed'),
                for (final matter in closed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _MatterCard(matter: matter, onChanged: _load),
                  ),
              ],
            ],
          ],
        ),
      ],
    );
  }
}

class _MatterCard extends StatelessWidget {
  const _MatterCard({required this.matter, required this.onChanged});

  final Matter matter;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LexaCard(
      padding: const EdgeInsets.all(15),
      label: matter.title,
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => MatterDetailScreen(matter: matter)),
        );
        onChanged();
      },
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(14)),
            child: Icon(categoryIcon(matter.category), size: 22, color: context.accentColor),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(matter.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(
                  '${categoryLabel(matter.category)} · ${matter.jurisdictionLabel}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          if (matter.status != 'active')
            Pill(matter.status == 'resolved' ? 'Resolved' : 'Archived')
          else
            Icon(Icons.chevron_right_rounded, size: 21, color: context.mutedColor),
        ],
      ),
    );
  }
}

/// Create or edit a matter. Returns the saved matter.
class MatterFormSheet extends StatefulWidget {
  const MatterFormSheet({super.key, this.matter});

  final Matter? matter;

  @override
  State<MatterFormSheet> createState() => _MatterFormSheetState();
}

class _MatterFormSheetState extends State<MatterFormSheet> {
  late final _title = TextEditingController(text: widget.matter?.title);
  late String _category = widget.matter?.category ?? 'tenant-housing';
  String? _country;
  String? _stateName;
  bool _initialized = false;
  bool _busy = false;
  String? _error;
  bool _upgrade = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    final profile = AppScope.read(context).profile;
    _country = widget.matter?.jurisdictionCountry ?? profile?.country;
    _stateName = widget.matter == null ? profile?.state : widget.matter!.jurisdictionState;
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Give the matter a short title.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _upgrade = false;
    });
    final state = AppScope.read(context);
    try {
      final Matter saved;
      if (widget.matter == null) {
        saved = await state.api.createMatter(
          title: title,
          category: _category,
          country: _country,
          state: _stateName,
        );
      } else {
        await state.repo.updateMatter(widget.matter!.id, {
          'title': title,
          'category': _category,
          'jurisdiction_country': _country,
          'jurisdiction_state': _stateName,
        });
        saved = (await state.repo.matter(widget.matter!.id))!;
      }
      state.notifyDataChanged();
      if (mounted) Navigator.of(context).pop(saved);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
          _upgrade = e.upgrade;
        });
      }
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
    final theme = Theme.of(context);
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(widget.matter == null ? 'New matter' : 'Edit matter', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 16),
          LabeledField(
            label: 'Title',
            child: TextField(
              key: const Key('matter-title'),
              controller: _title,
              maxLength: 200,
              autofocus: widget.matter == null,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'Security deposit dispute', counterText: ''),
            ),
          ),
          LabeledField(
            label: 'Category',
            child: PickerField(
              value: categoryLabel(_category),
              placeholder: 'Choose',
              icon: categoryIcon(_category),
              onTap: () async {
                final picked = await showSearchPicker<(String, String, IconData)>(
                  context,
                  title: 'Category',
                  items: matterCategories,
                  label: (c) => c.$2,
                );
                if (picked != null) setState(() => _category = picked.$1);
              },
            ),
          ),
          JurisdictionFields(
            country: _country,
            state: _stateName,
            onChanged: (country, state) => setState(() {
              _country = country;
              _stateName = state;
            }),
          ),
          if (_error != null) ...[
            Note(
              _error!,
              tone: _upgrade ? NoteTone.info : NoteTone.error,
              action: _upgrade ? 'See plans' : null,
              onAction: _upgrade ? () => showPaywall(context) : null,
            ),
            const SizedBox(height: 12),
          ],
          LexaButton(
            widget.matter == null ? 'Create matter' : 'Save changes',
            key: const Key('matter-save'),
            onPressed: _save,
            busy: _busy,
          ),
        ],
      ),
    );
  }
}

/// Add a deadline, with a date picker. Returns true when one was saved.
class DeadlineFormSheet extends StatefulWidget {
  const DeadlineFormSheet({super.key, required this.matterId, this.initialTitle, this.initialDate});

  final String matterId;
  final String? initialTitle;
  final DateTime? initialDate;

  @override
  State<DeadlineFormSheet> createState() => _DeadlineFormSheetState();
}

class _DeadlineFormSheetState extends State<DeadlineFormSheet> {
  late final _title = TextEditingController(text: widget.initialTitle);
  late DateTime? _date = widget.initialDate;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    FocusScope.of(context).unfocus();
    final picked = await pickDate(
      context,
      title: 'Due date',
      initial: _date ?? now,
      first: DateTime(now.year - 2),
      last: DateTime(now.year + 15, 12, 31),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Say what is due.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      await state.repo.addDeadline(matterId: widget.matterId, title: title, due: _date);
      await state.reminders.reschedule();
      state.notifyDataChanged();
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
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Add a deadline', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 16),
          LabeledField(
            label: "What's due",
            child: TextField(
              key: const Key('deadline-title'),
              controller: _title,
              autofocus: widget.initialTitle == null,
              maxLength: 200,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'Respond to the notice', counterText: ''),
            ),
          ),
          LabeledField(
            label: 'Date',
            child: PickerField(
              value: _date == null ? null : formatDate(_date!),
              placeholder: 'Choose a date',
              icon: Icons.event_outlined,
              onTap: _pickDate,
            ),
          ),
          if (_error != null) ...[
            Note(_error!, tone: NoteTone.error),
            const SizedBox(height: 12),
          ],
          LexaButton('Add deadline', key: const Key('deadline-save'), onPressed: _save, busy: _busy),
        ],
      ),
    );
  }
}

class CenteredLoader extends StatelessWidget {
  const CenteredLoader({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: CupertinoActivityIndicator(radius: 13));
}
