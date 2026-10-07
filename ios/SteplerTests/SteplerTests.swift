import XCTest
@testable import Stepler

final class SteplerTests: XCTestCase {
    func testIndependentFieldsMerge() throws {
        let base = TaskRecord(text: "Before")
        var local = base; local.text = "Edited"
        var remote = base; remote.completed = true; remote.priority = true
        let merged = TaskRecord.merge(base: base, local: local, remote: remote)
        XCTAssertEqual(merged.text, "Edited"); XCTAssertTrue(merged.completed); XCTAssertTrue(merged.priority)
    }
    func testConcurrentSubtasksAndRemoval() throws {
        var base = TaskRecord(text: "Parent"); base.subtasks = [TaskRecord(text: "A"), TaskRecord(text: "B")]
        var local = base; local.subtasks[0].completed = true; local.subtasks.append(TaskRecord(text: "C"))
        var remote = base; remote.subtasks[1].text = "B edited"; remote.subtasks.append(TaskRecord(text: "D"))
        let merged = TaskRecord.merge(base: base, local: local, remote: remote)
        XCTAssertEqual(merged.subtasks.count, 4); XCTAssertTrue(merged.subtasks[0].completed); XCTAssertEqual(merged.subtasks[1].text, "B edited")
        remote.subtasks.removeFirst()
        XCTAssertFalse(TaskRecord.merge(base: base, local: local, remote: remote).subtasks.contains { $0.id == base.subtasks[0].id })
    }
    func testTombstoneDominatesOfflineEdits() {
        let base = TaskRecord(text: "Task")
        var remote = base; remote.purge()
        let result = TaskRecord.merge(base: base, local: base, remote: remote)
        XCTAssertTrue(result.purged); XCTAssertTrue(result.text.isEmpty); XCTAssertTrue(result.subtasks.isEmpty)
        XCTAssertTrue(TaskRecord.merge(base: nil, local: base, remote: remote).purged)
    }
    func testProjectClockMakesRetryIdempotent() throws {
        var state = ProjectState(); try state.apply(ProjectOperation(type: "add", name: "Work"))
        var operation = ProjectOperation(type: "favorite", name: "Work"); operation.deviceId = "device"; operation.sequence = 1
        try state.apply(operation); try state.apply(operation)
        XCTAssertTrue(state.projects[0].isFavorite)
    }
    func testProjectRenameAndDeletionDoNotResurrect() throws {
        var state = ProjectState(); try state.apply(ProjectOperation(type: "add", name: "A")); try state.apply(ProjectOperation(type: "rename", name: "A", nextName: "B"))
        try state.apply(ProjectOperation(type: "remember", names: [Project(name: "A")]))
        XCTAssertEqual(state.projects.map(\.name), ["B"]); XCTAssertEqual(state.resolve("A"), "B")
        try state.apply(ProjectOperation(type: "remove", name: "B")); XCTAssertNil(state.resolve("A"))
        try state.apply(ProjectOperation(type: "add", name: "C")); try state.apply(ProjectOperation(type: "rename", name: "C", nextName: "B"))
        XCTAssertEqual(state.resolve("B"), "B"); XCTAssertEqual(state.resolve("C"), "B")
    }
    func testMetadataRoundTripPreservesDesktopIntegrationFields() throws {
        let task = try TaskRecord(dictionary: ["id": "123-task", "text": "Task", "completed": false, "priority": true, "gcalEventId": "event", "jiraKey": "ABC-1", "attachment": ["storagePath": "users/me/attachments/photo.png", "name": "photo.png", "type": "image"]])
        let roundtrip = try TaskRecord(dictionary: task.dictionary)
        XCTAssertEqual(task, roundtrip); XCTAssertEqual(roundtrip.extras["gcalEventId"], .string("event")); XCTAssertTrue(roundtrip.priority)
    }
    func testAttachmentPathBoundaries() {
        XCTAssertEqual(FileSafety.cloudFileID(uid: "me", path: "users/me/attachments/file.png"), "file.png")
        for path in ["users/other/attachments/file.png", "users/me/attachments/../secret", "users/me/attachments/a/b", "users/me/attachments/.hidden"] { XCTAssertNil(FileSafety.cloudFileID(uid: "me", path: path)) }
    }
    func testReminderDateCompletionAndLimits() {
        var task = TaskRecord(text: "Future"); task.dueDate = "2030-01-01"; task.reminder = "09:00"
        var child = TaskRecord(text: "Child"); child.dueDate = task.dueDate; child.reminder = "10:00"; task.subtasks = [child]
        let now = Date(timeIntervalSince1970: 0)
        XCTAssertEqual(ReminderService.requests(tasks: [task], now: now).count, 2)
        task.completed = true; task.subtasks[0].completed = true
        XCTAssertTrue(ReminderService.requests(tasks: [task], now: now).isEmpty)
        task.completed = false; task.reminder = "25:99"
        XCTAssertTrue(ReminderService.requests(tasks: [task], now: now).isEmpty)
    }
    @MainActor func testPersistenceFailureKeepsDataAndRejectsPartialTask() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = AppStore(testing: true, root: root)
        XCTAssertTrue(store.add(text: "Saved", projects: ["Work"]))
        store.failWritesForTesting = true
        XCTAssertFalse(store.add(text: "Failed", projects: [])); XCTAssertEqual(store.tasks.count, 1)
        let reloaded = AppStore(testing: true, root: root)
        XCTAssertEqual(reloaded.tasks.map(\.text), ["Saved"]); XCTAssertEqual(reloaded.projects.map(\.name), ["Work"])
    }
    @MainActor func testRenameUpdatesHistoryTrashAndSubtasks() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let store = AppStore(testing: true, root: root)
        var task = TaskRecord(text: "Parent", projects: ["A"]); task.ymd = "2020-01-01"; task.deleted = true; task.subtasks = [TaskRecord(text: "Child", projects: ["A"])]
        XCTAssertTrue(store.project(ProjectOperation(type: "add", name: "A"))); XCTAssertTrue(store.put(task)); XCTAssertTrue(store.project(ProjectOperation(type: "rename", name: "A", nextName: "B")))
        XCTAssertEqual(store.trash[0].projects, ["B"]); XCTAssertEqual(store.trash[0].subtasks[0].projects, ["B"])
    }
    @MainActor func testDeleteRestorePurgeAndRemoteEcho() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let store = AppStore(testing: true, root: root); let task = TaskRecord(text: "Task")
        XCTAssertTrue(store.put(task)); store.delete(task.id); XCTAssertEqual(store.trash.count, 1); store.restore(task.id); XCTAssertEqual(store.tasks.count, 1)
        store.purge(task.id); store.receive([task]); XCTAssertTrue(store.tasks.isEmpty); XCTAssertTrue(store.trash.isEmpty)
    }
    @MainActor func testReorderAndInvalidNestingCannotLoseRows() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let store = AppStore(testing: true, root: root); var a = TaskRecord(text: "A"); var b = TaskRecord(text: "B"); a.sortOrder = 1; b.sortOrder = 2
        XCTAssertTrue(store.put(a)); XCTAssertTrue(store.put(b)); store.reorder([b.id], before: a.id)
        XCTAssertEqual(TaskRecord.ordered(store.tasks).map(\.text), ["B", "A"])
        store.nest(a.id, under: a.id); XCTAssertEqual(store.tasks.count, 2)
        store.nest(a.id, under: b.id); XCTAssertEqual(store.tasks.count, 1); XCTAssertEqual(store.tasks[0].subtasks[0].text, "A")
        store.promote(a.id, from: b.id); XCTAssertEqual(store.tasks.count, 2); XCTAssertTrue(store.tasks.first { $0.id == b.id }!.subtasks.isEmpty)
        XCTAssertTrue(store.tasks.contains { $0.text == "A" && $0.id != a.id })
    }
    @MainActor func testExportImportKeepsMetadataAndSkipsPurgedRows() throws {
        let a = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString), b = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: a); try? FileManager.default.removeItem(at: b) }
        let first = AppStore(testing: true, root: a), second = AppStore(testing: true, root: b)
        var task = TaskRecord(text: "Task", projects: ["Work"]); task.priority = true; task.subtasks = [TaskRecord(text: "Child")]
        XCTAssertTrue(first.put(task)); XCTAssertTrue(first.project(ProjectOperation(type: "favorite", name: "Work"))); XCTAssertTrue(first.project(ProjectOperation(type: "color", name: "Work", color: "#abcdef")))
        XCTAssertTrue(try second.importData(first.exportData())); XCTAssertEqual(second.tasks[0], task)
        XCTAssertEqual(second.projects, first.projects)
        XCTAssertEqual(AppStore(testing: true, root: b).projects, first.projects)
    }
    @MainActor func testAttachmentSizeAndWriteRoundTrip() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let store = AppStore(testing: true, root: root)
        let attachment = try store.storeAttachment(Data([1, 2, 3]), name: "file.bin", image: false)
        XCTAssertEqual(try Data(contentsOf: XCTUnwrap(store.attachmentURL(attachment))), Data([1, 2, 3]))
        XCTAssertThrowsError(try store.storeAttachment(Data(count: FileSafety.maxBytes), name: "large", image: false))
    }
    @MainActor func testImageAndTaskCopyWritePixelsAndText() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = AppStore(testing: true, root: root)
        let original = UIPasteboard.general.items
        defer { UIPasteboard.general.items = original }
        let image = UIGraphicsImageRenderer(size: CGSize(width: 20, height: 15)).image { context in
            UIColor.red.setFill(); context.fill(CGRect(x: 0, y: 0, width: 20, height: 15))
        }
        let attachment = try store.storeAttachment(try XCTUnwrap(image.pngData()), name: "copy.png", image: true)
        XCTAssertTrue(store.copyAttachmentImage(attachment))
        XCTAssertEqual(UIPasteboard.general.image?.cgImage?.width, image.cgImage?.width)
        XCTAssertEqual(UIPasteboard.general.image?.cgImage?.height, image.cgImage?.height)
        var task = TaskRecord(text: "With image"); task.attachment = attachment; task.subtasks = [TaskRecord(text: "Child")]
        XCTAssertTrue(store.copyTask(task))
        XCTAssertEqual(UIPasteboard.general.string, "With image\n- Child")
        XCTAssertNotNil(UIPasteboard.general.image)
        XCTAssertFalse(store.copyAttachmentImage(["id": .string("missing.png")]))
    }

}
