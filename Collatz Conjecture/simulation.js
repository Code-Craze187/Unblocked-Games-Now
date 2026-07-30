import { getCollatzNext } from "./collatz.js";
import { CONFIG } from "./config.js";
import { state } from "./state.js"; // For global settings like speedScale

export class CollatzEngine {
    constructor(m, c, options = {}) {
        this.m = m;
        this.c = c;
        this.options = {
            maxNodes: CONFIG.maxNodes,
            onNodeAdded: () => {},
            onStep: () => {},
            onOverflow: () => {},
            ...options
        };

        this.nodes = [];
        this.links = [];
        this.nodeSet = new Set();
        this.queue = [];

        this.currentPositiveSeed = 1;
        this.currentNegativeSeed = 0;
        this.maxVal = 0;
        this.currentDelay = CONFIG.initialDelay;
        this.timer = null;

        this.pendingNode = null;
        this.pendingFrom = null;

        this.chainTotal = 0;
        this.chainProgress = 0;
        this.isChainTotalUnknown = false;
        this.stopAfterQueue = false;
        this.isPaused = false;

        // Initialize with 1
        this.addNode(1);
        this.initSequence();
    }

    initSequence() {
        let curr = 1;
        let chain = [];
        let visitedInChain = new Set([1]);
        let merged = false;

        try {
            for (let i = 0; i < 100; i++) {
                const next = getCollatzNext(curr, this.m, this.c);

                if (next === 1 || this.nodeSet.has(next) || visitedInChain.has(next)) {
                    if (chain.length > 0) chain[chain.length - 1].finalLinkTo = next;
                    merged = true;
                    break;
                }
                chain.push({ val: next, fromVal: curr });
                visitedInChain.add(next);
                curr = next;
            }
        } catch (e) {
            this.stopAfterQueue = true;
        }

        this.chainTotal = chain.length;
        this.queue.push(...chain);

        if (!merged && !this.stopAfterQueue) {
            this.isChainTotalUnknown = true;
            this.pendingFrom = curr;
            try {
                this.pendingNode = getCollatzNext(curr, this.m, this.c);
            } catch(e) { this.stopAfterQueue = true; }
        }
    }

    start() {
        this.isPaused = false;
        if (this.timer) clearTimeout(this.timer);
        this.processStep();
    }

    stop() {
        this.isPaused = true;
        if (this.timer) clearTimeout(this.timer);
    }

    addNode(value) {
        if (this.nodeSet.has(value)) return;

        const newNode = {
            id: value,
            x: 0, y: 0,
            val: value
        };
        this.nodes.push(newNode);
        this.nodeSet.add(value);
        if (value > this.maxVal) this.maxVal = value;
    }

    addLink(source, target) {
        const exists = this.links.some(l => {
            const s = l.source.id !== undefined ? l.source.id : l.source;
            const t = l.target.id !== undefined ? l.target.id : l.target;
            return s === source && t === target;
        });
        if (!exists) this.links.push({ source, target });
    }

