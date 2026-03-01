const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const { spawnSync } = require('child_process');

const post = require('./post').postAsync;
const getSha1AndBase64 = require('./getSha1AndBase64').getSha1AndBase64;
const { levelTopologicalSort } = require('../board/static/levelTopologicalSort.js');

const { defaultConfig, templateConfig } = require('./fgConfig.js');
const { loadWebviewFiles, getWebviewContent } = require('./webviewLoader.js');
const { recordDefault, getRandomString, createFgModel } = require('./fgModel.js');
const { DiffContentProvider, createDiffUtils } = require('./diffUtils.js');
const { buildReleasePayload } = require('./release.js');
const { createRunners } = require('./runners.js');
const { createMessageHandlers } = require('./messageHandlers.js');

const webviewContent = loadWebviewFiles(path.join(__dirname, '..'));

/** @param {vscode.ExtensionContext} context */
function activate(context) {

  /** @type {vscode.WebviewPanel | undefined} */
  let currentPanel = undefined;

  /** @type {vscode.TextEditor | undefined} */
  let currentEditor = undefined;

  /** @type {vscode.TextDocument | undefined} */
  let showTextPanel = undefined
  // let webviewState = {}
  let rootPath = undefined
  let fgProject = undefined // key:path
  // config 不需要通过插件修改
  let nodesPath = undefined
  let recordPath = undefined
  let record = undefined // record.current是fg.record

  let fg = createFgModel()

  const { showTextDiff, showFilesDiff } = createDiffUtils({
    Uri: vscode.Uri,
    ViewColumn: vscode.ViewColumn,
    workspace: vscode.workspace,
    commands: vscode.commands,
  })

  let runFiles, runChain, checkSource

  let recieveMessage = {}

  function showText(text) {
    if (showTextPanel == undefined || showTextPanel.isClosed) {
      return vscode.workspace.openTextDocument({
        content: text,
        encoding: 'utf8', language: 'log'
      }).then(document => {
        showTextPanel = document
        vscode.window.showTextDocument(
          showTextPanel,
          vscode.ViewColumn.One,
          true
        )
      })
    } else {
      return vscode.window.showTextDocument(
        showTextPanel,
        vscode.ViewColumn.One,
        true
      ).then((editor) => editor.edit(edit => {
        edit.replace(new vscode.Range(0, 0, 999999, 0), text);
      }))
    }
  }

  function loadFlowGraphAndConfig() {
    let activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor || activeTextEditor.document.isClosed || !activeTextEditor.document.fileName.endsWith('.flowgraph.json')) {
      vscode.window.showErrorMessage('No active .flowgraph.json file');
      return '';
    }
    rootPath = path.dirname(activeTextEditor.document.fileName)
    currentEditor = activeTextEditor;
    try {
      fgProject = JSON.parse(activeTextEditor.document.getText())

      let configPath = path.join(rootPath, fgProject.config)
      if (!fs.existsSync(configPath)) {
        configPath = fgProject.config
        if (!!fs.existsSync(configPath)) {
          vscode.window.showErrorMessage('配置文件不存在');
          return '';
        }
      }
      fg.rawConfig = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }))
      fg.config = Object.assign({}, defaultConfig, fg.rawConfig)

      nodesPath = path.join(rootPath, fgProject.nodes)
      if (!fs.existsSync(nodesPath)) {
        vscode.window.showErrorMessage('节点文件不存在');
        return '';
      }
      fg.nodes = JSON.parse(fs.readFileSync(nodesPath, { encoding: 'utf8' }))

      recordPath = path.join(rootPath, fgProject.record)
      if (!fs.existsSync(recordPath)) {
        fs.writeFileSync(recordPath, recordDefault, { encoding: 'utf8' });
        record = JSON.parse(recordDefault)
      } else {
        record = JSON.parse(fs.readFileSync(recordPath, { encoding: 'utf8' }))
      }
      fg.record = record.current

      fg.config?.custom?.extension?.forEach(operate => {
        if (operate.type === 'script') {
          let func = new Function('fg', 'recieveMessage', operate.function)
          func(fg, recieveMessage)
        }
      })

      // vscode.window.showInformationMessage('config:'+JSON.stringify(fg.config))
    } catch (error) {
      vscode.window.showErrorMessage(error.stack);
    }

    // vscode.window.showInformationMessage(activeTextEditor.document.fileName)
    return activeTextEditor.document.fileName
  }

  /** @type {vscode.Terminal | undefined} */
  let terminal = undefined;
  function runTerminal(message) {
    if (!terminal || terminal.exitStatus) terminal = vscode.window.createTerminal({
      name: 'Flow Graph',
      cwd: rootPath
    });
    terminal.show();
    terminal.sendText(message);
  }

  function saveAndPushRecord() {
    currentPanel.webview.postMessage({ command: 'record', content: fg.record });
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 4), { encoding: 'utf8' });
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async function runJupyter(fullname, rid, code, sourcename = '') {
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(fullname), 'jupyter-notebook')
    await delay(200)
    if (fg.mode.clearIpynb) {
      await vscode.commands.executeCommand('jupyter.notebookeditor.removeallcells')
      fg.mode.clearIpynb = undefined
    }
    if (fg.mode.restartKernel) {
      await vscode.commands.executeCommand('jupyter.restartkernel') // 这个指令微软没做成结束才返回
      await delay(100) // 只能强行填个延时来等待结束...
      // 以及要配合 "jupyter.askForKernelRestart": false
      fg.mode.restartKernel = undefined
    }
    await vscode.commands.executeCommand('notebook.focusBottom')
    await vscode.commands.executeCommand('notebook.cell.insertCodeCellBelow')
    await delay(400)
    const nbeditor = vscode.window.activeNotebookEditor;
    let editor = vscode.window.activeTextEditor;
    await editor.edit(edit => {
      edit.insert(editor.selection.active, '#rid:' + rid + '\n__fg_file__ = r"' + sourcename + '"\n' + code);
    })
    await delay(200)
    await vscode.commands.executeCommand('notebook.cell.execute')
    let robj = nbeditor.notebook.getCells().slice(-1)[0]
    robj = { outputs: robj.outputs, executionSummary: robj.executionSummary }
    // vscode.window.showInformationMessage(JSON.stringify(robj))
    // console.log(robj)
    let ret = { output: [], error: [] }
    robj.outputs.forEach(v => {
      try {
        if (v.metadata.outputType == 'stream') {
          ret.output.push(v.items.map(v => v.data.toString()).join(''))
        } else if (v.metadata.outputType == 'execute_result') {
          ret.output.push(v.items.map(v => v.data.toString()).join(''))
        } else if (v.metadata.outputType == 'error') {
          ret.error.push(v.metadata.originalError.traceback.join('\n').replace(/\u001b\[[0-9;]*m/g, ''))
        }
      } catch (error) {
      }
    })
    ret.output = ret.output.join('\n')
    ret.error = ret.error.join('\n')
    return ret
  }

  const _runners = createRunners({
    fg,
    getRecord: () => record,
    getRootPath: () => rootPath,
    showText,
    saveAndPushRecord: () => saveAndPushRecord(),
    postMessage: (msg) => currentPanel.webview.postMessage(msg),
    showErrorMessage: (t, ...items) => vscode.window.showErrorMessage(t, ...items),
    showInformationMessage: (t, ...items) => vscode.window.showInformationMessage(t, ...items),
    runJupyterFn: (...args) => runJupyter(...args),
    runTerminalFn: (msg) => runTerminal(msg),
    spawnSyncFn: spawnSync,
    postAsync: post,
    showFilesDiff,
    fsModule: fs,
    pathModule: path,
    levelTopologicalSort,
  })
  runFiles = _runners.runFiles
  runChain = _runners.runChain
  checkSource = _runners.checkSource

  Object.assign(recieveMessage, createMessageHandlers({
    fg,
    getRecord: () => record,
    getRootPath: () => rootPath,
    getNodesPath: () => nodesPath,
    getFgProject: () => fgProject,
    postMessage: (msg) => currentPanel.webview.postMessage(msg),
    showText,
    getRunFiles: () => runFiles,
    getRunChain: () => runChain,
    getCheckSource: () => checkSource,
    showFilesDiff,
    saveAndPushRecord: () => saveAndPushRecord(),
    buildReleasePayload,
    showErrorMessage: (t, ...items) => vscode.window.showErrorMessage(t, ...items),
    showInformationMessage: (t, ...items) => vscode.window.showInformationMessage(t, ...items),
    showInputBox: (opts) => vscode.window.showInputBox(opts),
    showTextDocument: (uri, opts) => vscode.window.showTextDocument(uri, opts),
    getConfiguration: (section) => vscode.workspace.getConfiguration(section),
    Uri: vscode.Uri,
    ViewColumn: vscode.ViewColumn,
    spawnSyncFn: spawnSync,
    postAsync: post,
    getSha1AndBase64,
    recordDefault,
    fsModule: fs,
    pathModule: path,
  }))

  function createNewPanel() {
    if (!loadFlowGraphAndConfig()) return;
    // Create and show panel
    currentPanel = vscode.window.createWebviewPanel(
      'flowgraph',
      'Flow Graph',
      vscode.ViewColumn.Two,
      {
        // Enable scripts in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'board'))]
      }
    );

    currentPanel.webview.html = getWebviewContent(webviewContent, currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'board/static'))));
    // Handle messages from the webview
    currentPanel.webview.onDidReceiveMessage(
      message => {

        if (message.command in recieveMessage) {
          recieveMessage[message.command](message)
        } else {
          recieveMessage.default(message)
        }
      },
      undefined,
      context.subscriptions
    );

    currentPanel.onDidDispose(
      () => {
        currentPanel = undefined;
      },
      undefined,
      context.subscriptions
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('flowgraph.initProject', async () => {

      async function initProject() {
        let defaultpath = path.join(vscode.workspace.rootPath, 'a1').toString()
        let userInput = await vscode.window.showInputBox({
          prompt: 'input path',
          // ignoreFocusOut: true, // 设为true可防止点击编辑器其他区域时输入框关闭
          value: defaultpath, // 可设置默认值
          valueSelection: [defaultpath.length - 2, defaultpath.length] // 可预设选中部分默认文本，例如选中"default"
        })
        if (userInput == null) return
        let dirname = path.dirname(userInput)
        let basename = path.basename(userInput)
        let prefix = path.join(dirname, basename)
        fs.writeFileSync(prefix + '.flowgraph.json', `{"config": "${basename}.config.json","nodes": "${basename}.nodes.json","record": "${basename}.record.json","giturl": "http://xx/xx.git","project": "path/to/${basename}.flowgraph.json","owner": "user0","projectname": "${basename}"}`, { encoding: 'utf8' });
        fs.writeFileSync(prefix + '.config.json', JSON.stringify(templateConfig, null, 4), { encoding: 'utf8' });
        fs.writeFileSync(prefix + '.nodes.json', JSON.stringify([{
          "text": "new",
          "filename": "a.py",
          "_pos": {
            "left": 0,
            "top": 100,
            "width": 100,
            "height": 100
          }
        }], null, 4), { encoding: 'utf8' });
        await vscode.window.showTextDocument(
          vscode.Uri.file(prefix + '.flowgraph.json'),
          {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true
          }
        )
        await vscode.commands.executeCommand('flowgraph.editFlowGraph')
      }

      async function debug_jupyter(params) {
        let rid = getRandomString()
        let code = 'print(123);import time;time.sleep(1);print(456);a.append("' + rid + '");print(a)'
        // let code='print(123);import time;time.sleep(1);print(456);{1:2}'

        let fullname = '/home/zhaouv/e/git/github/data-flow-graph-node/demo/workspace.ipynb'
        let fullname2 = '/home/zhaouv/e/git/github/data-flow-graph-node/demo/w1.ipynb'
        let ret;

        ret = await runJupyter(fullname, getRandomString(), 'print(123);import time;time.sleep(3);print(456);a.append("' + getRandomString() + '");print(a)')
        ret = await runJupyter(fullname2, getRandomString(), 'print(123);import time;time.sleep(3);print(456);a.append("' + getRandomString() + '");print(a)')
        ret = await runJupyter(fullname, getRandomString(), 'print(123);import time;time.sleep(3);print(456);a.append("' + getRandomString() + '");print(a);1/0')

        vscode.window.showInformationMessage('submit done: ' + JSON.stringify(ret))
      }

      async function debug_diff(params) {

        // 创建唯一的 URI
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const leftUri = vscode.Uri.parse(`mydiff:left-${timestamp}-${randomId}.txt`);
        const rightUri = vscode.Uri.parse(`mydiff:right-${timestamp}-${randomId}.txt`);
        const leftUri2 = vscode.Uri.parse(`mydiff:left2-${timestamp}-${randomId}.txt`);
        const rightUri2 = vscode.Uri.parse(`mydiff:right2-${timestamp}-${randomId}.txt`);
        // 创建内容提供者
        const provider = new DiffContentProvider();
        // 注册内容提供者（使用自定义的 scheme 'mydiff'）
        const registration = vscode.workspace.registerTextDocumentContentProvider('mydiff', provider);
        // 设置内容
        provider.setContent(leftUri, `print('a')\na=999;import sys;print(f'123{a}3123');print(sys.argv)`);
        provider.setContent(rightUri, `print('a')\na=999;import sys;print(f'123{a}32117563');print(sys.argv)`);
        provider.setContent(leftUri2, '{\n    "version": "1.0.0"\n}');
        provider.setContent(rightUri2, '{\n    "version": "2.0.0",\n    "debug": true\n}');

        const realfile1 = vscode.Uri.file('/home/zhaouv/e/git/github/data-flow-graph-node/demo/a.py')
        const realfile2 = vscode.Uri.file('/home/zhaouv/e/git/github/data-flow-graph-node/demo/b.py')

        let toShow = [
          "print('a') \na=999;import sys;print(f'123{a}321123');print(sys.argv)",
          "print('fa') \na=999;import sys;print(f'123{a}321123');print(sys.argv)",
          "print('ag') \na=999;import sys;print(f'123{a}321123');print(sys.argv)",
        ]
        const uris = toShow.map(v => {
          const oldcontent = v
          const filename = 'a.py'
          const realfile = vscode.Uri.file(path.join('/home/zhaouv/e/git/github/data-flow-graph-node/demo/', filename))
          // const realfile = realfile1
          // 创建唯一的 URI
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 15);
          const leftUri = vscode.Uri.parse(`mydiff:${filename}-${timestamp}-${randomId}.txt`);
          provider.setContent(leftUri, oldcontent);
          return [realfile, leftUri, realfile]
        })
        try {
          // January 2024 (version 1.86)
          // https://code.visualstudio.com/updates/v1_86#_review-multiple-files-in-diff-editor
          // 打开 diff 视图
          await vscode.commands.executeCommand(
            'vscode.changes',
            '代码审查变更集', // 整个多文件diff视图的标题
            uris
            // [
            //   [rightUri, leftUri, rightUri],
            //   [rightUri2, leftUri2, rightUri2],
            //   [realfile1, leftUri, realfile1],
            //   [realfile1, realfile2, realfile1],
            // ]
          );
        } finally {
          // 清理：稍后注销提供者
          setTimeout(() => registration.dispose(), 1000);
        }

      }

      async function debug_infoclick(params) {
        const result = await vscode.window.showInformationMessage(
          '你想要执行什么操作？',
          '按钮1 - 执行操作A',
          '按钮2 - 执行操作B',
          '取消'
        );

        // 根据用户点击的按钮执行相应的函数
        if (result === '按钮1 - 执行操作A') {
          vscode.window.showInformationMessage('操作A');
          // executeFunctionA();
        } else if (result === '按钮2 - 执行操作B') {
          // executeFunctionB();
          vscode.window.showInformationMessage('操作B');
        } else {
          vscode.window.showInformationMessage('操作已取消');
        }
      }

      // debug_jupyter()
      // debug_diff()
      // debug_infoclick()

      initProject()

    })

  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowgraph.editFlowGraph', () => {
      if (currentPanel) {
        currentPanel.reveal();
      } else {
        createNewPanel()
      }
    })
  );

}
exports.activate = activate;