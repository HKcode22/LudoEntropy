# Ludo Star Interface Guide

## 🎮 Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Blue]              [Exit ✕]              [Red (You)] │
│   👤                                            👤      │
│   🎲                                            🎲      │
│  Player 4                                       You     │
│                                                         │
│              ┌─────────────────────┐                   │
│              │                     │                   │
│              │                     │                   │
│              │    LUDO BOARD       │                   │
│              │    (Game Canvas)    │                   │
│              │                     │                   │
│              │                     │                   │
│              └─────────────────────┘                   │
│                                                         │
│  [Yellow]                                    [Green]    │
│   👤                                            👤      │
│   🎲                                            🎲      │
│  Player 3                                   Player 2    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Player Positions

### Top-Left Corner: Blue Player
- Position: Grid row 1, column 1
- Avatar: Blue circle with white border
- Dice: Below avatar
- Name: "Player 4" (default)

### Top-Right Corner: Red Player (You)
- Position: Grid row 1, column 3
- Avatar: Red circle with white border
- Dice: Below avatar
- Name: "You" (default)
- **This is your player in Quick Play mode**

### Bottom-Left Corner: Yellow Player
- Position: Grid row 3, column 1
- Avatar: Yellow circle with white border
- Dice: Below avatar
- Name: "Player 3" (default)

### Bottom-Right Corner: Green Player
- Position: Grid row 3, column 3
- Avatar: Green circle with white border
- Dice: Below avatar
- Name: "Player 2" (default)

## 🎲 Dice System

### Individual Dice
- Each player has their own dice
- All 4 dice are visible at all times
- Dice show dots (1-6) in a 3x3 grid pattern

### Dice Interactions
- **Your Turn**: Your avatar glows golden, click your dice to roll
- **Other Players**: Watch their dice update automatically
- **Rolling Animation**: Dice rotates when rolling
- **Hover Effect**: Dice scales up slightly when you hover

### Dice Dot Patterns
```
1: Center dot
2: Top-left, bottom-right
3: Top-left, center, bottom-right
4: All corners
5: All corners + center
6: All corners + middle left/right
```

## 🎨 Visual Indicators

### Active Player
- **Golden Border**: Avatar gets a golden glow (#FFD700)
- **Shadow Effect**: Glowing shadow around avatar
- **Your Turn**: Only your dice is clickable

### Player Colors
- **Red**: #E74C3C (Bright red)
- **Green**: #2ECC71 (Emerald green)
- **Yellow**: #F39C12 (Orange-yellow)
- **Blue**: #3498DB (Sky blue)

### Board Elements
- **Background**: Purple gradient
- **Board Border**: Brown wooden texture
- **Canvas**: White with rounded corners
- **Pieces**: Colored circles with shadows

## 📱 Screen Sizes

### Large Screens (>1200px)
- Game area: 900x900px
- Player zones: 150px
- Avatar: 70px diameter
- Dice: 50px square
- Font: 16px

### Medium Screens (≤1200px)
- Game area: 750x750px
- Player zones: 120px
- Avatar: 60px diameter
- Dice: 45px square
- Font: 14px

### Responsive Scaling
- Uses `min()` CSS function
- Maintains square aspect ratio
- Adapts to viewport size
- Optimized for MacBook 13" and 15"

## 🎮 Gameplay Flow

### 1. Game Start
```
All players visible → Red avatar glows → Click red dice
```

### 2. Your Turn
```
Click dice → Dice rolls → Shows number → Click piece → Piece moves
```

### 3. Other Players' Turns
```
Their avatar glows → Their dice rolls → Piece moves automatically
```

### 4. Turn Rotation
```
Red → Green → Yellow → Blue → Red (repeat)
```

## 🔧 Interactive Elements

### Clickable
- ✅ Your dice (when it's your turn)
- ✅ Highlighted pieces (golden ring)
- ✅ Exit button (top-right)

### Non-Clickable
- ❌ Other players' dice
- ❌ Other players' pieces
- ❌ Board background
- ❌ Player avatars

## 💡 Tips

1. **Watch All Dice**: You can see what everyone rolled
2. **Golden Glow**: Always shows whose turn it is
3. **Click Your Dice**: No separate "Roll" button needed
4. **Piece Highlights**: Golden rings show which pieces can move
5. **Exit Anytime**: Red X button in top-right corner

## 🎯 Quick Reference

| Element | Location | Purpose |
|---------|----------|---------|
| Blue Player | Top-Left | Player 4 info |
| Red Player | Top-Right | You (Player 1) |
| Yellow Player | Bottom-Left | Player 3 info |
| Green Player | Bottom-Right | Player 2 info |
| Game Board | Center | Main gameplay area |
| Exit Button | Top-Right | Leave game |
| Active Glow | Current player | Shows turn |
| Dice | Under avatars | Roll to play |

Enjoy the game! 🎲