    processStep() {
        if (this.isPaused) return;

        let shouldUpdate = false;

        if (this.queue.length > 0) {
            this.chainProgress++;
            const nextItem = this.queue.shift();
            let newNodeAdded = false;

            if (!this.nodeSet.has(nextItem.val)) {
                this.addNode(nextItem.val);
                newNodeAdded = true;
                shouldUpdate = true;

                // Position Logic
                const newNode = this.nodes.find(n => n.id === nextItem.val);
                if (newNode) {
                    if (nextItem.fromVal !== null) {
                        const sourceNode = this.nodes.find(n => n.id === nextItem.fromVal);
                        if (sourceNode) {
                            newNode.x = sourceNode.x + (Math.random() - 0.5) * 20;
                            newNode.y = sourceNode.y + (Math.random() - 0.5) * 20;
                        }
                    } else if (nextItem.initialX !== undefined) {
                        newNode.x = nextItem.initialX;
                        newNode.y = nextItem.initialY;
                    } else {
                        newNode.x = (Math.random() - 0.5) * 60;
                        newNode.y = (Math.random() - 0.5) * 60;
                    }
                }
            }

            if (nextItem.fromVal !== null) {
                this.addLink(nextItem.fromVal, nextItem.val);
                shouldUpdate = true;
            }
            if (nextItem.finalLinkTo) {
                this.addLink(nextItem.val, nextItem.finalLinkTo);
                shouldUpdate = true;
            }

            if (newNodeAdded) this.options.onNodeAdded(nextItem.val);

            // Speed up
            this.currentDelay = Math.max(CONFIG.minDelay, this.currentDelay * CONFIG.acceleration);
            
            if (shouldUpdate) this.options.onStep();

            // Loop
            const speed = state.speedScale || 1;
            this.timer = setTimeout(() => this.processStep(), this.currentDelay / speed);

        } else if (this.pendingNode !== null) {
            // Calculate as you go
            const curr = this.pendingNode;
            const prev = this.pendingFrom;
            this.chainTotal++;

            try {
                const next = getCollatzNext(curr, this.m, this.c);
                const item = { val: curr, fromVal: prev };

                if (this.nodeSet.has(next)) {
                    item.finalLinkTo = next;
                    this.pendingNode = null;
                    this.pendingFrom = null;
                    this.isChainTotalUnknown = false;
                } else {
                    this.pendingFrom = curr;
                    this.pendingNode = next;
                }
                this.queue.push(item);
                const speed = state.speedScale || 1;
                this.timer = setTimeout(() => this.processStep(), this.currentDelay / speed);
            } catch (e) {
                this.queue.push({ val: curr, fromVal: prev });
                this.pendingNode = null;
                this.stopAfterQueue = true;
                const speed = state.speedScale || 1;
                this.timer = setTimeout(() => this.processStep(), this.currentDelay / speed);
            }

        } else {
            // Find next seed
            if (this.stopAfterQueue) {
                this.options.onOverflow();
                return;
            }

            if (this.nodes.length >= this.options.maxNodes) {
                return; // Stop
            }

            this.currentDelay = CONFIG.initialDelay;
            const speed = state.speedScale || 1;
            this.timer = setTimeout(() => this.pickNextSeed(), 1000 / speed);
        }
    }

    pickNextSeed() {
        let steps = 0;
        let n = null;
        do {
            if (state.testNegatives) {
                if (this.currentNegativeSeed < this.currentPositiveSeed) {
                    this.currentNegativeSeed++;
                    n = -this.currentNegativeSeed;
                } else {
                    this.currentPositiveSeed++;
                    n = this.currentPositiveSeed;
                }
            } else {
                this.currentPositiveSeed++;
                n = this.currentPositiveSeed;
            }
            steps++;
        } while (this.nodeSet.has(n) && steps < 2000); // Lower limit for grid safety

        if (this.nodeSet.has(n)) return;

        // Pre-calculate path
        let path = [];
        let curr = n;
        let prev = null;
        let foundMerge = false;
        const visitedInPath = new Set();
        const startTime = performance.now();
        const TIME_LIMIT = 50; // Reduced for grid safety (was 2000)

        try {
            let chainSteps = 0;
            while (!this.nodeSet.has(curr) && !visitedInPath.has(curr) && chainSteps < 10000) {
                if (performance.now() - startTime > TIME_LIMIT) break;
                path.push({ val: curr, fromVal: prev });
                visitedInPath.add(curr);
                prev = curr;
                curr = getCollatzNext(curr, this.m, this.c);
                chainSteps++;
            }

            if (this.nodeSet.has(curr)) foundMerge = true;
            else if (visitedInPath.has(curr)) foundMerge = true;
        } catch (e) {
            this.stopAfterQueue = true;
        }

        if (path.length > 0) {
            this.chainTotal = path.length;
            this.chainProgress = 0;
            this.isChainTotalUnknown = false;

            if (!this.stopAfterQueue) {
                if (foundMerge) {
                    path[path.length - 1].finalLinkTo = curr;
                    const connectionNode = this.nodes.find(node => node.id === curr);
                    if (connectionNode) {
                         const angle = Math.random() * Math.PI * 2;
                         const dist = 80 + Math.random() * 40; 
                         path[0].initialX = connectionNode.x + Math.cos(angle) * dist;
                         path[0].initialY = connectionNode.y + Math.sin(angle) * dist;
                    }
                } else {
                    this.isChainTotalUnknown = true;
                    this.pendingFrom = prev;
                    this.pendingNode = curr;
                }
            }
            this.queue.push(...path);
        }

        const speed = state.speedScale || 1;
        this.timer = setTimeout(() => this.processStep(), 500 / speed);
    }
}