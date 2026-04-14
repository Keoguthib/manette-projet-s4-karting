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
            
            // On récupère la couleur choisie dans le menu
            const selectedSkin = document.getElementById('skin-select').value;
            
            if (enteredName !== "") {
                playerName = enteredName;
                console.log("Pseudo :", playerName, "| Skin :", selectedSkin);
                
                loginScreen.style.display = 'none';
                controller.style.display = 'flex';
                
                // Le téléphone va envoyer ce JSON à Godot :
                // {"joueur": "TonPseudo", "type": "join", "value": "rouge"}
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
    console.log("📡 Tentative WebSocket sur :", wsUrl);
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("✅ Connecté au serveur Render");
    };

    socket.onclose = (e) => {
        console.log("❌ Fermé", e.code);
        setTimeout(initRemote, 2000); 
    };

    socket.onerror = (err) => {
        console.error("❌ Erreur de connexion");
    };
}

// --- ENVOI DES DONNÉES (AVEC LE PSEUDO INCLUS !) ---
function sendData(type, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const data = JSON.stringify({ 
            joueur: playerName, // Maintenant Godot saura qui conduit !
            type: type, 
            value: value 
        });
        socket.send(data);
    }
}

initRemote();

// --- VOLANT (AVEC MULTI-TOUCH) ---
const volant = document.getElementById('volant');
let isDragging = false;
let accumulatedAngle = 0;
let lastAngle = 0;
let steeringTouchId = null; // Mémorise QUEL doigt tient le volant

function getAngle(touch) {
    const rect = volant.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(touch.clientY - cy, touch.clientX - cx) * (180 / Math.PI);
}

const start = (e) => {
    if (isDragging) return; // Si on tourne déjà, on ignore
    e.preventDefault(); 
    
    // On repère quel doigt vient de toucher le volant
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
    // Si c'est sur téléphone, on cherche LE bon doigt parmi tous ceux sur l'écran
    if (e.changedTouches) {
        let foundTouch = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === steeringTouchId) {
                foundTouch = e.changedTouches[i];
                break;
            }
        }
        if (!foundTouch) return; // Le doigt du volant n'a pas bougé
        touch = foundTouch;
    }
    
    let current = getAngle(touch);
    let delta = current - lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    accumulatedAngle += delta;
    
    // --- NOUVEAU : On bloque le volant entre -180 et 180 degrés ---
    if (accumulatedAngle > 180) accumulatedAngle = 180;
    if (accumulatedAngle < -180) accumulatedAngle = -180;
    
    lastAngle = current;
    
    volant.style.transform = `rotate(${accumulatedAngle}deg)`;
    
    // --- NOUVEAU : On divise par 180 (au lieu de 360) pour envoyer 1 ou -1 à Godot ---
    sendData('steering_axis', accumulatedAngle / 180);
};

const stop = (e) => {
    if (!isDragging) return;
    
    // On vérifie si c'est bien le doigt du volant qui s'est levé
    if (e.changedTouches) {
        let isSteeringFinger = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === steeringTouchId) {
                isSteeringFinger = true;
                break;
            }
        }
        if (!isSteeringFinger) return; // Un autre doigt (ex: pédale) s'est levé, on annule !
    }
    
    isDragging = false;
    steeringTouchId = null;
    accumulatedAngle = 0;
    volant.style.transition = 'transform 0.4s';
    volant.style.transform = 'rotate(0deg)';
    sendData('steering_axis', 0);
};

volant.addEventListener('touchstart', start, {passive: false});
window.addEventListener('touchmove', move, {passive: false});
window.addEventListener('touchend', stop);
volant.addEventListener('mousedown', start);
window.addEventListener('mousemove', move);
window.addEventListener('mouseup', stop);

// --- PÉDALES (ISOLÉES) ---
const setup = (id, type) => {
    const b = document.getElementById(id);
    if (!b) return;
    const on = (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); // Empêche ce toucher de perturber le volant
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