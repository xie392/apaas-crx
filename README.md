# APaaS 脚本替换工具

这是一个 Chrome 扩展，用于将网页中的 JS 或 CSS 链接替换成用户上传的自定义文件。

## 功能特点

1. **多应用管理**：创建、编辑和删除多个替换应用
2. **包文件上传**：每个应用可以上传多个包（压缩文件）
3. **URL 匹配规则**：配置精确的 URL 匹配规则，决定何时触发替换
4. **应用切换**：轻松启用/禁用应用
5. **实时查看**：在 popup 中查看当前页面替换的脚本信息

## 使用说明

### 安装扩展

1. 使用 `npm run build` 或 `pnpm build` 构建扩展
2. 打开 Chrome，进入扩展管理页面 (`chrome://extensions/`)
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"，选择项目中的 `build/chrome-mv3-dev` 目录

### 配置应用

1. 点击扩展图标，然后点击"管理应用"进入选项页面
2. 点击"创建新应用"按钮
3. 填写应用名称和 URL 匹配规则（每行一个，支持通配符）
4. 上传包文件（ZIP 格式）
   - 包必须包含 `apaas.json` 文件，其中需要指定 `outputName` 字段
   - 压缩包中的文件命名格式应为 `{outputName}.umd.js` 或 `{outputName}.css`
5. 保存应用

### 使用替换功能

1. 访问满足 URL 匹配规则的网页
2. 扩展会自动替换页面中的 JS/CSS 文件
3. 点击扩展图标查看当前页面替换的脚本

### 包文件格式

上传的 ZIP 包必须包含以下内容：

- `apaas.json` 文件，包含 `outputName` 字段
- JS 文件（命名为 `{outputName}.umd.js`）
- CSS 文件（命名为 `{outputName}.css`）

例如，如果 `apaas.json` 中 `outputName` 为 "app"，则：
- JS 文件应命名为 `app.umd.js`
- CSS 文件应命名为 `app.css`

## 技术栈

- TypeScript
- React
- Tailwind CSS
- shadcn UI
- Plasmo 框架
- IndexedDB 存储

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建扩展
npm run build

# 打包扩展
npm run package
```

## Getting Started

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

You can start editing the popup by modifying `popup.tsx`. It should auto-update as you make changes. To add an options page, simply add a `options.tsx` file to the root of the project, with a react component default exported. Likewise to add a content page, add a `content.ts` file to the root of the project, importing some module and do some logic, then reload the extension on your browser.

For further guidance, [visit our Documentation](https://docs.plasmo.com/)

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
