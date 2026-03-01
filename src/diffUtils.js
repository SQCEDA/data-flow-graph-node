const path = require("path");

class DiffContentProvider {
  constructor() {
    this.contentMap = new Map();
  }
  provideTextDocumentContent(uri) {
    return this.contentMap.get(uri.toString()) || '';
  }
  setContent(uri, content) {
    this.contentMap.set(uri.toString(), content);
  }
}

/**
 * @typedef {Object} VscodeDiffApi
 * @property {typeof import('vscode').Uri} Uri
 * @property {typeof import('vscode').ViewColumn} ViewColumn
 * @property {import('vscode').workspace} workspace
 * @property {import('vscode').commands} commands
 */

/**
 * 创建 diff 工具集
 * @param {VscodeDiffApi} vscodeApi
 */
function createDiffUtils(vscodeApi) {
  const { Uri, ViewColumn, workspace, commands } = vscodeApi

  /**
   * 两段文本的 diff 视图
   * @param {string} textA
   * @param {string} textB
   * @param {string} [title='文本比较']
   */
  async function showTextDiff(textA, textB, title = '文本比较') {
    // 创建唯一的 URI
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const leftUri = Uri.parse(`mydiff:left-${timestamp}-${randomId}.txt`);
    const rightUri = Uri.parse(`mydiff:right-${timestamp}-${randomId}.txt`);
    // 创建内容提供者
    const provider = new DiffContentProvider();
    // 注册内容提供者（使用自定义的 scheme 'mydiff'）
    const registration = workspace.registerTextDocumentContentProvider('mydiff', provider);
    // 设置内容
    provider.setContent(leftUri, textA);
    provider.setContent(rightUri, textB);
    try {
      // 打开 diff 视图
      await commands.executeCommand(
        'vscode.diff',
        leftUri,
        rightUri,
        title,
        {
          preview: false,  // 不在预览模式打开
          viewColumn: ViewColumn.Two
        }
      );
    } finally {
      // 清理：稍后注销提供者
      setTimeout(() => registration.dispose(), 1000);
    }
  }

  /**
   * 多文件 diff 视图
   * @param {Array<[string, string]>} groups  每项 [filename, oldcontent]
   * @param {string} title
   * @param {string} rootPath 工程根目录
   */
  async function showFilesDiff(groups, title, rootPath) {
    // 创建内容提供者
    const provider = new DiffContentProvider();
    // 注册内容提供者（使用自定义的 scheme 'mydiff'）
    const registration = workspace.registerTextDocumentContentProvider('mydiff', provider);
    try {
      const uris = groups.map(v => {
        const [filename, oldcontent] = v
        const realfile = Uri.file(path.join(rootPath, filename))
        // 创建唯一的 URI
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const leftUri = Uri.parse(`mydiff:${filename}-${timestamp}-${randomId}.txt`);
        provider.setContent(leftUri, oldcontent);
        return [realfile, leftUri, realfile]
      })
      // January 2024 (version 1.86)
      // https://code.visualstudio.com/updates/v1_86#_review-multiple-files-in-diff-editor
      // 打开 diff 视图
      await commands.executeCommand(
        'vscode.changes',
        title, // 整个多文件diff视图的标题
        uris
      );
    } finally {
      // 清理：稍后注销提供者
      setTimeout(() => registration.dispose(), 1000);
    }
  }

  return { showTextDiff, showFilesDiff }
}

exports.DiffContentProvider = DiffContentProvider;
exports.createDiffUtils = createDiffUtils;
