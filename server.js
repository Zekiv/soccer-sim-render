// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// --- Debug Logging Control ---
const DEBUG_LOG = false; // Set to true for detailed logs
function logDebug(...args) {
    if (DEBUG_LOG) {
        console.log('[DEBUG]', ...args);
    }
}

console.log("Starting server...");

// --- HTTP Server Setup ---
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                console.error("Error loading index.html:", err);
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
}); // End of http.createServer

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });
console.log("WebSocket server attached to HTTP server.");

// --- Game Constants ---
const INITIAL_BETTING_WAIT_MINS = 0.5;
const REAL_MATCH_DURATION_MINS = 2;
const BETWEEN_MATCH_BREAK_MINS = 0.5;
const HALF_TIME_BREAK_S = 15;

// Derived & Gameplay Constants
const INITIAL_BETTING_WAIT_MS = INITIAL_BETTING_WAIT_MINS * 60 * 1000;
const INGAME_MATCH_DURATION_MINS = 90;
const REAL_HALF_DURATION_MS = (REAL_MATCH_DURATION_MINS / 2) * 60 * 1000;
const HALF_TIME_BREAK_MS = HALF_TIME_BREAK_S * 1000;
const BETWEEN_MATCH_BREAK_MS = BETWEEN_MATCH_BREAK_MINS * 60 * 1000;
const UPDATES_PER_SECOND = 30;
const MILLISECONDS_PER_UPDATE = 1000 / UPDATES_PER_SECOND;
const GAME_SPEED_FACTOR = (INGAME_MATCH_DURATION_MINS * 60 * 1000) / (REAL_MATCH_DURATION_MINS * 60 * 1000);
const FIELD_WIDTH = 1050; const FIELD_HEIGHT = 680; const GOAL_WIDTH = 120; const GOAL_DEPTH = 20; const CENTER_CIRCLE_RADIUS = 91.5; const PLAYER_RADIUS = 10; const BALL_RADIUS = 5; const PLAYER_SPEED = 3.5; const BALL_MAX_SPEED = 15; const BALL_FRICTION = 0.985; const SHOT_POWER = 14; const PASS_POWER_FACTOR = 0.6; const KICK_RANGE = PLAYER_RADIUS + BALL_RADIUS + 5; const CONTROL_RANGE = PLAYER_RADIUS + BALL_RADIUS + 2;

// AI Behavior Constants (Tune these!)
const DEFENSIVE_LINE_X_FACTOR = 0.35;
const MIDFIELD_LINE_X_FACTOR = 0.1;
const FORWARD_LINE_X_FACTOR = 0.25;
const CHASE_RANGE_FACTOR_DEF = 0.4;
const CHASE_RANGE_FACTOR_MID = 0.55;
const CHASE_RANGE_FACTOR_FWD = 0.7;
const SUPPORT_DISTANCE_AVG = 80;
const SHOOTING_RANGE_FACTOR = 0.35;
const PASS_PROBABILITY = 0.15; // Base probability
const SHOT_PROBABILITY = 0.2;
const TACKLE_PROBABILITY = 0.1; // Chance to attempt tackle per tick when close
const TACKLE_COOLDOWN = 20;
const DISPOSSESSED_COOLDOWN = 10;

// --- Team Data ---
// COMMENTED OUT FOR TESTING
const nationalTeams = [];
let availableTeams = [];

// COMMENTED OUT FOR TESTING
const sampleSquads = {};

// --- Game State ---
let gameState = 'INITIALIZING';
let serverGameTime = 0;
let halfStartTimeStamp = 0;
let scoreA = 0;
let scoreB = 0;
let teamA = null;
let teamB = null;
let players = [];
let ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null };
let stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } };
let oddsA = 2.00;
let oddsB = 2.00;
let breakEndTime = 0;

let gameLogicInterval = null;
let breakTimerTimeout = null;
let clients = new Map();

// State variables for the *next* match during breaks
let nextMatchTeamA = null;
let nextMatchTeamB = null;
let nextMatchOddsA = 2.00;
let nextMatchOddsB = 2.00;


