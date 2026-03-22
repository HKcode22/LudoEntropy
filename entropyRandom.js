class EntropyPool {
    constructor() {
        this.buffer = new Uint32Array(4);
        this.sampleCount = 0;
    }

    addSample({ x = 0, y = 0, t = 0, pressure = 0, vx = 0, vy = 0, duration = 0, turnElapsedMs = 0 }) {
        // Create a 32-bit mix from the inputs
        const mix = (
            (Math.floor(x) & 0xFFFF) ^
            ((Math.floor(y) & 0xFFFF) << 16) ^
            (Math.floor(t) & 0xFFFFFFFF) ^
            ((Math.floor(pressure * 1000) & 0xFFFF) << 8) ^
            (Math.floor(Math.abs(vx)) & 0xFFFF) ^
            ((Math.floor(Math.abs(vy)) & 0xFFFF) << 16) ^
            ((Math.floor(duration) & 0xFFFF) << 24) ^
            ((Math.floor(turnElapsedMs) & 0xFFFF) << 20)
        ) >>> 0;

        // Mix it into our 4-word buffer using a simple permutation
        for (let i = 0; i < this.buffer.length; i++) {
            this.buffer[i] ^= ((mix << i) | (mix >>> (32 - i))) >>> 0;
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
        // Use crypto-grade randomness as the base
        const bytes = new Uint32Array(1);
        window.crypto.getRandomValues(bytes);
        
        // Incorporate our harvested entropy pool
        const snap = this.pool.getSnapshot();
        const poolMix = snap.b0 ^ snap.b1 ^ snap.b2 ^ snap.b3;
        
        // Combine the two sources
        const combined = (bytes[0] ^ poolMix) >>> 0;
        
        // Simple modulo (with sides = 6, bias is negligible for gameplay, 
        // but we can use rejection sampling if we want true uniformity)
        // Let's use simple modulo for the die roll since 2^32 is very large compared to 6
        return (combined % sides) + 1;
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
