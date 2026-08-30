# 输入与拾取

## 基本用法

在 Feature 内通过作用域 `ctx.input` 注册：

```ts
ctx.input.on(mesh, 'click', (event) => {
  console.log(event.object, event.point);
  event.stopPropagation();
});

ctx.input.on(mesh, 'pointerenter', () => {});
ctx.input.on(mesh, 'pointerleave', () => {});
```

Feature dispose 时自动解绑。

## 事件类型

`pointerdown` / `pointermove` / `pointerup` / `pointercancel` / `pointerenter` / `pointerleave` / `click` / `dblclick` / `dragstart` / `drag` / `dragend`

拖拽超过阈值后触发 drag 序列，并抑制 click。

## App 级选项

```ts
createThreeApp({
  canvas,
  input: {
    clickMoveTolerance: 4,
    dragMoveTolerance: 4,
    clickDuration: 500,
    layersMask: 1 << 1, // 仅拾取 layer 1
    pickIdKey: 'pickId', // 默认；false 关闭
    pointerMoveThrottleMs: 16,
    touchAction: 'none',
  },
});
```

## pickId

命中深层 Mesh 后，向上查找 `userData.pickId` 作为逻辑目标：

```ts
import { markPickable } from '@threxus/runtime';

const root = new Group();
markPickable(root, 'cabinet-7');
root.add(detailedMesh);

ctx.input.on(root, 'click', (e) => {
  // e.object 为带 pickId 的 root
});
```
