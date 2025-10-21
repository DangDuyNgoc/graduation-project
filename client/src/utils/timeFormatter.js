export const formatLateDuration = (minutes) => {
    if (!minutes || minutes <= 0) return "0 minutes";
    if (minutes < 60) {
        return `${minutes} minute`;
    }
    if (minutes % 60 === 0) return `${minutes / 60} hour`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} hour ${mins} minute`;
}