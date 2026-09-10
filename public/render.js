// Canvas 2D Graphics and Vector Renderer for Hill Climber
// Renders parallax sky, mountains, dynamic procedural terrain, cartoon off-road jeep, and particles.

class GameRenderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.camera = { x: 0, y: 0, scale: 1.0 };
        this.time = 0;
    }

    render(vehicle, env, spawner, particles, floatingTexts, dt) {
        this.time += dt;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        // Smooth camera follow
        const targetCamX = vehicle.x - w * 0.32;
        const targetCamY = vehicle.y - h * 0.58;
        this.camera.x += (targetCamX - this.camera.x) * 0.12;
        this.camera.y += (targetCamY - this.camera.y) * 0.10;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // 1. Draw Sky & Celestial
        this.drawSky(w, h, env);

        // 2. Parallax Mountains & Hills
        this.drawParallaxBackdrop(w, h, env);

        // Transform for World Space
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);

        // 3. Scenery in Background / Ground level
        this.drawScenery(spawner.scenery, env);

        // 4. Ground Terrain
        this.drawTerrain(w, h, env);

        // 5. Collectibles (Coins & Fuel)
        this.drawCollectibles(spawner.coins, spawner.fuelCans);

        // 6. Particles
        this.drawParticles(particles);

        // 7. Vehicle (Chassis, Driver, Wheels, Suspension)
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

        // Celestial Body
        if (env.type === 'moon') {
            // Earth in distance
            const earthX = w * 0.82;
            const earthY = h * 0.22;
            ctx.save();
            ctx.fillStyle = '#1E88E5';
            ctx.beginPath();
            ctx.arc(earthX, earthY, 34, 0, Math.PI * 2);
            ctx.fill();

            // Continents & clouds on Earth
            ctx.fillStyle = '#4CAF50';
            ctx.beginPath();
            ctx.arc(earthX - 6, earthY - 4, 14, 0, Math.PI * 2);
            ctx.arc(earthX + 10, earthY + 8, 11, 0, Math.PI * 2);
            ctx.fill();

            // Stars
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 45; i++) {
                const sx = ((i * 12345.67) % w);
                const sy = ((i * 9876.54) % (h * 0.7));
                const sz = (i % 3 === 0) ? 2 : 1;
                ctx.globalAlpha = 0.5 + Math.sin(this.time * 2 + i) * 0.4;
                ctx.fillRect(sx, sy, sz, sz);
            }
            ctx.globalAlpha = 1.0;
            ctx.restore();
        } else {
            // Sun
            const sunX = w * 0.85;
            const sunY = h * 0.2;
            ctx.save();
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 70);
            sunGlow.addColorStop(0, env.type === 'desert' ? '#FFE082' : '#FFF9C4');
            sunGlow.addColorStop(0.4, env.type === 'desert' ? 'rgba(255, 183, 77, 0.4)' : 'rgba(255, 238, 88, 0.3)');
            sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = env.type === 'desert' ? '#FFA726' : '#FDD835';
            ctx.beginPath();
            ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
            ctx.fill();

            // Stylized Clouds
            if (env.type !== 'desert') {
                this.drawCloud(w * 0.15 - (this.camera.x * 0.05) % (w + 200), h * 0.16, 45);
                this.drawCloud(w * 0.55 - (this.camera.x * 0.07) % (w + 200), h * 0.24, 35);
                this.drawCloud(w * 0.88 - (this.camera.x * 0.06) % (w + 200), h * 0.12, 40);
            }
            ctx.restore();
        }
    }

    drawCloud(x, y, radius) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
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

        // Far Mountains (Parallax 0.12)
        ctx.save();
        ctx.fillStyle = (env.type === 'green_hills') ? '#81C784' :
                        (env.type === 'desert') ? '#E6B87D' :
                        (env.type === 'snow') ? '#90CAF9' : '#2A2E43';
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(0, h);
        const farStep = 60;
        for (let x = 0; x <= w + farStep; x += farStep) {
            const worldX = x + this.camera.x * 0.12;
            const my = h * 0.62 + Math.sin(worldX * 0.002) * 60 + Math.cos(worldX * 0.005) * 30;
            ctx.lineTo(x, my);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Midground Hills (Parallax 0.28)
        ctx.fillStyle = (env.type === 'green_hills') ? '#66BB6A' :
                        (env.type === 'desert') ? '#DDA15E' :
                        (env.type === 'snow') ? '#B0BEC5' : '#393E58';
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + farStep; x += farStep) {
            const worldX = x + this.camera.x * 0.28;
            const my = h * 0.72 + Math.sin(worldX * 0.0035 + 1.2) * 55 + Math.cos(worldX * 0.008) * 25;
            ctx.lineTo(x, my);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawTerrain(w, h, env) {
        const ctx = this.ctx;
        const startX = this.camera.x - 120;
        const endX = this.camera.x + w + 120;
        const step = 14;

        // Ground body polygon
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, this.camera.y + h + 200);

        for (let x = startX; x <= endX; x += step) {
            ctx.lineTo(x, env.getHeight(x));
        }
        ctx.lineTo(endX, this.camera.y + h + 200);
        ctx.closePath();

        // Dirt gradient
        const dirtGrad = ctx.createLinearGradient(0, this.camera.y + h * 0.4, 0, this.camera.y + h + 150);
        dirtGrad.addColorStop(0, env.groundUnderColor);
        dirtGrad.addColorStop(1, '#1A110B');
        ctx.fillStyle = dirtGrad;
        ctx.fill();

        // Top Crust (Grass/Snow/Sand line)
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = env.groundColor;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += step) {
            if (x === startX) ctx.moveTo(x, env.getHeight(x));
            else ctx.lineTo(x, env.getHeight(x));
        }
        ctx.stroke();

        // Subtle highlight line on top edge
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        ctx.restore();
    }

    drawScenery(sceneryList, env) {
        const ctx = this.ctx;
        for (let s of sceneryList) {
            if (s.x < this.camera.x - 100 || s.x > this.camera.x + this.canvas.width + 100) continue;

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.scale(s.scale, s.scale);

            if (s.type === 'tree') {
                // Cartoon oak/apple tree
                ctx.fillStyle = '#654321';
                ctx.fillRect(-6, -32, 12, 34);
                // Foliage circles
                ctx.fillStyle = '#2E7D32';
                ctx.beginPath();
                ctx.arc(0, -48, 22, 0, Math.PI * 2);
                ctx.arc(-14, -42, 16, 0, Math.PI * 2);
                ctx.arc(14, -42, 16, 0, Math.PI * 2);
                ctx.arc(0, -62, 18, 0, Math.PI * 2);
                ctx.fill();

                // Highlight foliage
                ctx.fillStyle = '#4CAF50';
                ctx.beginPath();
                ctx.arc(-5, -50, 14, 0, Math.PI * 2);
                ctx.arc(8, -55, 10, 0, Math.PI * 2);
                ctx.fill();
            } else if (s.type === 'cactus') {
                // Saguaro cactus
                ctx.fillStyle = '#2E7D32';
                ctx.lineCap = 'round';
                ctx.lineWidth = 9;
                ctx.strokeStyle = '#2E7D32';
                // Main stem
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -46);
                ctx.stroke();
                // Left arm
                ctx.beginPath();
                ctx.moveTo(0, -24);
                ctx.lineTo(-12, -24);
                ctx.lineTo(-12, -36);
                ctx.stroke();
                // Right arm
                ctx.beginPath();
                ctx.moveTo(0, -18);
                ctx.lineTo(12, -18);
                ctx.lineTo(12, -32);
                ctx.stroke();
            } else if (s.type === 'pine') {
                // Snow Pine tree
                ctx.fillStyle = '#4E342E';
                ctx.fillRect(-4, -14, 8, 16);
                // Cones
                const drawTier = (y, w, h, clr) => {
                    ctx.fillStyle = clr;
                    ctx.beginPath();
                    ctx.moveTo(0, y - h);
                    ctx.lineTo(-w, y);
                    ctx.lineTo(w, y);
                    ctx.closePath();
                    ctx.fill();
                };
                drawTier(-10, 24, 20, '#1B5E20');
                drawTier(-22, 18, 18, '#2E7D32');
                drawTier(-34, 12, 16, '#388E3C');

                // Snow on pine branches
                ctx.fillStyle = '#ECEFF1';
                drawTier(-12, 22, 6, '#ECEFF1');
                drawTier(-24, 16, 5, '#ECEFF1');
                drawTier(-35, 10, 4, '#ECEFF1');
            } else if (s.type === 'rock' || s.type === 'snow_rock' || s.type === 'crater_rock') {
                ctx.fillStyle = (s.type === 'crater_rock') ? '#545871' : '#78909C';
                ctx.beginPath();
                ctx.moveTo(-14, 0);
                ctx.lineTo(-10, -16);
                ctx.lineTo(4, -20);
                ctx.lineTo(16, -10);
                ctx.lineTo(14, 0);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (s.type === 'lander_flag') {
                // Lunar flagpole
                ctx.strokeStyle = '#CFD8DC';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -42);
                ctx.stroke();
                // Flag cloth
                ctx.fillStyle = '#E53935';
                ctx.fillRect(0, -42, 22, 14);
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(8, -35, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    drawCollectibles(coins, fuelCans) {
        const ctx = this.ctx;

        // Draw Coins
        for (let c of coins) {
            if (c.collected) continue;
            if (c.x < this.camera.x - 50 || c.x > this.camera.x + this.canvas.width + 50) continue;

            ctx.save();
            const bounce = Math.sin(this.time * 5 + c.animOffset) * 4;
            const rot = Math.sin(this.time * 6 + c.animOffset); // 3D spin illusion
            ctx.translate(c.x, c.y + bounce);
            ctx.scale(Math.max(0.18, Math.abs(rot)), 1);

            // Outer gold rim
            ctx.fillStyle = '#D97706';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();

            // Inner bright face
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();

            // Center star / symbol
            ctx.fillStyle = '#F59E0B';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);

            // Glimmer
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(-4, -4, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // Draw Fuel Cans
        for (let f of fuelCans) {
            if (f.collected) continue;
            if (f.x < this.camera.x - 50 || f.x > this.camera.x + this.canvas.width + 50) continue;

            ctx.save();
            const bounce = Math.sin(this.time * 4 + f.animOffset) * 5;
            ctx.translate(f.x, f.y + bounce);

            // Red Jerrycan body
            ctx.fillStyle = '#DC2626';
            ctx.beginPath();
            ctx.roundRect(-13, -18, 26, 32, 4);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#991B1B';
            ctx.stroke();

            // Handle on top
            ctx.fillStyle = '#B91C1C';
            ctx.beginPath();
            ctx.rect(-7, -24, 14, 6);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-4, -22, 8, 3);

            // Spout cap
            ctx.fillStyle = '#FBBF24';
            ctx.fillRect(5, -24, 6, 5);

            // White fuel droplet symbol
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.bezierCurveTo(-5, -3, -6, 2, 0, 5);
            ctx.bezierCurveTo(6, 2, 5, -3, 0, -9);
            ctx.fill();

            // 'GAS' text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GAS', 0, 11);

            ctx.restore();
        }
    }

    drawVehicle(v) {
        const ctx = this.ctx;

        ctx.save();

        // 1. Suspension Struts (rendered from chassis mount points to wheel centers)
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

            // Inner damper cylinder
            ctx.fillStyle = '#374151';
            ctx.fillRect(0, -3, dist, 6);

            // Metallic spring coils
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            const coils = 5;
            const coilStep = dist / (coils * 2);
            for (let i = 0; i <= coils * 2; i++) {
                const cx = i * coilStep;
                const cy = (i % 2 === 0 ? -7 : 7);
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

        // Underbody chassis frame
        ctx.fillStyle = '#1F2937';
        ctx.beginPath();
        ctx.roundRect(-42, 6, 84, 10, 3);
        ctx.fill();

        // Spare tire mounted on back
        ctx.save();
        ctx.translate(-43, -12);
        ctx.rotate(-0.25);
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A1A1AA';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Roll Cage Tubing
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        // A-pillar, B-pillar, roof
        ctx.moveTo(10, -2);
        ctx.lineTo(0, -28);
        ctx.lineTo(-30, -28);
        ctx.lineTo(-38, 2);
        ctx.stroke();

        // Cross bar
        ctx.beginPath();
        ctx.moveTo(-16, -28);
        ctx.lineTo(-16, 4);
        ctx.stroke();

        // Roof spot lights
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(-22, -33, 8, 5);
        ctx.fillRect(-8, -33, 8, 5);
        ctx.fillStyle = '#111827';
        ctx.fillRect(-23, -33, 2, 5);
        ctx.fillRect(-9, -33, 2, 5);

        // Cartoon Driver Bobblehead
        const gForceOffset = Math.max(-0.4, Math.min(0.4, -v.vx * 0.001 - v.vAngle * 0.15));
        ctx.save();
        ctx.translate(-8, -12); // Neck pivot

        // Driver Body
        ctx.fillStyle = '#2563EB'; // Blue racing jumpsuit
        ctx.beginPath();
        ctx.roundRect(-8, 0, 16, 16, 4);
        ctx.fill();

        // Hands & Steering Wheel
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(12, 3, 7, -0.6, 2.4);
        ctx.stroke();

        // Head & Helmet
        ctx.rotate(gForceOffset);
        ctx.fillStyle = '#FFFFFF'; // White helmet
        ctx.beginPath();
        ctx.arc(0, -12, 10, 0, Math.PI * 2);
        ctx.fill();

        // Red racing stripe on helmet
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-3, -22, 6, 8);

        // Dark Visor
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.roundRect(1, -15, 9, 6, 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8'; // Visor glint
        ctx.fillRect(4, -14, 4, 2);

        ctx.restore();

        // Windshield
        ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.beginPath();
        ctx.moveTo(11, -2);
        ctx.lineTo(1, -26);
        ctx.lineTo(16, -2);
        ctx.closePath();
        ctx.fill();

        // Main Car Body (Vibrant Red Off-Roader)
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
        ctx.arc(v.wheelDistX, 12, 22, 0, Math.PI, true);
        ctx.lineTo(-v.wheelDistX + 22, 12);
        ctx.arc(-v.wheelDistX, 12, 22, 0, Math.PI, true);
        ctx.lineTo(-42, 12);
        ctx.closePath();
        ctx.fill();

        // White sport racing stripe
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-42, 0);
        ctx.lineTo(39, 4);
        ctx.lineTo(38, 8);
        ctx.lineTo(-42, 4);
        ctx.closePath();
        ctx.fill();

        // Yellow Side Accent / Decal
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(-10, 3);
        ctx.lineTo(16, 3);
        ctx.lineTo(12, 7);
        ctx.lineTo(-6, 7);
        ctx.closePath();
        ctx.fill();

        // Front Headlight
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(38, 5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Front Bull-Bar Bumper
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(38, 14);
        ctx.lineTo(45, 10);
        ctx.lineTo(45, 0);
        ctx.stroke();

        ctx.restore(); // End chassis transform

        // 3. Wheels (Rendered at world positions with spin angle)
        const drawWheel = (wx, wy, rotAngle) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(rotAngle);

            const R = v.wheelRadius;

            // Outer Rubber Tire
            ctx.fillStyle = '#18181B';
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, Math.PI * 2);
            ctx.fill();

            // Knobby Treads around perimeter
            ctx.fillStyle = '#27272A';
            const numTreads = 10;
            for (let i = 0; i < numTreads; i++) {
                const a = (i / numTreads) * Math.PI * 2;
                ctx.save();
                ctx.rotate(a);
                ctx.fillRect(R - 4, -3.5, 5, 7);
                ctx.restore();
            }

            // Alloy Rim (Silver/Bronze)
            ctx.fillStyle = '#E4E4E7';
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.58, 0, Math.PI * 2);
            ctx.fill();

            // 5-Spoke Rim Pattern
            ctx.fillStyle = '#18181B';
            for (let i = 0; i < 5; i++) {
                const spokeAng = (i / 5) * Math.PI * 2;
                const holeX = Math.cos(spokeAng) * (R * 0.36);
                const holeY = Math.sin(spokeAng) * (R * 0.36);
                ctx.beginPath();
                ctx.arc(holeX, holeY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Center Wheel Cap (Red)
            ctx.fillStyle = '#DC2626';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
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
                ctx.arc(p.x, p.y, p.size * (1.8 - p.alpha * 0.8), 0, Math.PI * 2);
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
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 6;
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }
}
