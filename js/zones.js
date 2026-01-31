// ============================================
// DWELL:REFUGE - Zone Definitions
// Future mundane: domestic sounds under climate stress
// Optimized for production
// ============================================

const Zones = (function() {
    'use strict';

    // ============================================
    // STORM ZONE [0.1, 0.1]
    // Being inside during the storm
    // Balance: Rain 60%, Leak 25%, Events 15%
    // Timbre: Bandpass noise (800-3000Hz) - "shhh" character
    // ============================================

    function createStormZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Rain on window - PINK noise, bandpass for "shhh" character (60%)
        const rainOnGlass = Synthesis.createFilteredNoise(ctx, 'pink', 'bandpass', 1800, 1.2);
        rainOnGlass.gain.gain.value = 0.18;  // Primary layer
        rainOnGlass.connect(masterGain);
        rainOnGlass.start();
        cleanupFns.push(() => { try { rainOnGlass.stop(); } catch(e) {} });

        // Rain intensity modulation (gusts)
        const rainLfo = ctx.createOscillator();
        const rainLfoGain = ctx.createGain();
        rainLfo.type = 'sine';
        rainLfo.frequency.value = 0.06;  // Slower gusts
        rainLfoGain.gain.value = 0.05;
        rainLfo.connect(rainLfoGain);
        rainLfoGain.connect(rainOnGlass.gain.gain);
        rainLfo.start();
        cleanupFns.push(() => { try { rainLfo.stop(); } catch(e) {} });

        // 2. Interior leak - distinctive drip (25%)
        // Semi-regular 2-4 seconds (like a real leak)
        const leak = Synthesis.scheduleDripsWithReverb(ctx, masterGain, 2, 4, 'room', 0.15);
        leak.start();
        cleanupFns.push(() => leak.stop());

        // 3. Blind rattling - 8-20 seconds (wind gusts) (10%)
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
                const interval = (8 + Math.random() * 12) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    Synthesis.createNoiseBurst(ctx, masterGain, 180 + Math.random() * 80, 0.06, 10);
                    this.schedule();
                }, interval);
            }
        };
        blindScheduler.start();
        cleanupFns.push(() => blindScheduler.stop());

        // 4. Thunder + glass vibration - 15-45 seconds (5%)
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
                const interval = (15 + Math.random() * 30) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Distant thunder
                    Synthesis.createNoiseBurst(ctx, masterGain, 60 + Math.random() * 40, 2, 0.6);
                    // Glass vibration after thunder
                    setTimeout(() => {
                        if (this.running) {
                            Synthesis.createGlassVibration(ctx, masterGain, 0.04, 1.2 + Math.random() * 0.8);
                        }
                    }, 150 + Math.random() * 250);
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
    // Balance: AC 50%, Fridge 30%, Cicadas 15%, Fan 5%
    // Timbre: Brown/red noise lowpass 200Hz - "mmmmm" character
    // ============================================

    function createHeatZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Air conditioning - BROWN/low noise character (50%)
        const ac = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 180, 0.5);
        ac.gain.gain.value = 0.14;  // Primary constant layer
        ac.connect(masterGain);
        ac.start();
        cleanupFns.push(() => { try { ac.stop(); } catch(e) {} });

        // AC compressor undertone
        const acCompressor = Synthesis.createMechanicalHum(ctx, 50, 0.2, 0.8);
        acCompressor.gain.gain.value = 0.05;
        acCompressor.connect(masterGain);
        acCompressor.start();
        cleanupFns.push(() => { try { acCompressor.stop(); } catch(e) {} });

        // 2. Fridge cycling - distinctive event (30%)
        // On: 40-90s, Off: 60-120s
        const fridge = Synthesis.createApplianceCycle(ctx, 85, 40, 90);
        fridge.connect(masterGain);
        fridge.start();
        cleanupFns.push(() => fridge.stop());

        // 3. Distant cicadas through window (15%)
        const cicadas = Synthesis.createFilteredCicadas(ctx, 3);
        cicadas.gain.gain.value = 0.05;
        cicadas.connect(masterGain);
        cicadas.start();
        cleanupFns.push(() => cicadas.stop());

        // 4. Ceiling fan - barely perceptible (5%)
        const fan = Synthesis.createMechanicalHum(ctx, 32, 1.2, 2);
        fan.gain.gain.value = 0.015;
        fan.connect(masterGain);
        fan.start();
        cleanupFns.push(() => { try { fan.stop(); } catch(e) {} });

        // 5. Mains hum - subliminal
        const mains = Synthesis.createDrone(ctx, 50, 0.01);
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
    // Balance: Room tone 60%, Vent 30%, Electrical 10%
    // Timbre: Pure sine 60Hz + very low brown noise
    // ============================================

    function createRefugeZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Room tone - fundamental presence (60%)
        const roomTone = Synthesis.createRoomTone(ctx, 55, 0.035);
        roomTone.connect(masterGain);
        roomTone.start();
        cleanupFns.push(() => { try { roomTone.stop(); } catch(e) {} });

        // 2. Ventilation - very filtered, steady (30%)
        const vent = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 150, 0.3);
        vent.gain.gain.value = 0.025;
        vent.connect(masterGain);
        vent.start();
        cleanupFns.push(() => { try { vent.stop(); } catch(e) {} });

        // 3. Subtle electrical presence (10%)
        const electricalPresence = Synthesis.createDrone(ctx, 100, 0.008);
        electricalPresence.connect(masterGain);
        electricalPresence.start();
        cleanupFns.push(() => { try { electricalPresence.stop(); } catch(e) {} });

        // 4. Very rare settling sounds - building breathing (45-120s)
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
                const interval = (45 + Math.random() * 75) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 70 + Math.random() * 30;
                    g.gain.setValueAtTime(0, ctx.currentTime);
                    g.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 0.05);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                    osc.connect(g);
                    g.connect(masterGain);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.2);
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
    // Balance: Pipes 40%, Bucket 30%, Pump 20%, Events 10%
    // Timbre: Pink bandpass 200-800Hz - "glugluglu" character
    // ============================================

    function createFloodZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Water in pipes - constant gurgle (40%)
        const pipes = Synthesis.createFilteredNoise(ctx, 'pink', 'bandpass', 350, 2);
        pipes.gain.gain.value = 0.1;
        pipes.connect(masterGain);
        pipes.start();
        cleanupFns.push(() => { try { pipes.stop(); } catch(e) {} });

        // Pipe modulation - irregular flow
        const pipeLfo = ctx.createOscillator();
        const pipeLfoGain = ctx.createGain();
        pipeLfo.type = 'sine';
        pipeLfo.frequency.value = 0.12;
        pipeLfoGain.gain.value = 0.035;
        pipeLfo.connect(pipeLfoGain);
        pipeLfoGain.connect(pipes.gain.gain);
        pipeLfo.start();
        cleanupFns.push(() => { try { pipeLfo.stop(); } catch(e) {} });

        // 2. Drip into bucket - metallic, distinctive (30%)
        // 1.5-3 seconds (faster, urgent)
        const bucketDrip = Synthesis.scheduleDripsWithReverb(ctx, masterGain, 1.5, 3, 'metal', 0.18);
        bucketDrip.start();
        cleanupFns.push(() => bucketDrip.stop());

        // 3. Sump pump cycling (20%)
        // On: 20-40s, Off: 30-60s
        const pump = Synthesis.createApplianceCycle(ctx, 75, 20, 35);
        pump.connect(masterGain);
        pump.start();
        cleanupFns.push(() => pump.stop());

        // Pump vibration
        const pumpVibration = Synthesis.createMechanicalHum(ctx, 42, 2.5, 4);
        pumpVibration.gain.gain.value = 0.03;
        pumpVibration.connect(masterGain);
        pumpVibration.start();
        cleanupFns.push(() => { try { pumpVibration.stop(); } catch(e) {} });

        // 4. Floating objects - 15-45 seconds (7%)
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
                const interval = (15 + Math.random() * 30) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    Synthesis.createNoiseBurst(ctx, masterGain, 100 + Math.random() * 60, 0.12, 7);
                    this.schedule();
                }, interval);
            }
        };
        floatingScheduler.start();
        cleanupFns.push(() => floatingScheduler.stop());

        // 5. Splashes - 5-12 seconds (3%)
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
                const interval = (5 + Math.random() * 7) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    const splashBuf = Synthesis.createWhiteNoiseBuffer(ctx, 0.08);
                    const splash = ctx.createBufferSource();
                    splash.buffer = splashBuf;
                    const splashFilter = ctx.createBiquadFilter();
                    splashFilter.type = 'bandpass';
                    splashFilter.frequency.value = 400 + Math.random() * 200;
                    splashFilter.Q.value = 1;
                    const splashGain = ctx.createGain();
                    const now = ctx.currentTime;
                    splashGain.gain.setValueAtTime(0, now);
                    splashGain.gain.linearRampToValueAtTime(0.06, now + 0.008);
                    splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
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
    // Balance: Wind 50%, Dust 20%, Faucet 20%, Creaks 10%
    // Timbre: White highpass 1000Hz+ - "ssssss" harsh character
    // ============================================

    function createDroughtZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Dry wind - harsh high character (50%)
        const wind = Synthesis.createWind(ctx, 1200, 0.05, 0.12);
        wind.gain.gain.value = 0.1;
        wind.connect(masterGain);
        wind.start();
        cleanupFns.push(() => { try { wind.stop(); } catch(e) {} });

        // 2. Dust particles - very fine texture (20%)
        const dust = Synthesis.createFilteredNoise(ctx, 'white', 'highpass', 5000, 0.4);
        dust.gain.gain.value = 0.012;
        dust.connect(masterGain);
        dust.start();
        cleanupFns.push(() => { try { dust.stop(); } catch(e) {} });

        // Dust gusts
        const dustLfo = ctx.createOscillator();
        const dustLfoGain = ctx.createGain();
        dustLfo.type = 'sine';
        dustLfo.frequency.value = 0.025;
        dustLfoGain.gain.value = 0.006;
        dustLfo.connect(dustLfoGain);
        dustLfoGain.connect(dust.gain.gain);
        dustLfo.start();
        cleanupFns.push(() => { try { dustLfo.stop(); } catch(e) {} });

        // 3. Dripping faucet - 5-10 seconds (scarcity) (20%)
        const faucet = Synthesis.scheduleDripsWithReverb(ctx, masterGain, 5, 10, 'tile', 0.12);
        faucet.start();
        cleanupFns.push(() => faucet.stop());

        // 4. Wood creaking - 25-60 seconds (10%)
        const creaks = Synthesis.scheduleCreaks(ctx, masterGain, 25, 60, 0.06);
        creaks.start();
        cleanupFns.push(() => creaks.stop());

        // 5. Sparse room presence
        const roomPresence = Synthesis.createRoomTone(ctx, 65, 0.01);
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
