/**
 * runners (createRunners) 单元测试
 * 纯 Node.js 测试，vscode 依赖通过 mock 注入
 *
 * 运行: node --test src/test/runners.test.js
 */
const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { createRunners } = require('../runners.js')
const { createFgModel } = require('../fgModel.js')
const { levelTopologicalSort } = require('../../board/static/levelTopologicalSort.js')

// ---------- mock helpers ----------

/** 创建一个收集调用记录的 spy 函数 */
function spy(returnValue) {
  const fn = function (...args) {
    fn.calls.push(args)
    if (typeof returnValue === 'function') return returnValue(...args)
    return returnValue
  }
  fn.calls = []
  return fn
}

/** 创建 mock fs 模块（基于内存 Map） */
function createMockFs(files = {}) {
  const store = { ...files }
  return {
    existsSync(p) { return p in store },
    readFileSync(p, opts) {
      if (!(p in store)) throw new Error('ENOENT: ' + p)
      return store[p]
    },
    writeFileSync(p, data, opts) {
      if (opts && opts.flag === 'a') {
        store[p] = (store[p] || '') + data
      } else {
        store[p] = data
      }
    },
    promises: {
      readFile(p, opts) {
        if (!(p in store)) return Promise.reject(new Error('ENOENT: ' + p))
        return Promise.resolve(store[p])
      }
    },
    _store: store,
  }
}

/** 构建基础 deps 用于 createRunners */
function makeBaseDeps(overrides = {}) {
  const fg = createFgModel()
  fg.nodes = [
    { name: 'A', runtype: ['py'], filename: 'a.py', _linkTo: { next: { '1': 'previous' } } },
    { name: 'B', runtype: ['py'], filename: 'b.py' },
  ]
  fg.record = [undefined, undefined]
  fg.config = { Runtype: { py: { type: 'node-terminal', payload: 'return ["echo", content]' } } }
  fg.buildLines()

  const record = { current: [], history: [], drop: [], concat: {} }
  const rootPath = '/proj'
  const fsModule = createMockFs({
    [path.join(rootPath, 'a.py')]: 'print("a")',
    [path.join(rootPath, 'b.py')]: 'print("b")',
  })

  return {
    fg,
    getRecord: () => record,
    getRootPath: () => rootPath,
    showText: spy(Promise.resolve()),
    saveAndPushRecord: spy(),
    postMessage: spy(),
    showErrorMessage: spy(Promise.resolve()),
    showInformationMessage: spy(Promise.resolve()),
    runJupyterFn: spy(Promise.resolve({ output: 'jupyter ok', error: '' })),
    runTerminalFn: spy(),
    spawnSyncFn: spy({ status: 0, stdout: 'ok', stderr: '' }),
    postAsync: spy(Promise.resolve({})),
    showFilesDiff: spy(Promise.resolve()),
    fsModule,
    pathModule: path,
    levelTopologicalSort,
    _record: record,
    _rootPath: rootPath,
    ...overrides,
  }
}

// ---------- runFiles tests ----------

