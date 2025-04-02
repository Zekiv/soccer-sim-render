// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// --- Debug Logging Control ---
// Set to true to enable detailed server logs (check Render logs)
const DEBUG_LOG = false;
function logDebug(...args) {
    if (DEBUG_LOG) {
        console.log(...args);
    }
}

console.log("Starting server...");

// --- HTTP Server Setup ---
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/favicon.ico') {
         res.writeHead(204); // No Content for favicon
         res.end();
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });
console.log("WebSocket server attached to HTTP server.");

// --- Game Constants (Server-side) ---
const INITIAL_BETTING_WAIT_MINS = 0.5; // Minutes before first match
const REAL_MATCH_DURATION_MINS = 2; // Real-time minutes per match (both halves)
const BETWEEN_MATCH_BREAK_MINS = 0.5; // Minutes between matches (includes betting)
const HALF_TIME_BREAK_S = 15; // Seconds for halftime break

// --- Derived Constants ---
const INITIAL_BETTING_WAIT_MS = INITIAL_BETTING_WAIT_MINS * 60 * 1000;
const INGAME_MATCH_DURATION_MINS = 90;
const REAL_HALF_DURATION_MS = (REAL_MATCH_DURATION_MINS / 2) * 60 * 1000;
const HALF_TIME_BREAK_MS = HALF_TIME_BREAK_S * 1000;
const BETWEEN_MATCH_BREAK_MS = BETWEEN_MATCH_BREAK_MINS * 60 * 1000;
const UPDATES_PER_SECOND = 30;
const MILLISECONDS_PER_UPDATE = 1000 / UPDATES_PER_SECOND;
const GAME_SPEED_FACTOR = (INGAME_MATCH_DURATION_MINS * 60 * 1000) / (REAL_MATCH_DURATION_MINS * 60 * 1000);
const FIELD_WIDTH = 1050; const FIELD_HEIGHT = 680; const GOAL_WIDTH = 120; const GOAL_DEPTH = 20; const CENTER_CIRCLE_RADIUS = 91.5; const PLAYER_RADIUS = 10; const BALL_RADIUS = 5; const PLAYER_SPEED = 3.5; const BALL_MAX_SPEED = 15; const BALL_FRICTION = 0.985; const SHOT_POWER = 14; const PASS_POWER_FACTOR = 0.6; const KICK_RANGE = PLAYER_RADIUS + BALL_RADIUS + 5; const CONTROL_RANGE = PLAYER_RADIUS + BALL_RADIUS + 2;

// --- Team Data (Server-side) ---
const nationalTeams = [ /* ... Copy the full nationalTeams array here ... */
    { name: "Argentina", color: "#75AADB", rating: 92 }, { name: "France", color: "#003399", rating: 91 }, { name: "Brazil", color: "#FFDF00", rating: 90 }, { name: "England", color: "#FFFFFF", textColor: "#000000", rating: 89 }, { name: "Belgium", color: "#ED2939", rating: 88 }, { name: "Croatia", color: "#FF0000", rating: 87 }, { name: "Netherlands", color: "#FF6600", rating: 87 }, { name: "Italy", color: "#003399", rating: 86 }, { name: "Portugal", color: "#006600", rating: 86 }, { name: "Spain", color: "#FF0000", rating: 85 }, { name: "Morocco", color: "#006233", rating: 84 }, { name: "Switzerland", color: "#FF0000", rating: 84 }, { name: "USA", color: "#002868", rating: 83 }, { name: "Germany", color: "#000000", rating: 83 }, { name: "Mexico", color: "#006847", rating: 82 }, { name: "Uruguay", color: "#5CBFEB", rating: 82 }, { name: "Colombia", color: "#FCD116", rating: 81 }, { name: "Senegal", color: "#00853F", rating: 81 }, { name: "Denmark", color: "#C60C30", rating: 80 }, { name: "Japan", color: "#000080", rating: 80 }, { name: "Peru", color: "#D91023", rating: 79 }, { name: "Iran", color: "#239F40", rating: 79 }, { name: "Serbia", color: "#C6363C", rating: 78 }, { name: "Poland", color: "#DC143C", rating: 78 }, { name: "Sweden", color: "#006AA7", rating: 78 }, { name: "Ukraine", color: "#005BBB", rating: 77 }, { name: "South Korea", color: "#FFFFFF", textColor:"#000000", rating: 77 }, { name: "Chile", color: "#D52B1E", rating: 76 }, { name: "Tunisia", color: "#E70013", rating: 76 }, { name: "Costa Rica", color: "#002B7F", rating: 75 }, { name: "Australia", color: "#00843D", rating: 75 }, { name: "Nigeria", color: "#008751", rating: 75 }, { name: "Austria", color: "#ED2939", rating: 74 }, { name: "Hungary", color: "#436F4D", rating: 74 }, { name: "Russia", color: "#FFFFFF", textColor:"#000000", rating: 73 }, { name: "Czech Republic", color: "#D7141A", rating: 73 }, { name: "Egypt", color: "#C8102E", rating: 73 }, { name: "Algeria", color: "#006233", rating: 72 }, { name: "Scotland", color: "#0065BF", rating: 72 }, { name: "Norway", color: "#EF2B2D", rating: 72 }, { name: "Turkey", color: "#E30A17", rating: 71 }, { name: "Mali", color: "#14B53A", rating: 71 }, { name: "Paraguay", color: "#DA121A", rating: 70 }, { name: "Ivory Coast", color: "#FF8200", rating: 70 }, { name: "Republic of Ireland", color: "#169B62", rating: 70 }, { name: "Qatar", color: "#8A1538", rating: 69 }, { name: "Saudi Arabia", color: "#006C35", rating: 69 }, { name: "Greece", color: "#0D5EAF", rating: 69 }, { name: "Romania", color: "#002B7F", rating: 68 },
];
let availableTeams = [];
const sampleSquads = { /* ... Copy the sampleSquads object here ... */
    "Argentina": ["E Martinez", "L Martinez", "N Molina", "C Romero", "N Otamendi", "N Tagliafico", "R De Paul", "E Fernandez", "A Mac Allister", "L Messi", "J Alvarez"], "France": ["M Maignan", "D Upamecano", "I Konate", "T Hernandez", "J Kounde", "A Tchouameni", "A Rabiot", "A Griezmann", "K Mbappe", "O Giroud", "O Dembele"], "Brazil": ["Alisson B", "Marquinhos", "E Militao", "Danilo", "Alex Sandro", "Casemiro", "Lucas Paqueta", "Neymar Jr", "Vinicius Jr", "Rodrygo G", "Richarlison"], "England": ["J Pickford", "K Walker", "J Stones", "H Maguire", "L Shaw", "D Rice", "J Bellingham", "J Henderson", "B Saka", "H Kane", "P Foden"], "Portugal": ["D Costa", "Ruben Dias", "Pepe", "J Cancelo", "N Mendes", "J Palhinha", "B Fernandes", "B Silva", "R Leao", "C Ronaldo", "J Felix"],
     // Add more sample squads if needed for other teams
    "Belgium": ["T Courtois", "T Castagne", "W Faes", "J Vertonghen", "A Theate", "A Onana", "Y Tielemans", "K De Bruyne", "J Doku", "R Lukaku", "L Trossard"],
    "Croatia": ["D Livakovic", "J Stanisic", "J Sutalo", "J Gvardiol", "B Sosa", "M Brozovic", "L Modric", "M Kovacic", "M Pasalic", "A Kramaric", "I Perisic"],
    "Netherlands": ["B Verbruggen", "D Dumfries", "S de Vrij", "V van Dijk", "N Ake", "T Reijnders", "J Schouten", "X Simons", "C Gakpo", "M Depay", "S Bergwijn"],
    "Italy": ["G Donnarumma", "G Di Lorenzo", "A Bastoni", "R Calafiori", "F Dimarco", "Jorginho", "N Barella", "D Frattesi", "F Chiesa", "G Scamacca", "L Pellegrini"],
    "Spain": ["U Simon", "D Carvajal", "R Le Normand", "A Laporte", "M Cucurella", "Rodri", "Pedri", "F Ruiz", "L Yamal", "A Morata", "N Williams"],
    "Germany": ["M Neuer", "J Kimmich", "A Rüdiger", "J Tah", "M Mittelstädt", "R Andrich", "T Kroos", "J Musiala", "I Gündogan", "F Wirtz", "K Havertz"],
};

