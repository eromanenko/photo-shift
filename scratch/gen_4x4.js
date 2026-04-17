const fs = require('fs');

const ALL_COMBINATIONS = 24;
const text = fs.readFileSync('solutions.txt', 'utf8');

const mapping = {
    "R": [1, 3, 1], "R'": [1, 3, -1],
    "r": [1, 2, 1], "r'": [1, 2, -1],
    "l": [1, 1, 1], "l'": [1, 1, -1],
    "L": [1, 0, 1], "L'": [1, 0, -1],
    "D": [0, 3, 1], "D'": [0, 3, -1],
    "D2": [0, 3, 2]
};

const solutions = {};

const lines = text.split('\n');
for (let line of lines) {
    line = line.trim();
    if (line.startsWith('ABCDE')) break; // Stop before 5x5 stuff
    if (!line) continue;
    if (line.includes(':')) {
        const parts = line.split(':');
        const state = parts[0].trim();
        const movesStr = parts[1].trim();
        if (state.length === 4) {
            if (movesStr === '') {
                solutions[state] = [];
            } else {
                const moves = movesStr.split(/\s+/);
                const algArr = [];
                for (const m of moves) {
                    if (m === "D2") {
                        algArr.push(mapping["D"]);
                        algArr.push(mapping["D"]);
                    } else if (mapping[m]) {
                        algArr.push(mapping[m]);
                    }
                }
                solutions[state] = algArr;
            }
        }
    }
}

delete solutions["MNOP"];

let jsonStr = "{\n";
const keys = Object.keys(solutions).sort();
const entries = keys.map(k => {
    const arrStr = solutions[k].map(m => `[${m[0]}, ${m[1]}, ${m[2]}]`).join(', ');
    return `  "${k}": [${arrStr}]`;
});
jsonStr += entries.join(",\n") + "\n}\n";

fs.writeFileSync('solutions4x4.json', jsonStr);

// -1 for already solved
if (Object.keys(solutions).length !== ALL_COMBINATIONS - 1) {
    console.error(`Error: Expected ${ALL_COMBINATIONS - 1} solutions, but got ${Object.keys(solutions).length}`);
} else {
    console.log(`Success: Generated ${Object.keys(solutions).length} 4x4 solutions`);
}
