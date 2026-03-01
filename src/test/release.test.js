/**
 * release (buildReleasePayload) 单元测试
 * 纯 Node.js 测试，零 vscode 依赖
 *
 * 运行: node --test src/test/release.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { buildReleasePayload } = require('../release.js')
const { recordDefault } = require('../fgModel.js')

// ---------- mock helpers ----------

/** 创建 mock fs 模块 */
function createMockFs(files = {}) {
  return {
    existsSync(p) {
      return p in files
    },
    readFileSync(p, opts) {
      if (!(p in files)) throw new Error('ENOENT: ' + p)
      return files[p]
    },
  }
}

/** 创建 mock getSha1AndBase64: 返回确定性 hash */
function createMockGetSha1(files = {}) {
  return async function getSha1AndBase64(fullpath) {
    const content = files[fullpath]
    if (content === undefined) throw new Error('file not found: ' + fullpath)
    const hash = 'sha1_' + path.basename(fullpath)
    const b64 = Buffer.from(content).toString('base64')
    return [hash, b64]
  }
}

// ---------- tests ----------

describe('buildReleasePayload', () => {
  it('缺少 rootPath 或 fgProject 时抛出错误', async () => {
    await assert.rejects(
      () => buildReleasePayload({ rootPath: null, fgProject: null }, 'abc'),
      /missing flowgraph context/
    )
  })

  it('无 snapshot 节点时 filehashmap 为空', async () => {
    const fg = {
      config: { a: 1 },
      nodes: [{ name: 'A', filename: 'a.py' }],
      record: [undefined],  // 无 snapshot
    }
    const deps = {
      rootPath: '/proj',
      fgProject: { config: 'c.json', nodes: 'n.json', record: 'r.json' },
      fg,
      recordDefault,
      getSha1AndBase64: createMockGetSha1({}),
      fsModule: createMockFs({}),
    }
    const { filehashmap, filePayload, projectfile } = await buildReleasePayload(deps, 'hash123')

    assert.deepStrictEqual(filehashmap, {})
    assert.deepStrictEqual(filePayload, {})
    // projectfile 结构检查
    assert.equal(projectfile.githash, 'hash123')
    assert.deepStrictEqual(projectfile.nodes, fg.nodes)
    assert.deepStrictEqual(projectfile.config, fg.config)
    // record.history 应被清空
    assert.deepStrictEqual(projectfile.record.history, [])
    assert.deepStrictEqual(projectfile.record.current, fg.record)
  })

  it('有 snapshot 的节点收集其 filename 文件', async () => {
    const rootPath = '/proj'
    const fg = {
      config: {},
      nodes: [
        { name: 'A', filename: 'src/a.py' },
        { name: 'B', filename: 'src/b.py' },
      ],
      record: [
        undefined,
        { snapshot: 12345, filename: 'src/b.py' },
      ],
    }

    const fullB = path.join(rootPath, 'src/b.py')
    const fsFiles = {}
    fsFiles[fullB] = true
    const hashFiles = {}
    hashFiles[fullB] = 'content_b'

    const deps = {
      rootPath,
      fgProject: {},
      fg,
      recordDefault,
      getSha1AndBase64: createMockGetSha1(hashFiles),
      fsModule: createMockFs({ [fullB]: 'content_b' }),
    }

    const { filehashmap, filePayload } = await buildReleasePayload(deps, 'h1')

    // 只收集了节点 1（有 snapshot）的文件
    assert.ok('src/b.py' in filehashmap)
    assert.ok(!('src/a.py' in filehashmap))
    // filePayload 含对应 hash
    const hash = filehashmap['src/b.py']
    assert.ok(hash in filePayload)
  })

  it('submitfile 属性的文件也被收集', async () => {
    const rootPath = '/proj'
    const fg = {
      config: {},
      nodes: [
        { name: 'A', filename: 'a.py', submitfile: ['data/x.csv'] },
      ],
      record: [
        { snapshot: 999 },
      ],
    }

    const fullA = path.join(rootPath, 'a.py')
    const fullX = path.join(rootPath, 'data/x.csv')
    const allFiles = {
      [fullA]: 'code_a',
      [fullX]: 'csv_data',
    }

    const deps = {
      rootPath,
      fgProject: {},
      fg,
      recordDefault,
      getSha1AndBase64: createMockGetSha1(allFiles),
      fsModule: createMockFs(allFiles),
    }

    const { filehashmap } = await buildReleasePayload(deps, 'h2')
    assert.ok('a.py' in filehashmap)
    assert.ok('data/x.csv' in filehashmap)
  })

  it('filenames 映射中的附属文件被收集', async () => {
    const rootPath = '/proj'
    const fg = {
      config: {},
      nodes: [
        { name: 'A', filename: 'main.py' },
      ],
      record: [
        { snapshot: 1 },
      ],
    }

    const fgProject = { filenames: 'fnames.json' }
    const fnamesPath = path.join(rootPath, 'fnames.json')
    const fullMain = path.join(rootPath, 'main.py')
    const fullUtil = path.join(rootPath, 'util.py')

    const allFiles = {
      [fnamesPath]: JSON.stringify({ 'main.py': ['util.py'] }),
      [fullMain]: 'import util',
      [fullUtil]: 'def helper(): pass',
    }

    const deps = {
      rootPath,
      fgProject,
      fg,
      recordDefault,
      getSha1AndBase64: createMockGetSha1(allFiles),
      fsModule: createMockFs(allFiles),
    }

    const { filehashmap } = await buildReleasePayload(deps, 'h3')
    assert.ok('main.py' in filehashmap)
    assert.ok('util.py' in filehashmap)
  })

  it('文件不存在时抛出友好错误', async () => {
    const rootPath = '/proj'
    const fg = {
      config: {},
      nodes: [{ name: 'A', filename: 'missing.py' }],
      record: [{ snapshot: 1 }],
    }

    const deps = {
      rootPath,
      fgProject: {},
      fg,
      recordDefault,
      getSha1AndBase64: async () => { throw new Error('should not reach') },
      fsModule: createMockFs({}), // 无文件
    }

    await assert.rejects(
      () => buildReleasePayload(deps, 'h4'),
      /文件不存在/
    )
  })

  it('重复文件路径只收集一次', async () => {
    const rootPath = '/proj'
    const fg = {
      config: {},
      nodes: [
        { name: 'A', filename: 'a.py', submitfile: ['a.py'] }, // filename 和 submitfile 重复
      ],
      record: [{ snapshot: 1 }],
    }

    let callCount = 0
    const fullA = path.join(rootPath, 'a.py')
    const deps = {
      rootPath,
      fgProject: {},
      fg,
      recordDefault,
      getSha1AndBase64: async (p) => { callCount++; return ['hash_a', 'YQ=='] },
      fsModule: createMockFs({ [fullA]: 'code' }),
    }

    await buildReleasePayload(deps, 'h5')
    assert.equal(callCount, 1, 'getSha1AndBase64 should be called only once for duplicate path')
  })

  it('filenames JSON 解析失败时抛出明确错误', async () => {
    const rootPath = '/proj'
    const fg = { config: {}, nodes: [], record: [] }
    const fnamesPath = path.join(rootPath, 'fnames.json')

    const deps = {
      rootPath,
      fgProject: { filenames: 'fnames.json' },
      fg,
      recordDefault,
      getSha1AndBase64: async () => ['h', 'b'],
      fsModule: createMockFs({ [fnamesPath]: '{bad json' }),
    }

    await assert.rejects(
      () => buildReleasePayload(deps, 'h6'),
      /filenames 文件解析失败/
    )
  })
})
