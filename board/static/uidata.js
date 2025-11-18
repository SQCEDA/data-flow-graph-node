export const toolbarData = [
    [
        { text: 'edit', class: 'primary edit' },

        { text: '+', class: 'edit', click: 'fg.scale(1.1)' },

        { text: '  ', class: 'edit', click: ' ', title: '占位符无意义' },
        { text: '^', class: 'edit', click: 'fg.currentCard.node.pos.top-=100;fg.resetCurrentCardPos()' },
        { text: '  ', class: 'edit', click: ' ', title: '占位符无意义' },

        { text: '>+', class: 'edit', click: 'fg.currentCard.node.pos.width+=100;fg.resetCurrentCardPos()' },
        { text: 'v+', class: 'edit', click: 'fg.currentCard.node.pos.height+=100;fg.resetCurrentCardPos()' },
        
    ],
    [
        { text: ' run', class: 'primary' },

        { text: '- ', class: 'edit', click: 'fg.scale(1/1.1)' },

        { text: '<', class: 'edit', click: 'fg.currentCard.node.pos.left-=100;fg.resetCurrentCardPos()' },
        { text: 'v', class: 'edit', click: 'fg.currentCard.node.pos.top+=100;fg.resetCurrentCardPos()' },
        { text: '>', class: 'edit', click: 'fg.currentCard.node.pos.left+=100;fg.resetCurrentCardPos()' },

        { text: '>- ', class: 'edit', click: 'fg.currentCard.node.pos.width-=100;fg.resetCurrentCardPos()' },
        { text: 'v- ', class: 'edit', click: 'fg.currentCard.node.pos.height-=100;fg.resetCurrentCardPos()' },
    ]
];

export const cardData = [
    { id: 'dddd', text: 'dddd\na content', file: 'a.py', pos: { left: 1400, top: 1200, width: 100, height: 100 } },
    { id: 'asd', text: 'asd\na content', file: 'a.py', pos: { left: 0, top: 0, width: 200, height: 200 } },
    { id: 'abc', text: 'abc\na content', file: 'a.py', pos: { left: 300, top: 200, width: 100, height: 100 } },
    { id: 'abcd', text: 'abcd\na content', file: 'a.py', pos: { left: 400, top: 200, width: 100, height: 100 } },
];
