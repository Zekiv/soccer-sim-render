// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// --- Debug Logging Control ---
const DEBUG_LOG = true; // Enable detailed server logs for debugging AI/State
function logDebug(...args) {
    if (DEBUG_LOG) {
        const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.sss
        console.log(`[DEBUG ${timestamp}]`, ...args);
    }
}

console.log("Starting server...");

// --- HTTP Server Setup ---
const server = http.createServer((req, res) => {
    // ... (HTTP serving logic - unchanged) ...
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

// --- Game Constants (Server-side) ---
const INITIAL_BETTING_WAIT_MINS = 0.3; // Shortened for testing
const REAL_MATCH_DURATION_MINS = 1.5; // Shortened for testing
const BETWEEN_MATCH_BREAK_MINS = 0.3; // Shortened for testing
const HALF_TIME_BREAK_S = 10;         // Shortened for testing
const PRE_MATCH_DELAY_MS = 3000;      // 3 second pause after PRE_MATCH before kickoff

// --- Derived Constants ---
const INITIAL_BETTING_WAIT_MS = INITIAL_BETTING_WAIT_MINS * 60 * 1000;
const INGAME_MATCH_DURATION_MINS = 90;
const REAL_HALF_DURATION_MS = (REAL_MATCH_DURATION_MINS / 2) * 60 * 1000;
const HALF_TIME_BREAK_MS = HALF_TIME_BREAK_S * 1000;
const BETWEEN_MATCH_BREAK_MS = BETWEEN_MATCH_BREAK_MINS * 60 * 1000;
const UPDATES_PER_SECOND = 30;
const MILLISECONDS_PER_UPDATE = 1000 / UPDATES_PER_SECOND;
const GAME_SPEED_FACTOR = (INGAME_MATCH_DURATION_MINS * 60 * 1000) / (REAL_MATCH_DURATION_MINS * 60 * 1000);
// Field/Player dimensions
const FIELD_WIDTH = 1050; const FIELD_HEIGHT = 680; const GOAL_WIDTH = 120; const GOAL_DEPTH = 20; const CENTER_CIRCLE_RADIUS = 91.5; const PLAYER_RADIUS = 10; const BALL_RADIUS = 5;
const PENALTY_AREA_WIDTH = 165; const PENALTY_AREA_HEIGHT = 403;
// Physics/AI constants
const BASE_PLAYER_SPEED = 3.8; // Slightly increased base speed
const PLAYER_SPRINT_MULTIPLIER = 1.4; // Speed boost when chasing/attacking
const PLAYER_DRIBBLE_SPEED_FACTOR = 0.85; // Slower when dribbling
const GK_SPEED_FACTOR = 0.8; // Goalkeepers slightly slower
const BALL_MAX_SPEED = 16; const BALL_FRICTION = 0.98; // Slightly less friction
const SHOT_POWER_BASE = 14; const SHOT_POWER_VARIANCE = 4;
const PASS_POWER_FACTOR = 0.08; // Power scales more with distance
const PASS_MIN_POWER = 5;
const KICK_RANGE = PLAYER_RADIUS + BALL_RADIUS + 5; const CONTROL_RANGE = PLAYER_RADIUS + BALL_RADIUS + 2;
const KICK_COOLDOWN_FRAMES = 15; // ~0.5 seconds
const SHOT_INACCURACY_FACTOR = 0.10; // radians (~6 degrees) base inaccuracy
const PASS_INACCURACY_FACTOR = 0.08; // radians (~4.5 degrees) base inaccuracy
const OFF_BALL_MOVEMENT_FACTOR = 0.4; // How strongly players follow ball when returning/supporting


// --- Team Data (Server-side) ---
// IMPORTANT: Make sure the full nationalTeams and sampleSquads are pasted here
// (Assuming they are correctly present as in the user's provided code)
const nationalTeams = [ /* ... FULL LIST ... */ { name: "Argentina", color: "#75AADB", rating: 92 }, { name: "France", color: "#003399", rating: 91 }, { name: "Brazil", color: "#FFDF00", rating: 90 }, { name: "England", color: "#FFFFFF", textColor: "#000000", rating: 89 }, { name: "Belgium", color: "#ED2939", rating: 88 }, { name: "Croatia", color: "#FF0000", rating: 87 }, { name: "Netherlands", color: "#FF6600", rating: 87 }, { name: "Italy", color: "#003399", rating: 86 }, { name: "Portugal", color: "#006600", rating: 86 }, { name: "Spain", color: "#FF0000", rating: 85 }, { name: "Morocco", color: "#006233", rating: 84 }, { name: "Switzerland", color: "#FF0000", rating: 84 }, { name: "USA", color: "#002868", rating: 83 }, { name: "Germany", color: "#000000", rating: 83 }, { name: "Mexico", color: "#006847", rating: 82 }, { name: "Uruguay", color: "#5CBFEB", rating: 82 }, { name: "Colombia", color: "#FCD116", rating: 81 }, { name: "Senegal", color: "#00853F", rating: 81 }, { name: "Denmark", color: "#C60C30", rating: 80 }, { name: "Japan", color: "#000080", rating: 80 }, { name: "Peru", color: "#D91023", rating: 79 }, { name: "Iran", color: "#239F40", rating: 79 }, { name: "Serbia", color: "#C6363C", rating: 78 }, { name: "Poland", color: "#DC143C", rating: 78 }, { name: "Sweden", color: "#006AA7", rating: 78 }, { name: "Ukraine", color: "#005BBB", rating: 77 }, { name: "South Korea", color: "#FFFFFF", textColor:"#000000", rating: 77 }, { name: "Chile", color: "#D52B1E", rating: 76 }, { name: "Tunisia", color: "#E70013", rating: 76 }, { name: "Costa Rica", color: "#002B7F", rating: 75 }, { name: "Australia", color: "#00843D", rating: 75 }, { name: "Nigeria", color: "#008751", rating: 75 }, { name: "Austria", color: "#ED2939", rating: 74 }, { name: "Hungary", color: "#436F4D", rating: 74 }, { name: "Russia", color: "#FFFFFF", textColor:"#000000", rating: 73 }, { name: "Czech Republic", color: "#D7141A", rating: 73 }, { name: "Egypt", color: "#C8102E", rating: 73 }, { name: "Algeria", color: "#006233", rating: 72 }, { name: "Scotland", color: "#0065BF", rating: 72 }, { name: "Norway", color: "#EF2B2D", rating: 72 }, { name: "Turkey", color: "#E30A17", rating: 71 }, { name: "Mali", color: "#14B53A", rating: 71 }, { name: "Paraguay", color: "#DA121A", rating: 70 }, { name: "Ivory Coast", color: "#FF8200", rating: 70 }, { name: "Republic of Ireland", color: "#169B62", rating: 70 }, { name: "Qatar", color: "#8A1538", rating: 69 }, { name: "Saudi Arabia", color: "#006C35", rating: 69 }, { name: "Greece", color: "#0D5EAF", rating: 69 }, { name: "Romania", color: "#002B7F", rating: 68 }, ];
let availableTeams = [];
const sampleSquads = { /* ... FULL SQUADS OBJECT ... */ "Argentina": ["E Martinez", "N Molina", "C Romero", "L Martinez", "N Tagliafico", "R De Paul", "E Fernandez", "A Mac Allister", "L Messi", "J Alvarez", "A Di Maria"], "France": ["M Maignan", "J Kounde", "D Upamecano", "W Saliba", "T Hernandez", "A Tchouameni", "A Rabiot", "A Griezmann", "O Dembele", "K Mbappe", "M Thuram"], "Brazil": ["Alisson", "Danilo", "Marquinhos", "G Magalhaes", "Wendell", "B Guimaraes", "Lucas Paqueta", "Rodrygo", "Vinicius Jr", "Raphinha", "Endrick"], "England": ["J Pickford", "K Walker", "J Stones", "M Guehi", "K Trippier", "D Rice", "J Bellingham", "B Saka", "P Foden", "C Palmer", "H Kane"], "Belgium": ["K Casteels", "T Castagne", "W Faes", "J Vertonghen", "A Theate", "A Onana", "Y Tielemans", "J Doku", "K De Bruyne", "L Trossard", "R Lukaku"], "Croatia": ["D Livakovic", "J Stanisic", "J Sutalo", "J Gvardiol", "B Sosa", "M Brozovic", "L Modric", "M Kovacic", "L Majer", "A Kramaric", "A Budimir"], "Netherlands": ["B Verbruggen", "D Dumfries", "S de Vrij", "V van Dijk", "N Ake", "J Schouten", "J Veerman", "X Simons", "T Reijnders", "C Gakpo", "M Depay"], "Italy": ["G Donnarumma", "G Di Lorenzo", "A Bastoni", "R Calafiori", "F Dimarco", "Jorginho", "N Barella", "D Frattesi", "L Pellegrini", "F Chiesa", "G Scamacca"], "Portugal": ["D Costa", "J Cancelo", "Pepe", "Ruben Dias", "N Mendes", "J Palhinha", "Vitinha", "B Fernandes", "B Silva", "R Leao", "C Ronaldo"], "Spain": ["U Simon", "D Carvajal", "R Le Normand", "A Laporte", "M Cucurella", "Rodri", "Pedri", "F Ruiz", "L Yamal", "N Williams", "A Morata"], "Morocco": ["Y Bounou", "A Hakimi", "N Aguerd", "R Saiss", "N Mazraoui", "S Amrabat", "A Ounahi", "H Ziyech", "S Amallah", "S Boufal", "Y En-Nesyri"], "Switzerland": ["Y Sommer", "S Widmer", "M Akanji", "F Schar", "R Rodriguez", "R Freuler", "G Xhaka", "X Shaqiri", "R Vargas", "D Ndoye", "Z Amdouni"], "USA": ["M Turner", "S Dest", "C Richards", "T Ream", "A Robinson", "T Adams", "W McKennie", "Y Musah", "C Pulisic", "T Weah", "F Balogun"], "Germany": ["M Neuer", "J Kimmich", "A Rüdiger", "J Tah", "M Mittelstädt", "R Andrich", "T Kroos", "J Musiala", "I Gündogan", "F Wirtz", "K Havertz"], "Mexico": ["G Ochoa", "J Sanchez", "C Montes", "J Vasquez", "J Gallardo", "E Alvarez", "L Chavez", "O Pineda", "H Lozano", "A Vega", "S Gimenez"], "Uruguay": ["S Rochet", "N Nandez", "J Gimenez", "S Coates", "M Olivera", "M Ugarte", "F Valverde", "N De La Cruz", "F Pellistri", "D Nunez", "L Suarez"], "Colombia": ["D Ospina", "S Arias", "Y Mina", "D Sanchez", "J Mojica", "W Barrios", "M Uribe", "J Cuadrado", "J Rodriguez", "L Diaz", "R Falcao"], "Senegal": ["E Mendy", "K Koulibaly", "A Diallo", "Y Sabaly", "I Jakobs", "P Gueye", "N Mendy", "I Sarr", "S Mane", "B Dia", "N Jackson"], "Denmark": ["K Schmeichel", "J Andersen", "A Christensen", "J Vestergaard", "J Maehle", "P Hojbjerg", "M Hjulmand", "C Eriksen", "A Skov Olsen", "M Damsgaard", "R Hojlund"], "Japan": ["S Gonda", "H Sakai", "M Yoshida", "K Itakura", "Y Nagatomo", "W Endo", "H Morita", "J Ito", "D Kamada", "K Mitoma", "A Ueda"], "Peru": ["P Gallese", "L Advincula", "C Zambrano", "A Callens", "M Trauco", "R Tapia", "Y Yotun", "A Carrillo", "C Cueva", "E Flores", "G Lapadula"], "Iran": ["A Beiranvand", "S Moharrami", "M Hosseini", "M Pouraliganji", "E Hajsafi", "S Ezatolahi", "A Noorollahi", "A Jahanbakhsh", "M Taremi", "V Amiri", "S Azmoun"], "Serbia": ["V Milinkovic-Savic", "N Milenkovic", "S Pavlovic", "M Veljkovic", "A Zivkovic", "F Kostic", "N Gudelj", "S Milinkovic-Savic", "D Tadic", "A Mitrovic", "D Vlahovic"], "Poland": ["W Szczesny", "M Cash", "J Bednarek", "J Kiwior", "B Bereszynski", "K Bielik", "G Krychowiak", "P Zielinski", "P Frankowski", "K Swiderski", "R Lewandowski"], "Sweden": ["R Olsen", "E Krafth", "V Lindelof", "I Hien", "L Augustinsson", "A Ekdal", "M Svanberg", "D Kulusevski", "E Forsberg", "A Isak", "V Gyokeres"], "Ukraine": ["A Lunin", "Y Konoplya", "I Zabarnyi", "M Matviyenko", "V Mykolenko", "T Stepanenko", "O Zinchenko", "M Mudryk", "H Sudakov", "V Tsygankov", "A Dovbyk"], "South Korea": ["Kim S-G", "Kim M-H", "Kim M-J", "Kim Y-G", "Kim J-S", "Jung W-Y", "Hwang I-B", "Lee J-S", "Son H-M", "Hwang H-C", "Cho G-S"], "Chile": ["C Bravo", "M Isla", "G Medel", "G Maripan", "G Suazo", "E Pulgar", "A Vidal", "C Aranguiz", "A Sanchez", "B Brereton Diaz", "E Vargas"], "Tunisia": ["A Dahmen", "M Talbi", "Y Meriah", "D Bronn", "W Kechrida", "A Laidouni", "E Skhiri", "A Maaloul", "Y Msakni", "N Sliti", "W Khazri"], "Costa Rica": ["K Navas", "K Fuller", "O Duarte", "F Calvo", "B Oviedo", "Y Tejeda", "C Borges", "J Campbell", "G Torres", "A Contreras", "J Venegas"], "Australia": ["M Ryan", "N Atkinson", "H Souttar", "K Rowles", "A Behich", "A Mooy", "J Irvine", "R McGree", "M Leckie", "C Goodwin", "M Duke"], "Nigeria": ["F Uzoho", "O Aina", "W Troost-Ekong", "C Bassey", "Z Sanusi", "F Onyeka", "A Iwobi", "S Chukwueze", "K Iheanacho", "A Lookman", "V Osimhen"], "Austria": ["P Pentz", "S Posch", "K Danso", "M Wober", "P Mwene", "N Seiwald", "K Laimer", "C Baumgartner", "M Sabitzer", "P Wimmer", "M Gregoritsch"], "Hungary": ["P Gulacsi", "A Fiola", "W Orban", "A Szalai", "L Nego", "A Nagy", "A Schafer", "M Kerkez", "D Szoboszlai", "R Sallai", "B Varga"], "Russia": ["M Safonov", "V Karavaev", "G Dzhikiya", "I Diveev", "D Krugovoy", "D Barinov", "D Kuzyaev", "A Golovin", "A Miranchuk", "A Zakharyan", "F Smolov"], "Czech Republic": ["J Stanek", "V Coufal", "T Holes", "R Hranac", "L Krejci", "D Jurasek", "T Soucek", "L Provod", "A Barak", "A Hlozek", "P Schick"], "Egypt": ["M El Shenawy", "A Hegazi", "M Abdelmonem", "A Fatouh", "O Kamal", "M Elneny", "T Hamed", "Emam Ashour", "M Salah", "O Marmoush", "Mostafa Mohamed"], "Algeria": ["R M'Bolhi", "A Mandi", "R Bensebaini", "Y Atal", "R Ait Nouri", "N Bentaleb", "I Bennacer", "S Feghouli", "R Mahrez", "Y Belaïli", "I Slimani"], "Scotland": ["A Gunn", "J Hendry", "G Hanley", "K Tierney", "A Ralston", "A Robertson", "B Gilmour", "C McGregor", "S McTominay", "J McGinn", "C Adams"], "Norway": ["O Nyland", "K Ajer", "L Ostigard", "S Strandberg", "B Meling", "M Odegaard", "S Berge", "F Aursnes", "A Sorloth", "E Haaland", "O Bobb"], "Turkey": ["U Cakir", "Z Celik", "M Demiral", "K Ayhan", "F Kadioglu", "S Ozcan", "H Calhanoglu", "A Guler", "K Akturkoglu", "C Under", "B Yilmaz"], "Mali": ["D Diarra", "H Traore", "K Kouyate", "B Fofana", "F Sacko", "A Haidara", "Y Bissouma", "D Samassekou", "M Djenepo", "A Doucoure", "I Kone"], "Paraguay": ["A Silva", "R Rojas", "G Gomez", "F Balbuena", "J Alonso", "M Villasanti", "A Cubas", "M Almiron", "J Enciso", "R Sanabria", "A Sanabria"], "Ivory Coast": ["Y Fofana", "S Aurier", "W Boly", "E Ndicka", "G Konan", "I Sangare", "F Kessie", "S Fofana", "N Pepe", "S Haller", "W Zaha"], "Republic of Ireland": ["G Bazunu", "S Coleman", "J Egan", "N Collins", "M Doherty", "J Cullen", "J Molumby", "J Knight", "C Ogbene", "M Obafemi", "E Ferguson"], "Qatar": ["S Al Sheeb", "Pedro Miguel", "B Khoukhi", "A Hassan", "H Ahmed", "K Boudiaf", "A Hatem", "H Al Haydos", "Akram Afif", "Almoez Ali", "M Muntari"], "Saudi Arabia": ["M Al Owais", "S Abdulhamid", "A Al Amri", "A Al Bulaihi", "Y Al Shahrani", "A Al Malki", "M Kanno", "S Al Dawsari", "F Al Brikan", "S Al Shehri", "H Bahebri"], "Greece": ["O Vlachodimos", "G Baldock", "K Mavropanos", "P Hatzidiakos", "K Tsimikas", "M Siopis", "A Bouchalakis", "P Mantalos", "G Masouras", "T Bakasetas", "V Pavlidis"], "Romania": ["F Nita", "A Ratiu", "R Dragusin", "A Burca", "N Bancu", "M Marin", "R Marin", "N Stanciu", "D Man", "V Mihaila", "D Dragus"], };

// --- Game State (Authoritative Server State) ---
let gameState = 'INITIALIZING'; // INITIALIZING, INITIAL_BETTING, PRE_MATCH, FIRST_HALF, HALF_TIME, SECOND_HALF, FULL_TIME
let serverGameTime = 0; // In-game seconds, managed by server
let lastUpdateTimestamp = 0; // For precise time calculation
let scoreA = 0;
let scoreB = 0;
let teamA = null; // { name, color, rating, id: 'A', squad: [...] }
let teamB = null; // { name, color, rating, id: 'B', squad: [...] }
let players = []; // { id, team, role, name, initials, x, y, vx, vy, baseX, baseY, targetX, targetY, state, kickCooldown, color, textColor, stamina(?) }
let ball = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null };
let stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } };
let oddsA = 2.00;
let oddsB = 2.00;
let breakEndTime = 0; // Timestamp when the current break (INITIAL_BETTING, HALF_TIME, FULL_TIME) ends
let nextMatchDetails = null; // Stores { teamA, teamB, oddsA, oddsB } for the *next* match during FULL_TIME

