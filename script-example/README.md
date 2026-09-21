# 本地服务脚本示例

配合 APaaS 脚本替换插件使用的本地开发服务脚本。根据项目使用的构建工具和工程结构选择对应模板，将 `lib/` 和所选模板目录一起复制到业务项目的 `scripts/` 即可。

## 目录说明

```
script-example/
├── lib/                                    # 公共模块（三个模板共用）
│   ├── utils.cjs                           #   日志 / 路径 / 错误处理
│   ├── hot-server.cjs                      #   get-port 端口探测 / 静态服务+SSE / 防抖产物监听
│   ├── rsbuild.cjs                         #   参数提取 / rslib 命令拼装
│   └── build-utils.cjs                     #   输出清理 / 资源拷贝 / 体积告警 / 打 ZIP
├── rsbuild-monorepo-script-template/       # rslib monorepo（如 apaas-custom-crm-web）
│   ├── run.cjs                             #   热更新开发服务（薄壳：路径解析 + 构建命令）
│   ├── common.cjs                          #   差异点 1：apps/<模块名>/apaas.json 解析
│   └── build.cjs                           #   单次构建打 ZIP 上传包
├── rsbuild-script-template/                # rslib 单仓（如 apaas-custom-shipboard-electricity-cd、apaas-custom-enginecode）
│   ├── run.cjs                             #   热更新开发服务（薄壳）
│   └── build.js                            #   单次构建打 ZIP 上传包
└── vue-cli-script-template/                # vue-cli 旧工程（如 apaas-custom-technicalreview）
    └── run.cjs                             #   热更新开发服务（薄壳）
```

## 公共模块 vs 差异点

三个模板的热更新链路完全一致（静态资源服务 3000~3100 自动探测端口 + CORS + `/sse` 变更通知 + 300ms 防抖合并推送），公共部分已抽到 [`lib/`](./lib/)。每个模板只剩两个差异点，写在各自的 `run.cjs` 顶部注释里：

| 模板 | 差异点 1：apaas.json 解析路径 | 差异点 2：打包命令 |
|------|------------------------------|-------------------|
| `rsbuild-monorepo-script-template` | `apps/<模块名>/apaas.json`，产物在 `zip/<outputName>/` | `rslib build -w`（走 common.cjs 的 buildRslibCommand） |
| `rsbuild-script-template` | `src/custom/<模块名>/apaas.json`，产物在 `<outputName>/` | `rslib build -w` |
| `vue-cli-script-template` | `src/custom/<模块名>/apaas.json`，产物在 `<outputName>/` | `vue-cli-service build --target lib --watch` |

rsbuild 模板的构建子进程额外注入 `NODE_ENV=development`，确保 `buildCache` 生效、跳过压缩，热更新重建更快（3-5 秒 → 1 秒内）。

## 使用

```bash
# 复制 lib/ + 所选模板目录到业务项目的 scripts/ 后：

# rsbuild monorepo
node scripts/run.cjs <模块名>        # 热更新开发服务
node scripts/build.cjs <模块名>      # 单次构建打 ZIP

# rsbuild 单仓
node scripts/run.cjs <模块名>        # 热更新开发服务
node scripts/build.js <模块名>       # 单次构建打 ZIP

# vue-cli 旧工程
node scripts/run.cjs <模块名>        # 热更新开发服务
```

### 依赖安装

在业务项目根目录执行：

```bash
pnpm add -D express@^5.1.0 cors@^2.8.5 chokidar@^4.0.3 chalk@^4.1.2 get-port@^7.1.0 shelljs@^0.10.0 zip-local@^0.3.5
```

版本说明：
- **chalk 必须用 v4**：v5 起改为 ESM-only，CJS 脚本 `require("chalk")` 会直接报错
- **get-port 用 v7**：ESM-only 包，脚本内已用动态 `import()` 加载，无需额外处理
- **express v5**：如项目里已有 express v4 也可用 v4，脚本未用到 v5 独有 API

## 注意事项

- 端口如果不是 3000，插件 devUrl 需对应修改
- 模块路径与项目结构不一致时，改 `run.cjs` 里的 `resolveContext()`（差异点 1）
- `build` 脚本只构建一次、用于打上传包；热更新场景请使用 `run.cjs`
