import Foundation
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

struct PersonRecord: Identifiable, Equatable {
    var uid: String
    var username: String
    var displayName: String
    var status: String = ""
    var id: String { uid }
    init(_ d: [String: Any], id: String? = nil) {
        uid = id ?? d["uid"] as? String ?? ""
        username = d["username"] as? String ?? ""
        displayName = d["displayName"] as? String ?? ""
        status = d["status"] as? String ?? ""
    }
    var dictionary: [String: Any] { ["uid": uid, "username": username, "usernameLower": username, "displayName": displayName, "updatedAt": FieldValue.serverTimestamp()] }
}
struct MentionRecord: Identifiable {
    var id: String
    var author: String
    var username: String
    var read: Bool
    var task: TaskRecord
    init?(_ d: [String: Any], id: String) {
        guard let author = d["fromUid"] as? String, var task = try? TaskRecord(dictionary: d.merging(["id": id], uniquingKeysWith: { _, new in new })) else { return nil }
        task.deleted = false
        self.id = id; self.author = author; username = d["fromUsername"] as? String ?? ""; read = d["read"] as? Bool ?? false; self.task = task
    }
}

extension AppStore {
    func startCollaboration(_ user: FirebaseAuth.User) {
        let owner = user.uid
        Task {
            do { let card = try await ensureProfile(user); if uid == owner { profile = card } }
            catch { if uid == owner { errorMessage = error.localizedDescription } }
        }
        listeners.append(db.collection("users").document(owner).collection("connections").addSnapshotListener { [weak self] snap, error in
            Task { @MainActor in
                guard let self, self.uid == owner else { return }
                if let error { self.errorMessage = error.localizedDescription; return }
                self.connections = snap?.documents.map { PersonRecord($0.data(), id: $0.documentID) } ?? []
            }
        })
        listeners.append(db.collection("users").document(owner).collection("mentions").addSnapshotListener { [weak self] snap, error in
            Task { @MainActor in
                guard let self, self.uid == owner else { return }
                if let error { self.errorMessage = error.localizedDescription; return }
                self.mentions = snap?.documents.filter { $0.data()["dismissed"] as? Bool != true }.compactMap { MentionRecord($0.data(), id: $0.documentID) } ?? []
                await self.syncMentionAttachments(owner: owner)
            }
        })
    }
    func syncMentionAttachments(owner: String) async {
        let rows = mentions
        for mention in rows {
            for holder in [mention.task] + mention.task.subtasks {
                guard uid == owner, !Task.isCancelled else { return }
                guard let attachment = holder.attachment, case .string(let path) = attachment["storagePath"],
                      let id = FileSafety.cloudFileID(uid: owner, path: path) else { continue }
                do {
                    let url = attachmentsDirectory.appendingPathComponent(id)
                    if !FileManager.default.fileExists(atPath: url.path) {
                        let data = try await Storage.storage().reference(withPath: path).data(maxSize: Int64(FileSafety.maxBytes))
                        guard uid == owner, !Task.isCancelled else { return }
                        try FileManager.default.createDirectory(at: attachmentsDirectory, withIntermediateDirectories: true)
                        try data.write(to: url, options: [.atomic, .completeFileProtection])
                    }
                    guard uid == owner, let index = mentions.firstIndex(where: { $0.id == mention.id }) else { continue }
                    var next = attachment; next["id"] = .string(id)
                    if holder.id == mention.task.id, mentions[index].task.attachment?["storagePath"] == .string(path) {
                        mentions[index].task.attachment = next
                    } else if let child = mentions[index].task.subtasks.firstIndex(where: { $0.id == holder.id }), mentions[index].task.subtasks[child].attachment?["storagePath"] == .string(path) {
                        mentions[index].task.subtasks[child].attachment = next
                    }
                } catch { /* Cached mentions remain available; retry on the next sync. */ }
            }
        }
    }
    private func ensureProfile(_ user: FirebaseAuth.User) async throws -> PersonRecord {
        let target = db.collection("profiles").document(user.uid)
        let existing = try await target.getDocument()
        if existing.exists { return PersonRecord(existing.data() ?? [:], id: user.uid) }
        let raw = (user.email?.components(separatedBy: "@").first ?? "user\(user.uid.prefix(6))").lowercased()
        let cleaned = String(raw.filter { $0.isASCII && ($0.isLetter || $0.isNumber || "._-".contains($0)) }.prefix(18))
        let base = cleaned.count >= 2 ? cleaned : "user\(user.uid.prefix(6))"
        for index in 0..<25 {
            let handle = index == 0 ? base : "\(base)\(index)"
            let claim = db.collection("usernames").document(handle)
            do {
                _ = try await db.runTransaction { transaction, pointer -> Any? in
                    do {
                        let snap = try transaction.getDocument(claim)
                        if snap.exists, snap.data()?["uid"] as? String != user.uid { throw AppFailure.invalid("Handle taken.") }
                        transaction.setData(["uid": user.uid, "username": handle, "updatedAt": FieldValue.serverTimestamp()], forDocument: claim); return handle
                    } catch { pointer?.pointee = error as NSError; return nil }
                }
                let card: [String: Any] = ["uid": user.uid, "username": handle, "usernameLower": handle, "displayName": user.displayName ?? "", "photoURL": user.photoURL?.absoluteString ?? "", "updatedAt": FieldValue.serverTimestamp()]
                try await target.setData(card)
                if user.isEmailVerified, let email = user.email?.lowercased(), !email.contains("/") {
                    try? await db.collection("emails").document(email).setData(["uid": user.uid, "updatedAt": FieldValue.serverTimestamp()])
                }
                return PersonRecord(card)
            } catch { if index == 24 { throw error } }
        }
        throw AppFailure.invalid("Could not reserve a handle.")
    }
    func findPeople(_ text: String) async throws -> [PersonRecord] {
        let term = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard term.count >= 2, uid != nil else { return [] }
        if term.contains("@") && term.contains(".") && !term.contains("/") {
            let address = try await db.collection("emails").document(term).getDocument()
            guard let owner = address.data()?["uid"] as? String, owner != uid else { return [] }
            let card = try await db.collection("profiles").document(owner).getDocument()
            return card.exists ? [PersonRecord(card.data() ?? [:], id: owner)] : []
        }
        let handle = term.trimmingCharacters(in: CharacterSet(charactersIn: "@"))
        let snap = try await db.collection("profiles").order(by: "usernameLower").whereField("usernameLower", isGreaterThanOrEqualTo: handle).whereField("usernameLower", isLessThanOrEqualTo: handle + "\u{f8ff}").limit(to: 8).getDocuments()
        return snap.documents.map { PersonRecord($0.data(), id: $0.documentID) }.filter { $0.uid != uid }
    }
    func invite(_ person: PersonRecord, accept: Bool = false) async {
        guard let owner = uid, let me = profile else { return }
        do {
            let batch = db.batch()
            var mine = person.dictionary; mine["status"] = accept ? "accepted" : "pending"
            var theirs = me.dictionary; theirs["status"] = accept ? "accepted" : "incoming"
            batch.setData(mine, forDocument: db.collection("users").document(owner).collection("connections").document(person.uid))
            batch.setData(theirs, forDocument: db.collection("users").document(person.uid).collection("connections").document(owner))
            try await batch.commit()
        } catch { errorMessage = error.localizedDescription }
    }
    func disconnect(_ person: PersonRecord) async {
        guard let owner = uid else { return }
        do {
            let batch = db.batch()
            batch.deleteDocument(db.collection("users").document(owner).collection("connections").document(person.uid))
            batch.deleteDocument(db.collection("users").document(person.uid).collection("connections").document(owner))
            try await batch.commit()
        } catch { errorMessage = error.localizedDescription }
    }
    func editMention(_ mention: MentionRecord, completed: Bool? = nil, priority: Bool? = nil, subtasks: [TaskRecord]? = nil) async {
        guard let owner = uid else { return }
        let source = db.collection("users").document(mention.author).collection("tasks").document(mention.id)
        let copy = db.collection("users").document(owner).collection("mentions").document(mention.id)
        do {
            _ = try await db.runTransaction { transaction, pointer -> Any? in
                do {
                    let snap = try transaction.getDocument(source)
                    let remote = try TaskRecord(dictionary: snap.data() ?? [:], documentID: mention.id)
                    var local = mention.task
                    if let subtasks { local.subtasks = subtasks }
                    let merged = TaskRecord.merge(base: mention.task, local: local, remote: remote)
                    var patch: [String: Any] = ["updatedAt": FieldValue.serverTimestamp()]
                    if let completed { patch["completed"] = completed }
                    if let priority { patch["priority"] = priority }
                    if subtasks != nil { patch["subtasks"] = merged.subtasks.map(\.dictionary) }
                    transaction.updateData(patch, forDocument: source); transaction.updateData(patch, forDocument: copy); return true
                } catch { pointer?.pointee = error as NSError; return nil }
            }
        } catch { errorMessage = error.localizedDescription }
    }
    func dismissMention(_ mention: MentionRecord) async {
        guard let owner = uid else { return }
        do { try await db.collection("users").document(owner).collection("mentions").document(mention.id).updateData(["dismissed": true, "updatedAt": FieldValue.serverTimestamp()]) }
        catch { errorMessage = error.localizedDescription }
    }
    func deliverMentions(task: TaskRecord, owner: String) async throws {
        guard uid == owner, let me = profile else { return }
        let regex = try NSRegularExpression(pattern: "(^|[^\\w@/.-])@([a-z0-9._-]{2,24})", options: .caseInsensitive)
        let text = task.text as NSString
        let handles = Set(regex.matches(in: task.text, range: NSRange(location: 0, length: text.length)).map { text.substring(with: $0.range(at: 2)).lowercased() })
        let targets = task.deleted ? [] : connections.filter { $0.status == "accepted" && handles.contains($0.username) }.map(\.uid)
        let log = db.collection("users").document(owner).collection("meta").document("mentions")
        let previous = (try await log.getDocument()).data()?["sent"] as? [String: [String]] ?? [:]
        guard uid == owner else { return }
        for recipient in Set(targets).union(previous[task.id] ?? []) {
            let target = db.collection("users").document(recipient).collection("mentions").document(task.id)
            if !targets.contains(recipient) { try? await target.delete(); continue }
            var body: [String: Any] = ["taskId": task.id, "fromUid": owner, "fromUsername": me.username, "fromName": me.displayName, "text": task.text, "ymd": task.ymd, "completed": task.completed, "priority": task.priority, "subtasks": task.subtasks.map(\.dictionary), "updatedAt": FieldValue.serverTimestamp()]
            if !(previous[task.id] ?? []).contains(recipient) { body["read"] = false }
            try await target.setData(body, merge: true)
        }
        try await log.setData(["sent": [task.id: targets], "updatedAt": FieldValue.serverTimestamp()], merge: true)
    }
}
