// Comprehensive Dice Randomness Test
// This script will test the entropy system and dice randomness

console.log('=== LUDO DICE RANDOMNESS ANALYSIS ===\n');

// Test 1: Local entropy pool randomness
console.log('1. Testing local entropy pool...');
const testRolls = 1000;
const distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};

if (typeof window !== 'undefined' && window.ludoRng) {
    const results = window.ludoRng.debugRolls(testRolls);
    console.log('Distribution:', results.counts);
    
    // Chi-square test for randomness
    const expected = testRolls / 6;
    let chiSquare = 0;
    for (let i = 1; i <= 6; i++) {
        const observed = results.counts[i-1];
        chiSquare += Math.pow(observed - expected, 2) / expected;
    }
    
    console.log(`Chi-square statistic: ${chiSquare.toFixed(2)}`);
    console.log(`Critical value (df=5, α=0.05): 11.07`);
    console.log(`Randomness test: ${chiSquare < 11.07 ? 'PASS' : 'FAIL'}`);
} else {
    console.log('Window/ludoRng not available - running in Node.js environment');
    
    // Node.js version of the test
    const crypto = require('crypto');
    
    function testNodeRandomness(rolls) {
        const counts = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < rolls; i++) {
            const bytes = crypto.randomBytes(4);
            const u32 = bytes.readUInt32BE(0) >>> 0;
            const die = (u32 % 6) + 1;
            counts[die - 1]++;
        }
        return counts;
    }
    
    const nodeResults = testNodeRandomness(testRolls);
    console.log('Node.js crypto distribution:', nodeResults);
    
    const expected = testRolls / 6;
    let chiSquare = 0;
    for (let i = 0; i < 6; i++) {
        chiSquare += Math.pow(nodeResults[i] - expected, 2) / expected;
    }
    
    console.log(`Chi-square statistic: ${chiSquare.toFixed(2)}`);
    console.log(`Critical value (df=5, α=0.05): 11.07`);
    console.log(`Randomness test: ${chiSquare < 11.07 ? 'PASS' : 'FAIL'}`);
}

console.log('\n2. Testing backend server randomness...');

// Test backend server
async function testBackendRandomness() {
    try {
        const response = await fetch('http://localhost:5178/api/roll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sides: 6,
                color: 'test',
                entropyHex: '',
                meta: { timeMs: Date.now() }
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Backend roll successful:', data);
            console.log('Backend server: RESPONDING');
        } else {
            console.log('Backend server: ERROR -', response.status);
        }
    } catch (error) {
        console.log('Backend server: OFFLINE -', error.message);
    }
}

if (typeof fetch !== 'undefined') {
    testBackendRandomness();
} else {
    console.log('Fetch not available - backend test skipped');
}

console.log('\n3. Analyzing entropy sources...');

// Analyze entropy collection
if (typeof window !== 'undefined' && window.ludoEntropyPool) {
    const snapshot = window.ludoEntropyPool.getSnapshot();
    console.log('Entropy pool samples collected:', snapshot.samples);
    console.log('Pool buffer:', snapshot);
    
    // Test entropy mixing
    console.log('\n4. Testing entropy mixing...');
    const testSamples = [
        { x: 100, y: 200, t: Date.now(), pressure: 0.5, vx: 10, vy: -5, duration: 100, turnElapsedMs: 5000 },
        { x: 150, y: 250, t: Date.now() + 100, pressure: 0.7, vx: -10, vy: 5, duration: 150, turnElapsedMs: 5200 },
        { x: 200, y: 300, t: Date.now() + 200, pressure: 0.3, vx: 15, vy: -10, duration: 120, turnElapsedMs: 5400 }
    ];
    
    testSamples.forEach((sample, i) => {
        window.ludoEntropyPool.addSample(sample);
        const snap = window.ludoEntropyPool.getSnapshot();
        console.log(`After sample ${i + 1}:`, snap);
    });
} else {
    console.log('Entropy pool not available in this environment');
}

console.log('\n=== ANALYSIS COMPLETE ===');
