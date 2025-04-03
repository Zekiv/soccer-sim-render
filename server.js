// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// --- Debug Logging Control ---
const DEBUG_LOG = false; // Keep false unless actively debugging performance/AI
function logDebug(...args) {
    if (DEBUG_LOG) {
        const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.sss
        console.log(`[DEBUG ${timestamp}]`, ...args);
    }
}
// Error logging is always on
function logError(...args) {
     const timestamp = new Date().toISOString().slice(11, 23);
     console.error(`[ERROR ${timestamp}]`, ...args);
}
// Warning logging is always on
function logWarn(...args) {
    const timestamp = new Date().toISOString().slice(11, 23);
    console.warn(`[WARN ${timestamp}]`, ...args);
}


console.log("Starting server...");

// --- HTTP Server Setup ---
const server = http.createServer((req, res) => {
     logDebug(`HTTP Request: ${req.method} ${req.url}`); // Keep logging

    // 1. Handle requests for the main page (both '/' and '/index.html')
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                logError("Error loading index.html:", err); // Use logError
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error loading HTML');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
            logDebug(`Served index.html for ${req.url}`);
        });
    }
    // 2. Handle favicon (optional but good practice)
    else if (req.url === '/favicon.ico') {
         res.writeHead(204); // No Content
         res.end();
         logDebug(`Responded 204 to favicon request`);
    }
    // 3. Handle all other requests as Not Found
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        logDebug(`Responded 404 to ${req.url}`);
    }
});

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });
console.log("WebSocket server attached to HTTP server.");

// --- Game Constants ---
// ... (Timing, Field Dimensions etc. - unchanged) ...
const INITIAL_BETTING_WAIT_MINS = 0.3;
const REAL_MATCH_DURATION_MINS = 1.5;
const BETWEEN_MATCH_BREAK_MINS = 0.3;
const HALF_TIME_BREAK_S = 10;
const PRE_MATCH_DELAY_MS = 3000;
const INITIAL_BETTING_WAIT_MS = INITIAL_BETTING_WAIT_MINS * 60 * 1000;
const INGAME_MATCH_DURATION_MINS = 90;
const REAL_HALF_DURATION_MS = (REAL_MATCH_DURATION_MINS / 2) * 60 * 1000;
const HALF_TIME_BREAK_MS = HALF_TIME_BREAK_S * 1000;
const BETWEEN_MATCH_BREAK_MS = BETWEEN_MATCH_BREAK_MINS * 60 * 1000;
const UPDATES_PER_SECOND = 30;
const MILLISECONDS_PER_UPDATE = 1000 / UPDATES_PER_SECOND;
const GAME_SPEED_FACTOR = (INGAME_MATCH_DURATION_MINS * 60 * 1000) / (REAL_MATCH_DURATION_MINS * 60 * 1000);
const FIELD_WIDTH = 1050; const FIELD_HEIGHT = 680; const GOAL_WIDTH = 120; const GOAL_DEPTH = 20; const CENTER_CIRCLE_RADIUS = 91.5; const PLAYER_RADIUS = 10; const BALL_RADIUS = 5;
const PENALTY_AREA_WIDTH = 165; const PENALTY_AREA_HEIGHT = 403;

// --- AI & Physics Tuning Constants ---
// ... (Unchanged from previous version) ...
const BASE_PLAYER_SPEED = 3.9;
const PLAYER_SPRINT_MULTIPLIER = 1.5;
const PLAYER_DRIBBLE_SPEED_FACTOR = 0.8;
const GK_SPEED_FACTOR = 0.85;
const BALL_MAX_SPEED = 17; const BALL_FRICTION = 0.975;
const SHOT_POWER_BASE = 15; const SHOT_POWER_VARIANCE = 5;
const PASS_POWER_FACTOR = 0.09; const PASS_MIN_POWER = 6;
const KICK_RANGE = PLAYER_RADIUS + BALL_RADIUS + 5; const CONTROL_RANGE = PLAYER_RADIUS + BALL_RADIUS + 2;
const KICK_COOLDOWN_FRAMES = 12;
const SHOT_INACCURACY_FACTOR = 0.08;
const PASS_INACCURACY_FACTOR = 0.06;
const DRIBBLE_CONTROL_DISTANCE = PLAYER_RADIUS + BALL_RADIUS + 1;
const CHASE_BALL_ANGLE_THRESHOLD = Math.PI / 1.5;
const SUPPORT_DISTANCE_IDEAL = 120;
const SUPPORT_DISTANCE_VARIANCE = 60;
const DEFENSIVE_LINE_X_FACTOR = 0.3;
const DEFENSIVE_MARKING_DISTANCE = 50;
const PRESSING_DISTANCE_FWD = FIELD_WIDTH * 0.5;
const PRESSING_DISTANCE_MID = FIELD_WIDTH * 0.65;
const PRESSING_DISTANCE_DEF = FIELD_WIDTH * 0.8;


