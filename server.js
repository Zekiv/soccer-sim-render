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
// IMPORTANT: Copy the full nationalTeams array here
const nationalTeams = [
    { name: "Argentina", color: "#75AADB", rating: 92 }, { name: "France", color: "#003399", rating: 91 }, { name: "Brazil", color: "#FFDF00", rating: 90 }, { name: "England", color: "#FFFFFF", textColor: "#000000", rating: 89 }, { name: "Belgium", color: "#ED2939", rating: 88 }, { name: "Croatia", color: "#FF0000", rating: 87 }, { name: "Netherlands", color: "#FF6600", rating: 87 }, { name: "Italy", color: "#003399", rating: 86 }, { name: "Portugal", color: "#006600", rating: 86 }, { name: "Spain", color: "#FF0000", rating: 85 }, { name: "Morocco", color: "#006233", rating: 84 }, { name: "Switzerland", color: "#FF0000", rating: 84 }, { name: "USA", color: "#002868", rating: 83 }, { name: "Germany", color: "#000000", rating: 83 }, { name: "Mexico", color: "#006847", rating: 82 }, { name: "Uruguay", color: "#5CBFEB", rating: 82 }, { name: "Colombia", color: "#FCD116", rating: 81 }, { name: "Senegal", color: "#00853F", rating: 81 }, { name: "Denmark", color: "#C60C30", rating: 80 }, { name: "Japan", color: "#000080", rating: 80 }, { name: "Peru", color: "#D91023", rating: 79 }, { name: "Iran", color: "#239F40", rating: 79 }, { name: "Serbia", color: "#C6363C", rating: 78 }, { name: "Poland", color: "#DC143C", rating: 78 }, { name: "Sweden", color: "#006AA7", rating: 78 }, { name: "Ukraine", color: "#005BBB", rating: 77 }, { name: "South Korea", color: "#FFFFFF", textColor:"#000000", rating: 77 }, { name: "Chile", color: "#D52B1E", rating: 76 }, { name: "Tunisia", color: "#E70013", rating: 76 }, { name: "Costa Rica", color: "#002B7F", rating: 75 }, { name: "Australia", color: "#00843D", rating: 75 }, { name: "Nigeria", color: "#008751", rating: 75 }, { name: "Austria", color: "#ED2939", rating: 74 }, { name: "Hungary", color: "#436F4D", rating: 74 }, { name: "Russia", color: "#FFFFFF", textColor:"#000000", rating: 73 }, { name: "Czech Republic", color: "#D7141A", rating: 73 }, { name: "Egypt", color: "#C8102E", rating: 73 }, { name: "Algeria", color: "#006233", rating: 72 }, { name: "Scotland", color: "#0065BF", rating: 72 }, { name: "Norway", color: "#EF2B2D", rating: 72 }, { name: "Turkey", color: "#E30A17", rating: 71 }, { name: "Mali", color: "#14B53A", rating: 71 }, { name: "Paraguay", color: "#DA121A", rating: 70 }, { name: "Ivory Coast", color: "#FF8200", rating: 70 }, { name: "Republic of Ireland", color: "#169B62", rating: 70 }, { name: "Qatar", color: "#8A1538", rating: 69 }, { name: "Saudi Arabia", color: "#006C35", rating: 69 }, { name: "Greece", color: "#0D5EAF", rating: 69 }, { name: "Romania", color: "#002B7F", rating: 68 },
];
let availableTeams = [];

