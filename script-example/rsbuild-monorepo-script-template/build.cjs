#!/usr/bin/env node
const fs = require("fs");
const shell = require("shelljs");
const zipper = require("zip-local");
const chalk = require("chalk");
const {
	log,
	resolvePath,
	exitWithError,
	loadApaasConfig,
	validateEntry,
	buildRslibCommand,
	extractCustomArgs
} = require("./common.cjs");

function build(customModule, argv) {
	const { filteredArgv, extracted } = extractCustomArgs(argv);
	
	// 加载配置
	const { customModulePath, configPath, apaasConfig } =
		loadApaasConfig(customModule, extracted?.name ?? 'apaas.json');

	// 验证入口文件
	const entry = apaasConfig.entry
	const customModuleEntryPath = validateEntry(customModulePath, entry);
	const outputName = apaasConfig.outputName;
	const outputPath = resolvePath("zip", outputName);
	const outputZipPath = resolvePath(`zip/${outputName}.zip`);

	// 清理目标路径
	if (fs.existsSync(outputPath)) {
		fs.lstatSync(outputPath).isDirectory()
			? shell.rm("-rf", outputPath)
			: shell.rm(outputPath);
	}

	// 设置环境变量并执行构建
	process.env.PUBLIC_ENTRY = customModuleEntryPath;
	process.env.PUBLIC_OUTPUT_NAME = outputName;
	// 传递自定义参数（转为 JSON 字符串）
	process.env.PUBLIC_CUSTOM_ARGS = JSON.stringify(extracted);

	// 构建命令
	const buildCmdArray = buildRslibCommand(
		customModulePath,
		filteredArgv
	);
	const buildCmd = `npx ${buildCmdArray.join(" ")}`;
	log.info(`构建命令: ${buildCmd}`);

	// 执行构建并检查结果
	const buildResult = shell.exec(buildCmd);
	if (buildResult.code !== 0) {
		exitWithError("构建失败，无法生成压缩包。请检查构建日志获取更多信息。");
	}
	log.success(`构建 ${customModule} 模块成功！`);

	// 统计构建产物大小
	// JS 体积阈值（KB）：超过 500KB 提示警告，超过 1MB 红色警告并建议拆分新的自开发包
	const JS_WARN_KB = 500;
	const JS_ERROR_KB = 1024;
	const oversizeJsFiles = [];

	if (fs.existsSync(outputPath)) {
		log.info("构建产物大小统计:");
		const files = shell.ls("-R", outputPath);
		files.forEach((file) => {
			const filePath = resolvePath(outputPath, file);
			if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
				const stats = fs.statSync(filePath);
				const sizeKb = stats.size / 1024;
				const size = sizeKb.toFixed(2);
				const isJs = file.endsWith(".js");

				if (isJs && sizeKb >= JS_ERROR_KB) {
					console.log(chalk.red(`  ${file}: ${size} KB`));
					oversizeJsFiles.push({ file, size, level: "error" });
				} else if (isJs && sizeKb >= JS_WARN_KB) {
					console.log(chalk.yellow(`  ${file}: ${size} KB`));
					oversizeJsFiles.push({ file, size, level: "warn" });
				} else {
					log.info(`  ${file}: ${size} KB`);
				}
			}
		});

		oversizeJsFiles.forEach(({ file, size, level }) => {
			if (level === "error") {
				log.error(
					`${file} 体积为 ${size} KB，已超过 ${JS_ERROR_KB}KB，建议拆分为新的自开发包，避免影响页面加载性能。`,
				);
			} else {
				log.warning(`${file} 体积为 ${size} KB，已超过 ${JS_WARN_KB}KB，建议关注或拆分。`);
			}
		});
	}

	// 拷贝配置文件
	shell.cp("-R", configPath, `${outputPath}/`);

	// 拷贝资源文件
	apaasConfig.copyAssets.forEach((copyAsset) => {
		const assetPath = resolvePath(copyAsset);
		const outputAsset = resolvePath(
			outputPath,
			copyAsset.replace("public/", "static/"),
		);
		shell.mkdir("-p", outputAsset);
		shell.cp("-R", `${assetPath}/*`, `${outputAsset}/`);
	});

	// 清理已有压缩包
	fs.existsSync(outputZipPath) && shell.rm(outputZipPath);

	// 生成并压缩
	zipper.zip(outputPath, (error, zipped) => {
		if (error) {
			shell.rm("-r", outputPath);
			exitWithError(`生成压缩包失败: ${error}`);
			return;
		}

		zipped.compress();
		const size = (zipped.memory().length / 1024 / 1024).toFixed(2);

		zipped.save(outputZipPath, (error) => {
			if (error) {
				shell.rm("-r", outputPath);
				exitWithError(`保存压缩包失败: ${error}`);
				return;
			}

			log.success(`构建 ${outputName} 成功！压缩包大小: ${size} MB`);
			shell.rm("-r", outputPath);
		});
	});
}

// 直接使用解构赋值处理参数
const [, , customModule, ...argv] = process.argv;
build(customModule, argv);
