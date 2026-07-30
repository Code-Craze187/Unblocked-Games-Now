import { state } from "./state.js";

export function getCollatzNext(n, multiplier = state.multiplier, addend = state.addend) {
    if (state.useBigInt) {
        const bn = BigInt(n);
        const bm = BigInt(multiplier);
        const bc = BigInt(addend);
        
        if (bn % 2n === 0n) {
            return bn / 2n;
        } else {
            return bn * bm + bc;
        }
    }

    let result;
    if (n % 2 === 0) {
        result = n / 2;
    } else {
        result = (n * multiplier) + addend;
    }
    
    // Overflow check
    if (result > Number.MAX_SAFE_INTEGER || isNaN(result) || !isFinite(result)) {
        throw new Error("OVERFLOW");
    }
    
    return result;
}

