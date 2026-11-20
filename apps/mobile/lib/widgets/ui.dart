import 'dart:math' as math;
import 'dart:ui' show ImageFilter;
import 'package:flutter/cupertino.dart' show CupertinoActivityIndicator, CupertinoSliverRefreshControl;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/theme.dart';

/// iOS bounce, with the pull past the top capped well beyond any normal gesture.
/// Repeated hard pulls could otherwise stretch the refresh spinner past what the
/// screen can show.
class LexaScrollPhysics extends BouncingScrollPhysics {
  const LexaScrollPhysics({super.parent});

  @override
  LexaScrollPhysics applyTo(ScrollPhysics? ancestor) => LexaScrollPhysics(parent: buildParent(ancestor));

  @override
  double applyPhysicsToUserOffset(ScrollMetrics position, double offset) {
    final applied = super.applyPhysicsToUserOffset(position, offset);
    if (applied <= 0) return applied;
    final limit = position.viewportDimension * 0.4;
    final overscroll = position.minScrollExtent - (position.pixels - applied);
    if (overscroll <= limit) return applied;
    return math.max(0.0, applied - (overscroll - limit));
  }
}

const lexaScrollPhysics = LexaScrollPhysics(parent: AlwaysScrollableScrollPhysics());

/// Comfortable reading width on iPad and Mac, full width on iPhone.
const double kContentWidth = 720;

double contentPadding(double width) => math.max(20, (width - kContentWidth) / 2);

/// Scales down on press with a light tap, the way native controls respond.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.975,
    this.haptic = true,
    this.label,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool haptic;
  final String? label;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool value) {
    if (widget.onTap == null || _down == value) return;
    setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: widget.onTap != null,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapCancel: () => _set(false),
        onTapUp: (_) => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                if (widget.haptic) HapticFeedback.selectionClick();
                widget.onTap!();
              },
        onLongPress: widget.onLongPress,
        child: AnimatedScale(
          scale: _down ? widget.scale : 1,
          duration: LexaMotion.fast,
          curve: LexaMotion.curve,
          child: widget.child,
        ),
      ),
    );
  }
}

enum LexaButtonStyle { primary, secondary, ghost, destructive }

class LexaButton extends StatelessWidget {
  const LexaButton(
    this.label, {
    super.key,
    this.onPressed,
    this.style = LexaButtonStyle.primary,
    this.icon,
    this.busy = false,
    this.expand = true,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final LexaButtonStyle style;
  final IconData? icon;
  final bool busy;
  final bool expand;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final (Color background, Color foreground, Color? outline) = switch (style) {
      LexaButtonStyle.primary => (scheme.secondary, scheme.onSecondary, null),
      LexaButtonStyle.secondary => (scheme.surface, scheme.onSurface, context.borderStrong),
      LexaButtonStyle.ghost => (Colors.transparent, context.accentColor, null),
      LexaButtonStyle.destructive => (context.alertSoft, context.alertColor, null),
    };
    final enabled = onPressed != null && !busy;

    return Pressable(
      onTap: enabled ? onPressed : null,
      label: label,
      child: AnimatedOpacity(
        duration: LexaMotion.fast,
        opacity: onPressed == null ? 0.45 : 1,
        child: Container(
          width: expand ? double.infinity : null,
          height: compact ? 42 : 54,
          padding: EdgeInsets.symmetric(horizontal: compact ? 16 : 22),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(compact ? 12 : 16),
            border: outline == null ? null : Border.all(color: outline),
            boxShadow: style == LexaButtonStyle.primary && !context.isDark
                ? [
                    BoxShadow(
                      color: scheme.secondary.withValues(alpha: 0.28),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy)
                CupertinoActivityIndicator(color: foreground, radius: 9)
              else ...[
                if (icon != null) ...[
                  Icon(icon, size: compact ? 17 : 19, color: foreground),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: (compact ? theme.textTheme.labelMedium : theme.textTheme.labelLarge)
                        ?.copyWith(color: foreground),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class LexaCard extends StatelessWidget {
  const LexaCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(18),
    this.color,
    this.borderColor,
    this.label,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final Color? color;
  final Color? borderColor;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor ?? Theme.of(context).colorScheme.outline),
        boxShadow: context.softShadow,
      ),
      child: child,
    );
    if (onTap == null) return card;
    return Pressable(onTap: onTap, label: label, child: card);
  }
}

enum PillTone { neutral, accent, alert, success }

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.tone = PillTone.neutral, this.icon});

  final String text;
  final PillTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      PillTone.neutral => (context.surfaceSunken, context.mutedStrong),
      PillTone.accent => (context.accentSoft, context.accentColor),
      PillTone.alert => (context.alertSoft, context.alertColor),
      PillTone.success => (context.successSoft, context.successColor),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: fg, letterSpacing: 0.1),
            ),
          ),
        ],
      ),
    );
  }
}

