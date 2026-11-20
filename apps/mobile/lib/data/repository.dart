import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';

/// Reads and writes that go straight to Supabase. The same row-level security
/// policies as the web apply, so a person can only ever reach their own rows.
class Repository {
  SupabaseClient get _client => Supabase.instance.client;
  String? get _userId => _client.auth.currentUser?.id;

  // ---- Profile -------------------------------------------------------------

  Future<Profile?> profile() async {
    final id = _userId;
    if (id == null) return null;
    final row =
        await _client.from('profiles').select().eq('user_id', id).maybeSingle();
    return row == null ? null : Profile.fromJson(row);
  }

  Future<void> updateProfile(Map<String, dynamic> values) async {
    await _client.from('profiles').update(values).eq('user_id', _userId!);
  }

  /// A lawyer's own directory details. Lawyers may write these columns but not
  /// the row's owner, so an existing row is updated without touching user_id
  /// (an upsert would rewrite it and be refused).
  Future<void> saveLawyerProfile({
    required List<String> practiceAreas,
    required List<Map<String, String?>> licensedJurisdictions,
    String? barNumber,
  }) async {
    final values = {
      'practice_areas': practiceAreas,
      'licensed_jurisdictions': licensedJurisdictions,
      'bar_number': barNumber,
    };
    final updated = await _client
        .from('lawyer_profiles')
        .update(values)
        .eq('user_id', _userId!)
        .select('user_id');
    if (updated.isEmpty) {
      await _client.from('lawyer_profiles').insert({'user_id': _userId, ...values});
    }
  }

  // ---- Matters -------------------------------------------------------------

  Future<List<Matter>> matters() async {
    final rows = await _client
        .from('matters')
        .select()
        .eq('user_id', _userId!)
        .not('category', 'in', '(general,research)')
        .order('updated_at', ascending: false);
    return rows.map(Matter.fromJson).toList();
  }

  Future<Matter?> matter(String id) async {
    final row = await _client.from('matters').select().eq('id', id).maybeSingle();
    return row == null ? null : Matter.fromJson(row);
  }

  Future<void> updateMatter(String id, Map<String, dynamic> values) async {
    await _client.from('matters').update(values).eq('id', id);
  }

  Future<void> deleteMatter(String id) async {
    await _client.from('matters').delete().eq('id', id);
  }

  /// The home of a person's un-scoped conversation, created by the server on
  /// their first message.
  Future<String?> defaultMatterId(String category) async {
    final row = await _client
        .from('matters')
        .select('id')
        .eq('user_id', _userId!)
        .eq('category', category)
        .order('created_at', ascending: true)
        .limit(1)
        .maybeSingle();
    return row?['id'] as String?;
  }

  // ---- Deadlines -----------------------------------------------------------

  Future<List<Deadline>> deadlines(String matterId) async {
    final rows = await _client
        .from('deadlines')
        .select()
        .eq('matter_id', matterId)
        .order('due_date', ascending: true);
    return rows.map(Deadline.fromJson).toList();
  }

  /// Everything still open across a person's own matters, soonest first.
  Future<List<Deadline>> upcomingDeadlines() async {
    final rows = await _client
        .from('deadlines')
        .select('*, matters(title, user_id)')
        .eq('status', 'upcoming')
        .order('due_date', ascending: true);
    return rows
        .where((r) => (r['matters'] as Map?)?['user_id'] == _userId)
        .map(Deadline.fromJson)
        .toList();
  }

  Future<void> addDeadline({
    required String matterId,
    required String title,
    DateTime? due,
  }) async {
    await _client.from('deadlines').insert({
      'matter_id': matterId,
      'title': title,
      'due_date': due == null ? null : isoDate(due),
    });
  }

  Future<void> setDeadlineStatus(String id, String status) async {
    await _client.from('deadlines').update({'status': status}).eq('id', id);
  }

  Future<void> deleteDeadline(String id) async {
    await _client.from('deadlines').delete().eq('id', id);
  }

  // ---- Documents -----------------------------------------------------------

  Future<List<DocumentItem>> documents({String? matterId}) async {
    var query = _client
        .from('documents')
        .select('*, matters(title)')
        .eq('uploaded_by', _userId!);
    if (matterId != null) query = query.eq('matter_id', matterId);
    final rows = await query.order('created_at', ascending: false);
    return rows.map(DocumentItem.fromJson).toList();
  }

  /// Everything on a matter, including what a client has shared with a lawyer.
  Future<List<DocumentItem>> documentsForMatter(String matterId) async {
    final rows = await _client
        .from('documents')
        .select('*, matters(title)')
        .eq('matter_id', matterId)
        .order('created_at', ascending: false);
    return rows.map(DocumentItem.fromJson).toList();
  }

