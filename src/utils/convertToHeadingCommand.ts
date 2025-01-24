import * as vscode from "vscode";

export function initConvertToHeadingCommand(context: vscode.ExtensionContext) {
  /* 
    标题转换快捷键
  */
  const convertToHeadingCommand = vscode.commands.registerCommand(
    "markdownUtils.convertLineToHeading",
    (level: number) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const cursorPosition = editor.selection.active; // 获取光标位置
        const line = document.lineAt(cursorPosition.line); // 获取光标所在的行

        // 获取行文本
        let lineText = line.text.trim(); // 去掉前后空格

        if (lineText) {
          // 检测是否已经是标题
          const headingRegex = /^(#+)\s+(.*)/;
          const match = lineText.match(headingRegex);

          if (match) {
            // 如果已经是标题，去掉原有的标题符号
            lineText = match[2].trim(); // 提取标题内容
          }

          // 根据级别生成新标题
          const heading = "#".repeat(level) + " " + lineText;
          editor.edit((editBuilder) => {
            // 替换整行内容
            const lineRange = new vscode.Range(
              line.range.start,
              line.range.end
            );
            editBuilder.replace(lineRange, heading);
          });
        } else {
          vscode.window.showWarningMessage("当前行是空行，无法转换为标题！");
        }
      }
    }
  );
  context.subscriptions.push(convertToHeadingCommand);
}
