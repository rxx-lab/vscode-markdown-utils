import * as vscode from "vscode";
import { initMdNavigator } from "./utils/markdownNavigator";
import { initConvertToHeadingCommand } from "./utils/convertToHeadingCommand";

// 激活插件
export function activate(context: vscode.ExtensionContext) {
  console.log("markdown utils 插件激活");
  initMdNavigator(context);
  initConvertToHeadingCommand(context);
}

export function deactivate() {
  console.log("markdown utils 释放");
}
