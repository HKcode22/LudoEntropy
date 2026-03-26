class EntropyPool {
    constructor() {
        this.buffer = new Uint32Array(4);
        this.sampleCount = 0;
    }

    addSample({ x = 0, y = 0, t = 0, pressure = 0, vx = 0, vy = 0, duration = 0, turnElapsedMs = 0 }) {
        // Enhanced entropy mixing with better distribution
        const timestamp = Date.now();
        const perfNow = typeof performance !== 'undefined' ? performance.now() : 0;
        
        // Create multiple 32-bit mixes from different aspects of the input
        const mix1 = (
            (Math.floor(x) & 0xFFFF) ^
            ((Math.floor(y) & 0xFFFF) << 16) ^
            (Math.floor(t) & 0xFFFFFFFF)
        ) >>> 0;
        
        const mix2 = (
            ((Math.floor(pressure * 10000) & 0xFFFF) << 8) ^
            (Math.floor(Math.abs(vx) * 100) & 0xFFFF) ^
            ((Math.floor(Math.abs(vy) * 100) & 0xFFFF) << 16)
        ) >>> 0;
        
        const mix3 = (
            ((Math.floor(duration) & 0xFFFF) << 24) ^
            ((Math.floor(turnElapsedMs) & 0xFFFF) << 20) ^
            (timestamp & 0xFFFFFFFF)
        ) >>> 0;
        
        const mix4 = (
            ((Math.floor(perfNow * 1000) & 0xFFFF) << 12) ^
            (this.sampleCount & 0xFFFFFFFF)
        ) >>> 0;

        // Enhanced mixing using a simple but effective hash function
        const mixes = [mix1, mix2, mix3, mix4];
        for (let i = 0; i < this.buffer.length; i++) {
            const mix = mixes[i % mixes.length];
            // Use a better mixing function inspired by MurmurHash
            let hash = mix ^ this.buffer[i];
            hash = ((hash >>> 16) ^ hash) * 0x85ebca6b;
            hash = ((hash >>> 13) ^ hash) * 0xc2b2ae35;
            hash = (hash >>> 16) ^ hash;
            this.buffer[i] = hash >>> 0;
        }
        this.sampleCount++;
    }

    getSnapshot() {
        return {
            b0: this.buffer[0],
            b1: this.buffer[1],
            b2: this.buffer[2],
            b3: this.buffer[3],
            samples: this.sampleCount
        };
    }
}

class SecureRandom {
    constructor(pool) {
        this.pool = pool;
    }

    rollDie(sides = 6) {
        // Use crypto-grade randomness as base
        const bytes = new Uint32Array(1);
        window.crypto.getRandomValues(bytes);
        
        // Incorporate our harvested entropy pool
        const snap = this.pool.getSnapshot();
        const poolMix = snap.b0 ^ snap.b1 ^ snap.b2 ^ snap.b3;
        
        // Combine two sources
        const combined = (bytes[0] ^ poolMix) >>> 0;
        
        // Use rejection sampling for true uniformity
        // This ensures no bias for any number of sides
        const max = 0xFFFFFFFF;
        const limit = max - (max % sides);
        
        let result = combined;
        while (result >= limit) {
            window.crypto.getRandomValues(bytes);
            result = (bytes[0] ^ poolMix) >>> 0;
        }
        
        return (result % sides) + 1;
    }
}

// Initialize global instances
window.ludoEntropyPool = new EntropyPool();
window.ludoRng = new SecureRandom(window.ludoEntropyPool);

// Quick sanity-check for the dice CSPRNG mixing (manual console use).
// Example: window.ludoRng.debugRolls(100)
window.ludoRng.debugRolls = (count = 60) => {
    const counts = [0, 0, 0, 0, 0, 0]; // index 0 => face 1
    const rolls = [];
    for (let i = 0; i < count; i++) {
        const d = window.ludoRng.rollDie(6);
        counts[d - 1]++;
        rolls.push(d);
    }
    const snap = window.ludoEntropyPool.getSnapshot();
    console.log('[ludoRng.debugRolls]', { count, counts, poolSamples: snap.samples, sampleBuffer: snap });
    return { count, counts, rolls };
};
