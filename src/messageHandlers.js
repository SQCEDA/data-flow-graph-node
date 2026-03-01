/**
 * @typedef {Object} MessageHandlersDeps
 * @property {import('./fgModel').ReturnType_createFgModel} fg fgModel 实例（引用，外部可变）
 * @property {() => {current:Array, history:Array, drop:Array, concat:Object}} getRecord 获取当前 record
 * @property {() => string} getRootPath 获取当前工程根目录
 * @property {() => string} getNodesPath 获取当前 nodes 文件路径
 * @property {() => Object} getFgProject 获取当前 .flowgraph.json 解析结果
 * @property {(msg: Object) => void} postMessage 向 webview 发消息
 * @property {(text: string) => Promise<void>} showText 显示日志面板
 * @property {() => (files: Array, display?: Array) => Promise<Object>} getRunFiles 获取当前 runFiles 函数
 * @property {() => (targetIndex: number, clearIpynb: boolean, restartKernel: boolean) => Promise<void>} getRunChain 获取当前 runChain 函数
 * @property {() => (indexes: Array, noRemove?: boolean, clickToShow?: boolean) => Promise<void>} getCheckSource 获取当前 checkSource 函数
 * @property {(groups: Array<[string,string]>, title: string, rootPath: string) => Promise<void>} showFilesDiff
 * @property {() => void} saveAndPushRecord 保存 record 并推送到 webview
 * @property {(deps: Object, githash: string) => Promise<{filehashmap: Object, filePayload: Object, projectfile: Object}>} buildReleasePayload
 * @property {(message: string, ...items: string[]) => Thenable<string|undefined>} showErrorMessage
 * @property {(message: string, ...items: string[]) => Thenable<string|undefined>} showInformationMessage
 * @property {(options: Object) => Thenable<string|undefined>} showInputBox
 * @property {(uri: any, options?: Object) => Thenable<any>} showTextDocument
 * @property {(section: string) => any} getConfiguration
 * @property {typeof import('vscode').Uri} Uri
 * @property {typeof import('vscode').ViewColumn} ViewColumn
 * @property {typeof import('child_process').spawnSync} spawnSyncFn
 * @property {(url: string, payload: any) => Promise<any>} postAsync
 * @property {Function} getSha1AndBase64
 * @property {string} recordDefault
 * @property {typeof import('fs')} fsModule
 * @property {typeof import('path')} pathModule
 */

/**
 * 创建 webview 消息处理器
 * @param {MessageHandlersDeps} deps
 * @returns {Object} recieveMessage 对象（command→handler 映射）
 */