// --- Game State (Authoritative Server State) ---
let gameState = 'INITIALIZING'; // INITIALIZING, INITIAL_BETTING, PRE_MATCH, FIRST_HALF, HALF_TIME, SECOND_HALF, FULL_TIME, BETWEEN_GAMES
let serverGameTime = 0; // In-game seconds, managed by server
let halfStartTimeStamp = 0; // Server timestamp (Date.now()) when half started
let scoreA = 0;
let scoreB = 0;
let teamA = null;
let teamB = null;
let players = [];
let ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null };
let stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } };
let oddsA = 2.00;
let oddsB = 2.00;
let breakEndTime = 0; // Timestamp when the current break ends

let gameLogicInterval = null;
let breakTimerTimeout = null; // Store timeout ID for breaks
let clients = new Map(); // ws -> { id, nickname, balance, currentBet: { team, amount } }


// --- Utility Functions ---
function getPlayerInitials(name, index = 0) { if (typeof name !== 'string' || name.trim() === '') { return `P${index + 1}`; } const parts = name.trim().split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); } else if (parts.length === 1 && name.length > 0) { return name.substring(0, 2).toUpperCase(); } return `P${index + 1}`; }
function isColorDark(hexColor) { if (!hexColor || typeof hexColor !== 'string') return false; hexColor = hexColor.replace('#', ''); if (hexColor.length !== 6) return false; const r = parseInt(hexColor.substring(0, 2), 16); const g = parseInt(hexColor.substring(2, 4), 16); const b = parseInt(hexColor.substring(4, 6), 16); const brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness < 128; }
function distSq(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateOdds() { if (!teamA || !teamB) { oddsA = 2.00; oddsB = 2.00; return; } const ratingDiff = teamA.rating - teamB.rating; const baseProbA = 0.5 + (ratingDiff / 50); // Simple rating based probability oddsA = Math.max(1.1, 1 / (baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); oddsB = Math.max(1.1, 1 / (1 - baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); logDebug(`Generated Odds: ${teamA.name} (${teamA.rating}) ${oddsA} vs ${teamB.name} (${teamB.rating}) ${oddsB}`); }

function broadcast(data) {
    const message = JSON.stringify(data);
    // logDebug(`Broadcasting: ${message.substring(0, 150)}... (to ${wss.clients.size} clients)`);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, (err) => {
                if (err) { console.error("Broadcast send error:", err); }
            });
        }
    });
}
function sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify(data);
        // logDebug(`Sending to ${clients.get(ws)?.id}: ${message.substring(0, 150)}...`);
        ws.send(message, (err) => {
             if (err) { console.error(`Send error to ${clients.get(ws)?.id}:`, err); }
        });
    } else {
        logDebug(`Attempted to send to closed socket for ${clients.get(ws)?.id}`);
    }
}

