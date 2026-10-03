import XCTest

final class SteplerUITests: XCTestCase {
    private var app: XCUIApplication!
    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication(); app.launchArguments = ["--ui-testing", "--reset"]; app.launch()
    }
    private func add(_ text: String) {
        let input = app.descendants(matching: .any)["task.draft"]
        XCTAssertTrue(input.waitForExistence(timeout: 10)); input.tap(); input.typeText(text); app.buttons["task.add"].tap()
    }
    private func expectKeyboardDismissed() {
        let hidden = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for: [hidden], timeout: 5), .completed)
    }
    private func tapTimelineBackground() {
        let timeline = app.descendants(matching: .any)["task.timeline"]
        XCTAssertTrue(timeline.waitForExistence(timeout: 5))
        // List's accessibility frame can extend underneath the composer and
        // keyboard. Choose visible blank space above both, not that frame's
        // proportional bottom (which would tap the keyboard instead).
        let input = app.descendants(matching: .any)["task.draft"]
        let y = max(timeline.frame.minY + 16, min(timeline.frame.maxY, input.frame.minY - 80) - 24)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: timeline.frame.midX, dy: y)).tap()
    }
    func testEmptyTimelineTapDismissesKeyboardWithoutLosingDraft() {
        let input = app.descendants(matching: .any)["task.draft"]
        XCTAssertTrue(input.waitForExistence(timeout: 10)); input.tap(); input.typeText("Keep this draft")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        tapTimelineBackground(); expectKeyboardDismissed()
        XCTAssertEqual(input.value as? String, "Keep this draft")
        input.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(input.value as? String, "Keep this draft")
        tapTimelineBackground(); expectKeyboardDismissed()
        XCTAssertEqual(input.value as? String, "Keep this draft")
    }
    func testDismissKeyboardThenSearchAndEditTask() {
        add("Find this task")
        let input = app.descendants(matching: .any)["task.draft"]
        input.tap(); input.typeText("Unsent draft")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        tapTimelineBackground(); expectKeyboardDismissed()
        XCTAssertEqual(input.value as? String, "Unsent draft")
        app.swipeDown()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5)); search.tap(); search.typeText("Find this")
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'task.row.'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5)); XCTAssertEqual(row.label, "Find this task")
        tapTimelineBackground(); expectKeyboardDismissed()
        XCTAssertEqual(search.value as? String, "Find this")
        row.tap()
        XCTAssertTrue(app.textViews["editor.text"].waitForExistence(timeout: 5))
        app.buttons["Cancel"].tap()
        XCTAssertEqual(input.value as? String, "Unsent draft")
    }
    func testCreateEditPriorityAndPersistence() {
        add("Review task")
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'task.row.'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5)); row.tap()
        let editor = app.textViews["editor.text"]; XCTAssertTrue(editor.waitForExistence(timeout: 5)); editor.tap(); editor.typeText(" edited")
        app.switches["editor.priority"].tap(); app.buttons["editor.save"].tap()
        XCTAssertTrue(row.waitForExistence(timeout: 5)); XCTAssertTrue(row.label.contains("edited"))
        app.terminate(); app.launchArguments = ["--ui-testing"]; app.launch()
        XCTAssertTrue(row.waitForExistence(timeout: 10)); XCTAssertTrue(row.label.contains("edited"))
    }
    func testProjectsAgreeInSidebarComposerAndSettings() {
        app.buttons["projects.open"].tap()
        let name = app.textFields["project.name"]; XCTAssertTrue(name.waitForExistence(timeout: 5)); name.tap(); name.typeText("Work"); app.buttons["project.add"].tap()
        XCTAssertTrue(app.buttons["sidebar.project.Work"].waitForExistence(timeout: 5)); app.buttons["Done"].firstMatch.tap()
        XCTAssertTrue(app.buttons["composer.project.Work"].waitForExistence(timeout: 5))
        app.buttons["settings.open"].tap()
        let setting = app.buttons["settings.project.Work"]; XCTAssertTrue(setting.waitForExistence(timeout: 5)); setting.tap()
        app.buttons["project.favorite"].tap(); app.buttons["Done"].firstMatch.tap(); app.buttons["settings.done"].tap()
        XCTAssertTrue(app.buttons["composer.project.Work"].waitForExistence(timeout: 5))
    }
    func testMentionsFilterPreservesOwnTasks() {
        add("Must stay saved")
        app.buttons["mentions.filter"].tap(); app.buttons["mentions.filter"].tap()
        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'task.row.'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5)); XCTAssertEqual(row.label, "Must stay saved")
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Stepler iOS timeline"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}