// IMPORTANT: Copy the full sampleSquads object here
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
    "Russia": ["M Safonov", "V Karavaev", "G Dzhikiya", "I Diveev", "D Krugovoy", "D Barinov", "D Kuzyaev", "A Golovin", "A Miranchuk", "A Zakharyan", "F Smolov"], // Note: Russia often fields varied squads due to suspensions
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
function getPlayerInitials(name, index = 0) { if (typeof name !== 'string' || name.trim() === '') { return `P${index + 1}`; } const parts = name.trim().split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); } else if (parts.length === 1 && name.length > 0) { return name.substring(0, Math.min(2, name.length)).toUpperCase(); } return `P${index + 1}`; }
function isColorDark(hexColor) { if (!hexColor || typeof hexColor !== 'string') return false; hexColor = hexColor.replace('#', ''); if (hexColor.length !== 6) return false; try { const r = parseInt(hexColor.substring(0, 2), 16); const g = parseInt(hexColor.substring(2, 4), 16); const b = parseInt(hexColor.substring(4, 6), 16); const brightness = (r * 299 + g * 587 + b * 114) / 1000; return brightness < 128; } catch (e) { return false; } }
function distSq(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }
function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function getRandomElement(arr) { if (!arr || arr.length === 0) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function generateOdds() { if (!teamA || !teamB) { oddsA = 2.00; oddsB = 2.00; return; } const ratingDiff = teamA.rating - teamB.rating; const baseProbA = 0.5 + (ratingDiff / 50); oddsA = Math.max(1.1, 1 / (baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); oddsB = Math.max(1.1, 1 / (1 - baseProbA + (Math.random() - 0.5) * 0.1)).toFixed(2); logDebug(`Generated Odds: ${teamA.name} (${teamA.rating}) ${oddsA} vs ${teamB.name} (${teamB.rating}) ${oddsB}`); }

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
    const clientData = clients.get(ws); // Get client data for logging context
    if (ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify(data);
        // logDebug(`Sending to ${clientData?.id || 'UNKNOWN'}: ${message.substring(0, 150)}...`);
        ws.send(message, (err) => {
             if (err) { console.error(`Send error to ${clientData?.id || 'UNKNOWN'}:`, err); }
        });
    } else {
        logDebug(`Attempted to send to closed socket for ${clientData?.id || 'UNKNOWN'}`);
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
const formation433 = (teamId) => { const sideMultiplier = teamId === 'A' ? 1 : -1; const xOffset = FIELD_WIDTH / 2; const yOffset = FIELD_HEIGHT / 2; const gkX = sideMultiplier * (-FIELD_WIDTH * 0.48); const defLineX = sideMultiplier * (-FIELD_WIDTH * 0.35); const midLineX = sideMultiplier * (-FIELD_WIDTH * 0.1); const fwdLineX = sideMultiplier * (FIELD_WIDTH * 0.25); const positions = [ { role: 'GK', x: gkX, y: 0 }, { role: 'DEF', x: defLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: -FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX + sideMultiplier * (-20), y: FIELD_HEIGHT * 0.1 }, { role: 'DEF', x: defLineX, y: FIELD_HEIGHT * 0.3 }, { role: 'MID', x: midLineX, y: -FIELD_HEIGHT * 0.2 }, { role: 'MID', x: midLineX + sideMultiplier * (20), y: 0 }, { role: 'MID', x: midLineX, y: FIELD_HEIGHT * 0.2 }, { role: 'FWD', x: fwdLineX, y: -FIELD_HEIGHT * 0.3 }, { role: 'FWD', x: fwdLineX + sideMultiplier * (30), y: 0 }, { role: 'FWD', x: fwdLineX, y: FIELD_HEIGHT * 0.3 } ]; return positions.map(p => ({ ...p, x: xOffset + p.x, y: yOffset + p.y })); };

function setupTeams(teamDataA, teamDataB) {
    logDebug(`Setting up match: ${teamDataA?.name || '?'} vs ${teamDataB?.name || '?'}`);
    if (!teamDataA || !teamDataB) {
        console.error("Cannot setup teams, invalid team data provided.");
        return false; // Indicate failure
    }
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
    return true; // Indicate success
}

// THIS IS THE FUNCTION ENDING JUST BEFORE resetStats() - ensure correct braces and no stray chars
function resetPositions(kickingTeamId = null) {
    logDebug("Resetting positions...");
    ball.x = FIELD_WIDTH / 2; ball.y = FIELD_HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.ownerId = null;
    players.forEach(p => {
        p.vx = 0; p.vy = 0;
        p.hasBall = false;
        p.state = 'IDLE';
        p.targetX = p.baseX; p.targetY = p.baseY;
        // Offset slightly for kickoff
        if (kickingTeamId) {
            // Move players towards their own half side relative to center line
            if (p.team === kickingTeamId) { // Kicking team slightly behind center
                 if (p.team === 'A') p.x = Math.min(p.baseX, FIELD_WIDTH / 2 - PLAYER_RADIUS * 2);
                 else p.x = Math.max(p.baseX, FIELD_WIDTH / 2 + PLAYER_RADIUS * 2);
                 p.y = p.baseY; // Keep Y position
                 // Ensure one player is near center to kick
                 if (p.role === 'FWD' || p.role === 'MID') { // Find a likely kicker
                    // Logic to select kicker can be more specific if needed
                 }
            } else { // Non-kicking team behind their side of center
                if (p.team === 'A') p.x = Math.min(p.baseX, FIELD_WIDTH / 2 - PLAYER_RADIUS * 2);
                else p.x = Math.max(p.baseX, FIELD_WIDTH / 2 + PLAYER_RADIUS * 2);
                p.y = p.baseY;
            }
             // Clamp positions to stay within field bounds after adjustment
             p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, p.x));
             p.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, p.y));

        } else { // Normal reset (half start)
             p.x = p.baseX;
             p.y = p.baseY;
        }
    });
} // <<< MAKE SURE THIS CLOSING BRACE IS PRESENT AND NOTHING IS BETWEEN HERE...

