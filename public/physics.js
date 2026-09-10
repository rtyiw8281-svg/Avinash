// Physics & World Engine for Hill Climber
// Handles 2D vehicle dynamics, spring-damper suspension, terrain generation, and collision detection.

class Environment {
    constructor(type) {
        this.type = type;
        switch (type) {
            case 'desert':
                this.name = 'Desert Dunes';
                this.gravity = 980;
                this.friction = 0.85;
                this.groundColor = '#E0A96D';
                this.groundUnderColor = '#A2673B';
                this.skyTop = '#F4A261';
                this.skyBottom = '#FDE2B8';
                this.hillBase = 460;
                this.unlockCost = 400;
                this.unlockDistance = 400;
                break;
            case 'snow':
                this.name = 'Frozen Peak';
                this.gravity = 980;
                this.friction = 0.58;
                this.groundColor = '#FFFFFF';
                this.groundUnderColor = '#7A9EBA';
                this.skyTop = '#2B5876';
                this.skyBottom = '#7597BD';
                this.hillBase = 460;
                this.unlockCost = 1000;
                this.unlockDistance = 800;
                break;
            case 'moon':
                this.name = 'Lunar Surface';
                this.gravity = 350; // Low gravity!
                this.friction = 1.15;
                this.groundColor = '#A0A4B8';
                this.groundUnderColor = '#3F445A';
                this.skyTop = '#0B0D19';
                this.skyBottom = '#1A1D2E';
                this.hillBase = 470;
                this.unlockCost = 2500;
                this.unlockDistance = 1500;
                break;
            case 'green_hills':
            default:
                this.type = 'green_hills';
                this.name = 'Green Hills';
                this.gravity = 980;
                this.friction = 1.05;
                this.groundColor = '#48BB78';
                this.groundUnderColor = '#654321';
                this.skyTop = '#4299E1';
                this.skyBottom = '#BEE3F8';
                this.hillBase = 450;
                this.unlockCost = 0;
                this.unlockDistance = 0;
                break;
        }
    }

    // Smooth procedural terrain function
    getHeight(x) {
        if (x < 0) x = 0;
        const b = this.hillBase;

        if (this.type === 'green_hills') {
            const h1 = Math.sin(x * 0.0035) * 65;
            const h2 = Math.sin(x * 0.0085 + 1.1) * 35;
            const h3 = Math.sin(x * 0.02 + 0.4) * 14;
            // Occasional steep hill / jump
            const bigJump = Math.sin(x * 0.0012) > 0.65 ? Math.sin((x % 600) / 600 * Math.PI) * 90 : 0;
            return b + h1 + h2 + h3 - bigJump;
        } else if (this.type === 'desert') {
            const dune1 = Math.sin(x * 0.0028) * 85;
            const dune2 = Math.sin(x * 0.007 + 2.0) * 45;
            const slipFace = Math.cos(x * 0.015) * 18;
            return b + dune1 + dune2 + slipFace;
        } else if (this.type === 'snow') {
            const m1 = Math.sin(x * 0.004) * 95;
            const m2 = Math.cos(x * 0.009 + 0.8) * 40;
            const jagged = Math.sin(x * 0.025) * 12;
            return b + m1 + m2 + jagged;
        } else if (this.type === 'moon') {
            const crater = Math.sin(x * 0.002) * 110;
            const rims = Math.sin(x * 0.006 + 1.5) * 50;
            const bumps = Math.sin(x * 0.03) * 15;
            return b + crater + rims + bumps;
        }
        return b;
    }

    // Derivative dy/dx for surface normal and tangent
    getSlope(x) {
        const delta = 1.0;
        return (this.getHeight(x + delta) - this.getHeight(x - delta)) / (2 * delta);
    }
}

class Particle {
    constructor(x, y, vx, vy, color, size, life, decay, shape = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.alpha = 1.0;
        this.life = life;
        this.maxLife = life;
        this.decay = decay;
        this.shape = shape;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.alpha = Math.max(0, this.life / this.maxLife);
        return this.life > 0;
    }
}

