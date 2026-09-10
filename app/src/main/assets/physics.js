// Physics & World Engine for Hill Climber
// Handles 2D vehicle dynamics, spring-damper suspension, terrain generation, and collision detection.

class Environment {
    constructor(type) {
        this.type = type;
        switch (type) {
            case 'desert':
                this.name = 'Desert Dunes';
                this.gravity = 980;
                this.friction = 0.92;
                this.groundColor = '#E0A96D';
                this.groundTopColor = '#F6D39B';
                this.groundUnderColor = '#8A532B';
                this.skyTop = '#E76F51';
                this.skyBottom = '#F4A261';
                this.hillBase = 460;
                this.unlockCost = 400;
                this.unlockDistance = 400;
                break;
            case 'snow':
                this.name = 'Frozen Peak';
                this.gravity = 980;
                this.friction = 0.65;
                this.groundColor = '#E2E8F0';
                this.groundTopColor = '#FFFFFF';
                this.groundUnderColor = '#475569';
                this.skyTop = '#1E293B';
                this.skyBottom = '#64748B';
                this.hillBase = 460;
                this.unlockCost = 1000;
                this.unlockDistance = 800;
                break;
            case 'moon':
                this.name = 'Lunar Surface';
                this.gravity = 350; // Low gravity for massive jumps
                this.friction = 1.18;
                this.groundColor = '#94A3B8';
                this.groundTopColor = '#CBD5E1';
                this.groundUnderColor = '#1E293B';
                this.skyTop = '#05070E';
                this.skyBottom = '#0F172A';
                this.hillBase = 470;
                this.unlockCost = 2500;
                this.unlockDistance = 1500;
                break;
            case 'green_hills':
            default:
                this.type = 'green_hills';
                this.name = 'Green Hills';
                this.gravity = 980;
                this.friction = 1.10;
                this.groundColor = '#22C55E';
                this.groundTopColor = '#4ADE80';
                this.groundUnderColor = '#5A381E';
                this.skyTop = '#0284C7';
                this.skyBottom = '#7DD3FC';
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
            const h2 = Math.sin(x * 0.0085 + 1.1) * 32;
            const h3 = Math.sin(x * 0.018 + 0.4) * 12;
            // Occasional steep hill / jump
            const bigJump = Math.sin(x * 0.0012) > 0.65 ? Math.sin((x % 600) / 600 * Math.PI) * 80 : 0;
            return b + h1 + h2 + h3 - bigJump;
        } else if (this.type === 'desert') {
            const dune1 = Math.sin(x * 0.0028) * 80;
            const dune2 = Math.sin(x * 0.007 + 2.0) * 42;
            const slipFace = Math.cos(x * 0.014) * 16;
            return b + dune1 + dune2 + slipFace;
        } else if (this.type === 'snow') {
            const m1 = Math.sin(x * 0.0038) * 88;
            const m2 = Math.cos(x * 0.0085 + 0.8) * 36;
            const jagged = Math.sin(x * 0.022) * 12;
            return b + m1 + m2 + jagged;
        } else if (this.type === 'moon') {
            const crater = Math.sin(x * 0.002) * 105;
            const rims = Math.sin(x * 0.006 + 1.5) * 45;
            const bumps = Math.sin(x * 0.025) * 14;
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
        this.reset(60, 320);
    }

    reset(startX = 60, startY = 320) {
        // Chassis state
        this.x = startX;
        this.y = startY;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0; // radians
        this.vAngle = 0; // angular velocity (rad/s)
        this.chassisMass = 720;
        this.inertia = 11500;

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
        this.driverHeadLocal = { x: -6, y: -30 };

        // Fuel
        this.maxFuel = 100 + (this.upgrades.fuel - 1) * 30; // 100 up to 220
        this.fuel = this.maxFuel;
        this.fuelConsumptionRate = 3.2; // % per sec while throttling

        // Gameplay state
        this.crashed = false;
        this.crashReason = '';
        this.outOfFuel = false;
        this.flipAngleAccum = 0;
        this.lastAngle = 0;
        this.airTime = 0;
        this.wheelieTime = 0;
        this.distance = 0;
        this.score = 0;
        this.coinsCollected = 0;

        // Anti-stuck tracker
        this.stuckTimer = 0;

        // Exhaust smoke timing
        this.smokeTimer = 0;
    }

    applyUpgrades(upgrades) {
        this.upgrades = Object.assign({ engine: 1, tires: 1, suspension: 1, fuel: 1 }, upgrades);
        const oldMax = this.maxFuel;
        this.maxFuel = 100 + (this.upgrades.fuel - 1) * 30;
        // Proportionately scale current fuel
        if (oldMax > 0) {
            this.fuel = Math.min(this.maxFuel, this.fuel * (this.maxFuel / oldMax));
        }
    }

    update(dt, input, env, particles, floatingTexts) {
        if (this.crashed) {
            // Settle chassis gently after crash
            this.vy += env.gravity * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.angle += this.vAngle * dt;
            this.vx *= 0.94;
            this.vAngle *= 0.92;

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
            // If car is essentially stopped and out of fuel
            if (Math.hypot(this.vx, this.vy) < 8) {
                this.outOfFuel = true;
                this.crashed = true;
                this.crashReason = 'OUT OF FUEL!';
                if (window.soundManager) window.soundManager.stopEngine();
                return;
            }
        }

        // Multipliers based on upgrades (distinct tiers with tangible gameplay impact)
        const enginePower = 2000 + (this.upgrades.engine - 1) * 650; // 2000 to 4600
        const tireGrip = env.friction * (1.0 + (this.upgrades.tires - 1) * 0.28); // substantial slope climbing grip
        const springK = 40000 + (this.upgrades.suspension - 1) * 7500;
        const damperC = 2400 + (this.upgrades.suspension - 1) * 500;
        // Higher fuel tank level also yields slightly better fuel efficiency
        const fuelEfficiencyFactor = 1.0 - (this.upgrades.fuel - 1) * 0.05;

        // Input processing
        let throttle = 0;
        let brake = 0;
        if (this.fuel > 0) {
            if (input.gas) throttle = 1.0;
            if (input.brake) brake = 1.0;
        }

        // Fuel consumption
        if (throttle > 0) {
            this.fuel -= this.fuelConsumptionRate * fuelEfficiencyFactor * dt;
        } else {
            this.fuel -= (this.fuelConsumptionRate * 0.15) * fuelEfficiencyFactor * dt; // minimal idle consumption
        }
        this.fuel = Math.max(0, this.fuel);

        // Sound update
        const speedRatio = Math.hypot(this.vx, this.vy) / 600;
        if (window.soundManager) {
            window.soundManager.updateEngine(speedRatio, throttle > 0);
        }

        // Air Time, Wheelie & Stunt tracking
        const inAir = !this.rwGrounded && !this.fwGrounded;
        if (inAir) {
            this.airTime += dt;
            this.wheelieTime = 0;

            // In-air pitch controls: Gas tilts nose up (CCW), Brake tilts nose down (CW)
            if (throttle > 0) {
                this.vAngle -= 4.6 * dt;
            }
            if (brake > 0) {
                this.vAngle += 4.6 * dt;
            }

            // Flip tracking
            let angleDiff = this.angle - this.lastAngle;
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
            if (this.airTime > 1.2) {
                const bonus = Math.floor(this.airTime * 80);
                floatingTexts.push(new FloatingText(this.x, this.y - 40, `AIR TIME ${this.airTime.toFixed(1)}s! +${bonus}`, '#38BDF8', 20));
                this.coinsCollected += bonus;
                if (window.soundManager) window.soundManager.playStunt();
            }
            this.airTime = 0;
            this.flipAngleAccum = 0;

            // Wheelie detection (driving on rear wheel only)
            if (this.rwGrounded && !this.fwGrounded && this.vx > 60) {
                this.wheelieTime += dt;
                if (this.wheelieTime >= 1.5 && Math.random() < 0.08) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 40, 'WHEELIE! +150', '#F59E0B', 20));
                    this.coinsCollected += 150;
                    if (window.soundManager) window.soundManager.playStunt();
                    this.wheelieTime = 0;
                }
            } else {
                this.wheelieTime = 0;
            }
        }
        this.lastAngle = this.angle;

        // Anti-Stuck detection and helper torque
        if ((this.rwGrounded || this.fwGrounded) && (throttle > 0 || brake > 0) && Math.abs(this.vx) < 5) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 1.2) {
                // Assist pulse to help climb steep rocks or escape dips
                const assistDir = throttle > 0 ? 1 : -1;
                this.vx += assistDir * 120 * dt;
                this.vy -= 180 * dt;
                if (this.stuckTimer > 2.5) {
                    this.stuckTimer = 0;
                }
            }
        } else {
            this.stuckTimer = 0;
        }

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

        // Simulation of Wheel and Suspension Forces
        const simWheel = (wX, wY, wVx, wVy, mX, mY, isDriveWheel) => {
            const dx = wX - mX;
            const dy = wY - mY;
            const currentDist = Math.hypot(dx, dy) || 1.0;
            const dirX = dx / currentDist;
            const dirY = dy / currentDist;

            // Suspension compression (positive when compressed)
            const deltaL = this.restSuspensionLen - currentDist;
            const relVx = wVx - this.vx;
            const relVy = wVy - this.vy;
            const relVelAxis = relVx * dirX + relVy * dirY;

            // Restoring spring and damper force
            let suspForce = springK * deltaL - damperC * relVelAxis;

            // Wheel force along suspension axis; equal & opposite on chassis
            let wFx = dirX * suspForce;
            let wFy = dirY * suspForce;

            let cFx = -wFx;
            let cFy = -wFy;
            let torque = (mX - this.x) * cFy - (mY - this.y) * cFx;

            // Ground collision detection
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

                // OUTWARD NORMAL POINTING UPWARD TOWARDS SKY (In canvas coords, Up is -Y):
                // For tangent (tanX, tanY), rotating 90 deg counter-clockwise in screen coords:
                // (tanY, -tanX) points towards negative Y (sky)
                const normX = tanY;
                const normY = -tanX;

                // Relative normal velocity (negative when approaching ground)
                const vn = wVx * normX + wVy * normY;
                const normalForceMag = Math.max(0, 80000 * penetration - 3800 * vn);

                wFx += normX * normalForceMag;
                wFy += normY * normalForceMag;

                // Drive torque & Braking
                let driveForce = 0;
                if (throttle > 0 && isDriveWheel) {
                    driveForce = enginePower * throttle;
                }
                if (brake > 0) {
                    if (wVx > 10) {
                        driveForce = -enginePower * 1.25 * brake;
                    } else {
                        driveForce = -enginePower * 0.70 * brake; // reverse throttle
                    }
                }

                // Coulomb friction limit
                const maxFriction = normalForceMag * tireGrip;
                driveForce = Math.max(-maxFriction, Math.min(maxFriction, driveForce));

                wFx += tanX * driveForce;
                wFy += tanY * driveForce;

                // Lateral surface damping
                const vt = wVx * tanX + wVy * tanY;
                const frictionDamp = -vt * 90 * tireGrip;
                wFx += tanX * frictionDamp;
                wFy += tanY * frictionDamp;

                wheelAngleDelta = (vt * dt) / this.wheelRadius;

                // Tire particles
                if (Math.abs(driveForce) > 220 && Math.random() < 0.35 && particles.length < 60) {
                    particles.push(new Particle(
                        wX - tanX * 10,
                        wY + this.wheelRadius - 2,
                        -tanX * (driveForce * 0.07) + (Math.random() * 30 - 15),
                        -30 - Math.random() * 35,
                        env.groundColor,
                        3 + Math.random() * 3,
                        0.45,
                        0.9
                    ));
                }
            } else {
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
        const wheelMass = 42;
        this.rwVx += (rearRes.wFx / wheelMass) * dt;
        this.rwVy += (rearRes.wFy / wheelMass) * dt;
        this.rwX += this.rwVx * dt;
        this.rwY += this.rwVy * dt;

        this.fwVx += (frontRes.wFx / wheelMass) * dt;
        this.fwVy += (frontRes.wFy / wheelMass) * dt;
        this.fwX += this.fwVx * dt;
        this.fwY += this.fwVy * dt;

        // Kinematic Suspension Limits: Guarantees wheels NEVER detach or hyper-extend
        const maxSuspLen = this.restSuspensionLen * 1.32;
        const minSuspLen = this.restSuspensionLen * 0.35;

        // Rear Wheel constraint
        const rDx = this.rwX - rearMountX;
        const rDy = this.rwY - rearMountY;
        const rDist = Math.hypot(rDx, rDy) || 1.0;
        if (rDist > maxSuspLen) {
            this.rwX = rearMountX + (rDx / rDist) * maxSuspLen;
            this.rwY = rearMountY + (rDy / rDist) * maxSuspLen;
            const relV = (this.rwVx - this.vx) * (rDx / rDist) + (this.rwVy - this.vy) * (rDy / rDist);
            if (relV > 0) {
                this.rwVx -= relV * (rDx / rDist) * 0.85;
                this.rwVy -= relV * (rDy / rDist) * 0.85;
            }
        } else if (rDist < minSuspLen) {
            this.rwX = rearMountX + (rDx / rDist) * minSuspLen;
            this.rwY = rearMountY + (rDy / rDist) * minSuspLen;
        }

        // Front Wheel constraint
        const fDx = this.fwX - frontMountX;
        const fDy = this.fwY - frontMountY;
        const fDist = Math.hypot(fDx, fDy) || 1.0;
        if (fDist > maxSuspLen) {
            this.fwX = frontMountX + (fDx / fDist) * maxSuspLen;
            this.fwY = frontMountY + (fDy / fDist) * maxSuspLen;
            const relV = (this.fwVx - this.vx) * (fDx / fDist) + (this.fwVy - this.vy) * (fDy / fDist);
            if (relV > 0) {
                this.fwVx -= relV * (fDx / fDist) * 0.85;
                this.fwVy -= relV * (fDy / fDist) * 0.85;
            }
        } else if (fDist < minSuspLen) {
            this.fwX = frontMountX + (fDx / fDist) * minSuspLen;
            this.fwY = frontMountY + (fDy / fDist) * minSuspLen;
        }

        // Robust ground clamp for wheels
        const rG = env.getHeight(this.rwX);
        if (this.rwY + this.wheelRadius > rG) {
            this.rwY = rG - this.wheelRadius;
            if (this.rwVy > 0) this.rwVy = 0;
        }
        const fG = env.getHeight(this.fwX);
        if (this.fwY + this.wheelRadius > fG) {
            this.fwY = fG - this.wheelRadius;
            if (this.fwVy > 0) this.fwVy = 0;
        }

        // Landing stability: when both wheels are grounded, align body stably with terrain
        if (this.rwGrounded && this.fwGrounded) {
            const groundSlopeAngle = Math.atan2(this.fwY - this.rwY, this.fwX - this.rwX);
            let angleDiff = this.angle - groundSlopeAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            // Restore alignment and damp angular bounce
            this.vAngle -= angleDiff * 8.0 * dt;
            this.vAngle *= (1.0 - 5.0 * dt);
        }

        // Apply forces & torques to chassis
        let totalChassisFx = rearRes.cFx + frontRes.cFx;
        let totalChassisFy = rearRes.cFy + frontRes.cFy;
        let totalTorque = rearRes.torque + frontRes.torque;

        // CHASSIS UNDERBODY / BELLY ANTI-STUCK COLLISION
        // Check front bumper, belly center, and rear underbody against ground
        const bellyChecks = [
            { x: this.x - chassisRight.x * 38 + chassisDown.x * 8, y: this.y - chassisRight.y * 38 + chassisDown.y * 8, lever: -38 },
            { x: this.x + chassisDown.x * 12, y: this.y + chassisDown.y * 12, lever: 0 },
            { x: this.x + chassisRight.x * 40 + chassisDown.x * 8, y: this.y + chassisRight.y * 40 + chassisDown.y * 8, lever: 40 }
        ];

        for (let bp of bellyChecks) {
            const bGround = env.getHeight(bp.x);
            const bPen = bp.y - bGround;
            if (bPen > 0) {
                // Belly bottoming out on terrain crest: push chassis UP and slide forward
                const bNormal = 45000 * bPen;
                totalChassisFy -= bNormal;
                totalTorque += bp.lever * (-bNormal * 0.08);
                // Slide friction
                this.vx *= 0.98;
                // Move chassis out of ground
                this.y -= bPen * 0.4;
            }
        }

        this.vx += (totalChassisFx / this.chassisMass) * dt;
        this.vy += (totalChassisFy / this.chassisMass) * dt;
        this.vAngle += (totalTorque / this.inertia) * dt;

        // Angular damping for clean, stable feel
        this.vAngle *= (1.0 - 0.75 * dt);

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += this.vAngle * dt;

        // Distance & score tracking
        const currentMeters = Math.max(0, Math.floor(this.x / 20));
        if (currentMeters > this.distance) {
            this.distance = currentMeters;
            this.score = this.distance + this.coinsCollected;
        }

        // Exhaust smoke particles
        this.smokeTimer += dt;
        if (this.smokeTimer > (throttle > 0 ? 0.05 : 0.22) && particles.length < 60) {
            this.smokeTimer = 0;
            const exhaustX = this.x - chassisRight.x * 40 - chassisDown.x * 2;
            const exhaustY = this.y - chassisRight.y * 40 + chassisDown.y * 2;
            particles.push(new Particle(
                exhaustX,
                exhaustY,
                -chassisRight.x * (throttle > 0 ? 95 : 35) + (Math.random() * 20 - 10),
                -chassisDown.y * 20 - Math.random() * 25,
                throttle > 0 ? 'rgba(70, 70, 70, 0.6)' : 'rgba(160, 160, 160, 0.4)',
                throttle > 0 ? 5 + Math.random() * 4 : 3 + Math.random() * 2,
                0.55,
                0.9,
                'smoke'
            ));
        }

        // Check Driver Head & Chassis Crash Conditions
        const headWorldX = this.x + chassisRight.x * this.driverHeadLocal.x + chassisDown.x * this.driverHeadLocal.y;
        const headWorldY = this.y + chassisRight.y * this.driverHeadLocal.x + chassisDown.y * this.driverHeadLocal.y;
        const headGroundY = env.getHeight(headWorldX);

        // Driver collision only triggers when car is substantially rotated or rolled over
        const normAngle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const isFlipped = (normAngle > Math.PI * 0.45 && normAngle < Math.PI * 1.55);

        if (isFlipped && headWorldY >= headGroundY - 6) {
            this.triggerCrash('DRIVER DOWN!', particles, floatingTexts);
            return;
        }

        // Roof / Roll cage contact when upside down
        const chassisGroundY = env.getHeight(this.x);
        if (isFlipped && (this.y >= chassisGroundY - 10)) {
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
        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 180;
            particles.push(new Particle(
                this.x,
                this.y - 10,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                Math.random() < 0.45 ? '#EF4444' : (Math.random() < 0.5 ? '#F59E0B' : '#64748B'),
                4 + Math.random() * 6,
                0.95,
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
        if (carX + 1800 > this.lastGeneratedX) {
            this.generateChunk(this.lastGeneratedX, this.lastGeneratedX + 1600, env);
        }

        // Clean up items far behind car
        const cullX = carX - 1000;
        this.coins = this.coins.filter(c => c.x > cullX);
        this.fuelCans = this.fuelCans.filter(f => f.x > cullX);
        this.scenery = this.scenery.filter(s => s.x > cullX);
    }

    generateChunk(startX, endX, env) {
        let x = Math.max(140, startX);

        while (x < endX) {
            const rand = Math.random();

            // Fuel cans every ~90-110m (1800-2200 px)
            const nextFuelTarget = Math.floor(x / 2000) * 2000 + 1050;
            if (x <= nextFuelTarget && nextFuelTarget < x + 350) {
                const fy = env.getHeight(nextFuelTarget) - 24;
                this.fuelCans.push({
                    x: nextFuelTarget,
                    y: fy,
                    collected: false,
                    animOffset: Math.random() * Math.PI * 2
                });
                x = nextFuelTarget + 120;
                continue;
            }

            // Coin formations
            if (rand < 0.42) {
                const coinCount = 3 + Math.floor(Math.random() * 4);
                const spacing = 38;
                const formationType = Math.random();

                for (let i = 0; i < coinCount; i++) {
                    const cx = x + i * spacing;
                    let cy = env.getHeight(cx) - 30;
                    if (formationType < 0.55) {
                        const mid = (coinCount - 1) / 2;
                        const arcHeight = (1 - Math.pow((i - mid) / mid, 2)) * 42;
                        cy -= arcHeight;
                    }
                    this.coins.push({
                        x: cx,
                        y: cy,
                        value: (i === coinCount - 1 && coinCount > 4) ? 50 : 25,
                        collected: false,
                        animOffset: i * 0.25
                    });
                }
                x += coinCount * spacing + 120;
            } else {
                // Scenery objects
                const sy = env.getHeight(x);
                let type = 'tree';
                if (env.type === 'desert') type = Math.random() < 0.65 ? 'cactus' : 'rock';
                else if (env.type === 'snow') type = Math.random() < 0.7 ? 'pine' : 'snow_rock';
                else if (env.type === 'moon') type = Math.random() < 0.5 ? 'crater_rock' : 'lander_flag';

                this.scenery.push({
                    x: x,
                    y: sy,
                    type: type,
                    scale: 0.75 + Math.random() * 0.45
                });

                x += 160 + Math.random() * 220;
            }
        }

        this.lastGeneratedX = endX;
    }

    checkCollisions(vehicle, particles, floatingTexts) {
        // Probe points for robust vehicle pickup collision:
        // Chassis center, rear wheel, front wheel, front bumper
        const cosA = Math.cos(vehicle.angle);
        const sinA = Math.sin(vehicle.angle);
        const probePoints = [
            { x: vehicle.x, y: vehicle.y },
            { x: vehicle.rwX, y: vehicle.rwY },
            { x: vehicle.fwX, y: vehicle.fwY },
            { x: vehicle.x + cosA * 42, y: vehicle.y + sinA * 42 }
        ];

        const collidesWithVehicle = (itemX, itemY, pickupRadius) => {
            for (let p of probePoints) {
                if (Math.hypot(p.x - itemX, p.y - itemY) < pickupRadius) return true;
            }
            return false;
        };

        // Collect Coins
        for (let coin of this.coins) {
            if (!coin.collected) {
                if (collidesWithVehicle(coin.x, coin.y, 36)) {
                    coin.collected = true;
                    vehicle.coinsCollected += coin.value;
                    vehicle.score = vehicle.distance + vehicle.coinsCollected;

                    floatingTexts.push(new FloatingText(coin.x, coin.y - 12, `+${coin.value}`, '#FBBF24', 18));
                    if (window.soundManager) window.soundManager.playCoin();

                    // Sparkle particles
                    for (let i = 0; i < 7; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spd = 25 + Math.random() * 55;
                        particles.push(new Particle(
                            coin.x,
                            coin.y,
                            Math.cos(angle) * spd,
                            Math.sin(angle) * spd,
                            '#FDE047',
                            3 + Math.random() * 2,
                            0.45,
                            0.9
                        ));
                    }
                }
            }
        }

        // Collect Fuel
        for (let fuel of this.fuelCans) {
            if (!fuel.collected) {
                if (collidesWithVehicle(fuel.x, fuel.y, 40)) {
                    fuel.collected = true;
                    vehicle.fuel = vehicle.maxFuel;

                    floatingTexts.push(new FloatingText(fuel.x, fuel.y - 18, '+100% FUEL!', '#10B981', 22));
                    if (window.soundManager) window.soundManager.playFuel();

                    // Green fuel splash particles
                    for (let i = 0; i < 10; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spd = 30 + Math.random() * 65;
                        particles.push(new Particle(
                            fuel.x,
                            fuel.y,
                            Math.cos(angle) * spd,
                            Math.sin(angle) * spd,
                            '#34D399',
                            4 + Math.random() * 3,
                            0.55,
                            0.9
                        ));
                    }
                }
            }
        }
    }
}