// --- Utility Functions ---
function getPlayerInitials(name, index = 0) { if (typeof name !== 'string' || name.trim() === '') { return `P${index + 1}`; } const parts = name.trim().split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); } else if (parts.length === 1 && name.length > 0) { return name.substring(0, Math.min(2, name.length)).toUpperCase(); } return `P${index + 1}`; }
function isColorDark(hexColor) { if (!hexColor || typeof hexColor !== 'string') return false; hexColor = hexColor.replace('#', ''); if (hexColor.length !== 6) return false; try { const r = parseInt(hexColor.substring(0, 2), 16); const g = parseInt(hexColor.substring(2, 4), 16); const b = parseInt(hexColor.substring(4, 6), 16); const brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness < 128; } catch (e) { return false; } }
function distSq(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function getRandomElement(arr) { if (!arr || arr.length === 0) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function generateOdds() { if (!teamA || !teamB) { oddsA = 2.00; oddsB = 2.00; return; } const ratingDiff = teamA.rating - teamB.rating; const baseProbA = 0.5 + (ratingDiff / 50); oddsA = Math.max(1.1, 1 / (baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); oddsB = Math.max(1.1, 1 / (1 - baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); logDebug(`Generated Odds: ${teamA.name} (${teamA.rating}) ${oddsA} vs ${teamB.name} (${teamB.rating}) ${oddsB}`); }

function broadcast(data) { const message = JSON.stringify(data); wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) { client.send(message, (err) => { if (err) { console.error("Broadcast send error:", err); } }); } }); }
function sendToClient(ws, data) { const clientData = clients.get(ws); if (ws.readyState === WebSocket.OPEN) { const message = JSON.stringify(data); ws.send(message, (err) => { if (err) { console.error(`Send error to ${clientData?.id || 'UNKNOWN'}:`, err); } }); } else { logDebug(`Attempted to send to closed socket for ${clientData?.id || 'UNKNOWN'}`); } }

// --- Player & Team Setup ---
function createPlayer(id, teamId, role, formationPos, teamColor, textColor, playerName, playerIndex) { const initials = getPlayerInitials(playerName, playerIndex); const finalTextColor = textColor || (isColorDark(teamColor) ? '#FFFFFF' : '#000000'); return { id: `${teamId}-${id}`, team: teamId, role: role, name: playerName || `Player ${playerIndex + 1}`, initials: initials, x: formationPos.x, y: formationPos.y, vx: 0, vy: 0, baseX: formationPos.x, baseY: formationPos.y, targetX: formationPos.x, targetY: formationPos.y, hasBall: false, kickCooldown: 0, state: 'IDLE', color: teamColor, textColor: finalTextColor }; }
const formation433 = (teamId) => { const sideMultiplier = teamId === 'A' ? 1 : -1; const xOffset = FIELD_WIDTH / 2; const yOffset = FIELD_HEIGHT / 2; const gkX = sideMultiplier * (-FIELD_WIDTH * 0.48); const defLineX = sideMultiplier * (-FIELD_WIDTH * DEFENSIVE_LINE_X_FACTOR); const midLineX = sideMultiplier * (-FIELD_WIDTH * MIDFIELD_LINE_X_FACTOR); const fwdLineX = sideMultiplier * (FIELD_WIDTH * FORWARD_LINE_X_FACTOR); const positions = [ { role: 'GK', x: gkX, y: 0 }, { role: 'DEF', x: defLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: -FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX, y: FIELD_HEIGHT * 0.3 }, { role: 'MID', x: midLineX, y: -FIELD_HEIGHT * 0.2 }, { role: 'MID', x: midLineX + sideMultiplier * (20), y: 0 }, { role: 'MID', x: midLineX, y: FIELD_HEIGHT * 0.2 }, { role: 'FWD', x: fwdLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'FWD', x: fwdLineX + sideMultiplier * (30), y: 0 }, { role: 'FWD', x: fwdLineX, y: FIELD_HEIGHT * 0.3 } ]; return positions.map(p => ({ ...p, x: xOffset + p.x, y: yOffset + p.y })); };
function setupTeams(teamDataA, teamDataB) { logDebug(`Setting up match: ${teamDataA?.name || '?'} vs ${teamDataB?.name || '?'}`); if (!teamDataA || !teamDataB) { console.error("Cannot setup teams, invalid team data provided."); return false; } teamA = { ...teamDataA, id: 'A', squad: sampleSquads[teamDataA.name] || Array(11).fill(null) }; teamB = { ...teamDataB, id: 'B', squad: sampleSquads[teamDataB.name] || Array(11).fill(null) }; players = []; const formationA = formation433('A'); const formationB = formation433('B'); for (let i = 0; i < 11; i++) { const nameA = teamA.squad[i]; const nameB = teamB.squad[i]; players.push(createPlayer(i, 'A', formationA[i].role, { x: formationA[i].x, y: formationA[i].y }, teamA.color, teamA.textColor, nameA, i)); players.push(createPlayer(i, 'B', formationB[i].role, { x: formationB[i].x, y: formationB[i].y }, teamB.color, teamB.textColor, nameB, i)); } scoreA = 0; scoreB = 0; resetStats(); generateOdds(); // Generate odds for the NEWLY set up teams clients.forEach(clientData => { clientData.currentBet = null; }); logDebug(`Teams setup complete. Odds: A=${oddsA}, B=${oddsB}. Bets cleared.`); return true; }
function resetPositions(kickingTeamId = null) {
    logDebug("Resetting positions..."); // Using double quotes consistently now
    ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.ownerId = null;
    players.forEach(p => {
        p.vx = 0; p.vy = 0; p.hasBall = false; p.state = 'IDLE';
        p.targetX = p.baseX; p.targetY = p.baseY;
        if (kickingTeamId) { // Position for kickoff
            if (p.team === kickingTeamId) { // Kicking team closer to ball
                 if (p.role === 'FWD' || p.role === 'MID') { // Example: Central forward/mid starts near ball
                     if (p.initials === getPlayerInitials(p.name, 9) || p.initials === getPlayerInitials(p.name, 6) ) { // Identify a central player approx
                         p.x = FIELD_WIDTH / 2 - (p.team === 'A' ? PLAYER_RADIUS : -PLAYER_RADIUS) * 1.1;
                         p.y = FIELD_HEIGHT / 2 + (Math.random() - 0.5) * 20;
                     } else { // Other attackers spread out
                         p.x = FIELD_WIDTH / 2 - (p.team === 'A' ? FIELD_WIDTH * 0.1 : -FIELD_WIDTH * 0.1);
                         p.y = p.baseY + (Math.random() - 0.5) * 50;
                     }
                 } else { // Defenders stay back
                     p.x = p.baseX;
                     p.y = p.baseY;
                 }
            } else { // Non-kicking team outside center circle
                p.x = p.baseX;
                if (p.team === 'A' && p.x > FIELD_WIDTH / 2 - CENTER_CIRCLE_RADIUS) {
                    p.x = FIELD_WIDTH / 2 - CENTER_CIRCLE_RADIUS - PLAYER_RADIUS * 2;
                } else if (p.team === 'B' && p.x < FIELD_WIDTH / 2 + CENTER_CIRCLE_RADIUS) {
                    p.x = FIELD_WIDTH / 2 + CENTER_CIRCLE_RADIUS + PLAYER_RADIUS * 2;
                }
                p.y = p.baseY;
            }
            // Ensure all players are within bounds
            p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x));
            p.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, p.y));
        } else { // Reset to base formation (e.g., after goal)
            p.x = p.baseX;
            p.y = p.baseY;
        }
    });
}
function resetStats() { stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } }; }
function getPlayerById(playerId) { return players.find(p => p.id === playerId); }