let gameLogicInterval = null;
let breakTimerTimeout = null; // Store timeout ID for breaks/delays
let clients = new Map(); // ws -> { id, nickname, balance, currentBet: { team ('A'|'B'), amount } }

// --- Utility Functions ---
// ... (getPlayerInitials, isColorDark, distSq, shuffleArray, getRandomElement - unchanged) ...
function getPlayerInitials(name, index = 0) { if (typeof name !== 'string' || name.trim() === '') { return `P${index + 1}`; } const parts = name.trim().split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); } else if (parts.length === 1 && name.length > 0) { return name.substring(0, Math.min(2, name.length)).toUpperCase(); } return `P${index + 1}`; }
function isColorDark(hexColor) { if (!hexColor || typeof hexColor !== 'string') return false; hexColor = hexColor.replace('#', ''); if (hexColor.length !== 6) return false; try { const r = parseInt(hexColor.substring(0, 2), 16); const g = parseInt(hexColor.substring(2, 4), 16); const b = parseInt(hexColor.substring(4, 6), 16); const brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness < 128; } catch (e) { return false; } }
function distSq(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function getRandomElement(arr) { if (!arr || arr.length === 0) return null; return arr[Math.floor(Math.random() * arr.length)]; }

// REVISED: generateOdds with more rating sensitivity
function generateOdds(ratingA, ratingB) {
    const ratingDiff = ratingA - ratingB;
    // Base probability influenced by rating difference (e.g., 10 rating points -> ~10% shift)
    // Add some randomness/margin
    const probA = 0.5 + (ratingDiff / 100) + (Math.random() - 0.5) * 0.1; // Increased influence, added random factor
    const probB = 1.0 - probA;

    // Convert probability to odds, ensuring minimum odds (e.g., 1.05) and adding margin
    const margin = 0.05 + Math.random() * 0.03; // ~5-8% margin
    let calculatedOddsA = Math.max(1.05, 1 / (probA * (1 - margin)));
    let calculatedOddsB = Math.max(1.05, 1 / (probB * (1 - margin)));

    // Ensure odds reasonably reflect probabilities (prevent extreme inverse cases from margin)
    if ((probA > probB && calculatedOddsA > calculatedOddsB) || (probB > probA && calculatedOddsB > calculatedOddsA)) {
        // If odds seem inverted due to margin randomness, slightly adjust weaker team's odds up
        if (calculatedOddsA > calculatedOddsB) calculatedOddsA = calculatedOddsB + 0.1 + Math.random() * 0.1;
        else calculatedOddsB = calculatedOddsA + 0.1 + Math.random() * 0.1;
    }

    logDebug(`Ratings: A=${ratingA}, B=${ratingB}. Probs: A=${probA.toFixed(3)}, B=${probB.toFixed(3)}. Odds: A=${calculatedOddsA.toFixed(2)}, B=${calculatedOddsB.toFixed(2)}`);
    return { oddsA: parseFloat(calculatedOddsA.toFixed(2)), oddsB: parseFloat(calculatedOddsB.toFixed(2)) };
}

function broadcast(data) { /* ... (unchanged) ... */ const message = JSON.stringify(data); wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) { client.send(message, (err) => { if (err) { console.error("Broadcast send error:", err); } }); } }); }
function sendToClient(ws, data) { /* ... (unchanged) ... */ const clientData = clients.get(ws); if (ws.readyState === WebSocket.OPEN) { const message = JSON.stringify(data); ws.send(message, (err) => { if (err) { console.error(`Send error to ${clientData?.id || 'UNKNOWN'}:`, err); } }); } else { logDebug(`Attempted to send to closed socket for ${clientData?.id || 'UNKNOWN'}`); } }

