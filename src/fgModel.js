const recordDefault = '{"current":[],"history":[],"drop":[],"concat":{}}'

function getRandomString() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * 创建流程图数据模型实例
 * @returns fg 对象
 */
function createFgModel() {
  let fg = {
    rawConfig: undefined,
    config: undefined,
    nodes: undefined,
    record: undefined,
    link: undefined,
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
    /**
     * 构造运行任务并委托给 runFilesFn 执行
     * @param {Array} indexes 要运行的节点索引
     * @param {Function} runFilesFn (files, display) => Promise 实际执行函数
     * @param {Array} [display] 日志数组
     */
    runNodes(indexes, runFilesFn, display) {
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
      return runFilesFn(files, display)
    },
  }
  return fg
}

exports.recordDefault = recordDefault;
exports.getRandomString = getRandomString;
exports.createFgModel = createFgModel;