// --- Player & Team Setup ---
function createPlayer(id, teamId, role, formationPos, teamColor, textColor, playerName, playerIndex) {
    const initials = getPlayerInitials(playerName, playerIndex);
    const finalTextColor = textColor || (isColorDark(teamColor) ? '#FFFFFF' : '#000000');
    return {
        id: `${teamId}-${id}`, team: teamId, role: role,
        name: playerName || `Player ${playerIndex + 1}`, initials: initials,
        x: formationPos.x, y: formationPos.y, vx: 0, vy: 0,
        baseX: formationPos.x, baseY: formationPos.y, // Store base position
        targetX: formationPos.x, targetY: formationPos.y, hasBall: false,
        kickCooldown: 0, state: 'IDLE', color: teamColor, textColor: finalTextColor
    };
}
const formation433 = (teamId) => { const sideMultiplier = teamId === 'A' ? 1 : -1; const xOffset = FIELD_WIDTH / 2; const yOffset = FIELD_HEIGHT / 2; const gkX = sideMultiplier * (-FIELD_WIDTH * 0.48); const defLineX = sideMultiplier * (-FIELD_WIDTH * 0.35); const midLineX = sideMultiplier * (-FIELD_WIDTH * 0.1); const fwdLineX = sideMultiplier * (FIELD_WIDTH * 0.25); const positions = [ { role: 'GK', x: gkX, y: 0 }, // GK { role: 'DEF', x: defLineX, y: -FIELD_HEIGHT * 0.3 }, // RB/LB { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: -FIELD_HEIGHT * 0.1 }, // CB { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: FIELD_HEIGHT * 0.1 }, // CB { role: 'DEF', x: defLineX, y: FIELD_HEIGHT * 0.3 }, // LB/RB { role: 'MID', x: midLineX, y: -FIELD_HEIGHT * 0.2 }, // RCM/LCM { role: 'MID', x: midLineX + sideMultiplier * (20), y: 0 }, // CM { role: 'MID', x: midLineX, y: FIELD_HEIGHT * 0.2 }, // LCM/RCM { role: 'FWD', x: fwdLineX, y: -FIELD_HEIGHT * 0.3 }, // RW/LW { role: 'FWD', x: fwdLineX + sideMultiplier * (30), y: 0 }, // ST { role: 'FWD', x: fwdLineX, y: FIELD_HEIGHT * 0.3 } // LW/RW ]; return positions.map(p => ({ ...p, x: xOffset + p.x, y: yOffset + p.y })); };
function setupTeams(teamDataA, teamDataB) {
    logDebug(`Setting up match: ${teamDataA.name} vs ${teamDataB.name}`);
    teamA = { ...teamDataA, id: 'A', squad: sampleSquads[teamDataA.name] || Array(11).fill(null) };
    teamB = { ...teamDataB, id: 'B', squad: sampleSquads[teamDataB.name] || Array(11).fill(null) };
    players = [];
    const formationA = formation433('A');
    const formationB = formation433('B');
    for (let i = 0; i < 11; i++) {
        const nameA = teamA.squad[i];
        const nameB = teamB.squad[i];
        players.push(createPlayer(i, 'A', formationA[i].role, { x: formationA[i].x, y: formationA[i].y }, teamA.color, teamA.textColor, nameA, i));
        players.push(createPlayer(i, 'B', formationB[i].role, { x: formationB[i].x, y: formationB[i].y }, teamB.color, teamB.textColor, nameB, i));
    }
    scoreA = 0; scoreB = 0;
    resetStats();
    generateOdds();

    // Clear bets for all connected clients
    clients.forEach(clientData => {
        clientData.currentBet = null;
    });
    logDebug(`Teams setup complete. Odds: A=${oddsA}, B=${oddsB}. Bets cleared.`);
}
function resetPositions(kickingTeamId = null) {
    logDebug("Resetting positions...");
    ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.ownerId = null;
    players.forEach(p => {
        p.x = p.baseX; p.y = p.baseY;
        p.vx = 0; p.vy = 0;
        p.hasBall = false;
        p.state = 'IDLE';
        p.targetX = p.baseX; p.targetY = p.baseY;
        // Offset slightly for kickoff
        if (kickingTeamId) {
            if (p.team === kickingTeamId) {
                if (p.role === 'FWD' || p.role === 'MID') p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x - 20)); // Move slightly back
            } else {
                 p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x + 20)); // Move slightly forward
            }
        } else { // Normal reset (half start)
             p.x = p.baseX; p.y = p.baseY;
        }

    });
}
function resetStats() { stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } }; }
function getPlayerById(playerId) { return players.find(p => p.id === playerId); }

