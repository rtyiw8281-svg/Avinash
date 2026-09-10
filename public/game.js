// Main Game Controller and UI Manager for Hill Climber

class GameManager {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Storage & Game State
        this.storage = {
            totalCoins: 200, // starting bonus for fun testing
            highScore: 0,
            levelRecords: {
                green_hills: 0,
                desert: 0,
                snow: 0,
                moon: 0
            },
            unlockedLevels: ['green_hills'],
            upgrades: {
                engine: 1,
                tires: 1,
                suspension: 1,
                fuel: 1
            },
            selectedLevel: 'green_hills'
        };

        this.loadStorage();

        // Subsystems
        this.currentEnv = new Environment(this.storage.selectedLevel);
        this.vehicle = new Vehicle(this.storage.upgrades);
        this.spawner = new ItemSpawner();
        this.renderer = new GameRenderer(this.canvas, this.ctx);
        this.particles = [];
        this.floatingTexts = [];

        // Input state
        this.input = {
            gas: false,
            brake: false
        };

        // State: 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER'
        this.state = 'MENU';
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.fixedStep = 1 / 60;

        // Upgrade costs per level: Lvl 1 is default, Lvl 2->5 costs
        this.upgradeCosts = [0, 150, 400, 900, 1800];

        this.initDOM();
        this.initEvents();
        this.resize();
        this.updateUI();