describe('runFiles', () => {
  describe('node-terminal', () => {
    it('成功执行并设置 snapshot 和 output', async () => {
      const deps = makeBaseDeps()
      const { runFiles } = createRunners(deps)

      // 先通过 fg.runNodes 构造 files
      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })

      // 实际执行
      const result = await runFiles(files)
      assert.ok(!result.error, 'should not error')
      assert.equal(result.done, '')

      // ctx 被写入 record
      const ctx = deps.fg.record[0]
      assert.ok(ctx)
      assert.ok(ctx.output !== undefined)
      assert.ok(ctx.snapshot !== undefined)
      assert.ok(ctx.runTick)
      assert.ok(ctx.doneTick)

      // record.history 被推入
      assert.equal(deps._record.history.length, 1)

      // postMessage 被调用（result 类型）
      assert.ok(deps.postMessage.calls.length > 0)
      assert.equal(deps.postMessage.calls[0][0].command, 'result')
    })

    it('spawnSync 失败时返回 error', async () => {
      const deps = makeBaseDeps({
        spawnSyncFn: spy({ status: 1, stdout: '', stderr: 'compile error' }),
      })
      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })

      const result = await runFiles(files)
      assert.ok(result.error)

      // ctx.error 被设置
      const ctx = deps.fg.record[0]
      assert.ok(ctx.error)
    })
  })

  describe('vscode-terminal', () => {
    it('调用 runTerminalFn 并替换占位符', async () => {
      const deps = makeBaseDeps()
      deps.fg.config.Runtype.term = {
        type: 'vscode-terminal',
        message: 'python __filename__ at __fullname__',
      }
      deps.fg.nodes[0].runtype = ['term']

      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })
      await runFiles(files)

      // runTerminalFn 应被调用, 且占位符被替换
      assert.equal(deps.runTerminalFn.calls.length, 1)
      const msg = deps.runTerminalFn.calls[0][0]
      assert.ok(msg.includes('a.py'))
      assert.ok(!msg.includes('__filename__'))
    })
  })

  describe('node-post', () => {
    it('调用 postAsync 并使用 show 函数提取结果', async () => {
      const deps = makeBaseDeps()
      deps.fg.config.Runtype.post = {
        type: 'node-post',
        payload: 'return { data: content }',
        url: 'http://localhost:8000/run',
        show: 'return JSON.stringify(ret)',
      }
      deps.fg.nodes[0].runtype = ['post']
      deps.postAsync = spy(Promise.resolve({ result: 'ok' }))

      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })
      await runFiles(files)

      assert.equal(deps.postAsync.calls.length, 1)
      assert.equal(deps.postAsync.calls[0][0], 'http://localhost:8000/run')

      // output 应为 show 函数的返回值
      const ctx = deps.fg.record[0]
      assert.ok(ctx.output)
      assert.ok(ctx.snapshot)
    })
  })

  describe('concat', () => {
    it('首次写入覆盖，再次写入追加', async () => {
      const rootPath = '/proj'
      const deps = makeBaseDeps()
      deps.fg.config.Runtype.cat = { type: 'concat', filename: 'out.txt' }
      deps.fg.nodes[0].runtype = ['cat']
      deps.fg.nodes[0].filename = 'a.py'
      deps.fg.nodes[1].runtype = ['cat']
      deps.fg.nodes[1].filename = 'b.py'

      const { runFiles } = createRunners(deps)

      // 节点 0
      let files0 = null
      await deps.fg.runNodes([0], (f) => { files0 = f; return Promise.resolve({ done: '' }) })
      await runFiles(files0)

      const outPath = path.join(rootPath, 'out.txt')
      assert.equal(deps.fsModule._store[outPath], 'print("a")\n')
      assert.equal(deps._record.concat[outPath], 1)

      // 节点 1 追加
      let files1 = null
      await deps.fg.runNodes([1], (f) => { files1 = f; return Promise.resolve({ done: '' }) })
      await runFiles(files1)

      assert.equal(deps.fsModule._store[outPath], 'print("a")\nprint("b")\n')
      assert.equal(deps._record.concat[outPath], 2)
    })
  })

  describe('vscode-jupyter', () => {
    it('调用 runJupyterFn 并传入正确参数', async () => {
      const rootPath = '/proj'
      const deps = makeBaseDeps()
      deps.fg.config.Runtype.jup = { type: 'vscode-jupyter', filename: 'nb.ipynb' }
      deps.fg.nodes[0].runtype = ['jup']

      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })

      // 确保 ipynb 文件路径存在
      deps.fsModule._store[path.join(rootPath, 'nb.ipynb')] = ''

      await runFiles(files)

      assert.equal(deps.runJupyterFn.calls.length, 1)
      const [targetPath, rid, code, sourcename] = deps.runJupyterFn.calls[0]
      assert.equal(targetPath, path.join(rootPath, 'nb.ipynb'))
      assert.ok(rid)
      assert.equal(code, 'print("a")')
      assert.equal(sourcename, path.join(rootPath, 'a.py'))
    })

    it('runJupyterFn 返回 error 时抛出', async () => {
      const rootPath = '/proj'
      const deps = makeBaseDeps()
      deps.fg.config.Runtype.jup = { type: 'vscode-jupyter', filename: 'nb.ipynb' }
      deps.fg.nodes[0].runtype = ['jup']
      deps.runJupyterFn = spy(Promise.resolve({ output: '', error: 'kernel died' }))
      deps.fsModule._store[path.join(rootPath, 'nb.ipynb')] = ''

      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })

      const result = await runFiles(files)
      assert.ok(result.error)
    })

    it('ipynb 文件不存在时先创建', async () => {
      const rootPath = '/proj'
      const deps = makeBaseDeps()
      deps.fg.config.Runtype.jup = { type: 'vscode-jupyter', filename: 'new.ipynb' }
      deps.fg.nodes[0].runtype = ['jup']

      const ipynbPath = path.join(rootPath, 'new.ipynb')
      // 初始不存在
      assert.ok(!deps.fsModule.existsSync(ipynbPath))

      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })
      await runFiles(files)

      // 应该被创建
      assert.ok(deps.fsModule.existsSync(ipynbPath))
    })
  })

  describe('condition (反馈节点)', () => {
    it('condition 文件有内容时返回 dropid', async () => {
      const rootPath = '/proj'
      const deps = makeBaseDeps()
      deps.fg.nodes = [
        {
          name: 'A', runtype: ['py'], filename: 'a.py',
          condition: 'cond.txt',
          _linkTo: { next: { '1': 'previous' }, drop: { '1': 'previous' } },
        },
        { name: 'B' },
      ]
      deps.fg.record = [undefined, undefined]
      deps.fg.buildLines()

      // condition 文件在运行后被写入内容（模拟 spawnSync 执行后脚本往 condition 写内容）
      // runFiles 会先 writeFileSync 清空, 然后 spawnSync 执行脚本往 condition 写内容
      // 我们在 spawnSyncFn 中模拟写入 condition 文件
      const condPath = path.join(rootPath, 'cond.txt')
      deps.spawnSyncFn = spy((() => {
        // 模拟执行脚本后写入 condition 文件
        deps.fsModule._store[condPath] = 'fail reason'
        return { status: 0, stdout: 'ok', stderr: '' }
      }))
      // spawnSyncFn 需要是直接返回值而非函数, 用 function wrapper
      deps.spawnSyncFn = function (...args) {
        deps.spawnSyncFn.calls.push(args)
        deps.fsModule._store[condPath] = 'fail reason'
        return { status: 0, stdout: 'ok', stderr: '' }
      }
      deps.spawnSyncFn.calls = []

      const { runFiles } = createRunners(deps)

      let files = null
      await deps.fg.runNodes([0], (f) => { files = f; return Promise.resolve({ done: '' }) })
      const result = await runFiles(files)

      assert.ok(result.dropid !== undefined)
      assert.equal(result.drop, 1)
    })
  })

  describe('snapshot 继承', () => {
    it('snapshotid 对应的前驱有 snapshot 时继承', async () => {
      const deps = makeBaseDeps()
      // 给节点 0 设定一个已有 snapshot（模拟已运行过）
      deps.fg.record[0] = { snapshot: 42 }

      const { runFiles } = createRunners(deps)

      // 运行节点 1（其 snapshotid 应为 0），直接构造 file 对象
      const file = {
        rid: 'testrid',
        index: 1,
        snapshotid: 0,
        rconfig: deps.fg.config.Runtype.py,
        filename: 'b.py',
        submitTick: Date.now(),
      }
      deps.fg.record[1] = file
      await runFiles([file])

      const ctx = deps.fg.record[1]
      // snapshotid=0 有 snapshot=42，所以 ctx.snapshot 应该是 42
      assert.equal(ctx.snapshot, 42)
    })
  })
})

