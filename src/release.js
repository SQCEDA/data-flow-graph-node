const path = require("path");

/**
 * @typedef {Object} ReleasePayloadDeps
 * @property {string} rootPath 工程根目录
 * @property {Object} fgProject .flowgraph.json 解析后的对象
 * @property {{ config: Object, nodes: Array, record: Array }} fg fgModel 实例
 * @property {string} recordDefault record 默认 JSON 字符串
 * @property {(fullpath: string) => Promise<[string, string]>} getSha1AndBase64 返回 [hash, base64]
 * @property {typeof import('fs')} fsModule
 */

/**
 * 构造 release push 所需的文件与元数据
 * @param {ReleasePayloadDeps} deps
 * @param {string} githash
 * @returns {Promise<{filehashmap:Object,filePayload:Object,projectfile:Object}>}
 */
async function buildReleasePayload(deps, githash) {
  const { rootPath, fgProject, fg, recordDefault, getSha1AndBase64, fsModule } = deps
  if (!rootPath || !fgProject) throw new Error('missing flowgraph context')

  let filenamesMap = {}
  if (fgProject.filenames) {
    const filenamesPath = path.join(rootPath, fgProject.filenames)
    if (fsModule.existsSync(filenamesPath)) {
      try {
        filenamesMap = JSON.parse(fsModule.readFileSync(filenamesPath, { encoding: 'utf8' })) || {}
      } catch (error) {
        throw new Error('filenames 文件解析失败: ' + error.message)
      }
    }
  }

  // projectfile: 四个工程 JSON，record.history 按计划置空
  let flowContent = fgProject
  // let configContent = fg.rawConfig
  let configContent = fg.config
  let nodesContent = fg.nodes
  let recordContent = JSON.parse(recordDefault)
  recordContent.current = fg.record
  const projectfile = {
    flowgraph: flowContent,
    config: configContent,
    nodes: nodesContent,
    record: recordContent,
    githash, // 此处的githash强制是来自命令行结果的, 用户可以修改的那个当作是标识id, 只是默认值取githash
  }

  // 收集需要上传的文件 -> filehashmap[path]=hash, filePayload[hash]=base64
  const filehashmap = {}
  const filePayload = {}
  const collected = new Set()

  async function addFile(relpath) {
    if (!relpath) return
    if (collected.has(relpath)) return
    const full = path.join(rootPath, relpath)
    if (!fsModule.existsSync(full)) {
      throw new Error('文件不存在: ' + relpath)
    }
    const [hash, b64] = await getSha1AndBase64(full)
    filehashmap[relpath] = hash
    filePayload[hash] = b64
    collected.add(relpath)
  }

  async function addByList(list) {
    if (!list) return
    if (!Array.isArray(list)) list = [list]
    for (const rel of list) await addFile(rel)
  }

  for (let i = 0; i < fg.nodes.length; i++) {
    const ctx = fg.record[i]
    if (!ctx || !ctx.snapshot) continue
    const node = fg.nodes[i]
    await addByList(node.filename)
    if (node.submitfile) await addByList(node.submitfile)
    if (node.filename && filenamesMap[node.filename]) {
      await addByList(filenamesMap[node.filename])
    }
  }

  return { filehashmap, filePayload, projectfile }
}

exports.buildReleasePayload = buildReleasePayload;