// ...AND HERE VVV
function resetStats() { // <<< THIS WAS THE LINE CAUSING THE SyntaxError IF THE ABOVE BRACE WAS MISSING
    stats = { teamA: { shots: 0, passes: 0, goals: 0 }, teamB: { shots: 0, passes: 0, goals: 0 } };
}

function getPlayerById(playerId) { return players.find(p => p.id === playerId); }

// --- Simulation Logic ---
function updatePlayerAI(player) {
    // Basic check to prevent errors if simulation runs before players are ready
    if (!player || !ball) return;

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

    // GK LOGIC
    if (player.role === 'GK') {
        let targetX = player.baseX;
        let targetY = player.baseY;
        const threatDistSq = (FIELD_WIDTH * 0.3)**2;
        if (isOpponentControlling && distSq(playerOwner.x, playerOwner.y, ownGoalX, goalY) < threatDistSq) {
            targetY = FIELD_HEIGHT / 2 + (ball.y - FIELD_HEIGHT / 2) * 0.5;
             targetX = player.baseX + (player.team === 'A' ? -10 : 10);
        } else if (distSq(ball.x, ball.y, player.baseX, player.baseY) < (FIELD_WIDTH*0.2)**2 && !playerOwner) {
             targetX = ball.x;
             targetY = ball.y;
        } else {
             targetY = player.baseY + (ball.y - player.baseY) * 0.1;
             targetX = player.baseX;
        }
        const penaltyAreaWidth = 165; // Actual width
        const gkMinX = ownGoalX === 0 ? 0 : FIELD_WIDTH - penaltyAreaWidth;
        const gkMaxX = ownGoalX === 0 ? penaltyAreaWidth : FIELD_WIDTH;
        targetX = Math.max(gkMinX, Math.min(gkMaxX, targetX));
        targetY = Math.max(FIELD_HEIGHT*0.2, Math.min(FIELD_HEIGHT*0.8, targetY));

        player.targetX = targetX;
        player.targetY = targetY;
        movePlayerTowardsTarget(player, PLAYER_SPEED * 0.8); // GK maybe slightly slower

        if (!playerOwner && playerDistToBallSq < controlRangeSq && player.kickCooldown <= 0) {
            gainPossession(player);
            shootBall(player, player.team === 'A' ? FIELD_WIDTH * 0.7 : FIELD_WIDTH * 0.3, goalY + (Math.random()-0.5)*FIELD_HEIGHT*0.5, SHOT_POWER * 0.7);
            player.kickCooldown = 30;
        }
        return; // End GK Logic
    }

    // OUTFIELD PLAYER LOGIC
    if (hasPossession) {
        ball.ownerId = player.id;
        player.state = 'DRIBBLING';
        const shootRangeSq = (FIELD_WIDTH * 0.35)**2;
        const distToGoalSq = distSq(player.x, player.y, goalX, goalY);

        if (distToGoalSq < shootRangeSq && player.kickCooldown <= 0 && Math.random() < 0.25) {
            player.state = 'SHOOTING';
            shootBall(player, goalX, goalY);
            stats[player.team === 'A' ? 'teamA' : 'teamB'].shots++;
            player.kickCooldown = 25;
            return;
        }

        let closestTeamMate = null;
        let minDistSq = Infinity;
        players.forEach(p => {
            if (p.team === player.team && p !== player) {
                const dSq = distSq(player.x, player.y, p.x, p.y);
                if (dSq < (FIELD_WIDTH * 0.4)**2 && dSq < minDistSq) {
                     minDistSq = dSq;
                     closestTeamMate = p;
                 }
            }
        });

        if (closestTeamMate && player.kickCooldown <= 0 && Math.random() < 0.1) {
             player.state = 'PASSING';
             passBall(player, closestTeamMate);
             stats[player.team === 'A' ? 'teamA' : 'teamB'].passes++;
             player.kickCooldown = 15;
             return;
        }

        player.state = 'DRIBBLING';
        player.targetX = player.x + (goalX - player.x) * 0.1;
        player.targetY = player.y + (goalY - player.y) * 0.1;
        if(Math.random() < 0.1) { player.targetY += (Math.random() - 0.5) * FIELD_HEIGHT * 0.2; }

        movePlayerTowardsTarget(player, PLAYER_SPEED * 0.9);
        const angleToTarget = Math.atan2(player.targetY - player.y, player.targetX - player.x);
        ball.x = player.x + Math.cos(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS);
        ball.y = player.y + Math.sin(angleToTarget) * (PLAYER_RADIUS + BALL_RADIUS);
        ball.vx = player.vx; ball.vy = player.vy;
        return;
    }

    const chaseDistanceSq = (FIELD_WIDTH * (player.role === 'FWD' ? 0.6 : (player.role === 'MID' ? 0.5 : 0.4)))**2;
    if ((!playerOwner || isOpponentControlling) && playerDistToBallSq < chaseDistanceSq && player.kickCooldown <= 0) {
        player.state = 'CHASING';
        player.targetX = ball.x;
        player.targetY = ball.y;
        movePlayerTowardsTarget(player);
        if (playerDistToBallSq < controlRangeSq) { gainPossession(player); }
        return;
    }

     if (isTeamMateControlling) {
         player.state = 'SUPPORTING';
         const supportDist = 100 + (Math.random() * 50);
         const angleToGoal = Math.atan2(goalY - playerOwner.y, goalX - playerOwner.x);
         let targetX = playerOwner.x + Math.cos(angleToGoal) * supportDist;
         let targetY = playerOwner.y + Math.sin(angleToGoal) * supportDist;
         if (player.role !== 'DEF' || Math.random() < 0.3) { targetY += (Math.random() < 0.5 ? -1 : 1) * 50; }
         player.targetX = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, targetX)); // Clamp target
         player.targetY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, targetY));
         movePlayerTowardsTarget(player);
         return;
     }

    player.state = 'RETURNING';
    player.targetX = player.baseX;
    player.targetY = player.baseY;
    if (player.role === 'DEF' || player.role === 'MID') { player.targetY += (ball.y - player.baseY) * 0.2; }
    movePlayerTowardsTarget(player);
}