// --- Simulation Logic ---
function updatePlayerAI(player) {
    const playerDistToBallSq = distSq(player.x, player.y, ball.x, ball.y);
    const kickRangeSq = KICK_RANGE ** 2;
    const controlRangeSq = CONTROL_RANGE ** 2;
    const playerOwner = getPlayerById(ball.ownerId);
    const hasPossession = playerOwner === player;
    const isTeamMateControlling = playerOwner && playerOwner.team === player.team && playerOwner !== player;
    const isOpponentControlling = playerOwner && playerOwner.team !== player.team;
    const goalX = player.team === 'A' ? FIELD_WIDTH : 0;
    const goalY = FIELD_HEIGHT / 2;
    const ownGoalX = player.team === 'A' ? 0 : FIELD_WIDTH;

    player.kickCooldown = Math.max(0, player.kickCooldown - 1);

    // --- GK LOGIC ---
    if (player.role === 'GK') {
        let targetX = player.baseX;
        let targetY = player.baseY;
        const threatDistSq = (FIELD_WIDTH * 0.3)**2; // How far out GK considers threats

        if (isOpponentControlling && distSq(playerOwner.x, playerOwner.y, ownGoalX, goalY) < threatDistSq) {
            // Opponent near goal, position defensively relative to ball
            targetY = FIELD_HEIGHT / 2 + (ball.y - FIELD_HEIGHT / 2) * 0.5; // Cover angle
             targetX = player.baseX + (player.team === 'A' ? -10 : 10); // Slightly off line
        } else if (distSq(ball.x, ball.y, player.baseX, player.baseY) < (FIELD_WIDTH*0.2)**2 && !playerOwner) {
             // Ball loose near penalty area
             targetX = ball.x;
             targetY = ball.y;
        } else {
             // Default positioning, slightly adjusting towards ball y-position
             targetY = player.baseY + (ball.y - player.baseY) * 0.1;
             targetX = player.baseX;
        }
         // Clamp GK movement
        targetX = Math.max(ownGoalX === 0 ? 0 : FIELD_WIDTH - 165, Math.min(ownGoalX === 0 ? 165 : FIELD_WIDTH, targetX)); // Stay within penalty area width roughly
        targetY = Math.max(FIELD_HEIGHT*0.2, Math.min(FIELD_HEIGHT*0.8, targetY)); // Don't go too wide

        player.targetX = targetX;
        player.targetY = targetY;
        movePlayerTowardsTarget(player);

        // GK attempt to claim ball if close and no owner
        if (!playerOwner && playerDistToBallSq < controlRangeSq && player.kickCooldown <= 0) {
            gainPossession(player);
            // Simple clear/long pass
            shootBall(player, player.team === 'A' ? FIELD_WIDTH * 0.8 : FIELD_WIDTH * 0.2, Math.random() * FIELD_HEIGHT, SHOT_POWER * 0.6); // Less power than shot
            player.kickCooldown = 30;
        }
        return; // End GK Logic
    }


    // --- OUTFIELD PLAYER LOGIC ---

    // Priority 1: Act if possessing the ball
    if (hasPossession) {
        ball.ownerId = player.id; // Reaffirm ownership
        player.state = 'DRIBBLING';
        const shootRangeSq = (FIELD_WIDTH * 0.35)**2;
        const distToGoalSq = distSq(player.x, player.y, goalX, goalY);

        // Shooting decision
        if (distToGoalSq < shootRangeSq && player.kickCooldown <= 0 && Math.random() < 0.3) { // Add randomness
            player.state = 'SHOOTING';
            shootBall(player, goalX, goalY);
            stats[player.team === 'A' ? 'teamA' : 'teamB'].shots++;
            player.kickCooldown = 25; // Longer cooldown after shot
            return;
        }

        // Passing decision (simplified)
        let closestTeamMate = null;
        let minDistSq = Infinity;
        players.forEach(p => {
            if (p.team === player.team && p !== player) {
                const dSq = distSq(player.x, player.y, p.x, p.y);
                if (dSq < (FIELD_WIDTH * 0.4)**2 && dSq < minDistSq) { // Find reasonably close teammate
                     minDistSq = dSq;
                     closestTeamMate = p;
                 }
            }
        });

        if (closestTeamMate && player.kickCooldown <= 0 && Math.random() < 0.15) { // Pass sometimes
             player.state = 'PASSING';
             passBall(player, closestTeamMate);
             stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++;
             player.kickCooldown = 15;
             return;
        }

        // Dribbling / Moving forward
        player.state = 'DRIBBLING';
        player.targetX = player.x + (goalX - player.x) * 0.1; // Move towards goal general direction
        player.targetY = player.y + (goalY - player.y) * 0.1;
        // Add some variation to dribble direction
        if(Math.random() < 0.1) {
            player.targetY += (Math.random() - 0.5) * FIELD_HEIGHT * 0.2;
        }

        // Move player slightly slower when dribbling
        movePlayerTowardsTarget(player, PLAYER_SPEED * 0.9);
        // Ball sticks to player (simplified dribble)
        const angleToTarget = Math.atan2(player.targetY - player.y, player.targetX - player.x);
        ball.x = player.x + Math.cos(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS);
        ball.y = player.y + Math.sin(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS);
        ball.vx = player.vx; // Ball moves with player
        ball.vy = player.vy;
        return;
    }

    // Priority 2: Chase ball if nearby and uncontrolled or opponent has it
    const chaseDistanceSq = (FIELD_WIDTH * (player.role === 'FWD' ? 0.6 : (player.role === 'MID' ? 0.5 : 0.4)))**2;
    if ((!playerOwner || isOpponentControlling) && playerDistToBallSq < chaseDistanceSq && player.kickCooldown <= 0) {
        player.state = 'CHASING';
        player.targetX = ball.x;
        player.targetY = ball.y;
        movePlayerTowardsTarget(player);
        // Attempt to tackle/gain possession if very close
        if (playerDistToBallSq < controlRangeSq) {
             gainPossession(player);
        }
        return;
    }

     // Priority 3: Support teammate with ball
     if (isTeamMateControlling) {
         player.state = 'SUPPORTING';
         // Move towards space ahead of the ball carrier
         const supportDist = 100 + (Math.random() * 50);
         const angleToGoal = Math.atan2(goalY - playerOwner.y, goalX - playerOwner.x);
         // Basic positioning ahead or slightly wide
         let targetX = playerOwner.x + Math.cos(angleToGoal) * supportDist;
         let targetY = playerOwner.y + Math.sin(angleToGoal) * supportDist;
          // Add some width based on role/randomness
         if (player.role !== 'DEF' || Math.random() < 0.3) {
              targetY += (Math.random() < 0.5 ? -1 : 1) * 50;
         }
         player.targetX = targetX;
         player.targetY = targetY;
         movePlayerTowardsTarget(player);
         return;
     }

    // Priority 4: Return to base formation position if idle/ball far away
    player.state = 'RETURNING';
    player.targetX = player.baseX;
    player.targetY = player.baseY;
     // Adjust base position slightly based on ball's y-position defensively
     if (player.role === 'DEF' || player.role === 'MID') {
        player.targetY += (ball.y - player.baseY) * 0.2;
     }
    movePlayerTowardsTarget(player);
}
function movePlayerTowardsTarget(player, speed = PLAYER_SPEED) {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > speed) { // Only move if further than one step
        const angle = Math.atan2(dy, dx);
        player.vx = Math.cos(angle) * speed;
        player.vy = Math.sin(angle) * speed;
    } else if (dist > 1){
        // If close, just step there
        player.vx = dx;
        player.vy = dy;
    }
     else {
        player.vx = 0;
        player.vy = 0;
    }
}
function updatePlayerPosition(player) {
    player.x += player.vx;
    player.y += player.vy;
    // Collision with field boundaries
    player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));

    // Simple player-player collision avoidance (basic repulsion)
    players.forEach(other => {
        if (player !== other) {
            const dSq = distSq(player.x, player.y, other.x, other.y);
            const minDist = PLAYER_RADIUS * 2;
            if (dSq < minDist * minDist && dSq > 0.1) {
                 const dist = Math.sqrt(dSq);
                 const overlap = minDist - dist;
                 const angle = Math.atan2(player.y - other.y, player.x - other.x);
                 const moveX = (Math.cos(angle) * overlap) / 2;
                 const moveY = (Math.sin(angle) * overlap) / 2;
                 player.x += moveX;
                 player.y += moveY;
                 other.x -= moveX;
                 other.y -= moveY;
                 // Re-check boundaries after push
                 player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
                 player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));
                 other.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, other.x));
                 other.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, other.y));
            }
        }
    });
}
function passBall(passer, targetPlayer) {
    logDebug(`${passer.id} passing to ${targetPlayer.id}`);
    const dx = targetPlayer.x - passer.x;
    const dy = targetPlayer.y - passer.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * 0.15; // Slight inaccuracy
    const finalAngle = angle + inaccuracyAngle;
    const power = Math.min(BALL_MAX_SPEED, dist * PASS_POWER_FACTOR + Math.random() * 2); // Adjust power slightly
    ball.vx = Math.cos(finalAngle) * power;
    ball.vy = Math.sin(finalAngle) * power;
    ball.ownerId = null; // Ball is now loose
    passer.hasBall = false;
}
function shootBall(shooter, targetX, targetY, power = SHOT_POWER) {
    logDebug(`${shooter.id} shooting towards ${targetX}, ${targetY}`);
    const dx = targetX - shooter.x;
    const dy = targetY - shooter.y;
    const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * 0.08; // Less inaccuracy for shots usually
    const finalAngle = angle + inaccuracyAngle;
    ball.vx = Math.cos(finalAngle) * power;
    ball.vy = Math.sin(finalAngle) * power;
    ball.ownerId = null; // Ball is now loose
    shooter.hasBall = false;
}
function updateBallPhysics() {
    if (ball.ownerId) {
        // Ball position is dictated by owner's movement in updatePlayerAI if dribbling
        const owner = getPlayerById(ball.ownerId);
         if (owner && owner.state !== 'DRIBBLING') {
             // If owner isn't dribbling (e.g. just gained possession), keep ball close
             ball.x = owner.x + owner.vx; // Move slightly ahead based on velocity
             ball.y = owner.y + owner.vy;
             ball.vx = 0; ball.vy = 0; // No independent velocity yet
         } else if (!owner) {
            // Owner might have disconnected? Make ball loose.
            ball.ownerId = null;
         }
        // else: Dribbling handles ball position update
    } else {
        // Ball is loose, apply physics
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= BALL_FRICTION;
        ball.vy *= BALL_FRICTION;
        if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
        if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

         // Wall collisions
        if (ball.y < BALL_RADIUS || ball.y > FIELD_HEIGHT - BALL_RADIUS) { ball.vy *= -0.6; ball.y = Math.max(BALL_RADIUS, Math.min(FIELD_HEIGHT - BALL_RADIUS, ball.y)); }
        // Check goal BEFORE side wall collision behind goal line
        const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2; const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2;
        if (ball.x < GOAL_DEPTH + BALL_RADIUS) { // Check near Left Goal (Team B goal)
             if (ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('A'); return; } // Goal A!
             else if (ball.x < BALL_RADIUS) { ball.vx *= -0.6; ball.x = BALL_RADIUS; } // Hit post/sidewall
        }
        if (ball.x > FIELD_WIDTH - GOAL_DEPTH - BALL_RADIUS) { // Check near Right Goal (Team A goal)
             if (ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('B'); return; } // Goal B!
            else if (ball.x > FIELD_WIDTH - BALL_RADIUS) { ball.vx *= -0.6; ball.x = FIELD_WIDTH - BALL_RADIUS; } // Hit post/sidewall
        }
    }
     // Check for player collision to gain possession if ball is loose
     if (!ball.ownerId) {
        let closestPlayer = null;
        let minDistSq = CONTROL_RANGE ** 2; // Use control range
        players.forEach(p => {
            if (p.kickCooldown <= 0) { // Can't control during kick cooldown
                const dSq = distSq(p.x, p.y, ball.x, ball.y);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    closestPlayer = p;
                }
            }
        });
        if (closestPlayer) {
            gainPossession(closestPlayer);
        }
    }
 }
