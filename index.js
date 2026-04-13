let socket = null;
let playerName = "";

// Gestion de l'écran de connexion
const loginScreen = document.getElementById('login-screen');
const controller = document.getElementById('controller');
const pseudoInput = document.getElementById('pseudo-input');
const btnJoin = document.getElementById('btn-join');

btnJoin.addEventListener('click', () => {
    const enteredName = pseudoInput.value.trim();
    
    if (enteredName !== "") {
        playerName = enteredName;
        
        // On cache l'écran de connexion et on affiche la manette
        loginScreen.style.display = 'none';
        controller.style.display = 'flex';
        
        // On demande à passer en plein écran (si le téléphone l'autorise)
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
        }
        
        // On envoie le pseudo à Godot pour qu'il l'affiche dans le Lobby !
        sendData('join', playerName);
    } else {
        alert("Saisis un pseudo pour jouer !");
    }
});

async function initRemote() {
    // On se connecte directement à ton serveur Render en sécurisé (wss://)
    const wsUrl = 'wss://serveur-projet-s4-karting.onrender.com';
    console.log("📡 Tentative WebSocket sur :", wsUrl);
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        // Le petit pop-up pour confirmer au joueur sur son téléphone
        alert("Connecté au circuit !"); 
        console.log("✅ Connecté");
    };

    socket.onclose = (e) => {
        console.log("❌ Fermé", e.code);
        // Si ça coupe, le téléphone réessaie en boucle toutes les 2 secondes
        setTimeout(initRemote, 2000); 
    };

    socket.onerror = (err) => {
        console.error("❌ Erreur de connexion");
    };
}

function sendData(type, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const data = JSON.stringify({ type: type, value: value });
        socket.send(data);
    }
}

initRemote();

// --- VOLANT (TOURS COMPLETS) ---
const volant = document.getElementById('volant');
let isDragging = false;
let accumulatedAngle = 0;
let lastAngle = 0;

function getAngle(e) {
    const touch = e.touches ? e.touches[0] : e;
    const rect = volant.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(touch.clientY - cy, touch.clientX - cx) * (180 / Math.PI);
}

const start = (e) => {
    isDragging = true;
    volant.style.transition = 'none';
    lastAngle = getAngle(e);
};

const move = (e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    
    let current = getAngle(e);
    let delta = current - lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    accumulatedAngle += delta;
    lastAngle = current;
    
    volant.style.transform = `rotate(${accumulatedAngle}deg)`;
    sendData('steering_axis', Math.max(-1, Math.min(1, accumulatedAngle / 360)));
};

const stop = () => {
    if (!isDragging) return;
    isDragging = false;
    accumulatedAngle = 0;
    volant.style.transition = 'transform 0.4s';
    volant.style.transform = 'rotate(0deg)';
    sendData('steering_axis', 0);
};

volant.addEventListener('touchstart', start, {passive:false});
window.addEventListener('touchmove', move, {passive:false});
window.addEventListener('touchend', stop);
volant.addEventListener('mousedown', start);
window.addEventListener('mousemove', move);
window.addEventListener('mouseup', stop);

// --- PÉDALES ---
const setup = (id, type) => {
    const b = document.getElementById(id);
    if (!b) return;
    const on = (e) => { e.preventDefault(); b.classList.add('pressed'); sendData(type, "pressed"); };
    const off = (e) => { e.preventDefault(); b.classList.remove('pressed'); sendData(type, "released"); };
    b.addEventListener('touchstart', on, {passive:false});
    b.addEventListener('touchend', off);
    b.addEventListener('mousedown', on);
    b.addEventListener('mouseup', off);
};
setup('accelerator', 'accelerate');
setup('brake', 'brake');