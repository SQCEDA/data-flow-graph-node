const toolbarData = [
    [
        { text: 'edit', class: '', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '+', class: '', click: 'fg.scale(1.1)', title: '视图放大' },

        { text: 'r', class: '', click: 'fg.scale()', title: '恢复初始视图大小' },
        { text: 'm', class: 'edit', click: 'fg.toggleButton(btn);fg.moveSetting.multiSelect*=-1', title: '移动框选的方块, 此设置优先级高于移动连接' },
        { text: '^', class: 'edit', click: 'fg.move("up")' },
        { text: 'd', class: 'edit', click: 'fg.toggleButton(btn);fg.moveSetting.down*=-1', title: '同时移动右下方的连接' },

        { text: '>+', class: 'edit', click: 'fg.currentCard.node._pos.width+=100;fg.resetCurrentCardPos()' },
        { text: 'v+', class: 'edit', click: 'fg.currentCard.node._pos.height+=100;fg.resetCurrentCardPos()' },

        { text: '连接', class: 'edit', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },
        { text: '连接反馈', class: 'edit', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"drop","previous")' },

        { text: '复制', class: 'edit', click: 'fg.copyAndLink(fg.currentCard.index)' },

        { text: '?启用', class: 'run', click: 'fg.connectAPI.info("尚未实现")' },

        

        { text: '重置快照链', class: 'run', click: 'fg.clearSnapshotChain(fg.currentCard.index)' },

        { text: '测试1-打印nodes', class: 'edit', click: 'fg.print(fg.nodes)' },

        { text: '?以点击为起点深度优先自动排布', class: 'edit', click: 'fg.connectAPI.info("尚未实现")' },

    ],
    [
        { text: 'run ', class: 'primary', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '-', class: '', click: 'fg.scale(1/1.1)', title: '视图缩小' },
        { text: 's', class: 'edit', click: 'fg.saveNodes()', title: '保存节点图' },

        { text: '<', class: 'edit', click: 'fg.move("left")' },
        { text: 'v', class: 'edit', click: 'fg.move("down")' },
        { text: '>', class: 'edit', click: 'fg.move("right")' },

        { text: '>-', class: 'edit', click: 'fg.currentCard.node._pos.width-=100;fg.resetCurrentCardPos()' },
        { text: 'v-', class: 'edit', click: 'fg.currentCard.node._pos.height-=100;fg.resetCurrentCardPos()' },

        { text: '断开', class: 'edit', click: 'fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"next","previous");fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"drop","previous")' },

        { text: '切换种类', class: 'edit', click: 'fg.changeNodeType(fg.currentCard.index)' },

        { text: '删除', class: 'edit', click: 'fg.removeNode(fg.currentCard.index)' },

        { text: 'f', class: 'run primary', click: 'fg.toggleButton(btn);fg.mode.file*=-1', title: '点击卡片时是否显示文件'},

        { text: '?禁用', class: 'run', click: 'fg.connectAPI.info("尚未实现")' },
        { text: '运行链', class: 'run', click: 'fg.runNodeChain(fg.currentCard.index)' },
        { text: '运行', class: 'run', click: 'fg.runNodes([fg.currentCard.index])' },
        { text: '结果', class: 'run', click: 'fg.showResult(fg.currentCard.index)' },

        { text: '测试2-打印config', class: 'edit', click: 'fg.print(fg.config)' },
        { text: '测试3-打印fg', class: 'edit', click: 'fg.print(fg)' },
    ]
];

// export default toolbarData
if (typeof exports === 'undefined') { globalThis.exports = globalThis }
exports.toolbarData = toolbarData;