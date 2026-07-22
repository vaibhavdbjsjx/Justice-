import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'chat_screen.dart';
import 'documents_screen.dart';
import 'matters_screen.dart';

/// Signed-in shell: Assistant / Matters / Documents / Profile.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          ChatScreen(),
          MattersScreen(),
          DocumentsScreen(),
          _ProfileScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              selectedIcon: Icon(Icons.forum),
              label: 'Assistant'),
          NavigationDestination(
              icon: Icon(Icons.folder_outlined),
              selectedIcon: Icon(Icons.folder),
              label: 'Matters'),
          NavigationDestination(
              icon: Icon(Icons.description_outlined),
              selectedIcon: Icon(Icons.description),
              label: 'Documents'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}

class _ProfileScreen extends StatelessWidget {
  const _ProfileScreen();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = Supabase.instance.client.auth.currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Signed in as', style: theme.textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Text(user?.email ?? '—',
                      style: theme.textTheme.titleMedium),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              onTap: () => Supabase.instance.client.auth.signOut(),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Justice provides legal information, not legal advice. '
            'Matters, documents, and conversations stay in sync with the '
            'web and desktop apps.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
