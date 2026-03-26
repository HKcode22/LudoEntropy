// Simple game simulation test
console.log('🎮 Starting Ludo Game Test...');

// Test 1: Check if game object exists
if (typeof window.game !== 'undefined') {
    console.log('✅ Game object found');
    
    // Test 2: Check debug mode
    if (window.game.debugMode && window.game.debugMode.enabled) {
        console.log('✅ Debug mode is enabled');
    } else {
        console.log('❌ Debug mode is not enabled');
    }
    
    // Test 3: Check if all dice elements exist
    const diceColors = ['red', 'green', 'yellow', 'blue'];
    let allDiceExist = true;
    
    diceColors.forEach(color => {
        const diceId = `dice${color.charAt(0).toUpperCase() + color.slice(1)}`;
        const diceElement = document.getElementById(diceId);
        if (diceElement) {
            console.log(`✅ ${color} dice found: ${diceId}`);
        } else {
            console.log(`❌ ${color} dice missing: ${diceId}`);
            allDiceExist = false;
        }
    });
    
    // Test 4: Check player positioning
    const playerPositions = {
        blue: 'top-left',
        red: 'top-right',
        yellow: 'bottom-left',
        green: 'bottom-right'
    };
    
    Object.entries(playerPositions).forEach(([color, expectedPosition]) => {
        const playerElement = document.querySelector(`[data-color="${color}"]`);
        if (playerElement) {
            const actualPosition = Array.from(playerElement.classList).find(c => c.startsWith('player-'));
            console.log(`📍 ${color} player: ${actualPosition || 'no position class'}`);
        } else {
            console.log(`❌ ${color} player element not found`);
        }
    });
    
    // Test 5: Simulate dice clicks
    console.log('🎲 Testing dice clicks...');
    diceColors.forEach(color => {
        const diceId = `dice${color.charAt(0).toUpperCase() + color.slice(1)}`;
        const diceElement = document.getElementById(diceId);
        if (diceElement) {
            console.log(`🖱️ Clicking ${color} dice...`);
            diceElement.click();
        }
    });
    
    console.log('🏁 Game test completed!');
} else {
    console.log('❌ Game object not found. Make sure the game is loaded.');
}
