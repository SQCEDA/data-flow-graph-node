export const toolbarData = [
    [
        { text: 'edit', class: 'primary' },

        { text: '+', class: 'edit', click: 'fg.scale(1.1)' },

        { text: 'u', class: 'edit', click: 'fg.toggleButton(btn);fg.moveSetting.up*=-1', title: '同时移动左上方' },
        { text: '^', class: 'edit', click: 'fg.move("up")' },
        { text: 'd', class: 'edit primary', click: 'fg.toggleButton(btn);fg.moveSetting.down*=-1', title: '同时移动右下方' },

        { text: '>+', class: 'edit', click: 'fg.currentCard.node._pos.width+=100;fg.resetCurrentCardPos()' },
        { text: 'v+', class: 'edit', click: 'fg.currentCard.node._pos.height+=100;fg.resetCurrentCardPos()' },

    ],
    [
        { text: 'run ', class: '' },

        { text: '-', class: 'edit', click: 'fg.scale(1/1.1)' },

        { text: '<', class: 'edit', click: 'fg.move("left")' },
        { text: 'v', class: 'edit', click: 'fg.move("down")' },
        { text: '>', class: 'edit', click: 'fg.move("right")' },

        { text: '>-', class: 'edit', click: 'fg.currentCard.node._pos.width-=100;fg.resetCurrentCardPos()' },
        { text: 'v-', class: 'edit', click: 'fg.currentCard.node._pos.height-=100;fg.resetCurrentCardPos()' },
    ]
];

export const cardData = [
    { id: 'dddd', text: 'dddd\na content', file: 'a.py', _pos: { left: 1400, top: 1200, width: 100, height: 100 } },
    { id: 'asd', text: '中文asd\n中文a content', file: 'a.py', _pos: { left: 0, top: 0, width: 200, height: 200 }, _linkTo: { next: { 1: 'previous', 2: 'previous' , '-1': 'previous' } } },
    { id: 'abc', text: 'abc\na content', file: 'a.py', _pos: { left: 200, top: 200, width: 100, height: 100 } },
    { id: 'abcd', text: 'abcd\na content', file: 'a.py', _pos: { left: 400, top: 200, width: 100, height: 100 } },
];
