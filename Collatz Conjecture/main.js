import { state } from "./state.js";
import { ui, updateTheme } from "./ui.js";
import { playSound } from "./audio.js";
import { CollatzEngine } from "./simulation.js";
import { CollatzViz } from "./viz.js";
import { startGridMode, stopGridMode, toggleGridPause, resetGrid, getGridConfig, updateGridConfig } from "./grid.js";
import { getCollatzNext } from "./collatz.js";
import { CONFIG } from "./config.js";

let engine = null;
let visualizer = null;
let bigIntStateOnGridEnter = false;

function handleOverflow() {
    state.isPaused = true;
    if (state.timer) clearTimeout(state.timer);
    ui.overflowOverlay.classList.add('visible');
}

function setupEventListeners() {
    ui.pauseBtn.addEventListener('click', togglePause);
    
    ui.resetBtn.addEventListener('click', () => {
        ui.modal.classList.add('visible');
    });

    ui.modalConfirm.addEventListener('click', () => {
        const m = parseInt(ui.paramM.value);
        const c = parseInt(ui.paramC.value);
        if (!isNaN(m) && !isNaN(c)) {
            state.multiplier = m;
            state.addend = c;
            ui.modal.classList.remove('visible');
            resetSimulation();
        }
    });

    ui.modalCancel.addEventListener('click', () => {
        ui.modal.classList.remove('visible');
    });
    
    ui.overflowResetBtn.addEventListener('click', () => {
        ui.overflowOverlay.classList.remove('visible');
        ui.modal.classList.add('visible');
    });

    ui.speedSlider.addEventListener('input', (e) => {
        state.speedScale = parseFloat(e.target.value);
    });

    ui.wallToggle.addEventListener('change', (e) => {
        state.wallsEnabled = e.target.checked;
        if (visualizer) visualizer.updateWallVisibility();
    });
    
    ui.shadowToggle.addEventListener('change', (e) => {
        if (e.target.checked) document.body.classList.add('shadows-enabled');
        else document.body.classList.remove('shadows-enabled');
    });

    // Initialize shadow state based on default checkbox value
    if (ui.shadowToggle.checked) {
        document.body.classList.add('shadows-enabled');
    }

    ui.negativesToggle.addEventListener('change', (e) => {
        state.testNegatives = e.target.checked;
    });

    // BigInt Toggle Logic
    ui.bigIntToggle.addEventListener('click', (e) => {
        if (!state.useBigInt) {
            // User wants to turn ON
            e.preventDefault();
            ui.bigIntModal.classList.add('visible');
        } else {
            // User wants to turn OFF
            state.useBigInt = false;
            
            if (document.body.classList.contains('grid-mode-active')) {
                resetGrid();
            } else {
                resetSimulation();
            }
        }
    });

    ui.bigIntConfirm.addEventListener('click', () => {
        state.useBigInt = true;
        ui.bigIntToggle.checked = true;
        ui.bigIntModal.classList.remove('visible');
        
        if (document.body.classList.contains('grid-mode-active')) {
            resetGrid();
        } else {
            resetSimulation();
        }
    });

    ui.bigIntCancel.addEventListener('click', () => {
        ui.bigIntModal.classList.remove('visible');
        // Ensure toggle stays off
        ui.bigIntToggle.checked = false; 
    });

    // Manual Add Number Logic
    ui.addNumBtn.addEventListener('click', () => {
        ui.addNumInput.value = "";
        ui.addNumModal.classList.add('visible');
        // Small timeout to allow transition to start before focus
        setTimeout(() => ui.addNumInput.focus(), 100);
    });

    ui.addNumCancel.addEventListener('click', () => {
        ui.addNumModal.classList.remove('visible');
    });

    ui.addNumConfirm.addEventListener('click', () => {
        const rawVal = ui.addNumInput.value.trim();
        if (!rawVal) return;
        
        try {
            let val;
            if (state.useBigInt) {
                // Remove commas if user typed them
                val = BigInt(rawVal.replace(/,/g, ''));
            } else {
                val = parseInt(rawVal.replace(/,/g, ''));
                if (isNaN(val)) throw new Error("Invalid number");
            }
            
            if (state.nodeSet.has(val)) {
                alert("Number already exists in the graph!");
                return;
            }
            
            ui.addNumModal.classList.remove('visible');
            
            state.manualSeeds.push(val);
            
            // If paused, unpause to let the queue process
            if (state.isPaused) {
                state.isPaused = false;
                ui.pauseBtn.textContent = "Pause";
                processStep();
            }
            
        } catch(e) {
            alert("Invalid number entered. " + e.message);
        }
    });

    ui.gridModeBtn.addEventListener('click', () => {
        document.body.classList.add('grid-mode-active');
        // Reset pause button state for grid
        ui.gridPauseBtn.textContent = "Pause";
        
        // Store BigInt state to check for changes on exit
        bigIntStateOnGridEnter = state.useBigInt;

        // Pause main sim
        state.isPaused = true;
        if (state.timer) clearTimeout(state.timer);
        ui.pauseBtn.textContent = "Resume";
        
        startGridMode(ui.gridView);
    });

    ui.exitGridBtn.addEventListener('click', () => {
        document.body.classList.remove('grid-mode-active');
        
        stopGridMode(ui.gridView);
        
        // If BigInt mode changed while in grid, we must reset main sim
        if (state.useBigInt !== bigIntStateOnGridEnter) {
            resetSimulation();
        } else {
            // Resume main sim normally
            state.isPaused = false;
            ui.pauseBtn.textContent = "Pause";
            processStep();
        }
    });

    ui.gridPauseBtn.addEventListener('click', () => {
        const isPaused = toggleGridPause();
        ui.gridPauseBtn.textContent = isPaused ? "Resume" : "Pause";
    });

    ui.gridResetBtn.addEventListener('click', () => {
        // Populate modal with current config
        const config = getGridConfig();
        ui.gridMMin.value = config.mMin;
        ui.gridMMax.value = config.mMax;
        ui.gridCMin.value = config.cMin;
        ui.gridCMax.value = config.cMax;
        
        ui.gridConfigModal.classList.add('visible');
    });

    ui.gridModalConfirm.addEventListener('click', () => {
        const mMin = parseInt(ui.gridMMin.value);
        const mMax = parseInt(ui.gridMMax.value);
        const cMin = parseInt(ui.gridCMin.value);
        const cMax = parseInt(ui.gridCMax.value);

        if (mMin <= mMax && cMin <= cMax) {
            updateGridConfig({ mMin, mMax, cMin, cMax });
            ui.gridConfigModal.classList.remove('visible');
            
            // Reset UI state
            ui.gridPauseBtn.textContent = "Pause";
            
            // Restart grid with new settings
            startGridMode(ui.gridView);
        } else {
            alert("Invalid ranges. Min must be less than or equal to Max.");
        }
    });

    ui.gridModalCancel.addEventListener('click', () => {
        ui.gridConfigModal.classList.remove('visible');
    });

    window.addEventListener('resize', () => {
        if (visualizer) visualizer.resize();
    });
}

