export function getSourceWeight(source: string): number {
    switch (source) {
        case "empresa": return 1.0;
        case "peer": return 0.7;
        case "cliente": return 0.5;
        default: return 0.3;
    }
}

export function getContextWeight(context: string): number {
    switch (context) {
        case "jefe": return 1.0;
        case "equipo": return 0.8;
        case "ocasional": return 0.4;
        default: return 0.5;
    }
}

export function getTimeWeight(date: Date): number {
    const months = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (months < 6) return 1.0;
    if (months < 12) return 0.7;
    return 0.4;
}