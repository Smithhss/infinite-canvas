import { expect, test } from "bun:test";

import { isShellNavigationActive, shellCreateNavigation, shellPrimaryNavigation, withShellFeatureFlags } from "../src/components/layout/navigation-groups";

test("shell navigation keeps home and projects distinct", () => {
    const home = shellPrimaryNavigation.find((item) => item.key === "home")!;
    const projects = shellPrimaryNavigation.find((item) => item.key === "projects")!;
    const newCanvas = shellCreateNavigation.find((item) => item.key === "new-canvas")!;

    expect(isShellNavigationActive(home, "/", "")).toBe(true);
    expect(isShellNavigationActive(home, "/canvas", "")).toBe(false);
    expect(isShellNavigationActive(projects, "/canvas", "")).toBe(true);
    expect(isShellNavigationActive(projects, "/canvas", "?ff_libtvShell=1")).toBe(true);
    expect(isShellNavigationActive(projects, "/canvas", "?mode=new")).toBe(false);
    expect(isShellNavigationActive(newCanvas, "/canvas", "?mode=new&ff_libtvShell=1")).toBe(true);
});

test("shell navigation matches nested routes without requiring an exact path", () => {
    const assets = shellPrimaryNavigation.find((item) => item.key === "assets")!;
    expect(isShellNavigationActive(assets, "/assets", "")).toBe(true);
    expect(isShellNavigationActive(assets, "/assets/archive", "")).toBe(true);
    expect(isShellNavigationActive(assets, "/asset", "")).toBe(false);
});

test("plugin hub is active only on its standalone route", () => {
    const plugins = shellPrimaryNavigation.find((item) => item.key === "plugins")!;
    expect(isShellNavigationActive(plugins, "/plugins", "?ff_pluginHub=1")).toBe(true);
    expect(isShellNavigationActive(plugins, "/plugins/archive", "?ff_pluginHub=1")).toBe(false);
    expect(isShellNavigationActive(plugins, "/", "?ff_pluginHub=1")).toBe(false);
});

test("agent hub is active only on its standalone route", () => {
    const agent = shellCreateNavigation.find((item) => item.key === "agent")!;
    expect(isShellNavigationActive(agent, "/agent", "?ff_agentSkillHub=1")).toBe(true);
    expect(isShellNavigationActive(agent, "/agent/archive", "?ff_agentSkillHub=1")).toBe(false);
    expect(isShellNavigationActive(agent, "/", "?ff_agentSkillHub=1")).toBe(false);
});

test("shell navigation preserves feature flags but drops transient query state", () => {
    expect(withShellFeatureFlags("/assets", "?mode=new&ff_libtvShell=1&ff_director3d=1")).toBe("/assets?ff_libtvShell=1&ff_director3d=1");
    expect(withShellFeatureFlags("/canvas?mode=new", "?ff_libtvShell=1&mode=recent")).toBe("/canvas?mode=new&ff_libtvShell=1");
});