class FloatingText {
    constructor(x, y, text, color = '#FFD700', size = 20) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 1.2;
        this.maxLife = 1.2;
        this.alpha = 1.0;
        this.vy = -45;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        this.alpha = Math.max(0, this.life / this.maxLife);
        return this.life > 0;
    }
}

class Vehicle {
    constructor(upgrades = { engine: 1, tires: 1, suspension: 1, fuel: 1 }) {
        this.upgrades = upgrades;
        this.reset(0, 350);
    }

    reset(startX = 60, startY = 320) {
        // Chassis state
        this.x = startX;
        this.y = startY;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0; // radians
        this.vAngle = 0; // angular velocity (rad/s)
        this.chassisMass = 750;
        this.inertia = 12000;

        // Dimensions
        this.chassisWidth = 84;
        this.chassisHeight = 36;
        this.wheelRadius = 18;
        this.wheelDistX = 36; // half distance between wheels
        this.restSuspensionLen = 28;

        // Wheel positions and velocities
        this.rwX = this.x - this.wheelDistX;
        this.rwY = this.y + this.restSuspensionLen;
        this.rwVx = 0;
        this.rwVy = 0;
        this.rwAngle = 0;
        this.rwGrounded = false;

        this.fwX = this.x + this.wheelDistX;
        this.fwY = this.y + this.restSuspensionLen;
        this.fwVx = 0;
        this.fwVy = 0;
        this.fwAngle = 0;
        this.fwGrounded = false;

        // Driver head local offset
        this.driverHeadLocal = { x: -6, y: -32 };

        // Fuel
        this.maxFuel = 100 + (this.upgrades.fuel - 1) * 22; // 100 to 188
        this.fuel = this.maxFuel;
        this.fuelConsumptionRate = 3.6; // per sec while throttling

        // Gameplay state
        this.crashed = false;
        this.crashReason = '';
        this.outOfFuel = false;
        this.flipAngleAccum = 0;
        this.lastAngle = 0;
        this.airTime = 0;
        this.distance = 0;
        this.score = 0;
        this.coinsCollected = 0;

        // Exhaust smoke timing
        this.smokeTimer = 0;
    }

    applyUpgrades(upgrades) {
        this.upgrades = upgrades;
        this.maxFuel = 100 + (this.upgrades.fuel - 1) * 22;
    }

