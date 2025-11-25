import {blockPrototype} from './blockPrototype.js'

const toolbarData = [
    [
        { text: 'edit', class: '', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '+', class: 'edit', click: 'fg.scale(1.1)', title: '视图放大' },

        { text: 'r', class: 'edit', click: 'fg.scale()', title: '恢复初始视图大小' },
        { text: '^', class: 'edit', click: 'fg.move("up")' },
        { text: 'd', class: 'edit primary', click: 'fg.toggleButton(btn);fg.moveSetting.down*=-1', title: '同时移动右下方的连接' },

        { text: '>+', class: 'edit', click: 'fg.currentCard.node._pos.width+=100;fg.resetCurrentCardPos()' },
        { text: 'v+', class: 'edit', click: 'fg.currentCard.node._pos.height+=100;fg.resetCurrentCardPos()' },

        { text: '连接', class: 'edit', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },

        { text: '复制', class: 'edit', click: 'fg.copyAndLink(fg.currentCard.index)' },

        { text: '?启用', class: 'run', click: 'fg.connectAPI.info("尚未实现")' },

        { text: '重置快照链', class: 'run', click: 'fg.clearSnapshotChain(fg.currentCard.index)' },



        { text: '测试1-打印nodes', class: 'edit', click: 'fg.print(fg.nodes)' },

        { text: '?以点击为起点深度优先自动排布', class: 'edit', click: 'fg.connectAPI.info("尚未实现")' },

    ],
    [
        { text: 'run ', class: 'primary', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '-', class: 'edit', click: 'fg.scale(1/1.1)', title: '视图缩小' },

        { text: '<', class: 'edit', click: 'fg.move("left")' },
        { text: 'v', class: 'edit', click: 'fg.move("down")' },
        { text: '>', class: 'edit', click: 'fg.move("right")' },

        { text: '>-', class: 'edit', click: 'fg.currentCard.node._pos.width-=100;fg.resetCurrentCardPos()' },
        { text: 'v-', class: 'edit', click: 'fg.currentCard.node._pos.height-=100;fg.resetCurrentCardPos()' },

        { text: '断开', class: 'edit', click: 'fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },

        { text: '删除', class: 'edit', click: 'fg.removeNode(fg.currentCard.index)' },

        { text: '?禁用', class: 'run', click: 'fg.connectAPI.info("尚未实现")' },
        { text: '运行链', class: 'run', click: 'fg.runNodeChain(fg.currentCard.index)' },
        { text: '运行', class: 'run', click: 'fg.runNodes([fg.currentCard.index])' },
        { text: '结果', class: 'run', click: 'fg.showResult(fg.currentCard.index)' },

        { text: '测试2-打印config', class: 'edit', click: 'fg.print(fg.config)' },
        { text: '测试3-打印fg', class: 'edit', click: 'fg.print(fg)' },
    ]
];

export const config = {
    toolbar: toolbarData,
    blockPrototype: blockPrototype,
    Runtype: {
        "": {
            type: 'node-post',
            url: 'http://127.0.0.1:12082/exec',
            payload: 'return ({code:content,filename:filename})',
            show: 'if(ret.error)throw new Error(ret.error);return ret.output'
        },
        "vt": {
            type: 'vscode-terminal',
            message: 'cat __filename__'
        },
        "nt": {
            type: 'node-terminal',
            payload: 'return ["cat",filename]'
        },
        "c": {
            type: 'concat',
            filename: 'workspace.py'
        },
    }
}

export const cardData = [
    { text: "a", filename: "a.py", snapshot: true, _pos: { left: 0, top: 0, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "b", filename: "b.py", snapshot: true, _pos: { left: 200, top: 0, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "c", filename: "c.py", _pos: { left: 200, top: 100, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "d", filename: "d.py", snapshot: true, _pos: { left: 0, top: 100, width: 100, height: 100 }, _linkTo: { next: { "1": "previous", "2": "previous" } } },
    { text: "e1", filename: "e1.py", _pos: { left: 0, top: 200, width: 100, height: 100 }, _linkTo: { next: { "2": "previous" } } },
    { text: "e2", filename: "e2.py", _pos: { left: 300, top: 200, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "f", filename: "f.py", _pos: { left: 100, top: 200, width: 200, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "g", filename: "g.py", _pos: { left: 100, top: 300, width: 200, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "h", filename: "h.py", _pos: { left: 300, top: 300, width: 100, height: 100 } }
]