// --- Player & Team Setup ---
// ... (createPlayer - unchanged, adds base properties) ...
function createPlayer(id, teamId, role, formationPos, teamColor, textColor, playerName, playerIndex) {
    const initials = getPlayerInitials(playerName, playerIndex);
    const finalTextColor = textColor || (isColorDark(teamColor) ? '#FFFFFF' : '#000000');
    return {
        id: `${teamId}-${id}`, team: teamId, role: role,
        name: playerName || `Player ${playerIndex + 1}`, initials: initials,
        x: formationPos.x, y: formationPos.y, vx: 0, vy: 0,
        baseX: formationPos.x, baseY: formationPos.y, // Store base position
        targetX: formationPos.x, targetY: formationPos.y, // Current target
        state: 'IDLE', // IDLE, CHASING, DRIBBLING, PASSING, SHOOTING, RETURNING, SUPPORTING, MARKING, INTERCEPTING, GK_POSITIONING, GK_SAVING
        kickCooldown: 0, color: teamColor, textColor: finalTextColor,
        hasBall: false // Server side tracking of ball possession for AI logic
    };
}
// ... (formation433 - unchanged) ...
const formation433 = (teamId) => { const sideMultiplier = teamId === 'A' ? 1 : -1; const xOffset = FIELD_WIDTH / 2; const yOffset = FIELD_HEIGHT / 2; const gkX = sideMultiplier * (-FIELD_WIDTH * 0.48); const defLineX = sideMultiplier * (-FIELD_WIDTH * 0.35); const midLineX = sideMultiplier * (-FIELD_WIDTH * 0.1); const fwdLineX = sideMultiplier * (FIELD_WIDTH * 0.25); const positions = [ { role: 'GK', x: gkX, y: 0 }, { role: 'DEF', x: defLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: -FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX, y: FIELD_HEIGHT * 0.3 }, { role: 'MID', x: midLineX, y: -FIELD_HEIGHT * 0.2 }, { role: 'MID', x: midLineX + sideMultiplier * (20), y: 0 }, { role: 'MID', x: midLineX, y: FIELD_HEIGHT * 0.2 }, { role: 'FWD', x: fwdLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'FWD', x: fwdLineX + sideMultiplier * (30), y: 0 }, { role: 'FWD', x: fwdLineX, y: FIELD_HEIGHT * 0.3 } ]; return positions.map(p => ({ ...p, x: xOffset + p.x, y: yOffset + p.y })); };

// REVISED: setupTeams - Generates odds here
function setupTeams(teamDataA, teamDataB) {
    logDebug(`Setting up match: ${teamDataA?.name || '?'} vs ${teamDataB?.name || '?'}`);
    if (!teamDataA || !teamDataB) { console.error("Cannot setup teams, invalid team data provided."); return false; }

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

    // Generate odds for THIS matchup
    const generatedOdds = generateOdds(teamA.rating, teamB.rating);
    oddsA = generatedOdds.oddsA;
    oddsB = generatedOdds.oddsB;

    // Clear bets for all connected clients for the *new* match
    clients.forEach(clientData => { clientData.currentBet = null; });
    logDebug(`Teams setup complete. Odds: A=${oddsA}, B=${oddsB}. Client bets cleared.`);
    return true;
}

// REVISED: resetPositions - improved kickoff logic
function resetPositions(kickingTeamId = null) {
    logDebug(`Resetting positions. Kicking team: ${kickingTeamId || 'None'}`);
    ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.ownerId = null;

    let kickerFound = false;
    players.forEach(p => {
        p.vx = 0; p.vy = 0;
        p.hasBall = false;
        p.state = 'IDLE';
        p.x = p.baseX; p.y = p.baseY; // Start at base formation position

        if (kickingTeamId) {
            // Non-kicking team must be in their own half
            if (p.team !== kickingTeamId) {
                if (p.team === 'A' && p.x > FIELD_WIDTH / 2 - PLAYER_RADIUS) {
                    p.x = FIELD_WIDTH / 2 - PLAYER_RADIUS * 2; // Move back if needed
                } else if (p.team === 'B' && p.x < FIELD_WIDTH / 2 + PLAYER_RADIUS) {
                    p.x = FIELD_WIDTH / 2 + PLAYER_RADIUS * 2; // Move back if needed
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
                if (!kickerFound && (p.role === 'FWD' || p.role === 'MID') && Math.abs(p.y - FIELD_HEIGHT / 2) < FIELD_HEIGHT * 0.2) {
                     p.x = FIELD_WIDTH / 2 - (p.team === 'A' ? PLAYER_RADIUS + BALL_RADIUS + 2 : - (PLAYER_RADIUS + BALL_RADIUS + 2));
                     p.y = FIELD_HEIGHT / 2;
                     kickerFound = true;
                     logDebug(`Designated kicker: ${p.id} (${p.name})`);
                }
            }
        }
         // Clamp positions just in case
         p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x));
         p.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, p.y));
    });

     // If no suitable kicker found automatically (edge case), assign the first FWD/MID of kicking team
     if (kickingTeamId && !kickerFound) {
         const fallbackKicker = players.find(p => p.team === kickingTeamId && (p.role === 'FWD' || p.role === 'MID'));
         if (fallbackKicker) {
             fallbackKicker.x = FIELD_WIDTH / 2 - (fallbackKicker.team === 'A' ? PLAYER_RADIUS + BALL_RADIUS + 2 : - (PLAYER_RADIUS + BALL_RADIUS + 2));
             fallbackKicker.y = FIELD_HEIGHT / 2;
             logDebug(`Fallback designated kicker: ${fallbackKicker.id} (${fallbackKicker.name})`);
         } else {
             logDebug("Warning: Could not find any kicker for kickoff!");
         }
     }
}

function resetStats() { /* ... (unchanged) ... */ stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } }; }
function getPlayerById(playerId) { /* ... (unchanged) ... */ return players.find(p => p.id === playerId); }


// --- Simulation Logic (MAJOR REVISIONS) ---

