// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

console.log("Starting server...");

// --- HTTP Server Setup ---
// Serves the index.html file
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
    } else {
        // Basic 404 for other requests
        res.writeHead(404);
        res.end('Not Found');
    }
});

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });
console.log("WebSocket server attached to HTTP server.");

// --- Game Constants (Server-side) ---
// Using slightly faster times for quicker testing cycles initially
const INITIAL_BETTING_WAIT_MINS = 0.5; // Use 5 for production
const REAL_MATCH_DURATION_MINS = 2; // Use 10 for production
const BETWEEN_MATCH_BREAK_MINS = 0.5; // Use 5 for production
// --- Derived Constants ---
const INITIAL_BETTING_WAIT_MS = INITIAL_BETTING_WAIT_MINS * 60 * 1000;
const INGAME_MATCH_DURATION_MINS = 90;
const REAL_HALF_DURATION_MS = (REAL_MATCH_DURATION_MINS / 2) * 60 * 1000;
const HALF_TIME_BREAK_S = 15; // Use 30 for production
const BETWEEN_MATCH_BREAK_MS = BETWEEN_MATCH_BREAK_MINS * 60 * 1000;
const UPDATES_PER_SECOND = 30;
const MILLISECONDS_PER_UPDATE = 1000 / UPDATES_PER_SECOND;
const GAME_SPEED_FACTOR = (INGAME_MATCH_DURATION_MINS * 60 * 1000) / (REAL_MATCH_DURATION_MINS * 60 * 1000);
const FIELD_WIDTH = 1050; const FIELD_HEIGHT = 680; const GOAL_WIDTH = 120; const GOAL_DEPTH = 20; const CENTER_CIRCLE_RADIUS = 91.5; const PLAYER_RADIUS = 10; const BALL_RADIUS = 5; const PLAYER_SPEED = 3.5; const BALL_MAX_SPEED = 15; const BALL_FRICTION = 0.985; const SHOT_POWER = 14; const PASS_POWER_FACTOR = 0.6; const KICK_RANGE = PLAYER_RADIUS + BALL_RADIUS + 5; const CONTROL_RANGE = PLAYER_RADIUS + BALL_RADIUS + 2;

