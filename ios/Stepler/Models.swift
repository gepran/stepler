import Foundation

enum AppFailure: LocalizedError {
    case invalid(String)
    var errorDescription: String? { if case .invalid(let message) = self { return message }; return nil }
}

indirect enum JSONValue: Codable, Equatable {
    case string(String), number(Double), bool(Bool), array([JSONValue]), object([String: JSONValue]), null
    init(_ value: Any) {
        switch value {
        case let s as String: self = .string(s)
        case let n as NSNumber: self = String(cString: n.objCType) == "c" ? .bool(n.boolValue) : .number(n.doubleValue)
        case let a as [Any]: self = .array(a.map(JSONValue.init))
        case let d as [String: Any]: self = .object(d.mapValues(JSONValue.init))
        default: self = .null
        }
    }
    var value: Any {
        switch self {
        case .string(let s): return s
        case .number(let n): return n
        case .bool(let b): return b
        case .array(let a): return a.map(\.value)
        case .object(let d): return d.mapValues(\.value)
        case .null: return NSNull()
        }
    }
}

struct TaskRecord: Codable, Equatable, Identifiable {
    var id: String
    var text: String
    var ymd: String
    var completed = false
    var priority = false
    var deleted = false
    var purged = false
    var sortOrder: Double?
    var projects: [String] = []
    var subtasks: [TaskRecord] = []
    var dueDate: String?
    var reminder: String?
    var attachment: [String: JSONValue]?
    var extras: [String: JSONValue] = [:]

    init(text: String, projects: [String] = []) {
        id = "\(Int64(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(12))"
        self.text = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(20_000))
        ymd = Self.day(Date())
        self.projects = projects
    }
    init(dictionary d: [String: Any], documentID: String? = nil) throws {
        guard let id = documentID ?? d["id"] as? String, !id.isEmpty, id.count <= 64,
              let text = d["text"] as? String else { throw AppFailure.invalid("The task has an invalid ID or text.") }
        self.id = id
        self.text = String(text.prefix(20_000))
        ymd = d["ymd"] as? String ?? Self.day(Self.dateForID(id))
        completed = d["completed"] as? Bool ?? false
        priority = d["priority"] as? Bool ?? false
        deleted = d["deleted"] as? Bool ?? false
        purged = d["purged"] as? Bool ?? false
        if let order = d["sortOrder"] as? Double, order.isFinite { sortOrder = order }
        projects = Self.names(d["projects"] as? [String] ?? [])
        subtasks = try (d["subtasks"] as? [[String: Any]] ?? []).prefix(500).map { try TaskRecord(dictionary: $0) }
        dueDate = d["dueDate"] as? String
        reminder = d["reminder"] as? String
        attachment = (d["attachment"] as? [String: Any])?.mapValues(JSONValue.init)
        let known: Set<String> = ["id", "text", "ymd", "completed", "priority", "deleted", "purged", "sortOrder", "projects", "subtasks", "dueDate", "reminder", "attachment", "updatedAt"]
        extras = d.filter { !known.contains($0.key) }.mapValues(JSONValue.init)
    }
    var dictionary: [String: Any] {
        var d = extras.mapValues(\.value)
        d.merge(["id": id, "text": text, "ymd": ymd, "completed": completed, "priority": priority, "deleted": deleted], uniquingKeysWith: { _, new in new })
        if purged { d["purged"] = true }
        if let sortOrder { d["sortOrder"] = sortOrder }
        if !projects.isEmpty { d["projects"] = projects }
        if !subtasks.isEmpty { d["subtasks"] = subtasks.map(\.dictionary) }
        if let dueDate { d["dueDate"] = dueDate }
        if let reminder { d["reminder"] = reminder }
        if let attachment { d["attachment"] = attachment.mapValues(\.value) }
        return d
    }
    var order: Double { sortOrder ?? Double(id.prefix(while: { $0.isNumber })) ?? 0 }
    static func ordered(_ tasks: [TaskRecord]) -> [TaskRecord] {
        tasks.sorted { $0.completed != $1.completed ? $0.completed : $0.order < $1.order }
    }
    static func day(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }
    static func dateForID(_ id: String) -> Date { Double(id.prefix(while: { $0.isNumber })).map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date() }
    static func names(_ names: [String]) -> [String] {
        var seen = Set<String>()
        return names.map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80)) }.filter { !$0.isEmpty && seen.insert($0).inserted }
    }
    mutating func rewriteProjects(_ state: ProjectState) {
        projects = Self.names(projects.compactMap(state.resolve))
        for i in subtasks.indices { subtasks[i].rewriteProjects(state) }
    }
    mutating func purge() {
        text = ""; completed = false; priority = false; deleted = true; purged = true
        projects = []; subtasks = []; attachment = nil; dueDate = nil; reminder = nil; extras = [:]
    }
    static func merge(base: TaskRecord?, local: TaskRecord, remote: TaskRecord?) -> TaskRecord {
        guard let remote else { return local }
        if remote.purged || local.purged { var result = remote.purged ? remote : local; result.purge(); return result }
        guard let base else { return local }
        let b = base.dictionary.mapValues(JSONValue.init), l = local.dictionary.mapValues(JSONValue.init)
        var r = remote.dictionary.mapValues(JSONValue.init)
        for key in Set(b.keys).union(l.keys) where !["id", "subtasks", "projects", "updatedAt"].contains(key) {
            if b[key] != l[key] { r[key] = l[key] }
        }
        if base.projects != local.projects {
            let removed = Set(base.projects).subtracting(local.projects)
            let added = local.projects.filter { !base.projects.contains($0) }
            r["projects"] = JSONValue(names(remote.projects.filter { !removed.contains($0) } + added))
        }
        if base.subtasks != local.subtasks {
            var latest = Dictionary(remote.subtasks.map { ($0.id, $0) }, uniquingKeysWith: { _, new in new })
            let old = Dictionary(base.subtasks.map { ($0.id, $0) }, uniquingKeysWith: { _, new in new })
            let wanted = Set(local.subtasks.map(\.id))
            for id in old.keys where !wanted.contains(id) { latest.removeValue(forKey: id) }
            for row in local.subtasks {
                if old[row.id] != nil && latest[row.id] == nil { continue }
                if old[row.id] != row { latest[row.id] = merge(base: old[row.id], local: row, remote: latest[row.id]) }
            }
            let ordered = local.subtasks.compactMap { latest[$0.id] } + remote.subtasks.filter { !wanted.contains($0.id) }.compactMap { latest[$0.id] }
            r["subtasks"] = JSONValue(ordered.map(\.dictionary))
        }
        return (try? TaskRecord(dictionary: r.mapValues(\.value))) ?? local
    }
}