function updatePlayerAI(player) {
    if (!player || !ball) return;

    player.kickCooldown = Math.max(0, player.kickCooldown - 1);
    const playerDistToBallSq = distSq(player.x, player.y, ball.x, ball.y);
    const canControlBall = playerDistToBallSq < CONTROL_RANGE ** 2;
    const canKickBall = playerDistToBallSq < KICK_RANGE ** 2;
    const hasPossession = ball.ownerId === player.id; // Direct check on ball state

    const goalX = player.team === 'A' ? FIELD_WIDTH : 0; // Target goal
    const goalY = FIELD_HEIGHT / 2;
    const ownGoalX = player.team === 'A' ? 0 : FIELD_WIDTH; // Own goal
    const ownGoalY = FIELD_HEIGHT / 2;

    // --- GOALKEEPER LOGIC ---
    if (player.role === 'GK') {
        const penaltyBoxTop = (FIELD_HEIGHT - PENALTY_AREA_HEIGHT) / 2;
        const penaltyBoxBottom = (FIELD_HEIGHT + PENALTY_AREA_HEIGHT) / 2;
        const penaltyBoxXNear = player.team === 'A' ? 0 : FIELD_WIDTH - PENALTY_AREA_WIDTH;
        const penaltyBoxXFar = player.team === 'A' ? PENALTY_AREA_WIDTH : FIELD_WIDTH;
        const sixYardBoxXFar = player.team === 'A' ? 55 : FIELD_WIDTH - 55; // Approx

        let targetX = player.baseX;
        let targetY = player.baseY;

        // Basic positioning: between ball and center of goal, closer when ball is near
        const ballDistToOwnGoalSq = distSq(ball.x, ball.y, ownGoalX, ownGoalY);
        const threatDistanceSq = (FIELD_WIDTH * 0.4) ** 2; // When ball is in defensive half

        if (ballDistToOwnGoalSq < threatDistanceSq || (ball.ownerId && getPlayerById(ball.ownerId)?.team !== player.team)) {
            // Ball is a threat or opponent has it nearby
            player.state = 'GK_POSITIONING';
            // Target Y: On line between ball and goal center, but clamped vertically
            targetY = ownGoalY + (ball.y - ownGoalY) * 0.7; // Adjust multiplier based on desired coverage
            targetY = Math.max(penaltyBoxTop + PLAYER_RADIUS, Math.min(penaltyBoxBottom - PLAYER_RADIUS, targetY)); // Clamp within box vertically

            // Target X: Slightly off the line, closer to goal line when ball is near goal
            let depthFactor = Math.max(0, 1 - Math.sqrt(ballDistToOwnGoalSq) / (FIELD_WIDTH * 0.3)); // 0=far, 1=close
            targetX = ownGoalX + (player.team === 'A' ? 1 : -1) * (GOAL_DEPTH + PLAYER_RADIUS + (sixYardBoxXFar - (ownGoalX + GOAL_DEPTH)) * (1 - depthFactor) * 0.5); // Come out slightly based on threat distance

        } else {
            // Ball is far, return towards base position (center of goal line)
            player.state = 'IDLE';
            targetX = player.baseX; // Center of goal line
            targetY = player.baseY;
        }

        // Clamp GK movement strictly within penalty area horizontally, near goal line
        targetX = player.team === 'A'
            ? Math.max(PLAYER_RADIUS, Math.min(penaltyBoxXFar - PLAYER_RADIUS, targetX))
            : Math.max(penaltyBoxXNear + PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, targetX));

        player.targetX = targetX;
        player.targetY = targetY;
        movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * GK_SPEED_FACTOR);

        // Action: Claim loose ball or simple save/clear
        if (ball.ownerId === null && canControlBall && player.kickCooldown <= 0) {
             logDebug(`GK ${player.id} claiming loose ball`);
             gainPossession(player);
             player.kickCooldown = KICK_COOLDOWN_FRAMES * 2; // Longer cooldown after claiming
             // Simple clear: Kick towards a flank midfielder/defender
             let clearTargetX = player.team === 'A' ? FIELD_WIDTH * 0.4 : FIELD_WIDTH * 0.6;
             let clearTargetY = Math.random() < 0.5 ? FIELD_HEIGHT * 0.2 : FIELD_HEIGHT * 0.8;
              logDebug(`GK ${player.id} clearing towards ${clearTargetX.toFixed(0)}, ${clearTargetY.toFixed(0)}`);
             shootBall(player, clearTargetX, clearTargetY, SHOT_POWER_BASE * 0.8); // Less power than a shot
             stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++; // Count as pass/clear
             return; // End GK action
         }
         // Rudimentary save (if opponent shoots near GK?) - Needs projectile prediction, complex. Skipping for now.

        return; // End GK Logic
    }


    // --- OUTFIELD PLAYER LOGIC ---
    const isDefending = player.role === 'DEF' || (player.role === 'MID' && ball.x < FIELD_WIDTH / 2 === (player.team === 'B')); // Defender, or Midfielder in own half
    const isAttacking = player.role === 'FWD' || (player.role === 'MID' && ball.x > FIELD_WIDTH / 2 === (player.team === 'A')); // Forward, or Midfielder in opp half

    // ** 1. Action when possessing the ball **
    if (hasPossession) {
        player.state = 'DRIBBLING';
        const shootRangeSq = (FIELD_WIDTH * (isAttacking ? 0.4 : 0.5)) ** 2; // Shorter range for attackers
        const distToGoalSq = distSq(player.x, player.y, goalX, goalY);

        // Decision: Shoot?
        if (distToGoalSq < shootRangeSq && player.kickCooldown <= 0 && Math.random() < (isAttacking ? 0.3 : 0.05)) { // Higher chance for attackers
            player.state = 'SHOOTING';
             logDebug(`${player.id} attempting shot`);
            shootBall(player, goalX, goalY + (Math.random() - 0.5) * GOAL_WIDTH * 1.2); // Aim within wider goal mouth
            stats[player.team === 'A' ? 'teamA' : 'teamB'].shots++;
            player.kickCooldown = KICK_COOLDOWN_FRAMES;
            return;
        }

        // Decision: Pass?
        let bestPassTarget = findBestPassOption(player);
        if (bestPassTarget && player.kickCooldown <= 0 && Math.random() < 0.3) { // Increased pass chance
            player.state = 'PASSING';
             logDebug(`${player.id} passing to ${bestPassTarget.id}`);
            passBall(player, bestPassTarget);
            stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++;
            player.kickCooldown = KICK_COOLDOWN_FRAMES;
            return;
        }

        // Decision: Dribble
        player.state = 'DRIBBLING';
        // Move generally towards goal, add some sideways variation to simulate avoiding opponents
        player.targetX = goalX;
        player.targetY = goalY + (Math.random() - 0.5) * FIELD_HEIGHT * 0.3; // Wiggle towards goal sides
        // Basic obstacle avoidance (very simple: veer if too close to edge/opponent?) - Skipping for now
        movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * PLAYER_DRIBBLE_SPEED_FACTOR, true); // Dribbling is slower, update ball pos

        // Keep ball close while dribbling
        const angleToTarget = Math.atan2(player.targetY - player.y, player.targetX - player.x);
        ball.x = player.x + Math.cos(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS + 1); // Keep slightly ahead
        ball.y = player.y + Math.sin(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS + 1);
        ball.vx = player.vx * 0.5; ball.vy = player.vy * 0.5; // Ball moves slowly with player

        return;
    }

    // ** 2. Action when team has possession (but not this player) **
    const playerOwner = getPlayerById(ball.ownerId);
    if (playerOwner && playerOwner.team === player.team) {
        player.state = 'SUPPORTING';
        // Move to a supporting position relative to the ball carrier and player's role
        const supportDistBase = 100;
        const supportDistVariance = 80;
        let angleToGoal = Math.atan2(goalY - playerOwner.y, goalX - playerOwner.x);

        // Adjust target based on role
        let desiredX = playerOwner.x;
        let desiredY = playerOwner.y;

        if (player.role === 'FWD') {
            // Try to get ahead of the ball carrier towards goal
            desiredX += Math.cos(angleToGoal) * (supportDistBase + Math.random() * supportDistVariance);
            desiredY += Math.sin(angleToGoal) * (supportDistBase * 0.5 + Math.random() * supportDistVariance * 0.5) + (Math.random()-0.5)*50; // More lateral spread
        } else if (player.role === 'MID') {
            // Stay relatively level or slightly behind ball carrier, offering sideways option
             let sideOffset = (Math.random() < 0.5 ? -1 : 1) * (supportDistBase * 0.8 + Math.random() * supportDistVariance * 0.5);
             desiredX += Math.cos(angleToGoal + Math.PI/2) * sideOffset; // Sideways position
             desiredY += Math.sin(angleToGoal + Math.PI/2) * sideOffset;
             // Move slightly back from ball carrier if player is behind them
             if((player.team === 'A' && player.x < playerOwner.x) || (player.team === 'B' && player.x > playerOwner.x)) {
                 desiredX -= Math.cos(angleToGoal) * 50; // Drop back slightly
             }
        } else { // DEF
            // Maintain position relative to own base, but shift towards ball side
             desiredX = player.baseX + (playerOwner.x - player.baseX) * OFF_BALL_MOVEMENT_FACTOR * 0.5; // Less reactive horizontally
             desiredY = player.baseY + (playerOwner.y - player.baseY) * OFF_BALL_MOVEMENT_FACTOR; // More reactive vertically
        }

        // Clamp target to field boundaries
        player.targetX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, desiredX));
        player.targetY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, desiredY));

        movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * (isAttacking ? 1.1 : 0.9)); // Move slightly faster when generally attacking
        return;
    }

    // ** 3. Action when opponent has possession or ball is loose **
    const chaseDistanceSq = (FIELD_WIDTH * (player.role === 'FWD' ? 0.5 : (player.role === 'MID' ? 0.6 : 0.7))) ** 2; // Defenders chase further back

    // If ball is loose and nearby, chase it
    if (ball.ownerId === null && playerDistToBallSq < chaseDistanceSq * 0.8) { // Higher priority for loose ball
        player.state = 'CHASING';
        player.targetX = ball.x;
        player.targetY = ball.y;
        movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * PLAYER_SPRINT_MULTIPLIER); // Sprint!
        if (canControlBall && player.kickCooldown <= 0) {
             logDebug(`${player.id} gaining loose ball`);
             gainPossession(player);
        }
        return;
    }

    // If opponent has ball nearby, potentially mark or intercept
    if (playerOwner && playerOwner.team !== player.team && playerDistToBallSq < chaseDistanceSq) {
        player.state = 'MARKING'; // Or 'PRESSING'
        // Target slightly ahead of opponent towards own goal to intercept? Or directly at them?
        player.targetX = playerOwner.x; // Simple direct marking for now
        player.targetY = playerOwner.y;
         movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * (isDefending ? PLAYER_SPRINT_MULTIPLIER : 1.1) ); // Defenders sprint to mark

        // Attempt tackle/possession gain if very close
        if (canControlBall && player.kickCooldown <= 0) {
             logDebug(`${player.id} attempting to tackle/win ball from ${playerOwner.id}`);
             // Simple win chance based on proximity maybe? For now, auto-win if close enough.
             gainPossession(player);
        }
        return;
    }

    // ** 4. Default: Return to formation position (adjusted by ball location) **
    player.state = 'RETURNING';
    // Adjust base position slightly based on ball's Y position and player's general role zone
    let formationTargetX = player.baseX;
    let formationTargetY = player.baseY + (ball.y - player.baseY) * OFF_BALL_MOVEMENT_FACTOR; // Follow ball's vertical position somewhat

    // Defenders hold their line more strongly based on ball's X position
     if (player.role === 'DEF') {
         const defenseLineX = player.baseX; // Base defensive line
         const shiftFactor = player.team === 'A' ? 1 : -1;
         // Shift line slightly based on ball X, but not past halfway generally
         let ballInfluenceX = (ball.x - FIELD_WIDTH / 2) * 0.1;
         formationTargetX = defenseLineX + ballInfluenceX;
         if (player.team === 'A') formationTargetX = Math.min(FIELD_WIDTH/2 - 50, formationTargetX); // Don't push past halfway
         else formationTargetX = Math.max(FIELD_WIDTH/2 + 50, formationTargetX);
     }
     // Forwards stay higher up
     if (player.role === 'FWD') {
         const attackLineX = player.baseX;
         formationTargetX = attackLineX + (ball.x - attackLineX) * 0.2; // Follow ball X slightly more
     }


    player.targetX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, formationTargetX));
    player.targetY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, formationTargetY));

    movePlayerTowardsTarget(player, BASE_PLAYER_SPEED * 0.9); // Return at normal speed
}

