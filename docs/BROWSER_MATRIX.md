# Browser / Three.js matrix (M12)

## Browsers

CI / manual verification targets:

| Browser | Status |
|---------|--------|
| Chrome (latest) | Required |
| Edge (latest) | Required |
| Firefox (latest) | Required |
| Safari (latest / iOS) | Required (manual on macOS) |

## Three.js peer range

`packages/runtime` peerDependency:

```text
three: >=0.180.0 <1
```

Validate against the lowest supported (`0.180.0`) and a recent release before cutting a stable tag.

## Smoke checklist

1. `pnpm --dir packages/runtime test`
2. `pnpm --dir packages/runtime test:browser`
3. `pnpm --dir examples/vue3 test:e2e`
4. Manual: open `/cube`, orbit, click to select/highlight, use **Simulate Context Lost/Restored**, confirm diagnostics + event log, leave page (dispose).

## Example coverage map

| Roadmap sample | Current coverage |
|----------------|------------------|
| 01-basic-scene | `examples/vue3` `/cube` (+ `environmentFeature`) |
| 02-feature-dependencies | `/` lifecycle demo |
| 03-start-failure-rollback | `/factory-twin` |
| 04-assets-and-disposal | `/cube` M6 texture |
| 05-gltf-instances | `/cube` M7 |
| 06-pointer-interaction | `/cube` M8 click/hover + M11 selection/highlight |
| 07-on-demand-rendering | runtime unit tests (`renderMode`) + orbit invalidate |
| 08-postprocessing | `/cube` `postprocessingFeature` + unit tests |
| 09-context-restore | `/cube` simulate buttons + `webgl-context` unit tests |
| 10-complete-disposal | soak test (20× create/dispose) |
| M11 built-ins | `/cube` environment / orbit / selection / highlight / stats / post |
| M12 diagnostics | `/cube` `createLogger` + `inspectRuntime` panel |
