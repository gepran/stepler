tell application "Reminders"
  set newRem to make new reminder with properties {name:"Test Stepler"}
  return id of newRem
end tell