// REVISED: movePlayerTowardsTarget - includes ball handling for dribbling
function movePlayerTowardsTarget(player, speed = BASE_PLAYER_SPEED, isDribbling = false) {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) { // Already at target
        player.vx = 0; player.vy = 0;
        return;
    }

    const angle = Math.atan2(dy, dx);
    const currentSpeed = Math.min(speed, dist); // Don't overshoot target in one step

    player.vx = Math.cos(angle) * currentSpeed;
    player.vy = Math.sin(angle) * currentSpeed;

    // If dribbling, ball position updated in AI logic *after* move is calculated
}

// REVISED: updatePlayerPosition - includes collision
function updatePlayerPosition(player) {
    player.x += player.vx; player.y += player.vy;

    // Clamp to field boundaries
    player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));

    // Simple player collision resolution
    players.forEach(other => {
        if (player.id !== other.id) {
            const dSq = distSq(player.x, player.y, other.x, other.y);
            const minDist = PLAYER_RADIUS * 2;
            if (dSq < minDist * minDist && dSq > 0.01) {
                 const dist = Math.sqrt(dSq);
                 const overlap = minDist - dist;
                 const angle = Math.atan2(player.y - other.y, player.x - other.x);
                 // Move each player half the overlap distance directly away from each other
                 const moveX = (Math.cos(angle) * overlap) / 2;
                 const moveY = (Math.sin(angle) * overlap) / 2;

                 player.x += moveX; player.y += moveY;
                 other.x -= moveX; other.y -= moveY;

                 // Re-clamp after collision adjustment
                 player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
                 player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));
                 other.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, other.x));
                 other.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, other.y));
            }
        }
    });
}

// REVISED: Pass logic - finds best option
function findBestPassOption(passer) {
     let bestTarget = null;
     let bestScore = -Infinity;
     const passerTeam = passer.team;
     const goalX = passerTeam === 'A' ? FIELD_WIDTH : 0;

     players.forEach(p => {
         if (p.team === passerTeam && p.id !== passer.id) {
             const dx = p.x - passer.x;
             const dy = p.y - passer.y;
             const passDistSq = dx * dx + dy * dy;
             const maxPassDistSq = (FIELD_WIDTH * 0.5) ** 2; // Max pass distance ~ half field

             if (passDistSq > 100 && passDistSq < maxPassDistSq) { // Min/Max distance check
                 let score = 0;
                 // Score factor: Closer to opponent goal is better
                 let distToGoalSq = distSq(p.x, p.y, goalX, FIELD_HEIGHT / 2);
                 score += (FIELD_WIDTH**2 - distToGoalSq) * 0.001; // Reward forward position

                 // Score factor: Being open (further from nearest opponent)
                 let nearestOpponentDistSq = Infinity;
                 players.forEach(opp => {
                     if (opp.team !== passerTeam) {
                         nearestOpponentDistSq = Math.min(nearestOpponentDistSq, distSq(p.x, p.y, opp.x, opp.y));
                     }
                 });
                 score += Math.sqrt(nearestOpponentDistSq) * 0.5; // Reward space

                 // Score factor: Avoid passing backwards too much unless necessary
                 if ((passerTeam === 'A' && p.x < passer.x - 50) || (passerTeam === 'B' && p.x > passer.x + 50)) {
                     score *= 0.6; // Penalize strongly backward passes
                 } else if ((passerTeam === 'A' && p.x < passer.x) || (passerTeam === 'B' && p.x > passer.x)) {
                      score *= 0.9; // Slightly penalize any backward pass
                 }


                 // Score factor: Role preference (e.g., Mid -> Fwd favored)
                 if (passer.role === 'MID' && p.role === 'FWD') score *= 1.2;
                 if (passer.role === 'DEF' && p.role === 'FWD') score *= 1.1; // Long ball?
                 if (passer.role === 'FWD' && p.role === 'DEF') score *= 0.5; // Forward passing back less likely

                 if (score > bestScore) {
                     bestScore = score;
                     bestTarget = p;
                 }
             }
         }
     });
      // logDebug(`Best pass option for ${passer.id}: ${bestTarget?.id} (Score: ${bestScore.toFixed(1)})`);
     return bestTarget;
 }

// REVISED: passBall - uses calculated power and inaccuracy
function passBall(passer, targetPlayer) {
    ball.ownerId = null; passer.hasBall = false; // Release ball FIRST
    const dx = targetPlayer.x - passer.x; const dy = targetPlayer.y - passer.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * PASS_INACCURACY_FACTOR * (1 + dist / (FIELD_WIDTH*0.3)); // More inaccurate further away
    const finalAngle = angle + inaccuracyAngle;
    const power = Math.min(BALL_MAX_SPEED, PASS_MIN_POWER + dist * PASS_POWER_FACTOR); // Power based on distance

    ball.x = passer.x + Math.cos(angle) * (PLAYER_RADIUS + BALL_RADIUS + 1); // Start ball just ahead of player
    ball.y = passer.y + Math.sin(angle) * (PLAYER_RADIUS + BALL_RADIUS + 1);
    ball.vx = Math.cos(finalAngle) * power;
    ball.vy = Math.sin(finalAngle) * power;
    logDebug(`Pass from ${passer.id} to ${targetPlayer.id}. Dist: ${dist.toFixed(0)}, Power: ${power.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}`);
}

// REVISED: shootBall - uses calculated power and inaccuracy
function shootBall(shooter, targetX, targetY) {
    ball.ownerId = null; shooter.hasBall = false; // Release ball FIRST
    const dx = targetX - shooter.x; const dy = targetY - shooter.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * SHOT_INACCURACY_FACTOR * (1 + dist / (FIELD_WIDTH*0.5)); // More inaccurate further away
    const finalAngle = angle + inaccuracyAngle;
    const power = SHOT_POWER_BASE + (Math.random() * SHOT_POWER_VARIANCE) - (dist/(FIELD_WIDTH*0.5))*3; // Slightly less power further out

    ball.x = shooter.x + Math.cos(angle) * (PLAYER_RADIUS + BALL_RADIUS + 1); // Start ball just ahead
    ball.y = shooter.y + Math.sin(angle) * (PLAYER_RADIUS + BALL_RADIUS + 1);
    ball.vx = Math.cos(finalAngle) * Math.max(5, power); // Ensure minimum shot power
    ball.vy = Math.sin(finalAngle) * Math.max(5, power);
    logDebug(`Shot by ${shooter.id}. Dist: ${dist.toFixed(0)}, Power: ${power.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}`);
}


