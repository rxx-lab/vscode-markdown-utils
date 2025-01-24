import * as vscode from "vscode";
import { initMdNavigator } from "./module/markdownNavigator";
import { initConvertToHeadingCommand } from "./module/convertToHeadingCommand";

// 激活插件
export function activate(context: vscode.ExtensionContext) {
  console.log("markdown utils 插件激活");
  initMdNavigator(context);
  initConvertToHeadingCommand(context);
}

export function deactivate() {
  console.log("markdown utils 释放");
}