    update(dt, input, env, particles, floatingTexts) {
        if (this.crashed) {
            // Settle chassis after crash
            this.vy += env.gravity * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.angle += this.vAngle * dt;
            this.vx *= 0.95;
            this.vAngle *= 0.94;

            const groundY = env.getHeight(this.x);
            if (this.y + 12 > groundY) {
                this.y = groundY - 12;
                this.vy = -this.vy * 0.2;
                this.vx *= 0.8;
            }
            return;
        }

        // Check fuel
        if (this.fuel <= 0) {
            this.fuel = 0;
            // If car practically stopped and no fuel
            if (Math.abs(this.vx) < 5 && Math.abs(this.vy) < 5) {
                this.outOfFuel = true;
                this.crashed = true;
                this.crashReason = 'OUT OF FUEL!';
                if (window.soundManager) window.soundManager.stopEngine();
                return;
            }
        }

        // Multipliers based on upgrades
        const enginePower = 1800 + (this.upgrades.engine - 1) * 550;
        const tireGrip = env.friction * (1.0 + (this.upgrades.tires - 1) * 0.24);
        const springK = 38000 + (this.upgrades.suspension - 1) * 6000;
        const damperC = 2200 + (this.upgrades.suspension - 1) * 450;

        // Input processing
        let throttle = 0;
        let brake = 0;
        if (this.fuel > 0) {
            if (input.gas) throttle = 1.0;
            if (input.brake) brake = 1.0;
        }

        // Fuel consumption
        if (throttle > 0) {
            this.fuel -= this.fuelConsumptionRate * dt;
        } else {
            this.fuel -= (this.fuelConsumptionRate * 0.2) * dt; // idle consumption
        }
        this.fuel = Math.max(0, this.fuel);

        // Sound update
        const speedRatio = Math.hypot(this.vx, this.vy) / 600;
        if (window.soundManager) {
            window.soundManager.updateEngine(speedRatio, throttle > 0);
        }

        // Air Time & Stunt tracking
        const inAir = !this.rwGrounded && !this.fwGrounded;
        if (inAir) {
            this.airTime += dt;
            // Air pitch controls: Gas tilts nose up (CCW), Brake tilts nose down (CW)
            if (throttle > 0) {
                this.vAngle -= 4.2 * dt;
            }
            if (brake > 0) {
                this.vAngle += 4.2 * dt;
            }

            // Flip tracking
            let angleDiff = this.angle - this.lastAngle;
            // wrap difference around PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.flipAngleAccum += angleDiff;

            if (this.flipAngleAccum >= Math.PI * 1.85) {
                this.flipAngleAccum -= Math.PI * 2;
                floatingTexts.push(new FloatingText(this.x, this.y - 45, 'FRONTFLIP! +500', '#00E676', 22));
                this.coinsCollected += 500;
                if (window.soundManager) window.soundManager.playStunt();
            } else if (this.flipAngleAccum <= -Math.PI * 1.85) {
                this.flipAngleAccum += Math.PI * 2;
                floatingTexts.push(new FloatingText(this.x, this.y - 45, 'BACKFLIP! +500', '#FFD700', 22));
                this.coinsCollected += 500;
                if (window.soundManager) window.soundManager.playStunt();
            }
        } else {
            if (this.airTime > 1.3) {
                const bonus = Math.floor(this.airTime * 75);
                floatingTexts.push(new FloatingText(this.x, this.y - 40, `AIR TIME ${this.airTime.toFixed(1)}s! +${bonus}`, '#38BDF8', 20));
                this.coinsCollected += bonus;
                if (window.soundManager) window.soundManager.playStunt();
            }
            this.airTime = 0;
            this.flipAngleAccum = 0;
        }
        this.lastAngle = this.angle;

        // Apply chassis gravity
        this.vy += env.gravity * dt;

        // Chassis orientation vectors
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);
        const chassisRight = { x: cosA, y: sinA };
        const chassisDown = { x: -sinA, y: cosA };

        // Suspension attachment points in world space
        const rearMountX = this.x - chassisRight.x * this.wheelDistX + chassisDown.x * 6;
        const rearMountY = this.y - chassisRight.y * this.wheelDistX + chassisDown.y * 6;

        const frontMountX = this.x + chassisRight.x * this.wheelDistX + chassisDown.x * 6;
        const frontMountY = this.y + chassisRight.y * this.wheelDistX + chassisDown.y * 6;

        // Wheels gravity
        this.rwVy += env.gravity * dt;
        this.fwVy += env.gravity * dt;

