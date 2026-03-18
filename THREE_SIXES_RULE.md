# Fixed: Yellow/Blue Positions + Three 6s Rule

## ✅ Issues Fixed

### 1. Yellow and Blue Home Positions Swapped
**Problem**: Yellow home was at bottom-right, Blue home was at bottom-left
**Solution**: Swapped their positions to match the board correctly

### 2. Game Stops After Rolling a 6
**Problem**: After rolling a 6 and moving, the game would stop
**Solution**: Implemented proper "roll again after 6" logic

### 3. Three Consecutive 6s Rule
**Problem**: No limit on consecutive 6s
**Solution**: Implemented classic Ludo rule - three 6s in a row voids the turn

---

## 🎨 Corrected Board Layout

```
     RED (AI)              GREEN (AI)
    Player 2               Player 3
      🔴                      🟢
      🎲                      🎲
   [RED HOME]             [GREEN HOME]
   Top-Left               Top-Right


           [GAME BOARD]


  YELLOW (YOU!)            BLUE (AI)
      You                  Player 4
      🟡                      🔵
      🎲                      🎲
  [YELLOW HOME]          [BLUE HOME]
  Bottom-Left            Bottom-Right
```

### Color Alignment ✅
| Position | Color | Home Area | Matches |
|----------|-------|-----------|---------|
| Top-Left | Red | Red (Top-Left) | ✅ |
| Top-Right | Green | Green (Top-Right) | ✅ |
| Bottom-Left | Yellow | Yellow (Bottom-Left) | ✅ |
| Bottom-Right | Blue | Blue (Bottom-Right) | ✅ |

**Perfect!** All colors now match their board positions.

---

## 🎲 Three 6s Rule Implementation

### How It Works:

1. **First 6**: Roll a 6 → Move piece → Roll again
2. **Second 6**: Roll another 6 → Move piece → Roll again
3. **Third 6**: Roll a third 6 → **TURN VOID!** → Next player's turn

### Examples:

#### Example 1: Two 6s, then different number
```
Turn 1: Roll 6 → Move piece → Roll again
Turn 2: Roll 6 → Move piece → Roll again  
Turn 3: Roll 4 → Move piece → Next player
✅ Valid - Only 2 consecutive 6s
```

#### Example 2: Three 6s in a row
```
Turn 1: Roll 6 → Move piece → Roll again
Turn 2: Roll 6 → Move piece → Roll again
Turn 3: Roll 6 → ❌ VOID! All moves cancelled → Next player
⚠️ Turn voided - Three consecutive 6s
```

#### Example 3: 6, then non-6, then 6 again
```
Turn 1: Roll 6 → Move piece → Roll again
Turn 2: Roll 3 → Move piece → Next player
(Next time it's your turn)
Turn 3: Roll 6 → Move piece → Roll again
✅ Valid - Counter resets after non-6
```

---

## 🔄 Turn Order (Clockwise)

1. **Yellow (You)** - Bottom-left - **YOU START!** ⭐
2. **Red (AI)** - Top-left
3. **Green (AI)** - Top-right
4. **Blue (AI)** - Bottom-right
5. Back to Yellow...

---

## 🎮 Gameplay Flow

### Rolling a 6:
1. **Roll dice** → Get a 6
2. **Click piece** → Move it
3. **Automatic** → Your turn continues (avatar stays golden)
4. **Roll again** → Click dice again
5. **Repeat** → Keep going as long as you roll 6s (max 2 in a row)

### Three 6s:
1. **First 6** → Move piece → Roll again ✅
2. **Second 6** → Move piece → Roll again ✅
3. **Third 6** → Alert: "Three 6s in a row! Your turn is void." ❌
4. **All moves cancelled** → Turn passes to next player

### Counter Reset:
- Counter resets when you roll anything other than 6
- Counter resets when turn changes to another player
- Counter resets at start of each player's turn

---

## 💻 Technical Changes

### Code Updates:

1. **Added `consecutiveSixes` tracker**:
   ```javascript
   this.consecutiveSixes = 0;
   ```

2. **Swapped Yellow/Blue positions**:
   - Home positions swapped
   - Starting positions swapped (39 ↔ 26)
   - Home paths swapped

3. **Updated `rollDice()` function**:
   - Tracks consecutive 6s
   - Voids turn on third 6
   - Resets counter on non-6

4. **Updated `selectAndMovePiece()` function**:
   - Keeps turn active after 6
   - Resets counter on non-6

5. **Updated `nextPlayer()` function**:
   - Resets counter when changing players

6. **Updated `simulateAITurn()` function**:
   - AI also follows three 6s rule
   - AI automatically rolls again after 6

---

## ✨ Features

✅ **Yellow at bottom-left** - Matches yellow home area
✅ **Blue at bottom-right** - Matches blue home area
✅ **Roll again after 6** - Automatic turn continuation
✅ **Three 6s rule** - Classic Ludo rule implemented
✅ **Counter tracking** - Keeps track of consecutive 6s
✅ **Alert on void** - Clear message when turn is voided
✅ **AI follows rules** - AI also subject to three 6s rule

---

## 🎯 Testing Checklist

- [ ] Open `index.html`
- [ ] Click "Quick Play"
- [ ] Yellow avatar (bottom-left) glows - YOU start
- [ ] Yellow pieces in bottom-left home area ✅
- [ ] Blue pieces in bottom-right home area ✅
- [ ] Roll a 6
- [ ] Move a yellow piece
- [ ] Avatar stays golden (roll again)
- [ ] Roll another 6
- [ ] Move piece again
- [ ] Avatar stays golden (roll again)
- [ ] Roll a third 6
- [ ] Alert: "Three 6s in a row! Your turn is void."
- [ ] Turn moves to Red player (top-left)

---

## 🎲 Quick Reference

**Your Color**: Yellow (🟡)
**Your Position**: Bottom-left
**Your Home**: Bottom-left area on board ✅
**Max Consecutive 6s**: 2 (third voids turn)
**Turn Order**: Yellow → Red → Green → Blue

---

## 📝 Game Rules Summary

1. ✅ Roll a 6 to bring pieces out
2. ✅ Roll again after getting a 6
3. ✅ Can roll again after second 6
4. ❌ Third 6 voids entire turn
5. ✅ Counter resets on non-6
6. ✅ Counter resets on player change
7. ✅ Capture opponents (except safe spots)
8. ✅ Exact roll to enter home
9. ✅ First to get all 4 pieces home wins

**Enjoy the corrected game with proper three 6s rule!** 🎲🎉
