
// 工具栏鼠标滚轮水平滚动
const toolbar = document.querySelector('.toolbar');
toolbar.addEventListener('wheel', function (e) {
    // 阻止默认的垂直滚动
    e.preventDefault();
    // 将垂直滚动量转换为水平滚动
    this.scrollLeft += e.deltaY;
});
// 添加工具栏按钮点击事件
toolbar.addEventListener('click', function (e) {
    // console.log(e)
    if (e.target.localName === 'button') {
        // 创建点击反馈效果
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = '';
        }, 150);

        // 在实际应用中，这里可以添加按钮的具体功能
        console.log(`点击了按钮: ${e.target.textContent}`);
        let target = e.target

        let index = Array.prototype.indexOf.call(target.parentNode.children, target)
        let tindex = Array.prototype.indexOf.call(target.parentNode.parentNode.children, target.parentNode)
        let func = new Function('btn', 'tindex', 'index', fg.tools[tindex][index].click)
        func(target, tindex, index)
    }
});

let elementScale = 1;
const lineElement = document.querySelector('.line');
const contentElement = document.querySelector('.content');
const contentScaleElement = document.querySelector('.content-scale');

contentElement.addEventListener('click', function (e) {
    // console.log(e)
    let directClick = true
    let directTarget = e.target
    let target = e.target
    while (target.localName !== 'div') {
        directClick = false
        target = target.parentNode
    }
    if (target.classList.contains('card')) {
        let index = Array.prototype.indexOf.call(target.parentNode.children, target)
        fg.setAsCurrentCard(index)

        // 创建点击反馈效果
        if (directClick) {
            target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                target.style.transform = '';
            }, 150);
        }

        // 在实际应用中，这里可以添加按钮的具体功能
        console.log(`点击了卡片: ${target.textContent}`);
    }
});