function movePlayerTowardsTarget(player, speed = PLAYER_SPEED) {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > speed) {
        const angle = Math.atan2(dy, dx);
        player.vx = Math.cos(angle) * speed;
        player.vy = Math.sin(angle) * speed;
    } else if (dist > 1){
        player.vx = dx; player.vy = dy;
    } else {
        player.vx = 0; player.vy = 0;
    }
}

function updatePlayerPosition(player) {
    player.x += player.vx; player.y += player.vy;
    player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));

    // Simple player collision
    players.forEach(other => {
        if (player !== other) {
            const dSq = distSq(player.x, player.y, other.x, other.y);
            const minDist = PLAYER_RADIUS * 2;
            if (dSq < minDist * minDist && dSq > 0.01) {
                 const dist = Math.sqrt(dSq);
                 const overlap = minDist - dist;
                 const angle = Math.atan2(player.y - other.y, player.x - other.x);
                 const moveX = (Math.cos(angle) * overlap) / 2;
                 const moveY = (Math.sin(angle) * overlap) / 2;
                 player.x += moveX; player.y += moveY;
                 other.x -= moveX; other.y -= moveY;
                 player.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.x)); player.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.y));
                 other.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, other.x)); other.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, other.y));
            }
        }
    });
}

function passBall(passer, targetPlayer) {
    logDebug(`${passer.id} passing to ${targetPlayer.id}`);
    const dx = targetPlayer.x - passer.x; const dy = targetPlayer.y - passer.y;
    const dist = Math.sqrt(dx*dx+dy*dy); const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * 0.15;
    const finalAngle = angle + inaccuracyAngle;
    const power = Math.min(BALL_MAX_SPEED, dist * PASS_POWER_FACTOR + Math.random() * 2);
    ball.vx = Math.cos(finalAngle) * power; ball.vy = Math.sin(finalAngle) * power;
    ball.ownerId = null; passer.hasBall = false;
}

function shootBall(shooter, targetX, targetY, power = SHOT_POWER) {
    logDebug(`${shooter.id} shooting towards ${targetX}, ${targetY}`);
    const dx = targetX - shooter.x; const dy = targetY - shooter.y;
    const angle = Math.atan2(dy, dx);
    const inaccuracyAngle = (Math.random() - 0.5) * 0.08;
    const finalAngle = angle + inaccuracyAngle;
    ball.vx = Math.cos(finalAngle) * power; ball.vy = Math.sin(finalAngle) * power;
    ball.ownerId = null; shooter.hasBall = false;
}

