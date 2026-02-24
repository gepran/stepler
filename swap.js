const fs = require('fs');

const file = 'src/renderer/src/App.jsx';
const content = fs.readFileSync(file, 'utf8');

const todayRegex = /(\{\/\*\s*TODAY\s*\*\/\}[\s\S]*?(?=\{\/\*\s*HISTORY\s*\*\/\}))/;
const todayMatch = content.match(todayRegex);

// We need to carefully split by the end of history map
const historyRegex = /(\{\/\*\s*HISTORY\s*\*\/\}[\s\S]*?\}\)\)\})/;
const historyMatch = content.match(historyRegex);

if (!todayMatch || !historyMatch) {
    console.error("Could not find Today or History sections.");
    process.exit(1);
}

const todayStr = todayMatch[0];
let historyStr = historyMatch[0];

// Update history header styles
historyStr = historyStr.replace(
    /<div\s+className="absolute left-\[7px\] top-\[14px\] -bottom-\[40px\] z-0 w-\[2px\] bg-neutral-200 dark:bg-neutral-800" \/>\s*<div\s+className="absolute left-\[4px\] top-\[6px\] z-10 h-2 w-2 rounded-full bg-neutral-400 ring-\[5px\] ring-neutral-50 transition-colors group-hover:bg-neutral-500 dark:bg-neutral-600 dark:ring-neutral-950" \/>\s*<div\s+className="mb-3">\s*<h3\s+className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">\s*\{day\.date\}\s*<\/h3>\s*<\/div>/s,
    `<div className="sticky top-0 z-30 bg-white/95 pt-3 pb-4 backdrop-blur-md dark:bg-neutral-950/95">
                    <div className="absolute left-[4px] top-[18px] z-10 h-2 w-2 rounded-full bg-neutral-600 shadow-[0_0_8px_rgba(0,0,0,0.2)] ring-[5px] ring-white dark:bg-neutral-300 dark:shadow-[0_0_8px_rgba(255,255,255,0.1)] dark:ring-neutral-950" />
                    <div className="pl-8">
                      <h2 className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                        {day.date}
                      </h2>
                    </div>
                  </div>`
);

// we also need to add back the vertical line inside the space-y-0.5 div
historyStr = historyStr.replace(
    /<div className="space-y-0.5">/g,
    `<div className="relative space-y-0.5 pl-8">
                    {/* Vertical line for History */}
                    <div className="absolute left-[7px] top-0 bottom-[-24px] z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />`
);

// Also remove the old wrapping styles of history that might no longer apply
historyStr = historyStr.replace(
    /className="group relative mb-10 pl-8 opacity-60 transition-opacity duration-300 hover:opacity-100"/g,
    `className="group relative mb-6 opacity-70 transition-opacity duration-300 hover:opacity-100"`
);

// Now physically replace both in the file content
// They are contiguous: Today is before History. 
let newContent = content.substring(0, todayMatch.index);
newContent += historyStr + '\n\n' + todayStr;
newContent += content.substring(historyMatch.index + historyMatch[0].length);

fs.writeFileSync(file, newContent);
console.log("Success");
