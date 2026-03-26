// Automated Ludo Game Testing and Fixing Script
// This will test the game positioning and apply fixes automatically

class LudoTester {
    constructor() {
        this.testResults = [];
        this.fixesApplied = [];
    }

    async runFullTest() {
        console.log('🧪 Starting automated Ludo game testing...');
        
        // Wait for game to load
        await this.waitForGame();
        
        // Test 1: Check if game object exists
        this.testGameExists();
        
        // Test 2: Check player elements
        this.testPlayerElements();
        
        // Test 3: Test positioning for each color
        await this.testAllColors();
        
        // Test 4: Check dice functionality
        this.testDiceFunctionality();
        
        // Generate report
        this.generateReport();
    }

    waitForGame() {
        return new Promise((resolve) => {
            const checkGame = () => {
                if (typeof window.game !== 'undefined' && window.game.myColor) {
                    resolve();
                } else {
                    setTimeout(checkGame, 100);
                }
            };
            checkGame();
        });
    }

    testGameExists() {
        const gameExists = typeof window.game !== 'undefined';
        this.testResults.push({
            test: 'Game Object Exists',
            passed: gameExists,
            details: gameExists ? '✅ Game found' : '❌ Game not found'
        });
    }

    testPlayerElements() {
        const colors = ['red', 'green', 'yellow', 'blue'];
        let allFound = true;
        
        colors.forEach(color => {
            const element = document.querySelector(`[data-color="${color}"]`);
            if (!element) {
                allFound = false;
                console.log(`❌ Player element not found: ${color}`);
            }
        });
        
        this.testResults.push({
            test: 'Player Elements Found',
            passed: allFound,
            details: allFound ? '✅ All player elements found' : '❌ Some player elements missing'
        });
    }

    async testAllColors() {
        const colors = ['red', 'green', 'yellow', 'blue'];
        
        for (const color of colors) {
            console.log(`🎨 Testing color: ${color}`);
            
            // Set player color
            window.game.myColor = color;
            
            // Call positionPlayersByPov
            window.game.positionPlayersByPov();
            
            // Wait a bit for DOM updates
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check positioning
            const element = document.querySelector(`[data-color="${color}"]`);
            const hasBottomLeft = element.classList.contains('player-bottom-left');
            
            this.testResults.push({
                test: `Positioning for ${color}`,
                passed: hasBottomLeft,
                details: hasBottomLeft ? `✅ ${color} positioned at bottom-left` : `❌ ${color} not at bottom-left`
            });
        }
    }

    testDiceFunctionality() {
        const colors = ['red', 'green', 'yellow', 'blue'];
        let allClickable = true;
        
        colors.forEach(color => {
            const diceId = `dice${color.charAt(0).toUpperCase() + color.slice(1)}`;
            const dice = document.getElementById(diceId);
            
            if (!dice || dice.disabled) {
                allClickable = false;
                console.log(`❌ Dice not clickable: ${color}`);
            }
        });
        
        this.testResults.push({
            test: 'Dice Clickability',
            passed: allClickable,
            details: allClickable ? '✅ All dice clickable' : '❌ Some dice not clickable'
        });
    }

    generateReport() {
        console.log('\n📊 TEST REPORT:');
        console.log('================');
        
        this.testResults.forEach(result => {
            console.log(`${result.details}`);
        });
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            console.log('🎉 All tests passed! Game is working correctly.');
        } else {
            console.log('🔧 Some tests failed. Applying fixes...');
            this.applyFixes();
        }
    }

    applyFixes() {
        // Fix 1: Ensure proper CSS grid placement
        this.fixGridPlacement();
        
        // Fix 2: Force positioning with inline styles
        this.fixInlinePositioning();
        
        // Fix 3: Override conflicting CSS
        this.fixConflictingCSS();
        
        console.log('✅ Fixes applied. Re-running tests...');
        setTimeout(() => this.runFullTest(), 1000);
    }

    fixGridPlacement() {
        const style = document.createElement('style');
        style.textContent = `
            .mobile-ludo-shell .players-frame-top {
                grid-row: 2 !important;
                display: block !important;
            }
            .mobile-ludo-shell .board-wrapper {
                grid-row: 3 !important;
            }
            .mobile-ludo-shell .players-frame-bottom {
                grid-row: 4 !important;
                display: block !important;
            }
        `;
        document.head.appendChild(style);
        this.fixesApplied.push('Grid placement fixed');
    }

    fixInlinePositioning() {
        const colors = ['red', 'green', 'yellow', 'blue'];
        
        colors.forEach(color => {
            const element = document.querySelector(`[data-color="${color}"]`);
            if (element) {
                element.style.position = 'absolute';
                element.style.zIndex = '10';
            }
        });
        this.fixesApplied.push('Inline positioning applied');
    }

    fixConflictingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .player-corner {
                position: absolute !important;
                display: flex !important;
            }
            .players-frame {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        this.fixesApplied.push('Conflicting CSS overridden');
    }
}

// Auto-start the test
console.log('🚀 Auto-testing Ludo game positioning...');
const tester = new LudoTester();

// Start testing when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tester.runFullTest());
} else {
    tester.runFullTest();
}
