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
            
            // On s'assure que le menu déroulant existe avant de lire sa valeur
            const selectedSkin = skinSelect ? skinSelect.value : "Rouge";
            
            if (enteredName !== "") {
                playerName = enteredName;
                console.log("Pseudo :", playerName, "| Skin :", selectedSkin);
                
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

// --- ENVOI DES DONNÉES ---
function sendData(type, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const data = JSON.stringify({ 
            joueur: playerName,
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
        let foundTouch = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === steeringTouchId) {
                foundTouch = e.changedTouches[i];
                break;
            }
        }
        if (!foundTouch) return; 
        touch = foundTouch;
    }
    
    let current = getAngle(touch);
    let delta = current - lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    accumulatedAngle += delta;
    
    if (accumulatedAngle > 180) accumulatedAngle = 180;
    if (accumulatedAngle < -180) accumulatedAngle = -180;
    
    lastAngle = current;
    
    volant.style.transform = `rotate(${accumulatedAngle}deg)`;
    sendData('steering_axis', accumulatedAngle / 180);
};

const stop = (e) => {
    if (!isDragging) return;
    
    if (e.changedTouches) {
        let isSteeringFinger = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === steeringTouchId) {
                isSteeringFinger = true;
                break;
            }
        }
        if (!isSteeringFinger) return; 
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