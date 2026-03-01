/**
 * fgModel 单元测试
 * 纯 Node.js 测试，零 vscode 依赖
 *
 * 运行: node --test src/test/fgModel.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { recordDefault, getRandomString, createFgModel } = require('../fgModel.js')

// ---------- recordDefault ----------
describe('recordDefault', () => {
  it('是有效 JSON 且结构为 {current,history,drop,concat}', () => {
    const r = JSON.parse(recordDefault)
    assert.deepStrictEqual(Object.keys(r).sort(), ['concat', 'current', 'drop', 'history'])
    assert.deepStrictEqual(r.current, [])
    assert.deepStrictEqual(r.history, [])
    assert.deepStrictEqual(r.drop, [])
    assert.deepStrictEqual(r.concat, {})
  })
})

// ---------- getRandomString ----------
describe('getRandomString', () => {
  it('返回 32 位字母数字字符串', () => {
    const s = getRandomString()
    assert.equal(s.length, 32)
    assert.match(s, /^[A-Za-z0-9]{32}$/)
  })

  it('两次调用结果不同（概率极高）', () => {
    assert.notEqual(getRandomString(), getRandomString())
  })
})

// ---------- createFgModel ----------
describe('createFgModel', () => {
  /** 构建一个简单三节点线性图: 0 -> 1 -> 2 (next->previous) */
  function makeLinearFg() {
    const fg = createFgModel()
    fg.nodes = [
      { name: 'A', _linkTo: { next: { '1': 'previous' } } },
      { name: 'B', _linkTo: { next: { '1': 'previous' } } },
      { name: 'C' },
    ]
    fg.record = [undefined, undefined, undefined]
    fg.config = { Runtype: {} }
    fg.buildLines()
    return fg
  }

  describe('buildLines', () => {
    it('生成正确的 link 矩阵', () => {
      const fg = makeLinearFg()
      // link[0][1] 应有一条 next->previous 的边
      assert.equal(fg.link[0][1].length, 1)
      assert.deepStrictEqual(fg.link[0][1][0], { lsname: 'next', lename: 'previous' })
      // link[1][2]
      assert.equal(fg.link[1][2].length, 1)
      // 不存在反向边
      assert.equal(fg.link[1][0].length, 0)
      assert.equal(fg.link[2][1].length, 0)
    })

    it('越界的 _linkTo 偏移被忽略', () => {
      const fg = createFgModel()
      fg.nodes = [
        { name: 'A', _linkTo: { next: { '-5': 'previous', '100': 'previous' } } },
      ]
      fg.record = [undefined]
      fg.buildLines()
      // 唯一节点不应有任何边
      assert.equal(fg.link[0][0].length, 0)
    })
  })

  describe('addLine', () => {
    it('手动添加边到 link 矩阵', () => {
      const fg = makeLinearFg()
      fg.addLine(2, 0, 'drop', 'previous')
      assert.equal(fg.link[2][0].length, 1)
      assert.deepStrictEqual(fg.link[2][0][0], { lsname: 'drop', lename: 'previous' })
    })
  })

  describe('findNodeBackward', () => {
    it('从节点 2 向后查找返回拓扑序 [0, 1, 2]', () => {
      const fg = makeLinearFg()
      const result = fg.findNodeBackward(2)
      const indexes = result.map(v => fg.nodes.indexOf(v))
      assert.deepStrictEqual(indexes, [0, 1, 2])
    })

    it('从节点 0 向后查找仅返回自身', () => {
      const fg = makeLinearFg()
      const result = fg.findNodeBackward(0)
      assert.equal(result.length, 1)
      assert.equal(fg.nodes.indexOf(result[0]), 0)
    })

    it('filterFunc 可过滤掉某些节点', () => {
      const fg = makeLinearFg()
      // 只允许名为 B 的节点通行
      const result = fg.findNodeBackward(2, (v) => v.name === 'B')
      const indexes = result.map(v => fg.nodes.indexOf(v))
      // 只有 1(B) 和 2(C 自身) 出现
      assert.ok(indexes.includes(1))
      assert.ok(indexes.includes(2))
      assert.ok(!indexes.includes(0))
    })
  })

  describe('findNodeForward', () => {
    it('从节点 0 向前查找返回 [0, 1, 2]', () => {
      const fg = makeLinearFg()
      const result = fg.findNodeForward(0)
      const indexes = result.map(v => fg.nodes.indexOf(v))
      assert.deepStrictEqual(indexes, [0, 1, 2])
    })

    it('从节点 2 向前查找仅返回自身', () => {
      const fg = makeLinearFg()
      const result = fg.findNodeForward(2)
      assert.equal(result.length, 1)
    })
  })

  describe('runNodes', () => {
    it('正确构造 files 数组并委托给 runFilesFn', async () => {
      const fg = makeLinearFg()
      fg.config.Runtype = { py: { type: 'node-terminal' } }
      fg.nodes[1].runtype = ['py']
      fg.nodes[1].filename = 'b.py'

      let capturedFiles = null
      let capturedDisplay = null
      const mockRunFilesFn = (files, display) => {
        capturedFiles = files
        capturedDisplay = display
        return Promise.resolve({ done: '' })
      }

      const display = []
      await fg.runNodes([1], mockRunFilesFn, display)

      assert.equal(capturedFiles.length, 1)
      assert.equal(capturedFiles[0].index, 1)
      assert.equal(capturedFiles[0].filename, 'b.py')
      assert.ok(capturedFiles[0].rid)
      assert.equal(capturedFiles[0].rconfig.type, 'node-terminal')
      assert.strictEqual(capturedDisplay, display)
    })

    it('snapshotid 检测 next->previous 依赖', async () => {
      const fg = makeLinearFg()
      fg.config.Runtype = { py: { type: 'node-terminal' } }
      fg.nodes[1].runtype = ['py']
      fg.nodes[1].filename = 'b.py'

      let capturedFiles = null
      const mockRunFilesFn = (files) => { capturedFiles = files; return Promise.resolve({ done: '' }) }

      await fg.runNodes([1], mockRunFilesFn)
      // 节点 0 通过 next->previous 连向节点 1，所以 snapshotid 应为 0
      assert.equal(capturedFiles[0].snapshotid, 0)
    })

    it('无 next->previous 前驱时 snapshotid 为 head', async () => {
      const fg = makeLinearFg()
      fg.config.Runtype = { py: { type: 'node-terminal' } }
      fg.nodes[0].runtype = ['py']
      fg.nodes[0].filename = 'a.py'

      let capturedFiles = null
      const mockRunFilesFn = (files) => { capturedFiles = files; return Promise.resolve({ done: '' }) }

      await fg.runNodes([0], mockRunFilesFn)
      assert.equal(capturedFiles[0].snapshotid, 'head')
    })

    it('condition 节点附带 dropid', async () => {
      const fg = createFgModel()
      fg.nodes = [
        { name: 'A', runtype: ['py'], filename: 'a.py', condition: 'cond.txt', _linkTo: { next: { '1': 'previous' }, drop: { '2': 'previous' } } },
        { name: 'B' },
        { name: 'C' },
      ]
      fg.record = [undefined, undefined, undefined]
      fg.config = { Runtype: { py: { type: 'node-terminal' } } }
      fg.buildLines()

      let capturedFiles = null
      const mockRunFilesFn = (files) => { capturedFiles = files; return Promise.resolve({ done: '' }) }

      await fg.runNodes([0], mockRunFilesFn)
      assert.equal(capturedFiles[0].condition, 'cond.txt')
      assert.equal(capturedFiles[0].dropid, 2) // 0 + 2 = 2
    })

    it('filename 为数组时取第一个元素', async () => {
      const fg = makeLinearFg()
      fg.config.Runtype = { py: { type: 'node-terminal' } }
      fg.nodes[0].runtype = ['py']
      fg.nodes[0].filename = ['first.py', 'second.py']

      let capturedFiles = null
      const mockRunFilesFn = (files) => { capturedFiles = files; return Promise.resolve({ done: '' }) }

      await fg.runNodes([0], mockRunFilesFn)
      assert.equal(capturedFiles[0].filename, 'first.py')
    })
  })

  describe('diamond graph (分支合流)', () => {
    /** 菱形图: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3 */
    function makeDiamondFg() {
      const fg = createFgModel()
      fg.nodes = [
        { name: 'A', _linkTo: { next: { '1': 'previous', '2': 'previous' } } },
        { name: 'B', _linkTo: { next: { '2': 'previous' } } },
        { name: 'C', _linkTo: { next: { '1': 'previous' } } },
        { name: 'D' },
      ]
      fg.record = [undefined, undefined, undefined, undefined]
      fg.config = { Runtype: {} }
      fg.buildLines()
      return fg
    }

    it('findNodeBackward(3) 包含所有 4 个节点', () => {
      const fg = makeDiamondFg()
      const result = fg.findNodeBackward(3)
      assert.equal(result.length, 4)
    })

    it('findNodeForward(0) 包含所有 4 个节点', () => {
      const fg = makeDiamondFg()
      const result = fg.findNodeForward(0)
      assert.equal(result.length, 4)
    })

    it('findNodeForward(1) 只含 1 和 3', () => {
      const fg = makeDiamondFg()
      const result = fg.findNodeForward(1)
      const indexes = result.map(v => fg.nodes.indexOf(v))
      assert.deepStrictEqual(indexes.sort(), [1, 3])
    })
  })

  describe('isolated node (孤立节点)', () => {
    it('与线性图中的节点互不影响', () => {
      const fg = createFgModel()
      fg.nodes = [
        { name: 'A', _linkTo: { next: { '1': 'previous' } } },
        { name: 'B' },
        { name: 'Isolated' },
      ]
      fg.record = [undefined, undefined, undefined]
      fg.config = { Runtype: {} }
      fg.buildLines()

      // 从 B 向后：A, B
      const back = fg.findNodeBackward(1).map(v => fg.nodes.indexOf(v))
      assert.ok(back.includes(0))
      assert.ok(back.includes(1))
      assert.ok(!back.includes(2))

      // 从 Isolated 向前：只有自身
      const fwd = fg.findNodeForward(2).map(v => fg.nodes.indexOf(v))
      assert.deepStrictEqual(fwd, [2])
    })
  })
})
