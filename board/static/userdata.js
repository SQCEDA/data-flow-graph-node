export const toolbarData = [
    [
        { text: 'edit', class: 'primary' },

        { text: '+', class: 'edit', click: 'fg.scale(1.1)', title: '视图放大' },

        { text: 'r', class: 'edit', click: 'fg.scale()', title: '恢复初始视图大小' },
        { text: '^', class: 'edit', click: 'fg.move("up")' },
        { text: 'd', class: 'edit primary', click: 'fg.toggleButton(btn);fg.moveSetting.down*=-1', title: '同时移动右下方的连接' },

        { text: '>+', class: 'edit', click: 'fg.currentCard.node._pos.width+=100;fg.resetCurrentCardPos()' },
        { text: 'v+', class: 'edit', click: 'fg.currentCard.node._pos.height+=100;fg.resetCurrentCardPos()' },

        { text: '连接', class: 'edit', click: 'fg.uiAddLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },

        { text: '复制', class: 'edit', click: 'fg.copyAndLink(fg.currentCard.index)' },



        { text: '测试1-打印nodes', class: 'edit', click: 'console.log("\\n\\n\\n\\n"+fg.simpleJson(fg.nodes)+"\\n\\n\\n\\n")' },

        { text: '?以点击为起点深度优先自动排布', class: 'edit', click: 'console.log("尚未实现")' },

    ],
    [
        { text: 'run ', class: '' },

        { text: '-', class: 'edit', click: 'fg.scale(1/1.1)', title: '视图缩小' },

        { text: '<', class: 'edit', click: 'fg.move("left")' },
        { text: 'v', class: 'edit', click: 'fg.move("down")' },
        { text: '>', class: 'edit', click: 'fg.move("right")' },

        { text: '>-', class: 'edit', click: 'fg.currentCard.node._pos.width-=100;fg.resetCurrentCardPos()' },
        { text: 'v-', class: 'edit', click: 'fg.currentCard.node._pos.height-=100;fg.resetCurrentCardPos()' },

        { text: '断开', class: 'edit', click: 'fg.uiRemoveLine(fg.lastCard.index,fg.currentCard.index,"next","previous")' },

        { text: '删除', class: 'edit', click: 'fg.removeNode(fg.currentCard.index)' },
    ]
];

export const cardData = [
    { text: "a", file: "a.py", _pos: { left: 0, top: 0, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "b", file: "b.py", _pos: { left: 200, top: 0, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "c", file: "c.py", _pos: { left: 200, top: 100, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "d", file: "d.py", snapshot: true, _pos: { left: 0, top: 100, width: 100, height: 100 }, _linkTo: { next: { "1": "previous", "2": "previous" } } },
    { text: "e1", file: "e1.py", _pos: { left: 0, top: 200, width: 100, height: 100 }, _linkTo: { next: { "2": "previous" } } },
    { text: "e2", file: "e2.py", _pos: { left: 300, top: 200, width: 100, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "f", file: "f.py", _pos: { left: 100, top: 200, width: 200, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "g", file: "g.py", _pos: { left: 100, top: 300, width: 200, height: 100 }, _linkTo: { next: { "1": "previous" } } },
    { text: "h", file: "h.py", _pos: { left: 300, top: 300, width: 100, height: 100 } }
]