function gainPossession(player) {
    if (ball.ownerId !== player.id) {
         logDebug(`${player.id} gained possession.`);
         const previousOwner = getPlayerById(ball.ownerId);
         if (previousOwner) previousOwner.hasBall = false; // Ensure previous owner state updated
         ball.ownerId = player.id;
         player.hasBall = true;
         ball.vx = 0; // Stop ball momentum when controlled
         ball.vy = 0;
         player.state = 'IDLE'; // Reset state briefly
    }
}
function handleGoal(scoringTeam) {
    logDebug(`GOAL scored by Team ${scoringTeam}! Score: A=${scoreA + (scoringTeam === 'A' ? 1:0)}, B=${scoreB + (scoringTeam === 'B' ? 1:0)}`);
    if (scoringTeam === 'A') { scoreA++; stats.teamA.goals++; }
    else { scoreB++; stats.teamB.goals++; }
    broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB } });
    // Determine kicking team (team that conceded)
    const kickingTeam = scoringTeam === 'A' ? 'B' : 'A';
    resetPositions(kickingTeam); // Pass kicking team for offset
}
function updateGame() { // Server's main logic update
    if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return;

    const startTime = Date.now();

    players.forEach(updatePlayerAI);
    players.forEach(updatePlayerPosition); // Includes collision resolution
    updateBallPhysics();

    // Check game time progress
    const now = Date.now();
    const realTimeElapsedInHalf = now - halfStartTimeStamp;
    // serverGameTime = (realTimeElapsedInHalf / 1000) * GAME_SPEED_FACTOR; // This recalculates from 0 each tick, causing jumps if tick rate varies. Let's increment instead.
    const realTimeSinceLastUpdate = MILLISECONDS_PER_UPDATE; // Assume fixed interval for now
    const ingameSecondsIncrement = (realTimeSinceLastUpdate / 1000) * GAME_SPEED_FACTOR;
    serverGameTime += ingameSecondsIncrement;


    const maxHalfTime = 45 * 60;
    const maxFullTime = 90 * 60;

    if (gameState === 'FIRST_HALF' && serverGameTime >= maxHalfTime) {
        serverGameTime = maxHalfTime; // Cap time
        handleHalfTime();
    } else if (gameState === 'SECOND_HALF' && serverGameTime >= maxFullTime) {
        serverGameTime = maxFullTime; // Cap time
        handleFullTime();
    }

     const updateDuration = Date.now() - startTime;
     if (updateDuration > MILLISECONDS_PER_UPDATE) {
          // logDebug(`Warning: Game update took ${updateDuration}ms (longer than interval ${MILLISECONDS_PER_UPDATE}ms)`);
     }
}

