// ============================================
// DWELL:REFUGE - Zone Definitions
// Future mundane: domestic sounds under climate stress
//
// Each zone is a room. Its elements sit at fixed spots in the
// stereo field (the rain at the window, the drip in the corner),
// and the mix shifts as the listener moves within the zone -
// approach the window and the rain comes forward.
// ============================================

const Zones = (function() {
    'use strict';

    // Notify the UI layer about audible events (for visual pulses)
    function dispatchZoneEvent(type) {
        document.dispatchEvent(new CustomEvent('refuge:event', { detail: { type: type } }));
    }

    function clamp(v, lo, hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    // Harmonic ecology: each zone owns a just-intonation chord over
    // the 50Hz mains-hum tonic; pitched events snap to chord tones
    const CHORDS = {
        storm:   Synthesis.buildChordTable([1, 6/5, 3/2]),   // minor triad
        heat:    Synthesis.buildChordTable([1, 5/4, 3/2]),   // major triad
        refuge:  Synthesis.buildChordTable([1, 3/2, 2]),     // open fifth
        flood:   Synthesis.buildChordTable([1, 4/3, 3/2]),   // sus4
        drought: Synthesis.buildChordTable([1, 9/8, 3/2])    // sus2
    };

    /**
     * Virtualization guard: every zone's schedulers run all the
     * time (the world keeps existing), but salient one-shots that
     * nobody can hear should cost nothing - and must not fire
     * their visual events. The engine drives masterGain; reading
     * it tells the zone whether it is currently audible.
     */
    function makeAudible(masterGain) {
        return () => masterGain.gain.value > 0.005;
    }

    /**
     * Feed-forward ducking: when a salient one-shot fires, the
     * zone's continuous beds step back 2-4dB and recover slowly -
     * the room makes space for the event
     */
    function makeDucker(ctx) {
        const beds = [];
        return {
            register: (param, base) => beds.push({ param: param, base: base }),
            duck: (db) => {
                const f = Math.pow(10, -(db || 3) / 20);
                const now = ctx.currentTime;
                beds.forEach(b => {
                    b.param.setTargetAtTime(b.base * f, now, 0.15);
                    b.param.setTargetAtTime(b.base, now + 0.9, 1.2);
                });
            }
        };
    }

    /**
     * An element bus: a gain (for proximity mixing) feeding a fixed
     * stereo position. Connect an element to the returned gain node;
     * adjust .gain to bring the element closer or further.
     */
    function createBus(ctx, destination, pan) {
        const g = ctx.createGain();
        g.gain.value = 1;
        if (pan && ctx.createStereoPanner) {
            const p = ctx.createStereoPanner();
            p.pan.value = pan;
            g.connect(p);
            p.connect(destination);
        } else {
            g.connect(destination);
        }
        return g;
    }

    /**
     * One-shot random placement: returns a destination panned to a
     * random spot within ±spread, self-detaching after lifeMs
     */
    function randomSpot(ctx, destination, spread, lifeMs) {
        if (!ctx.createStereoPanner) return destination;
        const p = ctx.createStereoPanner();
        p.pan.value = (Math.random() * 2 - 1) * spread;
        p.connect(destination);
        setTimeout(() => { try { p.disconnect(); } catch(e) {} }, lifeMs);
        return p;
    }

    // ============================================
    // STORM ZONE [0.1, 0.1]
    // Being inside during the storm
    // Balance: Rain 60%, Leak 25%, Events 15%
    // Room: window up-left, leak deeper in, down-right
    // ============================================

    function createStormZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        // Zone-specific reverb
        const zoneReverb = Synthesis.createZoneReverb(ctx, 'storm');
        masterGain.connect(zoneReverb.input);
        zoneReverb.connect(destination);

        const cleanupFns = [];
        let disposed = false;
        cleanupFns.push(() => { disposed = true; });
        const ducker = makeDucker(ctx);
        const audible = makeAudible(masterGain);

        // Element placement
        const rainBus = createBus(ctx, masterGain, -0.4);    // the window, left
        const blindsBus = createBus(ctx, masterGain, -0.6);  // blinds by the window
        const leakBus = createBus(ctx, masterGain, 0.5);     // leak, right, deeper in
        const outsideBus = createBus(ctx, masterGain, 0);    // thunder, everywhere

        // 1. Rain on window (60%): field recording when available,
        // synthesized wash + individual droplets otherwise
        if (Samples.has('rain-window')) {
            const rain = Samples.createLoop(ctx, 'rain-window');
            rain.gain.gain.value = 0.18;
            rain.connect(rainBus);
            rain.start();
            cleanupFns.push(() => rain.stop());
            ducker.register(rain.gain.gain, 0.18);
        } else {
            const rainOnGlass = Synthesis.createFilteredNoise(ctx, 'pink', 'bandpass', 1800, 1.2);
            rainOnGlass.gain.gain.value = 0.18;
            rainOnGlass.connect(rainBus);
            rainOnGlass.start();
            cleanupFns.push(() => { try { rainOnGlass.stop(); } catch(e) {} });
            ducker.register(rainOnGlass.gain.gain, 0.18);

            // Rain intensity modulation (gusts)
            const rainLfo = ctx.createOscillator();
            const rainLfoGain = ctx.createGain();
            rainLfo.type = 'sine';
            rainLfo.frequency.value = 0.06;
            rainLfoGain.gain.value = 0.05;
            rainLfo.connect(rainLfoGain);
            rainLfoGain.connect(rainOnGlass.gain.gain);
            rainLfo.start();
            cleanupFns.push(() => { try { rainLfo.stop(); } catch(e) {} });

            // Individual raindrops across the glass
            const patter = Synthesis.createRainPatter(ctx, rainBus, 7, 0.04);
            patter.start();
            cleanupFns.push(() => patter.stop());
        }

        // 2. Interior leak - distinctive drip, semi-regular 2-4s,
        // tuned to the zone's chord, timed by authored series
        // (coprime lengths phase against each other) (25%)
        const leak = Synthesis.scheduleDripsWithReverb(ctx, leakBus, 2, 4, 'room', 0.15, {
            table: CHORDS.storm,
            intervalSeries: Synthesis.createSeries([0.2, 0.7, 0.4, 0.9, 0.1]),
            pitchSeries: Synthesis.createSeries([0.1, 0.6, 0.3, 0.8, 0.5, 0.9, 0.2]),
            restChance: 0.12, restMin: 25, restMax: 50
        });
        leak.start();
        cleanupFns.push(() => leak.stop());

        // 3. Blind rattling - 8-20 seconds (wind gusts) (10%)
        const blindScheduler = Synthesis.createScheduler(8, 20, () => {
            if (!audible()) return;
            Synthesis.createNoiseBurst(ctx, blindsBus, 180 + Math.random() * 80, 0.06, 10);
        });
        blindScheduler.start();
        cleanupFns.push(() => blindScheduler.stop());

        // 4. Thunder + glass vibration - 15-45 seconds (5%)
        function thunderEvent() {
            if (disposed) return;
            // Inaudible storms flash no lightning and cost no CPU
            if (!audible()) return;
            // The room makes space for the thunder
            ducker.duck(3.5);
            // Real thunder recording if present, synthesized otherwise
            if (!Samples.playOneShot(ctx, 'thunder', outsideBus, 0.5)) {
                Synthesis.createThunder(ctx, outsideBus, 0.5);
            }
            dispatchZoneEvent('thunder');
            // The window answers the thunder
            setTimeout(() => {
                if (disposed) return;
                Synthesis.createGlassVibration(ctx, rainBus, 0.04, 1.2 + Math.random() * 0.8);
                dispatchZoneEvent('glass');
            }, 150 + Math.random() * 250);
        }

        const thunderScheduler = Synthesis.createScheduler(15, 45, thunderEvent);
        thunderScheduler.start();
        cleanupFns.push(() => thunderScheduler.stop());

        // Moving up-left approaches the window; down-right goes
        // deeper into the room, toward the leak
        function setProximity(dx, dy) {
            const toWindow = clamp(-(dx + dy) * 0.5, -1, 1);
            const now = ctx.currentTime;
            rainBus.gain.setTargetAtTime(1 + toWindow * 0.3, now, 0.25);
            blindsBus.gain.setTargetAtTime(1 + toWindow * 0.3, now, 0.25);
            leakBus.gain.setTargetAtTime(1 - toWindow * 0.35, now, 0.25);
        }

        // Maintenance: now and then, tape smoothed onto the window
        // frame - someone keeps tending the seal
        const maintenance = Synthesis.createScheduler(150, 300, () => {
            if (!audible()) return;
            Synthesis.createTapeSmooth(ctx, rainBus, 0.03);
        });
        maintenance.start();
        cleanupFns.push(() => maintenance.stop());

        // Intruder: rarely, a siren far off through the rain -
        // rationed, likelier as the storm intensifies
        let stressLevel = 0;
        const intruder = Synthesis.createScheduler(240, 420, () => {
            if (!audible() || Math.random() > 0.25 + stressLevel * 0.5) return;
            Synthesis.createSiren(ctx, outsideBus, 0.03);
        });
        intruder.start();
        cleanupFns.push(() => intruder.stop());

        // Stress: the storm tightens - leak drips faster, blinds
        // rattle more often (loudness is handled by evolution gain)
        function setStress(s) {
            stressLevel = s;
            leak.setRate(1 + s * 0.8);
            blindScheduler.setRate(1 + s * 0.5);
        }

        return {
            gainNode: masterGain,
            reverb: zoneReverb,
            trigger: thunderEvent,
            setProximity: setProximity,
            setStress: setStress,
            scoreMoment: () => Synthesis.createScoreMoment(ctx, masterGain, CHORDS.storm),
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // HEAT ZONE [0.9, 0.1]
    // The night of heat - too hot to sleep, everything closed,
    // the machines running against it
    // Balance: AC 50%, Fridge 30%, Night insects 15%, Fan 5%
    // Room: AC unit left, kitchen right, window behind, fan above
    // ============================================

    function createHeatZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        // Zone-specific reverb
        const zoneReverb = Synthesis.createZoneReverb(ctx, 'heat');
        masterGain.connect(zoneReverb.input);
        zoneReverb.connect(destination);

        const cleanupFns = [];
        const audible = makeAudible(masterGain);

        // Element placement
        const acBus = createBus(ctx, masterGain, -0.5);      // AC unit, left
        const kitchenBus = createBus(ctx, masterGain, 0.6);  // fridge, right
        const windowBus = createBus(ctx, masterGain, -0.3);  // cicadas outside
        const overheadBus = createBus(ctx, masterGain, 0);   // ceiling fan

        // 1. Air conditioning - low constant wash (50%)
        const ac = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 180, 0.5);
        ac.gain.gain.value = 0.14;
        ac.connect(acBus);
        ac.start();
        cleanupFns.push(() => { try { ac.stop(); } catch(e) {} });

        // AC compressor undertone
        const acCompressor = Synthesis.createMechanicalHum(ctx, 50, 0.2, 0.8);
        acCompressor.gain.gain.value = 0.05;
        acCompressor.connect(acBus);
        acCompressor.start();
        cleanupFns.push(() => { try { acCompressor.stop(); } catch(e) {} });

        // 2. Fridge cycling - distinctive event (30%)
        // Tuned to 75Hz: a just fifth over the 50Hz mains tonic
        const fridge = Synthesis.createApplianceCycle(ctx, 75, 40, 90);
        fridge.connect(kitchenBus);
        fridge.start();
        cleanupFns.push(() => fridge.stop());

        // 3. Night insects through the window (15%)
        // The crickets recording is exactly right for a sleepless
        // hot night; real insects beat AM synthesis
        let cicadas;
        if (Samples.has('cicadas')) {
            cicadas = Samples.createLoop(ctx, 'cicadas');
            // Heard through closed glass: cut the highs. Real insect
            // choruses live at 4kHz+, so the cutoff sits higher than
            // the synth path or they'd vanish entirely
            const glassFilter = ctx.createBiquadFilter();
            glassFilter.type = 'lowpass';
            glassFilter.frequency.value = 3000;
            glassFilter.Q.value = 0.5;
            cicadas.connect(glassFilter);
            glassFilter.connect(windowBus);
        } else {
            cicadas = Synthesis.createFilteredCicadas(ctx, 3);
            cicadas.connect(windowBus);
        }
        cicadas.gain.gain.value = 0.05;
        cicadas.start();
        cleanupFns.push(() => cicadas.stop());

        // 4. Ceiling fan - barely perceptible (5%)
        const fan = Synthesis.createMechanicalHum(ctx, 32, 1.2, 2);
        fan.gain.gain.value = 0.015;
        fan.connect(overheadBus);
        fan.start();
        cleanupFns.push(() => { try { fan.stop(); } catch(e) {} });

        // 5. Mains hum - subliminal
        const mains = Synthesis.createDrone(ctx, 50, 0.01);
        mains.connect(masterGain);
        mains.start();
        cleanupFns.push(() => { try { mains.stop(); } catch(e) {} });

        // Welcome trigger: brief cicada swell (heat pressing in from outside)
        function cicadaSwell() {
            const g = cicadas.gain.gain;
            const now = ctx.currentTime;
            g.cancelScheduledValues(now);
            g.setTargetAtTime(0.12, now, 0.8);
            g.setTargetAtTime(0.05, now + 3, 1.5);
        }

        // Left is the AC corner; right is the kitchen
        function setProximity(dx, dy) {
            const d = clamp(dx, -1, 1);
            const now = ctx.currentTime;
            acBus.gain.setTargetAtTime(1 - d * 0.3, now, 0.25);
            kitchenBus.gain.setTargetAtTime(1 + d * 0.3, now, 0.25);
        }

        // Maintenance: a sigh in the heat - someone lives here
        const maintenance = Synthesis.createScheduler(180, 360, () => {
            if (!audible()) return;
            Synthesis.createSigh(ctx, masterGain, 0.02);
        });
        maintenance.start();
        cleanupFns.push(() => maintenance.stop());

        // Intruder: a neighbor's generator sputters to life -
        // the grid is failing someone nearby
        let stressLevel = 0;
        const intruder = Synthesis.createScheduler(300, 480, () => {
            if (!audible() || Math.random() > 0.2 + stressLevel * 0.5) return;
            Synthesis.createGenerator(ctx, windowBus, 0.03);
        });
        intruder.start();
        cleanupFns.push(() => intruder.stop());

        // Memory: an ice-cream van, streets away - the ordinary
        // past haunting the ordinary future. Extremely rare.
        const memory = Synthesis.createScheduler(420, 720, () => {
            if (!audible() || Math.random() > 0.5) return;
            Synthesis.createIceCreamVan(ctx, windowBus, 0.02);
        });
        memory.start();
        cleanupFns.push(() => memory.stop());

        // Stress: the machines lose the fight - the AC compressor
        // wobbles and sags, the fridge short-cycles under brownout
        function setStress(s) {
            stressLevel = s;
            acCompressor.setStrain(s);
            fridge.setStress(s);
            fan.setStrain(s * 0.5);
        }

        return {
            gainNode: masterGain,
            reverb: zoneReverb,
            trigger: cicadaSwell,
            setProximity: setProximity,
            setStress: setStress,
            scoreMoment: () => Synthesis.createScoreMoment(ctx, masterGain, CHORDS.heat),
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // REFUGE ZONE [0.5, 0.5]
    // Interior that works - normalcy
    // Balance: Room tone 60%, Vent 30%, Electrical 10%
    // Room: vent right, electrical hum left, tone everywhere
    // ============================================

    function createRefugeZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        // Zone-specific reverb
        const zoneReverb = Synthesis.createZoneReverb(ctx, 'refuge');
        masterGain.connect(zoneReverb.input);
        zoneReverb.connect(destination);

        const cleanupFns = [];
        const audible = makeAudible(masterGain);

        // Element placement
        const ventBus = createBus(ctx, masterGain, 0.3);        // vent, right
        const electricalBus = createBus(ctx, masterGain, -0.4); // hum, left

        // 1. Room tone - fundamental presence (60%)
        let roomTone;
        if (Samples.has('room-tone')) {
            roomTone = Samples.createLoop(ctx, 'room-tone');
            roomTone.gain.gain.value = 0.05;
        } else {
            // Tuned to the 50Hz mains tonic - the house's keynote
            roomTone = Synthesis.createRoomTone(ctx, 50, 0.035);
        }
        roomTone.connect(masterGain);
        roomTone.start();
        cleanupFns.push(() => { try { roomTone.stop(); } catch(e) {} });

        // 2. Ventilation - very filtered, steady (30%)
        const vent = Synthesis.createFilteredNoise(ctx, 'pink', 'lowpass', 150, 0.3);
        vent.gain.gain.value = 0.025;
        vent.connect(ventBus);
        vent.start();
        cleanupFns.push(() => { try { vent.stop(); } catch(e) {} });

        // 3. Subtle electrical presence (10%)
        const electricalPresence = Synthesis.createDrone(ctx, 100, 0.008);
        electricalPresence.connect(electricalBus);
        electricalPresence.start();
        cleanupFns.push(() => { try { electricalPresence.stop(); } catch(e) {} });

        // 4. Very rare settling sounds - building breathing (45-120s)
        function settlingTick() {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = Synthesis.snapFreq(70 + Math.random() * 30, CHORDS.refuge);
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.connect(g);
            g.connect(randomSpot(ctx, masterGain, 0.5, 500));
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }

        const ambientScheduler = Synthesis.createScheduler(45, 120, settlingTick);
        ambientScheduler.start();
        cleanupFns.push(() => ambientScheduler.stop());

        // 5. The radio - the one aperture through which the outside
        // enters the refuge. An occasional news bulletin, faint and
        // unintelligible; the cadence timestamps the world.
        const radio = Synthesis.createRadio(ctx);
        const radioBus = createBus(ctx, masterGain, -0.25);  // on a shelf, left
        radio.gain.gain.value = 0.05;
        radio.connect(radioBus);
        cleanupFns.push(() => radio.stop());

        // First bulletin ~90s in, so first visitors encounter it;
        // then every 4-7 minutes (hourly, in the fiction's time)
        const firstBulletin = setTimeout(() => {
            if (audible()) radio.playBulletin(18 + Math.random() * 10);
        }, 90000);
        cleanupFns.push(() => clearTimeout(firstBulletin));

        const bulletinScheduler = Synthesis.createScheduler(240, 420, () => {
            if (!audible()) return;
            radio.playBulletin(18 + Math.random() * 14);
        });
        bulletinScheduler.start();
        cleanupFns.push(() => bulletinScheduler.stop());

        // 6. Warm near-field: the sounds of ordinary comfort, close
        // by - a page turned, a chair creak, rarely the kettle.
        // Weighted so the kettle stays an event, not a habit.
        const nearField = Synthesis.createScheduler(100, 220, () => {
            if (!audible()) return;
            const roll = Math.random();
            if (roll < 0.5) {
                Synthesis.createPageTurn(ctx, randomSpot(ctx, masterGain, 0.3, 800), 0.02);
            } else if (roll < 0.85) {
                Synthesis.createCreak(ctx, randomSpot(ctx, masterGain, 0.25, 800), 0.03, null, CHORDS.refuge);
            } else {
                Synthesis.createKettle(ctx, ventBus, 0.02);
            }
        });
        nearField.start();
        cleanupFns.push(() => nearField.stop());

        // Barely there: drifting right leans toward the vent
        function setProximity(dx, dy) {
            const d = clamp(dx, -1, 1);
            const now = ctx.currentTime;
            ventBus.gain.setTargetAtTime(1 + d * 0.2, now, 0.25);
            electricalBus.gain.setTargetAtTime(1 - d * 0.2, now, 0.25);
        }

        return {
            gainNode: masterGain,
            reverb: zoneReverb,
            trigger: settlingTick,
            setProximity: setProximity,
            setStress: function() {},  // the refuge settles via evolution gain alone
            scoreMoment: () => Synthesis.createScoreMoment(ctx, masterGain, CHORDS.refuge),
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // FLOOD ZONE [0.1, 0.9]
    // Water got inside - managing the situation
    // Balance: Pipes 40%, Bucket 30%, Pump 20%, Events 10%
    // Room: pipes in the left wall, bucket right, pump behind-left
    // ============================================

    function createFloodZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        // Zone-specific reverb
        const zoneReverb = Synthesis.createZoneReverb(ctx, 'flood');
        masterGain.connect(zoneReverb.input);
        zoneReverb.connect(destination);

        const cleanupFns = [];
        const ducker = makeDucker(ctx);
        const audible = makeAudible(masterGain);

        // Element placement
        const pipesBus = createBus(ctx, masterGain, -0.5);   // wall pipes, left
        const bucketBus = createBus(ctx, masterGain, 0.5);   // the bucket, right
        const pumpBus = createBus(ctx, masterGain, -0.2);    // sump pump

        // 1. Water in pipes - constant gurgle (40%)
        // A real recording carries its own irregular flow
        if (Samples.has('water-pipes')) {
            const pipes = Samples.createLoop(ctx, 'water-pipes');
            pipes.gain.gain.value = 0.1;
            pipes.connect(pipesBus);
            pipes.start();
            cleanupFns.push(() => pipes.stop());
            ducker.register(pipes.gain.gain, 0.1);
        } else {
            const pipes = Synthesis.createFilteredNoise(ctx, 'pink', 'bandpass', 350, 2);
            pipes.gain.gain.value = 0.1;
            pipes.connect(pipesBus);
            pipes.start();
            cleanupFns.push(() => { try { pipes.stop(); } catch(e) {} });
            ducker.register(pipes.gain.gain, 0.1);

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
        }

        // 2. Drip into bucket - metallic, 1.5-3s, urgent, tuned,
        // timed and pitched by authored series (30%)
        const bucketDrip = Synthesis.scheduleDripsWithReverb(ctx, bucketBus, 1.5, 3, 'metal', 0.18, {
            table: CHORDS.flood,
            intervalSeries: Synthesis.createSeries([0.3, 0.8, 0.5, 0.2, 0.9, 0.6, 0.1]),
            pitchSeries: Synthesis.createSeries([0.5, 0.1, 0.8, 0.3, 0.6]),
            restChance: 0.1, restMin: 20, restMax: 45
        });
        bucketDrip.start();
        cleanupFns.push(() => bucketDrip.stop());

        // 3. Sump pump cycling (20%)
        const pump = Synthesis.createApplianceCycle(ctx, 75, 20, 35);
        pump.connect(pumpBus);
        pump.start();
        cleanupFns.push(() => pump.stop());

        // Pump vibration
        const pumpVibration = Synthesis.createMechanicalHum(ctx, 42, 2.5, 4);
        pumpVibration.gain.gain.value = 0.03;
        pumpVibration.connect(pumpBus);
        pumpVibration.start();
        cleanupFns.push(() => { try { pumpVibration.stop(); } catch(e) {} });

        // 4. Floating objects bumping - 15-45s, from anywhere (7%)
        const floatingScheduler = Synthesis.createScheduler(15, 45, () => {
            if (!audible()) return;
            ducker.duck(3);
            Synthesis.createNoiseBurst(ctx, randomSpot(ctx, masterGain, 0.7, 800),
                100 + Math.random() * 60, 0.12, 7);
        });
        floatingScheduler.start();
        cleanupFns.push(() => floatingScheduler.stop());

        // 5. Splashes - 5-12s, from anywhere (3%)
        const splashScheduler = Synthesis.createScheduler(5, 12, () => {
            if (!audible()) return;
            // Real splash if a recording is available
            if (Samples.playOneShot(ctx, 'splash', randomSpot(ctx, masterGain, 0.7, 1500), 0.06)) {
                return;
            }
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
            splashGain.connect(randomSpot(ctx, masterGain, 0.7, 500));
            splash.start();
        });
        splashScheduler.start();
        cleanupFns.push(() => splashScheduler.stop());

        // Left wall is the plumbing; the bucket sits to the right
        function setProximity(dx, dy) {
            const d = clamp(dx, -1, 1);
            const now = ctx.currentTime;
            pipesBus.gain.setTargetAtTime(1 - d * 0.3, now, 0.25);
            bucketBus.gain.setTargetAtTime(1 + d * 0.3, now, 0.25);
        }

        // Maintenance: the bucket, emptied - slosh, set-down clunk.
        // The single most important coping sound in the house.
        const maintenance = Synthesis.createScheduler(120, 240, () => {
            if (!audible()) return;
            ducker.duck(2.5);
            Synthesis.createBucketEmpty(ctx, bucketBus, 0.06);
        });
        maintenance.start();
        cleanupFns.push(() => maintenance.stop());

        // Intruder: an emergency alert buzzing on a phone in
        // another room - flash-flood warnings reach the house
        let stressLevel = 0;
        const intruder = Synthesis.createScheduler(280, 460, () => {
            if (!audible() || Math.random() > 0.2 + stressLevel * 0.5) return;
            Synthesis.createAlertBuzz(ctx, randomSpot(ctx, masterGain, 0.5, 3500), 0.035);
        });
        intruder.start();
        cleanupFns.push(() => intruder.stop());

        // Stress: the water rises - drips faster, pump works harder
        // and more often, more debris knocking about
        function setStress(s) {
            stressLevel = s;
            bucketDrip.setRate(1 + s);
            pump.setStress(s);
            pumpVibration.setStrain(s);
            floatingScheduler.setRate(1 + s * 0.6);
        }

        return {
            gainNode: masterGain,
            reverb: zoneReverb,
            // Welcome trigger: a distinctive drip into the bucket
            trigger: () => Synthesis.createDripWithReverb(ctx, bucketBus, 'metal', 0.2, CHORDS.flood),
            setProximity: setProximity,
            setStress: setStress,
            scoreMoment: () => Synthesis.createScoreMoment(ctx, masterGain, CHORDS.flood),
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // DROUGHT ZONE [0.9, 0.9]
    // Months without rain - a house that creaks with dryness.
    // INTERIOR first: the wind is heard forcing the window frame,
    // never as open field - the thesis is inside.
    // Balance: Wind ~35%, Dust 15%, Faucet 25%, Creaks 15%, Room 10%
    // ============================================

    function createDroughtZone(ctx, destination) {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        // Zone-specific reverb
        const zoneReverb = Synthesis.createZoneReverb(ctx, 'drought');
        masterGain.connect(zoneReverb.input);
        zoneReverb.connect(destination);

        const cleanupFns = [];
        const ducker = makeDucker(ctx);
        const audible = makeAudible(masterGain);

        // Element placement
        const windLeftBus = createBus(ctx, masterGain, -0.5);
        const windRightBus = createBus(ctx, masterGain, 0.5);
        const faucetBus = createBus(ctx, masterGain, 0.6);   // dry faucet, right

        // 1. Dry wind (~35%): always heard through the house, never
        // as open field. The recording passes a window-frame
        // resonance; the synth fallback whistles through two
        // narrow-band frames, one per side.
        if (Samples.has('wind-dry')) {
            const wind = Samples.createLoop(ctx, 'wind-dry');
            wind.gain.gain.value = 0.07;
            const frame = ctx.createBiquadFilter();
            frame.type = 'bandpass';
            frame.frequency.value = 1100;
            frame.Q.value = 1.4;
            wind.connect(frame);
            frame.connect(masterGain);
            wind.start();
            cleanupFns.push(() => wind.stop());
            ducker.register(wind.gain.gain, 0.07);
        } else {
            const windLeft = Synthesis.createWind(ctx, 1400, 0.05, 0.12, 2.5);
            windLeft.gain.gain.value = 0.05;
            windLeft.connect(windLeftBus);
            windLeft.start();
            cleanupFns.push(() => { try { windLeft.stop(); } catch(e) {} });
            ducker.register(windLeft.gain.gain, 0.05);

            const windRight = Synthesis.createWind(ctx, 1250, 0.08, 0.12, 2.2);
            windRight.gain.gain.value = 0.05;
            windRight.connect(windRightBus);
            windRight.start();
            cleanupFns.push(() => { try { windRight.stop(); } catch(e) {} });
            ducker.register(windRight.gain.gain, 0.05);
        }

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

        // 3. Dripping faucet - 5-10 seconds (scarcity), tuned (25%)
        const faucet = Synthesis.scheduleDripsWithReverb(ctx, faucetBus, 5, 10, 'tile', 0.14,
            { table: CHORDS.drought, restChance: 0.15, restMin: 30, restMax: 70 });
        faucet.start();
        cleanupFns.push(() => faucet.stop());

        // 4. Wood creaking - 20-50s, a different beam each time (15%)
        const creaks = Synthesis.createScheduler(20, 50, () => {
            if (!audible()) return;
            ducker.duck(2.5);
            const spot = randomSpot(ctx, masterGain, 0.7, 1500);
            if (!Samples.playOneShot(ctx, 'creak', spot, 0.08)) {
                Synthesis.createCreak(ctx, spot, 0.08, null, CHORDS.drought);
            }
        }, { restChance: 0.15, restMin: 40, restMax: 90 });
        creaks.start();
        cleanupFns.push(() => creaks.stop());

        // 5. Room presence - the interior grounds the zone (10%)
        const roomPresence = Synthesis.createRoomTone(ctx, 65, 0.016);
        roomPresence.connect(masterGain);
        roomPresence.start();
        cleanupFns.push(() => { try { roomPresence.stop(); } catch(e) {} });

        // The kitchen faucet is to the right; wind leans away from you
        function setProximity(dx, dy) {
            const d = clamp(dx, -1, 1);
            const now = ctx.currentTime;
            faucetBus.gain.setTargetAtTime(1 + d * 0.35, now, 0.25);
            windLeftBus.gain.setTargetAtTime(1 - d * 0.2, now, 0.25);
        }

        // Maintenance: water poured from a stored jug - a ritual
        // that persists in reduced form; scarcity as duration
        // discipline on a familiar sound
        const maintenance = Synthesis.createScheduler(130, 260, () => {
            if (!audible()) return;
            Synthesis.createPour(ctx, faucetBus, 0.035);
        });
        maintenance.start();
        cleanupFns.push(() => maintenance.stop());

        // Intruder: a helicopter passing far off - someone is
        // surveying the dryness
        let stressLevel = 0;
        const intruder = Synthesis.createScheduler(300, 480, () => {
            if (!audible() || Math.random() > 0.2 + stressLevel * 0.5) return;
            Synthesis.createHelicopter(ctx, masterGain, 0.04);
        });
        intruder.start();
        cleanupFns.push(() => intruder.stop());

        // Memory: lawn sprinklers ghosting past the window - water
        // that used to be spent on grass. Extremely rare.
        const memory = Synthesis.createScheduler(420, 720, () => {
            if (!audible() || Math.random() > 0.5) return;
            Synthesis.createSprinklers(ctx, masterGain, 0.02);
        });
        memory.start();
        cleanupFns.push(() => memory.stop());

        // Stress: everything dries further - the wood complains
        // more, the faucet gives LESS (scarcity deepens)
        function setStress(s) {
            stressLevel = s;
            creaks.setRate(1 + s * 0.8);
            faucet.setRate(1 / (1 + s));
        }

        return {
            gainNode: masterGain,
            reverb: zoneReverb,
            // Welcome trigger: dry wood creak
            trigger: () => {
                const spot = randomSpot(ctx, masterGain, 0.5, 1500);
                if (!Samples.playOneShot(ctx, 'creak', spot, 0.08)) {
                    Synthesis.createCreak(ctx, spot, 0.08, null, CHORDS.drought);
                }
            },
            setProximity: setProximity,
            setStress: setStress,
            scoreMoment: () => Synthesis.createScoreMoment(ctx, masterGain, CHORDS.drought),
            cleanup: () => cleanupFns.forEach(fn => fn())
        };
    }

    // ============================================
    // ZONE SOURCES ARRAY
    // ============================================

    // Each zone is a REGION, not a point: the hostile climates own
    // their quadrants out to the screen corners, the refuge holds
    // the center. x/y is the region's center (used for stereo
    // placement and intra-zone proximity); rect is the habitable
    // area at full level.
    const ZONE_SOURCES = [
        {
            name: 'storm',
            x: 0.16, y: 0.16,
            rect: { x0: 0, y0: 0, x1: 0.32, y1: 0.32 },
            create: createStormZone,
            color: { r: 51, g: 43, b: 48 }  // #332b30 blue-ish
        },
        {
            name: 'heat',
            x: 0.84, y: 0.16,
            rect: { x0: 0.68, y0: 0, x1: 1, y1: 0.32 },
            create: createHeatZone,
            color: { r: 58, g: 43, b: 40 }  // #3a2b28 red-ish
        },
        {
            name: 'refuge',
            x: 0.5, y: 0.5,
            rect: { x0: 0.34, y0: 0.34, x1: 0.66, y1: 0.66 },
            create: createRefugeZone,
            color: { r: 51, g: 43, b: 40 }  // #332b28 neutral
        },
        {
            name: 'flood',
            x: 0.16, y: 0.84,
            rect: { x0: 0, y0: 0.68, x1: 0.32, y1: 1 },
            create: createFloodZone,
            color: { r: 43, g: 50, b: 48 }  // #2b3230 green-ish
        },
        {
            name: 'drought',
            x: 0.84, y: 0.84,
            rect: { x0: 0.68, y0: 0.68, x1: 1, y1: 1 },
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
