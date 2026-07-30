import { state } from "./state.js";

export const ui = {
    scannerBubble: document.getElementById('scanner-bubble'),
    nodeCountEl: document.getElementById('node-count'),
    maxValEl: document.getElementById('max-val'),
    minValEl: document.getElementById('min-val'),
    chainStatsEl: document.getElementById('chain-stats'),
    chainProgressEl: document.getElementById('chain-progress'),
    chainTotalEl: document.getElementById('chain-total'),
    wallToggle: document.getElementById('wall-toggle'),
    shadowToggle: document.getElementById('shadow-toggle'),
    speedSlider: document.getElementById('speed-slider'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    backgroundText: document.getElementById('background-text'),
    modal: document.getElementById('config-modal'),
    modalConfirm: document.getElementById('modal-confirm'),
    modalCancel: document.getElementById('modal-cancel'),
    paramM: document.getElementById('param-m'),
    paramC: document.getElementById('param-c'),
    overflowOverlay: document.getElementById('overflow-overlay'),
    overflowResetBtn: document.getElementById('overflow-reset-btn'),
    vizContainer: document.getElementById('viz-container'),
    gridModeBtn: document.getElementById('grid-mode-btn'),
    gridView: document.getElementById('grid-view'),
    exitGridBtn: document.getElementById('exit-grid-btn'),
    gridPauseBtn: document.getElementById('grid-pause-btn'),
    gridResetBtn: document.getElementById('grid-reset-btn'),

    // Grid Config Modal Elements
    gridConfigModal: document.getElementById('grid-config-modal'),
    gridModalConfirm: document.getElementById('grid-modal-confirm'),
    gridModalCancel: document.getElementById('grid-modal-cancel'),
    gridMMin: document.getElementById('grid-m-min'),
    gridMMax: document.getElementById('grid-m-max'),
    gridCMin: document.getElementById('grid-c-min'),
    gridCMax: document.getElementById('grid-c-max'),

    bigIntToggle: document.getElementById('bigint-toggle'),
    negativesToggle: document.getElementById('negatives-toggle'),
    bigIntModal: document.getElementById('bigint-modal'),
    bigIntConfirm: document.getElementById('bigint-confirm'),
    bigIntCancel: document.getElementById('bigint-cancel'),

    // Add Number Modal
    addNumBtn: document.getElementById('add-num-btn'),
    addNumModal: document.getElementById('add-num-modal'),
    addNumInput: document.getElementById('manual-num-input'),
    addNumConfirm: document.getElementById('add-num-confirm'),
    addNumCancel: document.getElementById('add-num-cancel')
};

export function updateTheme() {
    const m = state.multiplier;
    const c = state.addend;

    if (ui.backgroundText) {
        const sign = c < 0 ? "-" : "+";
        const absC = Math.abs(c);
        ui.backgroundText.textContent = `y = ${m}x ${sign} ${absC}`;
    }

    let color;

    if (m === 3 && c === 1) {
        color = "#2c4a6f";
    } else {
        // Generate a deterministic hue based on params
        // Using a prime number hash to separate close values
        const hue = Math.abs((m * 47 + c * 29) % 360);
        color = `hsl(${hue}, 45%, 25%)`;
    }

    document.body.style.backgroundColor = color;
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) modalContent.style.backgroundColor = color;
}