        // Update Wheels & Suspension forces
        const simWheel = (wX, wY, wVx, wVy, mX, mY, isDriveWheel) => {
            // Vector from mount to wheel
            const dx = wX - mX;
            const dy = wY - mY;
            const currentDist = Math.hypot(dx, dy) || 1.0;
            const dirX = dx / currentDist;
            const dirY = dy / currentDist;

            // Suspension compression
            const deltaL = this.restSuspensionLen - currentDist;
            // Relative velocity along suspension axis
            const relVx = wVx - this.vx;
            const relVy = wVy - this.vy;
            const relVelAxis = relVx * dirX + relVy * dirY;

            // Spring + Damping force magnitude
            let suspForce = springK * deltaL - damperC * relVelAxis;
            // Prevent hyper-extension pulling
            if (currentDist > this.restSuspensionLen + 15) suspForce = Math.max(suspForce, 0);

            // Force on wheel pushes outward along dir; force on chassis is equal & opposite
            let wFx = dirX * suspForce;
            let wFy = dirY * suspForce;

            let cFx = -wFx;
            let cFy = -wFy;
            let torque = (mX - this.x) * cFy - (mY - this.y) * cFx;

            // Terrain collision for wheel
            const groundY = env.getHeight(wX);
            const penetration = (wY + this.wheelRadius) - groundY;
            let grounded = false;
            let wheelAngleDelta = 0;

            if (penetration > 0) {
                grounded = true;
                const slope = env.getSlope(wX);
                const tangentLen = Math.hypot(1, slope);
                const tanX = 1 / tangentLen;
                const tanY = slope / tangentLen;
                const normX = -tanY;
                const normY = tanX;

                // Contact normal reaction (spring + damper on ground)
                const vn = wVx * normX + wVy * normY;
                const normalForceMag = Math.max(0, 75000 * penetration - 3500 * vn);

                wFx += normX * normalForceMag;
                wFy += normY * normalForceMag;

                // Drive torque and braking
                let driveForce = 0;
                if (throttle > 0 && isDriveWheel) {
                    driveForce = enginePower * throttle;
                }
                if (brake > 0) {
                    // Braking opposes forward speed or reverses gently
                    if (wVx > 15) {
                        driveForce = -enginePower * 1.2 * brake;
                    } else {
                        driveForce = -enginePower * 0.65 * brake;
                    }
                }

                // Friction limit (Coulomb friction)
                const maxFriction = normalForceMag * tireGrip;
                driveForce = Math.max(-maxFriction, Math.min(maxFriction, driveForce));

                wFx += tanX * driveForce;
                wFy += tanY * driveForce;

                // Lateral damping along tangent to prevent ice jitter
                const vt = wVx * tanX + wVy * tanY;
                const frictionDamp = -vt * 80 * tireGrip;
                wFx += tanX * frictionDamp;
                wFy += tanY * frictionDamp;

                wheelAngleDelta = (vt * dt) / this.wheelRadius;

                // Particles on driving
                if (Math.abs(driveForce) > 200 && Math.random() < 0.35) {
                    const pColor = env.groundColor;
                    particles.push(new Particle(
                        wX - tanX * 12,
                        wY + this.wheelRadius - 2,
                        -tanX * (driveForce * 0.08) + (Math.random() * 40 - 20),
                        -30 - Math.random() * 40,
                        pColor,
                        3 + Math.random() * 3,
                        0.5,
                        0.9
                    ));
                }
            } else {
                // Free spinning wheel in air
                if (throttle > 0) wheelAngleDelta = 35 * dt;
                else wheelAngleDelta = (wVx * dt) / this.wheelRadius;
            }

            return {
                wFx, wFy, cFx, cFy, torque, grounded, wheelAngleDelta
            };
        };

        const rearRes = simWheel(this.rwX, this.rwY, this.rwVx, this.rwVy, rearMountX, rearMountY, true);
        const frontRes = simWheel(this.fwX, this.fwY, this.fwVx, this.fwVy, frontMountX, frontMountY, true);

        this.rwGrounded = rearRes.grounded;
        this.fwGrounded = frontRes.grounded;
        this.rwAngle += rearRes.wheelAngleDelta;
        this.fwAngle += frontRes.wheelAngleDelta;

        // Apply forces to wheels
        const wheelMass = 45;
        this.rwVx += (rearRes.wFx / wheelMass) * dt;
        this.rwVy += (rearRes.wFy / wheelMass) * dt;
        this.rwX += this.rwVx * dt;
        this.rwY += this.rwVy * dt;

        this.fwVx += (frontRes.wFx / wheelMass) * dt;
        this.fwVy += (frontRes.wFy / wheelMass) * dt;
        this.fwX += this.fwVx * dt;
        this.fwY += this.fwVy * dt;

        // Hard clamp wheels above ground to prevent subterranean tunneling
        const rG = env.getHeight(this.rwX);
        if (this.rwY + this.wheelRadius > rG) {
            this.rwY = rG - this.wheelRadius;
            this.rwVy = Math.min(0, this.rwVy);
        }
        const fG = env.getHeight(this.fwX);
        if (this.fwY + this.wheelRadius > fG) {
            this.fwY = fG - this.wheelRadius;
            this.fwVy = Math.min(0, this.fwVy);
        }

        // Apply forces & torques to chassis
        const totalChassisFx = rearRes.cFx + frontRes.cFx;
        const totalChassisFy = rearRes.cFy + frontRes.cFy;
        const totalTorque = rearRes.torque + frontRes.torque;