function init() {
    updateTheme();
    
    ui.vizContainer.innerHTML = '';
    
    // Init Viz
    visualizer = new CollatzViz(ui.vizContainer, {
        interactive: true,
        scale: 1.0
    });
    
    // Init Engine
    startMainSimulation();
}

function startMainSimulation() {
    // Start with just 1
    addNode(state.useBigInt ? 1n : 1);
    updateViz();

    // Dynamically calculate the initial chain from 1 (finding loops)
    let curr = state.useBigInt ? 1n : 1;
    let chain = [];
    let visitedInChain = new Set();
    visitedInChain.add(curr);

    let merged = false;

    try {
        for (let i = 0; i < 100; i++) {
            const next = getCollatzNext(curr);

            if (next === 1 || state.nodeSet.has(next) || visitedInChain.has(next)) {
                // Link previous node to this one to close loop/connect
                if (chain.length > 0) {
                    chain[chain.length - 1].finalLinkTo = next;
                }
                merged = true;
                break;
            }

            chain.push({ val: next, fromVal: curr });
            visitedInChain.add(next);
            curr = next;
        }
    } catch (e) {
        state.stopAfterQueue = true;
    }
    
    state.chainTotal = chain.length;
    state.chainProgress = 0;
    
    // If the chain didn't close (merged) and we haven't stopped due to error,
    // it means we hit the loop limit. Set up pending state to continue calculating as we go.
    if (!merged && !state.stopAfterQueue) {
        state.isChainTotalUnknown = true;
        state.pendingFrom = curr;
        try {
            state.pendingNode = getCollatzNext(curr);
        } catch (e) {
            state.stopAfterQueue = true;
        }
    }
    
    // Add to queue
    state.queue.push(...chain);
    
    // Start the sequence loop
    processStep();
}

