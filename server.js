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
});

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
const PASS_PROBABILITY = 0.15;
const SHOT_PROBABILITY = 0.2;
const TACKLE_PROBABILITY = 0.1; // Chance to attempt tackle per tick when close
const TACKLE_COOLDOWN = 20;
const DISPOSSESSED_COOLDOWN = 10;

// --- Team Data ---
// IMPORTANT: Copy the full nationalTeams array here
const nationalTeams = [
    { name: "Argentina", color: "#75AADB", rating: 92 }, { name: "France", color: "#003399", rating: 91 }, { name: "Brazil", color: "#FFDF00", rating: 90 }, { name: "England", color: "#FFFFFF", textColor: "#000000", rating: 89 }, { name: "Belgium", color: "#ED2939", rating: 88 }, { name: "Croatia", color: "#FF0000", rating: 87 }, { name: "Netherlands", color: "#FF6600", rating: 87 }, { name: "Italy", color: "#003399", rating: 86 }, { name: "Portugal", color: "#006600", rating: 86 }, { name: "Spain", color: "#FF0000", rating: 85 }, { name: "Morocco", color: "#006233", rating: 84 }, { name: "Switzerland", color: "#FF0000", rating: 84 }, { name: "USA", color: "#002868", rating: 83 }, { name: "Germany", color: "#000000", rating: 83 }, { name: "Mexico", color: "#006847", rating: 82 }, { name: "Uruguay", color: "#5CBFEB", rating: 82 }, { name: "Colombia", color: "#FCD116", rating: 81 }, { name: "Senegal", color: "#00853F", rating: 81 }, { name: "Denmark", color: "#C60C30", rating: 80 }, { name: "Japan", color: "#000080", rating: 80 }, { name: "Peru", color: "#D91023", rating: 79 }, { name: "Iran", color: "#239F40", rating: 79 }, { name: "Serbia", color: "#C6363C", rating: 78 }, { name: "Poland", color: "#DC143C", rating: 78 }, { name: "Sweden", color: "#006AA7", rating: 78 }, { name: "Ukraine", color: "#005BBB", rating: 77 }, { name: "South Korea", color: "#FFFFFF", textColor:"#000000", rating: 77 }, { name: "Chile", color: "#D52B1E", rating: 76 }, { name: "Tunisia", color: "#E70013", rating: 76 }, { name: "Costa Rica", color: "#002B7F", rating: 75 }, { name: "Australia", color: "#00843D", rating: 75 }, { name: "Nigeria", color: "#008751", rating: 75 }, { name: "Austria", color: "#ED2939", rating: 74 }, { name: "Hungary", color: "#436F4D", rating: 74 }, { name: "Russia", color: "#FFFFFF", textColor:"#000000", rating: 73 }, { name: "Czech Republic", color: "#D7141A", rating: 73 }, { name: "Egypt", color: "#C8102E", rating: 73 }, { name: "Algeria", color: "#006233", rating: 72 }, { name: "Scotland", color: "#0065BF", rating: 72 }, { name: "Norway", color: "#EF2B2D", rating: 72 }, { name: "Turkey", color: "#E30A17", rating: 71 }, { name: "Mali", color: "#14B53A", rating: 71 }, { name: "Paraguay", color: "#DA121A", rating: 70 }, { name: "Ivory Coast", color: "#FF8200", rating: 70 }, { name: "Republic of Ireland", color: "#169B62", rating: 70 }, { name: "Qatar", color: "#8A1538", rating: 69 }, { name: "Saudi Arabia", color: "#006C35", rating: 69 }, { name: "Greece", color: "#0D5EAF", rating: 69 }, { name: "Romania", color: "#002B7F", rating: 68 },
];
let availableTeams = [];