// --- Simulation Logic & AI ---
function findClosestTeammate(player) { let closestMate = null; let minDistSq = Infinity; players.forEach(p => { if (p.team === player.team && p !== player) { const dSq = distSq(player.x, player.y, p.x, p.y); if (dSq < minDistSq) { minDistSq = dSq; closestMate = p; } } }); return { teammate: closestMate, distSq: minDistSq }; }
function findClosestOpponent(player) { let closestOpp = null; let minDistSq = Infinity; players.forEach(p => { if (p.team !== player.team) { const dSq = distSq(player.x, player.y, p.x, p.y); if (dSq < minDistSq) { minDistSq = dSq; closestOpp = p; } } }); return { opponent: closestOpp, distSq: minDistSq }; }

// ** updatePlayerAI - BODY COMMENTED OUT FOR TESTING **
function updatePlayerAI(player) {
    // -- START OF COMMENTED OUT BLOCK --
    /*
    if (!player || !ball) return;
    // ... (Entire complex AI logic was here) ...
    */
    // -- END OF COMMENTED OUT BLOCK --

    // Simple fallback if AI is commented out
     if (!player.state || player.state === 'IDLE') {
         player.targetX = player.baseX;
         player.targetY = player.baseY;
         movePlayerTowardsTarget(player, PLAYER_SPEED * 0.5);
     }

} // End of updatePlayerAI function

function movePlayerTowardsTarget(player, speed = PLAYER_SPEED) { const dx = player.targetX - player.x; const dy = player.targetY - player.y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist > speed) { const angle = Math.atan2(dy, dx); player.vx = Math.cos(angle) * speed; player.vy = Math.sin(angle) * speed; } else if (dist > 1){ player.vx = dx; player.vy = dy; } else { player.vx = 0; player.vy = 0; } }

// REVISED: updatePlayerPosition (minor tweak for GK resistance)
function updatePlayerPosition(player) {
    player.x += player.vx;
    player.y += player.vy;

    // Keep player within bounds
    player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));

    // Collision with other players
    players.forEach(other => {
        if (player !== other) {
            const dSq = distSq(player.x, player.y, other.x, other.y);
            const minDist = PLAYER_RADIUS * 2;
            if (dSq < minDist * minDist && dSq > 0.01) {
                const dist = Math.sqrt(dSq);
                const overlap = (minDist - dist) / dist; // Normalized overlap factor
                const moveX = (player.x - other.x) * overlap * 0.5; // Move slightly based on position diff
                const moveY = (player.y - other.y) * overlap * 0.5;

                // Apply separation - slightly less movement for GKs to resist pushing? (Subtle)
                const playerMoveFactor = player.role === 'GK' ? 0.9 : 1.0;
                const otherMoveFactor = other.role === 'GK' ? 0.9 : 1.0;

                player.x += moveX * playerMoveFactor;
                player.y += moveY * playerMoveFactor;
                other.x -= moveX * otherMoveFactor;
                other.y -= moveY * otherMoveFactor;

                // Re-clamp positions after collision adjustment
                player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
                player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));
                other.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, other.x));
                other.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, other.y));

                 // If collision involves player with ball, slightly nudge ball too
                 if (ball.ownerId === player.id || ball.ownerId === other.id) {
                     ball.x += moveX * 0.1; // Less nudge for the ball
                     ball.y += moveY * 0.1;
                 }
            }
        }
    });
} // End of updatePlayerPosition

// REVISED: passBall (predictive target, power/accuracy logic)
function passBall(passer, targetPlayer, powerFactor = PASS_POWER_FACTOR) {
    logDebug(`${passer.id} passing to ${targetPlayer.id}`);
    if (!targetPlayer) {
        logDebug("Pass cancelled: Target player invalid.");
        return; // Don't pass to null
    }
    // Predict target's position slightly ahead based on their current velocity
    const predictTime = 0.2; // Predict 0.2 seconds ahead (adjust as needed)
    const predictedTargetX = targetPlayer.x + targetPlayer.vx * predictTime * UPDATES_PER_SECOND;
    const predictedTargetY = targetPlayer.y + targetPlayer.vy * predictTime * UPDATES_PER_SECOND;

    const dx = predictedTargetX - passer.x;
    const dy = predictedTargetY - passer.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist < 1) return; // Avoid division by zero or tiny passes

    const angle = Math.atan2(dy, dx);
    // Inaccuracy based on distance and maybe pressure?
    const baseInaccuracy = 0.10; // Base inaccuracy angle radians
    const distFactor = Math.min(1, dist / (FIELD_WIDTH * 0.3)); // Scale inaccuracy with distance
    const inaccuracyAngle = (Math.random() - 0.5) * baseInaccuracy * (1 + distFactor);

    const finalAngle = angle + inaccuracyAngle;
    // Power based on distance, clamped
    const power = Math.min(BALL_MAX_SPEED, Math.max(5, dist * powerFactor + Math.random() * 3)); // Ensure minimum pass power

    ball.vx = Math.cos(finalAngle) * power;
    ball.vy = Math.sin(finalAngle) * power;
    ball.ownerId = null; // Ball is now loose
    passer.hasBall = false;
    logDebug(`Pass details - Target: ${targetPlayer.id}, Power: ${power.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}`);
} // End of passBall

