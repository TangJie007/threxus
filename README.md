# Threxus

为 Three.js 打造的依赖注入框架。

**实现顺序与完成标准**见 [docs/roadmap.md](./docs/roadmap.md)。

依赖约定：`@threxus/core` 仅适量使用可 tree-shake 的工具（当前为
`es-toolkit`），代码里必须 **具名导入**，禁止 `import *`。

## 项目结构

```text
packages/
  core/       @threxus/core —— Token / Module / Container / Lifecycle / Scope
  runtime/    @threxus/runtime —— Application + rAF + 约定 Token
  three/      @threxus/three —— ThreeCoreModule / EntityHost / Viewport
  vue/        @threxus/vue —— useThrexus 薄适配
examples/
  vue3/       Vue 3 + canvas 旋转立方体（开发调试）
```

## 心智模型（Three）

四层混合：DI 服务 + 原生实体 + 轻量组件 + 中间件。

```text
AppModule      组装：imports 功能模块 + 可选 THREE_VIEWPORT
FeatureModule  功能边界：providers 一个或多个 Feature / Service
Feature        DI 单例：可继承 EntityHost，spawn / 释放一类对象
Entity         普通 class：持有 Mesh，不进容器
Component      挂在 Object3D.userData，由 EntityComponentService 调度
```

- `SceneService` / `CameraService`：Three **场景图**（SceneGraph）
- core `createSceneScope`：DI **场景作用域**（SceneScope），二者不同
- 相机位姿用 `THREE_VIEWPORT`，不要写在业务 Feature 里

最小功能脚手架：

```ts
@Injectable()
class SpinFeature extends EntityHost<SpinCube> implements OnModuleInit {
  @Inject(SceneService) scenes: SceneService;
  @Inject(EntityComponentService) components: EntityComponentService;

  protected attach(e: SpinCube) {
    this.scenes.attach(e.mesh);
    this.components.add(e.mesh, new SpinComponent());
  }
  protected detach(e: SpinCube) {
    this.components.clear(e.mesh);
    this.scenes.detach(e.mesh);
  }

  onModuleInit() {
    this.spawn(new SpinCube());
  }
}

@Module({
  imports: [ThreeCoreModule],
  providers: [SpinFeature],
})
class SpinModule {}
```

## 开始使用

需要 Node.js `>=22.12.0` 与 pnpm `11.24.0`。

```bash
pnpm install
pnpm dev
```

示例 Vite 会 alias 到各包 `src`，改 `packages/*/src` 即可热更新。

正式构建：

```bash
pnpm build
pnpm --filter vue3-example build
```

## 常用命令

```bash
pnpm build       # Turbo 构建所有工作区包
pnpm typecheck   # Turbo 类型检查
pnpm test        # Turbo 测试
pnpm dev         # 并行库 watch + 示例开发服务器
```
