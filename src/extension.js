const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const { spawnSync } = require('child_process');

const post = require('./post').postAsync;
const { toolbarData } = require('../board/static/toolbarData.js');
const { blockPrototype } = require('../board/static/blockPrototype.js');
const { Runtype } = require('../board/static/Runtype.js');
const { keymap } = require('../board/static/keymap.js');
const { levelTopologicalSort } = require('../board/static/levelTopologicalSort.js');

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
  const recordDefault = '{"current":[],"history":[],"drop":[]}'

  let fg = {
    config: undefined,
    nodes: undefined,
    record: undefined,
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
      runChain(message.targetIndex)
    },
    clearSnapshot(message) {
      message.indexes.forEach(ii => delete fg.record[ii].snapshot)
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
      if (!fg.config.toolbarData) fg.config.toolbarData = toolbarData
      if (!fg.config.blockPrototype) fg.config.blockPrototype = blockPrototype
      if (!fg.config.keymap) fg.config.keymap = keymap
      if (!fg.config.Runtype) fg.config.Runtype = Runtype

      nodesPath = path.join(rootPath, fgPathObj.nodes)
      if (!fs.existsSync(nodesPath)) {
        vscode.window.showErrorMessage('节点文件不存在');
        return '';
      }
      fg.nodes = JSON.parse(fs.readFileSync(nodesPath, { encoding: 'utf8' }))

      recordPath = path.join(rootPath, fgPathObj.record)
      if (!fs.existsSync(recordPath)) {
        fs.writeFileSync(recordPath, recordDefault, { encoding: 'utf8' });
      }
      record = JSON.parse(fs.readFileSync(recordPath, { encoding: 'utf8' }))
      fg.record = record.current

      if (fg.config.custom) {
        fg.config.custom.extension.forEach(operate => {
          if (operate.type === 'script') {
            let func = new Function('fg', 'recieveMessage', operate.function)
            func(fg, recieveMessage)
          }
        })
      }

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

  async function runChain(targetIndex) {
    // 先对终点是目标点且看有效点的大图做层级拓扑排序(全局只做一次)
    // 对终点是目标点且不看有效点的小图做层级拓扑排序(每跑一个点一次)
    // 看第一层的a_i, 分别计算其后继的反馈指向的大图的点, 且大图中的该点是a_i的先驱, 大图中的点的序构成的组合
    // 取所有a_i中组合最小的, 组合相等时选大图中序靠后的点

    record.drop = []

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
          fs.writeFileSync(targetPath, content + '\n', { encoding: 'utf8', flag: 'a' })
          setDoneTick(ctx, 'write to ' + rconfig.filename)
        }
        if (rconfig.type === 'vscode-jupyter') {
          let targetPath = path.join(rootPath, rconfig.filename)
          const result = await runJupyter(targetPath, rid, content)
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
  async function runJupyter(fullname, rid, code) {
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(fullname), 'jupyter-notebook')
    await vscode.commands.executeCommand('jupyter.notebookeditor.addcellbelow')
    await delay(1000)
    let editor = vscode.window.activeTextEditor;
    await editor.edit(edit => {
      edit.insert(editor.selection.active, '#rid:' + rid + '\n' + code);
    })
    //jupyter.runcurrentcell 等等都不工作, 只找到 jupyter.runAndDebugCell 能跑...
    await vscode.commands.executeCommand('jupyter.runAndDebugCell')
    let done = false
    let outputs = undefined
    while (!done) {
      await delay(1000)
      let nbt = JSON.parse(fs.readFileSync(fullname, { encoding: 'utf8' }))
      for (const cell of nbt.cells) {
        if (cell.cell_type == 'code' && cell.source && cell.source[0] == '#rid:' + rid + '\n') {
          done = cell.execution_count != null
          outputs = cell.outputs
          break
        }
      }
    }
    let ret = { output: [], error: [] }
    outputs.forEach(v => {
      try {
        if (v.output_type == 'stream') {
          ret.output.push(v.text.join(''))
        } else if (v.output_type == 'execute_result') {
          ret.output.push(v.data["text/plain"].join(''))
        } else if (v.output_type == 'error') {
          ret.error.push(v.traceback.join('\n').replace(/\u001b\[[0-9;]*m/g, ''))
        }
      } catch (error) {
      }
    })
    ret.output = ret.output.join('\n')
    ret.error = ret.error.join('\n')
    // build output from ret
    await delay(1000)
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
    vscode.commands.registerCommand('flowgraph.debug1', async () => {

      let filename = '/home/zhaouv/e/git/github/data-flow-graph-node/demo/w1.ipynb'
      // const editor = vscode.window.showTextDocument(
      //   vscode.Uri.file(filename),
      //   {
      //     viewColumn: vscode.ViewColumn.One,
      //     preserveFocus: true,
      //     preview: true,
      //     selection: new vscode.Range(999999, 0, 999999, 0)
      //   }
      // )
      let ret;
      ret = await runJupyter(filename, getRandomString(), 'print(123);import time;time.sleep(3);print(456);a.append("' + getRandomString() + '");print(a)')
      ret = await runJupyter(filename, getRandomString(), 'print(123);import time;time.sleep(3);print(456);a.append("' + getRandomString() + '");print(a)')
      ret = await runJupyter(filename, getRandomString(), 'print(123);import time;time.sleep(3);print(456);a.append("' + getRandomString() + '");print(a);1/0')
      // 奇怪bug导致每一节新的运行, 上一个会被多运行一次...
      // ['ScLYkoK4XBDSH2ra49S59bYzepmVVNUl','ScLYkoK4XBDSH2ra49S59bYzepmVVNUl','aVKSnS6zUy4OSAEtuP8kUq2dPRNZO3x4','aVKSnS6zUy4OSAEtuP8kUq2dPRNZO3x4','vo5LHYIFnRIA2hKqnzFxKpQTlJgCYc5Q']
      // delay 1000 后好了
      vscode.window.showInformationMessage('submit done: ' + JSON.stringify(ret))
      // 一次只能搞两个... 看来还是要扫文件来判定结束
      // 也是只管提交不等结束就执行这里了
      // vscode.window.showInformationMessage(vscode.window.activeTextEditor.document.getText()) // 没用只能拿到当前cell不是整个文件

    })
    // https://stackoverflow.com/questions/72912713/programmatically-execute-cell-jupyter-vscode
    // 用类似这个方案来做, 维护一个ipython, 自己写成ipynb
    // 或者找找没有用脚本和jupyter交互的机制
    // def execute_cell(filepath,cell_number_range=[0]):
    // import io
    // from  nbformat import current
    // with io.open(filepath) as f:
    //     nb = current.read(f, 'json')
    // ip = get_ipython()
    // for cell_number in cell_number_range:
    //     cell=nb.worksheets[0].cells[cell_number]
    //     #print (cell)
    //     if cell.cell_type == 'code' : ip.run_cell(cell.input)

    // 或者换一个思路, jupyter的第一节运行一个特殊的server, 然后node和这个server交互, 这个server自己能后续操作这个jupyter本身
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