// --- Team Data (Server-side) ---
const nationalTeams = [ /* ... Copy the full nationalTeams array here ... */
    { name: "Argentina", color: "#75AADB", rating: 92 }, { name: "France", color: "#003399", rating: 91 }, { name: "Brazil", color: "#FFDF00", rating: 90 }, { name: "England", color: "#FFFFFF", textColor: "#000000", rating: 89 }, { name: "Belgium", color: "#ED2939", rating: 88 }, { name: "Croatia", color: "#FF0000", rating: 87 }, { name: "Netherlands", color: "#FF6600", rating: 87 }, { name: "Italy", color: "#003399", rating: 86 }, { name: "Portugal", color: "#006600", rating: 86 }, { name: "Spain", color: "#FF0000", rating: 85 }, { name: "Morocco", color: "#006233", rating: 84 }, { name: "Switzerland", color: "#FF0000", rating: 84 }, { name: "USA", color: "#002868", rating: 83 }, { name: "Germany", color: "#000000", rating: 83 }, { name: "Mexico", color: "#006847", rating: 82 }, { name: "Uruguay", color: "#5CBFEB", rating: 82 }, { name: "Colombia", color: "#FCD116", rating: 81 }, { name: "Senegal", color: "#00853F", rating: 81 }, { name: "Denmark", color: "#C60C30", rating: 80 }, { name: "Japan", color: "#000080", rating: 80 }, { name: "Peru", color: "#D91023", rating: 79 }, { name: "Iran", color: "#239F40", rating: 79 }, { name: "Serbia", color: "#C6363C", rating: 78 }, { name: "Poland", color: "#DC143C", rating: 78 }, { name: "Sweden", color: "#006AA7", rating: 78 }, { name: "Ukraine", color: "#005BBB", rating: 77 }, { name: "South Korea", color: "#FFFFFF", textColor:"#000000", rating: 77 }, { name: "Chile", color: "#D52B1E", rating: 76 }, { name: "Tunisia", color: "#E70013", rating: 76 }, { name: "Costa Rica", color: "#002B7F", rating: 75 }, { name: "Australia", color: "#00843D", rating: 75 }, { name: "Nigeria", color: "#008751", rating: 75 }, { name: "Austria", color: "#ED2939", rating: 74 }, { name: "Hungary", color: "#436F4D", rating: 74 }, { name: "Russia", color: "#FFFFFF", textColor:"#000000", rating: 73 }, { name: "Czech Republic", color: "#D7141A", rating: 73 }, { name: "Egypt", color: "#C8102E", rating: 73 }, { name: "Algeria", color: "#006233", rating: 72 }, { name: "Scotland", color: "#0065BF", rating: 72 }, { name: "Norway", color: "#EF2B2D", rating: 72 }, { name: "Turkey", color: "#E30A17", rating: 71 }, { name: "Mali", color: "#14B53A", rating: 71 }, { name: "Paraguay", color: "#DA121A", rating: 70 }, { name: "Ivory Coast", color: "#FF8200", rating: 70 }, { name: "Republic of Ireland", color: "#169B62", rating: 70 }, { name: "Qatar", color: "#8A1538", rating: 69 }, { name: "Saudi Arabia", color: "#006C35", rating: 69 }, { name: "Greece", color: "#0D5EAF", rating: 69 }, { name: "Romania", color: "#002B7F", rating: 68 },
];
let availableTeams = [...nationalTeams];
const sampleSquads = { /* ... Copy the sampleSquads object here ... */
    "Argentina": ["E Martinez", "L Martinez", "N Molina", "C Romero", "N Otamendi", "N Tagliafico", "R De Paul", "E Fernandez", "A Mac Allister", "L Messi", "J Alvarez"], "France": ["M Maignan", "D Upamecano", "I Konate", "T Hernandez", "J Kounde", "A Tchouameni", "A Rabiot", "A Griezmann", "K Mbappe", "O Giroud", "O Dembele"], "Brazil": ["Alisson B", "Marquinhos", "E Militao", "Danilo", "Alex Sandro", "Casemiro", "Lucas Paqueta", "Neymar Jr", "Vinicius Jr", "Rodrygo G", "Richarlison"], "England": ["J Pickford", "K Walker", "J Stones", "H Maguire", "L Shaw", "D Rice", "J Bellingham", "J Henderson", "B Saka", "H Kane", "P Foden"], "Portugal": ["D Costa", "Ruben Dias", "Pepe", "J Cancelo", "N Mendes", "J Palhinha", "B Fernandes", "B Silva", "R Leao", "C Ronaldo", "J Felix"],
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
let ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null }; // Use ownerId now
let stats = {};
let oddsA = 2.00;
let oddsB = 2.00;
let breakEndTime = 0; // Timestamp when the current break (halftime, fulltime, initial) ends

let gameLogicInterval = null;
let clients = new Map(); // Store client data: ws -> { id, nickname, balance, currentBet: { team, amount } }


