const fs = require('fs');
const content = fs.readFileSync('src/renderer/src/App.jsx', 'utf8');
const lines = content.split('\n');

const todayStart = lines.findIndex(l => l.includes('{/* TODAY */}'));
let historyStart = -1;
for (let i = todayStart + 1; i < lines.length; i++) {
    if (lines[i].includes('{/* HISTORY */}')) {
        historyStart = i;
        break;
    }
}
let historyEnd = -1;
for (let i = historyStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === '))} \r' || lines[i].trim() === '))} // history close' || lines[i].match(/^\s*}\)\)}\s*$/)) {
        historyEnd = i;
        break;
    }
}

console.log('todayStart', todayStart);
console.log('historyStart', historyStart);
console.log('historyEnd', historyEnd);

if (todayStart !== -1 && historyStart !== -1 && historyEnd !== -1) {
    const todayBlock = lines.slice(todayStart, historyStart).join('\n');
    let historyBlock = lines.slice(historyStart, historyEnd + 1).join('\n');

    // Update history header styles
    historyBlock = historyBlock.replace(
        /<div\\s+className="absolute left-\\[7px\\] top-\\[14px\\] -bottom-\\[40px\\] z-0 w-\\[2px\\] bg-neutral-200 dark:bg-neutral-800" \\/>\\s*<div\\s+className="absolute left-\\[4px\\] top-\\[6px\\] z-10 h-2 w-2 rounded-full bg-neutral-400 ring-\\[5px\\] ring-neutral-50 transition-colors group-hover:bg-neutral-500 dark:bg-neutral-600 dark:ring-neutral-950" \\/>\\s*<div\\s+className="mb-3">\\s*<h3\\s+className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">\\s*\\{day\\.date\\}\\s*<\\/h3>\\s*<\\/div>/s,
        `<div className="sticky top-0 z-30 bg-white/95 pt-3 pb-4 backdrop-blur-md dark:bg-neutral-950/95">
                    <div className="absolute left-[4px] top-[18px] z-10 h-2 w-2 rounded-full bg-neutral-600 shadow-[0_0_8px_rgba(0,0,0,0.2)] ring-[5px] ring-white dark:bg-neutral-300 dark:shadow-[0_0_8px_rgba(255,255,255,0.1)] dark:ring-neutral-950" />
                    <div className="pl-8">
                      <h2 className="text-lg font-bold leading-none text-neutral-900 dark:text-neutral-100">
                        {day.date}
                      </h2>
                    </div>
                  </div>`
    );
    // make sure to modify to vertical line and opacity properly if needed

    // we also need to add back the vertical line inside the space-y-0.5 div
    historyBlock = historyBlock.replace(
        /<div className="space-y-0.5">/g,
        `<div className="relative space-y-0.5 pl-8 opacity-70 transition-opacity duration-300 hover:opacity-100">
                    {/* Vertical line for History */}
                    <div className="absolute left-[7px] top-0 bottom-[-24px] z-0 w-[2px] bg-neutral-200 dark:bg-neutral-800" />`
    );

    // Also remove the old wrapping styles of history that might no longer apply
    historyBlock = historyBlock.replace(
        /className="group relative mb-10 pl-8 opacity-60 transition-opacity duration-300 hover:opacity-100"/g,
        `className="relative mb-6"`
    );


    const before = lines.slice(0, todayStart).join('\n');
    const after = lines.slice(historyEnd + 1).join('\n');

    const newContent = before + '\n' + historyBlock + '\n\n' + todayBlock + after;
    fs.writeFileSync('src/renderer/src/App.jsx', newContent);
    console.log('Swapped successfully');
} else {
    console.log('Failed to find boundaries');
}