// IMPORTANT: Copy the full sampleSquads object (with representative player names) here
const sampleSquads = {
    "Argentina": ["E Martinez", "N Molina", "C Romero", "L Martinez", "N Tagliafico", "R De Paul", "E Fernandez", "A Mac Allister", "L Messi", "J Alvarez", "A Di Maria"],
    "France": ["M Maignan", "J Kounde", "D Upamecano", "W Saliba", "T Hernandez", "A Tchouameni", "A Rabiot", "A Griezmann", "O Dembele", "K Mbappe", "M Thuram"],
    "Brazil": ["Alisson", "Danilo", "Marquinhos", "G Magalhaes", "Wendell", "B Guimaraes", "Lucas Paqueta", "Rodrygo", "Vinicius Jr", "Raphinha", "Endrick"],
    "England": ["J Pickford", "K Walker", "J Stones", "M Guehi", "K Trippier", "D Rice", "J Bellingham", "B Saka", "P Foden", "C Palmer", "H Kane"],
    "Belgium": ["K Casteels", "T Castagne", "W Faes", "J Vertonghen", "A Theate", "A Onana", "Y Tielemans", "J Doku", "K De Bruyne", "L Trossard", "R Lukaku"],
    "Croatia": ["D Livakovic", "J Stanisic", "J Sutalo", "J Gvardiol", "B Sosa", "M Brozovic", "L Modric", "M Kovacic", "L Majer", "A Kramaric", "A Budimir"],
    "Netherlands": ["B Verbruggen", "D Dumfries", "S de Vrij", "V van Dijk", "N Ake", "J Schouten", "J Veerman", "X Simons", "T Reijnders", "C Gakpo", "M Depay"],
    "Italy": ["G Donnarumma", "G Di Lorenzo", "A Bastoni", "R Calafiori", "F Dimarco", "Jorginho", "N Barella", "D Frattesi", "L Pellegrini", "F Chiesa", "G Scamacca"],
    "Portugal": ["D Costa", "J Cancelo", "Pepe", "Ruben Dias", "N Mendes", "J Palhinha", "Vitinha", "B Fernandes", "B Silva", "R Leao", "C Ronaldo"],
    "Spain": ["U Simon", "D Carvajal", "R Le Normand", "A Laporte", "M Cucurella", "Rodri", "Pedri", "F Ruiz", "L Yamal", "N Williams", "A Morata"],
    "Morocco": ["Y Bounou", "A Hakimi", "N Aguerd", "R Saiss", "N Mazraoui", "S Amrabat", "A Ounahi", "H Ziyech", "S Amallah", "S Boufal", "Y En-Nesyri"],
    "Switzerland": ["Y Sommer", "S Widmer", "M Akanji", "F Schar", "R Rodriguez", "R Freuler", "G Xhaka", "X Shaqiri", "R Vargas", "D Ndoye", "Z Amdouni"],
    "USA": ["M Turner", "S Dest", "C Richards", "T Ream", "A Robinson", "T Adams", "W McKennie", "Y Musah", "C Pulisic", "T Weah", "F Balogun"],
    "Germany": ["M Neuer", "J Kimmich", "A Rüdiger", "J Tah", "M Mittelstädt", "R Andrich", "T Kroos", "J Musiala", "I Gündogan", "F Wirtz", "K Havertz"],
    "Mexico": ["G Ochoa", "J Sanchez", "C Montes", "J Vasquez", "J Gallardo", "E Alvarez", "L Chavez", "O Pineda", "H Lozano", "A Vega", "S Gimenez"],
    "Uruguay": ["S Rochet", "N Nandez", "J Gimenez", "S Coates", "M Olivera", "M Ugarte", "F Valverde", "N De La Cruz", "F Pellistri", "D Nunez", "L Suarez"],
    "Colombia": ["D Ospina", "S Arias", "Y Mina", "D Sanchez", "J Mojica", "W Barrios", "M Uribe", "J Cuadrado", "J Rodriguez", "L Diaz", "R Falcao"],
    "Senegal": ["E Mendy", "K Koulibaly", "A Diallo", "Y Sabaly", "I Jakobs", "P Gueye", "N Mendy", "I Sarr", "S Mane", "B Dia", "N Jackson"],
    "Denmark": ["K Schmeichel", "J Andersen", "A Christensen", "J Vestergaard", "J Maehle", "P Hojbjerg", "M Hjulmand", "C Eriksen", "A Skov Olsen", "M Damsgaard", "R Hojlund"],
    "Japan": ["S Gonda", "H Sakai", "M Yoshida", "K Itakura", "Y Nagatomo", "W Endo", "H Morita", "J Ito", "D Kamada", "K Mitoma", "A Ueda"],
    "Peru": ["P Gallese", "L Advincula", "C Zambrano", "A Callens", "M Trauco", "R Tapia", "Y Yotun", "A Carrillo", "C Cueva", "E Flores", "G Lapadula"],
    "Iran": ["A Beiranvand", "S Moharrami", "M Hosseini", "M Pouraliganji", "E Hajsafi", "S Ezatolahi", "A Noorollahi", "A Jahanbakhsh", "M Taremi", "V Amiri", "S Azmoun"],
    "Serbia": ["V Milinkovic-Savic", "N Milenkovic", "S Pavlovic", "M Veljkovic", "A Zivkovic", "F Kostic", "N Gudelj", "S Milinkovic-Savic", "D Tadic", "A Mitrovic", "D Vlahovic"],
    "Poland": ["W Szczesny", "M Cash", "J Bednarek", "J Kiwior", "B Bereszynski", "K Bielik", "G Krychowiak", "P Zielinski", "P Frankowski", "K Swiderski", "R Lewandowski"],
    "Sweden": ["R Olsen", "E Krafth", "V Lindelof", "I Hien", "L Augustinsson", "A Ekdal", "M Svanberg", "D Kulusevski", "E Forsberg", "A Isak", "V Gyokeres"],
    "Ukraine": ["A Lunin", "Y Konoplya", "I Zabarnyi", "M Matviyenko", "V Mykolenko", "T Stepanenko", "O Zinchenko", "M Mudryk", "H Sudakov", "V Tsygankov", "A Dovbyk"],
    "South Korea": ["Kim S-G", "Kim M-H", "Kim M-J", "Kim Y-G", "Kim J-S", "Jung W-Y", "Hwang I-B", "Lee J-S", "Son H-M", "Hwang H-C", "Cho G-S"],
    "Chile": ["C Bravo", "M Isla", "G Medel", "G Maripan", "G Suazo", "E Pulgar", "A Vidal", "C Aranguiz", "A Sanchez", "B Brereton Diaz", "E Vargas"],
    "Tunisia": ["A Dahmen", "M Talbi", "Y Meriah", "D Bronn", "W Kechrida", "A Laidouni", "E Skhiri", "A Maaloul", "Y Msakni", "N Sliti", "W Khazri"],
    "Costa Rica": ["K Navas", "K Fuller", "O Duarte", "F Calvo", "B Oviedo", "Y Tejeda", "C Borges", "J Campbell", "G Torres", "A Contreras", "J Venegas"],
    "Australia": ["M Ryan", "N Atkinson", "H Souttar", "K Rowles", "A Behich", "A Mooy", "J Irvine", "R McGree", "M Leckie", "C Goodwin", "M Duke"],
    "Nigeria": ["F Uzoho", "O Aina", "W Troost-Ekong", "C Bassey", "Z Sanusi", "F Onyeka", "A Iwobi", "S Chukwueze", "K Iheanacho", "A Lookman", "V Osimhen"],
    "Austria": ["P Pentz", "S Posch", "K Danso", "M Wober", "P Mwene", "N Seiwald", "K Laimer", "C Baumgartner", "M Sabitzer", "P Wimmer", "M Gregoritsch"],
    "Hungary": ["P Gulacsi", "A Fiola", "W Orban", "A Szalai", "L Nego", "A Nagy", "A Schafer", "M Kerkez", "D Szoboszlai", "R Sallai", "B Varga"],
    "Russia": ["M Safonov", "V Karavaev", "G Dzhikiya", "I Diveev", "D Krugovoy", "D Barinov", "D Kuzyaev", "A Golovin", "A Miranchuk", "A Zakharyan", "F Smolov"],
    "Czech Republic": ["J Stanek", "V Coufal", "T Holes", "R Hranac", "L Krejci", "D Jurasek", "T Soucek", "L Provod", "A Barak", "A Hlozek", "P Schick"],
    "Egypt": ["M El Shenawy", "A Hegazi", "M Abdelmonem", "A Fatouh", "O Kamal", "M Elneny", "T Hamed", "Emam Ashour", "M Salah", "O Marmoush", "Mostafa Mohamed"],
    "Algeria": ["R M'Bolhi", "A Mandi", "R Bensebaini", "Y Atal", "R Ait Nouri", "N Bentaleb", "I Bennacer", "S Feghouli", "R Mahrez", "Y Belaïli", "I Slimani"],
    "Scotland": ["A Gunn", "J Hendry", "G Hanley", "K Tierney", "A Ralston", "A Robertson", "B Gilmour", "C McGregor", "S McTominay", "J McGinn", "C Adams"],
    "Norway": ["O Nyland", "K Ajer", "L Ostigard", "S Strandberg", "B Meling", "M Odegaard", "S Berge", "F Aursnes", "A Sorloth", "E Haaland", "O Bobb"],
    "Turkey": ["U Cakir", "Z Celik", "M Demiral", "K Ayhan", "F Kadioglu", "S Ozcan", "H Calhanoglu", "A Guler", "K Akturkoglu", "C Under", "B Yilmaz"],
    "Mali": ["D Diarra", "H Traore", "K Kouyate", "B Fofana", "F Sacko", "A Haidara", "Y Bissouma", "D Samassekou", "M Djenepo", "A Doucoure", "I Kone"],
    "Paraguay": ["A Silva", "R Rojas", "G Gomez", "F Balbuena", "J Alonso", "M Villasanti", "A Cubas", "M Almiron", "J Enciso", "R Sanabria", "A Sanabria"],
    "Ivory Coast": ["Y Fofana", "S Aurier", "W Boly", "E Ndicka", "G Konan", "I Sangare", "F Kessie", "S Fofana", "N Pepe", "S Haller", "W Zaha"],
    "Republic of Ireland": ["G Bazunu", "S Coleman", "J Egan", "N Collins", "M Doherty", "J Cullen", "J Molumby", "J Knight", "C Ogbene", "M Obafemi", "E Ferguson"],
    "Qatar": ["S Al Sheeb", "Pedro Miguel", "B Khoukhi", "A Hassan", "H Ahmed", "K Boudiaf", "A Hatem", "H Al Haydos", "Akram Afif", "Almoez Ali", "M Muntari"],
    "Saudi Arabia": ["M Al Owais", "S Abdulhamid", "A Al Amri", "A Al Bulaihi", "Y Al Shahrani", "A Al Malki", "M Kanno", "S Al Dawsari", "F Al Brikan", "S Al Shehri", "H Bahebri"],
    "Greece": ["O Vlachodimos", "G Baldock", "K Mavropanos", "P Hatzidiakos", "K Tsimikas", "M Siopis", "A Bouchalakis", "P Mantalos", "G Masouras", "T Bakasetas", "V Pavlidis"],
    "Romania": ["F Nita", "A Ratiu", "R Dragusin", "A Burca", "N Bancu", "M Marin", "R Marin", "N Stanciu", "D Man", "V Mihaila", "D Dragus"],
};

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
function setupTeams(teamDataA, teamDataB) { logDebug(`Setting up match: ${teamDataA?.name || '?'} vs ${teamDataB?.name || '?'}`); if (!teamDataA || !teamDataB) { console.error("Cannot setup teams, invalid team data provided."); return false; } teamA = { ...teamDataA, id: 'A', squad: sampleSquads[teamDataA.name] || Array(11).fill(null) }; teamB = { ...teamDataB, id: 'B', squad: sampleSquads[teamDataB.name] || Array(11).fill(null) }; players = []; const formationA = formation433('A'); const formationB = formation433('B'); for (let i = 0; i < 11; i++) { const nameA = teamA.squad[i]; const nameB = teamB.squad[i]; players.push(createPlayer(i, 'A', formationA[i].role, { x: formationA[i].x, y: formationA[i].y }, teamA.color, teamA.textColor, nameA, i)); players.push(createPlayer(i, 'B', formationB[i].role, { x: formationB[i].x, y: formationB[i].y }, teamB.color, teamB.textColor, nameB, i)); } scoreA = 0; scoreB = 0; resetStats(); generateOdds(); clients.forEach(clientData => { clientData.currentBet = null; }); logDebug(`Teams setup complete. Odds: A=${oddsA}, B=${oddsB}. Bets cleared.`); return true; }
function resetPositions(kickingTeamId = null) { logDebug("Resetting positions..."); ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.ownerId = null; players.forEach(p => { p.vx = 0; p.vy = 0; p.hasBall = false; p.state = 'IDLE'; p.targetX = p.baseX; p.targetY = p.baseY; if (kickingTeamId) { if (p.team === kickingTeamId) { if (p.team === 'A') p.x = Math.min(p.baseX, FIELD_WIDTH / 2 - PLAYER_RADIUS * 2); else p.x = Math.max(p.baseX, FIELD_WIDTH / 2 + PLAYER_RADIUS * 2); p.y = p.baseY; } else { if (p.team === 'A') p.x = Math.min(p.baseX, FIELD_WIDTH / 2 - PLAYER_RADIUS * 2); else p.x = Math.max(p.baseX, FIELD_WIDTH / 2 + PLAYER_RADIUS * 2); p.y = p.baseY; } p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x)); p.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, p.y)); } else { p.x = p.baseX; p.y = p.baseY; } }); }
function resetStats() { stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } }; }
function getPlayerById(playerId) { return players.find(p => p.id === playerId); }