export const fg = {
    tools: [[], []],
    nodes: [],
    link: [],
    currentCard: { index: -1, card: null, node: null, tick: 0 },
    moveSetting: { up: -1, down: 1 },
    addToolbar(tools) {
        [0, 1].forEach(ii => {
            tools[ii].forEach((bi, index) => {
                const btn = document.createElement('button');
                btn.innerHTML = bi.text.replaceAll(' ', '&nbsp;')
                btn.className = 'toolbar-btn' + (bi.class ? ' ' + bi.class : '')
                // btn.setAttribute('index', index+fg.tools[ii].length)
                if (bi.title) btn.setAttribute('title', bi.title)
                toolbar.children[ii].appendChild(btn);
            })
            fg.tools[ii].push(...tools[ii])
        });
    },
    setCardPos(card, _pos) {
        if (card == null) return
        for (let k in _pos) {
            if (['height', 'width'].includes(k)) {
                if (_pos[k] <= 0) _pos[k] = 100
                card.style[k] = _pos[k] - 20 + 'px'
            } else if (['left'].includes(k)) {
                if (_pos[k] <= 0) _pos[k] = 0
                card.style[k] = _pos[k] + 200 + 'px'
            } else { // top
                if (_pos[k] <= 0) _pos[k] = 0
                card.style[k] = _pos[k] + 'px'
            }
        }
    },
    setLinePos(line, _pos) {
        if (line == null) return
        for (let k in _pos) {
            if (['left'].includes(k)) {
                line.style[k] = _pos[k] + 200 + 'px'
            } else {
                line.style[k] = _pos[k] + 'px'
            }
        }
    },
    addContent(nodes) {

        nodes.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card';

            card.setAttribute('id', item.id)
            // card.setAttribute('index', index+fg.nodes.length)

            const text = document.createElement('p');
            text.innerText = item.text + '\n' + item.file;

            fg.setCardPos(card, item._pos)

            card.appendChild(text);

            contentElement.appendChild(card);

        });
        fg.nodes.push(...nodes)
        fg.buildLines()
        fg.setAsCurrentCard(fg.nodes.length - 1)
    },
    setAsCurrentCard(index) {
        fg.currentCard.index = index
        fg.currentCard.card = contentElement.children[index]
        fg.currentCard.node = fg.nodes[fg.currentCard.index]
        fg.currentCard.tick = new Date().getTime()
    },
    resetCurrentCardPos() {
        fg.setCardPos(fg.currentCard.card, fg.currentCard.node._pos)
        fg.buildLines() // 有需求再优化
    },
    move(direct) {
        switch (direct) {
            case 'up':
                fg.currentCard.node._pos.top -= 100; fg.resetCurrentCardPos()
                break;
            case 'down':
                fg.currentCard.node._pos.top += 100; fg.resetCurrentCardPos()
                break;
            case 'left':
                fg.currentCard.node._pos.left -= 100; fg.resetCurrentCardPos()
                break;
            case 'right':
                fg.currentCard.node._pos.left += 100; fg.resetCurrentCardPos()
                break;
        }
    },
    scale(rate) {
        // let cr = /\((.*)\)/.exec(contentElement.style.transform)[1];
        // contentElement.style.transform = `scale(${rate * (parseFloat(cr) || 1)})`
        elementScale *= rate
        contentScaleElement.style.transform = `scale(${elementScale})`
    },
    toggleButton(btn) {
        btn.classList.contains("primary") ? btn.classList.remove("primary") : btn.classList.add("primary")
    },
    cleanLines() {
        fg.link = []
        lineElement.innerHTML = ''
    },
    reDrawLine(lsindex, leindex) {
        console.log(lsindex, leindex, fg.link[lsindex][leindex])
        for (const linei of fg.link[lsindex][leindex]) {
            let { s, e } = linei
            function getExpandedBoundingRect(rect1, rect2, expand = 100) {
                const minX = Math.min(rect1.left, rect2.left);
                const minY = Math.min(rect1.top, rect2.top);
                const maxX = Math.max(rect1.left + rect1.width, rect2.left + rect2.width);
                const maxY = Math.max(rect1.top + rect1.height, rect2.top + rect2.height);
                const boundingWidth = maxX - minX;
                const boundingHeight = maxY - minY;
                const expandedRect = {
                    left: minX - expand,
                    top: minY - expand,
                    width: boundingWidth + (expand * 2),
                    height: boundingHeight + (expand * 2)
                };
                return expandedRect;
            }
            let pos = getExpandedBoundingRect(s, e)
            const b1 = 15
            const l1 = 17
            let pts = [{
                left: s.left + s.width / 2,
                top: s.top + s.height - b1,
            }, {
                left: s.left + s.width / 2,
                top: s.top + s.height - b1 + l1,
            }, {
                left: e.left + e.width / 2,
                top: e.top + b1 - l1,
            }, {
                left: e.left + e.width / 2,
                top: e.top + b1,
            }].map(v => ({ left: v.left - pos.left, top: v.top - pos.top }))

            const line = document.createElement('div');
            line.className = 'line';
            line.innerHTML = `<svg width="${pos.width}" height="${pos.height}" xmlns="http://www.w3.org/2000/svg"><path d="M ${pts[0].left} ${pts[0].top} C ${pts[1].left} ${pts[1].top} ${pts[2].left} ${pts[2].top} ${pts[3].left} ${pts[3].top}" stroke="white" fill="transparent"/></svg>`
            fg.setLinePos(line, pos)
            if (linei.element) linei.element.remove();
            linei.element = line
            lineElement.appendChild(line);
        }
    },
    addLine(lsindex, leindex, lsname, lename) {
        // console.log(lsindex, leindex, lsname, lename)
        fg.link[lsindex][leindex].push({
            s: fg.nodes[lsindex]._pos,
            sp: 'down',
            e: fg.nodes[leindex]._pos,
            ep: 'up',
            element: null,
            lsname,
            lename,
        })
        fg.reDrawLine(lsindex, leindex)
    },
    buildLines() {
        fg.cleanLines()
        fg.link = fg.nodes.map(v => fg.nodes.map(vv => []))
        fg.nodes.forEach((v, lsindex) => {
            if (v._linkTo) for (let lsname in v._linkTo) {
                for (let deltai in v._linkTo[lsname]) {
                    let lename = v._linkTo[lsname][deltai]
                    let leindex = lsindex + ~~deltai
                    fg.addLine(lsindex, leindex, lsname, lename)
                }
            }
        })

    },
};