// REVISED: shootBall (accuracy logic)
function shootBall(shooter, targetX, targetY, power = SHOT_POWER) {
    logDebug(`${shooter.id} shooting towards ${targetX.toFixed(0)}, ${targetY.toFixed(0)}`);
    const dx = targetX - shooter.x;
    const dy = targetY - shooter.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return; // Avoid shooting at own feet

    const angle = Math.atan2(dy, dx);
    // Shot inaccuracy - less accurate than passes? Maybe more vertical spread?
    const inaccuracyAngle = (Math.random() - 0.5) * 0.10; // Horizontal inaccuracy
    const inaccuracyVertical = (Math.random() - 0.5) * 0.05; // Slight vertical deviation bias?

    const finalAngle = angle + inaccuracyAngle;
    const finalPower = Math.max(power * 0.8, power * (1 + inaccuracyVertical)); // Add slight power variation

    ball.vx = Math.cos(finalAngle) * finalPower;
    ball.vy = Math.sin(finalAngle) * finalPower;
    ball.ownerId = null;
    shooter.hasBall = false;
     logDebug(`Shot details - Power: ${finalPower.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}`);
} // End of shootBall

// REVISED: updateBallPhysics (check possession gain after physics)
function updateBallPhysics() {
    if (!ball) return;
    if (ball.ownerId) {
        const owner = getPlayerById(ball.ownerId);
        if (owner && owner.state === 'DRIBBLING') {
            // Dribbling handles pos update in player AI
        } else if (owner) {
             // Ball held but not dribbling (e.g., immediately after tackle, before pass/shot)
             // Keep ball very close to player
            const angle = Math.atan2(owner.vy, owner.vx); // Use player velocity direction if moving
            const offset = PLAYER_RADIUS + BALL_RADIUS * 0.5;
            ball.x = owner.x + (owner.vx !== 0 || owner.vy !== 0 ? Math.cos(angle) * offset : offset); // Default slightly in front if stationary
            ball.y = owner.y + (owner.vx !== 0 || owner.vy !== 0 ? Math.sin(angle) * offset : 0);
            ball.vx = 0;
            ball.vy = 0;
        } else {
            ball.ownerId = null; // Owner disconnected or invalid
        }
    }
    if (!ball.ownerId) { // Ball is loose
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= BALL_FRICTION;
        ball.vy *= BALL_FRICTION;
        if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
        if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

        // Boundary checks
        if (ball.y < BALL_RADIUS || ball.y > FIELD_HEIGHT - BALL_RADIUS) {
            ball.vy *= -0.6; // Bounce off top/bottom
            ball.y = Math.max(BALL_RADIUS, Math.min(FIELD_HEIGHT - BALL_RADIUS, ball.y));
        }

        // Goal check
        const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2;
        const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2;
        const leftGoalLine = GOAL_DEPTH + BALL_RADIUS;
        const rightGoalLine = FIELD_WIDTH - GOAL_DEPTH - BALL_RADIUS;

        if (ball.x < leftGoalLine) { // Check left goal (Team B scores)
            if (ball.y > goalTopY && ball.y < goalBottomY) {
                handleGoal('B');
                return; // Goal scored, skip further physics this tick
            } else if (ball.x < BALL_RADIUS) { // Bounce off back/side boundary if not in goal
                ball.vx *= -0.6;
                ball.x = BALL_RADIUS;
            }
        } else if (ball.x > rightGoalLine) { // Check right goal (Team A scores)
            if (ball.y > goalTopY && ball.y < goalBottomY) {
                handleGoal('A');
                return; // Goal scored
            } else if (ball.x > FIELD_WIDTH - BALL_RADIUS) { // Bounce off back/side boundary
                ball.vx *= -0.6;
                ball.x = FIELD_WIDTH - BALL_RADIUS;
            }
        }

        // Check for possession gain AFTER physics update
        let closestPlayer = null;
        let minDistSq = controlRangeSq; // Use control range sq
        players.forEach(p => {
            if (p.kickCooldown <= 0) { // Player must be able to control the ball
                const dSq = distSq(p.x, p.y, ball.x, ball.y);
                if (dSq < minDistSq) { // Only consider if within actual control range
                    minDistSq = dSq;
                    closestPlayer = p;
                }
            }
        });
        if (closestPlayer) {
            gainPossession(closestPlayer);
        }
    }
} // End of updateBallPhysics


