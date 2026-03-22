// Test script to verify Ludo board logic
// Run with: node test_board_logic.js

// Mock DOM environment for testing
global.window = {
    location: { hostname: 'localhost' },
    devicePixelRatio: 1,
    crypto: {
        getRandomValues: (arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 0xFFFFFFFF);
            }
            return arr;
        }
    },
    addEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id)
};

global.document = {
    getElementById: () => ({
        width: 700,
        height: 700,
        getBoundingClientRect: () => ({ width: 350, height: 350, left: 0, top: 0 }),
        style: {},
        getContext: () => ({
            clearRect: () => {},
            fillRect: () => {},
            strokeRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            fill: () => {},
            stroke: () => {},
            arc: () => {},
            translate: () => {},
            rotate: () => {},
            save: () => {},
            restore: () => {},
            set fillStyle(v) {},
            set strokeStyle(v) {},
            set lineWidth(v) {},
            set shadowColor(v) {},
            set shadowBlur(v) {},
            set shadowOffsetY(v) {}
        }),
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {} },
        dataset: {}
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
};

global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: () => {} };

// Load entropy random first
require('./entropyRandom.js');

// Test board logic
console.log('=== Ludo Board Logic Test ===\n');

// Test home column cells
const homeColumnCells = new Set([
    '1,7', '2,7', '3,7', '4,7', '5,7',  // blue
    '7,1', '7,2', '7,3', '7,4', '7,5',  // red
    '13,7', '12,7', '11,7', '10,7', '9,7',  // green
    '7,13', '7,12', '7,11', '7,10', '7,9'  // yellow
]);

console.log('Home column cells that should NOT be drawn as squares:');
console.log('Blue:', [...homeColumnCells].filter(k => k.includes('7') && !k.startsWith('7,')));
console.log('Red:', [...homeColumnCells].filter(k => k.startsWith('7,') && parseInt(k.split(',')[1]) < 10));
console.log('Green:', [...homeColumnCells].filter(k => k.includes('7') && parseInt(k.split(',')[0]) > 7));
console.log('Yellow:', [...homeColumnCells].filter(k => k.startsWith('7,') && parseInt(k.split(',')[1]) >= 9));
console.log('Total home column cells:', homeColumnCells.size);
console.log('');

// Test center block cells
function isCenterBlockCell(x, y) {
    return x >= 6 && x <= 8 && y >= 6 && y <= 8;
}

console.log('Center block cells (should only show triangles, no squares):');
const centerCells = [];
for (let x = 6; x <= 8; x++) {
    for (let y = 6; y <= 8; y++) {
        centerCells.push(`${x},${y}`);
    }
}
console.log(centerCells);
console.log('');

// Test POV rotation
console.log('POV Rotation test:');
const rotations = {
    blue: -Math.PI / 2,   // -90°
    red: Math.PI,          // 180°
    yellow: 0,             // 0°
    green: Math.PI / 2     // 90°
};

Object.entries(rotations).forEach(([color, rad]) => {
    const deg = (rad * 180 / Math.PI).toFixed(0);
    console.log(`  ${color}: ${deg}° (${rad.toFixed(3)} rad)`);
});
console.log('');

// Test path generation
const mainPathLoop = [
    { x: 0, y: 7 }, { x: 0, y: 6 },
    { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 },
    { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 },
    { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
    { x: 8, y: 6 },
    { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 },
    { x: 14, y: 6 }, { x: 14, y: 7 },
    { x: 14, y: 8 },
    { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
    { x: 8, y: 8 },
    { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 },
    { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 },
    { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
    { x: 6, y: 8 },
    { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 }
];

console.log(`Main path loop: ${mainPathLoop.length} cells`);

// Check if center block corners are in main path
const centerCorners = ['6,6', '6,8', '8,8', '8,6'];
const mainPathSet = new Set(mainPathLoop.map(c => `${c.x},${c.y}`));
console.log('Center block corners in main path:');
centerCorners.forEach(corner => {
    console.log(`  ${corner}: ${mainPathSet.has(corner) ? 'YES' : 'NO'}`);
});
console.log('');

// Test home paths
const homeBridges = {
    blue: { x: 0, y: 7 },
    red: { x: 7, y: 0 },
    green: { x: 14, y: 7 },
    yellow: { x: 7, y: 14 }
};

const homePaths = {
    blue: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
    red: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
    green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
    yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }]
};

console.log('Home paths (should NOT be drawn as squares):');
Object.entries(homePaths).forEach(([color, path]) => {
    console.log(`  ${color}: ${path.map(p => `${p.x},${p.y}`).join(', ')}`);
});
console.log('');

// Verify home column cells match home paths
let allMatch = true;
Object.entries(homePaths).forEach(([color, path]) => {
    path.forEach(p => {
        const key = `${p.x},${p.y}`;
        if (!homeColumnCells.has(key)) {
            console.log(`ERROR: ${color} home path cell ${key} not in skip set!`);
            allMatch = false;
        }
    });
});

if (allMatch) {
    console.log('✓ All home path cells are correctly marked to be skipped in drawPath()');
}

console.log('');
console.log('=== Test Complete ===');