// ---------- checkSource tests ----------

describe('checkSource', () => {
  it('源码未变更时不触发 diff 也不移除 snapshot', async () => {
    const deps = makeBaseDeps()
    deps.fg.record[0] = { content: 'print("a")', filename: 'a.py', snapshot: 1 }

    const { checkSource } = createRunners(deps)
    await checkSource([0], false, false)

    // showFilesDiff 不应被调用
    assert.equal(deps.showFilesDiff.calls.length, 0)
    // snapshot 保留
    assert.equal(deps.fg.record[0].snapshot, 1)
  })

  it('源码变更时移除 snapshot 并触发通知', async () => {
    const deps = makeBaseDeps()
    deps.fg.record[0] = { content: 'old content', filename: 'a.py', snapshot: 1 }

    const { checkSource } = createRunners(deps)
    await checkSource([0], false, false)

    // snapshot 应被移除
    assert.equal(deps.fg.record[0].snapshot, undefined)
    // showFilesDiff 被调用
    assert.equal(deps.showFilesDiff.calls.length, 1)
  })

  it('noRemove=true 时不移除 snapshot', async () => {
    const deps = makeBaseDeps()
    deps.fg.record[0] = { content: 'old content', filename: 'a.py', snapshot: 1 }

    const { checkSource } = createRunners(deps)
    await checkSource([0], true, false)

    // snapshot 保留（noRemove）
    assert.equal(deps.fg.record[0].snapshot, 1)
    // 但 diff 仍然显示
    assert.equal(deps.showFilesDiff.calls.length, 1)
  })

  it('record 中无 content 或无 snapshot 时跳过', async () => {
    const deps = makeBaseDeps()
    deps.fg.record[0] = { filename: 'a.py' } // 无 content, 无 snapshot

    const { checkSource } = createRunners(deps)
    await checkSource([0], false, false)

    assert.equal(deps.showFilesDiff.calls.length, 0)
  })

  it('config.Snapshot.noCheckSource 为 true 时整体跳过', async () => {
    const deps = makeBaseDeps()
    deps.fg.config.Snapshot = { noCheckSource: true }
    deps.fg.record[0] = { content: 'old', filename: 'a.py', snapshot: 1 }

    const { checkSource } = createRunners(deps)
    await checkSource([0], false, false)

    // 完全跳过
    assert.equal(deps.showFilesDiff.calls.length, 0)
    assert.equal(deps.fg.record[0].snapshot, 1)
  })

  it('变更节点的后继 snapshot 也被级联移除', async () => {
    const deps = makeBaseDeps()
    // 节点 0 源码变更
    deps.fg.record[0] = { content: 'old', filename: 'a.py', snapshot: 1 }
    // 节点 1 是节点 0 的后继
    deps.fg.record[1] = { content: 'print("b")', filename: 'b.py', snapshot: 2 }

    const { checkSource } = createRunners(deps)
    await checkSource([0], false, false)

    // 两者 snapshot 都应被移除
    assert.equal(deps.fg.record[0].snapshot, undefined)
    assert.equal(deps.fg.record[1].snapshot, undefined)
  })
})

