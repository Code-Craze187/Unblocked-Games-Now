import * as d3 from "d3";
import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { updateNodeVisuals } from "./animations.js";

export class CollatzViz {
    constructor(container, options = {}) {
        this.container = container;
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.options = {
            scale: 1.0,
            interactive: true,
            markerId: 'arrow',
            ...options
        };
        
        this.init();
    }

    init() {
        this.svg = d3.select(this.container).append("svg")
            .attr("viewBox", [-this.width / 2, -this.height / 2, this.width, this.height]);
        
        // Define marker
        this.svg.append("defs").append("marker")
            .attr("id", this.options.markerId)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", (CONFIG.nodeRadius * this.options.scale) + 8)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "rgba(100, 200, 255, 0.6)");

        this.g = this.svg.append("g");

        // Wall
        this.wall = this.g.append("rect")
            .attr("class", "wall-boundary")
            .attr("x", -this.width / 2 + 20)
            .attr("y", -this.height / 2 + 20)
            .attr("width", Math.max(10, this.width - 40))
            .attr("height", Math.max(10, this.height - 40))
            .style("opacity", state.wallsEnabled ? 1 : 0);

        this.linkG = this.g.append("g").attr("class", "links-layer");
        this.nodeG = this.g.append("g").attr("class", "nodes-layer");

        // Zoom
        if (this.options.interactive) {
            this.zoom = d3.zoom()
                .scaleExtent([0.1, 4])
                .on("zoom", (event) => this.g.attr("transform", event.transform));
            this.svg.call(this.zoom).on("dblclick.zoom", null);
        }

        // Physics
        this.simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(d => d.id).distance(CONFIG.linkDistance * this.options.scale))
            .force("charge", d3.forceManyBody().strength(CONFIG.chargeStrength * this.options.scale).distanceMax(180))
            .force("collide", d3.forceCollide(CONFIG.nodeRadius * this.options.scale))
            .force("x", d3.forceX().strength(0.001))
            .force("y", d3.forceY().strength(0.001))
            .force("wallRepulsion", (alpha) => this.forceWallRepulsion(alpha));

        this.simulation.on("tick", () => this.ticked());
        
        this.colorScale = d3.scaleLog().interpolate(d3.interpolateHcl);
    }

    update(nodes, links, maxVal) {
        const safeMax = typeof maxVal === 'bigint' ? Number(maxVal) : maxVal;
        const currentMax = Math.max(safeMax, 50);
        const p1 = Math.pow(currentMax, 0.33);
        const p2 = Math.pow(currentMax, 0.67);
        this.colorScale
            .domain([1, p1, p2, currentMax])
            .range(["#4facfe", "#00e676", "#ffeb3b", "#ff1744"]);

        const radius = CONFIG.nodeRadius * this.options.scale;

        // Links
        const link = this.linkG.selectAll(".link")
            .data(links, d => {
                const s = d.source.id !== undefined ? d.source.id : d.source;
                const t = d.target.id !== undefined ? d.target.id : d.target;
                return `${s}-${t}`;
            });

        link.enter().append("path")
            .attr("class", "link")
            .attr("marker-end", `url(#${this.options.markerId})`)
            .style("stroke-width", 1.5 * this.options.scale)
            .merge(link);
        link.exit().remove();

        // Nodes
        const node = this.nodeG.selectAll(".node")
            .data(nodes, d => d.id);

        // Use shared animation logic
        const nodeEnter = updateNodeVisuals(this.nodeG, node, this.colorScale, {
            radius: radius,
            speedScale: state.speedScale,
            expansionFactor: 3.5
        });
        
        if (this.options.interactive) {
             nodeEnter.call(d3.drag()
                .on("start", (e,d) => this.dragstarted(e,d))
                .on("drag", (e,d) => this.dragged(e,d))
                .on("end", (e,d) => this.dragended(e,d)));
        }

        node.exit().remove();

        // Physics update
        const density = Math.min(nodes.length / CONFIG.maxNodes, 1);
        const newLinkDist = CONFIG.linkDistance * this.options.scale * (1 - 0.3 * density); 
        const newCharge = CONFIG.chargeStrength * this.options.scale * (1 - 0.5 * density); 

        this.simulation.nodes(nodes);
        this.simulation.force("link").links(links).distance(newLinkDist);
        this.simulation.force("charge").strength(newCharge);
        this.simulation.alpha(0.5).restart();
    }

    ticked() {
        this.linkG.selectAll(".link")
            .attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);

        if (state.wallsEnabled) {
            const r = CONFIG.nodeRadius * this.options.scale + 2;
            const halfW = this.width / 2;
            const halfH = this.height / 2;
            this.nodeG.selectAll(".node")
                .attr("transform", d => {
                    d.x = Math.max(-halfW + r, Math.min(halfW - r, d.x));
                    d.y = Math.max(-halfH + r, Math.min(halfH - r, d.y));
                    return `translate(${d.x},${d.y})`;
                });
        } else {
            this.nodeG.selectAll(".node")
                .attr("transform", d => `translate(${d.x},${d.y})`);
        }
    }

    forceWallRepulsion(alpha) {
        if (!state.wallsEnabled) return;
        const padding = 60; 
        const strength = 0.4; 
        const halfW = this.width / 2;
        const halfH = this.height / 2;

        const nodes = this.simulation.nodes();
        for (const node of nodes) {
            if (node.x < -halfW + padding) node.vx += ((-halfW + padding) - node.x) * strength * alpha;
            else if (node.x > halfW - padding) node.vx -= (node.x - (halfW - padding)) * strength * alpha;
            if (node.y < -halfH + padding) node.vy += ((-halfH + padding) - node.y) * strength * alpha;
            else if (node.y > halfH - padding) node.vy -= (node.y - (halfH - padding)) * strength * alpha;
        }
    }

    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.svg.attr("viewBox", [-this.width / 2, -this.height / 2, this.width, this.height]);
        this.wall
            .attr("x", -this.width / 2 + 20)
            .attr("y", -this.height / 2 + 20)
            .attr("width", Math.max(10, this.width - 40))
            .attr("height", Math.max(10, this.height - 40));
    }
    
    updateWallVisibility() {
        this.wall.transition().duration(300).style("opacity", state.wallsEnabled ? 1 : 0);
        if (state.wallsEnabled) this.simulation.alpha(0.5).restart();
    }
}