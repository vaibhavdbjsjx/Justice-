import 'package:flutter/material.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';
import '../widgets/ui.dart';
import 'matter_detail_screen.dart';

/// For lawyers: matters clients have shared, with requests to accept or decline.
class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  List<ClientLink>? _links;
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final links = await AppScope.read(context).repo.clientLinks();
      if (mounted) {
        setState(() {
          _links = links;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _respond(ClientLink link, String status) async {
    try {
      await AppScope.read(context).repo.respondToClient(
            clientId: link.clientId,
            matterId: link.matter.id,
            status: status,
          );
      _load();
    } catch (_) {
      if (mounted) showToast(context, "That couldn't be saved. Please try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final links = _links;
    return LexaPage(
      title: 'Clients',
      onRefresh: _load,
      slivers: [
        SliverList.list(
          children: [
            const SizedBox(height: 8),
            if (_error != null && links == null)
              Note("Your clients couldn't be loaded just now.", tone: NoteTone.error, action: 'Try again', onAction: _load)
            else if (links == null)
              const SkeletonCards(count: 3)
            else if (links.isEmpty)
              const EmptyView(
                icon: Icons.people_outline_rounded,
                title: 'No clients yet',
                body: "When a client shares a matter with you, it appears here for you to accept. Your profile appears in the directory once you're verified.",
              )
            else
              for (var i = 0; i < links.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Reveal(
                    index: i,
                    child: LexaCard(
                      padding: const EdgeInsets.all(15),
                      label: links[i].matter.title,
                      onTap: links[i].status == 'active'
                          ? () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => MatterDetailScreen(
                                    matter: links[i].matter,
                                    clientView: true,
                                    clientId: links[i].clientId,
                                  ),
                                ),
                              )
                          : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(links[i].matter.title, style: theme.textTheme.titleMedium)),
                              Pill(
                                links[i].status == 'active' ? 'Active' : 'New request',
                                tone: links[i].status == 'active' ? PillTone.success : PillTone.accent,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${links[i].clientName} · ${categoryLabel(links[i].matter.category)} · ${links[i].matter.jurisdictionLabel}',
                            style: theme.textTheme.bodySmall,
                          ),
                          if (links[i].status == 'invited') ...[
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: LexaButton('Decline', compact: true, style: LexaButtonStyle.secondary, onPressed: () => _respond(links[i], 'ended')),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: LexaButton('Accept', compact: true, onPressed: () => _respond(links[i], 'active')),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
          ],
        ),
      ],
    );
  }
}