// --- Utility Functions (Server-side adaptations) ---
function getPlayerInitials(name, index = 0) { /* ... Copy from previous version ... */ if (typeof name !== 'string' || name.trim() === '') { return `P${index + 1}`; } const parts = name.trim().split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); } else if (parts.length === 1 && name.length > 0) { return name.substring(0, 2).toUpperCase(); } return `P${index + 1}`; }
function isColorDark(hexColor) { /* ... Copy from previous version ... */ hexColor = hexColor.replace('#', ''); const r = parseInt(hexColor.substring(0, 2), 16); const g = parseInt(hexColor.substring(2, 4), 16); const b = parseInt(hexColor.substring(4, 6), 16); const brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness < 128; }
function distSq(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateOdds() { const ratingDiff = teamA.rating - teamB.rating; const baseProbA = 0.5 + (ratingDiff / 50); oddsA = Math.max(1.1, 1 / (baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); oddsB = Math.max(1.1, 1 / (1 - baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); }

// Broadcast data to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    // console.log(`Broadcasting: ${message.substring(0, 100)}...`); // Debug: Log broadcast
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Send data to a specific client
function sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// --- Player & Team Setup (Server-side) ---
function createPlayer(id, teamId, role, formationPos, teamColor, textColor, playerName, playerIndex) {
    const initials = getPlayerInitials(playerName, playerIndex);
    return {
        id: `${teamId}-${id}`, team: teamId, role: role,
        name: playerName || `Player ${playerIndex + 1}`, initials: initials,
        x: formationPos.x, y: formationPos.y, vx: 0, vy: 0,
        targetX: formationPos.x, targetY: formationPos.y, hasBall: false,
        kickCooldown: 0, state: 'IDLE', color: teamColor, textColor: textColor || (isColorDark(teamColor) ? '#FFFFFF' : '#000000')
    };
}
const formation433 = (teamId) => { /* ... Copy formation logic ... */ const sideMultiplier = teamId === 'A' ? 1 : -1; const xOffset = FIELD_WIDTH / 2; const yOffset = FIELD_HEIGHT / 2; const positions = [ { role: 'GK', x: sideMultiplier * (-FIELD_WIDTH * 0.45), y: 0 }, { role: 'DEF', x: sideMultiplier * (-FIELD_WIDTH * 0.3), y: -FIELD_HEIGHT * 0.3 }, { role: 'DEF', x: sideMultiplier * (-FIELD_WIDTH * 0.35), y: 0 }, { role: 'DEF', x: sideMultiplier * (-FIELD_WIDTH * 0.3), y: FIELD_HEIGHT * 0.3 }, { role: 'MID', x: sideMultiplier * (-FIELD_WIDTH * 0.1), y: -FIELD_HEIGHT * 0.2 }, { role: 'MID', x: 0, y: 0 }, { role: 'MID', x: sideMultiplier * (-FIELD_WIDTH * 0.1), y: FIELD_HEIGHT * 0.2 }, { role: 'FWD', x: sideMultiplier * (FIELD_WIDTH * 0.25), y: -FIELD_HEIGHT * 0.35 }, { role: 'FWD', x: sideMultiplier * (FIELD_WIDTH * 0.3), y: 0 }, { role: 'FWD', x: sideMultiplier * (FIELD_WIDTH * 0.25), y: FIELD_HEIGHT * 0.35 }, { role: 'DEF', x: sideMultiplier * (-FIELD_WIDTH * 0.35), y: -FIELD_HEIGHT * 0.1 }, ]; return positions.map(p => ({ ...p, x: xOffset + p.x, y: yOffset + p.y })); };
function setupTeams(teamDataA, teamDataB) {
    console.log(`Setting up match: ${teamDataA.name} vs ${teamDataB.name}`);
    teamA = { ...teamDataA, id: 'A', squad: sampleSquads[teamDataA.name] || [] };
    teamB = { ...teamDataB, id: 'B', squad: sampleSquads[teamDataB.name] || [] };
    players = [];
    const formationA = formation433('A');
    const formationB = formation433('B');
    for (let i = 0; i < 11; i++) {
        const nameA = teamA.squad[i] || null;
        const nameB = teamB.squad[i] || null;
        players.push(createPlayer(i, 'A', formationA[i].role, { x: formationA[i].x, y: formationA[i].y }, teamA.color, teamA.textColor, nameA, i));
        players.push(createPlayer(i, 'B', formationB[i].role, { x: formationB[i].x, y: formationB[i].y }, teamB.color, teamB.textColor, nameB, i));
    }
    scoreA = 0; scoreB = 0;
    resetStats(); // Reset stats when teams are setup
    generateOdds(); // Generate odds for the new match

    // Clear bets for all connected clients for the new match
    clients.forEach(clientData => {
        clientData.currentBet = null;
    });

    console.log(`Teams setup. Odds: A=${oddsA}, B=${oddsB}`);
}
function resetPositions() { /* ... Copy reset logic ... */ ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.ownerId = null; const formationA = formation433('A'); const formationB = formation433('B'); let teamAIndex = 0; let teamBIndex = 0; players.forEach(p => { let formationPos; if (p.team === 'A') { formationPos = formationA[teamAIndex++]; } else { formationPos = formationB[teamBIndex++]; } p.x = formationPos.x; p.y = formationPos.y; p.vx = 0; p.vy = 0; p.hasBall = false; p.state = 'IDLE'; p.targetX = formationPos.x; p.targetY = formationPos.y; }); }
function resetStats() { stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } }; } // Simplified stats for now

// --- Simulation Logic (Server-side - largely unchanged but uses ownerId) ---
// Add getPlayerById helper
function getPlayerById(playerId) {
    return players.find(p => p.id === playerId);
}
function updatePlayerAI(player) { /* ... Copy AI logic, replace ball.owner checks with getPlayerById(ball.ownerId) ... */
    const playerDistToBallSq = distSq(player.x, player.y, ball.x, ball.y);
    const kickRangeSq = KICK_RANGE ** 2; const controlRangeSq = CONTROL_RANGE ** 2;
    const playerOwner = getPlayerById(ball.ownerId); // Get owner object
    const hasPossession = playerOwner === player; // Check if this player is the owner
    const isTeamMateControlling = playerOwner && playerOwner.team === player.team && playerOwner !== player;
    const isOpponentControlling = playerOwner && playerOwner.team !== player.team;
    const goalX = player.team === 'A' ? FIELD_WIDTH : 0; const goalY = FIELD_HEIGHT / 2; const ownGoalX = player.team === 'A' ? 0 : FIELD_WIDTH; const ownGoalY = FIELD_HEIGHT / 2; player.kickCooldown = Math.max(0, player.kickCooldown - 1);
    if (player.role === 'GK') { /* ... GK Logic (use playerOwner) ... */ return; }
    const chaseDistanceSq = (FIELD_WIDTH * (player.role === 'FWD' ? 0.5 : (player.role === 'MID' ? 0.4 : 0.3)))**2;
    if ((!playerOwner || isOpponentControlling) && playerDistToBallSq < chaseDistanceSq && player.kickCooldown <= 0) { /* ... Chase Logic ... */ return; }
    if (hasPossession) { /* ... Actions with Ball (use passBall, shootBall which update ownerId=null) ... */
        ball.ownerId = player.id; // Reaffirm ownership if needed (defensive)
        player.state = 'DRIBBLING';
        const shootRangeSq = (FIELD_WIDTH * 0.4)**2; const distToGoalSq = distSq(player.x, player.y, goalX, goalY);
        if (distToGoalSq < shootRangeSq && player.kickCooldown <= 0) { player.state = 'SHOOTING'; shootBall(player, goalX, goalY); stats[player.team === 'A' ? 'teamA' : 'teamB'].shots++; player.kickCooldown = 20; return; }
        let bestPassTarget = null; let bestPassScore = -Infinity;
        players.forEach(p => { /* ... Find best pass target ... */ });
        if (bestPassTarget && player.kickCooldown <= 0 && bestPassScore > -500) { player.state = 'PASSING'; passBall(player, bestPassTarget); stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++; player.kickCooldown = 10; return; }
        player.state = 'DRIBBLING'; player.targetX = player.x + (goalX - player.x) * 0.1; player.targetY = player.y + (goalY - player.y) * 0.1;
        const dribbleAngle = Math.atan2(player.targetY - player.y, player.targetX - player.x); ball.vx = Math.cos(dribbleAngle) * PLAYER_SPEED * 0.8; ball.vy = Math.sin(dribbleAngle) * PLAYER_SPEED * 0.8;
        movePlayerTowardsTarget(player); return;
    }
    if (!playerOwner && !isTeamMateControlling) { /* ... Defending Logic ... */ }
    else if (isTeamMateControlling) { /* ... Supporting Logic (use playerOwner.x, playerOwner.y) ... */ }
    else { /* ... Returning Logic ... */ }
    movePlayerTowardsTarget(player);
}
function getFormationPosition(player) { /* ... Copy formation position logic ... */ const formation = player.team === 'A' ? formation433('A') : formation433('B'); const playerIndex = parseInt(player.id.split('-')[1]); return formation[playerIndex]; }
function movePlayerTowardsTarget(player) { /* ... Copy movement logic ... */ const dx = player.targetX - player.x; const dy = player.targetY - player.y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist > PLAYER_RADIUS) { const angle = Math.atan2(dy, dx); player.vx = Math.cos(angle) * PLAYER_SPEED; player.vy = Math.sin(angle) * PLAYER_SPEED; } else { player.vx = 0; player.vy = 0; } }
function updatePlayerPosition(player) { /* ... Copy position update logic ... */ player.x += player.vx; player.y += player.vy; player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x)); player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y)); }
function passBall(passer, targetPlayer) { /* ... Copy pass logic, ensure ball.ownerId = null; ... */ const dx = targetPlayer.x - passer.x; const dy = targetPlayer.y - passer.y; const dist = Math.sqrt(dx*dx+dy*dy); const angle = Math.atan2(dy, dx); const inaccuracyAngle = (Math.random() - 0.5) * 0.15; const finalAngle = angle + inaccuracyAngle; const power = Math.min(BALL_MAX_SPEED, dist * PASS_POWER_FACTOR); ball.vx = Math.cos(finalAngle) * power; ball.vy = Math.sin(finalAngle) * power; ball.ownerId = null; passer.hasBall = false; }
function shootBall(shooter, targetX, targetY) { /* ... Copy shoot logic, ensure ball.ownerId = null; ... */ const dx = targetX - shooter.x; const dy = targetY - shooter.y; const angle = Math.atan2(dy, dx); const inaccuracyAngle = (Math.random() - 0.5) * 0.1; const finalAngle = angle + inaccuracyAngle; ball.vx = Math.cos(finalAngle) * SHOT_POWER; ball.vy = Math.sin(finalAngle) * SHOT_POWER; ball.ownerId = null; shooter.hasBall = false; }
function updateBallPhysics() { /* ... Copy ball physics logic ... */
    ball.x += ball.vx; ball.y += ball.vy; ball.vx *= BALL_FRICTION; ball.vy *= BALL_FRICTION;
    if (Math.abs(ball.vx) < 0.1) ball.vx = 0; if (Math.abs(ball.vy) < 0.1) ball.vy = 0;
    if (ball.y < BALL_RADIUS || ball.y > FIELD_HEIGHT - BALL_RADIUS) { ball.vy *= -0.7; ball.y = Math.max(BALL_RADIUS, Math.min(FIELD_HEIGHT - BALL_RADIUS, ball.y)); }
    const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2; const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2;
    if (ball.x < BALL_RADIUS + GOAL_DEPTH && ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('B'); return; }
    if (ball.x > FIELD_WIDTH - BALL_RADIUS - GOAL_DEPTH && ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('A'); return; }
    if (ball.x < BALL_RADIUS) { ball.vx *= -0.7; ball.x = BALL_RADIUS; } if (ball.x > FIELD_WIDTH - BALL_RADIUS) { ball.vx *= -0.7; ball.x = FIELD_WIDTH - BALL_RADIUS; }
    if (!ball.ownerId) { /* ... Check for player collision and call gainPossession ... */
        let closestPlayer = null; let minDistSq = CONTROL_RANGE ** 2;
        players.forEach(p => { if (p.kickCooldown <= 0) { const dSq = distSq(p.x, p.y, ball.x, ball.y); if (dSq < minDistSq) { minDistSq = dSq; closestPlayer = p; } } });
        if (closestPlayer) { gainPossession(closestPlayer); }
    } else { /* ... Ball follow logic (optional, AI dribbling handles much of it) ... */ }
 }