function updateBallPhysics() {
    if (!ball) return; // Safety check

    if (ball.ownerId) {
        const owner = getPlayerById(ball.ownerId);
         if (owner && owner.state === 'DRIBBLING') {
              // Dribbling handles ball position update in updatePlayerAI
         } else if (owner) {
             // Ball sticks near owner if not actively dribbling (e.g., just gained possession)
             ball.x = owner.x + owner.vx; ball.y = owner.y + owner.vy;
             ball.vx = 0; ball.vy = 0;
         } else {
            // Owner might have disconnected or state is weird, make ball loose.
            ball.ownerId = null;
         }
    }

    // Apply physics if ball is loose
    if (!ball.ownerId) {
        ball.x += ball.vx; ball.y += ball.vy;
        ball.vx *= BALL_FRICTION; ball.vy *= BALL_FRICTION;
        if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
        if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

        // Wall collisions
        if (ball.y < BALL_RADIUS || ball.y > FIELD_HEIGHT - BALL_RADIUS) { ball.vy *= -0.6; ball.y = Math.max(BALL_RADIUS, Math.min(FIELD_HEIGHT - BALL_RADIUS, ball.y)); }

        const goalTopY = (FIELD_HEIGHT - GOAL_WIDTH) / 2; const goalBottomY = (FIELD_HEIGHT + GOAL_WIDTH) / 2;
        // Goal Check (Left Goal - B's Goal, A scores)
        if (ball.x < GOAL_DEPTH + BALL_RADIUS) {
             if (ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('A'); return; }
             else if (ball.x < BALL_RADIUS) { ball.vx *= -0.6; ball.x = BALL_RADIUS; } // Hit side wall/post
        }
        // Goal Check (Right Goal - A's Goal, B scores)
        if (ball.x > FIELD_WIDTH - GOAL_DEPTH - BALL_RADIUS) {
             if (ball.y > goalTopY && ball.y < goalBottomY) { handleGoal('B'); return; }
            else if (ball.x > FIELD_WIDTH - BALL_RADIUS) { ball.vx *= -0.6; ball.x = FIELD_WIDTH - BALL_RADIUS; } // Hit side wall/post
        }

        // Check for player collision to gain possession
        let closestPlayer = null;
        let minDistSq = CONTROL_RANGE ** 2;
        players.forEach(p => {
            if (p.kickCooldown <= 0) {
                const dSq = distSq(p.x, p.y, ball.x, ball.y);
                if (dSq < minDistSq) { minDistSq = dSq; closestPlayer = p; }
            }
        });
        if (closestPlayer) { gainPossession(closestPlayer); }
    }
}

function gainPossession(player) {
    if (ball.ownerId !== player.id) {
         logDebug(`${player.id} gained possession.`);
         const previousOwner = getPlayerById(ball.ownerId);
         if (previousOwner) previousOwner.hasBall = false;
         ball.ownerId = player.id;
         player.hasBall = true;
         ball.vx = 0; ball.vy = 0;
         player.state = 'IDLE'; // Or 'DRIBBLING' briefly?
    }
}

function handleGoal(scoringTeam) {
    logDebug(`GOAL by Team ${scoringTeam}! Score: A=${scoreA + (scoringTeam === 'A' ? 1:0)}, B=${scoreB + (scoringTeam === 'B' ? 1:0)}`);
    if (scoringTeam === 'A') { scoreA++; stats.teamA.goals++; }
    else { scoreB++; stats.teamB.goals++; }
    broadcast({ type: 'goalScored', payload: { scoringTeam, scoreA, scoreB } });
    const kickingTeam = scoringTeam === 'A' ? 'B' : 'A';
    resetPositions(kickingTeam); // Reset for kickoff
}

function updateGame() { // Server's main logic update loop
    if (gameState !== 'FIRST_HALF' && gameState !== 'SECOND_HALF') return;

    const startTime = Date.now();

    try {
        players.forEach(updatePlayerAI);
        players.forEach(updatePlayerPosition);
        updateBallPhysics();
    } catch (error) {
        console.error("Error during game update logic:", error);
        // Consider stopping the simulation or logging more details
        // For now, just log it and continue if possible
    }


    // Update game time
    const realTimeSinceLastUpdate = MILLISECONDS_PER_UPDATE; // Approximate
    const ingameSecondsIncrement = (realTimeSinceLastUpdate / 1000) * GAME_SPEED_FACTOR;
    serverGameTime += ingameSecondsIncrement;

    const maxHalfTime = 45 * 60;
    const maxFullTime = 90 * 60;

    // Check for half/full time based on accumulated game time
    if (gameState === 'FIRST_HALF' && serverGameTime >= maxHalfTime) {
        serverGameTime = maxHalfTime; // Cap time exactly
        handleHalfTime();
    } else if (gameState === 'SECOND_HALF' && serverGameTime >= maxFullTime) {
        serverGameTime = maxFullTime; // Cap time exactly
        handleFullTime();
    }

    const updateDuration = Date.now() - startTime;
    if (updateDuration > MILLISECONDS_PER_UPDATE * 1.5) { // Log if significantly over budget
        logDebug(`Warning: Game update took ${updateDuration}ms (budget ${MILLISECONDS_PER_UPDATE}ms)`);
    }
}

