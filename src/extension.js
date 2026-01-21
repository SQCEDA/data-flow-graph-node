const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const { spawnSync } = require('child_process');

const post = require('./post').postAsync;
const { toolbarData } = require('../board/static/toolbarData.js');
const { blockPrototype } = require('../board/static/blockPrototype.js');
const { Runtype } = require('../board/static/Runtype.js');
const { keymap } = require('../board/static/keymap.js');
const { BaseConfig } = require('../board/static/BaseConfig.js');
const { levelTopologicalSort } = require('../board/static/levelTopologicalSort.js');

const defaultConfig = Object.assign({}, BaseConfig, {
  toolbarData: toolbarData,
  blockPrototype: blockPrototype,
  Runtype: Runtype,
  keymap: keymap,
})

const templateConfig = Object.assign({}, BaseConfig, {
  Runtype: Runtype,
})

const recordDefault = '{"current":[],"history":[],"drop":[],"concat":{}}'

function getRandomString() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
const getNonce = getRandomString;

function foldingMod() {
  return vscode.workspace.getConfiguration('flowgraph')['auto-folding']
}

function loadWebviewFiles(root) {
  let main = fs.readFileSync(path.join(root, 'board', 'index.html'), { encoding: 'utf8' })
  main = main.replace(/<[^\n]*"\.\/inject\/[^\n]*>/g, s => {
    let m = /"\.\/inject\/(.*?\.)(.*?)"/.exec(s)
    let content = fs.readFileSync(path.join(root, 'board', 'inject', m[1] + m[2]), { encoding: 'utf8' })
    switch (m[2]) {
      case 'css':
        return '<style>\n' + content + '\n</style>'
      case 'js':
        return '<script type="module" crossorigin nonce="ToBeReplacedByRandomToken">\n' + content + '\n</script>'
      default:
        return s
    }
  })
  main = main.replace(/ToBeReplacedByRandomToken/g, getNonce())
  return main
}
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
  let fgPathObj = undefined // key:path
  // config 不需要通过插件修改
  let nodesPath = undefined
  let recordPath = undefined
  let record = undefined // record.current是fg.record

  let fg = {
    config: undefined,
    nodes: undefined,
    record: undefined,
    mode: { restartKernel: undefined, clearIpynb: undefined },
    // 模仿webview中的fg的部分特性
    getRandomString() {
      return getRandomString();
    },
    addLine(lsindex, leindex, lsname, lename) {
      fg.link[lsindex][leindex].push({
        lsname,
        lename,
      })
    },
    buildLines() {
      fg.link = fg.nodes.map(v => fg.nodes.map(vv => []))
      fg.nodes.forEach((v, lsindex) => {
        if (v._linkTo) for (let lsname in v._linkTo) {
          for (let deltai in v._linkTo[lsname]) {
            let lename = v._linkTo[lsname][deltai]
            let leindex = lsindex + ~~deltai
            if (leindex >= 0 && leindex < fg.nodes.length) {
              fg.addLine(lsindex, leindex, lsname, lename)
            }
          }
        }
      })
    },
    findNodeBackward(index, filterFunc) {
      // 如果无环,结果是拓扑序
      if (filterFunc == null) filterFunc = () => true
      let nodes = [] // just for hash
      let ret = []
      function getnodes(v) {
        nodes.push(v)
        let leindex = fg.nodes.indexOf(v)
        for (let lsindex = 0; lsindex < fg.nodes.length; lsindex++) {
          if (fg.link[lsindex][leindex].length) {
            let vv = fg.nodes[lsindex]
            if (nodes.indexOf(vv) === -1 && filterFunc(vv, fg.link[lsindex][leindex])) {
              getnodes(vv)
            }
          }
        }
        ret.push(v)
      }
      getnodes(fg.nodes[index])
      return ret
    },
    findNodeForward(index, filterFunc) {
      // 如果无环,结果是拓扑序
      if (filterFunc == null) filterFunc = () => true
      let nodes = []
      function getnodes(v) {
        nodes.push(v)
        let lsindex = fg.nodes.indexOf(v)
        for (let leindex = 0; leindex < fg.nodes.length; leindex++) {
          if (fg.link[lsindex][leindex].length) {
            let vv = fg.nodes[leindex]
            if (nodes.indexOf(vv) === -1 && filterFunc(vv, fg.link[lsindex][leindex])) {
              getnodes(vv)
            }
          }
        }
      }
      getnodes(fg.nodes[index])
      return nodes
    },
    runNodes(indexes, display) {
      let files = indexes.map(index => {
        let node = fg.nodes[index]
        let rid = fg.getRandomString()
        let submitTick = new Date().getTime()
        let runtype = node.runtype ? node.runtype[0] : ''
        let rconfig = fg.config.Runtype[runtype]
        let filename = Array.isArray(node.filename) ? node.filename[0] : node.filename
        let snapshotid = 'head'
        for (let si = 0; si < fg.nodes.length; si++) {
          if (fg.link[si][index].filter(l => l.lsname == 'next' && l.lename == 'previous').length) {
            snapshotid = si
            break
          }
        }

        let ret = { rid, index, snapshotid, rconfig, filename, submitTick }
        if (node.condition) {
          ret.condition = node.condition
          ret.dropid = index + ~~Object.keys(node._linkTo.drop)[0]
          if (node.maxCount) ret.maxCount = ~~node.maxCount
        }
        fg.record[index] = ret
        return ret
      })
      return runFiles(files, display)
    },
  }

  let recieveMessage = {
    showFile(message) {
      let filename = path.join(rootPath, message.filename)
      // vscode.workspace.rootPath+'/'+message.filename
      if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, '', { encoding: 'utf8' });
      }
      vscode.window.showTextDocument(
        vscode.Uri.file(filename),
        {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: true
        }
      )
    },
    showText(message) {
      showText(message.text)
    },
    showInfo(message) {
      vscode.window.showInformationMessage(message.text)
    },
    requestConfig(message) {
      currentPanel.webview.postMessage({ command: 'config', content: fg.config });
    },
    requestNodes(message) {
      currentPanel.webview.postMessage({ command: 'nodes', content: fg.nodes });
    },
    saveNodes(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      fs.writeFileSync(nodesPath, JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
    },
    requestRecord(message) {
      currentPanel.webview.postMessage({ command: 'record', content: fg.record });
    },
    runNodes(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      fs.writeFileSync(nodesPath, JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
      fg.runNodes(message.indexes)
    },
    runChain(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      fs.writeFileSync(nodesPath, JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
      runChain(message.targetIndex, message.clearIpynb, message.restartKernel)
    },
    showAllDiff(message) {
      checkSource(fg.nodes.map((v, i) => i), true, false)
    },
    showAllHistoryDiff(message) {
      let index = message.targetIndex
      let ctx = fg.record[index]
      if (!ctx || !ctx.filename) {
        return
      }
      let content = fs.readFileSync(path.join(rootPath, ctx.filename), { encoding: 'utf8' })
      let toShow = []
      for (let i = record.history.length - 1; i >= 0; i--) {
        let rctx = record.history[i]
        if (rctx && rctx.content && rctx.filename == ctx.filename && rctx.content != content) {
          if (!toShow.includes(rctx.content)) toShow.push(rctx.content)
        }
      }
      if (toShow.length) showFilesDiff(toShow.map(v => [ctx.filename, v]), '与运行历史差异')
    },
    clearSnapshot(message) {
      message.indexes.forEach(ii => delete fg.record[ii]?.snapshot)
      saveAndPushRecord()
    },
    prompt(message) {
      vscode.window.showInputBox({
        prompt: message.show,
        // ignoreFocusOut: true, // 设为true可防止点击编辑器其他区域时输入框关闭
        value: message.text, // 可设置默认值
        // valueSelection: [0, 6] // 可预设选中部分默认文本，例如选中"default"
      }).then(userInput => {
        currentPanel.webview.postMessage({ command: 'prompt', content: userInput });
      });
    },
    requestCustom(message) {
      currentPanel.webview.postMessage({ command: 'custom', content: { operate: [] } });
    },
    default(message) {
      console.log('unknown message:', message)
    }
  }

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
      fgPathObj = JSON.parse(activeTextEditor.document.getText())

      let configPath = path.join(rootPath, fgPathObj.config)
      if (!fs.existsSync(configPath)) {
        configPath = fgPathObj.config
        if (!!fs.existsSync(configPath)) {
          vscode.window.showErrorMessage('配置文件不存在');
          return '';
        }
      }
      fg.config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }))
      fg.config = Object.assign({}, defaultConfig, fg.config)

      nodesPath = path.join(rootPath, fgPathObj.nodes)
      if (!fs.existsSync(nodesPath)) {
        vscode.window.showErrorMessage('节点文件不存在');
        return '';
      }
      fg.nodes = JSON.parse(fs.readFileSync(nodesPath, { encoding: 'utf8' }))

      recordPath = path.join(rootPath, fgPathObj.record)
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
  async function showTextDiff(textA, textB, title = '文本比较') {
    // 创建唯一的 URI
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const leftUri = vscode.Uri.parse(`mydiff:left-${timestamp}-${randomId}.txt`);
    const rightUri = vscode.Uri.parse(`mydiff:right-${timestamp}-${randomId}.txt`);
    // 创建内容提供者
    const provider = new DiffContentProvider();
    // 注册内容提供者（使用自定义的 scheme 'mydiff'）
    const registration = vscode.workspace.registerTextDocumentContentProvider('mydiff', provider);
    // 设置内容
    provider.setContent(leftUri, textA);
    provider.setContent(rightUri, textB);
    try {
      // 打开 diff 视图
      await vscode.commands.executeCommand(
        'vscode.diff',
        leftUri,
        rightUri,
        title,
        {
          preview: false,  // 不在预览模式打开
          viewColumn: vscode.ViewColumn.Two
        }
      );
    } finally {
      // 清理：稍后注销提供者
      setTimeout(() => registration.dispose(), 1000);
    }
  }
  async function showFilesDiff(groups, title) {
    // 创建内容提供者
    const provider = new DiffContentProvider();
    // 注册内容提供者（使用自定义的 scheme 'mydiff'）
    const registration = vscode.workspace.registerTextDocumentContentProvider('mydiff', provider);
    try {
      const uris = groups.map(v => {
        const [filename, oldcontent] = v
        const realfile = vscode.Uri.file(path.join(rootPath, filename))
        // 创建唯一的 URI
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const leftUri = vscode.Uri.parse(`mydiff:${filename}-${timestamp}-${randomId}.txt`);
        provider.setContent(leftUri, oldcontent);
        return [realfile, leftUri, realfile]
      })
      // January 2024 (version 1.86)
      // https://code.visualstudio.com/updates/v1_86#_review-multiple-files-in-diff-editor
      // 打开 diff 视图
      await vscode.commands.executeCommand(
        'vscode.changes',
        title, // 整个多文件diff视图的标题
        uris
      );
    } finally {
      // 清理：稍后注销提供者
      setTimeout(() => registration.dispose(), 1000);
    }
  }
  /**
   * 检查源代码和record的源代码的一致性
   * @param {Array} indexes 
   * @param {Boolean} noRemove 不一致时是否移除快照. 界面点击时不移除, 运行链时移除
   * @param {Boolean} clickToShow 是否需要再点击一次确认才弹出多文件diff
   * @returns 
   */
  async function checkSource(indexes, noRemove = false, clickToShow = true) {
    if (fg.config?.Snapshot?.noCheckSource) return
    // let diff = {}
    // 不一致时为 true
    let failCheck = await Promise.all(indexes.map(async index => {
      let ctx = fg.record[index]
      // 记录不存在 或者 记录内无源码 或者 快照不存在时 无视
      if (!ctx || !ctx.content || !ctx.snapshot) return false
      let content = await fs.promises.readFile(path.join(rootPath, ctx.filename), { encoding: 'utf8' })
      if (ctx.content != content) {
        // diff[index] = content
        return true
      } else {
        return false
      }
    }))
    if (!noRemove) {
      // 待移除快照的indexes
      let toRemove = indexes.filter((v, i) => failCheck[i])
      while (toRemove.length) {
        fg.findNodeForward(toRemove.shift(), (v, lines) => {
          // 只接受next->previous的线
          if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
            return false
          }
          return true
        }).map(v => fg.nodes.indexOf(v)).forEach(ii => {
          delete fg.record[ii]?.snapshot
          if (toRemove.includes(ii)) {
            toRemove.splice(toRemove.indexOf(ii), 1)
          }
        })
      }
    }

    if (fg.config?.Snapshot?.noShowCheckSourceDiff) return
    let toShow = indexes.filter((v, i) => failCheck[i])
    if (toShow.length == 0) return
    // let textA = []
    // let textB = []
    // toShow.forEach(index => {
    //   let ctx = fg.record[index]
    //   textA.push('#%% ' + ctx.filename + '\n')
    //   textB.push('#%% ' + ctx.filename + '\n')
    //   textA.push(ctx.content)
    //   textB.push(diff[index])
    //   textA.push('\n')
    //   textB.push('\n')
    // })
    // await showTextDiff(textA.join('\n'), textB.join('\n'), '和快照变更比较');

    if (clickToShow) {
      // 此处需要非阻塞, 弹个消息挂着就行, 不用await
      let toShowCache = toShow.map(index => [fg.record[index].filename, fg.record[index].content]) // 此处需要捕获这个变量
      vscode.window.showInformationMessage(
        toShow.length + ' 个文件发生变动',
        '查看'
      ).then(result => {
        if (result === '查看') {
          showFilesDiff(toShowCache, '和运行前快照变更比较')
        }
      })
    } else {
      await showFilesDiff(toShow.map(index => [fg.record[index].filename, fg.record[index].content]), '和快照变更比较')
    }

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

  async function runChain(targetIndex, clearIpynb, restartKernel) {
    // 先对终点是目标点且看有效点的大图做层级拓扑排序(全局只做一次)
    // 对终点是目标点且不看有效点的小图做层级拓扑排序(每跑一个点一次)
    // 看第一层的a_i, 分别计算其后继的反馈指向的大图的点, 且大图中的该点是a_i的先驱, 大图中的点的序构成的组合
    // 取所有a_i中组合最小的, 组合相等时选大图中序靠后的点

    fg.mode.restartKernel = restartKernel
    fg.mode.clearIpynb = clearIpynb

    record.drop = []
    record.concat = {}

    let preorpostfunc = (index, func) => func(index, (v, lines) => {
      // 只接受next->previous的线
      if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
        return false
      }
      return true
    }).map(v => fg.nodes.indexOf(v))
    let prefunc = (index) => preorpostfunc(index, fg.findNodeBackward)
    let postfunc = (index) => preorpostfunc(index, fg.findNodeForward)

    let { ring, levels: glevels } = levelTopologicalSort(fg.nodes, prefunc(targetIndex))
    if (ring) {
      return showText('图包含环, 无法执行此功能')
    }
    let gorder = glevels.reduce((a, b) => a.concat(b))

    await checkSource(gorder, false, true)

    let torun = fg.findNodeBackward(targetIndex, (v, lines) => {
      let index = fg.nodes.indexOf(v)
      // 只接受next->previous的线
      if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
        return false
      }
      // 未设置快照 或 快照不存在
      return !v.snapshot || !(fg.record[index] && fg.record[index].snapshot)
    }).map(v => fg.nodes.indexOf(v))

    function getnext(torun, gorder) {
      let { levels } = levelTopologicalSort(fg.nodes, torun)
      if (levels[0].length == 1) {
        return levels[0][0]
      }
      let value = levels[0].map(index => {
        let pre = prefunc(index).filter(v => gorder.includes(v))
        let post = postfunc(index).filter(v => gorder.includes(v))
        let v = []
        post.forEach(lsindex => {
          pre.forEach(leindex => {
            if (fg.link[lsindex][leindex].filter(l => l.lsname == 'drop' && l.lename == 'previous').length > 0) {
              v.push(leindex)
            }
          })
        })
        v.push(999999 - gorder.indexOf(index))
        v.sort()
        return { v, index }
      })
      value.sort((a, b) => {
        let ar = Array.from(a.v)
        let br = Array.from(b.v)
        while (1) {
          let r = ar.shift() - br.shift()
          if (r != 0) return r
        }
      })
      return value[0].index
    }

    async function buildandrun(index, display) {
      let ret = await fg.runNodes([index], display)
      if (ret.error) {
        vscode.window.showErrorMessage('运行期间出现错误')
        throw new Error(ret.error)
      }
      if (ret.drop && ret.maxCount && ret.drop >= ~~ret.maxCount) {
        vscode.window.showErrorMessage('反馈失败次数达到设定的上限')
        throw new Error("drop max count")
      }
      return ret.dropid
    }

    let display = []
    while (torun.length) {
      let index = getnext(torun, gorder)
      let fail = await buildandrun(index, display)
      if (fail != null) {
        // 把fail以及后继全部无效, 在gorder内的加进torun
        postfunc(fail).forEach(index => {
          // // if (fg.record[index] && fg.record[index].snapshot) delete fg.record[index].snapshot // 在run单任务时已经执行过了
          if (gorder.includes(index) && !torun.includes(index)) torun.push(index)
        })
      } else {
        torun.splice(torun.indexOf(index), 1)
      }
    }
    fg.mode.restartKernel = undefined
    fg.mode.clearIpynb = undefined
    vscode.window.showInformationMessage('运行链完成')
  }

  async function runFiles(files, display) {
    if (display == null) display = []
    function setRunTick(ctx) {
      ctx.runTick = new Date().getTime()
      display.push(ctx.runTick + ': running...')
    }
    function setDoneTick(ctx, text, error = null) {
      ctx.doneTick = new Date().getTime()
      if (error != null) {
        ctx.error = error.stack
        display.push(ctx.doneTick + ': ' + error.stack)
      } else {
        ctx.output = text
        display.push(ctx.doneTick + ': ' + text)
        if (ctx.snapshotid in fg.record && fg.record[ctx.snapshotid].snapshot) {
          ctx.snapshot = fg.record[ctx.snapshotid].snapshot
        } else {
          ctx.snapshot = 100000 + ~~(Math.random() * 100000000)
        }
      }
      currentPanel.webview.postMessage({ command: 'result', content: ctx });
      record.history.push(ctx)
      fg.record[ctx.index] = ctx
    }
    let ctx = {};
    try {
      for (const file of files) {

        let { rid, rconfig, filename } = file
        ctx = Object.assign({}, file)
        display.push(JSON.stringify(file, null, 4))
        setRunTick(ctx)
        await showText(display.join('\n\n'))

        if (ctx.condition) {
          fs.writeFileSync(path.join(rootPath, ctx.condition), '', { encoding: 'utf8' })
        }

        let fullname = path.join(rootPath, filename)
        let content = fs.readFileSync(fullname, { encoding: 'utf8' })
        ctx.content = content

        function buildPayload(text) {
          let func = new Function('filename', 'fullname', 'content', text)
          return func(filename, fullname, content)
        }

        if (rconfig.type === 'vscode-terminal') {
          let message = rconfig.message.replaceAll('__filename__', filename).replaceAll('__fullname__', fullname).replaceAll('__content__', content)
          runTerminal(message)
        }
        if (rconfig.type === 'node-terminal') {
          let payload = buildPayload(rconfig.payload)
          const result = spawnSync(payload[0], payload.slice(1), { encoding: 'utf8', cwd: rootPath });
          // display.push(JSON.stringify(result))
          if (result.status === 0) {
            setDoneTick(ctx, result.stdout.toString())
          } else {
            throw new Error(result.stderr.toString());
          }
        }
        if (rconfig.type === 'node-post') {
          let payload = buildPayload(rconfig.payload)
          let ret = await post(
            rconfig.url,
            payload,
          );
          setDoneTick(ctx, new Function('ret', rconfig.show)(ret))
        }
        if (rconfig.type === 'concat') {
          let targetPath = path.join(rootPath, rconfig.filename)
          if (targetPath in record?.concat) {
            fs.writeFileSync(targetPath, content + '\n', { encoding: 'utf8', flag: 'a' })
            record.concat[targetPath] += 1
          } else {
            record.concat = record.concat || {}
            fs.writeFileSync(targetPath, content + '\n', { encoding: 'utf8' })
            record.concat[targetPath] = 1
          }
          setDoneTick(ctx, 'write to ' + rconfig.filename)
        }
        if (rconfig.type === 'vscode-jupyter') {
          let targetPath = path.join(rootPath, rconfig.filename)
          if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, '', { encoding: 'utf8' });
            await delay(100)
          }
          const result = await runJupyter(targetPath, rid, content, fullname)
          if (result.error) {
            throw new Error(result.error);
          } else {
            setDoneTick(ctx, result.output)
          }
        }
        if (ctx.condition) {
          let conditionResult = fs.readFileSync(path.join(rootPath, ctx.condition), { encoding: 'utf8' })
          if (conditionResult) {
            record.drop[ctx.index] = 1 + ~~record.drop[ctx.index]
            ctx.drop = record.drop[ctx.index]
            fg.findNodeForward(ctx.dropid, (v, lines) => {
              // 只接受next->previous的线
              if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
                return false
              }
              return true
            }).map(v => fg.nodes.indexOf(v)).forEach(ii => delete fg.record[ii]?.snapshot)
            // 达到 maxcount 报错不放在此处处理
            ctx.conditionResult = conditionResult
            display.push('drop ' + ctx.drop + ': ' + conditionResult)
            await showText(display.join('\n\n'))
            saveAndPushRecord()
            return { dropid: ctx.dropid, drop: ctx.drop, maxCount: ~~ctx.maxCount, display }
          }
        }
      }
      await showText(display.join('\n\n'))
      saveAndPushRecord()
      return { done: '', display }
    } catch (error) {
      setDoneTick(ctx, error.stack, error)
      await showText(display.join('\n\n'))
      saveAndPushRecord()
      return { error, display }
    }

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
      edit.insert(editor.selection.active, '#rid:' + rid + '\n__file__ = r"' + sourcename + '"\n' + code);
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

    currentPanel.webview.html = getWebviewContent(currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'board/static'))));
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
        fs.writeFileSync(prefix + '.flowgraph.json', `{"config": "${basename}.config.json","nodes": "${basename}.nodes.json","record": "${basename}.record.json"}`, { encoding: 'utf8' });
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

function getWebviewContent(cdnpath) {
  return webviewContent.replace('./static', cdnpath)
}