// --- Game Flow Control ---
function startMatch() {
    logDebug(`[State Transition] Starting Match: ${teamA?.name} vs ${teamB?.name}`);
    if (!teamA || !teamB) {
        console.error("Cannot start match, teams not set up.");
        // Maybe try setting up teams again? Or go back to initial betting?
        startInitialSequence(); // Restart the whole sequence
        return;
    }
    resetPositions();
    resetStats(); // Ensure stats object exists
    scoreA = 0; scoreB = 0;
    serverGameTime = 0;
    halfStartTimeStamp = Date.now();
    gameState = 'FIRST_HALF';

    // Clear existing timers/intervals before starting new ones
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);

    broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } });
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for First Half.");
}
function handleHalfTime() {
    logDebug("[State Transition] Handling Half Time");
    if (gameState !== 'FIRST_HALF') { logDebug("Warning: Tried to handle halftime but not in first half."); return; }
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;

    gameState = 'HALF_TIME';
    serverGameTime = 45 * 60;
    breakEndTime = Date.now() + HALF_TIME_BREAK_MS;
    broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime } });

    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);
    breakTimerTimeout = setTimeout(startSecondHalf, HALF_TIME_BREAK_MS);
    logDebug(`Halftime break. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`);
}
function startSecondHalf() {
    logDebug("[State Transition] Starting Second Half");
    if (gameState !== 'HALF_TIME') { logDebug("Warning: Tried to start second half but not in halftime."); return; }

    resetPositions('B'); // Team B typically kicks off second half (can be randomized)
    // serverGameTime = 45 * 60; // Time is already at 45:00 from handleHalfTime
    halfStartTimeStamp = Date.now(); // Reset timer start for measuring 2nd half duration
    gameState = 'SECOND_HALF';

    // Clear existing timers/intervals
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);

    broadcast({ type: 'secondHalfStart' });
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for Second Half.");
}
function handleFullTime() {
    logDebug("[State Transition] Handling Full Time");
    if (gameState !== 'SECOND_HALF') { logDebug("Warning: Tried to handle fulltime but not in second half."); return; }
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;

    gameState = 'FULL_TIME';
    serverGameTime = 90 * 60;
    breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS;
    broadcast({ type: 'fullTime', payload: { scoreA, scoreB, breakEndTime } });

    // Resolve bets AFTER broadcasting final score
    resolveAllBets();

    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);
    breakTimerTimeout = setTimeout(setupNextMatch, BETWEEN_MATCH_BREAK_MS);
    logDebug(`Full Time. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`);
}
function setupNextMatch() {
    logDebug("[State Transition] Setting up Next Match");
    // This function is called after the BETWEEN_MATCH_BREAK timeout

     // Clear existing timers/intervals
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);


    if (availableTeams.length < 2) {
        logDebug("Team pool empty, resetting and shuffling.");
        availableTeams = [...nationalTeams];
        shuffleArray(availableTeams);
    }
    const nextTeamA = availableTeams.pop();
    const nextTeamB = availableTeams.pop();

    if (!nextTeamA || !nextTeamB) {
        console.error("Failed to get next teams! Restarting initial sequence.");
        startInitialSequence();
        return;
    }

    setupTeams(nextTeamA, nextTeamB); // Sets teams, odds, resets scores, clears bets

    gameState = 'PRE_MATCH'; // State indicating teams are chosen, ready to start
     broadcast({
         type: 'currentGameState', // Send updated state before match starts
         payload: createFullGameStatePayload()
     });

    // Short delay before starting the actual match to allow clients to process PRE_MATCH state
    setTimeout(() => {
        if (gameState === 'PRE_MATCH') { // Ensure state hasn't changed unexpectedly
             startMatch();
        } else {
             logDebug(`Warning: Wanted to start match from PRE_MATCH, but state is now ${gameState}`);
        }
    }, 1000); // 1 second delay
}

