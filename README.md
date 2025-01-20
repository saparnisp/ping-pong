# Multiplayer Tetris

Real-time multiplayer Tetris game built with Node.js, Express, and Socket.IO.

## Features

- Real-time multiplayer gameplay
- Player queue system
- High scores tracking
- Mobile-friendly controls
- Dynamic speed progression
- Multiple difficulty levels
- Real-time game state synchronization

## Game Mechanics

- Starting speed: 500ms (0.5 seconds)
- 10 difficulty levels
- Speed increases with each level
- Level up every 10 cleared lines
- Maximum level: 10 (50ms drop speed)

## Technical Stack

- Backend: Node.js + Express
- Real-time communication: Socket.IO
- Frontend: Pure JavaScript, HTML5, CSS3
- Deployment: Render.com

## Multiple Repository Updates

### Push Updates to All Repositorie

The project includes a script for managing multiple repository updates:

`push-updates.sh` - Use this to push changes to all repositories:
```bash
# First commit your changes
git add .
git commit -m "Your commit message"

# Then push to all repositories
./push-updates.sh
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/saparnisp/tetris-one.git
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open in browser:
- Local development: http://localhost:3019
- Production: https://tetris-one.onrender.com

## Development

Run with hot-reload:
```bash
npm run dev
```

## Controls

- ← : Move Left
- → : Move Right
- ↓ : Soft Drop
- ↑ : Rotate
- Space : Hard Drop

## Deployments

The game is automatically deployed to multiple instances on Render.com when changes are pushed to the main branch.

Live versions:
- https://tetris-1.onrender.com
- https://tetris-2.onrender.com
- https://tetris-3.onrender.com
- https://tetris-4.onrender.com
- https://tetris-5.onrender.com
- https://tetris-6.onrender.com
- https://tetris-7.onrender.com
- https://tetris-8.onrender.com
- https://tetris-9.onrender.com

Each instance runs independently and can be used for different purposes or load balancing.

## License

MIT License