function togglePause() {
    if (state.isPaused) {
        // Resume
        state.isPaused = false;
        ui.pauseBtn.textContent = "Pause";
        processStep();
    } else {
        // Pause
        state.isPaused = true;
        ui.pauseBtn.textContent = "Resume";
        if (state.timer) clearTimeout(state.timer);
    }
}

function resetSimulation() {
    // Stop execution
    if (state.timer) clearTimeout(state.timer);
    state.isPaused = false;
    ui.pauseBtn.textContent = "Pause";

    // Reset Data (Keep multiplier/addend)
    state.nodes = [];
    state.links = [];
    state.nodeSet = new Set();
    state.queue = [];
    state.currentPositiveSeed = state.useBigInt ? 1n : 1;
    state.currentNegativeSeed = state.useBigInt ? 0n : 0;
    state.maxVal = state.useBigInt ? 0n : 0;
    state.minVal = state.useBigInt ? 0n : 0;
    state.currentDelay = CONFIG.initialDelay;
    state.stopAfterQueue = false;
    state.pendingNode = null;
    state.pendingFrom = null;
    state.chainTotal = 0;
    state.chainProgress = 0;
    state.isChainTotalUnknown = false;
    state.manualSeeds = [];

    // Reset UI
    ui.nodeCountEl.textContent = "0";
    ui.maxValEl.textContent = "0";
    ui.minValEl.textContent = "0";
    if (ui.chainStatsEl) {
        ui.chainProgressEl.textContent = "0";
        ui.chainTotalEl.textContent = "0";
        ui.chainStatsEl.style.opacity = 0;
    }
    ui.scannerBubble.textContent = "1";
    ui.scannerBubble.classList.remove('active');
    
    // Restart
    init();
}

function addNode(value) {
    if (state.nodeSet.has(value)) return;

    const newNode = {
        id: value,
        x: 0, // Start at center
        y: 0,
        val: value
    };

    state.nodes.push(newNode);
    state.nodeSet.add(value);

    if (state.nodes.length === 1) {
        state.maxVal = value;
        state.minVal = value;
        ui.maxValEl.textContent = state.maxVal;
        ui.minValEl.textContent = state.minVal;
    } else {
        if (value > state.maxVal) {
            state.maxVal = value;
            ui.maxValEl.textContent = state.maxVal;
        }
        if (value < state.minVal) {
            state.minVal = value;
            ui.minValEl.textContent = state.minVal;
        }
    }
}

function addLink(source, target) {
    // Check if link exists (handle both D3 node references and raw IDs)
    const exists = state.links.some(l => {
        const s = l.source.id !== undefined ? l.source.id : l.source;
        const t = l.target.id !== undefined ? l.target.id : l.target;
        return s === source && t === target;
    });

    if (exists) return;

    state.links.push({ source, target });
}

