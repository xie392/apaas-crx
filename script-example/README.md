# 本地服务脚本示例

配合 APaaS 脚本替换插件使用的本地开发服务脚本。根据项目使用的构建工具和工程结构选择对应目录，复制到业务项目的 `scripts/` 目录即可。

## 目录说明

| 目录 | 适用项目 | 构建工具 | 文件 |
|------|----------|----------|------|
| `rsbuild-monorepo-script-template/` | rslib/RSBuild monorepo 工程（模块位于 `apps/<模块名>/`），如 apaas-custom-crm-web | rslib | `common.cjs` + `run.cjs` + `build.cjs` |
| `rsbuild-script-template/` | rslib/RSBuild 单仓工程（模块位于 `src/custom/<模块名>/`），如 apaas-custom-shipboard-electricity-cd、apaas-custom-enginecode | rslib | `server.js` + `build.js` + `common.cjs` |
| `vue-cli-script-template/` | 未迁移的 vue-cli 旧工程（如 apaas-custom-technicalreview） | vue-cli-service | `run.cjs` |

三个模板的热更新服务都实现了完整链路，均可配合插件使用。

## 功能（三个模板一致）

- 静态资源服务（3000~3100 自动探测可用端口）+ CORS
- `/sse` 端点：构建产物变化后推送 `change` 通知给插件
- 300ms 防抖合并：一次构建产出多个文件只推送一条通知
- 持续构建：rslib 模板用 `rslib build -w`，vue-cli 模板用 `vue-cli-service build --target lib --watch`

## rsbuild 模板独有

- 已注入 `NODE_ENV=development`，确保 rslib `buildCache` 生效、跳过压缩，热更新重建更快（3-5 秒 → 1 秒内）
- monorepo 模板的 `build.cjs` 含产物体积统计与超限告警（500KB / 1MB）

## 使用

```bash
# rsbuild monorepo（模块位于 apps/<模块名>/）
node scripts/run.cjs <模块名>        # 热更新开发服务
node scripts/build.cjs <模块名>      # 单次构建打 ZIP

# rsbuild 单仓（模块位于 src/custom/<模块名>/）
node scripts/server.js <模块名>      # 热更新开发服务
node scripts/build.js <模块名>       # 单次构建打 ZIP

# vue-cli 旧工程（模块位于 src/custom/<模块名>/）
node scripts/run.cjs <模块名>        # 热更新开发服务
```

依赖：`express`、`cors`、`chokidar`、`chalk`；含 `build` 脚本的模板另需 `shelljs`、`zip-local`。

## 注意事项

- 端口如果不是 3000，插件 devUrl 需对应修改
- 模块路径与项目结构不一致时，修改脚本里的 `customModulePath` 解析逻辑
- `build` 脚本只构建一次、用于打上传包；热更新场景请使用 `run.cjs` / `server.js`
