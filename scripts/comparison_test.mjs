import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = '/Users/hk/Downloads/ludo';
const FRONTEND_PORT = 8081;

const VIEWPORT_W = 1024;
const VIEWPORT_H = 768;

const SCREEN_DIR = path.join(REPO_ROOT, 'tmp_comparison');
fs.mkdirSync(SCREEN_DIR, { recursive: true });

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function testImplementation(label, indexFile, gameFile, povColor) {
    console.log(`\n=== Testing ${label} ===`);
    
    const frontendProc = spawn('npx', ['serve', '-l', String(FRONTEND_PORT), '.'], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
    });

    try {
        // Wait for server
        await sleep(3000);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({
            viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
            deviceScaleFactor: 1,
        });

        const url = `http://localhost:${FRONTEND_PORT}/${indexFile}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await sleep(500);

        // Quick play
        await page.click('#quickPlayBtn');
        await page.waitForSelector('#game-screen.active', { timeout: 15000 });
        await sleep(1000);

        // Take initial screenshot
        const canvasHandle = await page.$('#gameCanvas');
        if (!canvasHandle) {
            console.error('Canvas not found!');
            await browser.close();
            frontendProc.kill('SIGTERM');
            return null;
        }

        const canvasBox = await canvasHandle.boundingBox();
        const vp = page.viewportSize();
        const clipX = Math.max(0, canvasBox.x);
        const clipY = Math.max(0, canvasBox.y);
        const clipW = Math.max(0, Math.min(canvasBox.width, vp.width - clipX));
        const clipH = Math.max(0, Math.min(canvasBox.height, vp.height - clipY));

        const canvasClip = { x: clipX, y: clipY, width: clipW, height: clipH };
        
        // Take initial screenshot
        const initialFile = path.join(SCREEN_DIR, `${label}_initial.png`);
        await page.screenshot({
            path: initialFile,
            clip: canvasClip,
        });

        // Click dice to roll
        const diceId = `dice${povColor.charAt(0).toUpperCase() + povColor.slice(1)}`;
        await page.click(`#${diceId}`, { force: true });
        await sleep(1500);

        // Take roll screenshot
        const rollFile = path.join(SCREEN_DIR, `${label}_after_roll.png`);
        await page.screenshot({
            path: rollFile,
            clip: canvasClip,
        });

        // Get debug info if available
        const debugInfo = await page.evaluate(() => {
            if (window.game) {
                return {
                    myColor: window.game.myColor,
                    currentPlayer: window.game.players[window.game.currentPlayerIndex]?.color,
                    currentRolls: window.game.currentRolls,
                    diceValue: window.game.diceValue,
                    hasRolled: window.game.hasRolled,
                    canMove: window.game.canMove,
                    movablePieces: window.game.movablePieces,
                    pieces: window.game.pieces[window.game.myColor]?.map(p => ({
                        id: p.id,
                        inHome: p.inHome,
                        inGoal: p.inGoal,
                        position: p.position
                    }))
                };
            }
            return null;
        });

        console.log(`${label} debug info:`, JSON.stringify(debugInfo, null, 2));

        // Try to move first movable piece
        if (debugInfo && debugInfo.canMove && debugInfo.movablePieces && debugInfo.movablePieces.length > 0) {
            const pieceIndex = debugInfo.movablePieces[0];
            console.log(`${label}: Moving piece ${pieceIndex}`);
            
            // Click on canvas to move (simplified - would need proper coordinate calculation)
            await page.click('#gameCanvas', { force: true });
            await sleep(1500);

            const moveFile = path.join(SCREEN_DIR, `${label}_after_move.png`);
            await page.screenshot({
                path: moveFile,
                clip: canvasClip,
            });

            // Get position after move
            const afterMoveInfo = await page.evaluate(() => {
                if (window.game) {
                    return {
                        currentRolls: window.game.currentRolls,
                        pieces: window.game.pieces[window.game.myColor]?.map(p => ({
                            id: p.id,
                            inHome: p.inHome,
                            inGoal: p.inGoal,
                            position: p.position
                        }))
                    };
                }
                return null;
            });

            console.log(`${label} after move:`, JSON.stringify(afterMoveInfo, null, 2));
        }

        await browser.close();
        frontendProc.kill('SIGTERM');
        
        return {
            initial: initialFile,
            roll: rollFile,
            debugInfo
        };

    } catch (err) {
        console.error(`${label} error:`, err.message);
        frontendProc.kill('SIGTERM');
        return null;
    }
}

async function main() {
    console.log('Starting Ludo Implementation Comparison Test\n');

    // Test your implementation (game.js)
    const yourResult = await testImplementation('yours', 'index.html', 'game.js', 'blue');
    
    await sleep(2000);

    // Test Haris's implementation (game2.js)
    const harisResult = await testImplementation('haris', 'index2.html', 'game2.js', 'blue');

    console.log('\n=== Comparison Summary ===');
    console.log('Your implementation:', yourResult ? '✓ Tested' : '✗ Failed');
    console.log('Haris implementation:', harisResult ? '✓ Tested' : '✗ Failed');

    if (yourResult && harisResult) {
        console.log('\nScreenshots saved to:', SCREEN_DIR);
        console.log('\nKey differences to check:');
        console.log('1. Center triangle rendering (should have no square outlines)');
        console.log('2. Piece movement accuracy (should land on correct tiles)');
        console.log('3. Dice roll behavior (should show only one roll at a time)');
        console.log('4. Home column path (should have 5 colored squares, no extra tiles)');
    }
}

main().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
