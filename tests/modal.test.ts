import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

function mockDocument(t: { after: (fn: () => void) => void }, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  });
}

test("modal uses native isolation, restores nested scroll locks and blocks dismissal while busy", (t) => {
  const documentFixture = { body: { style: { overflow: "auto" } }, activeElement: null as any };
  mockDocument(t, documentFixture);
  let effect: () => () => void;
  const { Modal } = createSourceLoader({ react: {
    useRef: () => ({ current: null }),
    useLayoutEffect: (fn: typeof effect, dependencies: unknown[]) => { assert.deepEqual(dependencies, []); effect = fn; },
  } })<typeof import("../components/ui/modal")>("components/ui/modal.tsx");
  let closes = 0;
  const mount = (dismissible = true) => {
    const tree = Modal({ onClose: () => { closes++; }, dismissible, "aria-label": "Fixture" });
    let shows = 0, hidden = 0;
    tree.props.ref.current = { showModal: () => shows++, close: () => hidden++ };
    const cleanup = effect!();
    assert.equal(shows, 1);
    return { tree, cleanup: () => { cleanup(); assert.equal(hidden, 1); } };
  };
  const parent = mount(), child = mount(false);
  assert.equal(documentFixture.body.style.overflow, "hidden");
  let prevented = 0, stopped = 0;
  const event = { key: "Escape", preventDefault: () => prevented++, stopPropagation: () => stopped++ };
  child.tree.props.onKeyDown(event); child.tree.props.onCancel(event);
  assert.equal(closes, 0); assert.equal(prevented, 2); assert.equal(stopped, 2);
  child.cleanup(); assert.equal(documentFixture.body.style.overflow, "hidden");
  parent.tree.props.onKeyDown(event); assert.equal(closes, 1);
  parent.cleanup(); assert.equal(documentFixture.body.style.overflow, "auto");
});

test("modal wraps keyboard focus in both directions and skips disabled controls", (t) => {
  const documentFixture = { activeElement: null as any };
  mockDocument(t, documentFixture);
  const { Modal } = createSourceLoader({ react: { useRef: () => ({ current: null }), useLayoutEffect: () => {} } })<typeof import("../components/ui/modal")>("components/ui/modal.tsx");
  const control = (disabled = false) => ({ tabIndex: 0, matches: () => disabled, getClientRects: () => [1], focus() { documentFixture.activeElement = this; } });
  const first = control(), last = control(), disabled = control(true);
  const tree = Modal({ onClose: () => {}, "aria-label": "Fixture" });
  let prevented = 0;
  const event = { key: "Tab", shiftKey: false, currentTarget: { querySelectorAll: () => [first, last, disabled] }, preventDefault: () => prevented++, stopPropagation: () => {} };
  documentFixture.activeElement = last;
  tree.props.onKeyDown(event); assert.equal(documentFixture.activeElement, first);
  tree.props.onKeyDown({ ...event, shiftKey: true }); assert.equal(documentFixture.activeElement, last);
  assert.equal(prevented, 2);
});
