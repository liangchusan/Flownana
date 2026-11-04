import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

test("video login works before generation validation in panel/composer; signed-in invalid input still cannot generate", async () => {
  for (const variant of ["composer", "panel"] as const) for (const initialPrompt of ["", "x", "A moving landscape"]) for (const authenticated of [false, true]) {
    let logins = 0;
    const source = createSourceLoader({
      react: { useEffect() {}, useMemo: (fn: () => unknown) => fn(), useRef: (value: unknown) => ({ current: value }), useState: (value: unknown) => [typeof value === "function" ? value() : value, () => {}] },
      "react-dropzone": { useDropzone: () => ({ getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false }) },
      "@/components/blocks/generation-settings": { GenerationSettings: "div" },
      "@/components/ui/button": { Button: "button" }, "@/components/ui/textarea": { Textarea: "textarea" },
      "@/components/blocks/app-toast-provider": { useToast: () => ({ showToast() {} }) },
      "next-auth/react": { useSession: () => ({ data: authenticated ? { user: { id: "fixture" } } : null, status: authenticated ? "authenticated" : "unauthenticated" }) },
      "@/lib/use-account-operation": { useAccountOperation: () => ({ capture: () => { throw new Error("must not generate"); } }) },
      "@/lib/auth-sign-in": { getSignInLabel: () => "Sign in with Google", signInForCurrentEnvironment: async () => { logins++; } },
    });
    const component = source<typeof import("../components/creation/video-creation-form")>("components/creation/video-creation-form.tsx");
    const tree = component.VideoCreationForm({ variant, initialPrompt, submissionBlocked: true, onGenerate: () => { throw new Error("must not generate"); } });
    const nodes = (node: any): any[] => node && typeof node === "object" ? [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)] : [];
    const action = nodes(tree).filter(node => node.type === "button" && node.props?.onClick && (variant === "panel" ? node.props.size === "lg" : node.props.className?.includes("ml-auto"))).at(-1);
    assert.ok(action, variant); if (!authenticated) assert.equal(action.props.disabled, false);
    await action.props.onClick(); assert.equal(logins, authenticated ? 0 : 1, `${variant}/${initialPrompt}/${authenticated}`);
  }
});
