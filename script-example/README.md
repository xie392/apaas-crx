# 本地服务脚本示例

配合 APaaS 脚本替换插件使用的本地开发服务脚本。根据项目使用的构建工具选择对应目录，复制到业务项目的 `scripts/` 目录即可。

## 目录说明

| 目录 | 适用项目 | 构建工具 | 文件 |
|------|----------|----------|------|
| `new-template/` | **已迁移 rslib 的新模板**（如 apaas-custom-crm-web、apaas-custom-shipboard-electricity-cd、apaas-custom-enginecode） | rslib | `common.cjs` + `run.cjs` + `build.cjs` |
| `old-template/` | **未迁移的旧模板**（如 apaas-custom-technicalreview） | vue-cli-service | `run.cjs` |

两个模板的 `run.cjs` 都实现了完整的热更新链路，均可配合插件使用。

## 功能（两个模板一致）

- 静态资源服务（3000~3100 自动探测可用端口）+ CORS
- `/sse` 端点：构建产物变化后推送 `change` 通知给插件
- 300ms 防抖合并：一次构建产出多个文件只推送一条通知
- 持续构建：新模板用 `rslib build -w`，旧模板用 `vue-cli-service build --target lib --watch`

## 新模板独有

- `common.cjs` 公共工具：日志、配置加载、参数提取
- `build.cjs` 单次构建并打 ZIP 上传包，含产物体积统计与超限告警（500KB / 1MB）
- `run.cjs` 已注入 `NODE_ENV=development`，确保 rslib `buildCache` 生效、跳过压缩，热更新重建更快

## 使用

```bash
# 新模板（模块位于 apps/<模块名>/）
node scripts/run.cjs <模块名>        # 热更新开发服务
node scripts/build.cjs <模块名>      # 单次构建打 ZIP

# 旧模板（模块位于 src/custom/<模块名>/）
node scripts/run.cjs <模块名>        # 热更新开发服务
```

依赖：`express`、`cors`、`chokidar`、`chalk`；新模板的 `build.cjs` 另需 `shelljs`、`zip-local`。

## 注意事项

- 端口如果不是 3000，插件 devUrl 需对应修改
- 模块路径与项目结构不一致时，修改脚本里的 `customModulePath` 解析逻辑
- `build.cjs` 只构建一次、用于打上传包；热更新场景请使用 `run.cjs`
