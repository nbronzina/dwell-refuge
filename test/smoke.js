#!/usr/bin/env node
// ============================================
// DWELL:REFUGE - Smoke test
// Loads synthesis.js, zones.js and audio.js against a mocked
// Web Audio API and exercises the full engine lifecycle:
// zone construction/cleanup, start, position sweeps, stop,
// re-entry, fadeOutAndStop and gracefulExit.
// Also verifies no oscillator/buffer source leaks.
//
// Run: node test/smoke.js
// ============================================

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ---------- Web Audio mocks ----------

// Sources started and not yet stopped (leak detection)
const liveSources = new Set();

class MockAudioParam {
    constructor(value = 0) { this.value = value; }
    setValueAtTime(v) { this.value = v; return this; }
    linearRampToValueAtTime(v) { this.value = v; return this; }
    exponentialRampToValueAtTime(v) { this.value = v; return this; }
    setTargetAtTime(v) { this.value = v; return this; }
    cancelScheduledValues() { return this; }
}

class MockNode {
    connect(dest) { return dest; }
    disconnect() {}
}

class MockSourceNode extends MockNode {
    start() { liveSources.add(this); }
    stop() { liveSources.delete(this); }
}

function makeBuffer(channels, length, sampleRate) {
    const data = [];
    for (let c = 0; c < channels; c++) data.push(new Float32Array(length));
    return {
        length,
        sampleRate,
        duration: length / sampleRate,
        numberOfChannels: channels,
        getChannelData: c => data[c]
    };
}

class MockAudioContext {
    constructor() {
        this.sampleRate = 44100;
        this.state = 'running';
        this.destination = new MockNode();
        this._t = 0;
    }
    get currentTime() { return (this._t += 0.001); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBuffer(ch, len, rate) { return makeBuffer(ch, len, rate); }
    createGain() {
        const n = new MockNode();
        n.gain = new MockAudioParam(1);
        return n;
    }
    createBiquadFilter() {
        const n = new MockNode();
        n.type = 'lowpass';
        n.frequency = new MockAudioParam(350);
        n.Q = new MockAudioParam(1);
        n.gain = new MockAudioParam(0);
        return n;
    }
    createDelay() {
        const n = new MockNode();
        n.delayTime = new MockAudioParam(0);
        return n;
    }
    createConvolver() {
        const n = new MockNode();
        n.buffer = null;
        return n;
    }
    createDynamicsCompressor() {
        const n = new MockNode();
        ['threshold', 'knee', 'ratio', 'attack', 'release']
            .forEach(p => { n[p] = new MockAudioParam(0); });
        return n;
    }
    createOscillator() {
        const n = new MockSourceNode();
        n.type = 'sine';
        n.frequency = new MockAudioParam(440);
        n.detune = new MockAudioParam(0);
        return n;
    }
    createBufferSource() {
        // Non-looping buffer sources end themselves when the buffer
        // runs out (real browser behavior) - only looping ones can leak
        const n = new MockNode();
        n.buffer = null;
        n.loop = false;
        n.onended = null;
        n.start = function() {
            if (this.loop) {
                liveSources.add(this);
            } else {
                const self = this;
                setTimeout(() => { if (self.onended) self.onended(); }, 0);
            }
        };
        n.stop = function() { liveSources.delete(this); };
        return n;
    }
    createStereoPanner() {
        const n = new MockNode();
        n.pan = new MockAudioParam(0);
        return n;
    }
    createPanner() {
        const n = new MockNode();
        n.panningModel = 'equalpower';
        n.distanceModel = 'inverse';
        n.refDistance = 1;
        n.rolloffFactor = 1;
        n.positionX = new MockAudioParam(0);
        n.positionY = new MockAudioParam(0);
        n.positionZ = new MockAudioParam(0);
        return n;
    }
}

// ---------- Sandbox ----------

const rafQueue = [];
let dispatchedEvents = 0;

const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, Math, Date, Float32Array, performance,
    requestAnimationFrame: cb => { rafQueue.push(cb); return rafQueue.length; },
    cancelAnimationFrame: () => {},
    document: {
        hidden: false,
        addEventListener: () => {},
        dispatchEvent: () => { dispatchedEvents++; }
    },
    CustomEvent: class CustomEvent {
        constructor(type, opts) {
            this.type = type;
            this.detail = opts && opts.detail;
        }
    },
    window: { AudioContext: MockAudioContext }
};
vm.createContext(sandbox);

