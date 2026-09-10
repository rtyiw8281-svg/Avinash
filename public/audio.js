// Web Audio API Sound Synthesizer for Hill Climber
// Generates engine sounds, coin chimes, fuel pickups, crash noise, and UI sounds without external assets.

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.engineGain = null;
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineFilter = null;
        this.isEngineRunning = false;
        this.targetRpm = 800;
        this.currentRpm = 800;

        // Load sound preference
        try {
            const saved = localStorage.getItem('hillclimber_sound');
            if (saved !== null) {
                this.enabled = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('localStorage error', e);
        }
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
    }

    resume() {
        if (!this.ctx) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleSound() {
        this.enabled = !this.enabled;
        try {
            localStorage.setItem('hillclimber_sound', JSON.stringify(this.enabled));
        } catch (e) {}

        if (!this.enabled && this.isEngineRunning) {
            this.stopEngine();
        }
        return this.enabled;
    }

    startEngine() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx || this.isEngineRunning) return;

        try {
            const now = this.ctx.currentTime;

            // Master engine gain
            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.setValueAtTime(0.08, now);

            // Low-pass filter to give deep combustion body
            this.engineFilter = this.ctx.createBiquadFilter();
            this.engineFilter.type = 'lowpass';
            this.engineFilter.frequency.setValueAtTime(220, now);

            // Sub-harmonic oscillator for cylinder thumps (sawtooth)
            this.engineOsc1 = this.ctx.createOscillator();
            this.engineOsc1.type = 'sawtooth';
            this.engineOsc1.frequency.setValueAtTime(45, now);

            // Second oscillator for mechanical rasp (triangle)
            this.engineOsc2 = this.ctx.createOscillator();
            this.engineOsc2.type = 'triangle';
            this.engineOsc2.frequency.setValueAtTime(90, now);

            this.engineOsc1.connect(this.engineFilter);
            this.engineOsc2.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc1.start(now);
            this.engineOsc2.start(now);
            this.isEngineRunning = true;
        } catch (e) {
            console.warn('Error starting engine audio:', e);
        }
    }

    updateEngine(speedRatio, isThrottling) {
        if (!this.enabled || !this.isEngineRunning || !this.ctx) return;

        // Calculate RPM based on speed and throttle
        let target = 700 + (Math.abs(speedRatio) * 2600);
        if (isThrottling) {
            target += 900;
        }
        this.currentRpm += (target - this.currentRpm) * 0.15;

        const baseFreq = 30 + (this.currentRpm / 60) * 1.5;
        const now = this.ctx.currentTime;

        try {
            this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
            this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.05, now, 0.05);
            
            const cutoff = 180 + (this.currentRpm / 3500) * 450;
            this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);

            const vol = isThrottling ? 0.14 : 0.07;
            this.engineGain.gain.setTargetAtTime(vol, now, 0.05);
        } catch (e) {}
    }

    stopEngine() {
        if (!this.isEngineRunning || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            if (this.engineGain) {
                this.engineGain.gain.setTargetAtTime(0.001, now, 0.05);
            }
            setTimeout(() => {
                try {
                    if (this.engineOsc1) { this.engineOsc1.stop(); this.engineOsc1.disconnect(); }
                    if (this.engineOsc2) { this.engineOsc2.stop(); this.engineOsc2.disconnect(); }
                    if (this.engineFilter) this.engineFilter.disconnect();
                    if (this.engineGain) this.engineGain.disconnect();
                } catch (err) {}
                this.isEngineRunning = false;
            }, 80);
        } catch (e) {
            this.isEngineRunning = false;
        }
    }

    playCoin() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            // Crisp two-tone bell chime
            osc.frequency.setValueAtTime(987.77, now); // B5
            osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
        } catch (e) {}
    }

    playFuel() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
            notes.forEach((freq, idx) => {
                const startTime = now + (idx * 0.06);
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.22);
            });
        } catch (e) {}
    }

    playCrash() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            // White noise burst with low-pass impact
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.09));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + 0.35);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(now);
        } catch (e) {}
    }

    playStunt() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2); // C6

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.45);
        } catch (e) {}
    }

    playClick() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) {}
    }

    playUpgrade() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.setValueAtTime(523.25, now + 0.07);
            osc.frequency.setValueAtTime(659.25, now + 0.14);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.3);
        } catch (e) {}
    }
}

window.soundManager = new SoundManager();
