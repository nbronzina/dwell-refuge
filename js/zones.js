// ============================================
// DWELL:REFUGE - Zone Definitions
// 5 climate zones: storm, heat, refuge, flood, drought
// ============================================

const Zones = (function() {
    'use strict';

    // ============================================
    // STORM ZONE [0.1, 0.1] - Electrical Storm
    // Chaotic, enveloping, threatening
    // ============================================

    function createStormZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Heavy rain - dense pink noise with lowpass
        const rain = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 2000, 0.5);
        rain.gain.gain.value = 0.25;
        rain.connect(masterGain);
        rain.start();
        cleanupFns.push(() => { try { rain.stop(); } catch(e) {} });

        // 2. Individual drops - bursts at 5-15 per second
        const drips = Synthesis.scheduleDrips(ctx, masterGain, 0.07, 0.2, 800, 1200, 0.1);
        drips.start();
        cleanupFns.push(() => drips.stop());

        // 3. Distant thunder - low freq bursts with long decay
        const thunder = Synthesis.scheduleBursts(ctx, masterGain, 8, 20, 50, 150, 0.8, 0.5, 0.5);
        thunder.start();
        cleanupFns.push(() => thunder.stop());

        // 4. Wind gusts - white noise with LFO
        const wind = Synthesis.createWind(ctx, 600, 0.15, 0.25);
        wind.gain.gain.value = 0.15;
        wind.connect(masterGain);
        wind.start();
        cleanupFns.push(() => { try { wind.stop(); } catch(e) {} });

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // HEAT ZONE [0.9, 0.1] - Heat Wave
    // Oppressive, static, exhausting
    // ============================================

    function createHeatZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Aggressive cicadas - AM synthesis
        const cicadas = Synthesis.createInsectChorus(ctx, 10, 4000, 8000);
        cicadas.gain.gain.value = 0.4;
        cicadas.connect(masterGain);
        cicadas.start();
        cleanupFns.push(() => cicadas.stop());

        // 2. Electrical hum (50/60Hz mains frequency)
        const hum = Synthesis.createDrone(ctx, 60, 0.03);
        hum.connect(masterGain);
        hum.start();
        cleanupFns.push(() => { try { hum.stop(); } catch(e) {} });

        // Second harmonic
        const hum2 = Synthesis.createDrone(ctx, 120, 0.015);
        hum2.connect(masterGain);
        hum2.start();
        cleanupFns.push(() => { try { hum2.stop(); } catch(e) {} });

        // 3. Metal expanding - rare high-freq clicks
        const metalClicks = Synthesis.scheduleDrips(ctx, masterGain, 10, 30, 3000, 6000, 0.08);
        metalClicks.start();
        cleanupFns.push(() => metalClicks.stop());

        // 4. Tense silence base - very subtle high-freq noise
        const tension = Synthesis.createFilteredNoise(ctx, 'white', 'highpass', 6000, 0.3);
        tension.gain.gain.value = 0.02;
        tension.connect(masterGain);
        tension.start();
        cleanupFns.push(() => { try { tension.stop(); } catch(e) {} });

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // REFUGE ZONE [0.5, 0.5] - Interior Shelter
    // Calm, protected, breathable
    // ============================================

    function createRefugeZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Soft ventilation - very filtered pink noise
        const vent = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 400, 0.3);
        vent.gain.gain.value = 0.08;
        vent.connect(masterGain);
        vent.start();
        cleanupFns.push(() => { try { vent.stop(); } catch(e) {} });

        // 2. Room tone - subliminal drone
        const roomTone = Synthesis.createRoomTone(ctx, 60, 0.04);
        roomTone.connect(masterGain);
        roomTone.start();
        cleanupFns.push(() => { try { roomTone.stop(); } catch(e) {} });

        // 3. Very subtle presence - almost imperceptible breathing
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const presenceGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = 80;
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // Very slow breathing
        lfoGain.gain.value = 0.02;

        filter.type = 'lowpass';
        filter.frequency.value = 200;

        presenceGain.gain.value = 0.03;

        lfo.connect(lfoGain);
        lfoGain.connect(presenceGain.gain);
        osc.connect(filter);
        filter.connect(presenceGain);
        presenceGain.connect(masterGain);

        osc.start();
        lfo.start();
        cleanupFns.push(() => {
            try { osc.stop(); } catch(e) {}
            try { lfo.stop(); } catch(e) {}
        });

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // FLOOD ZONE [0.1, 0.9] - Rising Water
    // Enveloping, humid, claustrophobic
    // ============================================

    function createFloodZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Running water - bandpass filtered noise with slow modulation
        const waterBuffer = Synthesis.createPinkNoiseBuffer(ctx, 4);
        const water = ctx.createBufferSource();
        water.buffer = waterBuffer;
        water.loop = true;

        const waterFilter = ctx.createBiquadFilter();
        waterFilter.type = 'bandpass';
        waterFilter.frequency.value = 500;
        waterFilter.Q.value = 0.8;

        // Slow modulation on filter
        const waterLfo = ctx.createOscillator();
        const waterLfoGain = ctx.createGain();
        waterLfo.type = 'sine';
        waterLfo.frequency.value = 0.05;
        waterLfoGain.gain.value = 200;
        waterLfo.connect(waterLfoGain);
        waterLfoGain.connect(waterFilter.frequency);

        const waterGain = ctx.createGain();
        waterGain.gain.value = 0.2;

        water.connect(waterFilter);
        waterFilter.connect(waterGain);
        waterGain.connect(masterGain);
        water.start();
        waterLfo.start();

        cleanupFns.push(() => {
            try { water.stop(); } catch(e) {}
            try { waterLfo.stop(); } catch(e) {}
        });

        // 2. Constant dripping - irregular 2-5 per second
        const drips = Synthesis.scheduleDrips(ctx, masterGain, 0.2, 0.5, 600, 1000, 0.12);
        drips.start();
        cleanupFns.push(() => drips.stop());

        // 3. Splashing - random bursts of filtered noise
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
                const interval = (2 + Math.random() * 5) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Create splash
                    const splashBuf = Synthesis.createWhiteNoiseBuffer(ctx, 0.15);
                    const splash = ctx.createBufferSource();
                    splash.buffer = splashBuf;

                    const splashFilter = ctx.createBiquadFilter();
                    splashFilter.type = 'bandpass';
                    splashFilter.frequency.value = 300 + Math.random() * 300;
                    splashFilter.Q.value = 1;

                    const splashGain = ctx.createGain();
                    const now = ctx.currentTime;
                    splashGain.gain.setValueAtTime(0, now);
                    splashGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
                    splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

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

        // 4. Floating objects - occasional low thuds
        const thuds = Synthesis.scheduleBursts(ctx, masterGain, 15, 40, 80, 200, 0.2, 4, 0.2);
        thuds.start();
        cleanupFns.push(() => thuds.stop());

        return {
            gainNode: masterGain,
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // DROUGHT ZONE [0.9, 0.9] - Dry Wind
    // Harsh, dry, empty
    // ============================================

    function createDroughtZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(destination);

        const cleanupFns = [];

        // 1. Constant dry wind - highpass filtered noise
        const wind = Synthesis.createWind(ctx, 800, 0.08, 0.2);
        wind.gain.gain.value = 0.2;
        wind.connect(masterGain);
        wind.start();
        cleanupFns.push(() => { try { wind.stop(); } catch(e) {} });

        // 2. Dry grass/branches - granular high-freq bursts
        const grassScheduler = {
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
                const interval = (0.1 + Math.random() * 0.4) * 1000;
                this.timeout = setTimeout(() => {
                    if (!this.running) return;
                    // Create crackle
                    const crackleBuf = Synthesis.createWhiteNoiseBuffer(ctx, 0.02);
                    const crackle = ctx.createBufferSource();
                    crackle.buffer = crackleBuf;

                    const crackleFilter = ctx.createBiquadFilter();
                    crackleFilter.type = 'highpass';
                    crackleFilter.frequency.value = 3000 + Math.random() * 2000;

                    const crackleGain = ctx.createGain();
                    const now = ctx.currentTime;
                    crackleGain.gain.setValueAtTime(0.05 + Math.random() * 0.05, now);
                    crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

                    crackle.connect(crackleFilter);
                    crackleFilter.connect(crackleGain);
                    crackleGain.connect(masterGain);
                    crackle.start();

                    this.schedule();
                }, interval);
            }
        };
        grassScheduler.start();
        cleanupFns.push(() => grassScheduler.stop());

        // 3. Sand/dust - very filtered high-freq noise layer
        const dust = Synthesis.createFilteredNoise(ctx, 'white', 'highpass', 4000, 0.5);
        dust.gain.gain.value = 0.04;
        dust.connect(masterGain);
        dust.start();
        cleanupFns.push(() => { try { dust.stop(); } catch(e) {} });

        // 4. Cracks - occasional low clicks (earth/wood cracking)
        const cracks = Synthesis.scheduleBursts(ctx, masterGain, 20, 60, 100, 300, 0.1, 8, 0.15);
        cracks.start();
        cleanupFns.push(() => cracks.stop());

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
            color: { r: 10, g: 10, b: 16 } // Blue-ish dark
        },
        {
            name: 'heat',
            x: 0.9,
            y: 0.1,
            create: createHeatZone,
            color: { r: 16, g: 10, b: 10 } // Orange-ish dark
        },
        {
            name: 'refuge',
            x: 0.5,
            y: 0.5,
            create: createRefugeZone,
            color: { r: 12, g: 12, b: 12 } // Neutral gray
        },
        {
            name: 'flood',
            x: 0.1,
            y: 0.9,
            create: createFloodZone,
            color: { r: 10, g: 15, b: 16 } // Teal-ish dark
        },
        {
            name: 'drought',
            x: 0.9,
            y: 0.9,
            create: createDroughtZone,
            color: { r: 15, g: 13, b: 10 } // Brown-ish dark
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