// Resolve bets for ALL connected clients
function resolveAllBets() {
    logDebug("Resolving all bets...");
    const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); // null for draw

    clients.forEach((clientData, ws) => {
        if (clientData.currentBet) {
            let payout = 0;
            let message = "";
            const bet = clientData.currentBet;
            const betTeamName = bet.team === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B';

            if (bet.team === winningTeam) {
                const odds = bet.team === 'A' ? parseFloat(oddsA) : parseFloat(oddsB);
                payout = bet.amount * odds;
                clientData.balance += payout;
                message = `Bet on ${betTeamName} WON! +$${payout.toFixed(2)}.`;
                logDebug(`Bet won for ${clientData.nickname || clientData.id}: +$${payout.toFixed(2)}`);
            } else if (winningTeam === null) { // Draw refund
                clientData.balance += bet.amount;
                payout = bet.amount; // Indicate success for refund
                message = `Match drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                logDebug(`Bet refunded for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`);
            } else { // Bet lost
                payout = 0; // Lost amount was already deducted
                message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`;
                 logDebug(`Bet lost for ${clientData.nickname || clientData.id}: -$${bet.amount.toFixed(2)}`);
            }

            sendToClient(ws, {
                type: 'betResult',
                payload: { success: payout > 0 || winningTeam === null, message: message, newBalance: clientData.balance }
            });
            clientData.currentBet = null; // Clear bet *after* sending result
        }
    });
    logDebug("Bet resolution complete.");
}

// --- Initial Sequence ---
function startInitialSequence() {
    console.log("Starting initial server sequence...");
    gameState = 'INITIALIZING'; // Start as initializing

    // Clear potential leftover timers/intervals
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);


    if (availableTeams.length < 2) {
         logDebug("Initial sequence: Resetting team pool.");
        availableTeams = [...nationalTeams];
        shuffleArray(availableTeams);
    }
    const firstTeamA = availableTeams.pop();
    const firstTeamB = availableTeams.pop();

    if (!firstTeamA || !firstTeamB) {
         console.error("Failed to get initial teams! Retrying...");
         setTimeout(startInitialSequence, 5000); // Retry after 5s
         return;
    }

    setupTeams(firstTeamA, firstTeamB); // Setups teams, odds, resets scores/stats, clears bets

    gameState = 'INITIAL_BETTING'; // Now transition to betting state
    breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS;
    logDebug(`Initial betting period ends at ${new Date(breakEndTime).toLocaleTimeString()}`);

    // Broadcast initial state
    broadcast({
        type: 'initialWait', // Use specific type for clients to show initial overlay
        payload: { teamA, teamB, oddsA, oddsB, breakEndTime }
    });

    // Schedule the first match setup *after* the betting wait
    breakTimerTimeout = setTimeout(() => {
         if(gameState === 'INITIAL_BETTING') { // Only proceed if still in initial phase
            logDebug("Initial wait over. Proceeding to setup first match.");
            setupNextMatch(); // This will set state to PRE_MATCH, then schedule startMatch
         } else {
            logDebug(`Warning: Initial wait timer finished, but game state was already ${gameState}. No action taken.`);
         }
    }, INITIAL_BETTING_WAIT_MS);
}