  Future<DocumentItem?> document(String id) async {
    final row = await _client
        .from('documents')
        .select('*, matters(title)')
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : DocumentItem.fromJson(row);
  }

  Future<void> deleteDocument(String id) async {
    await _client.from('documents').delete().eq('id', id);
  }

  /// Uploads straight to the person's own storage folder, for files too large
  /// for a request body. The analysis route reads and then removes them.
  Future<String> uploadForAnalysis({
    required String localPath,
    required String filename,
    required String mimeType,
  }) async {
    final safeName = filename.replaceAll(RegExp(r'[^\w.-]+'), '_');
    final path =
        '$_userId/${DateTime.now().millisecondsSinceEpoch}-$safeName';
    await _client.storage.from('document-uploads').uploadBinary(
          path,
          await File(localPath).readAsBytes(),
          fileOptions: FileOptions(contentType: mimeType),
        );
    return path;
  }

  // ---- Conversation --------------------------------------------------------

  Future<List<ChatMessageRow>> messages(String matterId) async {
    final rows = await _client
        .from('chat_messages')
        .select('role, content, citations')
        .eq('matter_id', matterId)
        .order('created_at', ascending: true)
        .limit(200);
    return rows.map(ChatMessageRow.fromJson).toList();
  }

  // ---- Lawyer directory ----------------------------------------------------

  Future<List<Lawyer>> lawyers() async {
    final rows = await _client
        .from('lawyer_profiles')
        .select(
            '*, profile:profiles!lawyer_profiles_user_id_fkey(full_name, country, state_province)')
        .eq('verification_status', 'verified')
        .order('rating_avg', ascending: false);
    final blocked = await blockedIds();
    return rows
        .map(Lawyer.fromJson)
        .where((l) => !blocked.contains(l.userId))
        .toList();
  }

  /// People this person has blocked. Empty before the launch migration has run.
  Future<Set<String>> blockedIds() async {
    try {
      final rows = await _client.from('user_blocks').select('blocked_id');
      return rows.map((r) => r['blocked_id'] as String).toSet();
    } catch (_) {
      return <String>{};
    }
  }

  Future<void> block(String userId) async {
    await _client
        .from('user_blocks')
        .insert({'blocker_id': _userId, 'blocked_id': userId});
  }

  /// Shares a matter with a lawyer, who can accept or decline.
  Future<void> requestLawyer({
    required String lawyerId,
    required String matterId,
    String? intro,
  }) async {
    await _client.from('lawyer_client_links').insert({
      'lawyer_id': lawyerId,
      'client_id': _userId,
      'matter_id': matterId,
      'status': 'invited',
    });
    final text = intro?.trim() ?? '';
    if (text.isNotEmpty) await sendClientMessage(matterId, text);
  }

  // ---- Lawyer and client thread --------------------------------------------

  Future<String?> linkedLawyerName(String matterId) async {
    final row = await _client
        .from('lawyer_client_links')
        .select('status, lawyer:profiles!lawyer_client_links_lawyer_id_fkey(full_name)')
        .eq('matter_id', matterId)
        .inFilter('status', ['invited', 'active'])
        .limit(1)
        .maybeSingle();
    if (row == null) return null;
    final lawyer = row['lawyer'];
    final name = lawyer is Map ? (lawyer['full_name'] as String?)?.trim() : null;
    return name == null || name.isEmpty ? 'Your lawyer' : name;
  }

  Future<List<ClientMessage>> clientMessages(String matterId) async {
    final rows = await _client
        .from('client_messages')
        .select()
        .eq('matter_id', matterId)
        .order('created_at', ascending: true);
    return rows.map(ClientMessage.fromJson).toList();
  }

  Future<void> sendClientMessage(String matterId, String body) async {
    await _client.from('client_messages').insert({
      'matter_id': matterId,
      'sender_id': _userId,
      'body': body,
    });
  }

  Future<List<ClientLink>> clientLinks() async {
    final rows = await _client
        .from('lawyer_client_links')
        .select(
            'status, client_id, created_at, matters(*), client:profiles!lawyer_client_links_client_id_fkey(full_name)')
        .eq('lawyer_id', _userId!)
        .inFilter('status', ['invited', 'active'])
        .order('created_at', ascending: false);
    return rows
        .where((r) => r['matters'] != null)
        .map(ClientLink.fromJson)
        .toList();
  }

  Future<void> respondToClient({
    required String clientId,
    required String matterId,
    required String status,
  }) async {
    await _client
        .from('lawyer_client_links')
        .update({'status': status})
        .eq('lawyer_id', _userId!)
        .eq('client_id', clientId)
        .eq('matter_id', matterId);
  }
}
