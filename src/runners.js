/**
 * @typedef {Object} RunnersDeps
 * @property {import('./fgModel').ReturnType_createFgModel} fg fgModel 实例（引用，外部可变）
 * @property {() => {current:Array, history:Array, drop:Array, concat:Object}} getRecord 获取当前 record
 * @property {() => string} getRootPath 获取当前工程根目录
 * @property {(text: string) => Promise<void>} showText 显示日志面板
 * @property {() => void} saveAndPushRecord 保存 record 并推送到 webview
 * @property {(msg: Object) => void} postMessage 向 webview 发消息
 * @property {(message: string, ...items: string[]) => Thenable<string|undefined>} showErrorMessage
 * @property {(message: string, ...items: string[]) => Thenable<string|undefined>} showInformationMessage
 * @property {(fullname: string, rid: string, code: string, sourcename?: string) => Promise<{output:string,error:string}>} runJupyterFn
 * @property {(message: string) => void} runTerminalFn
 * @property {typeof import('child_process').spawnSync} spawnSyncFn
 * @property {(url: string, payload: any) => Promise<any>} postAsync
 * @property {(groups: Array<[string,string]>, title: string, rootPath: string) => Promise<void>} showFilesDiff
 * @property {typeof import('fs')} fsModule
 * @property {typeof import('path')} pathModule
 * @property {Function} levelTopologicalSort
 */

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建执行引擎
 * @param {RunnersDeps} deps
 * @returns {{ runFiles: Function, runChain: Function, checkSource: Function }}
 */
function createRunners(deps) {
  const {
    fg,
    getRecord,
    getRootPath,
    showText,
    saveAndPushRecord,
    postMessage,
    showErrorMessage,
    showInformationMessage,
    runJupyterFn,
    runTerminalFn,
    spawnSyncFn,
    postAsync,
    showFilesDiff,
    fsModule,
    pathModule,
    levelTopologicalSort,
  } = deps

  /**
   * 检查源代码和record的源代码的一致性
   * @param {Array} indexes 
   * @param {Boolean} noRemove 不一致时是否移除快照. 界面点击时不移除, 运行链时移除
   * @param {Boolean} clickToShow 是否需要再点击一次确认才弹出多文件diff
   * @returns 
   */
  async function checkSource(indexes, noRemove = false, clickToShow = true) {
    if (fg.config?.Snapshot?.noCheckSource) return
    const rootPath = getRootPath()
    // 不一致时为 true
    let failCheck = await Promise.all(indexes.map(async index => {
      let ctx = fg.record[index]
      // 记录不存在 或者 记录内无源码 或者 快照不存在时 无视
      if (!ctx || !ctx.content || !ctx.snapshot) return false
      let content = await fsModule.promises.readFile(pathModule.join(rootPath, ctx.filename), { encoding: 'utf8' })
      if (ctx.content != content) {
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

    if (clickToShow) {
      // 此处需要非阻塞, 弹个消息挂着就行, 不用await
      let toShowCache = toShow.map(index => [fg.record[index].filename, fg.record[index].content]) // 此处需要捕获这个变量
      showInformationMessage(
        toShow.length + ' 个文件发生变动',
        '查看'
      ).then(result => {
        if (result === '查看') {
          showFilesDiff(toShowCache, '和运行前快照变更比较', rootPath)
        }
      })
    } else {
      await showFilesDiff(toShow.map(index => [fg.record[index].filename, fg.record[index].content]), '和快照变更比较', rootPath)
    }
  }

  async function runChain(targetIndex, clearIpynb, restartKernel) {
    // 先对终点是目标点且看有效点的大图做层级拓扑排序(全局只做一次)
    // 对终点是目标点且不看有效点的小图做层级拓扑排序(每跑一个点一次)
    // 看第一层的a_i, 分别计算其后继的反馈指向的大图的点, 且大图中的该点是a_i的先驱, 大图中的点的序构成的组合
    // 取所有a_i中组合最小的, 组合相等时选大图中序靠后的点

    fg.mode.restartKernel = restartKernel
    fg.mode.clearIpynb = clearIpynb

    const record = getRecord()
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
      let ret = await fg.runNodes([index], runFiles, display)
      if (ret.error) {
        showErrorMessage('运行期间出现错误')
        throw new Error(ret.error)
      }
      if (ret.drop && ret.maxCount && ret.drop >= ~~ret.maxCount) {
        showErrorMessage('反馈失败次数达到设定的上限')
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
    showInformationMessage('运行链完成')
  }

  async function runFiles(files, display) {
    if (display == null) display = []
    const record = getRecord()
    const rootPath = getRootPath()

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
      postMessage({ command: 'result', content: ctx });
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
          fsModule.writeFileSync(pathModule.join(rootPath, ctx.condition), '', { encoding: 'utf8' })
        }

        let fullname = pathModule.join(rootPath, filename)
        let content = fsModule.readFileSync(fullname, { encoding: 'utf8' })
        ctx.content = content

        function buildPayload(text) {
          let func = new Function('filename', 'fullname', 'content', text)
          return func(filename, fullname, content)
        }

        if (rconfig.type === 'vscode-terminal') {
          let message = rconfig.message.replaceAll('__filename__', filename).replaceAll('__fullname__', fullname).replaceAll('__content__', content)
          runTerminalFn(message)
        }
        if (rconfig.type === 'node-terminal') {
          let payload = buildPayload(rconfig.payload)
          const result = spawnSyncFn(payload[0], payload.slice(1), { encoding: 'utf8', cwd: rootPath });
          // display.push(JSON.stringify(result))
          if (result.status === 0) {
            setDoneTick(ctx, result.stdout.toString())
          } else {
            throw new Error(result.stderr.toString());
          }
        }
        if (rconfig.type === 'node-post') {
          let payload = buildPayload(rconfig.payload)
          let ret = await postAsync(
            rconfig.url,
            payload,
          );
          setDoneTick(ctx, new Function('ret', rconfig.show)(ret))
        }
        if (rconfig.type === 'concat') {
          let targetPath = pathModule.join(rootPath, rconfig.filename)
          if (targetPath in record?.concat) {
            fsModule.writeFileSync(targetPath, content + '\n', { encoding: 'utf8', flag: 'a' })
            record.concat[targetPath] += 1
          } else {
            record.concat = record.concat || {}
            fsModule.writeFileSync(targetPath, content + '\n', { encoding: 'utf8' })
            record.concat[targetPath] = 1
          }
          setDoneTick(ctx, 'write to ' + rconfig.filename)
        }
        if (rconfig.type === 'vscode-jupyter') {
          let targetPath = pathModule.join(rootPath, rconfig.filename)
          if (!fsModule.existsSync(targetPath)) {
            fsModule.writeFileSync(targetPath, '', { encoding: 'utf8' });
            await delay(100)
          }
          const result = await runJupyterFn(targetPath, rid, content, fullname)
          if (result.error) {
            throw new Error(result.error);
          } else {
            setDoneTick(ctx, result.output)
          }
        }
        if (ctx.condition) {
          let conditionResult = fsModule.readFileSync(pathModule.join(rootPath, ctx.condition), { encoding: 'utf8' })
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

  return { runFiles, runChain, checkSource }
}

exports.createRunners = createRunners;
