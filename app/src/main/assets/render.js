// Canvas 2D Graphics and Vector Renderer for Hill Climber
// High-performance rendering for 16:9, 18:9, 20:9 and tablet screens.

// Compatibility polyfill for roundRect on older/emulator WebView runtimes
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        if (!radii) radii = 0;
        let r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? (radii[0] || 0) : 0);
        r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

class GameRenderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.camera = { x: 0, y: 0 };
        this.time = 0;
        this.viewWidth = 800;
        this.viewHeight = 480;
    }

    setViewDimensions(w, h) {
        this.viewWidth = w;
        this.viewHeight = h;
    }

    render(vehicle, env, spawner, particles, floatingTexts, dt) {
        this.time += dt;
        const w = this.viewWidth;
        const h = this.viewHeight;
        const ctx = this.ctx;

        // Smooth camera follow with forward lookahead
        const lookahead = Math.min(180, Math.max(0, vehicle.vx * 0.35));
        const targetCamX = vehicle.x - w * 0.32 + lookahead;
        const targetCamY = vehicle.y - h * 0.58;
        this.camera.x += (targetCamX - this.camera.x) * 0.12;
        this.camera.y += (targetCamY - this.camera.y) * 0.10;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // 1. Sky & Celestial Backdrop
        this.drawSky(w, h, env);

        // 2. Multi-layer Parallax Mountains
        this.drawParallaxBackdrop(w, h, env);

        // World-space Transform
        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        // 3. Background Scenery
        this.drawScenery(spawner.scenery, env);

        // 4. Multi-Layer Ground Terrain
        this.drawTerrain(w, h, env);

        // 5. Pickups (Coins & Fuel)
        this.drawCollectibles(spawner.coins, spawner.fuelCans);

        // 6. Particles
        this.drawParticles(particles);

        // 7. Vehicle (Chassis, Suspension, Driver, Wheels)
        this.drawVehicle(vehicle);

        // 8. Floating Texts
        this.drawFloatingTexts(floatingTexts);

        ctx.restore();
        ctx.restore();
    }

    drawSky(w, h, env) {
        const ctx = this.ctx;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, env.skyTop);
        grad.addColorStop(1, env.skyBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        if (env.type === 'moon') {
            // Earth in distance
            const earthX = w * 0.82;
            const earthY = h * 0.22;
            ctx.save();
            ctx.fillStyle = '#0284C7';
            ctx.beginPath();
            ctx.arc(earthX, earthY, 32, 0, Math.PI * 2);
            ctx.fill();

            // Earth continents & atmosphere glow
            ctx.fillStyle = '#16A34A';
            ctx.beginPath();
            ctx.arc(earthX - 6, earthY - 4, 13, 0, Math.PI * 2);
            ctx.arc(earthX + 10, earthY + 8, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.arc(earthX - 2, earthY - 8, 12, 0, Math.PI * 2);
            ctx.fill();

            // Stars
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 40; i++) {
                const sx = ((i * 12345.67) % w);
                const sy = ((i * 9876.54) % (h * 0.72));
                const sz = (i % 3 === 0) ? 2 : 1;
                ctx.globalAlpha = 0.4 + Math.sin(this.time * 2 + i) * 0.35;
                ctx.fillRect(sx, sy, sz, sz);
            }
            ctx.globalAlpha = 1.0;
            ctx.restore();
        } else {
            // Sun & atmospheric glow
            const sunX = w * 0.84;
            const sunY = h * 0.20;
            ctx.save();
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 65);
            sunGlow.addColorStop(0, env.type === 'desert' ? '#FEF08A' : '#FFFBEB');
            sunGlow.addColorStop(0.4, env.type === 'desert' ? 'rgba(251, 146, 60, 0.35)' : 'rgba(250, 204, 21, 0.28)');
            sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, 65, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = env.type === 'desert' ? '#F97316' : '#FBBF24';
            ctx.beginPath();
            ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
            ctx.fill();

            // Stylized Clouds
            if (env.type !== 'desert') {
                this.drawCloud(w * 0.15 - (this.camera.x * 0.04) % (w + 200), h * 0.15, 38);
                this.drawCloud(w * 0.52 - (this.camera.x * 0.06) % (w + 200), h * 0.22, 30);
                this.drawCloud(w * 0.86 - (this.camera.x * 0.05) % (w + 200), h * 0.10, 34);
            }
            ctx.restore();
        }
    }

    drawCloud(x, y, radius) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.arc(x + radius * 0.65, y - radius * 0.25, radius * 0.75, 0, Math.PI * 2);
        ctx.arc(x - radius * 0.65, y, radius * 0.6, 0, Math.PI * 2);
        ctx.arc(x + radius * 1.2, y + radius * 0.1, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawParallaxBackdrop(w, h, env) {
        const ctx = this.ctx;
        const farStep = 55;

        // Far Mountains (Parallax 0.12)
        ctx.save();
        ctx.fillStyle = (env.type === 'green_hills') ? '#86EFAC' :
                        (env.type === 'desert') ? '#FDBA74' :
                        (env.type === 'snow') ? '#93C5FD' : '#334155';
        ctx.globalAlpha = 0.50;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + farStep; x += farStep) {
            const worldX = x + this.camera.x * 0.12;
            const my = h * 0.60 + Math.sin(worldX * 0.002) * 55 + Math.cos(worldX * 0.0048) * 28;
            ctx.lineTo(x, my);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Midground Hills (Parallax 0.26)
        ctx.fillStyle = (env.type === 'green_hills') ? '#4ADE80' :
                        (env.type === 'desert') ? '#FB923C' :
                        (env.type === 'snow') ? '#BAE6FD' : '#475569';
        ctx.globalAlpha = 0.70;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + farStep; x += farStep) {
            const worldX = x + this.camera.x * 0.26;
            const my = h * 0.70 + Math.sin(worldX * 0.0032 + 1.2) * 50 + Math.cos(worldX * 0.0075) * 22;
            ctx.lineTo(x, my);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawTerrain(w, h, env) {
        const ctx = this.ctx;
        const startX = this.camera.x - 100;
        const endX = this.camera.x + w + 100;
        const step = 12;

        ctx.save();

        // 1. Bedrock & Dirt Mass
        ctx.beginPath();
        ctx.moveTo(startX, this.camera.y + h + 600);

        for (let x = startX; x <= endX; x += step) {
            ctx.lineTo(x, env.getHeight(x));
        }
        ctx.lineTo(endX, this.camera.y + h + 600);
        ctx.closePath();

        const dirtGrad = ctx.createLinearGradient(0, this.camera.y + h * 0.35, 0, this.camera.y + h + 550);
        dirtGrad.addColorStop(0, env.groundUnderColor);
        dirtGrad.addColorStop(1, '#0F0906');
        ctx.fillStyle = dirtGrad;
        ctx.fill();

        // 2. Sub-surface strata line
        ctx.lineWidth = 18;
        ctx.strokeStyle = env.groundColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            if (x === startX) ctx.moveTo(x, env.getHeight(x) + 4);
            else ctx.lineTo(x, env.getHeight(x) + 4);
        }
        ctx.stroke();

        // 3. Lush Top Crust
        ctx.lineWidth = 9;
        ctx.strokeStyle = env.groundTopColor;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            if (x === startX) ctx.moveTo(x, env.getHeight(x));
            else ctx.lineTo(x, env.getHeight(x));
        }
        ctx.stroke();

        // 4. Subtle Specular Highlight on edge
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        // 5. Cartoon Grass Tufts / Details
        if (env.type === 'green_hills') {
            ctx.fillStyle = '#15803D';
            const tuftStep = 80;
            const firstTuft = Math.floor(startX / tuftStep) * tuftStep;
            for (let tx = firstTuft; tx < endX; tx += tuftStep) {
                const ty = env.getHeight(tx);
                ctx.beginPath();
                ctx.moveTo(tx - 4, ty);
                ctx.lineTo(tx - 2, ty - 6);
                ctx.lineTo(tx, ty);
                ctx.lineTo(tx + 3, ty - 8);
                ctx.lineTo(tx + 5, ty);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    drawScenery(sceneryList, env) {
        const ctx = this.ctx;
        const cullMin = this.camera.x - 80;
        const cullMax = this.camera.x + this.viewWidth + 80;

        for (let s of sceneryList) {
            if (s.x < cullMin || s.x > cullMax) continue;

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.scale(s.scale, s.scale);

            if (s.type === 'tree') {
                ctx.fillStyle = '#78350F';
                ctx.fillRect(-5, -28, 10, 30);

                ctx.fillStyle = '#15803D';
                ctx.beginPath();
                ctx.arc(0, -42, 20, 0, Math.PI * 2);
                ctx.arc(-12, -38, 15, 0, Math.PI * 2);
                ctx.arc(12, -38, 15, 0, Math.PI * 2);
                ctx.arc(0, -56, 16, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#22C55E';
                ctx.beginPath();
                ctx.arc(-4, -45, 12, 0, Math.PI * 2);
                ctx.arc(6, -50, 10, 0, Math.PI * 2);
                ctx.fill();
            } else if (s.type === 'cactus') {
                ctx.lineCap = 'round';
                ctx.lineWidth = 8;
                ctx.strokeStyle = '#15803D';
                // Stem
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -44);
                ctx.stroke();
                // Arms
                ctx.beginPath();
                ctx.moveTo(0, -22);
                ctx.lineTo(-11, -22);
                ctx.lineTo(-11, -34);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -16);
                ctx.lineTo(11, -16);
                ctx.lineTo(11, -30);
                ctx.stroke();
            } else if (s.type === 'pine') {
                ctx.fillStyle = '#78350F';
                ctx.fillRect(-3, -12, 6, 14);

                const drawTier = (y, w, h, clr) => {
                    ctx.fillStyle = clr;
                    ctx.beginPath();
                    ctx.moveTo(0, y - h);
                    ctx.lineTo(-w, y);
                    ctx.lineTo(w, y);
                    ctx.closePath();
                    ctx.fill();
                };
                drawTier(-8, 22, 18, '#14532D');
                drawTier(-20, 16, 16, '#15803D');
                drawTier(-32, 11, 14, '#16A34A');

                // Snow crests
                ctx.fillStyle = '#F8FAFC';
                drawTier(-10, 20, 5, '#F8FAFC');
                drawTier(-22, 14, 4, '#F8FAFC');
                drawTier(-33, 9, 3, '#F8FAFC');
            } else if (s.type === 'rock' || s.type === 'snow_rock' || s.type === 'crater_rock') {
                ctx.fillStyle = (s.type === 'crater_rock') ? '#475569' : '#64748B';
                ctx.beginPath();
                ctx.moveTo(-13, 0);
                ctx.lineTo(-9, -15);
                ctx.lineTo(3, -19);
                ctx.lineTo(15, -9);
                ctx.lineTo(13, 0);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else if (s.type === 'lander_flag') {
                ctx.strokeStyle = '#94A3B8';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -40);
                ctx.stroke();

                ctx.fillStyle = '#EF4444';
                ctx.fillRect(0, -40, 20, 13);
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(8, -34, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    drawCollectibles(coins, fuelCans) {
        const ctx = this.ctx;
        const cullMin = this.camera.x - 50;
        const cullMax = this.camera.x + this.viewWidth + 50;

        // Draw Coins
        for (let c of coins) {
            if (c.collected || c.x < cullMin || c.x > cullMax) continue;

            ctx.save();
            const bounce = Math.sin(this.time * 5 + c.animOffset) * 4;
            const rot = Math.sin(this.time * 5.5 + c.animOffset);
            ctx.translate(c.x, c.y + bounce);
            ctx.scale(Math.max(0.18, Math.abs(rot)), 1);

            // Outer gold rim
            ctx.fillStyle = '#D97706';
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.fill();

            // Inner gold face
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath();
            ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
            ctx.fill();

            // Star symbol
            ctx.fillStyle = '#B45309';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);

            // Glimmer highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(-3.5, -3.5, 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // Draw Fuel Cans
        for (let f of fuelCans) {
            if (f.collected || f.x < cullMin || f.x > cullMax) continue;

            ctx.save();
            const bounce = Math.sin(this.time * 4 + f.animOffset) * 4.5;
            ctx.translate(f.x, f.y + bounce);

            // Jerrycan body
            ctx.fillStyle = '#DC2626';
            ctx.beginPath();
            ctx.roundRect(-12, -16, 24, 30, 4);
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#991B1B';
            ctx.stroke();

            // Handle
            ctx.fillStyle = '#B91C1C';
            ctx.beginPath();
            ctx.rect(-6, -22, 12, 6);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-3, -20, 6, 2.5);

            // Cap
            ctx.fillStyle = '#FBBF24';
            ctx.fillRect(4, -22, 5, 5);

            // Droplet symbol
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.bezierCurveTo(-5, -2, -5, 2, 0, 4);
            ctx.bezierCurveTo(5, 2, 5, -2, 0, -8);
            ctx.fill();

            ctx.font = 'bold 7.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GAS', 0, 10);

            ctx.restore();
        }
    }

    drawVehicle(v) {
        const ctx = this.ctx;
        ctx.save();

        // 1. Suspension Struts (Mount to Wheel Hubs)
        const cosA = Math.cos(v.angle);
        const sinA = Math.sin(v.angle);
        const rearMountX = v.x - cosA * v.wheelDistX - sinA * 6;
        const rearMountY = v.y - sinA * v.wheelDistX + cosA * 6;

        const frontMountX = v.x + cosA * v.wheelDistX - sinA * 6;
        const frontMountY = v.y + sinA * v.wheelDistX + cosA * 6;

        const drawSpring = (x1, y1, x2, y2) => {
            ctx.save();
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);

            ctx.translate(x1, y1);
            ctx.rotate(ang);

            // Telescoping damper rod
            ctx.fillStyle = '#4B5563';
            ctx.fillRect(0, -2.5, dist, 5);
            ctx.fillStyle = '#9CA3AF';
            ctx.fillRect(dist * 0.4, -3.5, dist * 0.55, 7);

            // Metallic spring coils
            ctx.strokeStyle = '#F3F4F6';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            const coils = 5;
            const coilStep = dist / (coils * 2);
            for (let i = 0; i <= coils * 2; i++) {
                const cx = i * coilStep;
                const cy = (i % 2 === 0 ? -6.5 : 6.5);
                if (i === 0) ctx.moveTo(0, 0);
                else ctx.lineTo(cx, cy);
            }
            ctx.lineTo(dist, 0);
            ctx.stroke();

            ctx.restore();
        };

        drawSpring(rearMountX, rearMountY, v.rwX, v.rwY);
        drawSpring(frontMountX, frontMountY, v.fwX, v.fwY);

        // 2. Chassis & Driver (Rotated by vehicle angle)
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle);

        // Underbody steel frame
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.roundRect(-42, 6, 84, 9, 3);
        ctx.fill();

        // Spare tire on rear tailgate
        ctx.save();
        ctx.translate(-43, -12);
        ctx.rotate(-0.25);
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#71717A';
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Roll Cage Tubing
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(10, -2);
        ctx.lineTo(0, -28);
        ctx.lineTo(-30, -28);
        ctx.lineTo(-38, 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-16, -28);
        ctx.lineTo(-16, 4);
        ctx.stroke();

        // Roof spot lights
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(-22, -33, 7, 5);
        ctx.fillRect(-9, -33, 7, 5);
        ctx.fillStyle = '#111827';
        ctx.fillRect(-23, -33, 2, 5);
        ctx.fillRect(-10, -33, 2, 5);

        // Animated Cartoon Driver Bobblehead
        const gForceOffset = Math.max(-0.4, Math.min(0.4, -v.vx * 0.0012 - v.vAngle * 0.16));
        ctx.save();
        ctx.translate(-8, -12);

        // Body
        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.roundRect(-8, 0, 16, 15, 4);
        ctx.fill();

        // Hands & Steering Wheel
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(12, 2, 6.5, -0.6, 2.4);
        ctx.stroke();

        // Helmet
        ctx.rotate(gForceOffset);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, -11, 9.5, 0, Math.PI * 2);
        ctx.fill();

        // Red stripe
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-2.5, -20.5, 5, 7.5);

        // Visor
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.roundRect(1, -14, 8.5, 5.5, 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(4, -13, 3.5, 2);

        ctx.restore();

        // Windshield
        ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.beginPath();
        ctx.moveTo(11, -2);
        ctx.lineTo(1, -26);
        ctx.lineTo(16, -2);
        ctx.closePath();
        ctx.fill();

        // Main Car Body (Gloss Red Off-Roader)
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(-42, 8);
        ctx.lineTo(-42, -6);
        ctx.lineTo(-20, -6);
        ctx.lineTo(-4, -1);
        ctx.lineTo(24, -1);
        ctx.lineTo(41, 7);
        ctx.lineTo(41, 14);
        ctx.lineTo(28, 14);
        // Wheel arches cutouts
        ctx.arc(v.wheelDistX, 12, 21, 0, Math.PI, true);
        ctx.lineTo(-v.wheelDistX + 21, 12);
        ctx.arc(-v.wheelDistX, 12, 21, 0, Math.PI, true);
        ctx.lineTo(-42, 12);
        ctx.closePath();
        ctx.fill();

        // White racing stripe
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-42, 0);
        ctx.lineTo(39, 4);
        ctx.lineTo(38, 7.5);
        ctx.lineTo(-42, 3.5);
        ctx.closePath();
        ctx.fill();

        // Gold side decal
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(-10, 3);
        ctx.lineTo(16, 3);
        ctx.lineTo(12, 6.5);
        ctx.lineTo(-6, 6.5);
        ctx.closePath();
        ctx.fill();

        // Headlight
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(38, 5, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Bull-Bar Bumper
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(38, 13);
        ctx.lineTo(44, 9);
        ctx.lineTo(44, 0);
        ctx.stroke();

        ctx.restore(); // End chassis transform

        // 3. Wheels (Rendered at world positions with spin angle)
        const drawWheel = (wx, wy, rotAngle) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(rotAngle);

            const R = v.wheelRadius;

            // Rubber Tire
            ctx.fillStyle = '#18181B';
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, Math.PI * 2);
            ctx.fill();

            // Knobby Treads
            ctx.fillStyle = '#27272A';
            const numTreads = 10;
            for (let i = 0; i < numTreads; i++) {
                const a = (i / numTreads) * Math.PI * 2;
                ctx.save();
                ctx.rotate(a);
                ctx.fillRect(R - 4, -3, 4.5, 6);
                ctx.restore();
            }

            // Alloy Rim
            ctx.fillStyle = '#E4E4E7';
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.58, 0, Math.PI * 2);
            ctx.fill();

            // 5-Spoke Pattern
            ctx.fillStyle = '#18181B';
            for (let i = 0; i < 5; i++) {
                const spokeAng = (i / 5) * Math.PI * 2;
                const holeX = Math.cos(spokeAng) * (R * 0.36);
                const holeY = Math.sin(spokeAng) * (R * 0.36);
                ctx.beginPath();
                ctx.arc(holeX, holeY, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Red Hub Cap
            ctx.fillStyle = '#DC2626';
            ctx.beginPath();
            ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        };

        drawWheel(v.rwX, v.rwY, v.rwAngle);
        drawWheel(v.fwX, v.fwY, v.fwAngle);

        ctx.restore();
    }

    drawParticles(particles) {
        const ctx = this.ctx;
        for (let p of particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;

            if (p.shape === 'smoke') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1.7 - p.alpha * 0.7), 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawFloatingTexts(texts) {
        const ctx = this.ctx;
        for (let t of texts) {
            ctx.save();
            ctx.globalAlpha = t.alpha;
            ctx.fillStyle = t.color;
            ctx.font = `900 ${t.size}px 'Arial Black', Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }
}