function updateViz() {
    if (visualizer) {
        visualizer.update(state.nodes, state.links, state.maxVal);
    }
}

// Main logic loop (Replaces startLoop)
function processStep() {
    // 1. If Queue has items, process one
    if (state.queue.length > 0) {
        state.chainProgress++;
        if (ui.chainStatsEl) {
            ui.chainProgressEl.textContent = state.chainProgress;
            ui.chainTotalEl.textContent = state.isChainTotalUnknown ? "?" : state.chainTotal;
            ui.chainStatsEl.style.opacity = 1;
        }

        const nextItem = state.queue.shift(); // { val, fromVal, finalLinkTo }
        let newNodeAdded = false;

        if (!state.nodeSet.has(nextItem.val)) {
            addNode(nextItem.val);
            newNodeAdded = true;

            // Position handling: spawn near source
            const newNode = state.nodes.find(n => n.id === nextItem.val);
            if (newNode) {
                if (nextItem.fromVal !== null) {
                    const sourceNode = state.nodes.find(n => n.id === nextItem.fromVal);
                    if (sourceNode) {
                        newNode.x = sourceNode.x + (Math.random() - 0.5) * 20;
                        newNode.y = sourceNode.y + (Math.random() - 0.5) * 20;
                    }
                } else {
                    // New seed: use pre-calculated position if available
                    if (nextItem.initialX !== undefined) {
                        newNode.x = nextItem.initialX;
                        newNode.y = nextItem.initialY;
                    } else {
                        newNode.x = (Math.random() - 0.5) * 60;
                        newNode.y = (Math.random() - 0.5) * 60;
                    }
                }
            }
        } 
        
        // Always try to link from previous node, even if the current node already existed
        if (nextItem.fromVal !== null) {
            addLink(nextItem.fromVal, nextItem.val);
        }

        // Link to existing graph if this is the merge point
        if (nextItem.finalLinkTo !== undefined && nextItem.finalLinkTo !== null) {
            addLink(nextItem.val, nextItem.finalLinkTo);
        }

        updateViz();
        if (newNodeAdded) playSound();

        ui.nodeCountEl.textContent = state.nodes.length;

        // Speed up
        state.currentDelay = Math.max(CONFIG.minDelay, state.currentDelay * CONFIG.acceleration);
        
        // Schedule next item
        state.timer = setTimeout(processStep, state.currentDelay / state.speedScale);

    } else {
        // 2. If Queue empty, check if we have a pending unfinished chain
        if (state.pendingNode !== null) {
            // Calculate as we go
            const curr = state.pendingNode;
            const prev = state.pendingFrom;
            
            // Dynamic extension: increase total as we discover more steps
            state.chainTotal++;

            try {
                const next = getCollatzNext(curr);
                
                const item = { val: curr, fromVal: prev };
                
                if (state.nodeSet.has(next)) {
                    // Merged!
                    item.finalLinkTo = next;
                    state.pendingNode = null;
                    state.pendingFrom = null;
                    state.isChainTotalUnknown = false;
                } else {
                    // Continue chain
                    state.pendingFrom = curr;
                    state.pendingNode = next;
                }
                
                state.queue.push(item);
                
                // Process immediately (or with small delay to maintain flow)
                state.timer = setTimeout(processStep, state.currentDelay / state.speedScale);
                
            } catch (e) {
                // Handle overflow during on-the-fly calculation
                // Show the last valid node, then stop
                state.queue.push({ val: curr, fromVal: prev });
                state.pendingNode = null;
                state.pendingFrom = null;
                state.stopAfterQueue = true;
                state.timer = setTimeout(processStep, state.currentDelay / state.speedScale);
            }
            return;
        }

        // 3. If Queue empty and no pending chain, pick new seed (after a pause)
        
        if (state.stopAfterQueue) {
            handleOverflow();
            return;
        }

        // Reset delay for next chain
        state.currentDelay = CONFIG.initialDelay;

        state.timer = setTimeout(pickNextSeed, 1000 / state.speedScale); 
    }
}