// REVISED: updateBallPhysics - includes possession check and goal logic
function updateBallPhysics() {
    if (!ball) return;

    const owner = getPlayerById(ball.ownerId);

    // If ball has an owner, check if they are still valid and capable of controlling it
    if (owner) {
        if (owner.state === 'DRIBBLING') {
            // Dribbling updates ball position in the AI logic, applying slight physics maybe?
             ball.x += ball.vx; ball.y += ball.vy;
             ball.vx *= BALL_FRICTION * 0.95; // Higher friction when dribbling?
             ball.vy *= BALL_FRICTION * 0.95;
        } else {
             // Player has possession but isn't actively dribbling (e.g., just tackled, preparing kick)
             // Keep ball very close, minimal independent movement
             const angle = Math.atan2(owner.vy, owner.vx); // Angle of player movement
             ball.x = owner.x + Math.cos(angle) * (PLAYER_RADIUS + BALL_RADIUS);
             ball.y = owner.y + Math.sin(angle) * (PLAYER_RADIUS + BALL_RADIUS);
             ball.vx = 0; ball.vy = 0;
         }
         // Check if owner is too far (e.g., collided away), lose possession
         if (distSq(owner.x, owner.y, ball.x, ball.y) > (KICK_RANGE * 1.5) ** 2) {
              logDebug(`Ball lost by ${owner.id} due to distance.`);
              ball.ownerId = null;
              owner.hasBall = false;
         }
    }

    // Apply physics if ball is loose
    if (!ball.ownerId) {
        ball.x += ball.vx; ball.y += ball.vy;
        ball.vx *= BALL_FRICTION; ball.vy *= BALL_FRICTION;
        if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
        if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

        // Wall collisions (simple bounce)
        if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy *= -0.6; }
        if (ball.y > FIELD_HEIGHT - BALL_RADIUS) { ball.y = FIELD_HEIGHT - BALL_RADIUS; ball.vy *= -0.6; }

        // Goal check constants
        const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2;
        const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2;
        const postCollisionMargin = BALL_RADIUS + 2; // Margin for hitting post area

        // Goal Check (Left Goal - B's Goal, A scores)
        if (ball.x < GOAL_DEPTH + postCollisionMargin) { // Check within goal depth + margin
             if (ball.y > goalTopY && ball.y < goalBottomY && ball.x < GOAL_DEPTH + BALL_RADIUS) { // Check *inside* goal depth
                 handleGoal('A'); return; // GOAL!
             } else if (ball.x < BALL_RADIUS) { // Hit back/side wall or post area outside goal mouth
                 ball.vx *= -0.6; ball.x = BALL_RADIUS;
             } else if ((ball.y < goalTopY + postCollisionMargin && ball.y > goalTopY - postCollisionMargin) || (ball.y > goalBottomY - postCollisionMargin && ball.y < goalBottomY + postCollisionMargin)) {
                 // Hit top/bottom post area
                  ball.vy *= -0.6; ball.vx *= 0.8; // Hit post, change directions
             }
        }
        // Goal Check (Right Goal - A's Goal, B scores)
        if (ball.x > FIELD_WIDTH - GOAL_DEPTH - postCollisionMargin) {
             if (ball.y > goalTopY && ball.y < goalBottomY && ball.x > FIELD_WIDTH - GOAL_DEPTH - BALL_RADIUS) {
                 handleGoal('B'); return; // GOAL!
             } else if (ball.x > FIELD_WIDTH - BALL_RADIUS) {
                 ball.vx *= -0.6; ball.x = FIELD_WIDTH - BALL_RADIUS;
             } else if ((ball.y < goalTopY + postCollisionMargin && ball.y > goalTopY - postCollisionMargin) || (ball.y > goalBottomY - postCollisionMargin && ball.y < goalBottomY + postCollisionMargin)) {
                 ball.vy *= -0.6; ball.vx *= 0.8;
             }
        }

        // If still no owner, check if any player can gain possession
        if (!ball.ownerId) {
            let potentialOwner = null;
            let minDistSq = CONTROL_RANGE ** 2;
            players.forEach(p => {
                 // Player must be able to kick and be close enough
                if (p.kickCooldown <= 0 && p.role !== 'GK') { // GKs claim differently in their logic
                    const dSq = distSq(p.x, p.y, ball.x, ball.y);
                    if (dSq < minDistSq) {
                        minDistSq = dSq;
                        potentialOwner = p;
                    }
                }
            });
            if (potentialOwner) {
                gainPossession(potentialOwner);
            }
        }
    }
}


function gainPossession(player) {
    if (ball.ownerId === player.id) return; // Already has it

    const previousOwner = getPlayerById(ball.ownerId);
    if (previousOwner) {
         previousOwner.hasBall = false;
         previousOwner.state = 'RETURNING'; // Or similar state after losing ball
         logDebug(`${previousOwner.id} lost possession.`);
    }
    ball.ownerId = player.id;
    player.hasBall = true;
    player.state = 'IDLE'; // State change allows immediate decision (pass/shoot/dribble)
    ball.vx = 0; ball.vy = 0; // Stop the ball instantly on possession gain
    logDebug(`${player.id} gained possession.`);
}

function handleGoal(scoringTeam) {
    logDebug(`!!!! GOAL by Team ${scoringTeam} !!!!`);
    if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') {
         logDebug("Goal scored outside of active play state? Ignoring.");
         return; // Prevent goals during breaks etc.
    }

    if (scoringTeam === 'A') { scoreA++; stats.teamA.goals++; }
    else { scoreB++; stats.teamB.goals++; }

    // Store current stats before reset for broadcast
    const finalStats = JSON.parse(JSON.stringify(stats)); // Deep copy

    broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB, stats: finalStats } });

    const kickingTeam = scoringTeam === 'A' ? 'B' : 'A'; // Opponent kicks off
    resetPositions(kickingTeam);
}

// REVISED: updateGame - uses precise time delta
function updateGame() {
    if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return;

    const now = Date.now();
    const timeDeltaMs = lastUpdateTimestamp > 0 ? now - lastUpdateTimestamp : MILLISECONDS_PER_UPDATE; // Use actual elapsed time
    lastUpdateTimestamp = now;

    const startTime = performance.now(); // Use performance.now for accurate duration measurement

    try {
        players.forEach(updatePlayerAI);
        players.forEach(updatePlayerPosition); // Includes collision resolution
        updateBallPhysics(); // Includes possession checks and goal detection
    } catch (error) {
        console.error("Error during game update logic:", error);
        // Consider stopping the simulation or logging more details
    }

    // Update game time based on real time elapsed and speed factor
    const ingameSecondsIncrement = (timeDeltaMs / 1000) * GAME_SPEED_FACTOR;
    serverGameTime += ingameSecondsIncrement;

    const maxHalfTime = 45 * 60;
    const maxFullTime = 90 * 60;

    // Check for half/full time
    if (gameState === 'FIRST_HALF' && serverGameTime >= maxHalfTime) {
        serverGameTime = maxHalfTime; // Cap time exactly
        handleHalfTime();
    } else if (gameState === 'SECOND_HALF' && serverGameTime >= maxFullTime) {
        serverGameTime = maxFullTime; // Cap time exactly
        handleFullTime();
    }

    const updateDuration = performance.now() - startTime;
    if (updateDuration > MILLISECONDS_PER_UPDATE * 1.5) {
        logDebug(`Warning: Game update took ${updateDuration.toFixed(1)}ms (budget ${MILLISECONDS_PER_UPDATE.toFixed(1)}ms)`);
    }
}


// --- Game Flow Control ---

function startMatch() {
    logDebug(`[State Transition] Starting Match: ${teamA?.name} vs ${teamB?.name}`);
    if (!teamA || !teamB || players.length !== 22) {
        console.error("Cannot start match, teams/players not set up correctly. Restarting initial sequence.");
        startInitialSequence(); return;
    }
    if (gameState !== 'PRE_MATCH') {
         logDebug(`Warning: Tried to start match but state was ${gameState}. Aborting start.`);
         return;
    }

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    resetPositions('A'); // Team A kicks off first half
    // Stats are reset in setupTeams
    // Score reset in setupTeams
    serverGameTime = 0;
    lastUpdateTimestamp = Date.now(); // Initialize timestamp for time calculation
    gameState = 'FIRST_HALF';

    broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } }); // Send final match details
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for First Half.");
}

function handleHalfTime() {
    logDebug("[State Transition] Handling Half Time");
    if (gameState !== 'FIRST_HALF') { logDebug("Warning: Tried to handle halftime but not in first half state:", gameState); return; }

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    gameState = 'HALF_TIME';
    serverGameTime = 45 * 60; // Ensure time is exactly 45:00
    breakEndTime = Date.now() + HALF_TIME_BREAK_MS;

    broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime, stats } }); // Send final halftime state

    breakTimerTimeout = setTimeout(startSecondHalf, HALF_TIME_BREAK_MS);
    logDebug(`Halftime break. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`);
}

function startSecondHalf() {
    logDebug("[State Transition] Starting Second Half");
    if (gameState !== 'HALF_TIME') { logDebug("Warning: Tried to start second half but not in halftime state:", gameState); return; }

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    resetPositions('B'); // Team B kicks off second half
    // serverGameTime should already be 45*60
    lastUpdateTimestamp = Date.now(); // Reset timestamp
    gameState = 'SECOND_HALF';

    broadcast({ type: 'secondHalfStart', payload: { stats } }); // Send stats at 2nd half start
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for Second Half.");
}

