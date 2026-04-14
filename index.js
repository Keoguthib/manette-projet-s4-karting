const SETTINGS = {
    maxDistance: 60, // Rayon max du joystick en pixels
    sensitivity: 1.2  // Courbe de réponse
};

let socket = null;
let playerName = "";

// --- GESTION CONNEXION ---
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const controller = document.getElementById('controller');
    const pseudoInput = document.getElementById('pseudo-input');
    const btnJoin = document.getElementById('btn-join');

    btnJoin.addEventListener('click', () => {
        const enteredName = pseudoInput.value.trim();
        const selectedSkin = document.getElementById('skin-select').value;
        
        if (enteredName !== "") {
            playerName = enteredName;
            loginScreen.style.display = 'none';
            controller.style.display = 'flex';
            sendData('join', selectedSkin); 
        } else {
            alert("Saisis un pseudo !");
        }
    });
    
    setupPedals();
    initJoystick();
});

function initRemote() {
    socket = new WebSocket('wss://serveur-projet-s4-karting.onrender.com');
    socket.onclose = () => setTimeout(initRemote, 2000);
}
initRemote();

function sendData(type, value) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ joueur: playerName, type: type, value: value }));
    }
}

// --- 🕹️ LOGIQUE DU JOYSTICK ---
function initJoystick() {
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');

    let activeTouchId = null;

    const getTouchById = (touches, id) => {
        for (let t of touches) {
            if (t.identifier === id) return t;
        }
        return null;
    };

    const moveJoystick = (e) => {
        if (activeTouchId === null) return;

        const touch = getTouchById(e.touches, activeTouchId);
        if (!touch) return;

        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;

        let deltaX = touch.clientX - centerX;

        deltaX = Math.max(-SETTINGS.maxDistance, Math.min(SETTINGS.maxDistance, deltaX));

        stick.style.transform = `translate(calc(-50% + ${deltaX}px), -50%)`;

        let normalized = deltaX / SETTINGS.maxDistance;
        let finalValue = Math.sign(normalized) * Math.pow(Math.abs(normalized), SETTINGS.sensitivity);

        sendData('steering_axis', finalValue);
    };

    const stopJoystick = (e) => {
        const touch = [...e.changedTouches].find(t => t.identifier === activeTouchId);
        if (!touch) return;

        activeTouchId = null;

        stick.style.transition = '0.2s ease-out';
        stick.style.transform = `translate(-50%, -50%)`;
        sendData('steering_axis', 0);
    };

    const startJoystick = (e) => {
        const touch = e.changedTouches[0];

        // IMPORTANT : ne prendre que si le touch commence dans le joystick
        const rect = base.getBoundingClientRect();
        if (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
        ) {
            activeTouchId = touch.identifier;
            stick.style.transition = 'none';
            moveJoystick(e);
        }
    };

    base.addEventListener('touchstart', startJoystick, { passive: false });
    window.addEventListener('touchmove', moveJoystick, { passive: false });
    window.addEventListener('touchend', stopJoystick);

    // souris (inchangé)
    let isMouseDown = false;

    base.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        stick.style.transition = 'none';
        moveJoystick(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;

        let deltaX = e.clientX - centerX;
        deltaX = Math.max(-SETTINGS.maxDistance, Math.min(SETTINGS.maxDistance, deltaX));

        stick.style.transform = `translate(calc(-50% + ${deltaX}px), -50%)`;

        let normalized = deltaX / SETTINGS.maxDistance;
        let finalValue = Math.sign(normalized) * Math.pow(Math.abs(normalized), SETTINGS.sensitivity);

        sendData('steering_axis', finalValue);
    });

    window.addEventListener('mouseup', () => {
        isMouseDown = false;
        stick.style.transition = '0.2s ease-out';
        stick.style.transform = `translate(-50%, -50%)`;
        sendData('steering_axis', 0);
    });
}

// --- 🦶 PÉDALES ---
function setupPedals() {
    const setup = (id, type) => {
        const b = document.getElementById(id);
        const on = (e) => { e.preventDefault(); b.classList.add('pressed'); sendData(type, "pressed"); };
        const off = (e) => { e.preventDefault(); b.classList.remove('pressed'); sendData(type, "released"); };
        
        b.addEventListener('touchstart', on);
        b.addEventListener('touchend', off);
        b.addEventListener('mousedown', on);
        b.addEventListener('mouseup', off);
    };
    setup('accelerator', 'accelerate');
    setup('brake', 'brake');
}
