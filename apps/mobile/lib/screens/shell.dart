import 'dart:async';
import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../native/native_bridge.dart';
import '../state/app_state.dart';
import '../theme/theme.dart';
import '../widgets/scenes.dart';
import '../widgets/ui.dart';
import 'account_screen.dart';
import 'analysis_screen.dart';
import 'chat_screen.dart';
import 'clients_screen.dart';
import 'documents_screen.dart';
import 'home_screen.dart';
import 'matter_detail_screen.dart';
import 'matters_screen.dart';

class _Destination {
  const _Destination(this.label, this.icon, this.activeIcon, this.root);
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final Widget root;
}

/// Signed-in navigation: a frosted tab bar on iPhone and a sidebar on iPad and Mac.
/// Each section keeps its own navigation stack, so switching never loses your place.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final Map<int, GlobalKey<NavigatorState>> _navigators = {};
  StreamSubscription<String>? _links;

  static const homeTab = 0;
  static const askTab = 1;
  static const mattersTab = 2;
  static const documentsTab = 3;

  List<_Destination> _destinations(bool lawyer) => [
        const _Destination('Home', Icons.home_outlined, Icons.home_rounded, HomeScreen()),
        if (lawyer)
          const _Destination('Research', Icons.manage_search_rounded, Icons.manage_search_rounded,
              ChatScreen(audience: 'lawyer'))
        else
          const _Destination('Ask', Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, ChatScreen()),
        if (lawyer)
          const _Destination('Clients', Icons.people_outline_rounded, Icons.people_rounded, ClientsScreen())
        else
          const _Destination('Matters', Icons.folder_outlined, Icons.folder_rounded, MattersScreen()),
        const _Destination('Documents', Icons.description_outlined, Icons.description_rounded, DocumentsScreen()),
        const _Destination('Account', Icons.person_outline_rounded, Icons.person_rounded, AccountScreen()),
      ];

  GlobalKey<NavigatorState> _navigator(int index) =>
      _navigators.putIfAbsent(index, () => GlobalKey<NavigatorState>());

  @override
  void initState() {
    super.initState();
    _links = NativeBridge.instance.links.listen(_openLink);
    NativeBridge.instance.initialLink().then((link) {
      if (link != null) _openLink(link);
    });
  }

  @override
  void dispose() {
    _links?.cancel();
    super.dispose();
  }

  /// Opens a lexa:// link from a notification or Live Activity.
  void _openLink(String link) {
    if (!mounted) return;
    final uri = Uri.tryParse(link);
    if (uri == null) return;
    final state = AppScope.read(context);
    final id = uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null;

    switch (uri.host) {
      case 'documents':
        state.tab.value = documentsTab;
        state.notifyDataChanged();
        if (id != null) {
          _navigator(documentsTab).currentState?.push(
                MaterialPageRoute(builder: (_) => DocumentLoaderScreen(documentId: id)),
              );
        }
      case 'matters':
        state.tab.value = state.profile?.isLawyer == true ? homeTab : mattersTab;
        if (id != null) {
          _navigator(state.tab.value).currentState?.push(
                MaterialPageRoute(builder: (_) => MatterLoaderScreen(matterId: id)),
              );
        }
      case 'ask':
        state.tab.value = askTab;
    }
  }

  void _select(int index, AppState state) {
    if (state.tab.value == index) {
      // Tapping the current tab returns to its first screen, as on any iOS app.
      _navigator(index).currentState?.popUntil((route) => route.isFirst);
    } else {
      HapticFeedback.selectionClick();
      state.tab.value = index;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final destinations = _destinations(state.profile?.isLawyer ?? false);
    final wide = MediaQuery.sizeOf(context).width >= 700;

    return ValueListenableBuilder<int>(
      valueListenable: state.tab,
      builder: (context, index, _) {
        final current = index.clamp(0, destinations.length - 1);
        final pages = IndexedStack(
          index: current,
          children: [
            for (var i = 0; i < destinations.length; i++)
              _TabNavigator(
                key: ValueKey('tab-$i-${destinations[i].label}'),
                navigatorKey: _navigator(i),
                root: destinations[i].root,
              ),
          ],
        );

        if (wide) {
          return Scaffold(
            resizeToAvoidBottomInset: false,
            body: Row(
              children: [
                _Sidebar(
                  destinations: destinations,
                  current: current,
                  onSelect: (i) => _select(i, state),
                ),
                VerticalDivider(width: 1, color: Theme.of(context).colorScheme.outline),
                Expanded(child: pages),
              ],
            ),
          );
        }
        return Scaffold(
          extendBody: true,
          resizeToAvoidBottomInset: false,
          body: pages,
          bottomNavigationBar: _GlassTabBar(
            destinations: destinations,
            current: current,
            onSelect: (i) => _select(i, state),
          ),
        );
      },
    );
  }
}

