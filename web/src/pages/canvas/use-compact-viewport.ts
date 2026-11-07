import { useEffect, useState } from "react";

const COMPACT_VIEWPORT_QUERY = "(max-width: 639px)";

export function useCompactViewport() {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const query = window.matchMedia(COMPACT_VIEWPORT_QUERY);
        const sync = () => setMatches(query.matches);
        sync();
        query.addEventListener("change", sync);
        return () => query.removeEventListener("change", sync);
    }, []);

    return matches;
}