// --- Team Data ---
const nationalTeams = [ /* ... FULL LIST ... */ { name: "Argentina", color: "#75AADB", rating: 92 }, { name: "France", color: "#003399", rating: 91 }, { name: "Brazil", color: "#FFDF00", rating: 90 }, { name: "England", color: "#FFFFFF", textColor: "#000000", rating: 89 }, { name: "Belgium", color: "#ED2939", rating: 88 }, { name: "Croatia", color: "#FF0000", rating: 87 }, { name: "Netherlands", color: "#FF6600", rating: 87 }, { name: "Italy", color: "#003399", rating: 86 }, { name: "Portugal", color: "#006600", rating: 86 }, { name: "Spain", color: "#FF0000", rating: 85 }, { name: "Morocco", color: "#006233", rating: 84 }, { name: "Switzerland", color: "#FF0000", rating: 84 }, { name: "USA", color: "#002868", rating: 83 }, { name: "Germany", color: "#000000", rating: 83 }, { name: "Mexico", color: "#006847", rating: 82 }, { name: "Uruguay", color: "#5CBFEB", rating: 82 }, { name: "Colombia", color: "#FCD116", rating: 81 }, { name: "Senegal", color: "#00853F", rating: 81 }, { name: "Denmark", color: "#C60C30", rating: 80 }, { name: "Japan", color: "#000080", rating: 80 }, { name: "Peru", color: "#D91023", rating: 79 }, { name: "Iran", color: "#239F40", rating: 79 }, { name: "Serbia", color: "#C6363C", rating: 78 }, { name: "Poland", color: "#DC143C", rating: 78 }, { name: "Sweden", color: "#006AA7", rating: 78 }, { name: "Ukraine", color: "#005BBB", rating: 77 }, { name: "South Korea", color: "#FFFFFF", textColor:"#000000", rating: 77 }, { name: "Chile", color: "#D52B1E", rating: 76 }, { name: "Tunisia", color: "#E70013", rating: 76 }, { name: "Costa Rica", color: "#002B7F", rating: 75 }, { name: "Australia", color: "#00843D", rating: 75 }, { name: "Nigeria", color: "#008751", rating: 75 }, { name: "Austria", color: "#ED2939", rating: 74 }, { name: "Hungary", color: "#436F4D", rating: 74 }, { name: "Russia", color: "#FFFFFF", textColor:"#000000", rating: 73 }, { name: "Czech Republic", color: "#D7141A", rating: 73 }, { name: "Egypt", color: "#C8102E", rating: 73 }, { name: "Algeria", color: "#006233", rating: 72 }, { name: "Scotland", color: "#0065BF", rating: 72 }, { name: "Norway", color: "#EF2B2D", rating: 72 }, { name: "Turkey", color: "#E30A17", rating: 71 }, { name: "Mali", color: "#14B53A", rating: 71 }, { name: "Paraguay", color: "#DA121A", rating: 70 }, { name: "Ivory Coast", color: "#FF8200", rating: 70 }, { name: "Republic of Ireland", color: "#169B62", rating: 70 }, { name: "Qatar", color: "#8A1538", rating: 69 }, { name: "Saudi Arabia", color: "#006C35", rating: 69 }, { name: "Greece", color: "#0D5EAF", rating: 69 }, { name: "Romania", color: "#002B7F", rating: 68 }, ];
let availableTeams = [];
const sampleSquads = { /* ... FULL SQUADS OBJECT ... */ "Argentina": ["E Martinez", "N Molina", "C Romero", "L Martinez", "N Tagliafico", "R De Paul", "E Fernandez", "A Mac Allister", "L Messi", "J Alvarez", "A Di Maria"], "France": ["M Maignan", "J Kounde", "D Upamecano", "W Saliba", "T Hernandez", "A Tchouameni", "A Rabiot", "A Griezmann", "O Dembele", "K Mbappe", "M Thuram"], "Brazil": ["Alisson", "Danilo", "Marquinhos", "G Magalhaes", "Wendell", "B Guimaraes", "Lucas Paqueta", "Rodrygo", "Vinicius Jr", "Raphinha", "Endrick"], "England": ["J Pickford", "K Walker", "J Stones", "M Guehi", "K Trippier", "D Rice", "J Bellingham", "B Saka", "P Foden", "C Palmer", "H Kane"], "Belgium": ["K Casteels", "T Castagne", "W Faes", "J Vertonghen", "A Theate", "A Onana", "Y Tielemans", "J Doku", "K De Bruyne", "L Trossard", "R Lukaku"], "Croatia": ["D Livakovic", "J Stanisic", "J Sutalo", "J Gvardiol", "B Sosa", "M Brozovic", "L Modric", "M Kovacic", "L Majer", "A Kramaric", "A Budimir"], "Netherlands": ["B Verbruggen", "D Dumfries", "S de Vrij", "V van Dijk", "N Ake", "J Schouten", "J Veerman", "X Simons", "T Reijnders", "C Gakpo", "M Depay"], "Italy": ["G Donnarumma", "G Di Lorenzo", "A Bastoni", "R Calafiori", "F Dimarco", "Jorginho", "N Barella", "D Frattesi", "L Pellegrini", "F Chiesa", "G Scamacca"], "Portugal": ["D Costa", "J Cancelo", "Pepe", "Ruben Dias", "N Mendes", "J Palhinha", "Vitinha", "B Fernandes", "B Silva", "R Leao", "C Ronaldo"], "Spain": ["U Simon", "D Carvajal", "R Le Normand", "A Laporte", "M Cucurella", "Rodri", "Pedri", "F Ruiz", "L Yamal", "N Williams", "A Morata"], "Morocco": ["Y Bounou", "A Hakimi", "N Aguerd", "R Saiss", "N Mazraoui", "S Amrabat", "A Ounahi", "H Ziyech", "S Amallah", "S Boufal", "Y En-Nesyri"], "Switzerland": ["Y Sommer", "S Widmer", "M Akanji", "F Schar", "R Rodriguez", "R Freuler", "G Xhaka", "X Shaqiri", "R Vargas", "D Ndoye", "Z Amdouni"], "USA": ["M Turner", "S Dest", "C Richards", "T Ream", "A Robinson", "T Adams", "W McKennie", "Y Musah", "C Pulisic", "T Weah", "F Balogun"], "Germany": ["M Neuer", "J Kimmich", "A Rüdiger", "J Tah", "M Mittelstädt", "R Andrich", "T Kroos", "J Musiala", "I Gündogan", "F Wirtz", "K Havertz"], "Mexico": ["G Ochoa", "J Sanchez", "C Montes", "J Vasquez", "J Gallardo", "E Alvarez", "L Chavez", "O Pineda", "H Lozano", "A Vega", "S Gimenez"], "Uruguay": ["S Rochet", "N Nandez", "J Gimenez", "S Coates", "M Olivera", "M Ugarte", "F Valverde", "N De La Cruz", "F Pellistri", "D Nunez", "L Suarez"], "Colombia": ["D Ospina", "S Arias", "Y Mina", "D Sanchez", "J Mojica", "W Barrios", "M Uribe", "J Cuadrado", "J Rodriguez", "L Diaz", "R Falcao"], "Senegal": ["E Mendy", "K Koulibaly", "A Diallo", "Y Sabaly", "I Jakobs", "P Gueye", "N Mendy", "I Sarr", "S Mane", "B Dia", "N Jackson"], "Denmark": ["K Schmeichel", "J Andersen", "A Christensen", "J Vestergaard", "J Maehle", "P Hojbjerg", "M Hjulmand", "C Eriksen", "A Skov Olsen", "M Damsgaard", "R Hojlund"], "Japan": ["S Gonda", "H Sakai", "M Yoshida", "K Itakura", "Y Nagatomo", "W Endo", "H Morita", "J Ito", "D Kamada", "K Mitoma", "A Ueda"], "Peru": ["P Gallese", "L Advincula", "C Zambrano", "A Callens", "M Trauco", "R Tapia", "Y Yotun", "A Carrillo", "C Cueva", "E Flores", "G Lapadula"], "Iran": ["A Beiranvand", "S Moharrami", "M Hosseini", "M Pouraliganji", "E Hajsafi", "S Ezatolahi", "A Noorollahi", "A Jahanbakhsh", "M Taremi", "V Amiri", "S Azmoun"], "Serbia": ["V Milinkovic-Savic", "N Milenkovic", "S Pavlovic", "M Veljkovic", "A Zivkovic", "F Kostic", "N Gudelj", "S Milinkovic-Savic", "D Tadic", "A Mitrovic", "D Vlahovic"], "Poland": ["W Szczesny", "M Cash", "J Bednarek", "J Kiwior", "B Bereszynski", "K Bielik", "G Krychowiak", "P Zielinski", "P Frankowski", "K Swiderski", "R Lewandowski"], "Sweden": ["R Olsen", "E Krafth", "V Lindelof", "I Hien", "L Augustinsson", "A Ekdal", "M Svanberg", "D Kulusevski", "E Forsberg", "A Isak", "V Gyokeres"], "Ukraine": ["A Lunin", "Y Konoplya", "I Zabarnyi", "M Matviyenko", "V Mykolenko", "T Stepanenko", "O Zinchenko", "M Mudryk", "H Sudakov", "V Tsygankov", "A Dovbyk"], "South Korea": ["Kim S-G", "Kim M-H", "Kim M-J", "Kim Y-G", "Kim J-S", "Jung W-Y", "Hwang I-B", "Lee J-S", "Son H-M", "Hwang H-C", "Cho G-S"], "Chile": ["C Bravo", "M Isla", "G Medel", "G Maripan", "G Suazo", "E Pulgar", "A Vidal", "C Aranguiz", "A Sanchez", "B Brereton Diaz", "E Vargas"], "Tunisia": ["A Dahmen", "M Talbi", "Y Meriah", "D Bronn", "W Kechrida", "A Laidouni", "E Skhiri", "A Maaloul", "Y Msakni", "N Sliti", "W Khazri"], "Costa Rica": ["K Navas", "K Fuller", "O Duarte", "F Calvo", "B Oviedo", "Y Tejeda", "C Borges", "J Campbell", "G Torres", "A Contreras", "J Venegas"], "Australia": ["M Ryan", "N Atkinson", "H Souttar", "K Rowles", "A Behich", "A Mooy", "J Irvine", "R McGree", "M Leckie", "C Goodwin", "M Duke"], "Nigeria": ["F Uzoho", "O Aina", "W Troost-Ekong", "C Bassey", "Z Sanusi", "F Onyeka", "A Iwobi", "S Chukwueze", "K Iheanacho", "A Lookman", "V Osimhen"], "Austria": ["P Pentz", "S Posch", "K Danso", "M Wober", "P Mwene", "N Seiwald", "K Laimer", "C Baumgartner", "M Sabitzer", "P Wimmer", "M Gregoritsch"], "Hungary": ["P Gulacsi", "A Fiola", "W Orban", "A Szalai", "L Nego", "A Nagy", "A Schafer", "M Kerkez", "D Szoboszlai", "R Sallai", "B Varga"], "Russia": ["M Safonov", "V Karavaev", "G Dzhikiya", "I Diveev", "D Krugovoy", "D Barinov", "D Kuzyaev", "A Golovin", "A Miranchuk", "A Zakharyan", "F Smolov"], "Czech Republic": ["J Stanek", "V Coufal", "T Holes", "R Hranac", "L Krejci", "D Jurasek", "T Soucek", "L Provod", "A Barak", "A Hlozek", "P Schick"], "Egypt": ["M El Shenawy", "A Hegazi", "M Abdelmonem", "A Fatouh", "O Kamal", "M Elneny", "T Hamed", "Emam Ashour", "M Salah", "O Marmoush", "Mostafa Mohamed"], "Algeria": ["R M'Bolhi", "A Mandi", "R Bensebaini", "Y Atal", "R Ait Nouri", "N Bentaleb", "I Bennacer", "S Feghouli", "R Mahrez", "Y Belaïli", "I Slimani"], "Scotland": ["A Gunn", "J Hendry", "G Hanley", "K Tierney", "A Ralston", "A Robertson", "B Gilmour", "C McGregor", "S McTominay", "J McGinn", "C Adams"], "Norway": ["O Nyland", "K Ajer", "L Ostigard", "S Strandberg", "B Meling", "M Odegaard", "S Berge", "F Aursnes", "A Sorloth", "E Haaland", "O Bobb"], "Turkey": ["U Cakir", "Z Celik", "M Demiral", "K Ayhan", "F Kadioglu", "S Ozcan", "H Calhanoglu", "A Guler", "K Akturkoglu", "C Under", "B Yilmaz"], "Mali": ["D Diarra", "H Traore", "K Kouyate", "B Fofana", "F Sacko", "A Haidara", "Y Bissouma", "D Samassekou", "M Djenepo", "A Doucoure", "I Kone"], "Paraguay": ["A Silva", "R Rojas", "G Gomez", "F Balbuena", "J Alonso", "M Villasanti", "A Cubas", "M Almiron", "J Enciso", "R Sanabria", "A Sanabria"], "Ivory Coast": ["Y Fofana", "S Aurier", "W Boly", "E Ndicka", "G Konan", "I Sangare", "F Kessie", "S Fofana", "N Pepe", "S Haller", "W Zaha"], "Republic of Ireland": ["G Bazunu", "S Coleman", "J Egan", "N Collins", "M Doherty", "J Cullen", "J Molumby", "J Knight", "C Ogbene", "M Obafemi", "E Ferguson"], "Qatar": ["S Al Sheeb", "Pedro Miguel", "B Khoukhi", "A Hassan", "H Ahmed", "K Boudiaf", "A Hatem", "H Al Haydos", "Akram Afif", "Almoez Ali", "M Muntari"], "Saudi Arabia": ["M Al Owais", "S Abdulhamid", "A Al Amri", "A Al Bulaihi", "Y Al Shahrani", "A Al Malki", "M Kanno", "S Al Dawsari", "F Al Brikan", "S Al Shehri", "H Bahebri"], "Greece": ["O Vlachodimos", "G Baldock", "K Mavropanos", "P Hatzidiakos", "K Tsimikas", "M Siopis", "A Bouchalakis", "P Mantalos", "G Masouras", "T Bakasetas", "V Pavlidis"], "Romania": ["F Nita", "A Ratiu", "R Dragusin", "A Burca", "N Bancu", "M Marin", "R Marin", "N Stanciu", "D Man", "V Mihaila", "D Dragus"], };

// --- Game State ---
// ... (gameState, serverGameTime, etc. - unchanged declarations) ...
let gameState = 'INITIALIZING';
let serverGameTime = 0;
let lastUpdateTimestamp = 0;
let scoreA = 0; let scoreB = 0;
let teamA = null; let teamB = null;
let players = [];
let ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null };
let stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } };
let oddsA = 2.00; let oddsB = 2.00;
let breakEndTime = 0;
let nextMatchDetails = null;
let gameLogicInterval = null;
let breakTimerTimeout = null;
let clients = new Map();

// --- Utility Functions ---
// ... (getPlayerInitials, isColorDark, distSq, shuffleArray, getRandomElement, generateOdds, broadcast, sendToClient - unchanged) ...
function getPlayerInitials(name, index = 0) { if (typeof name !== 'string' || name.trim() === '') { return `P${index + 1}`; } const parts = name.trim().split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); } else if (parts.length === 1 && name.length > 0) { return name.substring(0, Math.min(2, name.length)).toUpperCase(); } return `P${index + 1}`; }
function isColorDark(hexColor) { if (!hexColor || typeof hexColor !== 'string') return false; hexColor = hexColor.replace('#', ''); if (hexColor.length !== 6) return false; try { const r = parseInt(hexColor.substring(0, 2), 16); const g = parseInt(hexColor.substring(2, 4), 16); const b = parseInt(hexColor.substring(4, 6), 16); const brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness < 128; } catch (e) { return false; } }
function distSq(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function getRandomElement(arr) { if (!arr || arr.length === 0) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function generateOdds(ratingA, ratingB) { const ratingDiff = ratingA - ratingB; const probA = 0.5 + (ratingDiff / 100) + (Math.random() - 0.5) * 0.1; const probB = 1.0 - probA; const margin = 0.05 + Math.random() * 0.03; let calculatedOddsA = Math.max(1.05, 1 / (probA * (1 - margin))); let calculatedOddsB = Math.max(1.05, 1 / (probB * (1 - margin))); if ((probA > probB && calculatedOddsA > calculatedOddsB) || (probB > probA && calculatedOddsB > calculatedOddsA)) { if (calculatedOddsA > calculatedOddsB) calculatedOddsA = calculatedOddsB + 0.1 + Math.random() * 0.1; else calculatedOddsB = calculatedOddsA + 0.1 + Math.random() * 0.1; } logDebug(`Ratings: A=${ratingA}, B=${ratingB}. Probs: A=${probA.toFixed(3)}, B=${probB.toFixed(3)}. Odds: A=${calculatedOddsA.toFixed(2)}, B=${calculatedOddsB.toFixed(2)}`); return { oddsA: parseFloat(calculatedOddsA.toFixed(2)), oddsB: parseFloat(calculatedOddsB.toFixed(2)) }; }
function broadcast(data) { const message = JSON.stringify(data); wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) { client.send(message, (err) => { if (err) { logError("Broadcast send error:", err); } }); } }); }
function sendToClient(ws, data) { const clientData = clients.get(ws); if (ws.readyState === WebSocket.OPEN) { const message = JSON.stringify(data); ws.send(message, (err) => { if (err) { logError(`Send error to ${clientData?.id || 'UNKNOWN'}:`, err); } }); } else { logDebug(`Attempted to send to closed socket for ${clientData?.id || 'UNKNOWN'}`); } }

