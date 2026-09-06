# Compiler targets

The maintainer reports that current development builds of both compilers now compile and run bundled offline graphs. The site reflects that update; no new compiler revision or execution report was supplied with it. The pinned-release results below are historical reproductions, not a claim that all current builds remain blocked.

Compilation, successful execution, and conformance are separate milestones. Neither JZ nor Porffor has a full WPT result here. Node, Deno, Bun, and LLRT have separate CI jobs; see `.github/workflows/platforms.yml`.

## JZ

JZ is an experimental engine-compilation target. Results depend on the compiler revision; do not infer current npm-release support from a successful development-build compilation.

Reproduce a release check without modifying this project's dependencies:

```sh
npm ci
npm install --prefix /tmp/waa-jz-release jz@0.9.2 --ignore-scripts
JZ_MODULE=/tmp/waa-jz-release/node_modules/jz/index.js node scripts/check-jz.mjs
```

The script bundles `test/compiler-smoke.mjs`, excluding device/codec adapters and the URL-worklet host adapter, compiles at optimization level 2, and validates emitted Wasm. It does **not** execute the result or claim that the excluded adapters work. Use `JZ_MODULE` to point at another compiler revision.

On 2026-09-05, npm JZ 0.9.2 rejected the current graph with:

```
jzify: class getters/setters are not supported — jz objects have no accessors
```

Record the exact commit when testing a development compiler; its capabilities can differ substantially from npm 0.9.2. A successful compilation still needs an execution check and then WPT coverage before promotion to a verified runtime.

The smoke graph independently runs under Node:

```sh
node --input-type=module -e "import('./test/compiler-smoke.mjs').then(async m => console.log(await m.render()))"
```

It checks finite samples, length, peak, energy, and approximate frequency. Accessors and EventTarget inheritance are part of the public Web Audio API and are not removed to satisfy compiler restrictions.

## Porffor

Tested release: **alpha 4** (a415d19, 2026-08-29), the binary `curl -fsSL https://porffor.dev/install.sh | sh` installs (`~/.local/bin/porf`), macOS arm64, 2026-09-05. npm's `porffor` 0.61.x is the frozen pre-rewrite engine; do not test against it.

The invalid-Wasm failure of 0.61.13 (`expected 2 elements on the stack for branch`, an optional call on a value read from a private `Map` field) is [Porffor #380](https://github.com/CanadaHonk/porffor/issues/380), fixed in alpha 4: `test/porffor-repro.mjs` prints `ok` under both Node and `porf --module`. The engine keeps the equivalent explicit-guard form in `src/Emitter.js`.

The bundled full smoke test then compiles and fails at execution:

```
ReferenceError: EventTarget is not defined
```

a host API the engine's `Emitter` extends. With a minimal EventTarget shim prepended, the next stop is

```
TypeError: Tried for..of on non-iterable type (in _assertNotInCurve)
```

`AudioParam#_assertNotInCurve` iterates an automation-events list, a class whose `[Symbol.iterator]()` delegates to an array's iterator; `test/porffor-iter-repro.mjs` reduces it (Node prints `6`). `porf native` on the same bundle stops at compile time with `Uncaught Error: missing #closure_env_local in onaudioprocess` (ScriptProcessorNode's setter installs a closure as `this._tick`); a small version of that shape compiles, so it has no reduction yet. All three are reported on [#380](https://github.com/CanadaHonk/porffor/issues/380#issuecomment-5554854562).

To reproduce the full bundle, use the commands in `.github/workflows/porffor.yml`: esbuild with `--main-fields=module,main` (the default browser fields pick automation-events' es5 bundle, whose Babel `_typeof` helper reassigns a function declaration, which Porffor rejects as a constant) and explicit null stubs for the optional codec/device packages, engine retained. The weekly job tracks the pinned alpha-4 release; the recorded failure is not a result for newer development builds.

## Engine boundaries

- `Emitter` is one static EventTarget subclass, not a class-producing factory.
- `src/worklet-module.js` owns URL loading and dynamic evaluation. Offline rendering does not call it; callback worklet registration remains in the engine.
- Worklet scope properties are declared together, with live clock getters and the same null prototype. URL source is UTF-8-decoded and executed as strict code without rewriting literals or directives; this is not a security sandbox.
- No public prototype chain, AudioParam precision rule, or node-processing contract is relaxed for compilation.
