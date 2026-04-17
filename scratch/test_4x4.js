const fs = require('fs');

const mapping = {
    "R": [1, 3, 1], "R'": [1, 3, -1],
    "r": [1, 2, 1], "r'": [1, 2, -1],
    "l": [1, 1, 1], "l'": [1, 1, -1],
    "L": [1, 0, 1], "L'": [1, 0, -1],
    "D": [0, 3, 1], "D'": [0, 3, -1]
};

function applyMove(grid, move) {
    const amt = ((move[2] % 4) + 4) % 4;
    if (move[0] === 0) {
        const row = grid[move[1]];
        const newRow = new Array(4);
        for(let j=0; j<4; j++) newRow[(j+amt)%4] = row[j];
        grid[move[1]] = newRow;
    } else {
        const col = grid.map(r => r[move[1]]);
        const newCol = new Array(4);
        for(let j=0; j<4; j++) newCol[(j+amt)%4] = col[j];
        for(let j=0; j<4; j++) grid[j][move[1]] = newCol[j];
    }
}

const solutions = JSON.parse(fs.readFileSync('solutions4x4.json', 'utf8'));
const charMap = "MNOP";

let allPassed = true;

for (const [stateStr, alg] of Object.entries(solutions)) {
    const perm = stateStr.split('').map(c => charMap.indexOf(c));
    
    let grid = Array.from({length: 4}, (_, r) => 
        Array.from({length: 4}, (_, c) => r === 3 ? 12 + perm[c] : r * 4 + c)
    );

    for (const move of alg) {
        applyMove(grid, move);
    }

    let solved = true;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (grid[r][c] !== r * 4 + c) {
                solved = false;
                break;
            }
        }
        if (!solved) break;
    }

    if (!solved) {
        console.error(`FAILED: ${stateStr}`);
        console.error('Final grid state:', grid);
        allPassed = false;
    }
}

if (allPassed) {
    console.log(`SUCCESS! All ${Object.keys(solutions).length} combinations correctly solve the 4x4 puzzle.`);
} else {
    console.log("Some 4x4 tests failed.");
}
