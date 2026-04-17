const fs = require('fs');

const ALL_COMBINATIONS = 60;

const mapping = {
    "R": [1, 4, 1], "R'": [1, 4, -1],
    "r": [1, 3, 1], "r'": [1, 3, -1],
    "m": [1, 2, 1], "m'": [1, 2, -1],
    "l": [1, 1, 1], "l'": [1, 1, -1],
    "L": [1, 0, 1], "L'": [1, 0, -1],
    "D": [0, 4, 1], "D'": [0, 4, -1]
};

function invertMove(m) {
    if (m === "D3") return "D2";
    if (m === "D2") return "D3";
    if (m.endsWith("'")) return m[0];
    return m + "'";
}

function invertAlg(alg) {
    return [...alg].reverse().map(invertMove);
}

function simulate(alg, startPerm = [0, 1, 2, 3, 4]) {
    let grid = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => r === 4 ? 20 + startPerm[c] : r * 5 + c)
    );
    for (const m of alg) {
        let amt = 0;
        let move;
        if (m === "D3") {
            move = [0, 4, 1];
            amt = 3;
        } else if (m === "D2") {
            move = [0, 4, 1];
            amt = 2;
        } else {
            move = mapping[m];
            amt = ((move[2] % 5) + 5) % 5;
        }
        if (move[0] === 0) {
            const row = grid[move[1]];
            const newRow = new Array(5);
            for (let j = 0; j < 5; j++) newRow[(j + amt) % 5] = row[j];
            grid[move[1]] = newRow;
        } else {
            const col = grid.map(r => r[move[1]]);
            const newCol = new Array(5);
            for (let j = 0; j < 5; j++) newCol[(j + amt) % 5] = col[j];
            for (let j = 0; j < 5; j++) grid[j][move[1]] = newCol[j];
        }
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (grid[r][c] !== r * 5 + c) return null;
    return grid[4].map(v => v - 20);
}

const macroAlgs = {
    "D": ["D"],
    "D'": ["D'"]
};

const cols = ["L", "l", "m", "r", "R"];
for (let i = 0; i < 5; i++) {
    const ci = cols[i];
    macroAlgs[`PLL1_${ci}`] = [`${ci}'`, "D3", ci, "D", `${ci}'`, "D", ci, "D"];
    macroAlgs[`PLL2_${ci}`] = [`${ci}'`, "D", ci, "D", `${ci}'`, "D3", ci, "D"];
}

const solutions = {};
const queue = [{ state: [0, 1, 2, 3, 4], solvingPath: [] }];
const visited = new Set(["01234"]);
const charMap = "UVWXY";

while (queue.length > 0) {
    const { state, solvingPath } = queue.shift();
    const readableState = state.map(i => charMap[i]).join('');
    if (!solutions[readableState]) {
        solutions[readableState] = solvingPath.flatMap(m => macroAlgs[m] || [m]).join(' ').replace(/D3/g, "D'2");
    }
    if (Object.keys(solutions).length === 60) break;

    for (const mKey in macroAlgs) {
        const alg = macroAlgs[mKey];
        // To find S_prev that reaches S via alg, we apply inv(alg) to S
        const invA = invertAlg(alg);
        const sPrev = simulate(invA, state);
        if (sPrev) {
            const resStr = sPrev.join('');
            if (!visited.has(resStr)) {
                visited.add(resStr);
                queue.push({ state: sPrev, solvingPath: [mKey, ...solvingPath] });
            }
        }
    }
}

const sortedStates = Object.keys(solutions).sort();
let output = "\n\n--- 5x5 Last Row Algorithms ---\n";
output += "Note: Only 60 even permutations are possible.\n\n";

for (const state of sortedStates) {
    let algStr = solutions[state];
    if (algStr === "") algStr = "Already solved";
    output += `${state}: ${algStr}\n`;
}

let solutionsTxt = fs.readFileSync('solutions.txt', 'utf8');
const separatorIndex = solutionsTxt.indexOf("--- 5x5 Last Row Algorithms ---");
if (separatorIndex !== -1) {
    solutionsTxt = solutionsTxt.substring(0, separatorIndex).trimEnd();
}
fs.writeFileSync('solutions.txt', solutionsTxt + output);

const jsonSolutions = {};
for (const state in solutions) {
    let algStr = solutions[state];
    let algArr = [];
    if (algStr !== "") {
        algStr.split(' ').forEach(m => {
            if (m === "D'2") {
                algArr.push(mapping["D'"]);
                algArr.push(mapping["D'"]);
            } else {
                algArr.push(mapping[m]);
            }
        });
    }
    jsonSolutions[state] = algArr;
}

delete jsonSolutions["UVWXY"];

let jsonStr = "{\n";
const keys = Object.keys(jsonSolutions).sort();
const entries = keys.map(k => {
    const arrStr = jsonSolutions[k].map(m => `[${m[0]}, ${m[1]}, ${m[2]}]`).join(', ');
    return `  "${k}": [${arrStr}]`;
});
jsonStr += entries.join(",\n") + "\n}\n";

fs.writeFileSync('solutions5x5.json', jsonStr);

// -1 for already solved
if (Object.keys(jsonSolutions).length !== ALL_COMBINATIONS - 1) {
    console.error(`Error: Expected ${ALL_COMBINATIONS - 1} solutions, but got ${Object.keys(jsonSolutions).length}`);
} else {
    console.log(`Success: Generated ${Object.keys(jsonSolutions).length} 5x5 solutions`);
}

