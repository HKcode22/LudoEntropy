# Troubleshooting Guide

## Issues Fixed

### Problem 1: Dice Only Rolling Once
**Issue**: Dice could only be rolled once and always showed 1.
**Cause**: Event listeners were being attached before the game screen elements existed.
**Fix**: Moved dice event listener setup to `startGame()` function after screen is shown.

### Problem 2: AI Players Not Playing
**Issue**: AI players weren't taking their turns automatically.
**Cause**: Missing null checks and timing issues in `simulateAITurn()`.
**Fix**: Added proper null checks and error handling.

### Problem 3: Duplicate Variable
**Issue**: `currentColor` was declared twice in `rollDice()` function.
**Fix**: Removed duplicate declaration.

## How to Test

1. **Open the game**: Open `index.html` in your browser
2. **Click Quick Play**: Should immediately start a 4-player game
3. **Check player display**: 
   - Red player (top-right) should have golden glow
   - All 4 player names should be visible
   - All 4 dice should show "1" initially
4. **Roll dice**: Click the red player's dice (top-right)
   - Dice should animate
   - Should show random number 1-6
   - If you roll 6, you can click a piece in red home area
5. **Wait for AI**: After your turn, green player should automatically:
   - Get golden glow
   - Roll their dice
   - Move a piece (if they rolled 6)
6. **Continue**: Game should cycle through all 4 players

## Debug Console

Open browser console (F12) to see any errors. You should see:
- No errors
- Players taking turns automatically
- Dice rolling with random values

## Common Issues

### Dice Not Clickable
- **Check**: Is it your turn? (Red avatar should glow)
- **Check**: Are you clicking the correct dice? (Top-right for red player)
- **Fix**: Refresh the page and try again

### AI Not Moving
- **Check**: Browser console for errors
- **Check**: Did the AI roll a 6? (Need 6 to bring pieces out)
- **Wait**: AI has delays between actions (1.5 seconds)

### Pieces Not Highlighting
- **Check**: Did you roll the dice first?
- **Check**: Do you have valid moves? (Need 6 to bring pieces out initially)
- **Check**: Are pieces glowing golden? That means they're movable

### Game Stuck
- **Solution**: Refresh the page and click Quick Play again
- **Check**: Browser console for errors
- **Report**: If issue persists, check console errors

## Testing Checklist

- [ ] Quick Play button works
- [ ] Game screen shows with 4 players
- [ ] Red player (you) has golden glow initially
- [ ] Can click red dice to roll
- [ ] Dice shows random number (not always 1)
- [ ] Can roll multiple times
- [ ] Green player takes turn automatically after red
- [ ] Yellow player takes turn after green
- [ ] Blue player takes turn after yellow
- [ ] Turn cycles back to red
- [ ] When rolling 6, pieces in home glow golden
- [ ] Clicking golden pieces moves them
- [ ] AI players roll and move automatically

## Performance

- Game should run smoothly at 60fps
- No lag when rolling dice
- Smooth piece movements
- Quick AI response times

## Browser Compatibility

Tested on:
- Chrome/Edge (Recommended)
- Firefox
- Safari

If issues persist, try:
1. Clear browser cache
2. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Try a different browser
4. Check browser console for specific errors