/// A gentle rise-and-fade the first time content appears, optionally staggered.
class Reveal extends StatefulWidget {
  const Reveal({super.key, required this.child, this.index = 0, this.distance = 14});

  final Widget child;
  final int index;
  final double distance;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 560));
  late final Animation<double> _curve =
      CurvedAnimation(parent: _controller, curve: LexaMotion.curve);

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(Duration(milliseconds: 45 * widget.index.clamp(0, 8)), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _curve,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _curve.value,
        child: Transform.translate(
          offset: Offset(0, (1 - _curve.value) * widget.distance),
          child: child,
        ),
      ),
    );
  }
}

/// A sweeping highlight that stands in for content while it loads.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 10});

  final double height;
  final double? width;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.surfaceSunken;
    final shine = context.isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.white.withValues(alpha: 0.85);
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          gradient: LinearGradient(
            begin: Alignment(-1.6 + _controller.value * 3.2, 0),
            end: Alignment(-0.6 + _controller.value * 3.2, 0),
            colors: [base, Color.alphaBlend(shine, base), base],
          ),
        ),
      ),
    );
  }
}

class SkeletonCards extends StatelessWidget {
  const SkeletonCards({super.key, this.count = 3, this.height = 84});

  final int count;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Skeleton(height: height, radius: 20),
          ),
      ],
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.action, this.onAction});

  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 26, 2, 12),
      child: Row(
        children: [
          Expanded(child: Text(text, style: theme.textTheme.titleLarge)),
          if (action != null)
            Pressable(
              onTap: onAction,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(action!,
                    style: theme.textTheme.labelMedium?.copyWith(color: context.accentColor)),
              ),
            ),
        ],
      ),
    );
  }
}

enum NoteTone { info, error, success }

class Note extends StatelessWidget {
  const Note(this.text, {super.key, this.tone = NoteTone.info, this.action, this.onAction});

  final String text;
  final NoteTone tone;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (Color bg, Color fg, IconData icon) = switch (tone) {
      NoteTone.info => (context.surfaceSunken, context.accentColor, Icons.info_outline_rounded),
      NoteTone.error => (context.alertSoft, context.alertColor, Icons.error_outline_rounded),
      NoteTone.success => (context.successSoft, context.successColor, Icons.check_circle_outline_rounded),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: theme.textTheme.bodyMedium),
                if (action != null) ...[
                  const SizedBox(height: 8),
                  Pressable(
                    onTap: onAction,
                    child: Text(action!, style: theme.textTheme.labelMedium?.copyWith(color: fg)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.action,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 12),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: context.accentSoft, borderRadius: BorderRadius.circular(20)),
            child: Icon(icon, size: 28, color: context.accentColor),
          ),
          const SizedBox(height: 18),
          Text(title, textAlign: TextAlign.center, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(body, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium?.copyWith(color: context.mutedColor)),
          if (action != null) ...[
            const SizedBox(height: 20),
            LexaButton(action!, onPressed: onAction, expand: false),
          ],
        ],
      ),
    );
  }
}