// REVISED: gainPossession (more robust state update, prevent GK push)
function gainPossession(player) {
    if (!player || player.kickCooldown > 0) return; // Can't gain possession if on cooldown

    // If someone else has it, they lose it
    const previousOwner = getPlayerById(ball.ownerId);
    if (previousOwner && previousOwner !== player) {
        previousOwner.hasBall = false;
        previousOwner.state = 'IDLE_RETURN'; // Or similar non-ball state
        logDebug(`${previousOwner.id} lost possession to ${player.id}`);
    }

    // If this player didn't already have it
    if (ball.ownerId !== player.id) {
        logDebug(`${player.id} gained possession.`);
        ball.ownerId = player.id;
        player.hasBall = true;
        ball.vx = 0; // Stop the ball
        ball.vy = 0;
        player.state = 'ATTACKING_WITH_BALL'; // Set state immediately

        // --- Prevent GK being pushed ---
        // If a player gains possession right on top of their own GK, nudge them slightly apart
        if (player.role !== 'GK') {
            const gk = players.find(p => p.team === player.team && p.role === 'GK');
            if (gk) {
                 const distSqToGK = distSq(player.x, player.y, gk.x, gk.y);
                 if (distSqToGK < (PLAYER_RADIUS * 2.5)**2) {
                     logDebug(`Player ${player.id} too close to own GK ${gk.id}, nudging.`);
                     const angleToGK = Math.atan2(player.y - gk.y, player.x - gk.x);
                     const nudgeDist = PLAYER_RADIUS * 1.5;
                     player.x += Math.cos(angleToGK) * nudgeDist;
                     player.y += Math.sin(angleToGK) * nudgeDist;
                     // Ensure player stays on field
                     player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
                     player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));
                 }
            }
        }
    }
} // End of gainPossession

// REVISED: handleGoal (uses correct kicking team logic)
function handleGoal(scoringTeam) {
    logDebug(`GOAL! Ball pos: (${ball.x.toFixed(1)}, ${ball.y.toFixed(1)}). Scored by Team ${scoringTeam}.`);
    if (scoringTeam === 'A') { // Team A scores on right goal
        scoreA++;
        stats.teamA.goals++;
    } else { // Team B scores on left goal
        scoreB++;
        stats.teamB.goals++;
    }
    logDebug(`Score: A=${scoreA}, B=${scoreB}`);
    broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB } });
    const kickingTeam = scoringTeam === 'A' ? 'B' : 'A'; // Opponent kicks off
    resetPositions(kickingTeam); // Reset positions for kickoff
} // End of handleGoal

function updateGame() {
    if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return;
    const startTime = Date.now();
    try {
        // AI is commented out, so just move players/ball naively
        // players.forEach(updatePlayerAI); // <<<< COMMENTED OUT
        players.forEach(updatePlayerPosition); // Still need to update positions based on velocity
        updateBallPhysics();
    } catch (error) {
        console.error("Error during game update logic:", error);
        // Consider stopping interval or handling error more gracefully
    }
    const realTimeSinceLastUpdate = MILLISECONDS_PER_UPDATE;
    const ingameSecondsIncrement = (realTimeSinceLastUpdate / 1000) * GAME_SPEED_FACTOR;
    serverGameTime += ingameSecondsIncrement;
    const maxHalfTime = 45 * 60;
    const maxFullTime = 90 * 60;

    if (gameState === 'FIRST_HALF' && serverGameTime >= maxHalfTime) {
        serverGameTime = maxHalfTime;
        handleHalfTime();
    } else if (gameState === 'SECOND_HALF' && serverGameTime >= maxFullTime) {
        serverGameTime = maxFullTime;
        handleFullTime();
    }

    const updateDuration = Date.now() - startTime;
    if (updateDuration > MILLISECONDS_PER_UPDATE * 1.5) {
        logDebug(`Warning: Game update took ${updateDuration}ms (budget ${MILLISECONDS_PER_UPDATE}ms)`);
    }
} // End of updateGame