        this.vx += (totalChassisFx / this.chassisMass) * dt;
        this.vy += (totalChassisFy / this.chassisMass) * dt;
        this.vAngle += (totalTorque / this.inertia) * dt;

        // Angular damping for smooth feel
        this.vAngle *= (1.0 - 0.7 * dt);

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += this.vAngle * dt;

        // Distance & score tracking
        const currentMeters = Math.max(0, Math.floor(this.x / 20));
        if (currentMeters > this.distance) {
            this.distance = currentMeters;
            this.score = this.distance + this.coinsCollected;
        }

        // Tailpipe exhaust smoke particles
        this.smokeTimer += dt;
        if (this.smokeTimer > (throttle > 0 ? 0.05 : 0.2)) {
            this.smokeTimer = 0;
            const exhaustX = this.x - chassisRight.x * 40 - chassisDown.x * 2;
            const exhaustY = this.y - chassisRight.y * 40 + chassisDown.y * 2;
            particles.push(new Particle(
                exhaustX,
                exhaustY,
                -chassisRight.x * (throttle > 0 ? 90 : 35) + (Math.random() * 20 - 10),
                -chassisDown.y * 20 - Math.random() * 25,
                throttle > 0 ? 'rgba(80, 80, 80, 0.6)' : 'rgba(180, 180, 180, 0.4)',
                throttle > 0 ? 5 + Math.random() * 4 : 3 + Math.random() * 2,
                0.6,
                0.9,
                'smoke'
            ));
        }

        // Check Driver Head & Chassis Crash Conditions
        const headWorldX = this.x + chassisRight.x * this.driverHeadLocal.x + chassisDown.x * this.driverHeadLocal.y;
        const headWorldY = this.y + chassisRight.y * this.driverHeadLocal.y + chassisDown.y * this.driverHeadLocal.x;
        const headGroundY = env.getHeight(headWorldX);

        // Driver neck collision
        if (headWorldY >= headGroundY - 8) {
            this.triggerCrash('DRIVER DOWN!', particles, floatingTexts);
            return;
        }

        // Chassis roof collision when flipped
        const normAngle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const isFlippedUpsideDown = (normAngle > Math.PI * 0.58 && normAngle < Math.PI * 1.42);
        const chassisGroundY = env.getHeight(this.x);
        if (isFlippedUpsideDown && (this.y >= chassisGroundY - 14)) {
            this.triggerCrash('CAR FLIPPED!', particles, floatingTexts);
            return;
        }
    }

    triggerCrash(reason, particles, floatingTexts) {
        if (this.crashed) return;
        this.crashed = true;
        this.crashReason = reason;
        if (window.soundManager) {
            window.soundManager.stopEngine();
            window.soundManager.playCrash();
        }

        floatingTexts.push(new FloatingText(this.x, this.y - 50, reason, '#EF4444', 28));

        // Crash explosion particles
        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 160;
            particles.push(new Particle(
                this.x,
                this.y - 10,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                Math.random() < 0.5 ? '#E53E3E' : (Math.random() < 0.5 ? '#ECC94B' : '#718096'),
                4 + Math.random() * 6,
                1.0,
                0.9
            ));
        }
    }
}

class ItemSpawner {
    constructor() {
        this.coins = [];
        this.fuelCans = [];
        this.scenery = [];
        this.lastGeneratedX = 0;
    }

    init(env) {
        this.coins = [];
        this.fuelCans = [];
        this.scenery = [];
        this.lastGeneratedX = 0;
        this.generateChunk(0, 1800, env);
    }

    update(carX, env) {
        // Keep generating world ahead of car
        if (carX + 1800 > this.lastGeneratedX) {
            this.generateChunk(this.lastGeneratedX, this.lastGeneratedX + 1500, env);
        }

        // Clean up items far behind
        const cullX = carX - 1000;
        this.coins = this.coins.filter(c => c.x > cullX);
        this.fuelCans = this.fuelCans.filter(f => f.x > cullX);
        this.scenery = this.scenery.filter(s => s.x > cullX);
    }