function pickNextSeed() {
    if (state.nodes.length >= CONFIG.maxNodes) return;

    if (state.manualSeeds.length > 0) {
        startSeedSequence(state.manualSeeds.shift());
        return;
    }

    // Find next valid seed
    let steps = 0;
    let n = null;
    
    // Loop until we find a number not in the set or hit safety limit
    do {
        if (state.testNegatives) {
            if (state.currentNegativeSeed < state.currentPositiveSeed) {
                state.currentNegativeSeed++;
                n = -state.currentNegativeSeed;
            } else {
                state.currentPositiveSeed++;
                n = state.currentPositiveSeed;
            }
        } else {
            state.currentPositiveSeed++;
            n = state.currentPositiveSeed;
        }
        steps++;
    } while (state.nodeSet.has(n) && steps < 10000);

    if (state.nodeSet.has(n)) return; // Could not find new number

    startSeedSequence(n);
}

function startSeedSequence(n) {
    // UI Feedback
    ui.scannerBubble.textContent = n;
    ui.scannerBubble.classList.add('active');
    if (ui.chainStatsEl) ui.chainStatsEl.style.opacity = 0.5;
    setTimeout(() => ui.scannerBubble.classList.remove('active'), 200);

    // Calculate path forward until we hit existing node or timeout
    let path = [];
    let curr = n;
    let prev = null;
    let foundMerge = false;
    const visitedInPath = new Set();
    
    const startTime = performance.now();
    const TIME_LIMIT = 2000; // 2 seconds max calculation time

    // Calculate chain
    try {
        let chainSteps = 0;
        // Increased step limit significantly, relying on time limit instead
        while (!state.nodeSet.has(curr) && !visitedInPath.has(curr) && chainSteps < 100000) {
            if (performance.now() - startTime > TIME_LIMIT) {
                break; // Stop pre-calculation
            }
            
            path.push({ val: curr, fromVal: prev });
            visitedInPath.add(curr);
            prev = curr;
            curr = getCollatzNext(curr);
            chainSteps++;
        }
        
        if (state.nodeSet.has(curr)) {
            foundMerge = true;
        } else if (visitedInPath.has(curr)) {
            // Loop detected within the new chain itself
            foundMerge = true;
        }
    } catch (e) {
        state.stopAfterQueue = true;
    }

    // If we generated any path
    if (path.length > 0) {
        state.chainTotal = path.length;
        state.chainProgress = 0;
        state.isChainTotalUnknown = false;

        if (!state.stopAfterQueue) {
            if (foundMerge) {
                // We found a connection point (either to main tree or to itself)
                path[path.length - 1].finalLinkTo = curr;

                // Pre-calculate spawn position based on connection point
                const connectionNode = state.nodes.find(node => node.id === curr);
                if (connectionNode) {
                     // Spawn new chain start roughly near the connection point
                     const angle = Math.random() * Math.PI * 2;
                     const dist = 80 + Math.random() * 40; 
                     path[0].initialX = connectionNode.x + Math.cos(angle) * dist;
                     path[0].initialY = connectionNode.y + Math.sin(angle) * dist;
                }
            } else {
                // Timed out or didn't merge: switch to "calculate as you go"
                // Don't set initialX (it will be random)
                // Set up state to continue from where we left off
                state.isChainTotalUnknown = true;
                state.pendingFrom = prev;
                state.pendingNode = curr;
            }
        }
        
        // Add to queue
        for (const item of path) {
            state.queue.push(item);
        }
    }

    // Go back to processing loop
    state.timer = setTimeout(processStep, 500 / state.speedScale);
}

// Start
setupEventListeners();
init();