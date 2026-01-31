// ============================================
// DWELL:REFUGE - Zone Definitions
// Future mundane: domestic sounds under climate stress
// ============================================

const Zones = (function() {
    'use strict';

    // ============================================
    // STORM ZONE [0.1, 0.1]
    // Being inside during the storm
    // Rain on window, glass vibrating, interior leak, blind rattling
    // ============================================

    function createStormZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Rain on window - highpass filtered noise (rain hitting glass, not open rain)
        const rainOnGlass = Synthesis.createFilteredNoise(ctx, 'white', 'highpass', 1200, 0.8);
        rainOnGlass.gain.gain.value = 0.12;
        rainOnGlass.connect(masterGain);
        rainOnGlass.start();
        cleanupFns.push(() => { try { rainOnGlass.stop(); } catch(e) {} });

        // Add irregular intensity to rain (gusts)
        const rainLfo = ctx.createOscillator();
        const rainLfoGain = ctx.createGain();
        rainLfo.type = 'sine';
        rainLfo.frequency.value = 0.08;
        rainLfoGain.gain.value = 0.04;
        rainLfo.connect(rainLfoGain);
        rainLfoGain.connect(rainOnGlass.gain.gain);
        rainLfo.start();
        cleanupFns.push(() => { try { rainLfo.stop(); } catch(e) {} });

        // 2. Interior leak - drip every 2-3 seconds with room reverb
        const leak = Synthesis.scheduleDripsWithReverb(ctx, masterGain, 2, 3.5, 'room', 0.12);
        leak.start();
        cleanupFns.push(() => leak.stop());

        // 3. Blind/shutter rattling - irregular low clicks
        const blindScheduler = {
            timeout: null,
            running: false,
            start: function() {
                this.running = true;
                this.schedule();
            },
            stop: function() {
                this.running = false;
                if (this.timeout) clearTimeout(this.timeout);
            },
            schedule: function() {
                if (!this.running) return;
                const interval = (5 + Math.random() * 10) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Low thud of blind hitting frame
                    Synthesis.createNoiseBurst(ctx, masterGain, 200 + Math.random() * 100, 0.08, 8);
                    this.schedule();
                }, interval);
            }
        };
        blindScheduler.start();
        cleanupFns.push(() => blindScheduler.stop());

        // 4. Thunder + glass vibration - distant thunder triggers window rattle
        const thunderScheduler = {
            timeout: null,
            running: false,
            start: function() {
                this.running = true;
                this.schedule();
            },
            stop: function() {
                this.running = false;
                if (this.timeout) clearTimeout(this.timeout);
            },
            schedule: function() {
                if (!this.running) return;
                const interval = (12 + Math.random() * 20) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Distant thunder (low rumble)
                    Synthesis.createNoiseBurst(ctx, masterGain, 80 + Math.random() * 40, 1.5, 0.8);
                    // Glass vibration triggered by thunder (delayed slightly)
                    setTimeout(() => {
                        if (this.running) {
                            Synthesis.createGlassVibration(ctx, masterGain, 0.06, 1.5 + Math.random());
                        }
                    }, 200 + Math.random() * 300);
                    this.schedule();
                }, interval);
            }
        };
        thunderScheduler.start();
        cleanupFns.push(() => thunderScheduler.stop());

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // HEAT ZONE [0.9, 0.1]
    // August siesta - 3pm, everything closed
    // AC humming, fan, fridge cycling, distant filtered cicadas
    // ============================================

    function createHeatZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Air conditioning - constant low hum, the machine working
        const ac = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 300, 0.3);
        ac.gain.gain.value = 0.1;
        ac.connect(masterGain);
        ac.start();
        cleanupFns.push(() => { try { ac.stop(); } catch(e) {} });

        // AC compressor undertone
        const acCompressor = Synthesis.createMechanicalHum(ctx, 55, 0.3, 1);
        acCompressor.gain.gain.value = 0.04;
        acCompressor.connect(masterGain);
        acCompressor.start();
        cleanupFns.push(() => { try { acCompressor.stop(); } catch(e) {} });

        // 2. Ceiling fan or standing fan - slow rotation
        const fan = Synthesis.createMechanicalHum(ctx, 35, 0.8, 3);
        fan.gain.gain.value = 0.03;
        fan.connect(masterGain);
        fan.start();
        cleanupFns.push(() => { try { fan.stop(); } catch(e) {} });

        // 3. Fridge cycling - on/off every 30-60 seconds
        const fridge = Synthesis.createApplianceCycle(ctx, 90, 25, 45);
        fridge.connect(masterGain);
        fridge.start();
        cleanupFns.push(() => fridge.stop());

        // 4. Distant cicadas through closed window - very filtered
        const cicadas = Synthesis.createFilteredCicadas(ctx, 3);
        cicadas.gain.gain.value = 0.06;
        cicadas.connect(masterGain);
        cicadas.start();
        cleanupFns.push(() => cicadas.stop());

        // 5. Electrical hum undertone (50Hz mains)
        const mains = Synthesis.createDrone(ctx, 50, 0.015);
        mains.connect(masterGain);
        mains.start();
        cleanupFns.push(() => { try { mains.stop(); } catch(e) {} });

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // REFUGE ZONE [0.5, 0.5]
    // Interior that works - normalcy
    // Soft HVAC, room tone, subtle appliances
    // ============================================

    function createRefugeZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Ventilation - system working well, very subtle
        const vent = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 200, 0.2);
        vent.gain.gain.value = 0.04;
        vent.connect(masterGain);
        vent.start();
        cleanupFns.push(() => { try { vent.stop(); } catch(e) {} });

        // 2. Room tone - the sound of the room itself
        const roomTone = Synthesis.createRoomTone(ctx, 55, 0.025);
        roomTone.connect(masterGain);
        roomTone.start();
        cleanupFns.push(() => { try { roomTone.stop(); } catch(e) {} });

        // 3. Subtle electrical presence (fridge in distance, something humming)
        const electricalPresence = Synthesis.createDrone(ctx, 100, 0.012);
        electricalPresence.connect(masterGain);
        electricalPresence.start();
        cleanupFns.push(() => { try { electricalPresence.stop(); } catch(e) {} });

        // 4. Very occasional subtle sound - suggests normalcy without events
        // (Much less frequent than other zones - this is peace)
        const ambientScheduler = {
            timeout: null,
            running: false,
            start: function() {
                this.running = true;
                this.schedule();
            },
            stop: function() {
                this.running = false;
                if (this.timeout) clearTimeout(this.timeout);
            },
            schedule: function() {
                if (!this.running) return;
                const interval = (30 + Math.random() * 60) * 1000; // Very rare
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Tiny settling sound - building breathing
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 80 + Math.random() * 40;
                    g.gain.setValueAtTime(0, ctx.currentTime);
                    g.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.05);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
                    osc.connect(g);
                    g.connect(masterGain);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.25);
                    this.schedule();
                }, interval);
            }
        };
        ambientScheduler.start();
        cleanupFns.push(() => ambientScheduler.stop());

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // FLOOD ZONE [0.1, 0.9]
    // Water got inside - managing the situation
    // Bucket drip, pipes, sump pump, floating objects
    // ============================================

    function createFloodZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Drip into bucket - metallic reverb, semi-regular
        const bucketDrip = Synthesis.scheduleDripsWithReverb(ctx, masterGain, 0.8, 1.5, 'metal', 0.15);
        bucketDrip.start();
        cleanupFns.push(() => bucketDrip.stop());

        // 2. Water in pipes - constant low gurgle
        const pipes = Synthesis.createFilteredNoise(ctx, 'pink', 'bandpass', 400, 1.5);
        pipes.gain.gain.value = 0.08;
        pipes.connect(masterGain);
        pipes.start();
        cleanupFns.push(() => { try { pipes.stop(); } catch(e) {} });

        // Add slow modulation to pipe sound
        const pipeLfo = ctx.createOscillator();
        const pipeLfoGain = ctx.createGain();
        pipeLfo.type = 'sine';
        pipeLfo.frequency.value = 0.15;
        pipeLfoGain.gain.value = 0.03;
        pipeLfo.connect(pipeLfoGain);
        pipeLfoGain.connect(pipes.gain.gain);
        pipeLfo.start();
        cleanupFns.push(() => { try { pipeLfo.stop(); } catch(e) {} });

        // 3. Sump pump / bilge pump - cycles on and off
        const pump = Synthesis.createApplianceCycle(ctx, 80, 20, 40);
        pump.connect(masterGain);
        pump.start();
        cleanupFns.push(() => pump.stop());

        // Pump vibration when running
        const pumpVibration = Synthesis.createMechanicalHum(ctx, 45, 2, 5);
        pumpVibration.gain.gain.value = 0.04;
        pumpVibration.connect(masterGain);
        pumpVibration.start();
        cleanupFns.push(() => { try { pumpVibration.stop(); } catch(e) {} });

        // 4. Floating objects bumping - occasional soft thuds
        const floatingScheduler = {
            timeout: null,
            running: false,
            start: function() {
                this.running = true;
                this.schedule();
            },
            stop: function() {
                this.running = false;
                if (this.timeout) clearTimeout(this.timeout);
            },
            schedule: function() {
                if (!this.running) return;
                const interval = (8 + Math.random() * 20) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Soft thud - object hitting wall or furniture
                    Synthesis.createNoiseBurst(ctx, masterGain, 120 + Math.random() * 80, 0.15, 6);
                    this.schedule();
                }, interval);
            }
        };
        floatingScheduler.start();
        cleanupFns.push(() => floatingScheduler.stop());

        // 5. Occasional splash/movement in water
        const splashScheduler = {
            timeout: null,
            running: false,
            start: function() {
                this.running = true;
                this.schedule();
            },
            stop: function() {
                this.running = false;
                if (this.timeout) clearTimeout(this.timeout);
            },
            schedule: function() {
                if (!this.running) return;
                const interval = (4 + Math.random() * 8) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Small splash
                    const splashBuf = Synthesis.createWhiteNoiseBuffer(ctx, 0.1);
                    const splash = ctx.createBufferSource();
                    splash.buffer = splashBuf;
                    const splashFilter = ctx.createBiquadFilter();
                    splashFilter.type = 'bandpass';
                    splashFilter.frequency.value = 500 + Math.random() * 300;
                    splashFilter.Q.value = 0.8;
                    const splashGain = ctx.createGain();
                    const now = ctx.currentTime;
                    splashGain.gain.setValueAtTime(0, now);
                    splashGain.gain.linearRampToValueAtTime(0.08, now + 0.01);
                    splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    splash.connect(splashFilter);
                    splashFilter.connect(splashGain);
                    splashGain.connect(masterGain);
                    splash.start();
                    this.schedule();
                }, interval);
            }
        };
        splashScheduler.start();
        cleanupFns.push(() => splashScheduler.stop());

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // DROUGHT ZONE [0.9, 0.9]
    // Months without rain - everything dry
    // Wind on blinds, dust on glass, dripping faucet, wood creaking
    // ============================================

    function createDroughtZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Dry wind on blinds/shutters - highpass filtered
        const wind = Synthesis.createWind(ctx, 1000, 0.06, 0.15);
        wind.gain.gain.value = 0.08;
        wind.connect(masterGain);
        wind.start();
        cleanupFns.push(() => { try { wind.stop(); } catch(e) {} });

        // 2. Dust/sand particles on glass - very fine granular
        const dust = Synthesis.createFilteredNoise(ctx, 'white', 'highpass', 4000, 0.5);
        dust.gain.gain.value = 0.015;
        dust.connect(masterGain);
        dust.start();
        cleanupFns.push(() => { try { dust.stop(); } catch(e) {} });

        // Intermittent dust gusts
        const dustLfo = ctx.createOscillator();
        const dustLfoGain = ctx.createGain();
        dustLfo.type = 'sine';
        dustLfo.frequency.value = 0.03;
        dustLfoGain.gain.value = 0.01;
        dustLfo.connect(dustLfoGain);
        dustLfoGain.connect(dust.gain.gain);
        dustLfo.start();
        cleanupFns.push(() => { try { dustLfo.stop(); } catch(e) {} });

        // 3. Dripping faucet - inside there's still water (for now)
        const faucet = Synthesis.scheduleDripsWithReverb(ctx, masterGain, 4, 8, 'tile', 0.1);
        faucet.start();
        cleanupFns.push(() => faucet.stop());

        // 4. Wood/material creaking - dryness contracts materials
        const creaks = Synthesis.scheduleCreaks(ctx, masterGain, 20, 45, 0.08);
        creaks.start();
        cleanupFns.push(() => creaks.stop());

        // 5. Silence base - very sparse, empty feeling
        // Just a subtle room presence
        const roomPresence = Synthesis.createRoomTone(ctx, 70, 0.015);
        roomPresence.connect(masterGain);
        roomPresence.start();
        cleanupFns.push(() => { try { roomPresence.stop(); } catch(e) {} });

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // ZONE SOURCES ARRAY
    // ============================================

    const ZONE_SOURCES = [
        {
            name: 'storm',
            x: 0.1,
            y: 0.1,
            create: createStormZone,
            color: { r: 51, g: 43, b: 48 }  // #332b30 blue-ish
        },
        {
            name: 'heat',
            x: 0.9,
            y: 0.1,
            create: createHeatZone,
            color: { r: 58, g: 43, b: 40 }  // #3a2b28 red-ish
        },
        {
            name: 'refuge',
            x: 0.5,
            y: 0.5,
            create: createRefugeZone,
            color: { r: 51, g: 43, b: 40 }  // #332b28 neutral
        },
        {
            name: 'flood',
            x: 0.1,
            y: 0.9,
            create: createFloodZone,
            color: { r: 43, g: 50, b: 48 }  // #2b3230 green-ish
        },
        {
            name: 'drought',
            x: 0.9,
            y: 0.9,
            create: createDroughtZone,
            color: { r: 56, g: 50, b: 43 }  // #38322b yellow-ish
        }
    ];

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        createStormZone,
        createHeatZone,
        createRefugeZone,
        createFloodZone,
        createDroughtZone,
        ZONE_SOURCES
    };
})();
