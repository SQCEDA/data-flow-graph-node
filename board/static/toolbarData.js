const toolbarData = [
    [
        { text: 'edit', class: '', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '+', class: '', id: '=', click: 'fg.scale(1.1)', title: '视图放大' },

        { text: 'r', class: '', id: '0', click: 'fg.scale()', title: '恢复初始视图大小' },
        { text: 'm', class: 'edit', id: 'q', click: 'fg.toggleButton(btn);fg.moveSetting.multiSelect*=-1', title: '移动框选的方块, 此设置优先级高于移动后继' },
        { text: '^', class: 'edit', id: 'w', click: 'fg.move("up")' },
        { text: 'd', class: 'edit', id: 'e', click: 'fg.toggleButton(btn);fg.moveSetting.down*=-1', title: '同时移动所有后继, 此设置优先级低于移动框选' },

        { text: '>+', class: 'edit', id: 'f', click: 'fg.currentCard.node._pos.width+=100;fg.resetCurrentCardPos()' },
        { text: '>-', class: 'edit', id: 'g', click: 'fg.currentCard.node._pos.width-=100;fg.resetCurrentCardPos()' },


        { text: '连接', class: 'edit', id: 'link', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },
        // { text: '连接反馈', class: 'edit', id: 'link drop', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"drop","previous")' },
        { text: '连接侧线', class: 'edit', id: 'link drop', click: 'fg.uiTryAddLine(fg.lastCard.index,fg.currentCard.index)' },

        { text: '复制', class: 'edit', id: 'duplicate', click: 'fg.copyAndLink(fg.currentCard.index)' },

        { text: '?启用', class: 'run', click: 'fg.connectAPI.info("尚未实现")' },



        { text: '重置快照链', class: 'run', click: 'fg.clearSnapshotChain(fg.currentCard.index)' },

        { text: '自动排布', class: 'edit', id: 'autoLayout', title: '层级拓扑排序, 如果开启了移动框选或移动后继, 则只排相应的方块', click: 'fg.autoLayout()' },

        { text: '测试1-打印nodes', class: 'edit', click: 'fg.print(fg.nodes)' },

        { text: 'diff all', class: 'run', id: 'diff all', title: '显示源码与快照差异', click: 'fg.showAllDiff()' },
        { text: 'diff history', class: 'run', id: 'diff history', title: '显示点击的文件与运行历史版本的差异', click: 'fg.showAllHistoryDiff(fg.currentCard.index)' },

    ],
    [
        { text: 'run ', class: 'primary', id: 'r', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '-', class: '', id: '-', click: 'fg.scale(1/1.1)', title: '视图缩小' },
        { text: 's', class: 'edit', id: 'save', click: 'fg.saveNodes()', title: '保存节点图(每次运行前也会保存)' },

        { text: '<', class: 'edit', id: 'a', click: 'fg.move("left")' },
        { text: 'v', class: 'edit', id: 's', click: 'fg.move("down")' },
        { text: '>', class: 'edit', id: 'd', click: 'fg.move("right")' },

        { text: 'v+', class: 'edit', id: 'v', click: 'fg.currentCard.node._pos.height+=100;fg.resetCurrentCardPos()' },
        { text: 'v-', class: 'edit', id: 'b', click: 'fg.currentCard.node._pos.height-=100;fg.resetCurrentCardPos()' },

        // { text: '断开', class: 'edit', id: 'break', click: 'fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"next","previous");fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"drop","previous")' },
        { text: '断开', class: 'edit', id: 'break', click: 'fg.uiRemoveAllLine(fg.lastCard.index,fg.currentCard.index)' },

        { text: '切换种类', class: 'edit', id: 'toggle type', click: 'fg.changeNodeType(fg.currentCard.index)' },

        { text: '删除', class: 'edit', id: 'delete', click: 'fg.removeNode(fg.currentCard.index)' },

        { text: 'f', class: 'run primary', id: 'file', click: 'fg.toggleButton(btn);fg.mode.file*=-1', title: '点击卡片时是否显示文件' },

        { text: '?禁用', class: 'run', click: 'fg.connectAPI.info("尚未实现")' },
        { text: '运行链', class: 'run', id: 'run chain', click: 'fg.runChain(fg.currentCard.index)' },
        { text: '运行', class: 'run', id: 'run', click: 'fg.runNodes([fg.currentCard.index])' },
        { text: '结果', class: 'run', id: 'result', click: 'fg.showResult(fg.currentCard.index)' },

        { text: '测试2-打印config', class: 'edit', click: 'fg.print(fg.config)' },
        { text: '测试3-打印fg', class: 'edit', click: 'fg.print(fg)' },
    ]
];

// export default toolbarData
if (typeof exports === 'undefined') { globalThis.exports = globalThis }
exports.toolbarData = toolbarData;