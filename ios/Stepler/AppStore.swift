import Foundation
import SwiftUI
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import FirebaseStorage
import GoogleSignIn
import Network
import CryptoKit

@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var snapshot = LocalSnapshot()
    @Published private(set) var uid: String?
    @Published private(set) var email: String?
    @Published var errorMessage: String?
    @Published var syncMessage = "Saved on this iPhone"
    @Published var mentions: [MentionRecord] = []
    @Published var connections: [PersonRecord] = []
    @Published var profile: PersonRecord?
    @Published var selectedProject: String?
    let calendarBridge = CalendarBridge()
    let testing: Bool
    let root: URL
    private var authHandle: AuthStateDidChangeListenerHandle?
    var listeners: [ListenerRegistration] = []
    private var worker: Task<Void, Never>?
    private let monitor = NWPathMonitor()
    private var deviceID: String
    private var cloudReady = false
    private var readOnly = false
    var failWritesForTesting = false

    var tasks: [TaskRecord] { snapshot.tasks.filter { !$0.deleted && !$0.purged } }
    var trash: [TaskRecord] { snapshot.tasks.filter { $0.deleted && !$0.purged } }
    var projects: [Project] { snapshot.projectState.sorted }
    var db: Firestore { Firestore.firestore() }
    var accountKey: String { uid ?? "guest" }
    private var file: URL { root.appendingPathComponent("\(SHA256.hash(data: Data(accountKey.utf8)).map { String(format: "%02x", $0) }.joined()).json") }
    var attachmentsDirectory: URL { root.appendingPathComponent("attachments", isDirectory: true).appendingPathComponent(SHA256.hash(data: Data(accountKey.utf8)).map { String(format: "%02x", $0) }.joined(), isDirectory: true) }

    init(testing: Bool = false, root: URL? = nil) {
        self.testing = testing
        self.root = root ?? (testing ? FileManager.default.temporaryDirectory.appendingPathComponent("SteplerUITests") : FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Stepler"))
        if testing && ProcessInfo.processInfo.arguments.contains("--reset") { try? FileManager.default.removeItem(at: self.root) }
        let key = "stepler.project.device"
        deviceID = UserDefaults.standard.string(forKey: key) ?? UUID().uuidString
        UserDefaults.standard.set(deviceID, forKey: key)
        load()
        if !testing {
            ReminderService.refresh(tasks: snapshot.tasks)
            authHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in Task { @MainActor in self?.selectUser(user) } }
            monitor.pathUpdateHandler = { [weak self] path in
                if path.status == .satisfied { Task { @MainActor in self?.scheduleSync() } }
            }
            monitor.start(queue: DispatchQueue(label: "Stepler.network"))
        }
    }
    private func load() {
        readOnly = false
        guard FileManager.default.fileExists(atPath: file.path) else { snapshot = LocalSnapshot(); return }
        do { snapshot = try JSONDecoder().decode(LocalSnapshot.self, from: Data(contentsOf: file)) }
        catch { readOnly = true; snapshot = LocalSnapshot(); errorMessage = "Your saved file could not be read. It has been preserved; Stepler will not overwrite it." }
    }
    private func persist() throws {
        guard !readOnly, !failWritesForTesting else { throw AppFailure.invalid("Could not save. Your draft is still available; please free some storage and retry.") }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try JSONEncoder().encode(snapshot).write(to: file, options: [.atomic, .completeFileProtection])
    }
    @discardableResult
    func commitLocal(_ action: (inout LocalSnapshot) throws -> Void) -> Bool {
        let before = snapshot
        do {
            var next = snapshot; try action(&next); snapshot = next; try persist()
            if !testing {
                ReminderService.refresh(tasks: snapshot.tasks); scheduleSync()
                Task { do { try await calendarBridge.refresh(tasks: snapshot.tasks, account: accountKey) } catch { errorMessage = error.localizedDescription } }
            }
            return true
        } catch { snapshot = before; errorMessage = error.localizedDescription; return false }
    }
    @discardableResult
    func put(_ task: TaskRecord) -> Bool {
        commitLocal { state in
            let old = state.tasks.first { $0.id == task.id }
            state.pending[task.id] = PendingEdit(base: state.pending[task.id]?.base ?? old, local: task)
            if let i = state.tasks.firstIndex(where: { $0.id == task.id }) { state.tasks[i] = task } else { state.tasks.append(task) }
            rememberProjects(in: &state, tasks: [task])
        }
    }
    private func rememberProjects(in state: inout LocalSnapshot, tasks: [TaskRecord]) {
        let names = TaskRecord.names(tasks.filter { !$0.deleted && !$0.purged }.flatMap { $0.projects + $0.subtasks.flatMap(\.projects) })
        let actual = names.filter { name in state.projectState.resolve(name) == name && !state.projectState.projects.contains { $0.name == name } }
        guard !actual.isEmpty else { return }
        state.projectSequence += 1
        var op = ProjectOperation(type: "remember", names: actual.map { Project(name: $0) })
        op.deviceId = deviceID; op.sequence = state.projectSequence; op.id = "\(deviceID):\(state.projectSequence)"
        try? state.projectState.apply(op); state.projectQueue.append(op)
    }
    @discardableResult
    func project(_ operation: ProjectOperation) -> Bool {
        let oldSelection = selectedProject
        let success = commitLocal { state in
            var op = operation
            state.projectSequence += 1
            op.deviceId = deviceID; op.sequence = state.projectSequence; op.id = "\(deviceID):\(state.projectSequence)"
            try state.projectState.apply(op); state.projectQueue.append(op)
            for i in state.tasks.indices {
                let before = state.tasks[i]
                state.tasks[i].rewriteProjects(state.projectState)
                if before != state.tasks[i] { state.pending[before.id] = PendingEdit(base: state.pending[before.id]?.base ?? before, local: state.tasks[i]) }
            }
        }
        if success, let oldSelection { selectedProject = snapshot.projectState.resolve(oldSelection) }
        return success
    }
    @discardableResult
    func add(text: String, projects: [String], dueDate: String? = nil, reminder: String? = nil, attachment: [String: JSONValue]? = nil) -> Bool {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || attachment != nil else { return false }
        var task = TaskRecord(text: text, projects: projects)
        task.dueDate = dueDate; task.reminder = reminder; task.attachment = attachment
        return put(task)
    }
    func edit(_ id: String, _ change: (inout TaskRecord) -> Void) {
        guard var task = snapshot.tasks.first(where: { $0.id == id }) else { return }
        change(&task); _ = put(task)
    }
    func delete(_ id: String) { edit(id) { $0.deleted = true; $0.extras["deletedAt"] = .number(Date().timeIntervalSince1970 * 1000) } }
    func restore(_ id: String) { edit(id) { $0.deleted = false; $0.extras.removeValue(forKey: "deletedAt"); $0.extras.removeValue(forKey: "gcalEventId"); $0.extras.removeValue(forKey: "appleReminderId") } }
    func purge(_ id: String) { edit(id) { $0.purge() } }
    func reorder(_ ids: [String], before target: String) {
        guard let movedID = ids.first, movedID != target, let source = tasks.first(where: { $0.id == movedID }), let destination = tasks.first(where: { $0.id == target }), source.ymd == destination.ymd, source.completed == destination.completed else { return }
        var list = TaskRecord.ordered(tasks.filter { $0.ymd == source.ymd && $0.completed == source.completed && $0.id != source.id })
        guard let i = list.firstIndex(where: { $0.id == target }) else { return }
        list.insert(source, at: i)
        _ = commitLocal { state in
            let base = list.map(\.order).min() ?? 0
            for (index, var row) in list.enumerated() {
                guard let at = state.tasks.firstIndex(where: { $0.id == row.id }) else { continue }
                let old = state.tasks[at]; row.sortOrder = base + Double(index)
                state.tasks[at] = row; state.pending[row.id] = PendingEdit(base: state.pending[row.id]?.base ?? old, local: row)
            }
        }
    }
    func nest(_ sourceID: String, under targetID: String) {
        guard sourceID != targetID, let source = tasks.first(where: { $0.id == sourceID }), var target = tasks.first(where: { $0.id == targetID }) else { return }
        var row = source; row.subtasks = []
        target.subtasks += [row] + source.subtasks
        guard target.subtasks.count <= 500 else { errorMessage = "A task can contain at most 500 subtasks."; return }
        _ = commitLocal { state in
            guard let a = state.tasks.firstIndex(where: { $0.id == sourceID }), let b = state.tasks.firstIndex(where: { $0.id == targetID }) else { return }
            state.pending[targetID] = PendingEdit(base: state.pending[targetID]?.base ?? state.tasks[b], local: target)
            state.tasks[b] = target
            var tombstone = state.tasks[a]; tombstone.purge()
            state.pending[sourceID] = PendingEdit(base: state.pending[sourceID]?.base ?? state.tasks[a], local: tombstone)
            state.tasks[a] = tombstone
        }
    }
    func promote(_ childID: String, from parentID: String) {
        guard var parent = tasks.first(where: { $0.id == parentID }), var child = parent.subtasks.first(where: { $0.id == childID }) else { return }
        parent.subtasks.removeAll { $0.id == childID }; child.ymd = parent.ymd
        _ = commitLocal { state in
            guard let p = state.tasks.firstIndex(where: { $0.id == parentID }) else { return }
            state.pending[parentID] = PendingEdit(base: state.pending[parentID]?.base ?? state.tasks[p], local: parent); state.tasks[p] = parent
            // A prior nesting tombstone must not turn this explicit promotion
            // back into a permanent deletion during its next merge.
            if let old = state.tasks.firstIndex(where: { $0.id == childID }) { state.tasks.remove(at: old) }
            child.purged = false; child.deleted = false; child.id = "\(Int64(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(12))"
            state.tasks.append(child); state.pending[child.id] = PendingEdit(base: nil, local: child)
        }
    }
    private func selectUser(_ user: FirebaseAuth.User?) {
        guard uid != user?.uid || (user != nil && listeners.isEmpty) else { return }
        worker?.cancel(); worker = nil; listeners.forEach { $0.remove() }; listeners = []; cloudReady = false
        // Auth accounts have separate local snapshots. Guest tasks stay in
        // the guest profile; an explicit import can copy them into an account.
        uid = user?.uid; email = user?.email; selectedProject = nil
        mentions = []; connections = []; profile = nil; load()
        if !testing { ReminderService.refresh(tasks: snapshot.tasks) }
        guard let user else { syncMessage = "Saved on this iPhone"; return }
        syncMessage = "Connecting…"
        let owner = user.uid
        listeners.append(db.collection("users").document(owner).collection("tasks").addSnapshotListener(includeMetadataChanges: true) { [weak self] snap, error in
            Task { @MainActor in
                guard let self, self.uid == owner else { return }
                if let error { self.errorMessage = error.localizedDescription; return }
                guard let snap else { return }
                var rows: [TaskRecord] = []
                do { rows = try snap.documents.map { try TaskRecord(dictionary: $0.data(), documentID: $0.documentID) } }
                catch { self.errorMessage = "A cloud task could not be read: \(error.localizedDescription)"; return }
                self.receive(rows)
                self.cloudReady = true
                self.syncMessage = snap.metadata.isFromCache ? "Offline · changes saved locally" : "Connected"
                self.scheduleSync()
            }
        })
        listeners.append(db.collection("users").document(owner).collection("meta").document("projects").addSnapshotListener { [weak self] snap, error in
            Task { @MainActor in
                guard let self, self.uid == owner else { return }
                if let error { self.errorMessage = error.localizedDescription; return }
                guard let snap, snap.exists else { return }
                self.receiveProjects(ProjectState(dictionary: snap.data() ?? [:])); self.scheduleSync()
            }
        })
        startCollaboration(user)
    }
    func receive(_ remote: [TaskRecord]) {
        _ = commitLocal { state in
            var rows = Dictionary(state.tasks.map { ($0.id, $0) }, uniquingKeysWith: { _, new in new })
            for task in remote {
                if let pending = state.pending[task.id] {
                    let merged = TaskRecord.merge(base: pending.base, local: pending.local, remote: task)
                    rows[task.id] = merged
                    if merged == task { state.pending.removeValue(forKey: task.id) }
                    else { state.pending[task.id] = PendingEdit(base: task, local: merged) }
                } else { rows[task.id] = task }
            }
            state.tasks = Array(rows.values)
            rememberProjects(in: &state, tasks: state.tasks)
            for i in state.tasks.indices {
                let before = state.tasks[i]; state.tasks[i].rewriteProjects(state.projectState)
                if before != state.tasks[i] { state.pending[before.id] = PendingEdit(base: state.pending[before.id]?.base ?? before, local: state.tasks[i]) }
            }
        }
    }
    private func receiveProjects(_ incoming: ProjectState) {
        let selection = selectedProject
        _ = commitLocal { state in
            state.projectQueue.removeAll { op in if let device = op.deviceId, let sequence = op.sequence { return (incoming.clocks[device] ?? 0) >= sequence }; return false }
            var next = incoming
            for operation in state.projectQueue { try? next.apply(operation) }
            state.projectState = next
            for i in state.tasks.indices {
                let before = state.tasks[i]; state.tasks[i].rewriteProjects(next)
                if before != state.tasks[i] { state.pending[before.id] = PendingEdit(base: state.pending[before.id]?.base ?? before, local: state.tasks[i]) }
            }
        }
        if let selection { selectedProject = snapshot.projectState.resolve(selection) }
    }
    func scheduleSync() {
        guard !testing, uid != nil, worker == nil, cloudReady else { return }
        let owner = uid
        worker = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled, let self else { return }
            await self.push()
            guard !Task.isCancelled, self.uid == owner else { return }
            self.worker = nil
            if !self.snapshot.pending.isEmpty || !self.snapshot.projectQueue.isEmpty || self.hasOutstandingAttachments {
                self.worker = Task { [weak self] in
                    try? await Task.sleep(for: .seconds(15)); guard !Task.isCancelled else { return }
                    self?.worker = nil; self?.scheduleSync()
                }
            }
        }
    }
    private func push() async {
        guard let owner = uid else { return }
        do {
            let pending = snapshot.pending
            for (id, edit) in pending {
                guard uid == owner, !Task.isCancelled else { return }
                let target = db.collection("users").document(owner).collection("tasks").document(id)
                let result = try await db.runTransaction { transaction, errorPointer -> Any? in
                    do {
                        let snap = try transaction.getDocument(target)
                        let remote = snap.exists ? try TaskRecord(dictionary: snap.data() ?? [:], documentID: id) : nil
                        let merged = TaskRecord.merge(base: edit.base, local: edit.local, remote: remote)
                        var data = merged.dictionary; data["updatedAt"] = FieldValue.serverTimestamp()
                        transaction.setData(data, forDocument: target)
                        return merged.dictionary
                    } catch { errorPointer?.pointee = error as NSError; return nil }
                }
                guard uid == owner, let dictionary = result as? [String: Any] else { return }
                let committed = try TaskRecord(dictionary: dictionary)
                _ = commitLocal { state in
                    guard let i = state.tasks.firstIndex(where: { $0.id == id }) else { return }
                    let latest = TaskRecord.merge(base: edit.local, local: state.tasks[i], remote: committed)
                    state.tasks[i] = latest
                    if latest == committed { state.pending.removeValue(forKey: id) } else { state.pending[id] = PendingEdit(base: committed, local: latest) }
                }
                try await deliverMentions(task: committed, owner: owner)
            }
            let queue = snapshot.projectQueue
            if !queue.isEmpty {
                let target = db.collection("users").document(owner).collection("meta").document("projects")
                let result = try await db.runTransaction { transaction, errorPointer -> Any? in
                    do {
                        let snap = try transaction.getDocument(target)
                        var state = ProjectState(dictionary: snap.data() ?? [:])
                        for operation in queue { try? state.apply(operation) }
                        var data = state.dictionary; data["updatedAt"] = FieldValue.serverTimestamp()
                        transaction.setData(data, forDocument: target); return state.dictionary
                    } catch { errorPointer?.pointee = error as NSError; return nil }
                }
                if uid == owner, let result = result as? [String: Any] { receiveProjects(ProjectState(dictionary: result)) }
            }
            if uid == owner { await syncAttachments(owner: owner); syncMessage = hasOutstandingAttachments ? "Tasks synced · attachments pending" : "Synced" }
        } catch { if uid == owner { syncMessage = "Changes saved locally · retrying"; errorMessage = error.localizedDescription } }
    }
    func signIn(email: String, password: String, create: Bool) async {
        do {
            if create { _ = try await Auth.auth().createUser(withEmail: email.trimmingCharacters(in: .whitespaces), password: password) }
            else { _ = try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespaces), password: password) }
        } catch { errorMessage = error.localizedDescription }
    }
    func googleSignIn() async {
        guard let clientID = FirebaseApp.app()?.options.clientID, let presenter = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController else { return }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let token = result.user.idToken?.tokenString else { throw AppFailure.invalid("Google did not return an identity token.") }
            _ = try await Auth.auth().signIn(with: GoogleAuthProvider.credential(withIDToken: token, accessToken: result.user.accessToken.tokenString))
        } catch { errorMessage = error.localizedDescription }
    }
    func signOut() {
        do { try Auth.auth().signOut(); GIDSignIn.sharedInstance.signOut() } catch { errorMessage = error.localizedDescription }
    }
    func attachmentURL(_ attachment: [String: JSONValue]) -> URL? {
        guard case .string(let id) = attachment["id"], FileSafety.validID(id) else { return nil }
        let url = attachmentsDirectory.appendingPathComponent(id)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }
    func storeAttachment(_ data: Data, name: String, image: Bool) throws -> [String: JSONValue] {
        guard data.count < FileSafety.maxBytes else { throw AppFailure.invalid("Attachments must be smaller than 25 MB.") }
        let ext = String((name as NSString).pathExtension.prefix(10)).filter { $0.isLetter || $0.isNumber }
        let id = UUID().uuidString + (ext.isEmpty ? "" : ".\(ext)")
        try FileManager.default.createDirectory(at: attachmentsDirectory, withIntermediateDirectories: true)
        try data.write(to: attachmentsDirectory.appendingPathComponent(id), options: [.atomic, .completeFileProtection])
        return ["id": .string(id), "name": .string(String(name.prefix(120))), "type": .string(image ? "image" : "file")]
    }
    private func syncAttachments(owner: String) async {
        var jobs: [(String, String?, [String: JSONValue])] = []
        for task in snapshot.tasks where !task.purged {
            if let attachment = task.attachment, needsTransfer(attachment, owner: owner) { jobs.append((task.id, nil, attachment)) }
            for child in task.subtasks { if let attachment = child.attachment, needsTransfer(attachment, owner: owner) { jobs.append((task.id, child.id, attachment)) } }
        }
        for (taskID, childID, original) in jobs.prefix(20) {
            guard uid == owner else { return }
            do {
                var next = original
                if case .string(let path) = original["storagePath"] {
                    guard let id = FileSafety.cloudFileID(uid: owner, path: path) else { continue }
                    let url = attachmentsDirectory.appendingPathComponent(id)
                    if !FileManager.default.fileExists(atPath: url.path) {
                        let data = try await Storage.storage().reference(withPath: path).data(maxSize: Int64(FileSafety.maxBytes))
                        guard uid == owner else { return }
                        try FileManager.default.createDirectory(at: attachmentsDirectory, withIntermediateDirectories: true)
                        try data.write(to: url, options: [.atomic, .completeFileProtection])
                    }
                    next["id"] = .string(id)
                } else if let url = attachmentURL(original), case .string(let id) = original["id"] {
                    let path = "users/\(owner)/attachments/\(id)"
                    let data = try Data(contentsOf: url)
                    guard data.count < FileSafety.maxBytes else { continue }
                    _ = try await Storage.storage().reference(withPath: path).putDataAsync(data)
                    next["storagePath"] = .string(path)
                }
                guard uid == owner, next != original else { continue }
                edit(taskID) { task in
                    if let childID, let i = task.subtasks.firstIndex(where: { $0.id == childID }), task.subtasks[i].attachment == original { task.subtasks[i].attachment = next }
                    else if childID == nil, task.attachment == original { task.attachment = next }
                }
            } catch { syncMessage = "Tasks synced · attachment upload/download will retry" }
        }
    }
    private func needsTransfer(_ attachment: [String: JSONValue], owner: String) -> Bool {
        if case .string(let path) = attachment["storagePath"] {
            guard let id = FileSafety.cloudFileID(uid: owner, path: path) else { return false }
            return attachment["id"] != .string(id) || !FileManager.default.fileExists(atPath: attachmentsDirectory.appendingPathComponent(id).path)
        }
        return attachmentURL(attachment) != nil
    }
    private var hasOutstandingAttachments: Bool {
        guard let uid else { return false }
        return snapshot.tasks.filter { !$0.purged }.flatMap { [$0] + $0.subtasks }.contains { row in row.attachment.map { needsTransfer($0, owner: uid) } ?? false }
    }
    func exportData() throws -> Data {
        try JSONSerialization.data(withJSONObject: ["tasks": snapshot.tasks.filter { !$0.deleted }.map(\.dictionary), "deletedTasks": trash.map(\.dictionary), "projects": projects.map(\.dictionary)], options: [.prettyPrinted, .sortedKeys])
    }
    @discardableResult
    func importData(_ data: Data) throws -> Bool {
        guard data.count < 20 * 1024 * 1024, let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw AppFailure.invalid("Choose a Stepler JSON export smaller than 20 MB.") }
        var raw = json["tasks"] as? [[String: Any]] ?? []
        for day in json["history"] as? [[String: Any]] ?? [] { raw += day["tasks"] as? [[String: Any]] ?? [] }
        raw += (json["deletedTasks"] as? [[String: Any]] ?? []).map { var row = $0; row["deleted"] = true; return row }
        let rows = try raw.filter { $0["mention"] == nil }.map { try TaskRecord(dictionary: $0) }
        var importedProjects: [Project] = []
        let projectRows = json["projects"] ?? (json["settings"] as? [String: Any])?["projects"]
        for value in projectRows as? [Any] ?? [] {
            let row = value as? [String: Any] ?? [:]
            let rawName = value as? String ?? row["name"] as? String ?? ""
            guard let name = TaskRecord.names([rawName]).first else { continue }
            let color = row["color"] as? String
            importedProjects.append(Project(name: name, isFavorite: row["isFavorite"] as? Bool ?? false, color: color?.range(of: "^#[a-fA-F0-9]{6}$", options: .regularExpression) != nil ? color : nil))
        }
        return commitLocal { state in
            if !importedProjects.isEmpty {
                state.projectSequence += 1
                var op = ProjectOperation(type: "remember", names: importedProjects)
                op.deviceId = deviceID; op.sequence = state.projectSequence; op.id = "\(deviceID):\(state.projectSequence)"
                try state.projectState.apply(op); state.projectQueue.append(op)
            }
            for row in rows {
                let before = state.tasks.first { $0.id == row.id }
                if before?.purged == true { continue }
                if let i = state.tasks.firstIndex(where: { $0.id == row.id }) { state.tasks[i] = row } else { state.tasks.append(row) }
                state.pending[row.id] = PendingEdit(base: state.pending[row.id]?.base ?? before, local: row)
            }
            rememberProjects(in: &state, tasks: rows)
        }
    }
}
