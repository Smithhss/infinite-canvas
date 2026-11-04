import { useEffect } from "react";

import { useAgentSkillFavoriteStore } from "@/stores/use-agent-skill-favorite-store";

export function useAgentSkillFavorites() {
    const loaded = useAgentSkillFavoriteStore((state) => state.loaded);
    const loadFavorites = useAgentSkillFavoriteStore((state) => state.loadFavorites);

    useEffect(() => {
        void loadFavorites();
    }, [loadFavorites]);

    return loaded;
}