class _TabNavigator extends StatelessWidget {
  const _TabNavigator({super.key, required this.navigatorKey, required this.root});

  final GlobalKey<NavigatorState> navigatorKey;
  final Widget root;

  @override
  Widget build(BuildContext context) {
    return Navigator(
      key: navigatorKey,
      onGenerateRoute: (_) => MaterialPageRoute(builder: (_) => root),
    );
  }
}

class _GlassTabBar extends StatelessWidget {
  const _GlassTabBar({required this.destinations, required this.current, required this.onSelect});

  final List<_Destination> destinations;
  final int current;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.paddingOf(context).bottom;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: EdgeInsets.only(bottom: bottom > 0 ? bottom - 8 : 6, top: 6),
          decoration: BoxDecoration(
            color: theme.scaffoldBackgroundColor.withValues(alpha: 0.78),
            border: Border(top: BorderSide(color: theme.colorScheme.outline)),
          ),
          child: Row(
            children: [
              for (var i = 0; i < destinations.length; i++)
                Expanded(
                  child: _TabItem(
                    destination: destinations[i],
                    selected: i == current,
                    onTap: () => onSelect(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({required this.destination, required this.selected, required this.onTap});

  final _Destination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? context.accentColor : context.mutedColor;
    return Pressable(
      onTap: onTap,
      haptic: false,
      scale: 0.9,
      label: destination.label,
      child: Semantics(
        selected: selected,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: LexaMotion.base,
                curve: LexaMotion.curve,
                width: selected ? 52 : 40,
                height: 30,
                decoration: BoxDecoration(
                  color: selected ? context.accentSoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: AnimatedSwitcher(
                  duration: LexaMotion.fast,
                  child: Icon(
                    selected ? destination.activeIcon : destination.icon,
                    key: ValueKey(selected),
                    size: 21,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                destination.label,
                maxLines: 1,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: color,
                      fontSize: 10.5,
                      letterSpacing: 0,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.destinations, required this.current, required this.onSelect});

  final List<_Destination> destinations;
  final int current;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final expanded = MediaQuery.sizeOf(context).width >= 1000;

    return SafeArea(
      right: false,
      child: SizedBox(
        width: expanded ? 232 : 84,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          child: Column(
            crossAxisAlignment: expanded ? CrossAxisAlignment.start : CrossAxisAlignment.center,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 22),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const LexaMark(size: 28),
                    if (expanded) ...[
                      const SizedBox(width: 10),
                      Text('Lexa', style: theme.textTheme.headlineMedium),
                    ],
                  ],
                ),
              ),
              for (var i = 0; i < destinations.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Pressable(
                    onTap: () => onSelect(i),
                    scale: 0.97,
                    label: destinations[i].label,
                    child: AnimatedContainer(
                      duration: LexaMotion.base,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                      decoration: BoxDecoration(
                        color: i == current ? context.accentSoft : Colors.transparent,
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: expanded
                          ? Row(
                              children: [
                                Icon(i == current ? destinations[i].activeIcon : destinations[i].icon,
                                    size: 21, color: i == current ? context.accentColor : context.mutedStrong),
                                const SizedBox(width: 12),
                                Text(
                                  destinations[i].label,
                                  style: theme.textTheme.titleSmall?.copyWith(
                                    color: i == current ? context.accentColor : theme.colorScheme.onSurface,
                                  ),
                                ),
                              ],
                            )
                          : Icon(i == current ? destinations[i].activeIcon : destinations[i].icon,
                              size: 22, color: i == current ? context.accentColor : context.mutedStrong),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