// ---------- runChain tests ----------

describe('runChain', () => {
  it('线性图运行链: 两个节点按拓扑序执行完成', async () => {
    const deps = makeBaseDeps()
    const { runChain } = createRunners(deps)

    await runChain(1, false, false)

    // 两个节点都应有 record
    assert.ok(deps.fg.record[0])
    assert.ok(deps.fg.record[1])
    assert.ok(deps.fg.record[0].snapshot !== undefined)
    assert.ok(deps.fg.record[1].snapshot !== undefined)

    // showInformationMessage 应提示完成
    const msgs = deps.showInformationMessage.calls.map(c => c[0])
    assert.ok(msgs.some(m => m.includes('运行链完成')))
  })

  it('已有 snapshot 的节点被跳过', async () => {
    const deps = makeBaseDeps()
    // 节点本身需要有 snapshot 属性（用户配置），record 里也有 snapshot（已运行）
    deps.fg.nodes[0].snapshot = true
    deps.fg.record[0] = { snapshot: 42, content: 'print("a")', filename: 'a.py' }

    const { runChain } = createRunners(deps)
    await runChain(1, false, false)

    // spawnSyncFn 只被调用一次（仅跑节点 1）
    assert.equal(deps.spawnSyncFn.calls.length, 1)
  })

  it('图含环时报错', async () => {
    const deps = makeBaseDeps()
    // 构造环: 0 -> 1 -> 0
    deps.fg.nodes = [
      { name: 'A', runtype: ['py'], filename: 'a.py', _linkTo: { next: { '1': 'previous' } } },
      { name: 'B', runtype: ['py'], filename: 'b.py', _linkTo: { next: { '-1': 'previous' } } },
    ]
    deps.fg.record = [undefined, undefined]
    deps.fg.buildLines()

    const { runChain } = createRunners(deps)
    await runChain(1, false, false)

    // showText 应包含环提示
    const texts = deps.showText.calls.map(c => c[0])
    assert.ok(texts.some(t => t.includes('环')))
  })
})