        // Start animation loop
        requestAnimationFrame((t) => this.loop(t));
    }

    loadStorage() {
        try {
            const data = localStorage.getItem('hillclimber_save');
            if (data) {
                const parsed = JSON.parse(data);
                this.storage = Object.assign(this.storage, parsed);
                // Ensure array contains default
                if (!this.storage.unlockedLevels.includes('green_hills')) {
                    this.storage.unlockedLevels.push('green_hills');
                }
            }
        } catch (e) {
            console.warn('Could not load localStorage', e);
        }
    }

    saveStorage() {
        try {
            localStorage.setItem('hillclimber_save', JSON.stringify(this.storage));
        } catch (e) {
            console.warn('Could not save localStorage', e);
        }
    }

    initDOM() {
        // UI Screens
        this.screenMenu = document.getElementById('screenMenu');
        this.screenHUD = document.getElementById('screenHUD');
        this.screenGarage = document.getElementById('modalGarage');
        this.screenLevels = document.getElementById('modalLevels');
        this.screenSettings = document.getElementById('modalSettings');
        this.screenPause = document.getElementById('modalPause');
        this.screenGameOver = document.getElementById('modalGameOver');

        // HUD Elements
        this.hudFuelFill = document.getElementById('hudFuelFill');
        this.hudFuelCard = document.getElementById('hudFuelCard');
        this.hudDistance = document.getElementById('hudDistance');
        this.hudBest = document.getElementById('hudBest');
        this.hudCoins = document.getElementById('hudCoins');
        this.menuCoins = document.getElementById('menuCoins');
        this.garageCoins = document.getElementById('garageCoins');

        // Pedals
        this.btnGas = document.getElementById('btnGas');
        this.btnBrake = document.getElementById('btnBrake');
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));

        // Prevent unwanted touch gestures on entire page
        document.body.addEventListener('touchmove', (e) => {
            if (e.target.closest('#gameCanvas') || e.target.closest('.pedal-btn')) {
                e.preventDefault();
            }
        }, { passive: false });

        // Touch controls for Gas & Brake
        const bindPedal = (btn, isGas) => {
            const onDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isGas) this.input.gas = true;
                else this.input.brake = true;
                btn.classList.add('pressed');
                if (window.soundManager) window.soundManager.resume();
            };
            const onUp = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isGas) this.input.gas = false;
                else this.input.brake = false;
                btn.classList.remove('pressed');
            };

            btn.addEventListener('touchstart', onDown, { passive: false });
            btn.addEventListener('touchend', onUp, { passive: false });
            btn.addEventListener('touchcancel', onUp, { passive: false });
            btn.addEventListener('mousedown', onDown);
            btn.addEventListener('mouseup', onUp);
            btn.addEventListener('mouseleave', onUp);
        };

        bindPedal(this.btnGas, true);
        bindPedal(this.btnBrake, false);

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                this.input.gas = true;
                this.btnGas.classList.add('pressed');
                if (window.soundManager) window.soundManager.resume();
            }
            if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Space') {
                this.input.brake = true;
                this.btnBrake.classList.add('pressed');
                if (window.soundManager) window.soundManager.resume();
            }
            if (e.code === 'KeyP' || e.code === 'Escape') {
                if (this.state === 'PLAYING') this.pauseGame();
                else if (this.state === 'PAUSED') this.resumeGame();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                this.input.gas = false;
                this.btnGas.classList.remove('pressed');
            }
            if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Space') {
                this.input.brake = false;
                this.btnBrake.classList.remove('pressed');
            }
        });

        // Menu Buttons
        document.getElementById('btnPlay').onclick = () => this.startGame();
        document.getElementById('btnGarage').onclick = () => this.openGarage();
        document.getElementById('btnLevels').onclick = () => this.openLevels();
        document.getElementById('btnSettings').onclick = () => this.openSettings();

        // HUD Pause
        document.getElementById('btnPause').onclick = () => this.pauseGame();

        // Pause Modal
        document.getElementById('btnResume').onclick = () => this.resumeGame();
        document.getElementById('btnPauseRestart').onclick = () => this.restartGame();
        document.getElementById('btnPauseGarage').onclick = () => {
            this.screenPause.classList.add('hidden');
            this.openGarage();
        };
        document.getElementById('btnPauseMenu').onclick = () => this.goToMenu();

        // Game Over Modal
        document.getElementById('btnGameOverRetry').onclick = () => this.restartGame();
        document.getElementById('btnGameOverGarage').onclick = () => {
            this.screenGameOver.classList.add('hidden');
            this.openGarage();
        };
        document.getElementById('btnGameOverMenu').onclick = () => this.goToMenu();

        // Modal Close buttons
        document.getElementById('btnCloseGarage').onclick = () => this.closeModal(this.screenGarage);
        document.getElementById('btnCloseLevels').onclick = () => this.closeModal(this.screenLevels);
        document.getElementById('btnCloseSettings').onclick = () => this.closeModal(this.screenSettings);

        // Sound toggle
        const btnToggleSound = document.getElementById('btnToggleSound');
        const soundLabel = document.getElementById('soundStateLabel');
        btnToggleSound.onclick = () => {
            const enabled = window.soundManager.toggleSound();
            soundLabel.textContent = enabled ? 'ON' : 'OFF';
            btnToggleSound.classList.toggle('off', !enabled);
        };

        // Reset progress
        document.getElementById('btnResetData').onclick = () => {
            if (confirm('Reset all game progress, upgrades, and scores?')) {
                localStorage.removeItem('hillclimber_save');
                this.storage = {
                    totalCoins: 200,
                    highScore: 0,
                    levelRecords: { green_hills: 0, desert: 0, snow: 0, moon: 0 },
                    unlockedLevels: ['green_hills'],
                    upgrades: { engine: 1, tires: 1, suspension: 1, fuel: 1 },
                    selectedLevel: 'green_hills'
                };
                this.saveStorage();
                this.vehicle.applyUpgrades(this.storage.upgrades);
                this.updateUI();
                alert('Progress reset successfully!');
            }
        };

        // Garage Upgrades click delegation
        document.querySelectorAll('.btn-upgrade').forEach(btn => {
            btn.onclick = (e) => {
                const part = btn.getAttribute('data-part');
                this.buyUpgrade(part);
            };
        });

        // Initialize sound state in settings
        if (window.soundManager && !window.soundManager.enabled) {
            soundLabel.textContent = 'OFF';
            btnToggleSound.classList.add('off');
        }
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
    }

    startGame() {
        if (window.soundManager) {
            window.soundManager.resume();
            window.soundManager.playClick();
        }

        this.currentEnv = new Environment(this.storage.selectedLevel);
        this.vehicle = new Vehicle(this.storage.upgrades);
        this.vehicle.applyUpgrades(this.storage.upgrades);
        this.spawner.init(this.currentEnv);
        this.particles = [];
        this.floatingTexts = [];
        this.input.gas = false;
        this.input.brake = false;

        this.state = 'PLAYING';
        this.screenMenu.classList.add('hidden');
        this.screenGarage.classList.add('hidden');
        this.screenLevels.classList.add('hidden');
        this.screenPause.classList.add('hidden');
        this.screenGameOver.classList.add('hidden');
        this.screenHUD.classList.remove('hidden');

        if (window.soundManager) window.soundManager.startEngine();
        this.updateUI();
    }

    restartGame() {
        this.screenPause.classList.add('hidden');
        this.screenGameOver.classList.add('hidden');
        this.startGame();
    }

    pauseGame() {
        if (this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        if (window.soundManager) {
            window.soundManager.stopEngine();
            window.soundManager.playClick();
        }
        this.screenPause.classList.remove('hidden');
    }

    resumeGame() {
        if (this.state !== 'PAUSED') return;
        this.state = 'PLAYING';
        if (window.soundManager) {
            window.soundManager.startEngine();
            window.soundManager.playClick();
        }
        this.screenPause.classList.add('hidden');
    }

    goToMenu() {
        if (window.soundManager) {
            window.soundManager.stopEngine();
            window.soundManager.playClick();
        }
        this.state = 'MENU';
        this.screenHUD.classList.add('hidden');
        this.screenPause.classList.add('hidden');
        this.screenGameOver.classList.add('hidden');
        this.screenGarage.classList.add('hidden');
        this.screenLevels.classList.add('hidden');
        this.screenSettings.classList.add('hidden');
        this.screenMenu.classList.remove('hidden');

        // Reset camera/world for idle background
        this.currentEnv = new Environment(this.storage.selectedLevel);
        this.vehicle.reset(60, 320);
        this.spawner.init(this.currentEnv);
        this.updateUI();
    }

    openGarage() {
        if (window.soundManager) window.soundManager.playClick();
        this.screenGarage.classList.remove('hidden');
        this.renderGarage();
    }

    openLevels() {
        if (window.soundManager) window.soundManager.playClick();
        this.screenLevels.classList.remove('hidden');
        this.renderLevels();
    }

    openSettings() {
        if (window.soundManager) window.soundManager.playClick();
        this.screenSettings.classList.remove('hidden');
    }

    closeModal(modal) {
        if (window.soundManager) window.soundManager.playClick();
        modal.classList.add('hidden');
        this.updateUI();
    }

    buyUpgrade(part) {
        const currentLvl = this.storage.upgrades[part] || 1;
        if (currentLvl >= 5) return;

        const cost = this.upgradeCosts[currentLvl];
        if (this.storage.totalCoins >= cost) {
            this.storage.totalCoins -= cost;
            this.storage.upgrades[part] = currentLvl + 1;
            this.saveStorage();
            this.vehicle.applyUpgrades(this.storage.upgrades);
            if (window.soundManager) window.soundManager.playUpgrade();
            this.renderGarage();
            this.updateUI();
        } else {
            alert('Not enough coins! Collect more coins during your runs.');
        }
    }

    renderGarage() {
        this.garageCoins.textContent = this.storage.totalCoins.toLocaleString();

        const parts = ['engine', 'tires', 'suspension', 'fuel'];
        parts.forEach(part => {
            const lvl = this.storage.upgrades[part];
            const pipsContainer = document.getElementById(`pips-${part}`);
            if (pipsContainer) {
                pipsContainer.innerHTML = '';
                for (let i = 1; i <= 5; i++) {
                    const pip = document.createElement('div');
                    pip.className = `pip ${i <= lvl ? 'active' : ''}`;
                    pipsContainer.appendChild(pip);
                }
            }

            const btn = document.querySelector(`.btn-upgrade[data-part="${part}"]`);
            if (btn) {
                if (lvl >= 5) {
                    btn.textContent = 'MAX';
                    btn.disabled = true;
                    btn.classList.add('maxed');
                } else {
                    const nextCost = this.upgradeCosts[lvl];
                    btn.innerHTML = `<span class="coin-icon">★</span> ${nextCost}`;
                    btn.disabled = (this.storage.totalCoins < nextCost);
                    btn.classList.remove('maxed');
                }
            }
        });
    }

    renderLevels() {
        const list = document.getElementById('levelsContainer');
        list.innerHTML = '';

        const envs = [
            { id: 'green_hills', name: 'Green Hills', desc: 'Standard gravity, lush grass, rolling hills', unlockReq: 'Default', icon: '🌱' },
            { id: 'desert', name: 'Desert Dunes', desc: 'Loose sand, steep slip faces, scorching sun', unlockDist: 400, unlockCost: 400, icon: '🏜️' },
            { id: 'snow', name: 'Frozen Peak', desc: 'Low tire grip, slippery ice bumps, snowfall', unlockDist: 800, unlockCost: 1000, icon: '❄️' },
            { id: 'moon', name: 'Lunar Surface', desc: '0.35g low gravity, massive air jumps, craters', unlockDist: 1500, unlockCost: 2500, icon: '🌕' }
        ];

        envs.forEach(env => {
            const isUnlocked = this.storage.unlockedLevels.includes(env.id);
            const isSelected = (this.storage.selectedLevel === env.id);
            const best = this.storage.levelRecords[env.id] || 0;

            const card = document.createElement('div');
            card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}`;

            let actionHtml = '';
            if (isSelected) {
                actionHtml = `<span class="badge-selected">ACTIVE</span>`;
            } else if (isUnlocked) {
                actionHtml = `<button class="btn-level-select" data-id="${env.id}">SELECT</button>`;
            } else {
                actionHtml = `
                    <div class="unlock-reqs">
                        <span>Need ${env.unlockDist}m record OR</span>
                        <button class="btn-unlock-level" data-id="${env.id}" data-cost="${env.unlockCost}">
                            Unlock for <span class="coin-icon">★</span> ${env.unlockCost}
                        </button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="level-icon">${env.icon}</div>
                <div class="level-info">
                    <h3>${env.name}</h3>
                    <p>${env.desc}</p>
                    <div class="level-record">Best: <strong>${best}m</strong></div>
                </div>
                <div class="level-action">
                    ${actionHtml}
                </div>
            `;

            list.appendChild(card);
        });

        // Bind Level Selection and Unlock
        list.querySelectorAll('.btn-level-select').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                this.storage.selectedLevel = id;
                this.saveStorage();
                if (window.soundManager) window.soundManager.playClick();
                this.renderLevels();
                this.updateUI();
            };
        });

        list.querySelectorAll('.btn-unlock-level').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const cost = parseInt(btn.getAttribute('data-cost'), 10);
                if (this.storage.totalCoins >= cost) {
                    this.storage.totalCoins -= cost;
                    this.storage.unlockedLevels.push(id);
                    this.storage.selectedLevel = id;
                    this.saveStorage();
                    if (window.soundManager) window.soundManager.playUpgrade();
                    this.renderLevels();
                    this.updateUI();
                } else {
                    alert('Not enough coins to unlock this environment!');
                }
            };
        });
    }

    updateUI() {
        this.menuCoins.textContent = this.storage.totalCoins.toLocaleString();
        const levelBest = this.storage.levelRecords[this.storage.selectedLevel] || 0;
        document.getElementById('menuBestScore').textContent = `${levelBest}m`;
        document.getElementById('menuActiveLevel').textContent = this.currentEnv.name;
    }

    onGameOver() {
        this.state = 'GAMEOVER';
        if (window.soundManager) window.soundManager.stopEngine();

        // Bank coins from run
        this.storage.totalCoins += this.vehicle.coinsCollected;

        // Check records
        const levelKey = this.storage.selectedLevel;
        const previousRecord = this.storage.levelRecords[levelKey] || 0;
        let isNewRecord = false;
        if (this.vehicle.distance > previousRecord) {
            this.storage.levelRecords[levelKey] = this.vehicle.distance;
            isNewRecord = true;
        }
        if (this.vehicle.distance > this.storage.highScore) {
            this.storage.highScore = this.vehicle.distance;
        }

        // Automatic unlocks by distance
        if (this.storage.highScore >= 400 && !this.storage.unlockedLevels.includes('desert')) {
            this.storage.unlockedLevels.push('desert');
        }
        if (this.storage.highScore >= 800 && !this.storage.unlockedLevels.includes('snow')) {
            this.storage.unlockedLevels.push('snow');
        }
        if (this.storage.highScore >= 1500 && !this.storage.unlockedLevels.includes('moon')) {
            this.storage.unlockedLevels.push('moon');
        }

        this.saveStorage();

        // Populate Game Over modal
        document.getElementById('gameOverTitle').textContent = this.vehicle.crashReason || 'GAME OVER';
        document.getElementById('goDistance').textContent = `${this.vehicle.distance}m`;
        document.getElementById('goCoins').textContent = `+${this.vehicle.coinsCollected}`;
        document.getElementById('goTotalCoins').textContent = this.storage.totalCoins.toLocaleString();

        const recordBadge = document.getElementById('goRecordBadge');
        if (isNewRecord) {
            recordBadge.classList.remove('hidden');
        } else {
            recordBadge.classList.add('hidden');
        }

        this.screenGameOver.classList.remove('hidden');
    }

    loop(currentTime) {
        requestAnimationFrame((t) => this.loop(t));

        const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        if (this.state === 'PLAYING') {
            this.accumulator += delta;
            while (this.accumulator >= this.fixedStep) {
                this.vehicle.update(this.fixedStep, this.input, this.currentEnv, this.particles, this.floatingTexts);
                this.spawner.update(this.vehicle.x, this.currentEnv);
                this.spawner.checkCollisions(this.vehicle, this.particles, this.floatingTexts);
                this.accumulator -= this.fixedStep;
            }

            // Update particles & floating texts
            this.particles = this.particles.filter(p => p.update(delta));
            this.floatingTexts = this.floatingTexts.filter(ft => ft.update(delta));

            // Update HUD
            const fuelPct = Math.max(0, Math.min(100, (this.vehicle.fuel / this.vehicle.maxFuel) * 100));
            this.hudFuelFill.style.width = `${fuelPct}%`;
            if (fuelPct < 25) {
                this.hudFuelCard.classList.add('warning');
            } else {
                this.hudFuelCard.classList.remove('warning');
            }

            this.hudDistance.textContent = `${this.vehicle.distance}m`;
            const curRecord = this.storage.levelRecords[this.storage.selectedLevel] || 0;
            this.hudBest.textContent = `${curRecord}m`;
            this.hudCoins.textContent = (this.storage.totalCoins + this.vehicle.coinsCollected).toLocaleString();

            // Check if game over condition triggered
            if (this.vehicle.crashed && this.state !== 'GAMEOVER') {
                setTimeout(() => {
                    if (this.state === 'PLAYING') this.onGameOver();
                }, 900);
            }
        } else if (this.state === 'MENU') {
            // Gentle idle motion for background
            this.renderer.camera.x += 12 * delta;
        }

        // Render Frame
        this.renderer.render(
            this.vehicle,
            this.currentEnv,
            this.spawner,
            this.particles,
            this.floatingTexts,
            delta
        );
    }
}

// Boot game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameManager();
});
