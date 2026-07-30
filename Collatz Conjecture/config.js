export const CONFIG = {
    nodeRadius: 14,
    linkDistance: 60,
    chargeStrength: -20,
    initialDelay: 500,   // Start speed for adding nodes
    minDelay: 20,        // Max speed
    acceleration: 0.92,  // Speed up factor per node
    seedInterval: 1500,  // (Unused in new logic, but kept for reference)
    maxNodes: 8000 // Increased from 500 to prevent early stopping
};