function load(file) {
    const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
}

// Top-level consts live in the context's lexical scope,
// not on the global object - fetch them by evaluation
function get(expr) {
    return vm.runInContext(expr, sandbox);
}

function pumpFrames(n) {
    for (let i = 0; i < n; i++) {
        const cbs = rafQueue.splice(0);
        cbs.forEach(cb => cb(performance.now()));
    }
}

// ---------- Assertions ----------

let failures = 0;
function assert(cond, msg) {
    if (cond) {
        console.log('  ok - ' + msg);
    } else {
        failures++;
        console.error('  FAIL - ' + msg);
    }
}

// ---------- Tests ----------

async function main() {
    console.log('loading modules');
    load('js/synthesis.js');
    load('js/zones.js');
    load('js/audio.js');

    const Synthesis = get('Synthesis');
    const Zones = get('Zones');
    const RefugeAudio = get('RefugeAudio');

    console.log('module surface');
    assert(typeof Synthesis.createScheduler === 'function', 'Synthesis exports createScheduler');
    assert(typeof Synthesis.createZoneReverb === 'function', 'Synthesis exports createZoneReverb');
    assert(Array.isArray(Zones.ZONE_SOURCES) && Zones.ZONE_SOURCES.length === 5, 'five zones defined');

    console.log('zone construction and cleanup');
    const ctx = new MockAudioContext();
    Zones.ZONE_SOURCES.forEach(def => {
        const dest = ctx.createGain();
        const zone = def.create(ctx, dest);
        assert(zone.gainNode && typeof zone.cleanup === 'function',
            def.name + ': returns gainNode and cleanup');
        assert(typeof zone.trigger === 'function',
            def.name + ': has a welcome trigger');
        zone.trigger();  // must not throw
        zone.cleanup();
    });
    assert(liveSources.size === 0, 'no live sources after all zone cleanups');

    console.log('engine lifecycle');
    RefugeAudio.start();
    assert(RefugeAudio.isRunning(), 'engine running after start');
    pumpFrames(5);

    RefugeAudio.setPosition(0.5, 0.5);
    pumpFrames(3);
    assert(RefugeAudio.getDominantZone() === 'refuge', 'center resolves to refuge');

    RefugeAudio.setPosition(0.05, 0.05);
    pumpFrames(3);
    assert(RefugeAudio.getDominantZone() === 'storm', 'top-left resolves to storm');

    RefugeAudio.setPosition(0.95, 0.95);
    pumpFrames(3);
    assert(RefugeAudio.getDominantZone() === 'drought', 'bottom-right resolves to drought');

    RefugeAudio.setVelocity(0.2);
    pumpFrames(3);

    RefugeAudio.stop();
    assert(!RefugeAudio.isRunning(), 'engine stopped');
    assert(liveSources.size === 0, 'no live sources after stop (no leaks)');

    console.log('re-entry (regression: Escape used to break restart)');
    RefugeAudio.start();
    assert(RefugeAudio.isRunning(), 'engine restarts after stop');
    pumpFrames(3);
    assert(RefugeAudio.getDominantZone() !== null, 'zones rebuilt on re-entry');

    await RefugeAudio.fadeOutAndStop(0.05);
    assert(!RefugeAudio.isRunning(), 'fadeOutAndStop stops the engine');
    assert(liveSources.size === 0, 'no live sources after fadeOutAndStop');

    console.log('graceful exit and fresh-context restart');
    RefugeAudio.start();
    await RefugeAudio.gracefulExit();
    assert(!RefugeAudio.isRunning(), 'gracefulExit stops the engine');
    assert(liveSources.size === 0, 'no live sources after gracefulExit');

    RefugeAudio.start();
    assert(RefugeAudio.isRunning(), 'engine restarts on a fresh context after gracefulExit');
    pumpFrames(3);
    RefugeAudio.stop();

    console.log('visual event dispatch');
    assert(dispatchedEvents >= 1, 'zone events were dispatched to the UI layer (' + dispatchedEvents + ')');

    console.log(failures === 0
        ? '\nall checks passed'
        : '\n' + failures + ' check(s) FAILED');
    process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(err => {
    console.error('smoke test crashed:', err);
    process.exitCode = 1;
});
