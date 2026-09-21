const fs = require("node:fs");
const path = require("path");
const chalk = require("chalk");

// 日志工具
const log = {
	info: (msg) => console.log(chalk.cyan(`【信息】${msg}`)),
	success: (msg) => console.log(chalk.green(`【成功】${msg}`)),
	error: (msg) => console.error(chalk.red(`【错误】${msg}`)),
	warning: (msg) => console.warn(chalk.yellow(`【警告】${msg}`)),
};

// 路径处理辅助函数
const resolvePath = (...args) => path.resolve(process.cwd(), ...args);

// 错误处理函数
const exitWithError = (message) => {
	log.error(message);
	process.exit(0);
};

// 加载并验证配置
function loadApaasConfig(customModule) {
	const customModulePath = resolvePath("src/custom", customModule);
	const configPath = resolvePath(customModulePath, "apaas.json");

	if (!fs.existsSync(configPath)) {
		exitWithError(
			`自开发模块 ${customModule} 下不存在需要的 apaas.json 文件`,
		);
	}

	let apaasConfig;
	try {
		apaasConfig = JSON.parse(fs.readFileSync(configPath));
	} catch (err) {
		exitWithError(`配置文件解析失败: ${err.message}`);
	}

	return { customModulePath, configPath, apaasConfig };
}

// 验证入口文件
function validateEntry(customModulePath, entry) {
	const entryPath = resolvePath(customModulePath, entry);

	if (!fs.existsSync(entryPath)) {
		exitWithError(
			`apaas.json 指定的 entry: ${entry} 的路径错误\nerror path is ${entryPath}`,
		);
	}

	return entryPath;
}

// 构建 rslib 命令
function buildRslibCommand(customModulePath, argv = [], isWatch = false) {
	const rslibConfigPath = resolvePath(customModulePath, "rslib.config.ts");
	const hasConfig = fs.existsSync(rslibConfigPath);

	const baseCmd = ["rslib", "build"];
	if (isWatch) baseCmd.push("-w");
	if (hasConfig) baseCmd.push("-c", rslibConfigPath);
	if (argv.length > 0) baseCmd.push(...argv);

	return baseCmd;
}

module.exports = {
	log,
	resolvePath,
	exitWithError,
	loadApaasConfig,
	validateEntry,
	buildRslibCommand,
};
