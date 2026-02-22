const screens = {
  start: document.getElementById('start-screen'),
  game: document.getElementById('game-screen'),
  over: document.getElementById('game-over-screen')
};

const ui = {
  coins: document.getElementById('coins'),
  score: document.getElementById('score'),
  combo: document.getElementById('combo'),
  comboWrapper: document.getElementById('combo-wrapper'),
  lives: document.getElementById('lives'),
  lane: document.getElementById('customer-lane'),
  tray: document.getElementById('tray-dropzone'),
  trayPreview: document.getElementById('tray-preview'),
  finalScore: document.getElementById('final-score'),
  bestScore: document.getElementById('best-score'),
  soundToggle: document.getElementById('sound-toggle')
};

const orders = ['Coffee', 'Peach ice tea', 'Croissant', 'Boba', 'Latte'];
const avatars = ['🧑‍🍳', '🧑‍💼', '🧑‍🎨', '🧑‍🏫', '🧑‍🚴'];

const gameState = {
  running: false,
  score: 0,
  coins: 0,
  lives: 3,
  combo: 1,
  comboCount: 0,
  customers: [],
  spawnTimer: 0,
  spawnInterval: 4.5,
  difficultyTimer: 0,
  patienceScale: 1,
  lastServeTime: 0,
  soundOn: true,
  loopId: 0,
  lastTimestamp: 0
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/** Switch visible view with smooth CSS transitions. */
function switchScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function resetGame() {
  gameState.score = 0;
  gameState.coins = 0;
  gameState.lives = 3;
  gameState.combo = 1;
  gameState.comboCount = 0;
  gameState.customers = [];
  gameState.spawnTimer = 0;
  gameState.spawnInterval = 4.5;
  gameState.difficultyTimer = 0;
  gameState.patienceScale = 1;
  gameState.lastServeTime = 0;
  renderHUD();
  renderCustomers();
  ui.trayPreview.textContent = 'Ready to serve ✨';
}

/** Spawns up to two customers with order and personality variation. */
function spawnCustomer() {
  if (gameState.customers.length >= 2) return;

  const personality = Math.random() < 0.35 ? 'impatient' : 'normal';
  const customer = {
    id: crypto.randomUUID(),
    avatar: avatars[Math.floor(Math.random() * avatars.length)],
    order: orders[Math.floor(Math.random() * orders.length)],
    personality,
    patience: 100,
    baseDrain: personality === 'impatient' ? 16 : 10
  };

  gameState.customers.push(customer);
  renderCustomers();
}

/** Updates each customer's patience, handling misses and life loss. */
function updatePatience(dt) {
  const removed = [];

  gameState.customers.forEach((customer) => {
    customer.patience -= customer.baseDrain * gameState.patienceScale * dt;
    if (customer.patience <= 0) removed.push(customer.id);
  });

  if (removed.length) {
    removed.forEach((id) => {
      gameState.customers = gameState.customers.filter((customer) => customer.id !== id);
      gameState.lives -= 1;
      gameState.combo = 1;
      gameState.comboCount = 0;
      playTone(180, 0.2, 'sawtooth');
      ui.lane.classList.add('shake');
      setTimeout(() => ui.lane.classList.remove('shake'), 260);
    });
    renderHUD();
    renderCustomers();
    if (gameState.lives <= 0) endGame();
  }
}

/** Handles tray drop and serving verification for the first queued customer. */
function handleDrop(itemName) {
  const targetCustomer = gameState.customers[0];
  if (!targetCustomer || !gameState.running) return;

  ui.trayPreview.textContent = `Serving: ${itemName}`;

  if (targetCustomer.order === itemName) {
    const now = performance.now();
    if (now - gameState.lastServeTime <= 3000) {
      gameState.comboCount += 1;
      gameState.combo = Math.min(6, 1 + Math.floor(gameState.comboCount / 2));
    } else {
      gameState.comboCount = 0;
      gameState.combo = 1;
    }
    gameState.lastServeTime = now;
    updateScore(15, 8);

    const servedElement = document.querySelector(`[data-customer-id="${targetCustomer.id}"]`);
    if (servedElement) {
      const hearts = document.createElement('div');
      hearts.className = 'hearts';
      hearts.textContent = '💖';
      servedElement.appendChild(hearts);
    }

    gameState.customers.shift();
    ui.comboWrapper.classList.add('glow');
    setTimeout(() => ui.comboWrapper.classList.remove('glow'), 500);
    playTone(620, 0.08, 'triangle');
    playTone(860, 0.07, 'sine', 0.05);
  } else {
    gameState.combo = 1;
    gameState.comboCount = 0;
    ui.tray.classList.add('shake');
    setTimeout(() => ui.tray.classList.remove('shake'), 300);
    playTone(240, 0.12, 'square');
  }

  renderHUD();
  renderCustomers();
}

/** Updates score and coins with combo multipliers. */
function updateScore(baseScore, baseCoins) {
  const multiplier = gameState.combo;
  gameState.score += baseScore * multiplier;
  gameState.coins += baseCoins + Math.max(0, multiplier - 1) * 3;
}

function updateDifficulty(dt) {
  gameState.difficultyTimer += dt;
  if (gameState.difficultyTimer >= 12) {
    gameState.spawnInterval = Math.max(2.4, gameState.spawnInterval - 0.2);
    gameState.patienceScale = Math.min(2.7, gameState.patienceScale + 0.08);
    gameState.difficultyTimer = 0;
  }
}

function renderHUD() {
  ui.coins.textContent = gameState.coins;
  ui.score.textContent = gameState.score;
  ui.combo.textContent = `x${gameState.combo}`;
  ui.lives.textContent = '❤️ '.repeat(gameState.lives).trim() || '—';
}

function renderCustomers() {
  ui.lane.innerHTML = '';

  const slots = 2;
  for (let i = 0; i < slots; i += 1) {
    const slot = document.createElement('article');
    slot.className = 'customer-slot';

    const customer = gameState.customers[i];
    if (customer) {
      slot.innerHTML = `
        <div class="customer-card" data-customer-id="${customer.id}">
          <div class="customer-top">
            <span class="avatar">${customer.avatar}</span>
            <span class="mood">${customer.personality}</span>
          </div>
          <p><strong>Order:</strong> ${customer.order}</p>
          <p class="steam">~ hot + fresh ~</p>
          <div class="patience-track">
            <div class="patience-bar" style="width: ${Math.max(0, customer.patience)}%"></div>
          </div>
        </div>
      `;
    } else {
      slot.innerHTML = '<div class="customer-card">Waiting for next customer…</div>';
    }

    ui.lane.appendChild(slot);
  }
}

/** Ends active run, stores best score, and displays game-over view. */
function endGame() {
  gameState.running = false;
  cancelAnimationFrame(gameState.loopId);
  const best = Number(localStorage.getItem('ddej4uvesBestScore') || 0);
  const nextBest = Math.max(best, gameState.score);
  localStorage.setItem('ddej4uvesBestScore', String(nextBest));

  ui.finalScore.textContent = String(gameState.score);
  ui.bestScore.textContent = String(nextBest);
  switchScreen('over');
}

function gameLoop(timestamp) {
  if (!gameState.running) return;
  const dt = Math.min(0.05, (timestamp - gameState.lastTimestamp) / 1000 || 0.016);
  gameState.lastTimestamp = timestamp;

  gameState.spawnTimer += dt;
  if (gameState.spawnTimer >= gameState.spawnInterval) {
    spawnCustomer();
    gameState.spawnTimer = 0;
  }

  updatePatience(dt);
  updateDifficulty(dt);

  gameState.loopId = requestAnimationFrame(gameLoop);
}

function playTone(freq, duration, type, delay = 0) {
  if (!gameState.soundOn) return;
  const now = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.0001;
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function initDragDrop() {
  const ingredients = document.querySelectorAll('.ingredient');

  ingredients.forEach((button) => {
    button.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', button.dataset.item);
    });

    button.addEventListener('click', () => handleDrop(button.dataset.item));
  });

  ui.tray.addEventListener('dragover', (event) => {
    event.preventDefault();
    ui.tray.classList.add('drag-over');
  });

  ui.tray.addEventListener('dragleave', () => ui.tray.classList.remove('drag-over'));

  ui.tray.addEventListener('drop', (event) => {
    event.preventDefault();
    ui.tray.classList.remove('drag-over');
    const itemName = event.dataTransfer.getData('text/plain');
    handleDrop(itemName);
  });
}

function startGame() {
  audioCtx.resume();
  resetGame();
  switchScreen('game');
  gameState.running = true;
  gameState.lastTimestamp = performance.now();
  spawnCustomer();
  gameState.loopId = requestAnimationFrame(gameLoop);
}

function boot() {
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);

  ui.soundToggle.addEventListener('click', () => {
    gameState.soundOn = !gameState.soundOn;
    ui.soundToggle.textContent = gameState.soundOn ? '🔊 Sound: On' : '🔈 Sound: Off';
    ui.soundToggle.setAttribute('aria-pressed', String(gameState.soundOn));
  });

  ui.bestScore.textContent = localStorage.getItem('ddej4uvesBestScore') || '0';
  initDragDrop();
  renderHUD();
  renderCustomers();
}

boot();
