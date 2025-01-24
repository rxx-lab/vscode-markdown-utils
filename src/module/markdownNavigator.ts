import * as vscode from "vscode";
import { debounce } from "../utils";

const noHeaderTxt = "没有查找到标题";
// 定义树节点
export class MarkdownNode extends vscode.TreeItem {
  public children: MarkdownNode[] = [];
  public counter: number = 0; // 记录子节点数量
  public readonly numbering: string; // 存储序号

  constructor(
    public readonly rawLabel: string, // 原始标题文本
    public readonly line: number, // 行号
    public readonly level: number, // 层级
    public readonly parent?: MarkdownNode // 父节点
  ) {
    super(
      "", // 标签稍后设置
      // 初始折叠状态设置为 None，后续根据是否有子节点动态调整
      vscode.TreeItemCollapsibleState.None
    );

    // 检测标题是否已经包含序号
    const hasNumbering = this.detectNumbering(rawLabel);

    // 生成序号
    if (level === 1) {
      this.numbering = ""; // 一级标题不显示序号
    } else if (hasNumbering) {
      this.numbering = ""; // 如果标题已经有序号，则不额外添加
    } else {
      if (parent) {
        parent.counter += 1; // 父节点计数器递增
        this.numbering = parent.numbering
          ? `${parent.numbering}.${parent.counter}`
          : `${parent.counter}`;
      } else {
        if (this.rawLabel === noHeaderTxt) {
          this.numbering = ""; // 异常情况处理
        } else {
          this.numbering = "?"; // 异常情况处理
        }
      }
    }
    // 特殊处理
    rawLabel = rawLabel.replaceAll("`", "").replaceAll("**", "");
    // 设置显示标签
    this.label =
      level === 1
        ? rawLabel
        : hasNumbering
        ? rawLabel // 如果标题已经有序号，直接使用原始标题
        : `${this.numbering} ${rawLabel}`; // 否则添加序号

    // 跳转命令
    this.command = {
      command: "markdownUtils.jumpToLine",
      title: "跳转到标题",
      arguments: [this.line],
    };
  }

  // 检测标题是否已经包含序号
  private detectNumbering(label: string): boolean {
    // 匹配常见的序号格式，如 "1", "1.", "1.1", "1.1.", "1.1 ", "1-1", "1.1.1" 等
    const numberingRegex = /^\d+([\.\-]\d+)*[\.\s]*(?=\s|$)/;
    return numberingRegex.test(label);
  }

  // 添加子节点
  addChild(child: MarkdownNode, treeView?: vscode.TreeView<MarkdownNode>) {
    this.children.push(child);

    // 如果有子节点，更新折叠状态为 Expanded
    if (this.children.length > 0) {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

      // 如果有 TreeView，自动展开当前节点
      if (treeView && this.parent) {
        treeView.reveal(this, { expand: true });
      }
    }
  }
}

// 数据提供器
export class MarkdownTreeProvider
  implements vscode.TreeDataProvider<MarkdownNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    MarkdownNode | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private treeView?: vscode.TreeView<MarkdownNode>;
  constructor(private context: vscode.ExtensionContext) {}

  // 刷新树数据
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  // 设置 TreeView
  setTreeView(treeView: vscode.TreeView<MarkdownNode>) {
    this.treeView = treeView;
  }

  // 元素转为 vscode 认识的类型
  getTreeItem(element: MarkdownNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MarkdownNode): Thenable<MarkdownNode[]> {
    // 如果有父节点，返回其子节点
    if (element) {
      return Promise.resolve(element.children);
    }
    // 没有就去构建
    return this.buildTree();
  }
  // 实现 getParent 方法
  getParent(element: MarkdownNode): vscode.ProviderResult<MarkdownNode> {
    return element.parent; // 返回当前节点的父节点
  }
  // 新增方法：构建层级树
  private async buildTree(): Promise<MarkdownNode[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "markdown") {
      return [new MarkdownNode(noHeaderTxt, 0, 0)];
    }

    const text = editor.document.getText();

    // 忽略 Front Matter (YAML 格式的元数据)
    const frontMatterRegex = /^---\s*[\s\S]*?\s*---\s*/;
    const textWithoutFrontMatter = text.replace(frontMatterRegex, "");

    // 忽略代码块中的标题
    const codeBlockRegex = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
    const textWithoutCodeBlocks = textWithoutFrontMatter.replace(
      codeBlockRegex,
      ""
    );

    const headingRegex = /^(#+)\s+(.+)/gm;
    const rootNodes: MarkdownNode[] = [];
    const stack: MarkdownNode[] = [];

    let match;
    while ((match = headingRegex.exec(textWithoutCodeBlocks))) {
      const level = match[1].length;
      const rawLabel = match[2];
      const line = editor.document.positionAt(match.index).line;

      // 寻找父节点
      let parent: MarkdownNode | undefined;
      while (stack.length > 0) {
        const lastNode = stack[stack.length - 1];
        if (lastNode.level < level) {
          parent = lastNode;
          break;
        } else {
          stack.pop();
        }
      }

      // 创建新节点，并传入父节点
      const newNode = new MarkdownNode(rawLabel, line, level, parent);

      // 如果有父节点，将新节点添加到父节点的子节点中
      if (parent) {
        parent.addChild(newNode, this.treeView); // 传入 TreeView
      } else {
        rootNodes.push(newNode);
      }

      // 将新节点推入栈中
      stack.push(newNode);
    }

    // 如果没有找到任何标题，显示提示信息
    if (rootNodes.length === 0) {
      return [new MarkdownNode(noHeaderTxt, 0, 0)];
    }

    return rootNodes;
  }
}

export function initMdNavigator(context: vscode.ExtensionContext) {
  /* 
      注册树视图 开始
    */
  const markdownNavTreeProvider = new MarkdownTreeProvider(context);
  // 监听文档变化自动刷新
  // 防抖刷新函数
  const refreshTree = debounce(() => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === "markdown") {
      markdownNavtreeView.message = "";
      markdownNavTreeProvider.refresh();
    }
  }, 500); // 500ms 防抖时间

  // 监听文档变化
  vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      refreshTree();
    }
  });
  // 监听保存事件
  // vscode.workspace.onDidSaveTextDocument((document) => {
  //   const editor = vscode.window.activeTextEditor;
  //   if (
  //     editor &&
  //     document === editor.document &&
  //     document.languageId === "markdown"
  //   ) {
  //     refreshTree();
  //   }
  // });

  // 监听编辑器切换
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.languageId === "markdown") {
      refreshTree();
    }
  });

  const markdownNavtreeView = vscode.window.createTreeView("markdownUtils", {
    treeDataProvider: markdownNavTreeProvider,
  });
  // 设置 TreeView
  markdownNavTreeProvider.setTreeView(markdownNavtreeView);

  // 注册跳转命令
  const markdownNavJumpCommand = vscode.commands.registerCommand(
    "markdownUtils.jumpToLine",
    (line: number) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // 行首位置
        const position = new vscode.Position(line, 0);
        // 光标位置
        editor.selection = new vscode.Selection(position, position);
        // 滚动到指定为止
        editor.revealRange(new vscode.Range(position, position));
      }
    }
  );

  context.subscriptions.push(markdownNavtreeView, markdownNavJumpCommand);
}