// --- Game Flow Control ---
function startMatch() {
    // Use standard quotes for consistency
    logDebug("[State Transition] Starting Match: " + (teamA?.name || 'Team A') + " vs " + (teamB?.name || 'Team B'));
    if (!teamA || !teamB || players.length !== 22) { // Check players length because team data is empty now
        console.error("Cannot start match, teams/players not set up correctly. Restarting sequence.");
        startInitialSequence(); return;
    }
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;
    resetPositions('A'); // Team A always kicks off first half
    // resetStats(); // Stats should be reset by setupTeams, but ensure here.
    scoreA = 0; scoreB = 0;
    serverGameTime = 0;
    halfStartTimeStamp = Date.now();
    gameState = 'FIRST_HALF';
    broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } });
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for First Half."); // Using double quotes
}
function handleHalfTime() { logDebug("[State Transition] Handling Half Time"); if (gameState !== 'FIRST_HALF') { logDebug("Warning: Tried to handle halftime but not in first half state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; gameState = 'HALF_TIME'; serverGameTime = 45 * 60; breakEndTime = Date.now() + HALF_TIME_BREAK_MS; broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime } }); breakTimerTimeout = setTimeout(startSecondHalf, HALF_TIME_BREAK_MS); logDebug(`Halftime break. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`); }
function startSecondHalf() {
    logDebug("[State Transition] Starting Second Half"); // Using double quotes
    if (gameState !== 'HALF_TIME') {
        logDebug("Warning: Tried to start second half but not in halftime state:", gameState); return;
    }
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;
    resetPositions('B'); // Team B kicks off second half
    halfStartTimeStamp = Date.now();
    gameState = 'SECOND_HALF';
    broadcast({ type: 'secondHalfStart' });
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for Second Half."); // Using double quotes
}

// REVISED: prepareNextMatchDetails (using empty nationalTeams)
function prepareNextMatchDetails() {
    logDebug("Preparing details for the next match (using dummy data)...");
    // Since nationalTeams is empty, provide some dummy data
    if (availableTeams.length < 2) {
        availableTeams = [
            { name: "Team X", color: "#FF0000", rating: 80 },
            { name: "Team Y", color: "#0000FF", rating: 80 },
            { name: "Team Z", color: "#00FF00", rating: 80 },
            { name: "Team W", color: "#FFFF00", rating: 80 },
        ];
         shuffleArray(availableTeams);
    }

    nextMatchTeamA = availableTeams.pop();
    nextMatchTeamB = availableTeams.pop();
     if (!nextMatchTeamA || !nextMatchTeamB) { // Should not happen with dummy data
         nextMatchTeamA = { name: "Default A", color: "#CCCCCC", rating: 75 };
         nextMatchTeamB = { name: "Default B", color: "#333333", rating: 75 };
     }

    // Generate odds for the *upcoming* match
    const currentTeamA = teamA; const currentTeamB = teamB;
    teamA = nextMatchTeamA; teamB = nextMatchTeamB;
    generateOdds();
    nextMatchOddsA = oddsA; nextMatchOddsB = oddsB;
    teamA = currentTeamA; teamB = currentTeamB;

    logDebug(`Next match prepared: ${nextMatchTeamA.name} (${nextMatchOddsA}) vs ${nextMatchTeamB.name} (${nextMatchOddsB})`);
} // End of prepareNextMatchDetails

// REVISED: handleFullTime
function handleFullTime() {
    logDebug("[State Transition] Handling Full Time");
    if (gameState !== 'SECOND_HALF') {
        logDebug("Warning: Tried to handle fulltime but not in second half state:", gameState);
        return;
    }
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);
    breakTimerTimeout = null;

    gameState = 'FULL_TIME'; // Set state first
    serverGameTime = 90 * 60;

    resolveAllBets(); // Resolve bets for the match that just finished

    prepareNextMatchDetails(); // Determine the teams and odds for the *next* match

    breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS;

    // Broadcast full time, including details for the *next* match
    broadcast({
        type: 'fullTime',
        payload: {
            scoreA, scoreB, // Final score of completed match
            breakEndTime,
            // Details for the *next* match for betting:
            nextTeamA: nextMatchTeamA,
            nextTeamB: nextMatchTeamB,
            nextOddsA: nextMatchOddsA,
            nextOddsB: nextMatchOddsB
        }
    });

    // Schedule the function that will actually set up and start the next match
    breakTimerTimeout = setTimeout(setupAndStartNextMatch, BETWEEN_MATCH_BREAK_MS);
    logDebug(`Full Time. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`);
} // End of handleFullTime

// REVISED: setupAndStartNextMatch (was setupNextMatch)
function setupAndStartNextMatch() {
    logDebug("[State Transition] Setting up and starting Next Match");
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);
    breakTimerTimeout = null;

    // Use the prepared teams and odds
    if (!nextMatchTeamA || !nextMatchTeamB) {
        console.error("CRITICAL: Next match teams are null during setup! Restarting initial sequence.");
        startInitialSequence();
        return;
    }

    // Assign the prepared teams/odds to the active game state
    // Since sampleSquads is empty, players won't be created properly, but setupTeams should still return true
    if (!setupTeams(nextMatchTeamA, nextMatchTeamB)) {
         console.error("Failed to setup teams using prepared data! Restarting initial sequence.");
         startInitialSequence();
         return;
    }
    // setupTeams calls generateOdds internally, ensure we use the pre-calculated ones
    oddsA = nextMatchOddsA;
    oddsB = nextMatchOddsB;

    // Clear the prepared details
    nextMatchTeamA = null;
    nextMatchTeamB = null;

    gameState = 'PRE_MATCH';
    // Broadcast the state *before* starting the match, including the now *current* teams/odds
    broadcast({ type: 'currentGameState', payload: createFullGameStatePayload() });

    // Short delay before kick-off
    breakTimerTimeout = setTimeout(() => {
        if (gameState === 'PRE_MATCH') {
            // startMatch will fail if players aren't created due to empty sampleSquads
            logDebug("Attempting to start match (will likely fail due to empty data)...");
            startMatch(); // The actual kick-off
        } else {
            logDebug(`Warning: Wanted to start match from PRE_MATCH, but state is now ${gameState}`);
        }
    }, 2000); // 2 second pre-match display
    logDebug(`Next match setup complete (${teamA.name} vs ${teamB.name}). Starting in 2s.`);
} // End of setupAndStartNextMatch

// REVISED: resolveAllBets (added logging, NaN check)
function resolveAllBets() {
    logDebug("Resolving all bets...");
    const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); // null for draw

    clients.forEach((clientData, ws) => {
        if (clientData.currentBet) {
            const bet = clientData.currentBet;
            const initialBalance = clientData.balance; // Log initial balance
            let payout = 0;
            let message = "";
            const betTeamId = bet.team; // 'A' or 'B'
            // Use the team names stored *with the bet* for the message
            const betTeamName = betTeamId === 'A' ? (bet.teamAName || 'Team A') : (bet.teamBName || 'Team B');
            // Get the odds that were valid for the match just ended (global oddsA/B)
            const oddsVal = betTeamId === 'A' ? oddsA : oddsB;
            const odds = parseFloat(oddsVal);

            logDebug(`Resolving bet for ${clientData.nickname || clientData.id}: Bet $${bet.amount} on Team ${betTeamId} (${betTeamName}) at odds ${oddsVal}. Initial Bal: $${initialBalance.toFixed(2)}`);

            if (isNaN(odds) || odds <= 0) {
                 // Refund if odds are invalid
                 payout = bet.amount;
                 clientData.balance += payout;
                 message = `Error: Invalid odds (${oddsVal}) for match. Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                 logDebug(` -> Refund (Invalid Odds). Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`);
            } else if (betTeamId === winningTeam) {
                 // Bet won
                 payout = bet.amount * odds;
                 clientData.balance += payout; // Add winnings
                 message = `Bet on ${betTeamName} WON! +$${payout.toFixed(2)}.`;
                 logDebug(` -> Won. Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`);
            } else if (winningTeam === null) {
                 // Draw - Refund bet
                 payout = bet.amount;
                 clientData.balance += payout; // Add back the original bet amount
                 message = `Match Drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                 logDebug(` -> Draw (Refund). Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`);
            } else {
                 // Bet lost - payout is 0, balance already reduced when bet was placed
                 payout = 0; // Payout is technically 0
                 message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`;
                  logDebug(` -> Lost. Payout: $${payout.toFixed(2)}. New Bal: $${clientData.balance.toFixed(2)}`); // Balance remains same as after bet placed
            }

            // Send result to client
            sendToClient(ws, {
                type: 'betResult',
                payload: {
                    success: (payout > 0 && winningTeam !== null) || winningTeam === null, // Success if won or refunded (draw/error)
                    message: message,
                    newBalance: clientData.balance // Send the final, updated balance
                }
            });

            clientData.currentBet = null; // Clear the bet after resolving
        }
    }); // End of client loop
    logDebug("Bet resolution complete.");
} // End of resolveAllBets

// --- Initial Sequence ---
// REVISED: startInitialSequence
function startInitialSequence() {
    console.log("Starting initial server sequence...");
    gameState = 'INITIALIZING';
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;
    logDebug("Cleared existing timers/intervals.");

    // Reset potentially stale next match details
    nextMatchTeamA = null;
    nextMatchTeamB = null;

    prepareNextMatchDetails(); // Prepare the first match details (will use dummy data)

     if (!nextMatchTeamA || !nextMatchTeamB) {
         console.error("Failed to get initial teams! Retrying in 5s...");
         breakTimerTimeout = setTimeout(startInitialSequence, 5000);
         return;
     }

     // Set up the *prepared* teams as the current ones for the initial betting phase
     if (!setupTeams(nextMatchTeamA, nextMatchTeamB)) {
         console.error("Failed to setup initial teams! Retrying in 5s...");
         breakTimerTimeout = setTimeout(startInitialSequence, 5000);
         return;
     }
     // Ensure correct odds are set (using the ones prepared)
     oddsA = nextMatchOddsA;
     oddsB = nextMatchOddsB;

     // Clear prepared details as they are now current
     nextMatchTeamA = null;
     nextMatchTeamB = null;

    gameState = 'INITIAL_BETTING';
    breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS;
    logDebug(`Initial betting period for ${teamA.name} vs ${teamB.name}. Ends at ${new Date(breakEndTime).toLocaleTimeString()}`);

    // Broadcast initialWait with the *current* (first) match details
    broadcast({
        type: 'initialWait',
        payload: {
            teamA, teamB, // Current teams for betting
            oddsA, oddsB, // Current odds
            breakEndTime
        }
    });

    breakTimerTimeout = setTimeout(() => {
        if(gameState === 'INITIAL_BETTING') {
            logDebug("Initial wait over. Starting first match.");
            // startMatch will fail if players aren't created due to empty sampleSquads
            logDebug("Attempting to start match (will likely fail due to empty data)...");
            startMatch(); // Directly start the match after initial betting
        } else {
            logDebug(`Warning: Initial wait timer finished, but game state was already ${gameState}. No action taken.`);
        }
    }, INITIAL_BETTING_WAIT_MS);
} // End of startInitialSequence

// --- Helper Functions (Moved Before Usage) ---
// REVISED: createFullGameStatePayload
function createFullGameStatePayload() {
    // Determine which teams/odds to send based on state
    let payloadTeamA = teamA;
    let payloadTeamB = teamB;
    let payloadOddsA = oddsA;
    let payloadOddsB = oddsB;

    // If we are in FULL_TIME break, the client should get NEXT match details
    // for betting display, even though server's 'teamA/B' still hold the *last* match.
    // However, the 'fullTime' message *already* sends next match details separately.
    // So, currentGameState should reflect the state *of the server*.
    // Client UI needs to handle displaying next match info based on the 'fullTime' payload.

    // Exception: If PRE_MATCH, ensure the actual current teams are sent.
    // If INITIAL_BETTING, ensure the actual current teams are sent.
    // The setup functions should handle setting teamA/B correctly before this is called.

    return {
        gameState,
        scoreA, scoreB, // Score always refers to the *last completed* or *current* match
        teamA: payloadTeamA, // Server's current team A concept
        teamB: payloadTeamB, // Server's current team B concept
        oddsA: payloadOddsA, // Server's current odds A concept
        oddsB: payloadOddsB, // Server's current odds B concept
        serverGameTime: calculateCurrentDisplayTime(),
        players: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (players || []) : [],
        ball: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }) : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null },
        breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null,
        stats: stats,
        allTournamentTeams: nationalTeams.map(t => t.name), // Will be empty array now

        // Explicitly add next match details if relevant for betting state display consistency?
        // This might simplify client logic slightly but duplicates 'fullTime' payload info.
        // Let's keep it separate for now for clarity. Client uses 'fullTime' payload.
        // nextMatchInfo: (gameState === 'FULL_TIME') ? { teamA: nextMatchTeamA, teamB: nextMatchTeamB, oddsA: nextMatchOddsA, oddsB: nextMatchOddsB } : null
    };
} // End of createFullGameStatePayload

function calculateCurrentDisplayTime() {
    // This function definition is now here, before setInterval uses it
    if (gameState === 'FIRST_HALF') { return Math.min(45 * 60, serverGameTime); }
    else if (gameState === 'SECOND_HALF') { return Math.min(90 * 60, serverGameTime); }
    else if (gameState === 'HALF_TIME') { return 45 * 60; }
    else if (gameState === 'FULL_TIME' || gameState === 'BETWEEN_GAMES' || gameState === 'PRE_MATCH') { return 90 * 60; }
    else { return 0; }
} // End of calculateCurrentDisplayTime

// --- Periodic State Broadcast ---
setInterval(() => {
    if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') {
        broadcast({
            type: 'gameStateUpdate',
            payload: {
                scoreA, scoreB,
                serverGameTime: calculateCurrentDisplayTime(), // Call the function defined above
                players: players || [],
                ball: ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null },
                stats: stats
            }
        });
    }
}, 200); // End of setInterval

// --- WebSocket Connection Handling ---
wss.on('connection', (ws, req) => {
    const remoteAddress = req.socket.remoteAddress;
    const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    logDebug(`Client connected: ${clientId} from ${remoteAddress}`);
    clients.set(ws, { id: clientId, nickname: null, balance: 100, currentBet: null });

    sendToClient(ws, { type: 'currentGameState', payload: createFullGameStatePayload() });

    ws.on('message', (message) => {
        let data;
        try {
            if (typeof message !== 'string' && !Buffer.isBuffer(message)) {
                logDebug(`Received non-string/non-buffer message from ${clientId}, ignoring.`);
                return;
            }
            const messageText = Buffer.isBuffer(message) ? message.toString('utf8') : message;
            data = JSON.parse(messageText);
            const clientData = clients.get(ws);
            if (!clientData) {
                logDebug(`Received message from stale/unknown client. Terminating.`);
                ws.terminate();
                return;
            }

            // COMMENTED OUT switch statement for testing
            /*
            switch (data.type) {
                case 'setNickname':
                    // ... (original code)
                    break; // End case 'setNickname'

                case 'chatMessage':
                   // ... (original code)
                    break; // End case 'chatMessage'

                case 'placeBet':
                    // ... (original code)
                    break; // End case 'placeBet'

                default:
                    logDebug(`Unknown message type from ${clientData.id}: ${data.type}`);
            } // End switch
            */
            logDebug(`Message received from ${clientData.id}, but handler is commented out.`);


        } catch (error) {
            console.error(`Failed to process message or invalid JSON from ${clientId}: ${message}`, error);
            const clientData = clients.get(ws);
            if (clientData) {
                sendToClient(ws, { type: 'systemMessage', payload: { message: 'Error processing your request.', isError: true } });
            }
        } // End try-catch
    }); // End ws.on('message')

    ws.on('close', (code, reason) => {
        const clientData = clients.get(ws);
        const reasonString = reason ? reason.toString() : 'N/A';
        if (clientData) {
            logDebug(`Client disconnected: ${clientData.nickname || clientData.id}. Code: ${code}, Reason: ${reasonString}`);
            if (clientData.nickname) {
                broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} has left.` } });
            }
            clients.delete(ws);
        } else {
            logDebug(`Unknown client disconnected. Code: ${code}, Reason: ${reasonString}`);
        }
    }); // End ws.on('close')

    ws.on('error', (error) => {
        const clientData = clients.get(ws);
        console.error(`WebSocket error for client ${clientData?.nickname || clientData?.id || 'UNKNOWN'}:`, error);
        if (clients.has(ws)) {
            logDebug(`Removing client ${clientData?.id || 'UNKNOWN'} due to error.`);
            clients.delete(ws);
        }
        try {
            ws.terminate();
        } catch (e) { /* ignore */ }
    }); // End ws.on('error')

}); // End of wss.on('connection')

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server listening on port ${PORT}`);
    // startInitialSequence will run but likely fail to start matches due to empty data
    startInitialSequence();
}); // End server.listen

// --- Graceful Shutdown ---
// Commented out for testing the syntax error
/*
function gracefulShutdown(signal) {
    console.log(`${signal} received: closing server...`);
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);
    server.close(() => {
        console.log('HTTP server closed.');
        wss.close(() => {
            console.log('WebSocket server closed.');
            process.exit(0);
        });
        setTimeout(() => {
            console.log("Forcing remaining WebSocket connections closed.");
            wss.clients.forEach(ws => ws.terminate());
        }, 2000); // Give sockets 2 seconds to close gracefully
    }); // End server.close callback
    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error("Graceful shutdown timeout exceeded. Forcing exit.");
        process.exit(1);
    }, 10000); // 10 seconds timeout
} // End gracefulShutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
*/

console.log("Server script finished initial execution. Waiting for connections...");