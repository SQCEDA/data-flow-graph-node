export const toolbarData = [
    [
        { text: 'edit', class: 'primary', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '+', class: 'edit', click: 'fg.scale(1.1)', title: '视图放大' },

        { text: 'r', class: 'edit', click: 'fg.scale()', title: '恢复初始视图大小' },
        { text: '^', class: 'edit', click: 'fg.move("up")' },
        { text: 'd', class: 'edit primary', click: 'fg.toggleButton(btn);fg.moveSetting.down*=-1', title: '同时移动右下方的连接' },

        { text: '>+', class: 'edit', click: 'fg.currentCard.node._pos.width+=100;fg.resetCurrentCardPos()' },
        { text: 'v+', class: 'edit', click: 'fg.currentCard.node._pos.height+=100;fg.resetCurrentCardPos()' },

        { text: '连接', class: 'edit', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },

        { text: '复制', class: 'edit', click: 'fg.copyAndLink(fg.currentCard.index)' },

        { text: '?启用', class: 'run', click: 'console.log("尚未实现")' },

        { text: '?重置快照链', class: 'run', click: 'console.log("尚未实现")' },



        { text: '测试1-打印nodes', class: 'edit', click: 'console.log("\\n\\n\\n\\n"+fg.simpleJson(fg.nodes)+"\\n\\n\\n\\n")' },

        { text: '?以点击为起点深度优先自动排布', class: 'edit', click: 'console.log("尚未实现")' },

    ],
    [
        { text: 'run ', class: '', click: 'fg.toggleButton(btn);fg.toggleButton(btn.parentNode.parentNode.children[1-tindex].children[index]);fg.toggleMode();' },

        { text: '-', class: 'edit', click: 'fg.scale(1/1.1)', title: '视图缩小' },

        { text: '<', class: 'edit', click: 'fg.move("left")' },
        { text: 'v', class: 'edit', click: 'fg.move("down")' },
        { text: '>', class: 'edit', click: 'fg.move("right")' },

        { text: '>-', class: 'edit', click: 'fg.currentCard.node._pos.width-=100;fg.resetCurrentCardPos()' },
        { text: 'v-', class: 'edit', click: 'fg.currentCard.node._pos.height-=100;fg.resetCurrentCardPos()' },

        { text: '断开', class: 'edit', click: 'fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },

        { text: '删除', class: 'edit', click: 'fg.removeNode(fg.currentCard.index)' },

        { text: '?禁用', class: 'run', click: 'console.log("尚未实现")' },
        { text: '?运行链', class: 'run', click: 'console.log("尚未实现")' },
        { text: '?运行', class: 'run', click: 'console.log("尚未实现")' },
        { text: '?结果/文件', class: 'run primary', click: 'fg.toggleButton(btn);fg.mode.showfile*=-1' },
    ]
];

export const config = {
    Runtype: {
        "1": {
            type: 'node-post',
            url: 'http://127.0.0.1:12082/exec',
            messege: 'return Json.stringify({code:content,filename:filename})',
            show: 'Json.parse(ret);return ret.output+"\\n"+ret.error'
        },
        "": {
            type: 'terminal',
            messege: 'echo filename'
        },
        "2": {
            type: 'concat',
            filename: 'workspace.py'
        },
    }
}

export const cardData = [
    { text: "a", filename: "a.py", _pos: { left: 0, top: 0, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "b", filename: "b.py", _pos: { left: 200, top: 0, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "c", filename: "c.py", _pos: { left: 200, top: 100, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "d", filename: "d.py", snapshot: true, _pos: { left: 0, top: 100, width: 100, height: 100 }, _linkTo: { next: { "1": "previous", "2": "previous" } } },
    { text: "e1", filename: "e1.py", _pos: { left: 0, top: 200, width: 100, height: 100 }, _linkTo: { next: { "2": "previous" } } },
    { text: "e2", filename: "e2.py", _pos: { left: 300, top: 200, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "f", filename: "f.py", _pos: { left: 100, top: 200, width: 200, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "g", filename: "g.py", _pos: { left: 100, top: 300, width: 200, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "h", filename: "h.py", _pos: { left: 300, top: 300, width: 100, height: 100 } }
]