// --- Simulation Logic & AI ---
function findClosestTeammate(player) { let closestMate = null; let minDistSq = Infinity; players.forEach(p => { if (p.team === player.team && p !== player) { const dSq = distSq(player.x, player.y, p.x, p.y); if (dSq < minDistSq) { minDistSq = dSq; closestMate = p; } } }); return { teammate: closestMate, distSq: minDistSq }; }
function findClosestOpponent(player) { let closestOpp = null; let minDistSq = Infinity; players.forEach(p => { if (p.team !== player.team) { const dSq = distSq(player.x, player.y, p.x, p.y); if (dSq < minDistSq) { minDistSq = dSq; closestOpp = p; } } }); return { opponent: closestOpp, distSq: minDistSq }; }

// ** IMPROVED AI FUNCTION **
function updatePlayerAI(player) {
    if (!player || !ball) return; // Safety first

    const goalX = player.team === 'A' ? FIELD_WIDTH : 0; // Opponent goal
    const goalY = FIELD_HEIGHT / 2;
    const ownGoalX = player.team === 'A' ? 0 : FIELD_WIDTH; // Own goal

    const playerDistToBallSq = distSq(player.x, player.y, ball.x, ball.y);
    const controlRangeSq = CONTROL_RANGE ** 2;
    const kickRangeSq = KICK_RANGE ** 2; // For shooting/passing distance checks

    const playerOwner = getPlayerById(ball.ownerId);
    const teamHasPossession = playerOwner && playerOwner.team === player.team;
    const opponentHasPossession = playerOwner && playerOwner.team !== player.team;
    const ballIsLoose = !playerOwner;

    player.kickCooldown = Math.max(0, player.kickCooldown - 1);

    // --- GK LOGIC ---
    if (player.role === 'GK') {
        let targetX = player.baseX;
        let targetY = player.baseY;
        const threatDistSq = (FIELD_WIDTH * 0.3)**2;

        if (opponentHasPossession && distSq(playerOwner.x, playerOwner.y, ownGoalX, goalY) < threatDistSq) {
            targetY = FIELD_HEIGHT / 2 + (ball.y - FIELD_HEIGHT / 2) * 0.6;
            targetX = player.baseX + (player.team === 'A' ? -15 : 15);
        }
        else if (ballIsLoose && distSq(ball.x, ball.y, player.baseX, player.baseY) < (FIELD_WIDTH*0.2)**2 ) {
             targetX = ball.x;
             targetY = ball.y;
        }
        else {
             targetY = player.baseY + (ball.y - player.baseY) * 0.15;
             targetX = player.baseX;
        }

        const penaltyAreaWidth = 165;
        const goalLine = (player.team === 'A' ? 0 : FIELD_WIDTH);
        const nearPost = (FIELD_HEIGHT - GOAL_WIDTH)/2 - PLAYER_RADIUS;
        const farPost = (FIELD_HEIGHT + GOAL_WIDTH)/2 + PLAYER_RADIUS;
        targetX = player.team === 'A' ? Math.max(goalLine, Math.min(goalLine + penaltyAreaWidth, targetX))
                                      : Math.max(goalLine - penaltyAreaWidth, Math.min(goalLine, targetX));
        targetY = Math.max(nearPost, Math.min(farPost, targetY));

        player.targetX = targetX;
        player.targetY = targetY;
        movePlayerTowardsTarget(player, PLAYER_SPEED * 0.8);

        if (ballIsLoose && playerDistToBallSq < controlRangeSq * 1.5 && player.kickCooldown <= 0) {
            gainPossession(player);
            const clearTargetX = FIELD_WIDTH / 2;
            const clearTargetY = player.y < FIELD_HEIGHT / 2 ? FIELD_HEIGHT * 0.2 : FIELD_HEIGHT * 0.8;
            shootBall(player, clearTargetX, clearTargetY, SHOT_POWER * 0.8);
            player.kickCooldown = 40;
        }
        return; // --- End GK Logic ---
    }

    // --- OUTFIELD PLAYER LOGIC ---
    if (teamHasPossession) {
        if (playerOwner === player) { // A.1) This player has the ball
            player.state = 'ATTACKING_WITH_BALL';
            ball.ownerId = player.id;

            const distToGoalSq = distSq(player.x, player.y, goalX, goalY);
            const shootRangeSq = (FIELD_WIDTH * SHOOTING_RANGE_FACTOR)**2;
            const { opponent: nearestOpponent, distSq: oppDistSq } = findClosestOpponent(player);
            const underPressure = nearestOpponent && oppDistSq < (PLAYER_RADIUS * 5)**2;

            if (distToGoalSq < shootRangeSq && player.kickCooldown <= 0 && Math.random() < SHOT_PROBABILITY) {
                const shotAngleGood = Math.abs(player.y - goalY) < GOAL_WIDTH * 1.5;
                if (shotAngleGood || Math.random() < 0.1) {
                    player.state = 'SHOOTING';
                    shootBall(player, goalX, goalY + (Math.random() - 0.5) * GOAL_WIDTH * 0.8);
                    stats[player.team === 'A' ? 'teamA' : 'teamB'].shots++;
                    player.kickCooldown = 25;
                    return;
                }
            }

             if (!underPressure && player.kickCooldown <= 0 && Math.random() < PASS_PROBABILITY) {
                let bestPassTarget = null; let bestScore = -Infinity;
                players.forEach(p => {
                    if (p.team === player.team && p !== player) {
                         const targetDistToGoalSq = distSq(p.x, p.y, goalX, goalY);
                         let score = (distToGoalSq - targetDistToGoalSq) - distSq(player.x, player.y, p.x, p.y) * 0.1;
                         if ((player.team === 'A' && p.x < player.x - 50) || (player.team === 'B' && p.x > player.x + 50)) { score -= 5000; }
                         if (score > bestScore) { bestScore = score; bestPassTarget = p; }
                    }
                });
                 if (bestPassTarget && bestScore > -1000) {
                    player.state = 'PASSING'; passBall(player, bestPassTarget);
                    stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++;
                    player.kickCooldown = 15; return;
                }
            }

            player.state = 'DRIBBLING';
             let dribbleTargetX = goalX; let dribbleTargetY = goalY;
             if (underPressure && nearestOpponent) {
                  const angleToOpponent = Math.atan2(nearestOpponent.y - player.y, nearestOpponent.x - player.x);
                  const evadeAngle = angleToOpponent + (player.y < goalY ? -Math.PI / 2 : Math.PI / 2);
                  dribbleTargetX = player.x + Math.cos(evadeAngle) * 50;
                  dribbleTargetY = player.y + Math.sin(evadeAngle) * 50;
                  dribbleTargetX = (dribbleTargetX + goalX) / 2;
                  dribbleTargetY = (dribbleTargetY + goalY) / 2;
             }
            player.targetX = player.x + (dribbleTargetX - player.x) * 0.1;
            player.targetY = player.y + (dribbleTargetY - player.y) * 0.1;
            movePlayerTowardsTarget(player, PLAYER_SPEED * 0.9);
            const angleToTarget = Math.atan2(player.targetY - player.y, player.targetX - player.x);
            ball.x = player.x + Math.cos(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS * 0.8);
            ball.y = player.y + Math.sin(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS * 0.8);
            ball.vx = player.vx; ball.vy = player.vy;
            return;

        } else { // A.2) Teammate has the ball - Support
            player.state = 'ATTACKING_SUPPORT';
            const angleToGoal = Math.atan2(goalY - playerOwner.y, goalX - playerOwner.x);
            const supportDist = SUPPORT_DISTANCE_AVG + (Math.random() - 0.5) * 40;
            let baseTargetX = playerOwner.x + Math.cos(angleToGoal) * supportDist;
            let baseTargetY = playerOwner.y + Math.sin(angleToGoal) * supportDist;

            if (player.role === 'FWD' || (player.role === 'MID' && Math.random() < 0.5)) {
                const sideOffset = (player.baseY < FIELD_HEIGHT / 2 ? -1 : 1) * (50 + Math.random() * 50); baseTargetY += sideOffset;
            } else if (player.role === 'DEF') {
                baseTargetX = (player.baseX + playerOwner.x) / 2; baseTargetY = (player.baseY + playerOwner.y) / 2;
            }
            player.targetX = (baseTargetX + player.baseX) / 2; player.targetY = (baseTargetY + player.baseY) / 2;
            player.targetX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.targetX)); player.targetY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.targetY));
            movePlayerTowardsTarget(player); return;
        }
    }
    else if (opponentHasPossession) { // **B) Opponent Has Possession**
        const chaseRangeFactor = player.role === 'FWD' ? CHASE_RANGE_FACTOR_FWD : (player.role === 'MID' ? CHASE_RANGE_FACTOR_MID : CHASE_RANGE_FACTOR_DEF);
        const chaseRangeSq = (FIELD_WIDTH * chaseRangeFactor) ** 2;
        const distToOwnerSq = distSq(player.x, player.y, playerOwner.x, playerOwner.y);

        if (distToOwnerSq < chaseRangeSq * 0.5) { // B.1) Close enough to press
            player.state = 'DEFENDING_PRESS';
            player.targetX = playerOwner.x; player.targetY = playerOwner.y;
            movePlayerTowardsTarget(player, PLAYER_SPEED * 1.05);
             if (distToOwnerSq < controlRangeSq && player.kickCooldown <= 0 && Math.random() < TACKLE_PROBABILITY) {
                 logDebug(`${player.id} attempts tackle on ${playerOwner.id}`);
                 ball.ownerId = null; ball.vx = (Math.random() - 0.5) * 5; ball.vy = (Math.random() - 0.5) * 5;
                 player.kickCooldown = TACKLE_COOLDOWN; playerOwner.kickCooldown = DISPOSSESSED_COOLDOWN;
            }
            return;
        }
        else { // B.2) Not pressing - Mark or return
            player.state = 'DEFENDING_POSITION';
             let closestOppToMark = null; let minDistSq = Infinity;
             players.forEach(p => { if (p.team !== player.team && p !== playerOwner) { const dSq = distSq(player.x, player.y, p.x, p.y); if (dSq < (FIELD_WIDTH * 0.3)**2 && dSq < minDistSq) { minDistSq = dSq; closestOppToMark = p; } } });

             if (closestOppToMark && player.role !== 'FWD') {
                 player.targetX = (closestOppToMark.x + ownGoalX) / 2; player.targetY = (closestOppToMark.y + goalY) / 2;
                 player.targetX = (player.targetX + player.baseX) / 2; player.targetY = (player.targetY + player.baseY) / 2;
             } else {
                 player.targetX = player.baseX; player.targetY = player.baseY;
                 const ballDistToOwnGoalFactor = Math.max(0, 1 - distSq(ball.x, ball.y, ownGoalX, goalY) / (FIELD_WIDTH*FIELD_WIDTH) );
                 const defensiveShift = (player.baseX - ownGoalX) * 0.3 * ballDistToOwnGoalFactor;
                 player.targetX -= defensiveShift * (player.team === 'A' ? 1 : -1);
             }
            player.targetX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.targetX)); player.targetY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.targetY));
            movePlayerTowardsTarget(player); return;
        }
    }
    else if (ballIsLoose) { // **C) Ball is Loose**
         const chaseRangeFactor = player.role === 'FWD' ? CHASE_RANGE_FACTOR_FWD * 1.1 : (player.role === 'MID' ? CHASE_RANGE_FACTOR_MID * 1.05 : CHASE_RANGE_FACTOR_DEF);
         const chaseRangeSq = (FIELD_WIDTH * chaseRangeFactor) ** 2;

        if (playerDistToBallSq < chaseRangeSq) { // C.1) Close enough to chase
            player.state = 'CHASING_LOOSE_BALL';
            player.targetX = ball.x; player.targetY = ball.y;
            movePlayerTowardsTarget(player, PLAYER_SPEED * 1.1);
            if (playerDistToBallSq < controlRangeSq && player.kickCooldown <= 0) { gainPossession(player); }
            return;
        }
        else { // C.2) Ball is loose but too far away
             player.state = 'RETURNING_TO_POSITION';
             player.targetX = player.baseX; player.targetY = player.baseY;
             movePlayerTowardsTarget(player); return;
        }
    }

    // Fallback: If none of the above conditions met
    player.state = 'IDLE_RETURN';
    player.targetX = player.baseX; player.targetY = player.baseY;
    movePlayerTowardsTarget(player);
}