// REVISED: handleFullTime - Prepares next match details
function handleFullTime() {
    logDebug("[State Transition] Handling Full Time");
    if (gameState !== 'SECOND_HALF') { logDebug("Warning: Tried to handle fulltime but not in second half state:", gameState); return; }

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    gameState = 'FULL_TIME';
    serverGameTime = 90 * 60; // Ensure time is exactly 90:00
    breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS;

    // Prepare details for the *next* match immediately
    if (availableTeams.length < 2) {
        logDebug("Team pool low, resetting and shuffling for next match.");
        availableTeams = [...nationalTeams];
        shuffleArray(availableTeams);
        // Ensure current teams are not immediately re-picked if pool was very low
        availableTeams = availableTeams.filter(t => t.name !== teamA?.name && t.name !== teamB?.name);
        if (availableTeams.length < 2) { // Still not enough? Add back generic teams or error
             console.error("FATAL: Not enough unique teams available even after reset!");
             // Handle this case - maybe reuse teams? For now, log error.
             // Re-add the just played teams if desperate
             if(teamA) availableTeams.push(nationalTeams.find(t => t.name === teamA.name));
             if(teamB) availableTeams.push(nationalTeams.find(t => t.name === teamB.name));
             shuffleArray(availableTeams); // Shuffle again
        }
    }
    const nextTeamDataA = availableTeams.pop();
    const nextTeamDataB = availableTeams.pop();

    if (!nextTeamDataA || !nextTeamDataB) {
         console.error("Failed to get next teams! Restarting initial sequence.");
         startInitialSequence(); // Try recovery
         return;
     }

    // Generate odds for the NEXT match
     const nextOdds = generateOdds(nextTeamDataA.rating, nextTeamDataB.rating);
     nextMatchDetails = {
         teamA: nextTeamDataA, // Store full team data
         teamB: nextTeamDataB,
         oddsA: nextOdds.oddsA,
         oddsB: nextOdds.oddsB
     };
     logDebug(`Prepared next match: ${nextMatchDetails.teamA.name} vs ${nextMatchDetails.teamB.name} (Odds: ${nextMatchDetails.oddsA} / ${nextMatchDetails.oddsB})`);

    // Broadcast final result of *this* match, PLUS the details for the *next* one
    broadcast({
         type: 'fullTime',
         payload: {
             scoreA, scoreB, // Final score of completed match
             breakEndTime,
             stats,         // Final stats of completed match
             nextMatch: nextMatchDetails // Details for upcoming match
         }
     });

    resolveAllBets(); // Resolve bets based on the match that just ended

    // Schedule the setup for the actual next match start
    breakTimerTimeout = setTimeout(setupNextMatch, BETWEEN_MATCH_BREAK_MS);
    logDebug(`Full Time declared. Bet resolution done. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`);
}


// REVISED: setupNextMatch - Uses pre-calculated details, transitions to PRE_MATCH
function setupNextMatch() {
    logDebug("[State Transition] Setting up Next Match (from stored details)");

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    // Use the details prepared during handleFullTime
    if (!nextMatchDetails || !nextMatchDetails.teamA || !nextMatchDetails.teamB) {
        console.error("Error: nextMatchDetails not available when setting up next match. Restarting sequence.");
        startInitialSequence(); // Attempt recovery
        return;
    }

    // Officially set teamA, teamB, oddsA, oddsB from the stored nextMatchDetails
    if (!setupTeams(nextMatchDetails.teamA, nextMatchDetails.teamB)) { // setupTeams also sets oddsA, oddsB now
         console.error("Failed to setup teams using nextMatchDetails! Restarting initial sequence.");
         startInitialSequence(); // Try recovery
         return;
    }

    // Clear the temporary storage
    const setupTeamA = teamA; // Keep refs to the teams just set up
    const setupTeamB = teamB;
    const setupOddsA = oddsA;
    const setupOddsB = oddsB;
    nextMatchDetails = null;

    gameState = 'PRE_MATCH';
    logDebug(`Transitioning to PRE_MATCH for ${setupTeamA.name} vs ${setupTeamB.name}`);

    // Broadcast the PRE_MATCH state with the confirmed teams/odds
     broadcast({
          type: 'preMatch', // Specific event for clients to know the final teams/odds before kickoff
          payload: { teamA: setupTeamA, teamB: setupTeamB, oddsA: setupOddsA, oddsB: setupOddsB }
      });

    // Schedule the actual match start after a short delay
    breakTimerTimeout = setTimeout(() => {
        if (gameState === 'PRE_MATCH') { // Ensure state hasn't changed unexpectedly
             startMatch(); // This will change state to FIRST_HALF and start simulation
        } else {
             logDebug(`Warning: Wanted to start match from PRE_MATCH delay, but state is now ${gameState}.`);
        }
    }, PRE_MATCH_DELAY_MS); // Short delay after broadcasting PRE_MATCH

    logDebug(`Next match setup complete (${setupTeamA.name} vs ${setupTeamB.name}). Kickoff in ${PRE_MATCH_DELAY_MS / 1000}s.`);
}