// --- Player & Team Setup ---
// ADDED: NaN check in createPlayer just in case formation data is bad
function createPlayer(id, teamId, role, formationPos, teamColor, textColor, playerName, playerIndex) {
    const initials = getPlayerInitials(playerName, playerIndex);
    const finalTextColor = textColor || (isColorDark(teamColor) ? '#FFFFFF' : '#000000');
     // Safety check for formation position
     let safeX = formationPos.x;
     let safeY = formationPos.y;
     if (isNaN(safeX) || isNaN(safeY)) {
         logError(`Invalid formation position for player ${teamId}-${id}: ${formationPos.x}, ${formationPos.y}. Resetting to center.`);
         safeX = FIELD_WIDTH / 2;
         safeY = FIELD_HEIGHT / 2;
     }

    return {
        id: `${teamId}-${id}`, team: teamId, role: role,
        name: playerName || `Player ${playerIndex + 1}`, initials: initials,
        x: safeX, y: safeY, vx: 0, vy: 0,
        baseX: safeX, baseY: safeY, // Store base position
        targetX: safeX, targetY: safeY, // Current target
        state: 'IDLE',
        kickCooldown: 0, color: teamColor, textColor: finalTextColor,
        hasBall: false,
        dribbleTicks: 0 // Track consecutive ticks with ball
    };
}
const formation433 = (teamId) => { /* ... unchanged ... */ const sideMultiplier = teamId === 'A' ? 1 : -1; const xOffset = FIELD_WIDTH / 2; const yOffset = FIELD_HEIGHT / 2; const gkX = sideMultiplier * (-FIELD_WIDTH * 0.48); const defLineX = sideMultiplier * (-FIELD_WIDTH * 0.35); const midLineX = sideMultiplier * (-FIELD_WIDTH * 0.1); const fwdLineX = sideMultiplier * (FIELD_WIDTH * 0.25); const positions = [ { role: 'GK', x: gkX, y: 0 }, { role: 'DEF', x: defLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: -FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX, y: FIELD_HEIGHT * 0.3 }, { role: 'MID', x: midLineX, y: -FIELD_HEIGHT * 0.2 }, { role: 'MID', x: midLineX + sideMultiplier * (20), y: 0 }, { role: 'MID', x: midLineX, y: FIELD_HEIGHT * 0.2 }, { role: 'FWD', x: fwdLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'FWD', x: fwdLineX + sideMultiplier * (30), y: 0 }, { role: 'FWD', x: fwdLineX, y: FIELD_HEIGHT * 0.3 } ]; return positions.map(p => ({ ...p, x: xOffset + p.x, y: yOffset + p.y })); };
function setupTeams(teamDataA, teamDataB) { /* ... unchanged ... */ logDebug(`Setting up match: ${teamDataA?.name || '?'} vs ${teamDataB?.name || '?'}`); if (!teamDataA || !teamDataB) { logError("Cannot setup teams, invalid team data provided."); return false; } teamA = { ...teamDataA, id: 'A', squad: sampleSquads[teamDataA.name] || Array(11).fill(null) }; teamB = { ...teamDataB, id: 'B', squad: sampleSquads[teamDataB.name] || Array(11).fill(null) }; players = []; const formationA = formation433('A'); const formationB = formation433('B'); for (let i = 0; i < 11; i++) { const nameA = teamA.squad[i]; const nameB = teamB.squad[i]; players.push(createPlayer(i, 'A', formationA[i].role, { x: formationA[i].x, y: formationA[i].y }, teamA.color, teamA.textColor, nameA, i)); players.push(createPlayer(i, 'B', formationB[i].role, { x: formationB[i].x, y: formationB[i].y }, teamB.color, teamB.textColor, nameB, i)); } scoreA = 0; scoreB = 0; resetStats(); const generatedOdds = generateOdds(teamA.rating, teamB.rating); oddsA = generatedOdds.oddsA; oddsB = generatedOdds.oddsB; clients.forEach(clientData => { clientData.currentBet = null; }); logDebug(`Teams setup complete. Odds: A=${oddsA}, B=${oddsB}. Client bets cleared.`); return true; }
// REVISED resetPositions with extra checks and state setting
function resetPositions(kickingTeamId = null) {
    logDebug(`Resetting positions. Kicking team: ${kickingTeamId || 'None'}`);

    // Explicitly clear ball state FIRST
    ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2;
    ball.vx = 0; ball.vy = 0;
    ball.ownerId = null;

    let kickerFound = false;
    players.forEach(p => {
        // Explicitly clear player ball state and set to IDLE
        p.hasBall = false;
        p.state = 'IDLE'; // Ensure starting state is IDLE
        p.vx = 0; p.vy = 0;
        p.kickCooldown = 0; // Ensure cooldown is reset
        p.dribbleTicks = 0; // Reset dribble counter

        // Reset position to base first
        p.x = p.baseX; p.y = p.baseY;
         // Validate base positions
         if (isNaN(p.x) || isNaN(p.y)) {
             logError(`Player ${p.id} has NaN base position! Resetting to center.`);
             p.x = FIELD_WIDTH / 2; p.y = FIELD_HEIGHT / 2;
             p.baseX = p.x; p.baseY = p.y; // Fix base as well
         }

        // Apply kickoff positioning adjustments
        if (kickingTeamId) {
            // Non-kicking team must be in their own half
            if (p.team !== kickingTeamId) {
                if (p.team === 'A' && p.x > FIELD_WIDTH / 2 - PLAYER_RADIUS) {
                    p.x = FIELD_WIDTH / 2 - PLAYER_RADIUS * 2;
                } else if (p.team === 'B' && p.x < FIELD_WIDTH / 2 + PLAYER_RADIUS) {
                    p.x = FIELD_WIDTH / 2 + PLAYER_RADIUS * 2;
                }
            }
            // Kicking team players (except one) must be in own half
            else { // p.team === kickingTeamId
                if (p.team === 'A' && p.x > FIELD_WIDTH / 2 - PLAYER_RADIUS) {
                     p.x = FIELD_WIDTH / 2 - PLAYER_RADIUS * 2;
                } else if (p.team === 'B' && p.x < FIELD_WIDTH / 2 + PLAYER_RADIUS) {
                     p.x = FIELD_WIDTH / 2 + PLAYER_RADIUS * 2;
                }
                // Designate one central attacker/midfielder as the kicker near the ball
                if (!kickerFound && (p.role === 'FWD' || p.role === 'MID') && Math.abs(p.y - FIELD_HEIGHT / 2) < FIELD_HEIGHT * 0.25) { // Slightly wider Y range for kicker selection
                     p.x = FIELD_WIDTH / 2 - (p.team === 'A' ? PLAYER_RADIUS + BALL_RADIUS + 2 : - (PLAYER_RADIUS + BALL_RADIUS + 2));
                     p.y = FIELD_HEIGHT / 2;
                     kickerFound = true;
                     logDebug(`Designated kicker: ${p.id} (${p.name}) at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                }
            }
        }
         // Clamp positions just in case AND validate after potential adjustment
         p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x));
         p.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, p.y));
         if (isNaN(p.x) || isNaN(p.y)) {
             logError(`Player ${p.id} has NaN position after kickoff adjustment! Resetting to base.`);
             p.x = p.baseX; p.y = p.baseY;
         }
         // Set initial target to current position
         p.targetX = p.x; p.targetY = p.y;
    });

     // Fallback kicker logic (unchanged)
     if (kickingTeamId && !kickerFound) { const fallbackKicker = players.find(p => p.team === kickingTeamId && (p.role === 'FWD' || p.role === 'MID')); if (fallbackKicker) { fallbackKicker.x = FIELD_WIDTH / 2 - (fallbackKicker.team === 'A' ? PLAYER_RADIUS + BALL_RADIUS + 2 : - (PLAYER_RADIUS + BALL_RADIUS + 2)); fallbackKicker.y = FIELD_HEIGHT / 2; logDebug(`Fallback designated kicker: ${fallbackKicker.id} (${fallbackKicker.name})`); } else { logWarn("Could not find any kicker for kickoff!"); } }
      logDebug(`Positions reset complete.`);
}

function resetStats() { /* ... unchanged ... */ stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } }; }
function getPlayerById(playerId) { /* ... unchanged ... */ return players.find(p => p.id === playerId); }


// --- Simulation Logic ---

// REVISED calculateDynamicFormationPos with NaN checks
function calculateDynamicFormationPos(player, ballX, ballY) {
    // Ensure baseX/Y are valid numbers
    if (isNaN(player.baseX) || isNaN(player.baseY)) {
        logError(`Invalid base position for player ${player.id}: ${player.baseX}, ${player.baseY}. Using center fallback.`);
        return { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 };
    }
     // Ensure ball positions are valid
     if (isNaN(ballX) || isNaN(ballY)) {
         logWarn(`Invalid ball position (${ballX},${ballY}) passed to calculateDynamicFormationPos for player ${player.id}. Using base.`);
          return { x: player.baseX, y: player.baseY }; // Use base if ball pos is invalid
     }

    let targetX = player.baseX;
    let targetY = player.baseY;

    // General vertical shift based on ball Y
    targetY += (ballY - player.baseY) * 0.3;

    // Horizontal shift based on role and ball X
    const horizontalShiftFactor = (ballX - FIELD_WIDTH / 2) * 0.4;
    if (isNaN(horizontalShiftFactor)){
         logWarn(`NaN horizontalShiftFactor calculated for ${player.id}. BallX: ${ballX}. Using 0.`);
          horizontalShiftFactor = 0;
     }

    if (player.role === 'DEF') {
        targetX = player.baseX + horizontalShiftFactor * DEFENSIVE_LINE_X_FACTOR;
        const defensiveLimitX = player.team === 'A' ? FIELD_WIDTH * 0.45 : FIELD_WIDTH * 0.55;
        if (player.team === 'A') targetX = Math.min(targetX, defensiveLimitX);
        else targetX = Math.max(targetX, defensiveLimitX);
    } else if (player.role === 'MID') {
        targetX = player.baseX + horizontalShiftFactor * 0.7;
    } else if (player.role === 'FWD') {
        targetX = player.baseX + horizontalShiftFactor * 0.9;
    }

    // Clamp to field - Important
    targetX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, targetX));
    targetY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, targetY));

    // Final safety check for NaN before returning
    if (isNaN(targetX) || isNaN(targetY)) {
         logError(`NaN target calculated for ${player.id}. Base: ${player.baseX},${player.baseY}. Ball: ${ballX},${ballY}. Factors: ${horizontalShiftFactor}, Role: ${player.role}. Returning base.`);
          return { x: player.baseX, y: player.baseY }; // Return base position if calculation somehow failed
    }

    return { x: targetX, y: targetY };
}

// isPassRisky (Unchanged)
function isPassRisky(passer, targetPlayer) { const dx = targetPlayer.x - passer.x; const dy = targetPlayer.y - passer.y; const passDist = Math.sqrt(dx*dx + dy*dy); if (passDist < 10) return false; const passAngle = Math.atan2(dy, dx); for (const opp of players) { if (opp.team !== passer.team) { const oppDx = opp.x - passer.x; const oppDy = opp.y - passer.y; const distToOpp = Math.sqrt(oppDx*oppDx + oppDy*oppDy); if (distToOpp < passDist + 20) { const angleToOpp = Math.atan2(oppDy, oppDx); const angleDiff = Math.abs(passAngle - angleToOpp); if (angleDiff < 0.2 || angleDiff > Math.PI*2 - 0.2) { const perpDist = Math.abs(distToOpp * Math.sin(angleDiff)); if (perpDist < PLAYER_RADIUS * 4) { logDebug(`Risky pass detected from ${passer.id} to ${targetPlayer.id} (Opponent ${opp.id} nearby)`); return true; } } } } } return false; }
// findClosestPlayers (Unchanged)
function findClosestPlayers(teamId, x, y, count = 1) { return players .filter(p => p.team === teamId) .map(p => ({ player: p, distSq: distSq(p.x, p.y, x, y) })) .sort((a, b) => a.distSq - b.distSq) .slice(0, count) .map(item => item.player); }


// --- MAIN AI UPDATE FUNCTION (with dribble timeout fail-safe) ---
function updatePlayerAI(player) {
    // Ensure player object is valid
     if (!player || isNaN(player.x) || isNaN(player.y)) {
         logError(`Invalid player object or NaN position in updatePlayerAI for ID: ${player?.id}. Skipping update.`);
         // Attempt recovery if player exists but pos is NaN
          if(player && (isNaN(player.x) || isNaN(player.y))){
              logWarn(`Attempting to reset position for player ${player.id}`);
              player.x = player.baseX; player.y = player.baseY;
              player.vx = 0; player.vy = 0; player.state = 'IDLE';
          }
         return;
     }
      // Ensure ball object is valid
      if (!ball || isNaN(ball.x) || isNaN(ball.y)) {
          logError(`Invalid ball object or NaN position in updatePlayerAI. Ball: ${JSON.stringify(ball)}. Skipping player ${player.id} update.`);
          // Potentially reset ball position if needed?
          // ball.x = FIELD_WIDTH/2; ball.y = FIELD_HEIGHT/2; ball.vx = 0; ball.vy = 0; ball.ownerId = null;
          return; // Skip player logic if ball is invalid
      }


    player.kickCooldown = Math.max(0, player.kickCooldown - 1);
    const playerDistToBallSq = distSq(player.x, player.y, ball.x, ball.y);
    const canControlBall = playerDistToBallSq < CONTROL_RANGE ** 2;
    const canKickBall = playerDistToBallSq < KICK_RANGE ** 2;
    const hasPossession = ball.ownerId === player.id;
    const teamPossession = ball.ownerId && getPlayerById(ball.ownerId)?.team === player.team;
    const oppPossession = ball.ownerId && getPlayerById(ball.ownerId)?.team !== player.team;
    const ballIsLoose = ball.ownerId === null;

    const goalX = player.team === 'A' ? FIELD_WIDTH : 0;
    const goalY = FIELD_HEIGHT / 2;
    const ownGoalX = player.team === 'A' ? 0 : FIELD_WIDTH;
    const ownGoalY = FIELD_HEIGHT / 2;

    // GK LOGIC (Unchanged)
    if (player.role === 'GK') { /* ... GK logic ... */ const penaltyBoxTop = (FIELD_HEIGHT - PENALTY_AREA_HEIGHT) / 2; const penaltyBoxBottom = (FIELD_HEIGHT + PENALTY_AREA_HEIGHT) / 2; const penaltyBoxXNear = player.team === 'A' ? 0 : FIELD_WIDTH - PENALTY_AREA_WIDTH; const penaltyBoxXFar = player.team === 'A' ? PENALTY_AREA_WIDTH : FIELD_WIDTH; const sixYardBoxXFar = player.team === 'A' ? 55 : FIELD_WIDTH - 55; let targetX = player.baseX; let targetY = player.baseY; const ballDistToOwnGoalSq = distSq(ball.x, ball.y, ownGoalX, ownGoalY); const threatDistanceSq = (FIELD_WIDTH * 0.4) ** 2; if (ballDistToOwnGoalSq < threatDistanceSq || oppPossession) { player.state = 'GK_POSITIONING'; targetY = ownGoalY + (ball.y - ownGoalY) * 0.7; targetY = Math.max(penaltyBoxTop + PLAYER_RADIUS, Math.min(penaltyBoxBottom - PLAYER_RADIUS, targetY)); let depthFactor = Math.max(0, 1 - Math.sqrt(ballDistToOwnGoalSq) / (FIELD_WIDTH * 0.3)); targetX = ownGoalX + (player.team === 'A' ? 1 : -1) * (GOAL_DEPTH + PLAYER_RADIUS + (sixYardBoxXFar - (ownGoalX + GOAL_DEPTH)) * (1 - depthFactor) * 0.5); } else { player.state = 'IDLE'; targetX = player.baseX; targetY = player.baseY; } targetX = player.team === 'A' ? Math.max(PLAYER_RADIUS, Math.min(penaltyBoxXFar - PLAYER_RADIUS, targetX)) : Math.max(penaltyBoxXNear + PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, targetX)); player.targetX = targetX; player.targetY = targetY; movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * GK_SPEED_FACTOR); if (ballIsLoose && canControlBall && player.kickCooldown <= 0) { logDebug(`GK ${player.id} claiming loose ball`); gainPossession(player); player.kickCooldown = KICK_COOLDOWN_FRAMES * 2; let clearTargetX = player.team === 'A' ? FIELD_WIDTH * 0.4 : FIELD_WIDTH * 0.6; let clearTargetY = Math.random() < 0.5 ? FIELD_HEIGHT * 0.2 : FIELD_HEIGHT * 0.8; logDebug(`GK ${player.id} clearing towards ${clearTargetX.toFixed(0)}, ${clearTargetY.toFixed(0)}`); shootBall(player, clearTargetX, clearTargetY, SHOT_POWER_BASE * 0.8); stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++; return; } return; }

    // ======== OUTFIELD PLAYER LOGIC ========

    // --- 1. ON BALL ACTIONS ---
    if (hasPossession) {
        player.dribbleTicks++;
        const MAX_DRIBBLE_TICKS = UPDATES_PER_SECOND * 5;
        if (player.dribbleTicks > MAX_DRIBBLE_TICKS) {
            logWarn(`FAILSAFE: ${player.id} stuck dribbling (${player.dribbleTicks} ticks). Forcing action.`);
             let forceTargetX = player.team === 'A' ? player.x + 200 : player.x - 200;
             let forceTargetY = player.y + (Math.random() - 0.5) * 100;
             forceTargetX = Math.max(0, Math.min(FIELD_WIDTH, forceTargetX));
             forceTargetY = Math.max(0, Math.min(FIELD_HEIGHT, forceTargetY));
             if (player.kickCooldown <= 0 && !isNaN(forceTargetX) && !isNaN(forceTargetY)) { // Check target validity
                 passBall(player, { x: forceTargetX, y: forceTargetY, id: 'FORCED_TARGET' });
                 stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++;
                 player.kickCooldown = KICK_COOLDOWN_FRAMES;
                 player.dribbleTicks = 0; return;
             }
        }

        player.state = 'DRIBBLING';
        const distToGoalSq = distSq(player.x, player.y, goalX, goalY);
        const isNearOwnGoal = distSq(player.x, player.y, ownGoalX, ownGoalY) < (FIELD_WIDTH * 0.3)**2;
        const shootRangeSq = (FIELD_WIDTH * 0.4)**2;
        const shootProbability = isNearOwnGoal ? 0.01 : (0.1 + 0.4 * (1 - Math.sqrt(distToGoalSq) / (FIELD_WIDTH * 0.6)));
        if (distToGoalSq < shootRangeSq && player.kickCooldown <= 0 && Math.random() < shootProbability) {
            player.state = 'SHOOTING'; shootBall(player, goalX, goalY + (Math.random() - 0.5) * GOAL_WIDTH * 1.2); stats[player.team === 'A' ? 'teamA' : 'teamB'].shots++; player.kickCooldown = KICK_COOLDOWN_FRAMES; player.dribbleTicks = 0; return;
        }

        let bestPassTarget = findBestPassOption(player);
        let passIsRisky = bestPassTarget ? isPassRisky(player, bestPassTarget) : true;
        const passProbability = isNearOwnGoal ? 0.6 : (0.2 + (bestPassTarget ? 0.3 : -0.2) - (passIsRisky ? 0.2 : 0));
        if (bestPassTarget && player.kickCooldown <= 0 && Math.random() < passProbability && !passIsRisky) {
             player.state = 'PASSING'; passBall(player, bestPassTarget); stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++; player.kickCooldown = KICK_COoldown_FRAMES; player.dribbleTicks = 0; return;
        }

        const [nearestOpponent] = findClosestPlayers(player.team === 'A' ? 'B' : 'A', player.x, player.y);
        let targetX = goalX; let targetY = goalY;
        if (nearestOpponent && distSq(player.x, player.y, nearestOpponent.x, nearestOpponent.y) < (SUPPORT_DISTANCE_IDEAL * 0.8)**2) {
            const angleToOpp = Math.atan2(nearestOpponent.y - player.y, nearestOpponent.x - player.x);
            const angleToGoal = Math.atan2(goalY - player.y, goalX - player.x);
             if(!isNaN(angleToOpp) && !isNaN(angleToGoal)){ // NaN check for angles
                  let dribbleAngle = angleToOpp + Math.PI + (angleToGoal - (angleToOpp + Math.PI)) * 0.5;
                  targetX = player.x + Math.cos(dribbleAngle) * 100;
                  targetY = player.y + Math.sin(dribbleAngle) * 100;
             } else {
                  logWarn(`NaN angle in dribbling logic for ${player.id}. Dribbling straight.`);
             }

        } else { targetY += (Math.random() - 0.5) * FIELD_HEIGHT * 0.2; }
        player.targetX = targetX; player.targetY = targetY;
        movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * PLAYER_DRIBBLE_SPEED_FACTOR, true);
        return;
    } else { player.dribbleTicks = 0; } // Reset dribble counter if not possessing

    // --- 2. OFF BALL ACTIONS (TEAM HAS POSSESSION) ---
    if (teamPossession) {
        player.state = 'SUPPORTING';
        const ballCarrier = getPlayerById(ball.ownerId);
        if (!ballCarrier || isNaN(ballCarrier.x) || isNaN(ballCarrier.y)) { // Validate ball carrier
             logWarn(`Invalid ball carrier (${ball.ownerId}) in SUPPORTING state for ${player.id}. Reverting to RETURNING.`);
             player.state = 'RETURNING'; // Fallback state
        } else {
            // ... (existing supporting logic to find bestSupportX/Y) ...
             let bestSupportX = player.x; let bestSupportY = player.y; let bestScore = -Infinity; const searchRadius = SUPPORT_DISTANCE_IDEAL + SUPPORT_DISTANCE_VARIANCE; for (let i = 0; i < 8; i++) { let angle = (i / 8) * Math.PI * 2; let dist = SUPPORT_DISTANCE_IDEAL + (Math.random() - 0.5) * SUPPORT_DISTANCE_VARIANCE * 2; let candidateX = ballCarrier.x + Math.cos(angle) * dist; let candidateY = ballCarrier.y + Math.sin(angle) * dist; candidateX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, candidateX)); candidateY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, candidateY)); let score = 0; const [nearestOpp] = findClosestPlayers(player.team === 'A' ? 'B' : 'A', candidateX, candidateY); if (nearestOpp && !isNaN(nearestOpp.x) && !isNaN(nearestOpp.y)) score += Math.sqrt(distSq(candidateX, candidateY, nearestOpp.x, nearestOpp.y)); else score += 100; /* Assume open space if no opponent found or opponent invalid */ const currentDistToGoalSq = distSq(player.x, player.y, goalX, goalY); const candidateDistToGoalSq = distSq(candidateX, candidateY, goalX, goalY); if (candidateDistToGoalSq < currentDistToGoalSq) score *= 1.2; if ((player.role === 'FWD' || player.role === 'MID') && ((player.team === 'A' && candidateX < ballCarrier.x - 50) || (player.team === 'B' && candidateX > ballCarrier.x + 50))) { score *= 0.5; } if (score > bestScore) { bestScore = score; bestSupportX = candidateX; bestSupportY = candidateY; } }
             player.targetX = bestSupportX; player.targetY = bestSupportY;
             movePlayerTowardsTarget(player, BASE_PLAYER_SPEED);
             return;
        }
    }

    // --- 3. OFF BALL ACTIONS (OPPONENT HAS POSSESSION or BALL LOOSE) ---
    let shouldChase = false;
    let pressingDistanceSq = 0;
    if (player.role === 'FWD') pressingDistanceSq = PRESSING_DISTANCE_FWD ** 2;
    else if (player.role === 'MID') pressingDistanceSq = PRESSING_DISTANCE_MID ** 2;
    else pressingDistanceSq = PRESSING_DISTANCE_DEF ** 2;

    if ((oppPossession || ballIsLoose) && playerDistToBallSq < pressingDistanceSq) {
        const [closestTeammateToBall] = findClosestPlayers(player.team, ball.x, ball.y);
        if (closestTeammateToBall === player) { shouldChase = true; }
    }

    if (shouldChase) {
        player.state = ballIsLoose ? 'CHASING_LOOSE' : 'PRESSING';
        player.targetX = ball.x; player.targetY = ball.y;
        movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * PLAYER_SPRINT_MULTIPLIER);
        if (canControlBall && player.kickCooldown <= 0) { gainPossession(player); }
        return;
    } else if (oppPossession) {
        player.state = 'MARKING/HOLDING';
        const ballCarrier = getPlayerById(ball.ownerId);
         // Validate ballCarrier exists and has valid position
         if (!ballCarrier || isNaN(ballCarrier.x) || isNaN(ballCarrier.y)) {
              logWarn(`Invalid ball carrier (${ball.ownerId}) in MARKING/HOLDING state for ${player.id}. Reverting to RETURNING.`);
               player.state = 'RETURNING'; // Fallback state
          } else {
                let markTarget = null;
                if (player.role === 'DEF' || player.role === 'MID') {
                    let closestOpponentDistSq = Infinity;
                     players.forEach(opp => {
                         // Ensure opponent is valid
                         if (opp.team !== player.team && opp.role !== 'GK' && !isNaN(opp.x) && !isNaN(opp.y)) {
                              const dSq = distSq(player.x, player.y, opp.x, opp.y);
                              const dangerZoneSq = (FIELD_WIDTH * 0.4)**2;
                              if (dSq < dangerZoneSq && dSq < closestOpponentDistSq) {
                                  closestOpponentDistSq = dSq;
                                  markTarget = opp;
                              }
                         }
                     });
                 }

                 if (markTarget && !isNaN(markTarget.x) && !isNaN(markTarget.y)) { // Validate mark target
                      // Calculate target between marker and own goal
                      const distToOwnGoal = Math.sqrt(distSq(markTarget.x, markTarget.y, ownGoalX, ownGoalY) + 1); // Avoid division by zero
                      player.targetX = markTarget.x + (ownGoalX - markTarget.x) * (DEFENSIVE_MARKING_DISTANCE / distToOwnGoal);
                      player.targetY = markTarget.y + (ownGoalY - markTarget.y) * (DEFENSIVE_MARKING_DISTANCE / distToOwnGoal);
                  } else { // No specific target or target invalid, hold dynamic position
                      const dynamicPos = calculateDynamicFormationPos(player, ball.x, ball.y);
                      player.targetX = dynamicPos.x;
                      player.targetY = dynamicPos.y;
                  }
                  movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * 0.9);
                  return;
            }
    }
    // --- 4. Default: Return to formation position ---
     // This block executes if team doesn't have possession AND player isn't chasing/marking
     // OR if team has possession but supporting logic failed (e.g., invalid ball carrier)
     // OR if hasPossession logic somehow didn't return
    player.state = 'RETURNING';
    const dynamicPos = calculateDynamicFormationPos(player, ball.x, ball.y);
    player.targetX = dynamicPos.x;
    player.targetY = dynamicPos.y;
    movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * 0.9);
    // No return here, allows updatePlayerPosition to run
}


// --- Other Simulation Functions ---

// REVISED movePlayerTowardsTarget with NaN checks
function movePlayerTowardsTarget(player, speed = BASE_PLAYER_SPEED, isDribbling = false) {
    // Validate inputs
    if (!player || isNaN(player.x) || isNaN(player.y) || isNaN(player.targetX) || isNaN(player.targetY) || isNaN(speed)) {
        logError(`Invalid input to movePlayerTowardsTarget for ${player?.id}. Pos:(${player?.x},${player?.y}), Target:(${player?.targetX},${player?.targetY}), Speed:${speed}`);
        if(player){ player.vx = 0; player.vy = 0; } // Stop player if possible
        return;
    }

    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const distSqVal = dx * dx + dy * dy; // Use square distance first
    const dist = distSqVal > 0.0001 ? Math.sqrt(distSqVal) : 0; // Calculate sqrt only if needed, handle zero case

    if (dist < 1 || isNaN(dist)) { // Already at target or invalid distance
        player.vx = 0; player.vy = 0;
        return;
    }

    const angle = Math.atan2(dy, dx);
    const currentSpeed = Math.min(speed, dist); // Don't overshoot target

    if (isNaN(angle) || isNaN(currentSpeed)) {
        logError(`NaN angle(${angle}) or currentSpeed(${currentSpeed}) calculated for ${player.id}. Dist: ${dist}, Speed: ${speed}. Stopping.`);
        player.vx = 0; player.vy = 0;
        return;
    }

    player.vx = Math.cos(angle) * currentSpeed;
    player.vy = Math.sin(angle) * currentSpeed;

     // Final NaN check for velocity
     if (isNaN(player.vx) || isNaN(player.vy)) {
         logError(`Player ${player.id} calculated NaN velocity AFTER assignment. Angle: ${angle}, Speed: ${currentSpeed}, Dist: ${dist}. Stopping.`);
         player.vx = 0; player.vy = 0;
     }

    // Handle dribbling ball position update
    if (isDribbling && ball.ownerId === player.id && !isNaN(angle)) { // Ensure angle is valid
        ball.x = player.x + Math.cos(angle) * DRIBBLE_CONTROL_DISTANCE;
        ball.y = player.y + Math.sin(angle) * DRIBBLE_CONTROL_DISTANCE;
        ball.vx = player.vx * 0.6; // Ball has some momentum from player
        ball.vy = player.vy * 0.6;
    } else if (isDribbling && ball.ownerId === player.id && isNaN(angle)) {
         logWarn(`NaN angle during dribble update for ${player.id}. Keeping ball close.`);
         // Fallback if angle is NaN - keep ball close without using angle
          ball.x = player.x + DRIBBLE_CONTROL_DISTANCE; // Simple offset
          ball.y = player.y;
          ball.vx = 0; ball.vy = 0;
    }
}

// REVISED updatePlayerPosition with extensive NaN checks and recovery
function updatePlayerPosition(player) {
     // 1. Check initial state
      if (!player || isNaN(player.baseX) || isNaN(player.baseY)){
           logError(`updatePlayerPosition called with invalid player or basePos. ID: ${player?.id}`);
           return; // Cannot proceed
      }
      if (isNaN(player.x) || isNaN(player.y)) {
           logError(`Player ${player.id} has NaN position at start of updatePlayerPosition: ${player.x}, ${player.y}. Resetting to base.`);
           player.x = player.baseX; player.y = player.baseY;
           player.vx = 0; player.vy = 0; // Reset velocity too
           // Skip applying velocity this tick
      }
      else if (isNaN(player.vx) || isNaN(player.vy)) {
          logWarn(`Player ${player.id} has NaN velocity at start of updatePlayerPosition: ${player.vx}, ${player.vy}. Zeroing velocity.`);
          player.vx = 0; player.vy = 0;
           // Still apply position update with zero velocity (effectively no change)
           player.x += player.vx;
           player.y += player.vy;
      }
      else {
          // Apply velocity if everything is valid
          player.x += player.vx;
          player.y += player.vy;
      }

    // 2. Clamp to field boundaries
    player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));

     // 3. Check position AFTER clamping (could become NaN if clamping huge numbers?)
      if (isNaN(player.x) || isNaN(player.y)) {
           logError(`Player ${player.id} has NaN position AFTER update & clamping: ${player.x}, ${player.y}. Resetting to base.`);
           player.x = player.baseX; player.y = player.baseY;
           player.vx = 0; player.vy = 0; // Ensure velocity is also zeroed
           return; // Skip collision check if position became NaN here
      }

    // 4. Collision resolution
    players.forEach(other => {
        // Check own position is valid before checking others
        if (isNaN(player.x) || isNaN(player.y)) {
             logWarn(`Skipping collision check for ${player.id} vs ${other.id} because own pos is NaN.`);
             return;
        }
        // Check other player exists and its position is valid
        if (!other || player.id === other.id || isNaN(other.x) || isNaN(other.y)) {
            // logWarn(`Skipping collision check for ${player.id}: other player ${other?.id} invalid or NaN.`);
             return;
        }

        const dSq = distSq(player.x, player.y, other.x, other.y);
        const minDist = PLAYER_RADIUS * 2;

        // Check distance calculation is valid
        if (isNaN(dSq)){
             logWarn(`NaN distance squared between ${player.id} and ${other.id}. Skipping collision.`);
             return;
        }

        if (dSq < minDist * minDist && dSq > 0.0001) { // Allow for very small distances, check > 0
             const dist = Math.sqrt(dSq);
             if (isNaN(dist) || dist <= 0) { // Check if dist is valid and positive
                  logWarn(`Collision calc warning: Invalid distance (${dist}) between ${player.id} & ${other.id}. dSq=${dSq}. Nudging.`);
                  // Slightly nudge players apart randomly if exactly on top or dist invalid
                   player.x += (Math.random() - 0.5) * 0.1;
                   player.y += (Math.random() - 0.5) * 0.1;
                   return; // Skip rest of collision calc for this pair this tick
             }

             const overlap = minDist - dist;
             const angle = Math.atan2(player.y - other.y, player.x - other.x);

             if (isNaN(angle) || isNaN(overlap)) { // Check calculations
                  logError(`Collision calc error: NaN angle(${angle}) or overlap(${overlap}) for ${player.id} & ${other.id}. Dist: ${dist}`);
                  return; // Skip adjustment if calculations failed
             }

             const moveX = (Math.cos(angle) * overlap) / 2;
             const moveY = (Math.sin(angle) * overlap) / 2;

             if (isNaN(moveX) || isNaN(moveY)) { // Check move values
                  logError(`Collision calc error: NaN move values for ${player.id} & ${other.id}. Angle: ${angle}, Overlap: ${overlap}`);
                  return; // Skip adjustment if calculations failed
             }

             // Apply adjustments
             player.x += moveX; player.y += moveY;
             other.x -= moveX; other.y -= moveY;

             // Re-clamp BOTH players after collision adjustment
             player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
             player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));
             other.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, other.x));
             other.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, other.y));

             // Final check after collision adjustment
             if (isNaN(player.x) || isNaN(player.y)) {
                  logError(`Player ${player.id} has NaN position after collision adj. Resetting.`);
                  player.x = player.baseX; player.y = player.baseY; player.vx = 0; player.vy = 0;
             }
             if (isNaN(other.x) || isNaN(other.y)) {
                  logError(`Player ${other.id} has NaN position after collision adj. Resetting.`);
                  other.x = other.baseX; other.y = other.baseY; other.vx = 0; other.vy = 0;
             }
        }
    });
}

// findBestPassOption (Unchanged)
function findBestPassOption(passer) { let bestTarget = null; let bestScore = -Infinity; const passerTeam = passer.team; const goalX = passerTeam === 'A' ? FIELD_WIDTH : 0; players.forEach(p => { if (p.team === passerTeam && p.id !== passer.id) { const dx = p.x - passer.x; const dy = p.y - passer.y; const passDistSq = dx * dx + dy * dy; const maxPassDistSq = (FIELD_WIDTH * 0.6) ** 2; if (passDistSq > 100 && passDistSq < maxPassDistSq) { let score = 0; let distToGoalSq = distSq(p.x, p.y, goalX, FIELD_HEIGHT / 2); score += (FIELD_WIDTH**2 - distToGoalSq) * 0.0005; let nearestOpponentDistSq = Infinity; players.forEach(opp => { if (opp.team !== passerTeam && !isNaN(opp.x) && !isNaN(opp.y)) { nearestOpponentDistSq = Math.min(nearestOpponentDistSq, distSq(p.x, p.y, opp.x, opp.y)); } }); score += Math.sqrt(nearestOpponentDistSq) * 0.3; if ((passerTeam === 'A' && p.x < passer.x - 30) || (passerTeam === 'B' && p.x > passer.x + 30)) { score *= 0.7; } else if ((passerTeam === 'A' && p.x < passer.x) || (passerTeam === 'B' && p.x > passer.x)) { score *= 0.95; } if (passer.role === 'MID' && p.role === 'FWD') score *= 1.1; if (passer.role === 'DEF' && p.role === 'MID') score *= 1.05; if (passer.role === 'FWD' && p.role === 'DEF') score *= 0.6; if (isPassRisky(passer, p)) score *= 0.1; if (score > bestScore) { bestScore = score; bestTarget = p; } } } }); return bestTarget; }
// passBall (Unchanged, accepts {x,y,id} target)
function passBall(passer, target) { // Target can be player or {x,y,id}
    if (!passer || !target || isNaN(passer.x) || isNaN(passer.y) || isNaN(target.x) || isNaN(target.y)){
         logError(`Invalid input to passBall. Passer: ${passer?.id}, Target: ${target?.id}`);
         if(passer){ passer.hasBall = false; } // Still lose possession
         ball.ownerId = null;
         return;
    }
    ball.ownerId = null; passer.hasBall = false;
    const dx = target.x - passer.x; const dy = target.y - passer.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * PASS_INACCURACY_FACTOR * (1 + dist / (FIELD_WIDTH*0.4));
    const finalAngle = angle + inaccuracyAngle;
    const power = Math.min(BALL_MAX_SPEED, PASS_MIN_POWER + dist * PASS_POWER_FACTOR);
    ball.x = passer.x + Math.cos(angle) * DRIBBLE_CONTROL_DISTANCE;
    ball.y = passer.y + Math.sin(angle) * DRIBBLE_CONTROL_DISTANCE;
    ball.vx = Math.cos(finalAngle) * power;
    ball.vy = Math.sin(finalAngle) * power;
    // Only log pass to player ID if it's not a forced target
    if (target.id !== 'FORCED_TARGET') {
        logDebug(`Pass from ${passer.id} to ${target.id}. Dist: ${dist.toFixed(0)}, Power: ${power.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}`);
    } else {
         logDebug(`Forced pass/clear by ${passer.id}.`);
    }
}
// shootBall (Unchanged)
function shootBall(shooter, targetX, targetY) { if (!shooter || isNaN(shooter.x) || isNaN(shooter.y) || isNaN(targetX) || isNaN(targetY)){ logError(`Invalid input to shootBall. Shooter: ${shooter?.id}`); if(shooter){ shooter.hasBall = false; } ball.ownerId = null; return; } ball.ownerId = null; shooter.hasBall = false; const dx = targetX - shooter.x; const dy = targetY - shooter.y; const dist = Math.sqrt(dx*dx+dy*dy); const angle = Math.atan2(dy, dx); const inaccuracyAngle = (Math.random() - 0.5) * SHOT_INACCURACY_FACTOR * (1 + dist / (FIELD_WIDTH*0.6)); const finalAngle = angle + inaccuracyAngle; const power = SHOT_POWER_BASE + (Math.random() * SHOT_POWER_VARIANCE) - (dist/(FIELD_WIDTH*0.6))*4; ball.x = shooter.x + Math.cos(angle) * DRIBBLE_CONTROL_DISTANCE; ball.y = shooter.y + Math.sin(angle) * DRIBBLE_CONTROL_DISTANCE; ball.vx = Math.cos(finalAngle) * Math.max(7, power); ball.vy = Math.sin(finalAngle) * Math.max(7, power); logDebug(`Shot by ${shooter.id}. Dist: ${dist.toFixed(0)}, Power: ${power.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}`); }
// updateBallPhysics (Added NaN checks for ball pos/vel)
function updateBallPhysics() {
     if (!ball || isNaN(ball.x) || isNaN(ball.y) || isNaN(ball.vx) || isNaN(ball.vy)) {
          logError(`Invalid ball state at start of updateBallPhysics: ${JSON.stringify(ball)}. Resetting ball.`);
          ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null };
          // Also clear owner's possession state if applicable
           if(ball.ownerId){
                const owner = getPlayerById(ball.ownerId);
                if(owner) owner.hasBall = false;
                ball.ownerId = null;
           }
          return; // Skip rest of physics this tick
     }

     const owner = getPlayerById(ball.ownerId);
     if (owner) {
         if (owner.hasBall && owner.state !== 'PASSING' && owner.state !== 'SHOOTING') {
             const angle = Math.atan2(owner.vy, owner.vx);
             if(!isNaN(angle)){ // Check angle before using
                  ball.x = owner.x + Math.cos(angle) * DRIBBLE_CONTROL_DISTANCE;
                  ball.y = owner.y + Math.sin(angle) * DRIBBLE_CONTROL_DISTANCE;
                  ball.vx = 0; ball.vy = 0; // Stop ball when tightly controlled
             } else { // Fallback if owner velocity is zero or NaN
                  ball.x = owner.x + DRIBBLE_CONTROL_DISTANCE; // Keep close
                  ball.y = owner.y;
                  ball.vx = 0; ball.vy = 0;
             }
         } else if (!owner.hasBall && ball.ownerId === owner.id) {
              logWarn(`Ball owner mismatch for ${owner.id}. Clearing owner.`);
              ball.ownerId = null;
         }
         // Check distance even if owner thinks they have ball
         if (distSq(owner.x, owner.y, ball.x, ball.y) > (KICK_RANGE * 2) ** 2) {
              logWarn(`Ball lost by ${owner.id} due to distance.`);
              ball.ownerId = null;
              owner.hasBall = false;
         }
     }

     if (!ball.ownerId) { // Ball is loose
         ball.x += ball.vx; ball.y += ball.vy;
         ball.vx *= BALL_FRICTION; ball.vy *= BALL_FRICTION;
         if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
         if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

         // Check for NaN after physics applied
          if (isNaN(ball.x) || isNaN(ball.y) || isNaN(ball.vx) || isNaN(ball.vy)) {
               logError(`NaN ball state after physics update: ${JSON.stringify(ball)}. Resetting ball.`);
               ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null };
               return;
          }


         // Wall collisions
         if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy *= -0.6; }
         if (ball.y > FIELD_HEIGHT - BALL_RADIUS) { ball.y = FIELD_HEIGHT - BALL_RADIUS; ball.vy *= -0.6; }

         // Goal check constants
         const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2; const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2; const postCollisionMargin = BALL_RADIUS + 2;

         // Goal Check (Left Goal - B's Goal, A scores)
         if (ball.x < GOAL_DEPTH + postCollisionMargin) { if (ball.y > goalTopY && ball.y < goalBottomY && ball.x < GOAL_DEPTH + BALL_RADIUS) { handleGoal('A'); return; } else if (ball.x < BALL_RADIUS) { ball.vx *= -0.6; ball.x = BALL_RADIUS; } else if ((ball.y < goalTopY + postCollisionMargin && ball.y > goalTopY - postCollisionMargin) || (ball.y > goalBottomY - postCollisionMargin && ball.y < goalBottomY + postCollisionMargin)) { ball.vy *= -0.6; ball.vx *= 0.8; } }
         // Goal Check (Right Goal - A's Goal, B scores)
         if (ball.x > FIELD_WIDTH - GOAL_DEPTH - postCollisionMargin) { if (ball.y > goalTopY && ball.y < goalBottomY && ball.x > FIELD_WIDTH - GOAL_DEPTH - BALL_RADIUS) { handleGoal('B'); return; } else if (ball.x > FIELD_WIDTH - BALL_RADIUS) { ball.vx *= -0.6; ball.x = FIELD_WIDTH - BALL_RADIUS; } else if ((ball.y < goalTopY + postCollisionMargin && ball.y > goalTopY - postCollisionMargin) || (ball.y > goalBottomY - postCollisionMargin && ball.y < goalBottomY + postCollisionMargin)) { ball.vy *= -0.6; ball.vx *= 0.8; } }

         // Check for player collision to gain possession (if still loose)
         if (!ball.ownerId) {
             let potentialOwner = null;
             let minDistSq = CONTROL_RANGE ** 2 * 1.5;
             players.forEach(p => {
                  // Check player is valid before checking distance
                  if (p && !isNaN(p.x) && !isNaN(p.y) && p.kickCooldown <= 0 && p.role !== 'GK') {
                      const dSq = distSq(p.x, p.y, ball.x, ball.y);
                      if (dSq < minDistSq) {
                          minDistSq = dSq;
                          potentialOwner = p;
                      }
                  }
             });
             if (potentialOwner) { gainPossession(potentialOwner); }
         }
     }
}

// gainPossession (Unchanged)
function gainPossession(player) { if (ball.ownerId === player.id) return; const previousOwner = getPlayerById(ball.ownerId); if (previousOwner) { previousOwner.hasBall = false; previousOwner.state = 'RETURNING'; logDebug(`${previousOwner.id} lost possession.`); } ball.ownerId = player.id; player.hasBall = true; player.state = 'IDLE'; player.dribbleTicks = 0; ball.vx = 0; ball.vy = 0; logDebug(`${player.id} gained possession.`); }
// handleGoal (Unchanged)
function handleGoal(scoringTeam) { logDebug(`!!!! GOAL by Team ${scoringTeam} !!!!`); if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') { logDebug("Goal scored outside of active play state? Ignoring."); return; } if (scoringTeam === 'A') { scoreA++; stats.teamA.goals++; } else { scoreB++; stats.teamB.goals++; } const finalStats = JSON.parse(JSON.stringify(stats)); broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB, stats: finalStats } }); const kickingTeam = scoringTeam === 'A' ? 'B' : 'A'; resetPositions(kickingTeam); }
// updateGame (Unchanged)
function updateGame() { if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return; const now = Date.now(); const timeDeltaMs = lastUpdateTimestamp > 0 ? now - lastUpdateTimestamp : MILLISECONDS_PER_UPDATE; lastUpdateTimestamp = now; const startTime = performance.now(); try { players.forEach(updatePlayerAI); players.forEach(updatePlayerPosition); updateBallPhysics(); } catch (error) { logError("Error during game update logic:", error); } const ingameSecondsIncrement = (timeDeltaMs / 1000) * GAME_SPEED_FACTOR; serverGameTime += ingameSecondsIncrement; const maxHalfTime = 45 * 60; const maxFullTime = 90 * 60; if (gameState === 'FIRST_HALF' && serverGameTime >= maxHalfTime) { serverGameTime = maxHalfTime; handleHalfTime(); } else if (gameState === 'SECOND_HALF' && serverGameTime >= maxFullTime) { serverGameTime = maxFullTime; handleFullTime(); } const updateDuration = performance.now() - startTime; if (updateDuration > MILLISECONDS_PER_UPDATE * 1.5) { logWarn(`Warning: Game update took ${updateDuration.toFixed(1)}ms (budget ${MILLISECONDS_PER_UPDATE.toFixed(1)}ms)`); } }


// --- Game Flow Control ---
// ... (startMatch, handleHalfTime, startSecondHalf, handleFullTime, setupNextMatch, resolveAllBets, startInitialSequence - unchanged) ...
function startMatch() { logDebug(`[State Transition] Starting Match: ${teamA?.name} vs ${teamB?.name}`); if (!teamA || !teamB || players.length !== 22) { logError("Cannot start match, teams/players not set up correctly. Restarting initial sequence."); startInitialSequence(); return; } if (gameState !== 'PRE_MATCH') { logWarn(`Warning: Tried to start match but state was ${gameState}. Aborting start.`); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; resetPositions('A'); serverGameTime = 0; lastUpdateTimestamp = Date.now(); gameState = 'FIRST_HALF'; broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } }); gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE); logDebug("Game logic interval started for First Half."); }
function handleHalfTime() { logDebug("[State Transition] Handling Half Time"); if (gameState !== 'FIRST_HALF') { logWarn("Warning: Tried to handle halftime but not in first half state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; gameState = 'HALF_TIME'; serverGameTime = 45 * 60; breakEndTime = Date.now() + HALF_TIME_BREAK_MS; broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime, stats } }); breakTimerTimeout = setTimeout(startSecondHalf, HALF_TIME_BREAK_MS); logDebug(`Halftime break. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`); }
function startSecondHalf() { logDebug("[State Transition] Starting Second Half"); if (gameState !== 'HALF_TIME') { logWarn("Warning: Tried to start second half but not in halftime state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; resetPositions('B'); lastUpdateTimestamp = Date.now(); gameState = 'SECOND_HALF'; broadcast({ type: 'secondHalfStart', payload: { stats } }); gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE); logDebug("Game logic interval started for Second Half."); }
function handleFullTime() { logDebug("[State Transition] Handling Full Time"); if (gameState !== 'SECOND_HALF') { logWarn("Warning: Tried to handle fulltime but not in second half state:", gameState); return; } if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; gameState = 'FULL_TIME'; serverGameTime = 90 * 60; breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS; if (availableTeams.length < 2) { logDebug("Team pool low, resetting and shuffling for next match."); availableTeams = [...nationalTeams]; shuffleArray(availableTeams); availableTeams = availableTeams.filter(t => t.name !== teamA?.name && t.name !== teamB?.name); if (availableTeams.length < 2) { logError("FATAL: Not enough unique teams available even after reset!"); if(teamA) availableTeams.push(nationalTeams.find(t => t.name === teamA.name)); if(teamB) availableTeams.push(nationalTeams.find(t => t.name === teamB.name)); shuffleArray(availableTeams); } } const nextTeamDataA = availableTeams.pop(); const nextTeamDataB = availableTeams.pop(); if (!nextTeamDataA || !nextTeamDataB) { logError("Failed to get next teams! Restarting initial sequence."); startInitialSequence(); return; } const nextOdds = generateOdds(nextTeamDataA.rating, nextTeamDataB.rating); nextMatchDetails = { teamA: nextTeamDataA, teamB: nextTeamDataB, oddsA: nextOdds.oddsA, oddsB: nextOdds.oddsB }; logDebug(`Prepared next match: ${nextMatchDetails.teamA.name} vs ${nextMatchDetails.teamB.name} (Odds: ${nextMatchDetails.oddsA} / ${nextMatchDetails.oddsB})`); broadcast({ type: 'fullTime', payload: { scoreA, scoreB, breakEndTime, stats, nextMatch: nextMatchDetails } }); resolveAllBets(); breakTimerTimeout = setTimeout(setupNextMatch, BETWEEN_MATCH_BREAK_MS); logDebug(`Full Time declared. Bet resolution done. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`); }
function setupNextMatch() { logDebug("[State Transition] Setting up Next Match (from stored details)"); if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; if (!nextMatchDetails || !nextMatchDetails.teamA || !nextMatchDetails.teamB) { logError("Error: nextMatchDetails not available when setting up next match. Restarting sequence."); startInitialSequence(); return; } if (!setupTeams(nextMatchDetails.teamA, nextMatchDetails.teamB)) { logError("Failed to setup teams using nextMatchDetails! Restarting initial sequence."); startInitialSequence(); return; } const setupTeamA = teamA; const setupTeamB = teamB; const setupOddsA = oddsA; const setupOddsB = oddsB; nextMatchDetails = null; gameState = 'PRE_MATCH'; logDebug(`Transitioning to PRE_MATCH for ${setupTeamA.name} vs ${setupTeamB.name}`); broadcast({ type: 'preMatch', payload: { teamA: setupTeamA, teamB: setupTeamB, oddsA: setupOddsA, oddsB: setupOddsB } }); breakTimerTimeout = setTimeout(() => { if (gameState === 'PRE_MATCH') { startMatch(); } else { logWarn(`Warning: Wanted to start match from PRE_MATCH delay, but state is now ${gameState}.`); } }, PRE_MATCH_DELAY_MS); logDebug(`Next match setup complete (${setupTeamA.name} vs ${setupTeamB.name}). Kickoff in ${PRE_MATCH_DELAY_MS / 1000}s.`); }
function resolveAllBets() { logDebug(`Resolving bets for finished match: ${teamA?.name} ${scoreA} - ${scoreB} ${teamB?.name}`); const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); clients.forEach((clientData, ws) => { if (clientData.currentBet) { let payout = 0; let message = ""; const bet = clientData.currentBet; const betOdds = bet.team === 'A' ? parseFloat(oddsA || 0) : parseFloat(oddsB || 0); const betTeamName = bet.team === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B'; if (isNaN(betOdds) || betOdds <= 0) { logError(`Invalid odds (${betOdds}) for bet resolution for ${clientData.nickname}. Refunding.`); clientData.balance += bet.amount; payout = bet.amount; message = `Error resolving bet due to invalid odds. Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`; logDebug(`Bet refunded (invalid odds) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`); } else if (bet.team === winningTeam) { payout = bet.amount * betOdds; clientData.balance += payout; message = `Bet on ${betTeamName} WON! Payout: +$${payout.toFixed(2)}.`; logDebug(`Bet won for ${clientData.nickname || clientData.id}: +$${payout.toFixed(2)}`); } else if (winningTeam === null) { clientData.balance += bet.amount; payout = bet.amount; message = `Match drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`; logDebug(`Bet refunded (draw) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`); } else { payout = 0; message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`; logDebug(`Bet lost for ${clientData.nickname || clientData.id}: -$${bet.amount.toFixed(2)}`); } sendToClient(ws, { type: 'betResult', payload: { success: payout >= bet.amount || winningTeam === null, message: message, newBalance: clientData.balance } }); clientData.currentBet = null; } }); logDebug("Bet resolution complete."); }
function startInitialSequence() { console.log("Starting initial server sequence..."); gameState = 'INITIALIZING'; nextMatchDetails = null; if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null; if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null; logDebug("Cleared existing timers/intervals."); logDebug("Initial sequence: Resetting team pool."); availableTeams = [...nationalTeams]; shuffleArray(availableTeams); const firstTeamA = availableTeams.pop(); const firstTeamB = availableTeams.pop(); if (!firstTeamA || !firstTeamB) { logError("Failed to get initial teams! Retrying in 5s..."); breakTimerTimeout = setTimeout(startInitialSequence, 5000); return; } if (!setupTeams(firstTeamA, firstTeamB)) { logError("Failed to setup initial teams! Retrying in 5s..."); breakTimerTimeout = setTimeout(startInitialSequence, 5000); return; } gameState = 'INITIAL_BETTING'; breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS; logDebug(`Initial betting period ends at ${new Date(breakEndTime).toLocaleTimeString()}`); broadcast({ type: 'initialWait', payload: { teamA, teamB, oddsA, oddsB, breakEndTime, allTournamentTeams: nationalTeams.map(t => t.name) } }); breakTimerTimeout = setTimeout(() => { if(gameState === 'INITIAL_BETTING') { logDebug("Initial betting wait over. Proceeding to setup first match details."); gameState = 'PRE_MATCH'; logDebug(`Transitioning to PRE_MATCH for ${teamA.name} vs ${teamB.name}`); broadcast({ type: 'preMatch', payload: { teamA, teamB, oddsA, oddsB } }); breakTimerTimeout = setTimeout(() => { if (gameState === 'PRE_MATCH') { startMatch(); } else { logWarn(`Warning: Wanted to start first match from PRE_MATCH delay, but state is now ${gameState}.`); } }, PRE_MATCH_DELAY_MS); } else { logWarn(`Warning: Initial wait timer finished, but game state was already ${gameState}. No action taken.`); } }, INITIAL_BETTING_WAIT_MS); }


// --- WebSocket Connection Handling ---
// ... (Unchanged - No issues reported here) ...
wss.on('connection', (ws, req) => { const remoteAddress = req.socket.remoteAddress || req.headers['x-forwarded-for']; const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`; logDebug(`Client connected: ${clientId} from ${remoteAddress}`); clients.set(ws, { id: clientId, nickname: null, balance: 100, currentBet: null }); sendToClient(ws, { type: 'currentGameState', payload: createFullGameStatePayload() }); ws.on('message', (message) => { let data; try { if (typeof message !== 'string' && !Buffer.isBuffer(message)) { logDebug(`Received non-string/non-buffer message from ${clientId}, ignoring.`); return; } const messageText = Buffer.isBuffer(message) ? message.toString('utf8') : message; data = JSON.parse(messageText); const clientData = clients.get(ws); if (!clientData) { logDebug(`Received message from stale/unknown client. Terminating.`); ws.terminate(); return; } switch (data.type) { case 'setNickname': const nick = data.payload?.trim(); if (nick && nick.length > 0 && nick.length <= 15) { const oldNickname = clientData.nickname; clientData.nickname = nick; logDebug(`Client ${clientData.id} set nickname to ${nick}`); sendToClient(ws, { type: 'welcome', payload: { nickname: nick, balance: clientData.balance, currentBet: clientData.currentBet } }); if (nick !== oldNickname) { const joinMsg = oldNickname ? `${oldNickname} changed name to ${nick}` : `${nick} has joined.`; broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: joinMsg } }); } } else { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Invalid nickname (1-15 chars).', isError: true } });} break; case 'chatMessage': if (clientData.nickname && data.payload && typeof data.payload === 'string') { const chatMsg = data.payload.substring(0, 100).trim(); if (chatMsg.length > 0) { broadcast({ type: 'chatBroadcast', payload: { sender: clientData.nickname, message: chatMsg } }); } } else if (!clientData.nickname) { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Please set a nickname to chat.', isError: true } }); } break; case 'placeBet': const isBettingPeriod = (gameState === 'INITIAL_BETTING' || gameState === 'FULL_TIME' || gameState === 'PRE_MATCH'); const betPayload = data.payload; const betAmount = parseInt(betPayload?.amount, 10); const betTeam = betPayload?.team; if (!clientData.nickname) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Set nickname to bet.', newBalance: clientData.balance } }); break; } if (!isBettingPeriod) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting is currently closed.', newBalance: clientData.balance } }); break; } if (clientData.currentBet) { const betOnTeamNameCurrent = clientData.currentBet.team === 'A' ? (gameState === 'FULL_TIME' ? nextMatchDetails?.teamA?.name : teamA?.name) : (gameState === 'FULL_TIME' ? nextMatchDetails?.teamB?.name : teamB?.name); sendToClient(ws, { type: 'betResult', payload: { success: false, message: `Bet already placed on ${betOnTeamNameCurrent || 'a team'}.`, newBalance: clientData.balance } }); break; } if (!(betTeam === 'A' || betTeam === 'B') || isNaN(betAmount) || betAmount <= 0) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Invalid bet amount or team.', newBalance: clientData.balance } }); break; } if (betAmount > clientData.balance) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Insufficient balance.', newBalance: clientData.balance } }); break; } let bettingOnTeamA, bettingOnTeamB; if (gameState === 'FULL_TIME' && nextMatchDetails) { bettingOnTeamA = nextMatchDetails.teamA; bettingOnTeamB = nextMatchDetails.teamB; } else if (gameState === 'INITIAL_BETTING' || gameState === 'PRE_MATCH') { bettingOnTeamA = teamA; bettingOnTeamB = teamB; } else { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting error: Invalid state.', newBalance: clientData.balance } }); break; } if (!bettingOnTeamA || !bettingOnTeamB) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting error: Team data missing.', newBalance: clientData.balance } }); break; } clientData.balance -= betAmount; clientData.currentBet = { team: betTeam, amount: betAmount }; const betOnTeamName = betTeam === 'A' ? bettingOnTeamA.name : bettingOnTeamB.name; sendToClient(ws, { type: 'betResult', payload: { success: true, message: `Bet $${betAmount.toFixed(2)} on ${betOnTeamName} placed.`, newBalance: clientData.balance } }); logDebug(`${clientData.nickname} bet $${betAmount} on ${betTeam} (${betOnTeamName})`); break; default: logDebug(`Unknown message type from ${clientData.id}: ${data.type}`); } } catch (error) { logError(`Failed to process message or invalid JSON from ${clientId}: ${message}`, error); const clientData = clients.get(ws); if (clientData) { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Error processing your request.', isError: true } }); } } }); ws.on('close', (code, reason) => { const clientData = clients.get(ws); const reasonString = reason ? reason.toString() : 'N/A'; if (clientData) { logDebug(`Client disconnected: ${clientData.nickname || clientData.id}. Code: ${code}, Reason: ${reasonString}`); if (clientData.nickname) { broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} has left.` } }); } clients.delete(ws); } else { logDebug(`Unknown client disconnected. Code: ${code}, Reason: ${reasonString}`); } }); ws.on('error', (error) => { const clientData = clients.get(ws); logError(`WebSocket error for client ${clientData?.nickname || clientData?.id || 'UNKNOWN'}:`, error); if (clients.has(ws)) { logDebug(`Removing client ${clientData?.id || 'UNKNOWN'} due to error.`); clients.delete(ws); } try { ws.terminate(); } catch (e) { /* ignore */ } }); });