// --- WebSocket Connection Handling ---
wss.on('connection', (ws, req) => {
    // You could use req.socket.remoteAddress for logging IPs if needed
    const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    logDebug(`Client connected: ${clientId} from ${req.socket.remoteAddress}`);
    clients.set(ws, {
        id: clientId,
        nickname: null,
        balance: 100, // Starting balance
        currentBet: null // { team: 'A'/'B', amount: number }
    });

    // Send the current, complete game state to the newly connected client
    sendToClient(ws, {
        type: 'currentGameState',
        payload: createFullGameStatePayload()
    });


    ws.on('message', (message) => {
        let data;
        try {
            // Check if message is binary (Buffer) - ignore ping/pong frames if any
            if (Buffer.isBuffer(message)) {
                // logDebug(`Received binary message from ${clientId}, ignoring.`);
                return;
            }
            data = JSON.parse(message);
            const clientData = clients.get(ws);
            if (!clientData) {
                logDebug(`Received message from unknown client (ws instance not found).`);
                return;
            }

            // logDebug(`Received from ${clientData.id} (${clientData.nickname || 'No Nick'}):`, data.type, data.payload);

            switch (data.type) {
                case 'setNickname':
                    const nick = data.payload?.trim(); // Use optional chaining and trim
                    if (nick && nick.length > 0 && nick.length <= 15) {
                         const oldNickname = clientData.nickname;
                         clientData.nickname = nick;
                         logDebug(`Client ${clientData.id} set nickname to ${nick}`);
                         // Confirm nickname and send CURRENT balance/bet status
                         sendToClient(ws, { type: 'welcome', payload: { nickname: nick, balance: clientData.balance, currentBet: clientData.currentBet } });
                         // Announce to chat (only if nickname actually changed or was set)
                         if (nick !== oldNickname) {
                            const joinMsg = oldNickname ? `${oldNickname} changed name to ${nick}` : `${nick} has joined.`;
                            broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: joinMsg } });
                         }
                    } else {
                         logDebug(`Invalid nickname attempt from ${clientData.id}: "${data.payload}"`);
                         sendToClient(ws, { type: 'systemMessage', payload: { message: 'Invalid nickname (1-15 chars).', isError: true } });
                    }
                    break;

                case 'chatMessage':
                    if (clientData.nickname && data.payload && typeof data.payload === 'string') {
                        const chatMsg = data.payload.substring(0, 100).trim(); // Limit length and trim
                        if (chatMsg.length > 0) {
                            broadcast({ type: 'chatBroadcast', payload: { sender: clientData.nickname, message: chatMsg } });
                        }
                    } else if (!clientData.nickname) {
                        sendToClient(ws, { type: 'systemMessage', payload: { message: 'Please set a nickname to chat.', isError: true } });
                    }
                    break;

                case 'placeBet':
                    const isBettingPeriod = (gameState === 'INITIAL_BETTING' || gameState === 'FULL_TIME' || gameState === 'PRE_MATCH' || gameState === 'BETWEEN_GAMES');
                    if (!clientData.nickname) {
                         sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Set nickname to bet.', newBalance: clientData.balance } });
                         break;
                    }
                    if (!isBettingPeriod) {
                        sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting is currently closed.', newBalance: clientData.balance } });
                        break;
                    }
                    if (clientData.currentBet) {
                        const betOnTeamName = clientData.currentBet.team === 'A' ? teamA?.name : teamB?.name;
                        sendToClient(ws, { type: 'betResult', payload: { success: false, message: `Bet already placed on ${betOnTeamName}.`, newBalance: clientData.balance } });
                        break;
                    }
                    const betPayload = data.payload;
                    const betAmount = parseInt(betPayload?.amount, 10);
                    const betTeam = betPayload?.team;

                    if ((betTeam === 'A' || betTeam === 'B') && !isNaN(betAmount) && betAmount > 0) {
                        if (betAmount > clientData.balance) {
                            sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Insufficient balance.', newBalance: clientData.balance } });
                        } else {
                            clientData.balance -= betAmount;
                            clientData.currentBet = { team: betTeam, amount: betAmount };
                            const betOnTeamName = betTeam === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B';
                            sendToClient(ws, { type: 'betResult', payload: { success: true, message: `Bet $${betAmount} on ${betOnTeamName} placed.`, newBalance: clientData.balance } });
                            logDebug(`${clientData.nickname} bet $${betAmount} on ${betTeam}`);
                            // Optional: broadcast generic bet message
                            // broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} placed a bet.` }});
                        }
                    } else {
                         logDebug(`Invalid bet attempt from ${clientData.nickname}:`, betPayload);
                         sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Invalid bet amount or team.', newBalance: clientData.balance } });
                    }
                    break;

                // Add a PONG handler if you implement PINGs client-side later
                // case 'pong':
                //      clientData.lastPong = Date.now();
                //      break;

                default:
                    logDebug(`Unknown message type from ${clientData.id}: ${data.type}`);
            }

        } catch (error) {
            console.error(`Failed to process message or invalid JSON: ${message}`, error);
            // Maybe send an error back to the client if appropriate
             const clientData = clients.get(ws);
             if (clientData) {
                 sendToClient(ws, { type: 'systemMessage', payload: { message: 'Error processing your request.', isError: true } });
             }
        }
    });

    ws.on('close', (code, reason) => {
        const clientData = clients.get(ws);
        if (clientData) {
            logDebug(`Client disconnected: ${clientData.nickname || clientData.id}. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}`);
            if (clientData.nickname) {
                broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} has left.` } });
            }
            clients.delete(ws);
        } else {
            logDebug("Unknown client disconnected.");
        }
    });

    ws.on('error', (error) => {
        const clientData = clients.get(ws);
        console.error(`WebSocket error for client ${clientData?.nickname || clientData?.id || 'UNKNOWN'}:`, error);
        // Close and delete client on error
        if (clients.has(ws)) {
             logDebug(`Removing client ${clientData.id} due to error.`);
             clients.delete(ws);
             // Don't broadcast leave message on error, could be spammy if server issue
        }
         ws.terminate(); // Force close socket on error
    });
});


// --- Periodic State Broadcast ---
setInterval(() => {
    if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') {
        // Send only essential data frequently
        broadcast({
            type: 'gameStateUpdate',
            payload: {
                // gameState, // Client usually knows this from events, sending less often maybe?
                scoreA, scoreB,
                serverGameTime: calculateCurrentDisplayTime(),
                // Only send players/ball if they exist (safety check)
                players: players || [],
                ball: ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null }
            }
        });
    }
     // No broadcast needed for static states like HALF_TIME, FULL_TIME, INITIAL_BETTING
     // State changes are handled by specific event messages (halfTime, fullTime, initialWait, matchStart)
}, 200); // Broadcast state 5 times per second - ADJUST if causing performance issues

// Helper to create the full state payload sent on initial connection
function createFullGameStatePayload() {
    return {
        gameState,
        scoreA, scoreB,
        teamA, teamB,
        oddsA, oddsB,
        serverGameTime: calculateCurrentDisplayTime(),
        // Only send players/ball if game is actually running or state allows seeing them setup
         players: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (players || []) : [],
         ball: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }) : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null },
        breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null,
        // We could also include the full team list here if needed
        // tournamentTeams: nationalTeams.map(t => t.name) // Example
    };
}

// Helper to calculate display time based on server state
function calculateCurrentDisplayTime() {
    // Use the authoritative serverGameTime variable which is incremented in updateGame
    if (gameState === 'FIRST_HALF') {
        return Math.min(45 * 60, serverGameTime);
    } else if (gameState === 'SECOND_HALF') {
        // Ensure time doesn't exceed 90:00 visually even if simulation slightly overruns
        return Math.min(90 * 60, serverGameTime);
    } else if (gameState === 'HALF_TIME') {
        return 45 * 60;
    } else if (gameState === 'FULL_TIME' || gameState === 'BETWEEN_GAMES' || gameState === 'PRE_MATCH') {
         return 90 * 60;
    } else { // INITIALIZING, INITIAL_BETTING
        return 0;
    }
}


// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server listening on port ${PORT}`);
    startInitialSequence();
});

// Graceful Shutdown Handling (Optional but good practice)
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
     if (gameLogicInterval) clearInterval(gameLogicInterval);
     if (breakTimerTimeout) clearTimeout(breakTimerTimeout);
    server.close(() => {
        console.log('HTTP server closed');
         wss.close(() => {
            console.log('WebSocket server closed');
            process.exit(0);
        });
    });
     // Force close sockets after a timeout if they don't close gracefully
     setTimeout(() => {
        console.error("Graceful shutdown timeout. Forcing exit.");
        process.exit(1);
     }, 5000); // 5 second timeout
});


console.log("Server script finished initial execution. Waiting for connections...");