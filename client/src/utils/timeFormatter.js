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

export const formatTimeMessage = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    const mins = now - date;
    const days = mins / (1000 * 60 * 60 * 24);

    if (days < 1) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days > 30) {
        return date.toLocaleString([], { weekday: 'short' });
    } else {
        return date.toLocaleString([], { day: "2-digit", month: "2-digit" });
    }
};

export const formatExactTime = (timestamp) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.getDay().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${hours}:${minutes} - ${day}/${month}/${year}`
};

export const getTimeAgo = (timestamp) => {
    const now = new Date();
    const sent = new Date(timestamp);
    const diffMs = now - sent;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return null;
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHr < 24) return `${diffHr} hours ago`;
    if (diffDay === 1) return "Day ago";
    return `${diffDay} ago`;
}