function createMessageHandlers(deps) {
  const {
    fg,
    getRecord,
    getRootPath,
    getNodesPath,
    getFgProject,
    postMessage,
    showText,
    getRunFiles,
    getRunChain,
    getCheckSource,
    showFilesDiff,
    saveAndPushRecord,
    buildReleasePayload,
    showErrorMessage,
    showInformationMessage,
    showInputBox,
    showTextDocument,
    getConfiguration,
    Uri,
    ViewColumn,
    spawnSyncFn,
    postAsync,
    getSha1AndBase64,
    recordDefault,
    fsModule,
    pathModule,
  } = deps

  return {
    showFile(message) {
      let filename = pathModule.join(getRootPath(), message.filename)
      if (!fsModule.existsSync(filename)) {
        fsModule.writeFileSync(filename, '', { encoding: 'utf8' });
      }
      showTextDocument(
        Uri.file(filename),
        {
          viewColumn: ViewColumn.One,
          preserveFocus: true
        }
      )
    },
    showText(message) {
      showText(message.text)
    },
    showInfo(message) {
      showInformationMessage(message.text)
    },
    requestConfig(message) {
      postMessage({ command: 'config', content: fg.config });
    },
    requestNodes(message) {
      postMessage({ command: 'nodes', content: fg.nodes });
    },
    saveNodes(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      fsModule.writeFileSync(getNodesPath(), JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
    },
    requestRecord(message) {
      postMessage({ command: 'record', content: fg.record });
    },
    runNodes(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      fsModule.writeFileSync(getNodesPath(), JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
      fg.runNodes(message.indexes, getRunFiles())
    },
    runChain(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      fsModule.writeFileSync(getNodesPath(), JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
      getRunChain()(message.targetIndex, message.clearIpynb, message.restartKernel)
    },
    showAllDiff(message) {
      getCheckSource()(fg.nodes.map((v, i) => i), true, false)
    },
    showAllHistoryDiff(message) {
      let index = message.targetIndex
      let ctx = fg.record[index]
      if (!ctx || !ctx.filename) {
        return
      }
      let content = fsModule.readFileSync(pathModule.join(getRootPath(), ctx.filename), { encoding: 'utf8' })
      let toShow = []
      const record = getRecord()
      for (let i = record.history.length - 1; i >= 0; i--) {
        let rctx = record.history[i]
        if (rctx && rctx.content && rctx.filename == ctx.filename && rctx.content != content) {
          if (!toShow.includes(rctx.content)) toShow.push(rctx.content)
        }
      }
      if (toShow.length) showFilesDiff(toShow.map(v => [ctx.filename, v]), '与运行历史差异', getRootPath())
    },
    release(message) {
      let url = getConfiguration('flowgraph')['release-server-url']
      let author = getConfiguration('flowgraph')['release-server-author']
      const fgProject = getFgProject()
      let giturl = fgProject.giturl
      let owner = fgProject.owner
      let projectname = fgProject.projectname
      if (!url || !author || !giturl || !owner || !projectname) {
        showErrorMessage('Missing required configuration for release');
        return;
      }

      showInformationMessage(
        '选择要执行的行动',
        'push',
        'pull cover',
        'pull merge',
      ).then(action => {
        const rootPath = getRootPath()
        const result = spawnSyncFn('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: rootPath });
        var githash = 'hash1'
        if (result.status === 0) {
          githash = result.stdout.toString().trim()
        } else {
          var errorMsg = result.stderr.toString();
          showErrorMessage('调取 git rev-parse HEAD 时发生错误: ' + errorMsg);
          throw new Error(errorMsg);
        }
        showInputBox({
          prompt: 'githash',
          value: githash,
        }).then(userInput => {
          if (userInput == null) return;
          if (action === 'push') {
            buildReleasePayload({ rootPath, fgProject, fg, recordDefault, getSha1AndBase64, fsModule }, githash).then(async ({ filehashmap, filePayload, projectfile }) => {
              let log = []
              const server = url.replace(/\/$/, '')
              log.push('release push step1 ready. files: ' + Object.keys(filehashmap).length)

              // step2 /checkFile 得到缺失 hash
              let missing = []
              try {
                const allHashes = Object.values(filehashmap)
                const ret = await postAsync(server + '/checkFile', allHashes)
                const existed = new Set(ret?.hashes || [])
                missing = allHashes.filter(h => !existed.has(h))
                log.push('step2 checkFile missing: ' + missing.length + ', existed: ' + existed.size)
              } catch (error) {
                throw new Error('checkFile 失败: ' + error.message)
              }

              // step3 /submitFile 上传缺失文件
              if (missing.length) {
                const payload = {}
                missing.forEach(h => {
                  if (filePayload[h]) payload[h] = filePayload[h]
                })
                try {
                  await postAsync(server + '/submitFile', payload)
                  log.push('step3 submitFile done: ' + Object.keys(payload).length)
                } catch (error) {
                  throw new Error('submitFile 失败: ' + error.message)
                }
              } else {
                log.push('step3 skip submitFile, all exists')
              }

              // step4 /submitRelease 提交元数据
              try {
                const body = {
                  githash: userInput.trim(),
                  projectname,
                  owner,
                  author,
                  filehashmap,
                  projectfile,
                  time: new Date().toISOString(),
                }
                const ret = await postAsync(server + '/submitRelease', body)
                if (ret?.files && ret.files.length) {
                  throw new Error('submitRelease 缺失文件: ' + ret.files.join(','))
                }
                log.push('step4 submitRelease done, count: ' + (ret?.count ?? 0))
                showInformationMessage('release push 完成')
              } catch (error) {
                throw new Error('submitRelease 失败: ' + error.message)
              }

              showText(log.join('\n'))
            }).catch(err => {
              showErrorMessage('release push failed: ' + err.message)
            })
          } else if (action === 'pull cover') {

          } else if (action === 'pull merge') {

          }
        });
      })
    },
    clearSnapshot(message) {
      message.indexes.forEach(ii => delete fg.record[ii]?.snapshot)
      saveAndPushRecord()
    },
    prompt(message) {
      showInputBox({
        prompt: message.show,
        value: message.text,
      }).then(userInput => {
        postMessage({ command: 'prompt', content: userInput });
      });
    },
    requestCustom(message) {
      postMessage({ command: 'custom', content: { operate: [] } });
    },
    default(message) {
      console.log('unknown message:', message)
    }
  }
}

exports.createMessageHandlers = createMessageHandlers;