function gainPossession(player) { if (ball.ownerId !== player.id) { ball.ownerId = player.id; player.hasBall = true; ball.vx = 0; ball.vy = 0; } }
function handleGoal(scoringTeam) {
    console.log(`GOAL scored by Team ${scoringTeam}`);
    if (scoringTeam === 'A') { scoreA++; stats.teamA.goals++; }
    else { scoreB++; stats.teamB.goals++; }
    broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB } });
    resetPositions();
}
function updateGame() { // Server's main logic update
    if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return;

    players.forEach(updatePlayerAI);
    players.forEach(updatePlayerPosition);
    updateBallPhysics();

    // Check game time progress
    const now = Date.now();
    const realTimeElapsedInHalf = now - halfStartTimeStamp;
    serverGameTime = (realTimeElapsedInHalf / 1000) * GAME_SPEED_FACTOR; // Calculate current in-game time elapsed in half

    if (realTimeElapsedInHalf >= REAL_HALF_DURATION_MS) {
        if (gameState === 'FIRST_HALF') handleHalfTime();
        else if (gameState === 'SECOND_HALF') handleFullTime();
    }
}

// --- Game Flow Control (Server-side) ---
function startMatch() {
    console.log("Starting match on server...");
    resetPositions();
    resetStats(); // Ensure stats object exists
    serverGameTime = 0;
    halfStartTimeStamp = Date.now();
    scoreA = 0; scoreB = 0; // Ensure scores reset here too

    gameState = 'FIRST_HALF';
    broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } }); // Inform clients match started

    if (gameLogicInterval) clearInterval(gameLogicInterval);
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    console.log("Game logic interval started.");
}
function handleHalfTime() {
    console.log("Handling halftime on server...");
    if (gameState !== 'FIRST_HALF') return;
    clearInterval(gameLogicInterval); gameLogicInterval = null;
    gameState = 'HALF_TIME';
    serverGameTime = 45 * 60; // Set logical time
    breakEndTime = Date.now() + (HALF_TIME_BREAK_S * 1000);
    broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime } });
    // Schedule start of second half
    setTimeout(startSecondHalf, HALF_TIME_BREAK_S * 1000);
    console.log(`Halftime. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`);
}
function startSecondHalf() {
    console.log("Starting second half on server...");
    if (gameState !== 'HALF_TIME') return; // Make sure we are in halftime
    resetPositions();
    serverGameTime = 45 * 60; // Start time for 2nd half logic
    halfStartTimeStamp = Date.now(); // Reset timer start for 2nd half duration
    gameState = 'SECOND_HALF';
    broadcast({ type: 'secondHalfStart' });
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    console.log("Game logic interval restarted for second half.");
}
function handleFullTime() {
    console.log("Handling full time on server...");
    if (gameState !== 'SECOND_HALF') return;
    clearInterval(gameLogicInterval); gameLogicInterval = null;
    gameState = 'FULL_TIME';
    serverGameTime = 90 * 60; // Set logical time
    breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS;
    broadcast({ type: 'fullTime', payload: { scoreA, scoreB, breakEndTime } });

    // Resolve bets AFTER broadcasting final score
    resolveAllBets();

    // Schedule next match setup
    setTimeout(setupNextMatch, BETWEEN_MATCH_BREAK_MS);
    console.log(`Full Time. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`);
}
function setupNextMatch() {
    console.log("Setting up next match on server...");
    if (gameState !== 'FULL_TIME') {
        console.warn(`Attempted to setup next match from state: ${gameState}. Aborting.`);
        // It's possible the timeout fired while already in another state if things got weird
        // Or more likely, the initial call from initial sequence is overlapping
        // Let's just ensure it only runs if we are finishing a game.
       // return; // This might prevent initial startup? Revisit if needed.
    }

    if (availableTeams.length < 2) { availableTeams = [...nationalTeams]; shuffleArray(availableTeams); console.log("Team pool reset."); }
    const nextTeamA = availableTeams.pop();
    const nextTeamB = availableTeams.pop();
    setupTeams(nextTeamA, nextTeamB); // This sets teams, resets scores, generates odds, clears bets

    gameState = 'PRE_MATCH'; // Ready for the match to start playing
    // The startMatch function will be called *immediately* by the main loop driver now
    // Or rather, startMatch needs to be called explicitly after setup.
    console.log("Next match teams selected. Starting match...");
    startMatch(); // Start the simulation loop for the new match
}