function movePlayerTowardsTarget(player, speed = PLAYER_SPEED) { const dx = player.targetX - player.x; const dy = player.targetY - player.y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist > speed) { const angle = Math.atan2(dy, dx); player.vx = Math.cos(angle) * speed; player.vy = Math.sin(angle) * speed; } else if (dist > 1){ player.vx = dx; player.vy = dy; } else { player.vx = 0; player.vy = 0; } }
function updatePlayerPosition(player) { player.x += player.vx; player.y += player.vy; player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x)); player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y)); players.forEach(other => { if (player !== other) { const dSq = distSq(player.x, player.y, other.x, other.y); const minDist = PLAYER_RADIUS * 2; if (dSq < minDist * minDist && dSq > 0.01) { const dist = Math.sqrt(dSq); const overlap = minDist - dist; const angle = Math.atan2(player.y - other.y, player.x - other.x); const moveX = (Math.cos(angle) * overlap) / 2; const moveY = (Math.sin(angle) * overlap) / 2; player.x += moveX; player.y += moveY; other.x -= moveX; other.y -= moveY; player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x)); player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y)); other.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, other.x)); other.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, other.y)); } } }); }
function passBall(passer, targetPlayer) { logDebug(`${passer.id} passing to ${targetPlayer.id}`); const dx = targetPlayer.x - passer.x; const dy = targetPlayer.y - passer.y; const dist = Math.sqrt(dx*dx+dy*dy); const angle = Math.atan2(dy, dx); const inaccuracyAngle = (Math.random() - 0.5) * 0.15; const finalAngle = angle + inaccuracyAngle; const power = Math.min(BALL_MAX_SPEED, dist * PASS_POWER_FACTOR + Math.random() * 2); ball.vx = Math.cos(finalAngle) * power; ball.vy = Math.sin(finalAngle) * power; ball.ownerId = null; passer.hasBall = false; }
function shootBall(shooter, targetX, targetY, power = SHOT_POWER) { logDebug(`${shooter.id} shooting towards ${targetX}, ${targetY}`); const dx = targetX - shooter.x; const dy = targetY - shooter.y; const angle = Math.atan2(dy, dx); const inaccuracyAngle = (Math.random() - 0.5) * 0.08; const finalAngle = angle + inaccuracyAngle; ball.vx = Math.cos(finalAngle) * power; ball.vy = Math.sin(finalAngle) * power; ball.ownerId = null; shooter.hasBall = false; }
function updateBallPhysics() { if (!ball) return; if (ball.ownerId) { const owner = getPlayerById(ball.ownerId); if (owner && owner.state === 'DRIBBLING') { /* Dribbling handles ball position */ } else if (owner) { ball.x = owner.x + owner.vx; ball.y = owner.y + owner.vy; ball.vx = 0; ball.vy = 0; } else { ball.ownerId = null; } } if (!ball.ownerId) { ball.x += ball.vx; ball.y += ball.vy; ball.vx *= BALL_FRICTION; ball.vy *= BALL_FRICTION; if (Math.abs(ball.vx) < 0.1) ball.vx = 0; if (Math.abs(ball.vy) < 0.1) ball.vy = 0; if (ball.y < BALL_RADIUS || ball.y > FIELD_HEIGHT - BALL_RADIUS) { ball.vy *= -0.6; ball.y = Math.max(BALL_RADIUS, Math.min(FIELD_HEIGHT - BALL_RADIUS, ball.y)); } const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2; const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2; if (ball.x < GOAL_DEPTH + BALL_RADIUS) { if (ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('A'); return; } else if (ball.x < BALL_RADIUS) { ball.vx *= -0.6; ball.x = BALL_RADIUS; } } if (ball.x > FIELD_WIDTH - GOAL_DEPTH - BALL_RADIUS) { if (ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('B'); return; } else if (ball.x > FIELD_WIDTH - BALL_RADIUS) { ball.vx *= -0.6; ball.x = FIELD_WIDTH - BALL_RADIUS; } } let closestPlayer = null; let minDistSq = CONTROL_RANGE ** 2; players.forEach(p => { if (p.kickCooldown <= 0) { const dSq = distSq(p.x, p.y, ball.x, ball.y); if (dSq < minDistSq) { minDistSq = dSq; closestPlayer = p; } } }); if (closestPlayer) { gainPossession(closestPlayer); } } }
function gainPossession(player) { if (ball.ownerId !== player.id) { logDebug(`${player.id} gained possession.`); const previousOwner = getPlayerById(ball.ownerId); if (previousOwner) previousOwner.hasBall = false; ball.ownerId = player.id; player.hasBall = true; ball.vx = 0; ball.vy = 0; player.state = 'ATTACKING_WITH_BALL'; } }
function handleGoal(scoringTeam) { logDebug(`GOAL by Team ${scoringTeam}! Score: A=${scoreA + (scoringTeam === 'A' ? 1:0)}, B=${scoreB + (scoringTeam === 'B' ? 1:0)}`); if (scoringTeam === 'A') { scoreA++; stats.teamA.goals++; } else { scoreB++; stats.teamB.goals++; } broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB } }); const kickingTeam = scoringTeam === 'A' ? 'B' : 'A'; resetPositions(kickingTeam); }
function updateGame() { if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return; const startTime = Date.now(); try { players.forEach(updatePlayerAI); players.forEach(updatePlayerPosition); updateBallPhysics(); } catch (error) { console.error("Error during game update logic:", error); } const realTimeSinceLastUpdate = MILLISECONDS_PER_UPDATE; const ingameSecondsIncrement = (realTimeSinceLastUpdate / 1000) * GAME_SPEED_FACTOR; serverGameTime += ingameSecondsIncrement; const maxHalfTime = 45 * 60; const maxFullTime = 90 * 60; if (gameState === 'FIRST_HALF' && serverGameTime >= maxHalfTime) { serverGameTime = maxHalfTime; handleHalfTime(); } else if (gameState === 'SECOND_HALF' && serverGameTime >= maxFullTime) { serverGameTime = maxFullTime; handleFullTime(); } const updateDuration = Date.now() - startTime; if (updateDuration > MILLISECONDS_PER_UPDATE * 1.5) { logDebug(`Warning: Game update took ${updateDuration}ms (budget ${MILLISECONDS_PER_UPDATE}ms)`); } }

