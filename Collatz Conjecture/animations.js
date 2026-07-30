import * as d3 from "d3";

export function updateNodeVisuals(nodeG, nodesSelection, colorScale, config) {
    const {
        radius,
        speedScale,
        expansionFactor = 3.5
    } = config;

    const durExpand = 400 / speedScale;
    const durHold = 1000 / speedScale;
    const durShrink = 500 / speedScale;
    const durInterrupt = 300 / speedScale;

    // Helper to determine node color (handling negatives)
    const getNodeColor = (d) => {
        let val;
        let isBig = typeof d.val === 'bigint';
        
        if (isBig) {
            val = d.val < 0n ? -d.val : d.val;
        } else {
            val = Math.abs(d.val);
        }
        
        const safeVal = Number(val) || 1; // Convert BigInt to number for scale
        
        if ((isBig && d.val < 0n) || (!isBig && d.val < 0)) {
            const base = d3.color(colorScale(safeVal));
            // Darker version for negative
            return base ? base.darker(2.0) : "#1a1a1a";
        }
        return colorScale(safeVal);
    };

    // Helper for text color (light for negative/dark backgrounds, dark for positive)
    const getTextColor = (d) => {
        const isNeg = typeof d.val === 'bigint' ? d.val < 0n : d.val < 0;
        return isNeg ? "#eeeeee" : "#1e3a5f";
    };

    // 1. Interrupt active nodes
    // Identify any nodes currently expanding/holding (active) and force them to shrink immediately.
    nodeG.selectAll(".active-node").each(function() {
        const el = d3.select(this);
        el.classed("active-node", false);

        el.select("circle").interrupt("spawn")
            .transition("interrupt-scale")
            .duration(durInterrupt)
            .attr("r", radius);

        el.select("text").interrupt("text-anim")
            .transition("interrupt-text")
            .duration(durInterrupt)
            .style("font-size", "10px")
            .attr("opacity", 1);
    });

    // 2. Update existing colors
    nodesSelection.select("circle")
        .transition("colorUpdate").duration(durInterrupt)
        .attr("fill", d => getNodeColor(d));
        
    nodesSelection.select("text")
        .style("fill", d => getTextColor(d));

    // 3. Enter new nodes
    const enterG = nodesSelection.enter().append("g")
        .attr("class", "node active-node");

    enterG.append("circle")
        .attr("r", 1)
        .attr("fill", d => getNodeColor(d))
        .transition("spawn")
        .duration(durExpand)
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr("r", radius * expansionFactor)
        .transition()
        .duration(durHold)
        .attr("r", radius * expansionFactor)
        .transition()
        .duration(durShrink)
        .ease(d3.easeCubicOut)
        .attr("r", radius)
        .on("end", function() {
            d3.select(this.parentNode).classed("active-node", false);
        });

    enterG.append("text")
        .text(d => d.val)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("font-family", "sans-serif")
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("fill", d => getTextColor(d))
        .attr("opacity", 0)
        .style("font-size", "1px")
        .transition("text-anim")
        .duration(durExpand)
        .attr("opacity", 1)
        .style("font-size", "24px")
        .transition()
        .duration(durHold)
        .style("font-size", "24px")
        .transition()
        .duration(durShrink)
        .style("font-size", "10px");

    return enterG;
}