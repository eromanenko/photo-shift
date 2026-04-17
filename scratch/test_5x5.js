const fs = require('fs');

const mapping = {
    "R": [1, 4, 1], "R'": [1, 4, -1],
    "r": [1, 3, 1], "r'": [1, 3, -1],
    "m": [1, 2, 1], "m'": [1, 2, -1],
    "l": [1, 1, 1], "l'": [1, 1, -1],
    "L": [1, 0, 1], "L'": [1, 0, -1],
    "D": [0, 4, 1], "D'": [0, 4, -1]
};

function applyMove(grid, move) {
    const amt = ((move[2] % 5) + 5) % 5;
    if (move[0] === 0) {
        const row = grid[move[1]];
        const newRow = new Array(5);
        for(let j=0; j<5; j++) newRow[(j+amt)%5] = row[j];
        grid[move[1]] = newRow;
    } else {
        const col = grid.map(r => r[move[1]]);
        const newCol = new Array(5);
        for(let j=0; j<5; j++) newCol[(j+amt)%5] = col[j];
        for(let j=0; j<5; j++) grid[j][move[1]] = newCol[j];
    }
}

const solutions = JSON.parse(fs.readFileSync('solutions5x5.json', 'utf8'));
const charMap = "UVWXY";

let allPassed = true;

for (const [stateStr, alg] of Object.entries(solutions)) {
    // Determine the starting permutation of the last row from stateStr
    const perm = stateStr.split('').map(c => charMap.indexOf(c));
    
    // Initialize the grid
    let grid = Array.from({length: 5}, (_, r) => 
        Array.from({length: 5}, (_, c) => r === 4 ? 20 + perm[c] : r * 5 + c)
    );

    // Apply the algorithm
    for (const move of alg) {
        applyMove(grid, move);
    }

    // Check if grid is fully solved
    let solved = true;
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (grid[r][c] !== r * 5 + c) {
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
    console.log(`SUCCESS! All ${Object.keys(solutions).length} combinations correctly solve the puzzle.`);
} else {
    console.log("Some tests failed.");
}