// --- Periodic State Broadcast ---
// ... (Unchanged - Sends minimal updates during active play) ...
setInterval(() => { if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') { broadcast({ type: 'gameStateUpdate', payload: { scoreA, scoreB, serverGameTime: calculateCurrentDisplayTime(), players: players || [], ball: ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null }, stats: stats } }); } }, 150);

// --- Helper Functions ---
// ... (createFullGameStatePayload, calculateCurrentDisplayTime - unchanged) ...
function createFullGameStatePayload() { const payload = { gameState, scoreA, scoreB, teamA, teamB, oddsA, oddsB, serverGameTime: calculateCurrentDisplayTime(), players: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (players || []) : [], ball: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }) : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }, breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null, stats: stats, allTournamentTeams: nationalTeams.map(t => t.name) }; if (gameState === 'FULL_TIME' && nextMatchDetails) { payload.nextMatch = nextMatchDetails; } return payload; }
function calculateCurrentDisplayTime() { if (gameState === 'FIRST_HALF') { return Math.max(0, Math.min(45 * 60, serverGameTime)); } else if (gameState === 'SECOND_HALF') { return Math.max(45 * 60, Math.min(90 * 60, serverGameTime)); } else if (gameState === 'HALF_TIME') { return 45 * 60; } else if (gameState === 'FULL_TIME' || gameState === 'PRE_MATCH') { return 90 * 60; } else { return 0; } }


// --- Server Start ---
// ... (Unchanged - Uses process.env.PORT) ...
const PORT = process.env.PORT; if (!PORT) { logError("FATAL ERROR: PORT environment variable not set. Exiting."); process.exit(1); } const HOST = '0.0.0.0'; server.listen(parseInt(PORT, 10), HOST, () => { console.log(`HTTP and WebSocket server listening on ${HOST}:${PORT}`); startInitialSequence(); });

// --- Graceful Shutdown ---
// ... (Unchanged) ...
function gracefulShutdown(signal) { console.log(`${signal} received: closing server...`); if (gameLogicInterval) clearInterval(gameLogicInterval); if (breakTimerTimeout) clearTimeout(breakTimerTimeout); server.close(() => { console.log('HTTP server closed.'); wss.close(() => { console.log('WebSocket server closed.'); process.exit(0); }); setTimeout(() => { console.log("Forcing remaining WebSocket connections closed."); wss.clients.forEach(ws => ws.terminate()); }, 2000); }); setTimeout(() => { logError("Graceful shutdown timeout exceeded. Forcing exit."); process.exit(1); }, 10000); }
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

console.log("Server script finished initial execution. Waiting for connections...");