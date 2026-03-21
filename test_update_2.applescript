tell application "Reminders"
  try
    set theReminder to reminder id "x-apple-reminder://8153613E-DF6A-456B-ADC8-6C7D1E3776C7"
    set targetDate to (current date)
    set year of targetDate to 2026
    set month of targetDate to 10
    set day of targetDate to 10
    set remind me date of theReminder to targetDate
    return "success"
  on error msg
    return "error: " & msg
  end try
end tell