// --- Game Flow Control ---
function startMatch() {
    logDebug(`[State Transition] Starting Match: ${teamA?.name} vs ${teamB?.name}`);
    if (!teamA || !teamB || players.length !== 22) {
        console.error("Cannot start match, teams/players not set up correctly. Restarting sequence.");
        startInitialSequence(); // Attempt to recover
        return;
    }

    // Ensure timers/intervals from previous states are cleared
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    resetPositions('A'); // Team A kicks off first half
    resetStats();
    scoreA = 0; scoreB = 0;
    serverGameTime = 0;
    halfStartTimeStamp = Date.now();
    gameState = 'FIRST_HALF';

    broadcast({ type: 'matchStart', payload: { teamA, teamB, oddsA, oddsB } });
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for First Half.");
}

function handleHalfTime() {
    logDebug("[State Transition] Handling Half Time");
    if (gameState !== 'FIRST_HALF') { logDebug("Warning: Tried to handle halftime but not in first half state:", gameState); return; }

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    // Clear break timer just in case
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    gameState = 'HALF_TIME';
    serverGameTime = 45 * 60; // Ensure time is exactly 45:00
    breakEndTime = Date.now() + HALF_TIME_BREAK_MS;
    broadcast({ type: 'halfTime', payload: { scoreA, scoreB, breakEndTime } });

    breakTimerTimeout = setTimeout(startSecondHalf, HALF_TIME_BREAK_MS);
    logDebug(`Halftime break. Second half starts at ${new Date(breakEndTime).toLocaleTimeString()}`);
}

function startSecondHalf() {
    logDebug("[State Transition] Starting Second Half");
    if (gameState !== 'HALF_TIME') { logDebug("Warning: Tried to start second half but not in halftime state:", gameState); return; }

    // Ensure timers/intervals are clear
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    resetPositions('B'); // Team B kicks off second half
    // serverGameTime should already be 45*60
    halfStartTimeStamp = Date.now(); // Reset timer for measuring 2nd half duration
    gameState = 'SECOND_HALF';

    broadcast({ type: 'secondHalfStart' });
    gameLogicInterval = setInterval(updateGame, MILLISECONDS_PER_UPDATE);
    logDebug("Game logic interval started for Second Half.");
}

function handleFullTime() {
    logDebug("[State Transition] Handling Full Time");
    if (gameState !== 'SECOND_HALF') { logDebug("Warning: Tried to handle fulltime but not in second half state:", gameState); return; }

    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    gameState = 'FULL_TIME';
    serverGameTime = 90 * 60; // Ensure time is exactly 90:00
    breakEndTime = Date.now() + BETWEEN_MATCH_BREAK_MS;
    broadcast({ type: 'fullTime', payload: { scoreA, scoreB, breakEndTime } });

    resolveAllBets(); // Resolve bets immediately after broadcasting final score

    breakTimerTimeout = setTimeout(setupNextMatch, BETWEEN_MATCH_BREAK_MS);
    logDebug(`Full Time. Next match setup scheduled for ${new Date(breakEndTime).toLocaleTimeString()}`);
}

function setupNextMatch() {
    logDebug("[State Transition] Setting up Next Match");

    // Ensure timers/intervals are clear
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;

    if (availableTeams.length < 2) {
        logDebug("Team pool empty, resetting and shuffling.");
        availableTeams = [...nationalTeams];
        shuffleArray(availableTeams);
    }
    const nextTeamA = availableTeams.pop();
    const nextTeamB = availableTeams.pop();

    if (!nextTeamA || !nextTeamB) {
        console.error("Failed to get next teams! Restarting initial sequence.");
        startInitialSequence(); // Try to recover
        return;
    }

    if (!setupTeams(nextTeamA, nextTeamB)) { // Check if setup succeeded
         console.error("Failed to setup teams! Restarting initial sequence.");
         startInitialSequence(); // Try to recover
         return;
    }

    gameState = 'PRE_MATCH';
    broadcast({ // Broadcast the state *before* starting the match delay
         type: 'currentGameState',
         payload: createFullGameStatePayload()
     });

    // Short delay before starting match simulation
    breakTimerTimeout = setTimeout(() => {
        if (gameState === 'PRE_MATCH') { // Ensure state hasn't changed unexpectedly
             startMatch();
        } else {
             logDebug(`Warning: Wanted to start match from PRE_MATCH, but state is now ${gameState}`);
        }
    }, 2000); // 2 second delay
    logDebug(`Next match setup complete (${teamA.name} vs ${teamB.name}). Starting in 2s.`);
}

