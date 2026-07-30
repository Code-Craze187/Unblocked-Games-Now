import * as d3 from "d3";
import { CollatzEngine } from "./simulation.js";
import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { playSound } from "./audio.js";
import { getCollatzNext } from "./collatz.js";
import { updateNodeVisuals } from "./animations.js";

let activeSimulations = [];
let isGridActive = false;
let isGridPaused = false;
let lastSoundTime = 0;

let gridConfig = {
    mMin: 1, mMax: 3,
    cMin: 1, cMax: 3
};

export function getGridConfig() {
    return { ...gridConfig };
}

export function updateGridConfig(newConfig) {
    gridConfig = { ...gridConfig, ...newConfig };
}

function requestSound() {
    const now = Date.now();
    if (now - lastSoundTime > 40) {
        playSound();
        lastSoundTime = now;
    }
}

export function startGridMode(container) {
    // Clean up existing simulations if restarting
    if (activeSimulations.length > 0) {
        activeSimulations.forEach(sim => sim.stop());
        activeSimulations = [];
    }

    if (!isGridActive) {
        isGridActive = true;
        isGridPaused = false;
    }

    container.style.display = 'grid';
    container.innerHTML = '';

    const { mMin, mMax, cMin, cMax } = gridConfig;
    const rows = mMax - mMin + 1;
    const cols = cMax - cMin + 1;

    if (rows <= 0 || cols <= 0) return;

    // Set up grid layout
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    activeSimulations = [];

    // Create cells
    for(let r = 0; r < rows; r++) {
        for(let cIdx = 0; cIdx < cols; cIdx++) {
            const m = mMin + r;
            const c = cMin + cIdx;

            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            // Set background color based on theme logic
            let bgColor;
            if (m === 3 && c === 1) {
                bgColor = "#2c4a6f";
            } else {
                const hue = Math.abs((m * 47 + c * 29) % 360);
                bgColor = `hsl(${hue}, 45%, 25%)`;
            }
            cell.style.backgroundColor = bgColor;
            
            container.appendChild(cell);

            // Label
            const label = document.createElement('div');
            label.className = 'grid-label';
            label.textContent = `y = ${m}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}`;
            cell.appendChild(label);

            // Start Sim
            const sim = new MiniSim(cell, m, c);
            activeSimulations.push(sim);
        }
    }
}

export function stopGridMode(container) {
    isGridActive = false;
    isGridPaused = false;
    container.style.display = 'none';
    container.innerHTML = '';
    activeSimulations.forEach(sim => sim.stop());
    activeSimulations = [];
}

export function toggleGridPause() {
    isGridPaused = !isGridPaused;
    if (!isGridPaused) {
        // Resume all
        activeSimulations.forEach(sim => sim.loop());
    }
    return isGridPaused;
}

export function resetGrid() {
    activeSimulations.forEach(sim => sim.fullReset());
}

class MiniSim {
    constructor(container, m, c) {
        this.m = m;
        this.c = c;
        this.container = container;
        
        // Use Map for robust O(1) lookups and to prevent duplicates
        this.nodeMap = new Map(); 
        this.linkSet = new Set(); // Stores "sourceId-targetId" strings to prevent duplicate links
        this.links = []; // Array of objects for D3
        this.nodes = []; // Array for D3 force simulation
        
        this.queue = []; // For forward expansion (BFS)
        this.currentPositiveSeed = state.useBigInt ? 1n : 1;
        this.currentNegativeSeed = state.useBigInt ? 0n : 0;
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.maxVal = state.useBigInt ? 1n : 1;
        this.isOverflowed = false;
        this.hasShownOverflow = false;
        this.overflowTimer = null;
        this.nodeLimit = 200; 

        // Scaling factors for grid view
        this.scale = 1.0; 
        this.radius = CONFIG.nodeRadius * this.scale;

        this.currentDelay = CONFIG.initialDelay;

        // SVG
        this.svg = d3.select(container).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [-this.width/2, -this.height/2, this.width, this.height]);

        // Unique marker ID for this simulation instance
        const markerId = `arrow-${m}-${c}`;
        
