tell application "Reminders"
  try
    set theReminder to reminder id "x-apple-reminder://8153613E-DF6A-456B-ADC8-6C7D1E3776C7"
    set name of theReminder to "Updated Stepler Reminder Test"
    return "success"
  on error msg
    return "error: " & msg
  end try
end tell