function resolveAllBets() {
    logDebug("Resolving all bets...");
    const winningTeam = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null); // null for draw

    clients.forEach((clientData, ws) => {
        if (clientData.currentBet) {
            let payout = 0;
            let message = "";
            const bet = clientData.currentBet;
            // Use optional chaining for safety in case teams somehow become null briefly
            const betTeamName = bet.team === 'A' ? teamA?.name || 'Team A' : teamB?.name || 'Team B';
            const odds = bet.team === 'A' ? parseFloat(oddsA) : parseFloat(oddsB);

            if (isNaN(odds) || odds <= 0) {
                 console.error(`Invalid odds (${odds}) for bet resolution for ${clientData.nickname}. Refunding.`);
                 // Refund in case of bad odds data
                 clientData.balance += bet.amount;
                 payout = bet.amount;
                 message = `Error resolving bet due to invalid odds. Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                 logDebug(`Bet refunded (invalid odds) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`);

            } else if (bet.team === winningTeam) {
                payout = bet.amount * odds;
                clientData.balance += payout;
                message = `Bet on ${betTeamName} WON! +$${payout.toFixed(2)}.`;
                logDebug(`Bet won for ${clientData.nickname || clientData.id}: +$${payout.toFixed(2)}`);
            } else if (winningTeam === null) { // Draw refund
                clientData.balance += bet.amount;
                payout = bet.amount;
                message = `Match drawn! Bet on ${betTeamName} refunded ($${bet.amount.toFixed(2)}).`;
                logDebug(`Bet refunded (draw) for ${clientData.nickname || clientData.id}: +$${bet.amount.toFixed(2)}`);
            } else { // Bet lost
                payout = 0; // Lost amount was already deducted
                message = `Bet on ${betTeamName} LOST (-$${bet.amount.toFixed(2)}).`;
                 logDebug(`Bet lost for ${clientData.nickname || clientData.id}: -$${bet.amount.toFixed(2)}`);
            }

            sendToClient(ws, {
                type: 'betResult',
                payload: {
                    success: payout > 0 || winningTeam === null, // success=true for win or refund
                    message: message,
                    newBalance: clientData.balance
                 }
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

    // Ensure all timers/intervals are cleared before starting
    if (gameLogicInterval) clearInterval(gameLogicInterval); gameLogicInterval = null;
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout); breakTimerTimeout = null;
    logDebug("Cleared existing timers/intervals.");

    if (availableTeams.length < 2) {
         logDebug("Initial sequence: Resetting team pool.");
        availableTeams = [...nationalTeams];
        shuffleArray(availableTeams);
    }
    const firstTeamA = availableTeams.pop();
    const firstTeamB = availableTeams.pop();

    if (!firstTeamA || !firstTeamB) {
         console.error("Failed to get initial teams! Retrying in 5s...");
         breakTimerTimeout = setTimeout(startInitialSequence, 5000); // Retry after 5s
         return;
    }

    if (!setupTeams(firstTeamA, firstTeamB)) { // Check if setup succeeded
         console.error("Failed to setup initial teams! Retrying in 5s...");
         breakTimerTimeout = setTimeout(startInitialSequence, 5000); // Retry after 5s
         return;
    }

    gameState = 'INITIAL_BETTING';
    breakEndTime = Date.now() + INITIAL_BETTING_WAIT_MS;
    logDebug(`Initial betting period ends at ${new Date(breakEndTime).toLocaleTimeString()}`);

    broadcast({
        type: 'initialWait',
        payload: { teamA, teamB, oddsA, oddsB, breakEndTime }
    });

    breakTimerTimeout = setTimeout(() => {
         if(gameState === 'INITIAL_BETTING') {
            logDebug("Initial wait over. Proceeding to setup first match.");
            setupNextMatch(); // Transitions to PRE_MATCH -> startMatch
         } else {
            logDebug(`Warning: Initial wait timer finished, but game state was already ${gameState}. No action taken.`);
         }
    }, INITIAL_BETTING_WAIT_MS);
}

// --- WebSocket Connection Handling ---
wss.on('connection', (ws, req) => {
    const remoteAddress = req.socket.remoteAddress;
    const clientId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    logDebug(`Client connected: ${clientId} from ${remoteAddress}`);
    clients.set(ws, {
        id: clientId,
        nickname: null,
        balance: 100, // Starting balance
        currentBet: null
    });

    // Send the current, complete game state
    sendToClient(ws, {
        type: 'currentGameState',
        payload: createFullGameStatePayload()
    });

    ws.on('message', (message) => {
        let data;
        try {
            // Ignore non-text messages (like binary ping/pong)
            if (typeof message !== 'string' && !Buffer.isBuffer(message)) {
                 logDebug(`Received non-string/non-buffer message from ${clientId}, ignoring.`);
                 return;
            }
             // If it's a buffer, try decoding as UTF8 string
             const messageText = Buffer.isBuffer(message) ? message.toString('utf8') : message;

            data = JSON.parse(messageText);
            const clientData = clients.get(ws);
            if (!clientData) {
                logDebug(`Received message from stale/unknown client (ws instance not found). Terminating.`);
                 ws.terminate();
                return;
            }

            // logDebug(`Received from ${clientData.id} (${clientData.nickname || 'No Nick'}):`, data.type, data.payload);

            // Handle specific message types
            switch (data.type) {
                case 'setNickname':
                    const nick = data.payload?.trim();
                    if (nick && nick.length > 0 && nick.length <= 15) {
                         const oldNickname = clientData.nickname;
                         clientData.nickname = nick;
                         logDebug(`Client ${clientData.id} set nickname to ${nick}`);
                         sendToClient(ws, { type: 'welcome', payload: { nickname: nick, balance: clientData.balance, currentBet: clientData.currentBet } });
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
                        const chatMsg = data.payload.substring(0, 100).trim();
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
                        }
                    } else {
                         logDebug(`Invalid bet attempt from ${clientData.nickname}:`, betPayload);
                         sendToClient(ws, { type: 'betResult', payload: { success: false, message: 'Invalid bet amount or team.', newBalance: clientData.balance } });
                    }
                    break;

                // Example PONG handler if needed
                // case 'pong':
                //     logDebug(`Received pong from ${clientData.id}`);
                //     // Could update a lastSeen timestamp here
                //     break;

                default:
                    logDebug(`Unknown message type from ${clientData.id}: ${data.type}`);
            }

        } catch (error) {
            console.error(`Failed to process message or invalid JSON from ${clientId}: ${message}`, error);
            const clientData = clients.get(ws);
            if (clientData) {
                 sendToClient(ws, { type: 'systemMessage', payload: { message: 'Error processing your request.', isError: true } });
            }
        }
    });

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
    });

    ws.on('error', (error) => {
        const clientData = clients.get(ws);
        console.error(`WebSocket error for client ${clientData?.nickname || clientData?.id || 'UNKNOWN'}:`, error);
        if (clients.has(ws)) {
             logDebug(`Removing client ${clientData?.id || 'UNKNOWN'} due to error.`);
             clients.delete(ws);
        }
         // Attempt to close the connection forcefully
         try { ws.terminate(); } catch (e) { /* ignore */ }
    });
});

// --- Periodic State Broadcast ---
setInterval(() => {
    if (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF') {
        broadcast({
            type: 'gameStateUpdate',
            payload: {
                // gameState: gameState, // Only send if state changes, handled by events
                scoreA, scoreB,
                serverGameTime: calculateCurrentDisplayTime(),
                players: players || [], // Ensure arrays exist
                ball: ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0, ownerId: null },
                stats: stats // Send latest stats
            }
        });
    }
}, 200); // Broadcast state 5 times per second

// Helper to create the full state payload sent on initial connection or major changes
function createFullGameStatePayload() {
    return {
        gameState,
        scoreA, scoreB,
        teamA, teamB,
        oddsA, oddsB,
        serverGameTime: calculateCurrentDisplayTime(),
        players: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (players || []) : [],
        ball: (gameState === 'FIRST_HALF' || gameState === 'SECOND_HALF' || gameState === 'PRE_MATCH') ? (ball || { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null }) : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx:0, vy:0, ownerId: null },
        breakEndTime: (gameState === 'INITIAL_BETTING' || gameState === 'HALF_TIME' || gameState === 'FULL_TIME') ? breakEndTime : null,
        stats: stats // Include current stats
    };
}

// Helper to calculate display time based on server state
function calculateCurrentDisplayTime() {
    if (gameState === 'FIRST_HALF') { return Math.min(45 * 60, serverGameTime); }
    else if (gameState === 'SECOND_HALF') { return Math.min(90 * 60, serverGameTime); }
    else if (gameState === 'HALF_TIME') { return 45 * 60; }
    else if (gameState === 'FULL_TIME' || gameState === 'BETWEEN_GAMES' || gameState === 'PRE_MATCH') { return 90 * 60; }
    else { return 0; } // INITIALIZING, INITIAL_BETTING
}

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server listening on port ${PORT}`);
    startInitialSequence(); // Start the game sequence
});

// Graceful Shutdown Handling
function gracefulShutdown(signal) {
    console.log(`${signal} received: closing server...`);
    if (gameLogicInterval) clearInterval(gameLogicInterval);
    if (breakTimerTimeout) clearTimeout(breakTimerTimeout);

    server.close(() => {
        console.log('HTTP server closed.');
        wss.close(() => {
            console.log('WebSocket server closed.');
            process.exit(0); // Exit cleanly
        });
         // Force close remaining websockets after a delay
         setTimeout(() => {
             console.log("Forcing remaining WebSocket connections closed.");
             wss.clients.forEach(ws => ws.terminate());
         }, 2000);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error("Graceful shutdown timeout exceeded. Forcing exit.");
        process.exit(1);
    }, 10000); // 10 second timeout
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Handle Ctrl+C locally

console.log("Server script finished initial execution. Waiting for connections...");
