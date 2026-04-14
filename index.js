// ===============================
// ⚙️ RÉGLAGES DU VOLANT
// ===============================
const SETTINGS = {
    sensitivity: 1.5,   // 1 = normal | >1 = plus doux au centre | <1 = plus direct
    maxAngle: 120,      // angle max du volant (90 à 180 recommandé)
    returnSpeed: 0.4    // vitesse de retour au centre (en secondes)
};

// ===============================
let socket = null;
let playerName = "";

// --- GESTION DE L'ÉCRAN DE CONNEXION ---
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const controller = document.getElementById('controller');
    const pseudoInput = document.getElementById('pseudo-input');
    const btnJoin = document.getElementById('btn-join');

    if (btnJoin) {
        btnJoin.addEventListener('click', () => {
            const enteredName = pseudoInput.value.trim();
            const skinSelect = document.getElementById('skin-select');
            const selectedSkin = skinSelect ? skinSelect.value : "Rouge";
            
            if (enteredName !== "") {
                playerName = enteredName;
                
                loginScreen.style.display = 'none';
                controller.style.display = 'flex';
                
                sendData('join', selectedSkin); 
            } else {
                alert("Saisis un pseudo pour jouer !");
            }
        });
    }
});

// --- CONNEXION WEBSOCKET ---
async function initRemote() {
    const wsUrl = 'wss://serveur-projet-s4-karting.onrender.com';
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("✅ Connecté au serveur");
    };

    socket.onclose = () => {
        setTimeout(initRemote, 2000); 
    };

    socket.onerror = () => {
        console.error("❌ Erreur de connexion");
    };
}

// --- ENVOI DES DONNÉES ---
function sendData(type, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
            joueur: playerName,
            type: type, 
            value: value 
        }));
    }
}

initRemote();

// ===============================
// 🎮 VOLANT (AMÉLIORÉ)
// ===============================
const volant = document.getElementById('volant');
let isDragging = false;
let accumulatedAngle = 0;
let lastAngle = 0;
let steeringTouchId = null; 

function getAngle(touch) {
    const rect = volant.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(touch.clientY - cy, touch.clientX - cx) * (180 / Math.PI);
}

const start = (e) => {
    if (isDragging) return; 
    e.preventDefault(); 
    
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    steeringTouchId = e.changedTouches ? touch.identifier : 'mouse';
    
    isDragging = true;
    volant.style.transition = 'none';
    lastAngle = getAngle(touch);
};

const move = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    let touch = e;
    if (e.changedTouches) {
        let found = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === steeringTouchId) {
                found = e.changedTouches[i];
                break;
            }
        }
        if (!found) return;
        touch = found;
    }
    
    let current = getAngle(touch);
    let delta = current - lastAngle;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    accumulatedAngle += delta;

    // ✅ Limitation angle
    if (accumulatedAngle > SETTINGS.maxAngle) accumulatedAngle = SETTINGS.maxAngle;
    if (accumulatedAngle < -SETTINGS.maxAngle) accumulatedAngle = -SETTINGS.maxAngle;

    lastAngle = current;

    volant.style.transform = `rotate(${accumulatedAngle}deg)`;

    // ✅ Normalisation + courbe de sensibilité
    let normalized = accumulatedAngle / SETTINGS.maxAngle;
    normalized = Math.sign(normalized) * Math.pow(Math.abs(normalized), SETTINGS.sensitivity);

    sendData('steering_axis', normalized);
};

const stop = (e) => {
    if (!isDragging) return;

    if (e.changedTouches) {
        let found = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === steeringTouchId) {
                found = true;
                break;
            }
        }
        if (!found) return;
    }

    isDragging = false;
    steeringTouchId = null;
    accumulatedAngle = 0;

    volant.style.transition = `transform ${SETTINGS.returnSpeed}s`;
    volant.style.transform = 'rotate(0deg)';

    sendData('steering_axis', 0);
};

volant.addEventListener('touchstart', start, {passive: false});
window.addEventListener('touchmove', move, {passive: false});
window.addEventListener('touchend', stop);
volant.addEventListener('mousedown', start);
window.addEventListener('mousemove', move);
window.addEventListener('mouseup', stop);

// ===============================
// 🦶 PÉDALES
// ===============================
const setup = (id, type) => {
    const b = document.getElementById(id);
    if (!b) return;

    const on = (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        b.classList.add('pressed'); 
        sendData(type, "pressed"); 
    };

    const off = (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        b.classList.remove('pressed'); 
        sendData(type, "released"); 
    };

    b.addEventListener('touchstart', on, {passive: false});
    b.addEventListener('touchend', off);
    b.addEventListener('mousedown', on);
    b.addEventListener('mouseup', off);
};

document.addEventListener('DOMContentLoaded', () => {
    setup('accelerator', 'accelerate');
    setup('brake', 'brake');
});
