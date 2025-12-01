const levelTopologicalSort = (nodes, indexes = null) => {
    const n = nodes.length;

    // 1. 构建邻接表（使用节点索引）
    const graph = new Array(n).fill(0).map(() => []);
    const inDegree = new Array(n).fill(0);

    // 构建有向图
    if (indexes == null) {
        indexes = new Array(n).fill(0).map((v, i) => i);
    }
    for (let i of indexes) {
        const node = nodes[i];
        const linkTo = node._linkTo;

        if (!linkTo || !linkTo.next) continue;

        const nextLinks = linkTo.next;
        for (const offsetStr in nextLinks) {
            // 只处理值为"previous"的连接
            if (nextLinks[offsetStr] === "previous") {
                const offset = parseInt(offsetStr, 10);
                const targetIndex = i + offset;

                // 检查目标索引是否有效
                if (indexes.includes(targetIndex)) {
                    graph[i].push(targetIndex);
                    inDegree[targetIndex]++;
                }
            }
        }
    }

    // 2. Kahn算法进行拓扑排序和层级划分
    const levels = [];
    const queue = [];

    // 初始化队列（入度为0的节点）
    for (let i of indexes) {
        if (inDegree[i] === 0) {
            queue.push(i);
        }
    }

    // 记录处理顺序
    let processedCount = 0;

    while (queue.length > 0) {
        const currentLevel = [];
        const levelSize = queue.length;

        // 处理当前层级的所有节点
        for (let i = 0; i < levelSize; i++) {
            const nodeIdx = queue.shift();
            currentLevel.push(nodeIdx);
            processedCount++;

            // 减少相邻节点的入度
            for (const neighbor of graph[nodeIdx]) {
                inDegree[neighbor]--;
                if (inDegree[neighbor] === 0) {
                    queue.push(neighbor);
                }
            }
        }

        // 排序当前层级，确保输出稳定（可选）
        currentLevel.sort((a, b) => a - b);
        levels.push(currentLevel);
    }

    // 3. 检查是否存在环
    const hasRing = processedCount !== indexes.length;

    return {
        levels,
        ring: hasRing
    };
}

// export default levelTopologicalSort
if (typeof exports === 'undefined') { globalThis.exports = globalThis }
exports.levelTopologicalSort = levelTopologicalSort;