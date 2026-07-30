import { CONFIG } from "./config.js";

export const state = {
    nodes: [],
    links: [],
    nodeSet: new Set(), // To quickly check existence
    queue: [], // Nodes waiting to be visually added
    currentPositiveSeed: 1,
    currentNegativeSeed: 0,
    maxVal: 0,
    minVal: 0,
    currentDelay: CONFIG.initialDelay, // Dynamic delay
    isProcessing: false,
    wallsEnabled: true,
    speedScale: 1.0,
    timer: null,
    isPaused: false,
    multiplier: 3,
    addend: 1,
    stopAfterQueue: false,
    pendingNode: null, // For "calculate as you go"
    pendingFrom: null,
    chainTotal: 0,
    chainProgress: 0,
    isChainTotalUnknown: false,
    useBigInt: false,
    testNegatives: false,
    manualSeeds: []
};