import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/pickers.dart';
import '../widgets/report_sheet.dart';
import '../widgets/ui.dart';

/// The directory of verified lawyers, narrowed by where they're licensed and what
/// they practice. Only verified profiles appear.
class LawyersScreen extends StatefulWidget {
  const LawyersScreen({super.key, this.matter});

  /// Pre-selected when arriving from a matter.
  final Matter? matter;

  @override
  State<LawyersScreen> createState() => _LawyersScreenState();
}

class _LawyersScreenState extends State<LawyersScreen> {
  List<Lawyer>? _lawyers;
  Object? _error;
  String _query = '';
  bool _nearMe = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final lawyers = await AppScope.read(context).repo.lawyers();
      if (mounted) {
        setState(() {
          _lawyers = lawyers;
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
    final profile = AppScope.of(context).profile;
    final region = widget.matter?.jurisdictionCountry ?? profile?.country;
    final state = widget.matter?.jurisdictionState ?? profile?.state;
    final query = _query.trim().toLowerCase();

    Iterable<Lawyer> visible = _lawyers ?? const [];
    if (_nearMe && region != null) {
      visible = visible.where((l) => l.licensedJurisdictions.any(
            (j) => j.contains(region) && (state == null || j.contains(state)),
          ));
    }
    if (query.isNotEmpty) {
      visible = visible.where((l) =>
          l.name.toLowerCase().contains(query) ||
          l.practiceAreas.any((a) => a.toLowerCase().contains(query)));
    }
    final results = visible.toList();

    return LexaPage(
      title: 'Find a lawyer',
      subtitle: 'Verified lawyers only',
      onRefresh: _load,
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Search by name or practice area',
                prefixIcon: Icon(Icons.search_rounded, size: 20),
              ),
            ),
            const SizedBox(height: 10),
            if (region != null)
              Align(
                alignment: Alignment.centerLeft,
                child: Pressable(
                  onTap: () => setState(() => _nearMe = !_nearMe),
                  label: 'Filter by location',
                  child: Pill(
                    _nearMe ? 'Licensed in ${state ?? region}' : 'All locations',
                    tone: _nearMe ? PillTone.accent : PillTone.neutral,
                    icon: Icons.place_outlined,
                  ),
                ),
              ),
            const SizedBox(height: 14),
            if (_error != null && _lawyers == null)
              Note("The directory couldn't be loaded just now.", tone: NoteTone.error, action: 'Try again', onAction: _load)
            else if (_lawyers == null)
              const SkeletonCards(count: 3, height: 104)
            else if (results.isEmpty)
              Column(
                children: [
                  EmptyView(
                    icon: Icons.gavel_rounded,
                    title: _nearMe ? 'No verified lawyers here yet' : 'No matches',
                    body: "We're adding verified lawyers. Your local bar association can also refer you to a licensed lawyer, often with a low-cost first consultation.",
                    action: _nearMe ? 'Show all locations' : null,
                    onAction: _nearMe ? () => setState(() => _nearMe = false) : null,
                  ),
                  Text(
                    "Lexa doesn't recommend or endorse any lawyer. Check that a lawyer is licensed where you need help.",
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              )
            else ...[
              for (var i = 0; i < results.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Reveal(
                    index: i,
                    child: _LawyerCard(
                      lawyer: results[i],
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => LawyerProfileScreen(lawyer: results[i], matter: widget.matter),
                          ),
                        );
                        _load();
                      },
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              Text(
                "Lexa doesn't recommend or endorse any lawyer. Working with a lawyer starts only when you both agree.",
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _LawyerCard extends StatelessWidget {
  const _LawyerCard({required this.lawyer, required this.onTap});

  final Lawyer lawyer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LexaCard(
      padding: const EdgeInsets.all(15),
      onTap: onTap,
      label: lawyer.name,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(lawyer.name, style: theme.textTheme.titleMedium)),
              const Pill('Verified', tone: PillTone.success, icon: Icons.verified_outlined),
            ],
          ),
          if (lawyer.licensedJurisdictions.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(lawyer.licensedJurisdictions.join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
          ],
          if (lawyer.practiceAreas.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final area in lawyer.practiceAreas.take(3)) Pill(area)],
            ),
          ],
          if (lawyer.rateRange != null) ...[
            const SizedBox(height: 10),
            Text(lawyer.rateRange!, style: theme.textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

class LawyerProfileScreen extends StatefulWidget {
  const LawyerProfileScreen({super.key, required this.lawyer, this.matter});

  final Lawyer lawyer;
  final Matter? matter;

  @override
  State<LawyerProfileScreen> createState() => _LawyerProfileScreenState();
}

class _LawyerProfileScreenState extends State<LawyerProfileScreen> {
  Future<void> _block() async {
    final navigator = Navigator.of(context);
    final state = AppScope.read(context);
    final confirmed = await confirmAction(
      context,
      title: 'Block ${widget.lawyer.name}?',
      body: "They won't appear in your directory again, and you can tell us why with a report.",
      confirmLabel: 'Block',
      destructive: true,
    );
    if (!confirmed) return;
    try {
      await state.repo.block(widget.lawyer.userId);
      navigator.pop();
    } catch (_) {
      if (mounted) showToast(context, "That didn't go through. Please try again.");
    }
  }

  void _showMenu() {
    showLexaSheet<void>(
      context,
      (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: SettingsGroup(
          children: [
            SettingsRow(
              title: 'Report this profile',
              icon: Icons.flag_outlined,
              onTap: () {
                Navigator.of(sheet).pop();
                showReportSheet(context, kind: 'lawyer_profile', referenceId: widget.lawyer.userId);
              },
            ),
            SettingsRow(
              title: 'Block',
              icon: Icons.block_rounded,
              destructive: true,
              onTap: () {
                Navigator.of(sheet).pop();
                _block();
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
    final lawyer = widget.lawyer;
    return LexaPage(
      title: lawyer.name,
      actions: [
        IconActionButton(icon: Icons.more_horiz_rounded, tooltip: 'More', onPressed: _showMenu),
      ],
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 4),
            const Align(
              alignment: Alignment.centerLeft,
              child: Pill('Verified', tone: PillTone.success, icon: Icons.verified_outlined),
            ),
            if (lawyer.bio != null) ...[
              const SizedBox(height: 14),
              Text(lawyer.bio!, style: theme.textTheme.bodyLarge),
            ],
            if (lawyer.licensedJurisdictions.isNotEmpty) ...[
              const SectionLabel('Licensed in'),
              for (final place in lawyer.licensedJurisdictions)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(place, style: theme.textTheme.bodyMedium),
                ),
            ],
            if (lawyer.practiceAreas.isNotEmpty) ...[
              const SectionLabel('Practice areas'),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [for (final area in lawyer.practiceAreas) Pill(area)],
              ),
            ],
            if (lawyer.rateRange != null) ...[
              const SectionLabel('Typical rates'),
              Text(lawyer.rateRange!, style: theme.textTheme.bodyMedium),
            ],
            const SizedBox(height: 24),
            LexaButton(
              'Work with this lawyer',
              key: const Key('lawyer-request'),
              onPressed: () => showLexaSheet<void>(
                context,
                (_) => _RequestSheet(lawyer: lawyer, matter: widget.matter),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Sharing a matter is a request, not a hiring. No attorney-client relationship exists until you and the lawyer both agree.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ],
    );
  }
}

class _RequestSheet extends StatefulWidget {
  const _RequestSheet({required this.lawyer, this.matter});

  final Lawyer lawyer;
  final Matter? matter;

  @override
  State<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends State<_RequestSheet> {
  final _intro = TextEditingController();
  List<Matter>? _matters;
  Matter? _selected;
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selected = widget.matter;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final matters = await AppScope.read(context).repo.matters();
        if (mounted) {
          setState(() {
            _matters = matters.where((m) => m.status == 'active').toList();
            _selected ??= _matters!.isEmpty ? null : _matters!.first;
          });
        }
      } catch (_) {
        if (mounted) setState(() => _matters = const []);
      }
    });
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final matter = _selected;
    if (matter == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.requestLawyer(
            lawyerId: widget.lawyer.userId,
            matterId: matter.id,
            intro: _intro.text,
          );
      if (mounted) {
        AppScope.read(context).notifyDataChanged();
        setState(() => _sent = true);
      }
    } on PostgrestException catch (e) {
      if (mounted) {
        setState(() => _error = e.code == '23505'
            ? "You've already shared this matter with this lawyer."
            : "That couldn't be saved. Please try again.");
      }
    } catch (_) {
      if (mounted) setState(() => _error = "That couldn't be saved. Please try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final matters = _matters;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_sent ? 'Request sent' : 'Share a matter', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 8),
          if (_sent) ...[
            Text(
              "${widget.lawyer.name} can now review your matter and reply in its Messages tab.",
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 18),
            LexaButton('Done', onPressed: () => Navigator.of(context).pop()),
          ] else ...[
            Text(
              "${widget.lawyer.name} will see this matter's documents, deadlines, and messages. You can stop sharing at any time.",
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            if (matters != null && matters.isEmpty)
              const Note('Create a matter first, so the lawyer has something to review.')
            else ...[
              LabeledField(
                label: 'Matter',
                child: PickerField(
                  value: _selected?.title,
                  placeholder: 'Choose',
                  icon: Icons.folder_outlined,
                  onTap: matters == null
                      ? null
                      : () async {
                          final picked = await showSearchPicker<Matter>(
                            context,
                            title: 'Matter',
                            items: matters,
                            label: (m) => m.title,
                          );
                          if (picked != null) setState(() => _selected = picked);
                        },
                ),
              ),
              LabeledField(
                label: 'A short introduction',
                child: TextField(
                  controller: _intro,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 2000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Optional', counterText: ''),
                ),
              ),
              if (_error != null) ...[
                Note(_error!, tone: NoteTone.error),
                const SizedBox(height: 12),
              ],
              LexaButton('Send request', onPressed: _selected == null ? null : _send, busy: _busy),
            ],
          ],
        ],
      ),
    );
  }
}