        this.svg.append("defs").append("marker")
            .attr("id", markerId)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", this.radius + 8) 
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "rgba(100, 200, 255, 0.6)");

        this.g = this.svg.append("g");

        // Order matters: Links behind Nodes
        this.linkG = this.g.append("g").attr("class", "links-layer");
        this.nodeG = this.g.append("g").attr("class", "nodes-layer");

        // Color Scale
        this.colorScale = d3.scaleLog()
            .interpolate(d3.interpolateHcl)
            .range(["#4facfe", "#00e676", "#ffeb3b", "#ff1744"]);

        // Simulation - Pass nodes later
        this.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().distance(CONFIG.linkDistance * this.scale))
            .force("charge", d3.forceManyBody().strength(CONFIG.chargeStrength * this.scale).distanceMax(120))
            .force("collide", d3.forceCollide(this.radius + 2))
            .force("center", d3.forceCenter(0,0).strength(0.05))
            .force("wall", (alpha) => this.wallForce(alpha));

        // Initial Node
        this.addNode(state.useBigInt ? 1n : 1);
        this.queue.push(state.useBigInt ? 1n : 1);
        
        this.restart();

        // Run loop
        this.loop();
        this.simulation.on("tick", () => this.tick());
    }

    loop() {
        if (isGridPaused) return;
        if (this.isOverflowed) return;

        this.step();
        
        let delay = this.currentDelay / (state.speedScale || 1);
        if (!isFinite(delay) || delay < 10) delay = 10;

        this.timer = setTimeout(() => this.loop(), delay);
    }

    addNode(val, sourceNode = null) {
        if(this.nodeMap.has(val)) return;
        if (!state.useBigInt && (typeof val !== 'number' || isNaN(val))) return;

        if (val > this.maxVal) this.maxVal = val;

        // Initialize with safe defaults for physics
        const newNode = { 
            id: val, 
            val: val,
            x: 0, 
            y: 0,
            vx: 0,
            vy: 0
        };
        
        // Spawn near source if available
        if (sourceNode) {
            newNode.x = sourceNode.x + (Math.random() - 0.5) * 10;
            newNode.y = sourceNode.y + (Math.random() - 0.5) * 10;
        } else {
            newNode.x = (Math.random() - 0.5) * 20;
            newNode.y = (Math.random() - 0.5) * 20;
        }

        this.nodeMap.set(val, newNode);
    }

    addLink(sourceId, targetId) {
        // Strict safety check: Both nodes MUST exist in the map
        const sourceNode = this.nodeMap.get(sourceId);
        const targetNode = this.nodeMap.get(targetId);

        if (!sourceNode || !targetNode) {
            // console.warn(`Grid: skipping link ${sourceId}-${targetId}, missing node`);
            return false;
        }

        const key = `${sourceId}-${targetId}`;
        if (this.linkSet.has(key)) return false;
        
        this.linkSet.add(key);
        
        // Pass the actual objects to D3, not IDs. 
        // This prevents "node not found"
        this.links.push({ source: sourceNode, target: targetNode });
        return true;
    }

    fullReset() {
        this.stop();
        
        // Clear data
        this.nodeMap.clear();
        this.linkSet.clear();
        this.links = [];
        this.nodes = [];
        this.queue = [];
        this.currentPositiveSeed = state.useBigInt ? 1n : 1;
        this.currentNegativeSeed = state.useBigInt ? 0n : 0;
        this.maxVal = state.useBigInt ? 1n : 1;
        this.isOverflowed = false;
        this.hasShownOverflow = false;
        this.currentDelay = CONFIG.initialDelay;

        // Clear visual elements
        this.linkG.selectAll("*").remove();
        this.nodeG.selectAll("*").remove();

        // Clear overflow message if any
        const overlays = this.container.querySelectorAll('.grid-overflow-overlay');
        overlays.forEach(el => el.remove());

        // Re-init
        this.addNode(state.useBigInt ? 1n : 1);
        this.queue.push(state.useBigInt ? 1n : 1);
        
        this.restart();
        if (!isGridPaused) this.loop();
        this.simulation.alpha(1).restart();
    }

    restart() {
        if (this.isOverflowed) return;

        // Update Color Scale Domain
        const safeMax = typeof this.maxVal === 'bigint' ? Number(this.maxVal) : this.maxVal;
        const currentMax = Math.max(safeMax, 50);
        const p1 = Math.pow(currentMax, 0.33);
        const p2 = Math.pow(currentMax, 0.67);
        this.colorScale.domain([1, p1, p2, currentMax]);

        // Filter valid nodes to prevent D3 crashes
        this.nodes = Array.from(this.nodeMap.values()).filter(n => typeof n === 'object' && n !== null);

        this.simulation.nodes(this.nodes);
        this.simulation.force("link").links(this.links);
        this.simulation.alpha(0.5).restart();

        // Render Links
        const link = this.linkG.selectAll(".link")
            .data(this.links, d => {
                const s = d.source.id !== undefined ? d.source.id : d.source;
                const t = d.target.id !== undefined ? d.target.id : d.target;
                return `${s}-${t}`;
            });

        link.enter().append("path")
            .attr("class", "link") // Use standard link class
            .attr("marker-end", `url(#arrow-${this.m}-${this.c})`)
            .style("stroke-width", 1.5 * this.scale) // Manual width since CSS transition might interfere slightly, but mostly consistent
            .attr("fill", "none")
            .merge(link);
            
        link.exit().remove();

        // Render Nodes
        const node = this.nodeG.selectAll(".node")
            .data(this.nodes, d => d.id);
        
        // Use shared animation logic
        updateNodeVisuals(this.nodeG, node, this.colorScale, {
            radius: this.radius,
            speedScale: state.speedScale,
            expansionFactor: 3.5 // Same as normal mode
        });

        node.exit().remove();
    }

    tick() {
        this.linkG.selectAll(".link")
            .attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);

        this.nodeG.selectAll(".node")
            .attr("transform", d => `translate(${d.x},${d.y})`);
    }

    wallForce(alpha) {
        const pad = this.radius + 5;
        const w = this.width / 2 - pad;
        const h = this.height / 2 - pad;
        const k = 0.5 * alpha;

        for (const d of this.nodes) {
            // Safety check to prevent "vx on number" error and ensure object
            if (typeof d !== 'object' || d === null) continue;

            if (!d.vx) d.vx = 0;
            if (!d.vy) d.vy = 0;

            if (d.x < -w) d.vx += (-w - d.x) * k;
            if (d.x > w) d.vx += (w - d.x) * k;
            if (d.y < -h) d.vy += (-h - d.y) * k;
            if (d.y > h) d.vy += (h - d.y) * k;
        }
    }

    handleOverflow() {
        if (this.hasShownOverflow) return;
        this.hasShownOverflow = true;
        this.isOverflowed = true;
        this.stop();
        
        const overlay = document.createElement('div');
        overlay.className = 'grid-overflow-overlay';
        overlay.textContent = "INTEGER OVERFLOW";
        this.container.appendChild(overlay);
    }

    step() {
        if (this.isOverflowed) return;

        let changesMade = false;

        // STRATEGY 1: Forward Expansion (Expand existing nodes)
        // This is crucial for divergent series like 2x+1
        if (this.queue.length > 0) {
            this.currentDelay = Math.max(CONFIG.minDelay, this.currentDelay * CONFIG.acceleration);

            // Process one item from queue
            const uVal = this.queue.shift();
            const uNode = this.nodeMap.get(uVal);

            if (uNode) {
                try {
                    const vVal = getCollatzNext(uVal, this.m, this.c);
                    
                    let vNode = this.nodeMap.get(vVal);
                    if (!vNode) {
                        this.addNode(vVal, uNode);
                        this.queue.push(vVal);
                        changesMade = true;
                    }
                    
                    if (this.addLink(uVal, vVal)) {
                        changesMade = true;
                    }
                } catch(e) {
                    if (e.message === "OVERFLOW") {
                        // Add what we have so far, then overflow
                        // Treat as connected so we draw the partial chain
                        changesMade = true; 
                        this.isOverflowed = true;
                        this.overflowTimer = setTimeout(() => this.handleOverflow(), 500);
                    }
                }
            }
        } else {
            this.currentDelay = CONFIG.initialDelay;

            // STRATEGY 2: Find new disjoint components (Seeding)
            // If the queue is empty, try to find the next smallest number not yet visualized
            let searchLimit = 0;
            // Search up to 500 attempts per frame to find a valid new number
            while (searchLimit < 500) {
                let n = null;
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

                if (!this.nodeMap.has(n)) {
                    this.addNode(n);
                    this.queue.push(n);
                    changesMade = true;
                    break; // Found one, start processing it next frame
                }
                searchLimit++;
            }
        }

        if (changesMade) {
            this.restart();
            requestSound();
        }
    }

    stop() {
        if (this.timer) clearTimeout(this.timer);
        if (this.overflowTimer) clearTimeout(this.overflowTimer);
        this.simulation.stop();
    }
}