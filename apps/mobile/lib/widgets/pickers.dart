import 'package:flutter/material.dart';
import '../services/jurisdictions.dart';
import '../theme/theme.dart';
import 'ui.dart';

/// A searchable list in a sheet. Returns the chosen item.
Future<T?> showSearchPicker<T>(
  BuildContext context, {
  required String title,
  required List<T> items,
  required String Function(T) label,
  T? selected,
}) {
  return showLexaSheet<T>(
    context,
    (sheet) => _SearchPicker<T>(title: title, items: items, label: label, selected: selected),
  );
}

class _SearchPicker<T> extends StatefulWidget {
  const _SearchPicker({
    required this.title,
    required this.items,
    required this.label,
    this.selected,
  });

  final String title;
  final List<T> items;
  final String Function(T) label;
  final T? selected;

  @override
  State<_SearchPicker<T>> createState() => _SearchPickerState<T>();
}

class _SearchPickerState<T> extends State<_SearchPicker<T>> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final query = _query.trim().toLowerCase();
    final items = query.isEmpty
        ? widget.items
        : widget.items.where((i) => widget.label(i).toLowerCase().contains(query)).toList();

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.72,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.title, style: theme.textTheme.headlineMedium),
                const SizedBox(height: 12),
                TextField(
                  autofocus: widget.items.length > 12,
                  onChanged: (v) => setState(() => _query = v),
                  decoration: const InputDecoration(
                    hintText: 'Search',
                    prefixIcon: Icon(Icons.search_rounded, size: 20),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? Center(child: Text('No matches', style: theme.textTheme.bodySmall))
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 24),
                    itemCount: items.length,
                    itemBuilder: (context, i) {
                      final item = items[i];
                      final isSelected = item == widget.selected;
                      return Pressable(
                        scale: 0.99,
                        haptic: false,
                        onTap: () => Navigator.of(context).pop(item),
                        label: widget.label(item),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
                          child: Row(
                            children: [
                              Expanded(child: Text(widget.label(item), style: theme.textTheme.bodyLarge)),
                              if (isSelected)
                                Icon(Icons.check_rounded, size: 20, color: context.accentColor),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// Field-shaped tappable row that opens a picker.
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.value,
    required this.placeholder,
    this.onTap,
    this.icon,
  });

  final String? value;
  final String placeholder;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasValue = value != null && value!.isNotEmpty;
    return Pressable(
      scale: 0.99,
      onTap: onTap,
      label: hasValue ? value : placeholder,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: theme.colorScheme.outline),
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 19, color: context.accentColor),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Text(
                hasValue ? value! : placeholder,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: hasValue ? theme.colorScheme.onSurface : context.mutedColor,
                ),
              ),
            ),
            Icon(Icons.unfold_more_rounded, size: 18, color: context.mutedColor),
          ],
        ),
      ),
    );
  }
}

/// Country, then state where the list is known, otherwise free text.
class JurisdictionFields extends StatefulWidget {
  const JurisdictionFields({
    super.key,
    required this.country,
    required this.state,
    required this.onChanged,
  });

  final String? country;
  final String? state;
  final void Function(String? country, String? state) onChanged;

  @override
  State<JurisdictionFields> createState() => _JurisdictionFieldsState();
}

class _JurisdictionFieldsState extends State<JurisdictionFields> {
  ReferenceData? _data;
  late final TextEditingController _freeText = TextEditingController(text: widget.state);

  @override
  void initState() {
    super.initState();
    ReferenceData.load().then((data) {
      if (mounted) setState(() => _data = data);
    });
  }

  @override
  void dispose() {
    _freeText.dispose();
    super.dispose();
  }

  Future<void> _pickCountry() async {
    final data = _data;
    if (data == null) return;
    final picked = await showSearchPicker<Country>(
      context,
      title: 'Country',
      items: data.countries,
      label: (c) => c.name,
      selected: data.countryNamed(widget.country),
    );
    if (picked != null && picked.name != widget.country) {
      _freeText.clear();
      widget.onChanged(picked.name, null);
    }
  }

  Future<void> _pickState(Country country) async {
    final picked = await showSearchPicker<Subdivision>(
      context,
      title: country.subdivisionLabel,
      items: country.subdivisions,
      label: (s) => s.name,
    );
    if (picked != null) widget.onChanged(widget.country, picked.name);
  }

  @override
  Widget build(BuildContext context) {
    final country = _data?.countryNamed(widget.country);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LabeledField(
          label: 'Country',
          child: PickerField(
            value: widget.country,
            placeholder: 'Choose your country',
            icon: Icons.public_rounded,
            onTap: _pickCountry,
          ),
        ),
        if (country != null)
          LabeledField(
            label: country.subdivisionLabel,
            hint: 'Laws often differ by region, so this makes answers more precise.',
            child: country.subdivisions.isNotEmpty
                ? PickerField(
                    value: widget.state,
                    placeholder: 'Choose',
                    icon: Icons.place_outlined,
                    onTap: () => _pickState(country),
                  )
                : TextField(
                    controller: _freeText,
                    textCapitalization: TextCapitalization.words,
                    onChanged: (v) =>
                        widget.onChanged(widget.country, v.trim().isEmpty ? null : v.trim()),
                    decoration: const InputDecoration(hintText: 'Optional'),
                  ),
          ),
      ],
    );
  }
}
