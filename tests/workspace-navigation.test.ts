import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  WORKSPACE_PATHS,
  getWorkspaceDestination,
} from "../lib/workspace-navigation.ts";

test("workspace navigation uses the approved canonical routes", () => {
  assert.deepEqual(WORKSPACE_PATHS, {
    home: "/home",
    image: "/image",
    video: "/video",
    assets: "/assets",
  });
  for (const [destination, pathname] of Object.entries(WORKSPACE_PATHS)) {
    assert.equal(getWorkspaceDestination(pathname), destination);
  }
  assert.equal(getWorkspaceDestination("/ai-image"), null);
});

test("legacy media routes permanently redirect to the canonical routes", () => {
  const imageRoute = readFileSync(new URL("../app/ai-image/page.tsx", import.meta.url), "utf8");
  const videoRoute = readFileSync(new URL("../app/ai-video/page.tsx", import.meta.url), "utf8");
  assert.match(imageRoute, /permanentRedirect\("\/image"\)/);
  assert.match(videoRoute, /permanentRedirect\("\/video"\)/);
});

test("workspace sidebar exposes only the four approved destinations", () => {
  const sidebar = readFileSync(new URL("../components/blocks/workspace-sidebar.tsx", import.meta.url), "utf8");
  for (const label of ["Home", "Image", "Video", "Assets"]) {
    assert.match(sidebar, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(sidebar, /New Create/);
  assert.doesNotMatch(sidebar, /label: "Create"/);
});

test("desktop sidebar toggles use lightweight split-panel controls", () => {
  const leftSidebar = readFileSync(new URL("../components/blocks/workspace-sidebar.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/blocks/media-creation-workspace.tsx", import.meta.url), "utf8");
  assert.match(leftSidebar, /<PanelLeft className="h-4 w-4" strokeWidth=\{1\.5\}/);
  assert.doesNotMatch(leftSidebar, /PanelLeft(?:Open|Close)/);
  assert.match(workspace, /<PanelRight className="h-4 w-4" strokeWidth=\{1\.5\}/);
  assert.doesNotMatch(workspace, /PanelRight(?:Open|Close)/);
  assert.match(workspace, /aria-disabled=\{!detailsRun\}/);
});

test("sidebar upgrade is centered and has no trailing arrow", () => {
  const credits = readFileSync(new URL("../components/creation/credits-widget.tsx", import.meta.url), "utf8");
  assert.match(credits, /items-center justify-center/);
  assert.doesNotMatch(credits, /ArrowUpRight/);
});