// Resolve bets for ALL connected clients
function resolveAllBets() {
    console.log("Resolving all bets...");
    const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null);

    clients.forEach((clientData, ws) => {
        if (clientData.currentBet) {
            let payout = 0;
            let message = "";
            const bet = clientData.currentBet;
            const betTeamName = bet.team === 'A' ? teamA.name : teamB.name;

            if (bet.team === winningTeam) {
                const odds = bet.team === 'A' ? parseFloat(oddsA) : parseFloat(oddsB);
                payout = bet.amount * odds;
                clientData.balance += payout;
                message = `Bet on ${betTeamName} won! +$${payout.toFixed(2)}.`;
            } else if (winningTeam === null) { // Draw refund
                clientData.balance += bet.amount;
                payout = bet.amount;
                message = `Match drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
            } else { // Bet lost
                payout = 0; // Lost amount is already deducted
                message = `Bet on ${betTeamName} lost (-$${bet.amount.toFixed(2)}).`;
            }

            console.log(`Bet result for ${clientData.nickname || clientData.id}: ${message}`);
            sendToClient(ws, {
                type: 'betResult',
                payload: { success: payout > 0 || winningTeam === null, message: message, newBalance: clientData.balance }
            });
            clientData.currentBet = null; // Clear bet for the next match
        }
    });
    console.log("Bet resolution complete.");
}

// --- Initial Sequence ---
function startInitialSequence() {
    console.log("Starting initial server sequence...");
    gameState = 'INITIAL_BETTING';
    if (availableTeams.length < 2) { availableTeams = [...nationalTeams]; shuffleArray(availableTeams); }
    const firstTeamA = availableTeams.pop();
    const firstTeamB = availableTeams.pop();
    setupTeams(firstTeamA, firstTeamB); // Setups teams, odds, resets scores

    breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS;
    console.log(`Initial betting ends at ${new Date(breakEndTime).toLocaleTimeString()}`);

    // Broadcast initial state info needed by clients connecting during this phase
    broadcast({
        type: 'initialWait',
        payload: { teamA, teamB, oddsA, oddsB, breakEndTime }
    });

    // Schedule the first match start
    setTimeout(() => {
         if(gameState === 'INITIAL_BETTING') { // Only start if still in initial phase
            console.log("Initial wait over. Starting first match.");
            setupNextMatch(); // Call setup which now immediately calls startMatch
         } else {
            console.warn("Initial wait timer finished, but game state was already", gameState);
         }
    }, INITIAL_BETTING_WAIT_MS);
}


// --- WebSocket Connection Handling ---
wss.on('connection', (ws) => {
    const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`Client connected: ${clientId}`);
    clients.set(ws, {
        id: clientId,
        nickname: null,
        balance: 100, // Starting balance stored server-side
        currentBet: null // { team: 'A'/'B', amount: number }
    });

    // Send the current, up-to-date game state to the newly connected client
    sendToClient(ws, {
        type: 'currentGameState',
        payload: {
            gameState, // Send current state ('INITIAL_BETTING', 'FIRST_HALF', etc.)
            scoreA, scoreB,
            teamA, teamB, // Send current teams
            oddsA, oddsB, // Send current odds
            serverGameTime: calculateCurrentDisplayTime(), // Send current calculated game time
            players: gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' ? players : [], // Only send if match running
            ball: gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' ? ball : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null },
            breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null
        }
    });


    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const clientData = clients.get(ws);
            if (!clientData) return; // Should not happen

            // console.log(`Received from ${clientData.id}:`, data); // Debug received messages

            switch (data.type) {
                case 'setNickname':
                    if (data.payload && typeof data.payload === 'string' && data.payload.trim().length > 0) {
                        const newNickname = data.payload.trim().substring(0, 15);
                        const oldNickname = clientData.nickname;
                        clientData.nickname = newNickname;
                        console.log(`Client ${clientData.id} set nickname to ${newNickname}`);
                        // Confirm nickname and send initial balance/bet status
                        sendToClient(ws, { type: 'welcome', payload: { nickname: newNickname, balance: clientData.balance, currentBet: clientData.currentBet } });
                        // Announce to chat
                        broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${newNickname} has joined.` } });
                    }
                    break;

                case 'chatMessage':
                    if (clientData.nickname && data.payload && typeof data.payload === 'string') {
                        const chatMsg = data.payload.substring(0, 100); // Limit length
                        broadcast({ type: 'chatBroadcast', payload: { sender: clientData.nickname, message: chatMsg } });
                    } else if (!clientData.nickname) {
                        sendToClient(ws, { type: 'systemMessage', payload: { message: 'Please set a nickname to chat.', isError: true } });
                    }
                    break;

                case 'placeBet':
                    const isBettingPeriod = (gameState === 'INITIAL_BETTING' || gameState === 'FULL_TIME' || gameState === 'PRE_MATCH' || gameState === 'BETWEEN_GAMES'); // BETWEEN_GAMES might occur briefly
                    if (!clientData.nickname) {
                         sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Set nickname to bet.', newBalance: clientData.balance } });
                         break;
                    }
                    if (!isBettingPeriod) {
                        sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting is closed.', newBalance: clientData.balance } });
                        break;
                    }
                    if (clientData.currentBet) {
                        sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Bet already placed.', newBalance: clientData.balance } });
                        break;
                    }
                    const betPayload = data.payload;
                    if (betPayload && (betPayload.team === 'A' || betPayload.team === 'B') && typeof betPayload.amount === 'number' && betPayload.amount > 0) {
                        const amount = Math.floor(betPayload.amount); // Use integers for currency typically
                        if (amount > clientData.balance) {
                            sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Insufficient balance.', newBalance: clientData.balance } });
                        } else {
                            clientData.balance -= amount;
                            clientData.currentBet = { team: betPayload.team, amount: amount };
                            const betOnTeamName = betPayload.team === 'A' ? teamA.name : teamB.name;
                            sendToClient(ws, { type: 'betResult', payload: { success: true, message: `Bet $${amount} on ${betOnTeamName} placed.`, newBalance: clientData.balance } });
                            console.log(`${clientData.nickname} bet $${amount} on ${betPayload.team}`);
                            // Optional: broadcast generic bet message
                            // broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} placed a bet.` }});
                        }
                    } else {
                         sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Invalid bet data.', newBalance: clientData.balance } });
                    }
                    break;

                default:
                    console.log(`Unknown message type from ${clientData.id}: ${data.type}`);
            }

        } catch (error) {
            console.error(`Failed to process message or invalid JSON: ${message}`, error);
        }
    });

    ws.on('close', () => {
        const clientData = clients.get(ws);
        if (clientData) {
            console.log(`Client disconnected: ${clientData.nickname || clientData.id}`);
            if (clientData.nickname) {
                broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} has left.` } });
            }
            clients.delete(ws);
        } else {
            console.log("Unknown client disconnected.");
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clients.get(ws)?.id}:`, error);
        // Attempt to remove client on error as well
        if (clients.has(ws)) {
             clients.delete(ws);
             console.log("Client removed due to error.");
        }
    });
});