// --- Game Flow Control ---
function startMatch() { logDebug(`[State Transition] Starting Match: ${teamA?.name} vs ${teamB?.name}`); if (!teamA || !teamB || players.length !== 22) { console.error("Cannot start match, teams/players not set up correctly. Restarting sequence."); startInitialSequence(); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; resetPositions('A'); resetStats(); scoreA = 0; scoreB = 0; serverGameTime = 0; halfStartTimeStamp = Date.now(); gameState = 'FIRST_HALF'; broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } }); gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE); logDebug("Game logic interval started for First Half."); }
function handleHalfTime() { logDebug("[State Transition] Handling Half Time"); if (gameState !== 'FIRST_HALF') { logDebug("Warning: Tried to handle halftime but not in first half state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; gameState = 'HALF_TIME'; serverGameTime = 45 * 60; breakEndTime = Date.now() + HALF_TIME_BREAK_MS; broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime } }); breakTimerTimeout = setTimeout(startSecondHalf, HALF_TIME_BREAK_MS); logDebug(`Halftime break. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`); }
function startSecondHalf() { logDebug("[State Transition] Starting Second Half"); if (gameState !== 'HALF_TIME') { logDebug("Warning: Tried to start second half but not in halftime state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; resetPositions('B'); halfStartTimeStamp = Date.now(); gameState = 'SECOND_HALF'; broadcast({ type: 'secondHalfStart' }); gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE); logDebug("Game logic interval started for Second Half."); }
function handleFullTime() { logDebug("[State Transition] Handling Full Time"); if (gameState !== 'SECOND_HALF') { logDebug("Warning: Tried to handle fulltime but not in second half state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; gameState = 'FULL_TIME'; serverGameTime = 90 * 60; breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS; broadcast({ type: 'fullTime', payload: { scoreA, scoreB, breakEndTime } }); resolveAllBets(); breakTimerTimeout = setTimeout(setupNextMatch, BETWEEN_MATCH_BREAK_MS); logDebug(`Full Time. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`); }
function setupNextMatch() { logDebug("[State Transition] Setting up Next Match"); if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; if (availableTeams.length < 2) { logDebug("Team pool empty, resetting and shuffling."); availableTeams = [...nationalTeams]; shuffleArray(availableTeams); } const nextTeamA = availableTeams.pop(); const nextTeamB = availableTeams.pop(); if (!nextTeamA || !nextTeamB) { console.error("Failed to get next teams! Restarting initial sequence."); startInitialSequence(); return; } if (!setupTeams(nextTeamA, nextTeamB)) { console.error("Failed to setup teams! Restarting initial sequence."); startInitialSequence(); return; } gameState = 'PRE_MATCH'; broadcast({ type: 'currentGameState', payload: createFullGameStatePayload() }); breakTimerTimeout = setTimeout(() => { if (gameState === 'PRE_MATCH') { startMatch(); } else { logDebug(`Warning: Wanted to start match from PRE_MATCH, but state is now ${gameState}`); } }, 2000); logDebug(`Next match setup complete (${teamA.name} vs ${teamB.name}). Starting in 2s.`); }
function resolveAllBets() { logDebug("Resolving all bets..."); const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); clients.forEach((clientData, ws) => { if (clientData.currentBet) { let payout = 0; let message = ""; const bet = clientData.currentBet; const betTeamName = bet.team === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B'; const odds = bet.team === 'A' ? parseFloat(oddsA) : parseFloat(oddsB); if (isNaN(odds) || odds <= 0) { console.error(`Invalid odds (${odds}) for bet resolution for ${clientData.nickname}. Refunding.`); clientData.balance += bet.amount; payout = bet.amount; message = `Error resolving bet due to invalid odds. Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`; logDebug(`Bet refunded (invalid odds) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`); } else if (bet.team === winningTeam) { payout = bet.amount * odds; clientData.balance += payout; message = `Bet on ${betTeamName} WON! +$${payout.toFixed(2)}.`; logDebug(`Bet won for ${clientData.nickname || clientData.id}: +$${payout.toFixed(2)}`); } else if (winningTeam === null) { clientData.balance += bet.amount; payout = bet.amount; message = `Match drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`; logDebug(`Bet refunded (draw) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`); } else { payout = 0; message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`; logDebug(`Bet lost for ${clientData.nickname || clientData.id}: -$${bet.amount.toFixed(2)}`); } sendToClient(ws, { type: 'betResult', payload: { success: payout > 0 || winningTeam === null, message: message, newBalance: clientData.balance } }); clientData.currentBet = null; } }); logDebug("Bet resolution complete."); }

// --- Initial Sequence ---
function startInitialSequence() { console.log("Starting initial server sequence..."); gameState = 'INITIALIZING'; if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; logDebug("Cleared existing timers/intervals."); if (availableTeams.length < 2) { logDebug("Initial sequence: Resetting team pool."); availableTeams = [...nationalTeams]; shuffleArray(availableTeams); } const firstTeamA = availableTeams.pop(); const firstTeamB = availableTeams.pop(); if (!firstTeamA || !firstTeamB) { console.error("Failed to get initial teams! Retrying in 5s..."); breakTimerTimeout = setTimeout(startInitialSequence, 5000); return; } if (!setupTeams(firstTeamA, firstTeamB)) { console.error("Failed to setup initial teams! Retrying in 5s..."); breakTimerTimeout = setTimeout(startInitialSequence, 5000); return; } gameState = 'INITIAL_BETTING'; breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS; logDebug(`Initial betting period ends at ${new Date(breakEndTime).toLocaleTimeString()}`); broadcast({ type: 'initialWait', payload: { teamA, teamB, oddsA, oddsB, breakEndTime } }); breakTimerTimeout = setTimeout(() => { if(gameState === 'INITIAL_BETTING') { logDebug("Initial wait over. Proceeding to setup first match."); setupNextMatch(); } else { logDebug(`Warning: Initial wait timer finished, but game state was already ${gameState}. No action taken.`); } }, INITIAL_BETTING_WAIT_MS); }

// --- WebSocket Connection Handling ---
wss.on('connection', (ws, req) => { const remoteAddress = req.socket.remoteAddress; const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`; logDebug(`Client connected: ${clientId} from ${remoteAddress}`); clients.set(ws, { id: clientId, nickname: null, balance: 100, currentBet: null }); sendToClient(ws, { type: 'currentGameState', payload: createFullGameStatePayload() }); ws.on('message', (message) => { let data; try { if (typeof message !== 'string' && !Buffer.isBuffer(message)) { logDebug(`Received non-string/non-buffer message from ${clientId}, ignoring.`); return; } const messageText = Buffer.isBuffer(message) ? message.toString('utf8') : message; data = JSON.parse(messageText); const clientData = clients.get(ws); if (!clientData) { logDebug(`Received message from stale/unknown client. Terminating.`); ws.terminate(); return; } switch (data.type) { case 'setNickname': const nick = data.payload?.trim(); if (nick && nick.length > 0 && nick.length <= 15) { const oldNickname = clientData.nickname; clientData.nickname = nick; logDebug(`Client ${clientData.id} set nickname to ${nick}`); sendToClient(ws, { type: 'welcome', payload: { nickname: nick, balance: clientData.balance, currentBet: clientData.currentBet } }); if (nick !== oldNickname) { const joinMsg = oldNickname ? `${oldNickname} changed name to ${nick}` : `${nick} has joined.`; broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: joinMsg } }); } } else { logDebug(`Invalid nickname attempt from ${clientData.id}: "${data.payload}"`); sendToClient(ws, { type: 'systemMessage', payload: { message: 'Invalid nickname (1-15 chars).', isError: true } }); } break; case 'chatMessage': if (clientData.nickname && data.payload && typeof data.payload === 'string') { const chatMsg = data.payload.substring(0, 100).trim(); if (chatMsg.length > 0) { broadcast({ type: 'chatBroadcast', payload: { sender: clientData.nickname, message: chatMsg } }); } } else if (!clientData.nickname) { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Please set a nickname to chat.', isError: true } }); } break; case 'placeBet': const isBettingPeriod = (gameState === 'INITIAL_BETTING' || gameState === 'FULL_TIME' || gameState === 'PRE_MATCH' || gameState === 'BETWEEN_GAMES'); if (!clientData.nickname) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Set nickname to bet.', newBalance: clientData.balance } }); break; } if (!isBettingPeriod) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting is currently closed.', newBalance: clientData.balance } }); break; } if (clientData.currentBet) { const betOnTeamName = clientData.currentBet.team === 'A' ? teamA?.name : teamB?.name; sendToClient(ws, { type: 'betResult', payload: { success: false, message: `Bet already placed on ${betOnTeamName}.`, newBalance: clientData.balance } }); break; } const betPayload = data.payload; const betAmount = parseInt(betPayload?.amount, 10); const betTeam = betPayload?.team; if ((betTeam === 'A' || betTeam === 'B') && !isNaN(betAmount) && betAmount > 0) { if (betAmount > clientData.balance) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Insufficient balance.', newBalance: clientData.balance } }); } else { clientData.balance -= betAmount; clientData.currentBet = { team: betTeam, amount: betAmount }; const betOnTeamName = betTeam === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B'; sendToClient(ws, { type: 'betResult', payload: { success: true, message: `Bet $${betAmount} on ${betOnTeamName} placed.`, newBalance: clientData.balance } }); logDebug(`${clientData.nickname} bet $${betAmount} on ${betTeam}`); } } else { logDebug(`Invalid bet attempt from ${clientData.nickname}:`, betPayload); sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Invalid bet amount or team.', newBalance: clientData.balance } }); } break; default: logDebug(`Unknown message type from ${clientData.id}: ${data.type}`); } } catch (error) { console.error(`Failed to process message or invalid JSON from ${clientId}: ${message}`, error); const clientData = clients.get(ws); if (clientData) { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Error processing your request.', isError: true } }); } } }); ws.on('close', (code, reason) => { const clientData = clients.get(ws); const reasonString = reason ? reason.toString() : 'N/A'; if (clientData) { logDebug(`Client disconnected: ${clientData.nickname || clientData.id}. Code: ${code}, Reason: ${reasonString}`); if (clientData.nickname) { broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} has left.` } }); } clients.delete(ws); } else { logDebug(`Unknown client disconnected. Code: ${code}, Reason: ${reasonString}`); } }); ws.on('error', (error) => { const clientData = clients.get(ws); console.error(`WebSocket error for client ${clientData?.nickname || clientData?.id || 'UNKNOWN'}:`, error); if (clients.has(ws)) { logDebug(`Removing client ${clientData?.id || 'UNKNOWN'} due to error.`); clients.delete(ws); } try { ws.terminate(); } catch (e) { /* ignore */ } }); });

// --- Periodic State Broadcast ---
setInterval(() => { if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') { broadcast({ type: 'gameStateUpdate', payload: { scoreA, scoreB, serverGameTime: calculateCurrentDisplayTime(), players: players || [], ball: ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null }, stats: stats } }); } }, 200);

// --- Helper Functions ---
function createFullGameStatePayload() { return { gameState, scoreA, scoreB, teamA, teamB, oddsA, oddsB, serverGameTime: calculateCurrentDisplayTime(), players: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (players || []) : [], ball: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }) : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }, breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null, stats: stats, allTournamentTeams: nationalTeams.map(t => t.name) // Added this line }; }
function calculateCurrentDisplayTime() { if (gameState === 'FIRST_HALF') { return Math.min(45 * 60, serverGameTime); } else if (gameState === 'SECOND_HALF') { return Math.min(90 * 60, serverGameTime); } else if (gameState === 'HALF_TIME') { return 45 * 60; } else if (gameState === 'FULL_TIME' || gameState === 'BETWEEN_GAMES' || gameState === 'PRE_MATCH') { return 90 * 60; } else { return 0; } }

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`HTTP and WebSocket server listening on port ${PORT}`); startInitialSequence(); });

// --- Graceful Shutdown ---
function gracefulShutdown(signal) { console.log(`${signal} received: closing server...`); if (gameLogicInterval) clearInterval(gameLogicInterval); if (breakTimerTimeout) clearTimeout(breakTimerTimeout); server.close(() => { console.log('HTTP server closed.'); wss.close(() => { console.log('WebSocket server closed.'); process.exit(0); }); setTimeout(() => { console.log("Forcing remaining WebSocket connections closed."); wss.clients.forEach(ws => ws.terminate()); }, 2000); }); setTimeout(() => { console.error("Graceful shutdown timeout exceeded. Forcing exit."); process.exit(1); }, 10000); }
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

console.log("Server script finished initial execution. Waiting for connections...");