    generateChunk(startX, endX, env) {
        let x = Math.max(150, startX);

        while (x < endX) {
            const rand = Math.random();

            // Fuel cans every ~90-120m (1800-2400 px)
            const nextFuelTarget = Math.floor(x / 2000) * 2000 + 1100;
            if (x <= nextFuelTarget && nextFuelTarget < x + 350) {
                const fy = env.getHeight(nextFuelTarget) - 24;
                this.fuelCans.push({
                    x: nextFuelTarget,
                    y: fy,
                    collected: false,
                    animOffset: Math.random() * Math.PI * 2
                });
                x = nextFuelTarget + 100;
                continue;
            }

            // Coin formations
            if (rand < 0.38) {
                const coinCount = 3 + Math.floor(Math.random() * 4);
                const spacing = 36;
                const formationType = Math.random();

                for (let i = 0; i < coinCount; i++) {
                    const cx = x + i * spacing;
                    let cy = env.getHeight(cx) - 28;
                    // Arc over peak
                    if (formationType < 0.5) {
                        const mid = (coinCount - 1) / 2;
                        const arcHeight = (1 - Math.pow((i - mid) / mid, 2)) * 38;
                        cy -= arcHeight;
                    }
                    this.coins.push({
                        x: cx,
                        y: cy,
                        value: (i === coinCount - 1 && coinCount > 4) ? 50 : 20,
                        collected: false,
                        animOffset: i * 0.25
                    });
                }
                x += coinCount * spacing + 120;
            } else {
                // Scenery object (Trees, cacti, rocks, signposts)
                const sy = env.getHeight(x);
                let type = 'tree';
                if (env.type === 'desert') type = Math.random() < 0.6 ? 'cactus' : 'rock';
                else if (env.type === 'snow') type = Math.random() < 0.7 ? 'pine' : 'snow_rock';
                else if (env.type === 'moon') type = Math.random() < 0.5 ? 'crater_rock' : 'lander_flag';

                this.scenery.push({
                    x: x,
                    y: sy,
                    type: type,
                    scale: 0.75 + Math.random() * 0.4
                });

                x += 180 + Math.random() * 220;
            }
        }

        this.lastGeneratedX = endX;
    }

    checkCollisions(vehicle, particles, floatingTexts) {
        // Collect Coins
        for (let coin of this.coins) {
            if (!coin.collected) {
                const dist = Math.hypot(vehicle.x - coin.x, vehicle.y - coin.y);
                if (dist < 44) {
                    coin.collected = true;
                    vehicle.coinsCollected += coin.value;
                    vehicle.score = vehicle.distance + vehicle.coinsCollected;

                    floatingTexts.push(new FloatingText(coin.x, coin.y - 10, `+${coin.value}`, '#FFD700', 18));
                    if (window.soundManager) window.soundManager.playCoin();

                    // Sparkles
                    for (let i = 0; i < 8; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spd = 25 + Math.random() * 50;
                        particles.push(new Particle(
                            coin.x,
                            coin.y,
                            Math.cos(angle) * spd,
                            Math.sin(angle) * spd,
                            '#FEE140',
                            3 + Math.random() * 2,
                            0.5,
                            0.9
                        ));
                    }
                }
            }
        }

        // Collect Fuel
        for (let fuel of this.fuelCans) {
            if (!fuel.collected) {
                const dist = Math.hypot(vehicle.x - fuel.x, vehicle.y - fuel.y);
                if (dist < 48) {
                    fuel.collected = true;
                    vehicle.fuel = vehicle.maxFuel;

                    floatingTexts.push(new FloatingText(fuel.x, fuel.y - 15, '+FUEL!', '#10B981', 24));
                    if (window.soundManager) window.soundManager.playFuel();

                    // Green fuel splash particles
                    for (let i = 0; i < 12; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spd = 30 + Math.random() * 70;
                        particles.push(new Particle(
                            fuel.x,
                            fuel.y,
                            Math.cos(angle) * spd,
                            Math.sin(angle) * spd,
                            '#34D399',
                            4 + Math.random() * 3,
                            0.6,
                            0.9
                        ));
                    }
                }
            }
        }
    }
}