// --- Periodic State Broadcast ---
// Less frequent than game logic updates to save bandwidth
setInterval(() => {
    if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') {
        broadcast({
            type: 'gameStateUpdate',
            payload: {
                gameState,
                scoreA, scoreB,
                serverGameTime: calculateCurrentDisplayTime(), // Send calculated time
                players: players, // Send current positions
                ball: ball
            }
        });
    }
     // No need to broadcast empty state during breaks constantly
     // Specific events handle break start/end info
}, 250); // Broadcast state 4 times per second

// Helper to calculate display time based on server state
function calculateCurrentDisplayTime() {
    if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') {
        const realTimeElapsed = Date.now() - halfStartTimeStamp;
        let ingameSeconds = (realTimeElapsed / 1000) * GAME_SPEED_FACTOR;
        if (gameState === 'SECOND_HALF') {
            ingameSeconds += (45 * 60);
        }
        return Math.min(90*60, ingameSeconds); // Cap at 90 mins
    } else if (gameState === 'HALF_TIME') {
        return 45 * 60;
    } else if (gameState === 'FULL_TIME' || gameState === 'BETWEEN_GAMES' || gameState === 'PRE_MATCH') {
         return 90 * 60;
    } else { // INITIALIZING, INITIAL_BETTING
        return 0;
    }
}

// --- Server Start ---
const PORT = process.env.PORT || 3000; // Use environment variable or default
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server listening on port ${PORT}`);
    // Start the simulation sequence once server is listening
    startInitialSequence();
});

console.log("Server script finished initial execution. Waiting for connections...");