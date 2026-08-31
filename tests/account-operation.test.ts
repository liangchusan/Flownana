import assert from "node:assert/strict";
import test from "node:test";
import { createSourceLoader } from "./helpers/load-source.ts";

const { createAccountOperationOwner, isAccountOperationCancelled } = createSourceLoader({})<typeof import("../lib/account-operation")>("lib/account-operation.ts");

test("operations retain their account headers and reject all callbacks after disposal", () => {
  const a = createAccountOperationOwner("account-a");
  const b = createAccountOperationOwner("account-b");
  const old = a.capture();
  assert.equal(old.headers["x-flownana-account"], "account-a");
  a.dispose();
  assert.equal(old.signal.aborted, true);
  assert.throws(old.assertCurrent, isAccountOperationCancelled);
  assert.throws(a.capture, isAccountOperationCancelled);
  assert.equal(b.capture().signal.aborted, false);
  b.capture().assertCurrent();
});

test("anonymous operations cannot omit their account header and become an authenticated write", () => {
  assert.throws(createAccountOperationOwner(null).capture, /Sign in/);
});

test("an upload token request carries the captured owner and late blob results are discarded", async () => {
  let resolveUpload!: (value: unknown) => void;
  let options: Record<string, any> = {};
  const load = createSourceLoader({ "@vercel/blob/client": { upload: (_path: string, _file: File, config: Record<string, any>) => {
    options = config;
    return new Promise((resolve) => { resolveUpload = resolve; });
  } } });
  const { uploadAccountMedia } = load<typeof import("../lib/account-media-upload")>("lib/account-media-upload.ts");
  const owner = createAccountOperationOwner("account-a");
  const promise = uploadAccountMedia(new File(["fixture"], "fixture.png", { type: "image/png" }), "image", owner.capture());
  assert.equal(options.headers["x-flownana-account"], "account-a");
  owner.dispose();
  assert.equal(options.abortSignal.aborted, true);
  resolveUpload({ url: "https://fixture.example/owned.png" });
  await assert.rejects(promise, isAccountOperationCancelled);
});