/// A page with a large serif title that collapses into a frosted bar on scroll.
class LexaPage extends StatelessWidget {
  const LexaPage({
    super.key,
    required this.title,
    required this.slivers,
    this.subtitle,
    this.actions = const [],
    this.onRefresh,
    this.controller,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final List<Widget> slivers;
  final List<Widget> actions;
  final Future<void> Function()? onRefresh;
  final ScrollController? controller;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    final media = MediaQuery.of(context);
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final horizontal = contentPadding(constraints.maxWidth);
          return Stack(
            children: [
              CustomScrollView(
                controller: controller,
                physics: lexaScrollPhysics,
                slivers: [
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _LargeTitleHeader(
                      title: title,
                      subtitle: subtitle,
                      actions: actions,
                      canPop: canPop,
                      topInset: media.padding.top,
                      horizontal: horizontal,
                    ),
                  ),
                  if (onRefresh != null)
                    CupertinoSliverRefreshControl(onRefresh: onRefresh),
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: horizontal),
                    sliver: SliverMainAxisGroup(slivers: slivers),
                  ),
                  SliverToBoxAdapter(
                    child: SizedBox(height: media.padding.bottom + (bottom == null ? 28 : 96)),
                  ),
                ],
              ),
              if (bottom != null)
                Positioned(
                  left: horizontal,
                  right: horizontal,
                  bottom: media.padding.bottom + 12,
                  child: bottom!,
                ),
            ],
          );
        },
      ),
    );
  }
}

class _LargeTitleHeader extends SliverPersistentHeaderDelegate {
  _LargeTitleHeader({
    required this.title,
    required this.subtitle,
    required this.actions,
    required this.canPop,
    required this.topInset,
    required this.horizontal,
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final bool canPop;
  final double topInset;
  final double horizontal;

  static const _barHeight = 50.0;
  double get _titleBlock => subtitle == null ? 56 : 84;

  @override
  double get minExtent => topInset + _barHeight;

  @override
  double get maxExtent => topInset + _barHeight + _titleBlock;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final theme = Theme.of(context);
    final range = maxExtent - minExtent;
    final t = (shrinkOffset / range).clamp(0.0, 1.0);
    final barOpacity = Curves.easeOut.transform(((t - 0.55) / 0.45).clamp(0.0, 1.0));
    final background = theme.scaffoldBackgroundColor;

    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: background.withValues(alpha: 1 - barOpacity)),
        if (barOpacity > 0)
          ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
              child: Container(
                decoration: BoxDecoration(
                  color: background.withValues(alpha: 0.72 * barOpacity + 0.08),
                  border: Border(
                    bottom: BorderSide(color: theme.colorScheme.outline.withValues(alpha: barOpacity)),
                  ),
                ),
              ),
            ),
          ),
        Positioned(
          left: horizontal,
          right: horizontal,
          bottom: 10 + shrinkOffset * 0.35,
          child: Opacity(
            opacity: (1 - t * 1.7).clamp(0.0, 1.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                LayoutBuilder(
                  builder: (context, box) => Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _fittingTitleStyle(context, title, box.maxWidth),
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ),
        Positioned(
          top: topInset,
          left: 0,
          right: 0,
          height: _barHeight,
          child: Row(
            children: [
              SizedBox(width: canPop ? math.max(4, horizontal - 16) : horizontal),
              if (canPop)
                IconActionButton(
                  icon: Icons.arrow_back_ios_new_rounded,
                  size: 19,
                  tooltip: 'Back',
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              Expanded(
                child: Opacity(
                  opacity: barOpacity,
                  child: Text(
                    title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
              ),
              ...actions,
              SizedBox(width: math.max(8, horizontal - 12)),
            ],
          ),
        ),
      ],
    );
  }

  @override
  bool shouldRebuild(covariant _LargeTitleHeader old) =>
      title != old.title ||
      subtitle != old.subtitle ||
      actions != old.actions ||
      canPop != old.canPop ||
      topInset != old.topInset ||
      horizontal != old.horizontal;
}

/// The largest title style that shows [title] on one line within [width].
TextStyle? _fittingTitleStyle(BuildContext context, String title, double width) {
  final theme = Theme.of(context).textTheme;
  final scaler = MediaQuery.textScalerOf(context);
  final styles = [theme.displayMedium, theme.displaySmall, theme.headlineMedium];
  for (final style in styles) {
    final painter = TextPainter(
      text: TextSpan(text: title, style: style),
      maxLines: 1,
      textDirection: Directionality.of(context),
      textScaler: scaler,
    )..layout();
    final fits = painter.width <= width;
    painter.dispose();
    if (fits) return style;
  }
  return styles.last;
}

class IconActionButton extends StatelessWidget {
  const IconActionButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onPressed,
    this.size = 22,
    this.color,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onPressed,
      scale: 0.86,
      label: tooltip,
      child: SizedBox(
        width: 44,
        height: 44,
        child: Icon(icon, size: size, color: color ?? Theme.of(context).colorScheme.onSurface),
      ),
    );
  }
}