struct Project: Codable, Equatable, Identifiable {
    var name: String
    var isFavorite = false
    var color: String?
    var id: String { name }
    var dictionary: [String: Any] {
        var d: [String: Any] = ["name": name, "isFavorite": isFavorite]
        if let color { d["color"] = color }; return d
    }
}
struct ProjectRename: Codable, Equatable { var name: String; var nextName: String }
struct ProjectOperation: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var type: String
    var name = ""
    var nextName: String?
    var color: String?
    var names: [Project] = []
    var deviceId: String?
    var sequence: Int?
}
struct ProjectState: Codable, Equatable {
    var projects: [Project] = []
    var removed: [String] = []
    var renames: [ProjectRename] = []
    var clocks: [String: Int] = [:]
    init() {}
    init(dictionary d: [String: Any]) {
        projects = (d["projects"] as? [[String: Any]] ?? []).compactMap { row in
            guard let name = row["name"] as? String, !name.isEmpty else { return nil }
            return Project(name: name, isFavorite: row["isFavorite"] as? Bool ?? false, color: row["color"] as? String)
        }
        removed = d["removed"] as? [String] ?? []
        renames = (d["renames"] as? [[String: String]] ?? []).compactMap { row in
            guard let name = row["name"], let next = row["nextName"] else { return nil }; return ProjectRename(name: name, nextName: next)
        }
        clocks = d["clocks"] as? [String: Int] ?? [:]
    }
    var dictionary: [String: Any] { ["projects": projects.map(\.dictionary), "removed": removed, "renames": renames.map { ["name": $0.name, "nextName": $0.nextName] }, "clocks": clocks] }
    var sorted: [Project] { projects.sorted { $0.isFavorite != $1.isFavorite ? $0.isFavorite : $0.name.localizedStandardCompare($1.name) == .orderedAscending } }
    func resolve(_ name: String) -> String? {
        var result = name
        for rename in renames where result == rename.name { result = rename.nextName }
        return removed.contains(result) ? nil : result
    }
    mutating func apply(_ operation: ProjectOperation) throws {
        if let device = operation.deviceId, let seq = operation.sequence {
            if (clocks[device] ?? 0) >= seq { return }; clocks[device] = seq
        }
        let name = String(operation.name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        if operation.type == "remember" {
            for project in operation.names where resolve(project.name) == project.name && !projects.contains(where: { $0.name == project.name }) { projects.append(project) }
            return
        }
        guard !name.isEmpty else { throw AppFailure.invalid("Enter a project name.") }
        if operation.type == "add" {
            if !projects.contains(where: { $0.name == name }) { projects.append(Project(name: name)) }
            removed.removeAll { $0 == name }; renames.removeAll { $0.name == name }; return
        }
        guard let i = projects.firstIndex(where: { $0.name == name }) else { throw AppFailure.invalid("This project no longer exists.") }
        switch operation.type {
        case "favorite": projects[i].isFavorite.toggle()
        case "color":
            guard let color = operation.color, color.range(of: "^#[a-fA-F0-9]{6}$", options: .regularExpression) != nil else { throw AppFailure.invalid("Invalid project color.") }
            projects[i].color = color
        case "remove": projects.remove(at: i); if !removed.contains(name) { removed.append(name) }
        case "rename":
            let next = String((operation.nextName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
            guard !next.isEmpty else { throw AppFailure.invalid("Enter a project name.") }
            guard next == name || !projects.contains(where: { $0.name == next }) else { throw AppFailure.invalid("A project with this name already exists.") }
            projects[i].name = next; removed.removeAll { $0 == next }; if next != name { renames.append(ProjectRename(name: name, nextName: next)) }
        default: throw AppFailure.invalid("Unknown project operation.")
        }
    }
}

struct PendingEdit: Codable { var base: TaskRecord?; var local: TaskRecord }
struct LocalSnapshot: Codable {
    var tasks: [TaskRecord] = []
    var projectState = ProjectState()
    var pending: [String: PendingEdit] = [:]
    var projectQueue: [ProjectOperation] = []
    var projectSequence = 0
}

enum FileSafety {
    static let maxBytes = 25 * 1024 * 1024
    static func validID(_ value: String) -> Bool {
        value.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$", options: .regularExpression) != nil && !value.contains("..")
    }
    static func cloudFileID(uid: String, path: String) -> String? {
        let prefix = "users/\(uid)/attachments/"
        guard path.hasPrefix(prefix) else { return nil }
        let id = String(path.dropFirst(prefix.count)); return validID(id) ? id : nil
    }
}