// REVISED: resolveAllBets - Uses final score of the completed match
function resolveAllBets() {
    logDebug(`Resolving bets for finished match: ${teamA?.name} ${scoreA} - ${scoreB} ${teamB?.name}`);
    const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); // null for draw

    clients.forEach((clientData, ws) => {
        if (clientData.currentBet) {
            let payout = 0;
            let message = "";
            const bet = clientData.currentBet;
            // IMPORTANT: Use the odds from the match that JUST FINISHED (oddsA, oddsB)
            // NOT the nextMatchDetails odds.
            const betOdds = bet.team === 'A' ? parseFloat(oddsA || 0) : parseFloat(oddsB || 0);
            const betTeamName = bet.team === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B';

            if (isNaN(betOdds) || betOdds <= 0) {
                 console.error(`Invalid odds (${betOdds}) for bet resolution for ${clientData.nickname}. Refunding.`);
                 clientData.balance += bet.amount; // Refund amount
                 payout = bet.amount; // For success check
                 message = `Error resolving bet due to invalid odds. Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                 logDebug(`Bet refunded (invalid odds) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`);
            } else if (bet.team === winningTeam) {
                payout = bet.amount * betOdds;
                clientData.balance += payout; // Add winnings (includes stake back)
                message = `Bet on ${betTeamName} WON! Payout: +$${payout.toFixed(2)}.`;
                logDebug(`Bet won for ${clientData.nickname || clientData.id}: +$${payout.toFixed(2)}`);
            } else if (winningTeam === null) { // Draw refund
                clientData.balance += bet.amount; // Refund stake
                payout = bet.amount; // For success check
                message = `Match drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                logDebug(`Bet refunded (draw) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`);
            } else { // Bet lost
                payout = 0; // No change in balance (amount was already deducted)
                message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`;
                 logDebug(`Bet lost for ${clientData.nickname || clientData.id}: -$${bet.amount.toFixed(2)}`);
            }

            sendToClient(ws, {
                type: 'betResult',
                payload: {
                    success: payout >= bet.amount || winningTeam === null, // True if won OR refunded
                    message: message,
                    newBalance: clientData.balance
                 }
            });
            clientData.currentBet = null; // Clear bet *after* sending result
        } else {
            // Optional: Send a message if they didn't bet? Or just log.
            // logDebug(`Client ${clientData.nickname || clientData.id} had no active bet.`);
        }
    });
    logDebug("Bet resolution complete.");
}


// --- Initial Sequence ---
function startInitialSequence() {
    console.log("Starting initial server sequence...");
    gameState = 'INITIALIZING';
    nextMatchDetails = null; // Ensure no stale next match info

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;
    logDebug("Cleared existing timers/intervals.");

    // Setup first teams
    logDebug("Initial sequence: Resetting team pool.");
    availableTeams = [...nationalTeams];
    shuffleArray(availableTeams);
    const firstTeamA = availableTeams.pop();
    const firstTeamB = availableTeams.pop();

    if (!firstTeamA || !firstTeamB) { /* ... error handling unchanged ... */ console.error("Failed to get initial teams! Retrying in 5s..."); breakTimerTimeout = setTimeout(startInitialSequence, 5000); return; }
    if (!setupTeams(firstTeamA, firstTeamB)) { /* ... error handling unchanged ... */ console.error("Failed to setup initial teams! Retrying in 5s..."); breakTimerTimeout = setTimeout(startInitialSequence, 5000); return; }

    // Transition to initial betting period
    gameState = 'INITIAL_BETTING';
    breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS;
    logDebug(`Initial betting period ends at ${new Date(breakEndTime).toLocaleTimeString()}`);

    // Broadcast initial state including first teams/odds
    broadcast({
        type: 'initialWait', // Special message for first wait
        payload: { teamA, teamB, oddsA, oddsB, breakEndTime, allTournamentTeams: nationalTeams.map(t => t.name) }
    });

    // Schedule the end of the initial betting period
    breakTimerTimeout = setTimeout(() => {
         if(gameState === 'INITIAL_BETTING') {
            logDebug("Initial betting wait over. Proceeding to setup first match details.");
             // Instead of calling setupNextMatch directly, just transition to PRE_MATCH
             // using the already set teamA/teamB. setupNextMatch is for *between* games.
             gameState = 'PRE_MATCH';
              logDebug(`Transitioning to PRE_MATCH for ${teamA.name} vs ${teamB.name}`);
              broadcast({
                 type: 'preMatch',
                 payload: { teamA, teamB, oddsA, oddsB }
             });
             // Schedule the actual startMatch after the PRE_MATCH delay
              breakTimerTimeout = setTimeout(() => {
                 if (gameState === 'PRE_MATCH') { startMatch(); }
                  else { logDebug(`Warning: Wanted to start first match from PRE_MATCH delay, but state is now ${gameState}.`); }
             }, PRE_MATCH_DELAY_MS);

         } else {
            logDebug(`Warning: Initial wait timer finished, but game state was already ${gameState}. No action taken.`);
         }
    }, INITIAL_BETTING_WAIT_MS);
}

// --- WebSocket Connection Handling ---
wss.on('connection', (ws, req) => {
    // ... (connection setup, client ID, Map add - unchanged) ...
    const remoteAddress = req.socket.remoteAddress || req.headers['x-forwarded-for']; // Handle potential proxy
    const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    logDebug(`Client connected: ${clientId} from ${remoteAddress}`);
    clients.set(ws, {
        id: clientId,
        nickname: null,
        balance: 100, // Starting balance
        currentBet: null
    });

    // Send the current, complete game state on connection
    sendToClient(ws, {
        type: 'currentGameState',
        payload: createFullGameStatePayload() // Ensure this sends all necessary info
    });

    ws.on('message', (message) => {
        let data;
        try {
            // ... (message parsing, basic validation - unchanged) ...
             if (typeof message !== 'string' && !Buffer.isBuffer(message)) { logDebug(`Received non-string/non-buffer message from ${clientId}, ignoring.`); return; }
             const messageText = Buffer.isBuffer(message) ? message.toString('utf8') : message;
             data = JSON.parse(messageText);

            const clientData = clients.get(ws);
            if (!clientData) { logDebug(`Received message from stale/unknown client. Terminating.`); ws.terminate(); return; }

            // --- Message Handlers ---
            switch (data.type) {
                case 'setNickname':
                    // ... (nickname logic - unchanged) ...
                    const nick = data.payload?.trim();
                    if (nick && nick.length > 0 && nick.length <= 15) {
                         const oldNickname = clientData.nickname;
                         clientData.nickname = nick;
                         logDebug(`Client ${clientData.id} set nickname to ${nick}`);
                         // Send welcome message with current bet state if any exists from previous session (if implemented)
                         sendToClient(ws, { type: 'welcome', payload: { nickname: nick, balance: clientData.balance, currentBet: clientData.currentBet } });
                         if (nick !== oldNickname) {
                            const joinMsg = oldNickname ? `${oldNickname} changed name to ${nick}` : `${nick} has joined.`;
                            broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: joinMsg } });
                         }
                    } else { /* ... invalid nickname handling ... */ sendToClient(ws, { type: 'systemMessage', payload: { message: 'Invalid nickname (1-15 chars).', isError: true } });}
                    break;

                case 'chatMessage':
                    // ... (chat logic - unchanged) ...
                    if (clientData.nickname && data.payload && typeof data.payload === 'string') { const chatMsg = data.payload.substring(0, 100).trim(); if (chatMsg.length > 0) { broadcast({ type: 'chatBroadcast', payload: { sender: clientData.nickname, message: chatMsg } }); } } else if (!clientData.nickname) { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Please set a nickname to chat.', isError: true } }); }
                    break;

                case 'placeBet':
                    // REVISED Betting Logic
                    const isBettingPeriod = (gameState === 'INITIAL_BETTING' || gameState === 'FULL_TIME' || gameState === 'PRE_MATCH');
                    const betPayload = data.payload;
                    const betAmount = parseInt(betPayload?.amount, 10);
                    const betTeam = betPayload?.team; // 'A' or 'B'

                    // 1. Basic validations
                    if (!clientData.nickname) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Set nickname to bet.', newBalance: clientData.balance } }); break; }
                    if (!isBettingPeriod) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting is currently closed.', newBalance: clientData.balance } }); break; }
                    if (clientData.currentBet) {
                         const betOnTeamNameCurrent = clientData.currentBet.team === 'A' ? (gameState === 'FULL_TIME' ? nextMatchDetails?.teamA?.name : teamA?.name) : (gameState === 'FULL_TIME' ? nextMatchDetails?.teamB?.name : teamB?.name);
                         sendToClient(ws, { type: 'betResult', payload: { success: false, message: `Bet already placed on ${betOnTeamNameCurrent || 'a team'}.`, newBalance: clientData.balance } }); break;
                    }
                    if (!(betTeam === 'A' || betTeam === 'B') || isNaN(betAmount) || betAmount <= 0) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Invalid bet amount or team.', newBalance: clientData.balance } }); break; }
                    if (betAmount > clientData.balance) { sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Insufficient balance.', newBalance: clientData.balance } }); break; }

                    // 2. Determine which teams/odds the bet applies to
                    let bettingOnTeamA, bettingOnTeamB;
                    if (gameState === 'FULL_TIME' && nextMatchDetails) {
                        // Betting is for the *next* match
                        bettingOnTeamA = nextMatchDetails.teamA;
                        bettingOnTeamB = nextMatchDetails.teamB;
                    } else if (gameState === 'INITIAL_BETTING' || gameState === 'PRE_MATCH') {
                        // Betting is for the *current/upcoming* match (teamA/teamB)
                         bettingOnTeamA = teamA;
                         bettingOnTeamB = teamB;
                    } else {
                        // Should not happen due to isBettingPeriod check, but safeguard
                        sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting error: Invalid state.', newBalance: clientData.balance } });
                        break;
                    }

                    if (!bettingOnTeamA || !bettingOnTeamB) {
                        sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Betting error: Team data missing.', newBalance: clientData.balance } });
                        break;
                    }

                    // 3. Place bet
                    clientData.balance -= betAmount;
                    clientData.currentBet = { team: betTeam, amount: betAmount }; // Store the bet
                    const betOnTeamName = betTeam === 'A' ? bettingOnTeamA.name : bettingOnTeamB.name;
                    sendToClient(ws, { type: 'betResult', payload: { success: true, message: `Bet $${betAmount.toFixed(2)} on ${betOnTeamName} placed.`, newBalance: clientData.balance } });
                    logDebug(`${clientData.nickname} bet $${betAmount} on ${betTeam} (${betOnTeamName})`);
                    break;

                default:
                    logDebug(`Unknown message type from ${clientData.id}: ${data.type}`);
            }

        } catch (error) { /* ... error handling unchanged ... */ console.error(`Failed to process message or invalid JSON from ${clientId}: ${message}`, error); const clientData = clients.get(ws); if (clientData) { sendToClient(ws, { type: 'systemMessage', payload: { message: 'Error processing your request.', isError: true } }); } }
    });

    ws.on('close', (code, reason) => { /* ... disconnect logic unchanged ... */ const clientData = clients.get(ws); const reasonString = reason ? reason.toString() : 'N/A'; if (clientData) { logDebug(`Client disconnected: ${clientData.nickname || clientData.id}. Code: ${code}, Reason: ${reasonString}`); if (clientData.nickname) { broadcast({ type: 'chatBroadcast', payload: { sender: 'System', message: `${clientData.nickname} has left.` } }); } clients.delete(ws); } else { logDebug(`Unknown client disconnected. Code: ${code}, Reason: ${reasonString}`); } });
    ws.on('error', (error) => { /* ... error handling unchanged ... */ const clientData = clients.get(ws); console.error(`WebSocket error for client ${clientData?.nickname || clientData?.id || 'UNKNOWN'}:`, error); if (clients.has(ws)) { logDebug(`Removing client ${clientData?.id || 'UNKNOWN'} due to error.`); clients.delete(ws); } try { ws.terminate(); } catch (e) { /* ignore */ } });
});


// --- Periodic State Broadcast ---
// Sends minimal updates frequently during active play
setInterval(() => {
    if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') {
        // Only send data that changes frequently
        broadcast({
            type: 'gameStateUpdate',
            payload: {
                scoreA, scoreB,
                serverGameTime: calculateCurrentDisplayTime(), // Use helper for consistency
                players: players || [],
                ball: ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null },
                stats: stats // Send latest stats
            }
        });
    }
}, 150); // Broadcast rate (~6-7 fps updates) - Adjust as needed for performance/smoothness

// --- Helper Functions ---

// REVISED: createFullGameStatePayload - includes all necessary initial data
function createFullGameStatePayload() {
    const payload = {
        gameState,
        scoreA, scoreB,
        teamA, teamB, // Current or last match teams
        oddsA, oddsB, // Current or last match odds
        serverGameTime: calculateCurrentDisplayTime(),
        players: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (players || []) : [], // Only send players if relevant
        ball: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }) : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null },
        breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null,
        stats: stats,
        allTournamentTeams: nationalTeams.map(t => t.name) // Include full team list
    };

    // If in FULL_TIME, also include the next match details if available
    if (gameState === 'FULL_TIME' && nextMatchDetails) {
         payload.nextMatch = nextMatchDetails;
    }

     // Filter sensitive data if needed before sending (e.g., internal AI state) - not necessary here yet

    return payload;
}

// Helper to calculate display time based on server state
function calculateCurrentDisplayTime() {
    if (gameState === 'FIRST_HALF') { return Math.max(0, Math.min(45 * 60, serverGameTime)); }
    else if (gameState === 'SECOND_HALF') { return Math.max(45 * 60, Math.min(90 * 60, serverGameTime)); }
    else if (gameState === 'HALF_TIME') { return 45 * 60; }
    else if (gameState === 'FULL_TIME' || gameState === 'PRE_MATCH') { return 90 * 60; } // Show 90:00 during break/pre-match
    else { return 0; } // INITIALIZING, INITIAL_BETTING
}

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server listening on port ${PORT}`);
    startInitialSequence(); // Start the game sequence
});

// --- Graceful Shutdown ---
// ... (Graceful shutdown logic - unchanged) ...
function gracefulShutdown(signal) { console.log(`${signal} received: closing server...`); if (gameLogicInterval) clearInterval(gameLogicInterval); if (breakTimerTimeout) clearTimeout(breakTimerTimeout); server.close(() => { console.log('HTTP server closed.'); wss.close(() => { console.log('WebSocket server closed.'); process.exit(0); }); setTimeout(() => { console.log("Forcing remaining WebSocket connections closed."); wss.clients.forEach(ws => ws.terminate()); }, 2000); }); setTimeout(() => { console.error("Graceful shutdown timeout exceeded. Forcing exit."); process.exit(1); }, 10000); }
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

console.log("Server script finished initial execution. Waiting for connections...");