/// A rounded modal sheet from the root navigator, so it covers the tab bar.
Future<T?> showLexaSheet<T>(BuildContext context, WidgetBuilder builder) {
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) => Padding(
      // Above the keyboard when it's up, otherwise clear of the home indicator.
      padding: EdgeInsets.only(
        bottom: math.max(
          MediaQuery.viewInsetsOf(sheetContext).bottom,
          MediaQuery.viewPaddingOf(sheetContext).bottom,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
            width: 38,
            height: 5,
            decoration: BoxDecoration(
              color: sheetContext.borderStrong,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Flexible(child: builder(sheetContext)),
        ],
      ),
    ),
  );
}

void showToast(BuildContext context, String message) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  messenger
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      duration: const Duration(seconds: 3),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 90),
    ));
}

Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String body,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text('Cancel', style: TextStyle(color: dialogContext.mutedStrong)),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(
            confirmLabel,
            style: TextStyle(
              color: destructive ? dialogContext.alertColor : dialogContext.accentColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// A labelled field with room for validation copy, shared by every form.
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child, this.hint, this.required = false});

  final String label;
  final Widget child;
  final String? hint;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              text: label,
              style: theme.textTheme.titleSmall,
              children: [
                if (required)
                  TextSpan(text: ' *', style: TextStyle(color: context.alertColor)),
              ],
            ),
          ),
          const SizedBox(height: 7),
          child,
          if (hint != null) ...[
            const SizedBox(height: 6),
            Text(hint!, style: theme.textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

/// A row in a settings-style group.
class SettingsRow extends StatelessWidget {
  const SettingsRow({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.trailing,
    this.onTap,
    this.destructive = false,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = destructive ? context.alertColor : theme.colorScheme.onSurface;
    return Pressable(
      onTap: onTap,
      scale: 0.99,
      label: title,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 20, color: destructive ? color : context.accentColor),
              const SizedBox(width: 13),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: theme.textTheme.bodyLarge?.copyWith(color: color)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!, style: theme.textTheme.bodySmall),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 10), trailing!]
            else if (onTap != null)
              Icon(Icons.chevron_right_rounded, size: 20, color: context.mutedColor),
          ],
        ),
      ),
    );
  }
}

class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final divided = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      divided.add(children[i]);
      if (i < children.length - 1) {
        divided.add(Divider(height: 1, indent: 16, color: Theme.of(context).colorScheme.outline));
      }
    }
    return LexaCard(
      padding: EdgeInsets.zero,
      child: Column(mainAxisSize: MainAxisSize.min, children: divided),
    );
  }
}
