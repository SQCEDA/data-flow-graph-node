
import { connectAPI } from "./connectAPI.js";

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
        let func = new Function('fg', 'btn', 'tindex', 'index', fg.tools[tindex][index].click)
        func(fg, target, tindex, index)
    }
});
document.onkeydown = (e) => {
    let evtobj = window.event ? event : e
    let key = evtobj.key
    if (evtobj.ctrlKey) {
        key = 'ctrl+' + key
    }
    let id = fg.config.keymap[key]
    if (id) {
        [0, 1].forEach(tindex => {
            fg.tools[tindex].forEach((bi, index) => {
                if (bi.id == id) {
                    let func = new Function('fg', 'btn', 'tindex', 'index', bi.click)
                    func(fg, toolbar.children[tindex].children[index], tindex, index)
                }
            })
        });
    }
};

let elementScale = 1;
const lineElement = document.querySelector('.line-container');
const contentElement = document.querySelector('.content');
const contentScaleElement = document.querySelector('.content-scale');
const contentContainerElement = document.querySelector('.content-container');
const selectionBox = document.querySelector('.selectionBox');

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

        // 创建点击反馈效果
        if (1) {
            target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                target.style.transform = '';
            }, 150);
        }

        // 在实际应用中，这里可以添加按钮的具体功能
        console.log(`点击了卡片: ${target.textContent}`);
        let index = Array.prototype.indexOf.call(target.parentNode.children, target)
        fg.setAsCurrentCard(index)

        if (1) {
            document.querySelectorAll(`.linesi-${index} path`).forEach(v => {
                v.style.strokeWidth = '5px';
                setTimeout(() => {
                    v.style.strokeWidth = '';
                }, 300);
            })
        }

        fg.clickCard(index, target, directTarget, e)
    }
});

const multiSelect = {
    isSelecting: false,
}
const multiSelectListenEle = document.body
multiSelectListenEle.addEventListener('mousedown', function (e) {
    if (fg.mode.edit < 0) return
    if (fg.moveSetting.multiSelect < 0) return
    const rect = contentScaleElement.getBoundingClientRect();
    if (e.clientY < rect.top) return
    multiSelect.isSelecting = true;

    multiSelect.startX = e.clientX - rect.left;
    multiSelect.startY = e.clientY - rect.top;
    multiSelect.startX /= elementScale
    multiSelect.startY /= elementScale
    selectionBox.style.left = multiSelect.startX + 'px';
    selectionBox.style.top = multiSelect.startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
});
multiSelectListenEle.addEventListener('mousemove', function (e) {
    if (fg.mode.edit < 0) return
    if (fg.moveSetting.multiSelect < 0) return
    if (!multiSelect.isSelecting) return;
    const rect = contentScaleElement.getBoundingClientRect();
    multiSelect.endX = e.clientX - rect.left;
    multiSelect.endY = e.clientY - rect.top;
    multiSelect.endX /= elementScale
    multiSelect.endY /= elementScale
    multiSelect.left = Math.min(multiSelect.startX, multiSelect.endX);
    multiSelect.top = Math.min(multiSelect.startY, multiSelect.endY);
    multiSelect.width = Math.abs(multiSelect.endX - multiSelect.startX);
    multiSelect.height = Math.abs(multiSelect.endY - multiSelect.startY);
    selectionBox.style.left = multiSelect.left + 'px';
    selectionBox.style.top = multiSelect.top + 'px';
    selectionBox.style.width = multiSelect.width + 'px';
    selectionBox.style.height = multiSelect.height + 'px';
});

// 鼠标释放事件
multiSelectListenEle.addEventListener('mouseup', function () {
    if (fg.mode.edit < 0) return
    if (fg.moveSetting.multiSelect < 0) return
    if (!multiSelect.isSelecting) return;
    multiSelect.isSelecting = false;
    if (typeof multiSelect.endX === 'undefined' || typeof multiSelect.endY === 'undefined') {
        multiSelect.endX = multiSelect.startX;
        multiSelect.endY = multiSelect.startY;
    }
    multiSelect.left = Math.min(multiSelect.startX, multiSelect.endX);
    multiSelect.top = Math.min(multiSelect.startY, multiSelect.endY);
    multiSelect.width = Math.abs(multiSelect.endX - multiSelect.startX);
    multiSelect.height = Math.abs(multiSelect.endY - multiSelect.startY);
    selectionBox.style.display = 'none';
    fg.setMultiSelect(multiSelect)
});

const LEFTMARGIN = 200;
export const fg = {
    tools: [[], []],
    nodes: [],
    link: [],
    currentCard: { index: -1, card: null, node: null, tick: 0 },
    lastCard: { index: -1, card: null, node: null, tick: 0 },
    moveSetting: { down: -1, multiSelect: -1, multiSelectNodes: [] },
    mode: { edit: -1, run: 1, file: 1 },
    // state: {},
    record: [],
    savedKey: { _pos: undefined, _linkTo: undefined },
    connectAPI: connectAPI,
    config: {
        Runtype: {
            "": {
                type: 'terminal',
                message: 'echo __filename__'
            },
        },
        keymap: {},
    },
    getRandomString() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    },
    addToolbar(tools) {
        [0, 1].forEach(ii => {
            tools[ii].forEach((bi, index) => {
                const btn = document.createElement('button');
                btn.innerHTML = bi.text.replaceAll(' ', '&nbsp;')
                btn.className = 'toolbar-btn' + (bi.class ? ' ' + bi.class : '')
                let title = ''
                if (bi.id) {
                    title = ' | ' + bi.id
                    for (let k in fg.config.keymap) {
                        if (fg.config.keymap[k] == bi.id) title = title + ', ' + k
                    }
                }
                // btn.setAttribute('index', index+fg.tools[ii].length)
                if (bi.title) title = bi.title + title
                if (title) btn.setAttribute('title', title)
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
                card.style[k] = _pos[k] + LEFTMARGIN + 'px'
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
                line.style[k] = _pos[k] + LEFTMARGIN + 'px'
            } else {
                line.style[k] = _pos[k] + 'px'
            }
        }
    },
    guessType(node, range) {
        if (range == null) {
            range = Object.keys(fg.config.blockPrototype.blocks).filter(v => /[a-z]/.exec(v.slice(0, 1)))
        }
        if (range in fg.config.blockPrototype.collection) {
            range = fg.config.blockPrototype.collection[range]
        }
        let args = Object.keys(node).filter(v => Object.keys(fg.savedKey).indexOf(v) == -1)
        for (const type of range) {
            let block = fg.config.blockPrototype.blocks[type]
            if (block.checkType == 'type') {
                if (node[block.typename] == block.type) return block
            }
            if (block.checkType == 'args') {
                let bargs = block.args.map(v => v.name)
                let bargsnoomited = block.args.filter(v => !v.omitted).map(v => v.name)
                let allok = args.every(element => bargs.includes(element));
                let nomiss = bargsnoomited.every(element => args.includes(element));
                if (allok && nomiss) return block
            }
        }
        return null
    },
    buildField(argi, node, block) {
        let argv = block.args[argi]
        let field = fg.config.blockPrototype.blocks[argv.type]
        let value = node[argv.name]
        let ele = document.createElement(field.type);
        ele.className = 'field field-' + field.type;
        ele.setAttribute('title', argv.name)
        ele.innerText = value || '';
        return ele
    },
    buildMark(argi, type, node, block) {
        let argv = block[type == 't' ? 'linkTo' : 'linkFrom'][argi]
        let ele = document.createElement('linemark');
        ele.className = `linemark linemark-${type} linemarkname-${argv.name} linemarkdirect-${argv.direct} linemarknodepend-${argv.nodepend} linemarkposition-${argv.position}`;
        ele.innerText = type == 't' ? '●' : '○';
        return ele
    },
    buildCard(card, node, block) {
        card.innerHTML = ''
        card.className = 'card block';
        fg.setCardPos(card, node._pos)
        if (block == null) {
            const text = document.createElement('p');
            text.innerText = JSON.stringify(Object.assign({}, node, fg.savedKey))
            card.appendChild(text);
            return
        }
        card.className = 'card block block-' + block.type;
        card.setAttribute('block', block.type)
        let elements = [[]];
        let eline = elements[0]
        let message = block.message;
        for (let ma; ma = /%\d+ |%[tf]\d+ |\n|%%|%r/.exec(message);) {
            if (ma.index != 0) eline.push(message.slice(0, ma.index));
            if (ma[0] == '\n') {
                eline = []
                elements.push(eline)
            } else {
                eline.push(ma[0])
            }
            message = message.slice(ma.index + ma[0].length)
        }
        let lastbr;
        for (const eline of elements) {
            let lineEle = document.createElement('span');
            lineEle.className = 'fleft'
            for (let ei of eline) {
                if (ei == '%%') {
                    lineEle.append('%')
                } else if (/^%\d+ $/.exec(ei)) {
                    lineEle.append(fg.buildField(-1 + ~~ei.slice(1), node, block))
                } else if (/^%[tf]\d+ $/.exec(ei)) {
                    lineEle.append(fg.buildMark(-1 + ~~ei.slice(2), ei[1], node, block))
                } else if (ei == '%r') {
                    card.append(lineEle)
                    lineEle = document.createElement('span');
                    lineEle.className = 'fright'
                } else {
                    lineEle.append(ei)
                }
            }
            card.append(lineEle)
            lastbr = document.createElement('br');
            lastbr.style.clear = 'both'
            card.append(lastbr)
        }
        lastbr.remove()
        block.linkTo.forEach((v, i) => {
            if (v.position) {
                card.append(fg.buildMark(i, 't', node, block))
            }
        })
        block.linkTo.forEach((v, i) => {
            if (v.position) {
                card.append(fg.buildMark(i, 'f', node, block))
            }
        })

        return
    },
    cleanContent(){
        fg.nodes=[]
        fg.buildLines()
        contentElement.innerHTML=''
    },
    addContent(nodes) {
        nodes.forEach((node, index) => {
            let block = fg.guessType(node)
            const card = document.createElement('div');
            fg.buildCard(card, node, block)
            contentElement.appendChild(card);
        });
        fg.nodes.push(...nodes)
        fg.buildLines()
        fg.setAsCurrentCard(fg.nodes.length - 1)
        fg.setAsCurrentCard(fg.nodes.length - 1)
        fg.firstAddContent()
    },
    firstAddContent() {
        if (globalThis.__firstAddContent_has_run) return
        globalThis.__firstAddContent_has_run = 1
        contentContainerElement.scrollLeft = LEFTMARGIN
    },
    setAsCurrentCard(index) {
        Object.assign(fg.lastCard, fg.currentCard)
        fg.currentCard.index = index
        fg.currentCard.card = contentElement.children[index]
        fg.currentCard.node = fg.nodes[fg.currentCard.index]
        fg.currentCard.tick = new Date().getTime()
    },
    resetCurrentCardPos() {
        fg.setCardPos(fg.currentCard.card, fg.currentCard.node._pos)
        fg.buildLines() // 理论上只应该重连一个图块的线,有需求再优化
    },
    move(direct) {
        let sl = contentContainerElement.scrollLeft
        let st = contentContainerElement.scrollTop
        function moveNode(node) {
            switch (direct) {
                case 'up':
                    node._pos.top -= 100;
                    break;
                case 'down':
                    node._pos.top += 100;
                    break;
                case 'left':
                    node._pos.left -= 100;
                    break;
                case 'right':
                    node._pos.left += 100;
                    break;
            }
        }
        let node = fg.currentCard.node

        if (fg.moveSetting.multiSelect > 0) {
            let nodes = fg.moveSetting.multiSelectNodes
            nodes.forEach(v => {
                moveNode(v)
                fg.setCardPos(contentElement.children[fg.nodes.indexOf(v)], v._pos)
            })
            fg.buildLines() // 理论上只应该重连涉及的图块的线,有需求再优化
        } else if (fg.moveSetting.down < 0) {
            moveNode(node)
            fg.resetCurrentCardPos()
        } else {
            let nodes = fg.findNodeForward(fg.currentCard.index, (vv, lines) => {
                // 只接受next->previous的线
                if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
                    return false
                }
                return true
                // return vv._pos.left >= node._pos.left && vv._pos.top >= node._pos.top
            })
            nodes.forEach(v => {
                moveNode(v)
                fg.setCardPos(contentElement.children[fg.nodes.indexOf(v)], v._pos)
            })
            fg.buildLines() // 理论上只应该重连涉及的图块的线,有需求再优化
        }
        contentContainerElement.scrollLeft = sl
        contentContainerElement.scrollTop = st
    },
    scale(rate) {
        // let cr = /\((.*)\)/.exec(contentElement.style.transform)[1];
        // contentElement.style.transform = `scale(${rate * (parseFloat(cr) || 1)})`
        elementScale *= rate
        if (rate == null) elementScale = 1
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
        // console.log(lsindex, leindex, fg.link[lsindex][leindex])
        for (const linei of fg.link[lsindex][leindex]) {
            let { s, sb, e, eb, lsname, lename } = linei
            let sr = contentElement.children[lsindex].querySelector('.linemarkname-' + lsname).getBoundingClientRect()
            let er = contentElement.children[leindex].querySelector('.linemarkname-' + lename).getBoundingClientRect()
            const rect = contentScaleElement.getBoundingClientRect();

            let pts = [{
                left: sr.left + sr.width / 2 - rect.left,
                top: sr.top + sr.height / 2 - rect.top,
            }, {
                left: sr.left + sr.width / 2 - rect.left,
                top: sr.top + sr.height / 2 - rect.top,
            }, {
                left: er.left + er.width / 2 - rect.left,
                top: er.top + er.height / 2 - rect.top,
            }, {
                left: er.left + er.width / 2 - rect.left,
                top: er.top + er.height / 2 - rect.top,
            }]

            pts = pts.map(v => ({ left: v.left + 0.15104150772094727, top: v.top - 0.333333969116211 }))
            pts = pts.map(v => ({ left: v.left / elementScale, top: v.top / elementScale }))

            const l1 = 17
            let m = {
                up: { left: 0, top: -l1 },
                down: { left: 0, top: l1 },
                left: { left: -l1, top: 0 },
                right: { left: l1, top: 0 },
            }
            let sd = sb.linkTo.filter(v => v.name == lsname)[0].direct
            let ed = eb.linkFrom.filter(v => v.name == lename)[0].direct
            pts[1].left += m[sd].left
            pts[1].top += m[sd].top
            pts[2].left += m[ed].left
            pts[2].top += m[ed].top

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
            pts = pts.map(v => ({ left: v.left - pos.left - LEFTMARGIN, top: v.top - pos.top }))

            const line = document.createElement('div');
            line.className = `line linei-${lsindex}-${leindex} linesi-${lsindex} lineei-${leindex} line-${lsname}-${lename} lines-${lsname} linee-${lename}`;
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
            sb: fg.guessType(fg.nodes[lsindex]),
            e: fg.nodes[leindex]._pos,
            eb: fg.guessType(fg.nodes[leindex]),
            element: null,
            lsname,
            lename,
        })
        fg.reDrawLine(lsindex, leindex)
    },
    buildLines() {
        let sl = contentContainerElement.scrollLeft
        let st = contentContainerElement.scrollTop
        fg.cleanLines()
        fg.link = fg.nodes.map(v => fg.nodes.map(vv => []))
        fg.nodes.forEach((v, lsindex) => {
            if (v._linkTo) for (let lsname in v._linkTo) {
                for (let deltai in v._linkTo[lsname]) {
                    let lename = v._linkTo[lsname][deltai]
                    let leindex = lsindex + ~~deltai
                    if (leindex >= 0 && leindex < fg.nodes.length) {
                        fg.addLine(lsindex, leindex, lsname, lename)
                    }
                }
            }
        })
        contentContainerElement.scrollLeft = sl
        contentContainerElement.scrollTop = st
    },
    uiAddLine(lsindex, leindex, lsname, lename) {
        // console.log(lsindex, leindex, lsname, lename)
        for (const ll of fg.link[lsindex][leindex]) {
            if (lsname == ll.lsname && lename == ll.lename) {
                return
            }
        }
        // 暂时没做合法性检查 todo
        fg.nodes[lsindex]._linkTo = Object.assign({}, fg.nodes[lsindex]._linkTo)
        fg.nodes[lsindex]._linkTo[lsname] = Object.assign({}, fg.nodes[lsindex]._linkTo[lsname], { [leindex - lsindex]: lename })
        fg.addLine(lsindex, leindex, lsname, lename)
    },
    uiTryAddLine(lsindex, leindex) {
        // 尝试连接next之外的线
        let sb = fg.guessType(fg.nodes[lsindex])
        let eb = fg.guessType(fg.nodes[leindex])
        sb.linkTo.forEach(v => {
            if (v.name == 'next') return
            eb.linkFrom.filter(j => j.name == v.target).forEach(j => {
                fg.uiAddLine(lsindex, leindex, v.name, j.name)
            })
        })
    },
    uiRemoveLine(lsindex, leindex, lsname, lename) {
        // console.log(lsindex, leindex, lsname, lename)
        for (const ll of fg.link[lsindex][leindex]) {
            if (lsname == ll.lsname && lename == ll.lename) {
                ll.element.remove()
                fg.link[lsindex][leindex].splice(fg.link[lsindex][leindex].indexOf(ll), 1);
                delete fg.nodes[lsindex]._linkTo[lsname][leindex - lsindex]
                if (Object.keys(fg.nodes[lsindex]._linkTo[lsname]).length == 0) delete fg.nodes[lsindex]._linkTo[lsname]
                return
            }
        }
    },
    uiRemoveAllLine(lsindex, leindex) {
        for (let ll; ll = fg.link[lsindex][leindex].pop();) {
            let lsname = ll.lsname
            let lename = ll.lename
            ll.element.remove()
            delete fg.nodes[lsindex]._linkTo[lsname][leindex - lsindex]
            if (Object.keys(fg.nodes[lsindex]._linkTo[lsname]).length == 0) delete fg.nodes[lsindex]._linkTo[lsname]
        }
    },
    removeNode(index) {
        fg.nodes.forEach((v, lsindex) => {
            if (lsindex === index) return
            if (v._linkTo) for (let lsname in v._linkTo) {
                for (let deltai in v._linkTo[lsname]) {
                    let lename = v._linkTo[lsname][deltai]
                    let leindex = lsindex + ~~deltai
                    if (leindex === index) {
                        delete v._linkTo[lsname][deltai]
                        continue
                    }
                    if (lsindex < index && leindex > index) {
                        delete v._linkTo[lsname][deltai]
                        v._linkTo[lsname][-1 + ~~deltai] = lename
                        continue
                    }
                    if (lsindex > index && leindex < index) {
                        delete v._linkTo[lsname][deltai]
                        v._linkTo[lsname][1 + ~~deltai] = lename
                        continue
                    }
                }
            }
        })
        fg.nodes.splice(index, 1);
        contentElement.children[index].remove()
        fg.buildLines() // 理论上只应该重连涉及的图块的线,有需求再优化
    },
    findNodeBackward(index, filterFunc) {
        // 如果无环,结果是拓扑序
        if (filterFunc == null) filterFunc = () => true
        let nodes = [] // just for hash
        let ret = []
        function getnodes(v) {
            nodes.push(v)
            let leindex = fg.nodes.indexOf(v)
            for (let lsindex = 0; lsindex < fg.nodes.length; lsindex++) {
                if (fg.link[lsindex][leindex].length) {
                    let vv = fg.nodes[lsindex]
                    if (nodes.indexOf(vv) === -1 && filterFunc(vv, fg.link[lsindex][leindex])) {
                        getnodes(vv)
                    }
                }
            }
            ret.push(v)
        }
        getnodes(fg.nodes[index])
        return ret
    },
    findNodeForward(index, filterFunc) {
        // 如果无环,结果是拓扑序
        if (filterFunc == null) filterFunc = () => true
        let nodes = []
        function getnodes(v) {
            nodes.push(v)
            let lsindex = fg.nodes.indexOf(v)
            for (let leindex = 0; leindex < fg.nodes.length; leindex++) {
                if (fg.link[lsindex][leindex].length) {
                    let vv = fg.nodes[leindex]
                    if (nodes.indexOf(vv) === -1 && filterFunc(vv, fg.link[lsindex][leindex])) {
                        getnodes(vv)
                    }
                }
            }
        }
        getnodes(fg.nodes[index])
        return nodes
    },
    copyAndLink(index) {
        let node = JSON.parse(JSON.stringify(fg.nodes[index]))
        delete node._linkTo
        node._pos.top += node._pos.height
        fg.addContent([node])
        fg.uiAddLine(index, fg.nodes.length - 1, "next", "previous")
    },
    simpleJson(value) {
        function processValue(value) {
            if (Array.isArray(value)) {
                return `[${value.map(processValue).join(',')}]`;
            } else if (value !== null && typeof value === 'object') {
                const entries = Object.entries(value);
                const pairs = entries.map(([key, val]) => {
                    // 检查键是否可以作为合法的JavaScript标识符（不用引号）
                    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
                        return `${key}:${processValue(val)}`;
                    } else {
                        // 不合法的标识符需要保留引号
                        return `"${key}":${processValue(val)}`;
                    }
                });
                return `{${pairs.join(',')}}`;
            } else if (typeof value === 'string') {
                // 字符串值保持引号
                return JSON.stringify(value);
            } else {
                // 数字、布尔值、null等直接输出
                return String(value);
            }
        }
        let ret = '';
        if (Array.isArray(value)) {
            ret = `[\n    ${value.map(processValue).join(',\n    ')}\n]`;
        } else {
            ret = processValue(value)
        }
        // console.log(ret)
        return ret
    },
    toggleMode() {
        let ce = document.body
        fg.mode.run *= -1
        fg.mode.edit *= -1
        if (fg.mode.run > 0) {
            ce.classList.remove('editmode')
            ce.classList.add('runmode')
            fg.setRecord(fg.record)
        }
        if (fg.mode.edit > 0) {
            ce.classList.add('editmode')
            ce.classList.remove('runmode')
        }
    },
    clickCard(index, card, target, event) {
        // check if send to double click
        let node = fg.nodes[index]
        if (fg.mode.edit > 0) {
            while (!target.classList.contains('field') && target != document.body) {
                target = target.parentNode
            }
            if (target.classList.contains('field')) {
                let argvname = target.getAttribute('title')
                let block = fg.config.blockPrototype.blocks[card.getAttribute('block')]
                connectAPI.prompt(argvname, node[argvname] || '', (data) => {
                    if (data == null) return
                    node[argvname] = data
                    fg.buildCard(card, node, block)
                })
            }
            return
        }
        if (fg.mode.run > 0 && fg.mode.file > 0) {
            connectAPI.showFile(Array.isArray(node.filename) ? node.filename[0] : node.filename)
            return
        }
    },
    changeNodeType(index) {
        let node = fg.nodes[index]
        let card = contentElement.children[index]
        let block = fg.config.blockPrototype.blocks[card.getAttribute('block')]
        let rblock = block
        if (block.type == 'runfile') {
            rblock = fg.config.blockPrototype.blocks['conditionfile']
            node.condition = rblock.args.filter(v => v.name == 'condition')[0].value
            fg.buildCard(card, node, rblock)
        } else if (block.type == 'conditionfile') {
            rblock = fg.config.blockPrototype.blocks['runfile']
            delete node.condition
            delete node.maxCount
            delete node?._linkTo?.drop
            fg.buildCard(card, node, rblock)
            fg.buildLines()
        } else {
            let range = block.linkFrom.filter(v => v.name == 'previous')[0].range
            if (range in fg.config.blockPrototype.collection) {
                range = fg.config.blockPrototype.collection[range]
            }
            if (block.checkType == 'type' && range.includes(block.type)) {
                let newtype = range[(range.indexOf(block.type) + 1) % range.length]
                rblock = fg.config.blockPrototype.blocks[newtype]
                node[rblock.typename] = newtype
                if (node._linkTo) {
                    for (let k in node._linkTo) {
                        if (rblock.linkTo.filter(v => v.name == k).length == 0) delete node._linkTo[k]
                    }
                }
                fg.buildCard(card, node, rblock)
            }
        }

    },
    // saveState(){
    //     connectAPI.send({ command: 'saveState', state: fg.state })
    // },
    // updateFromState(state){
    //     // update from fg.state
    //     fg.state=state
    //     contentContainerElement.scrollLeft = LEFTMARGIN
    // },
    // requestState(){
    //     connectAPI.send({ command: 'requestState' })
    // },
    requestConfig() {
        connectAPI.send({ command: 'requestConfig' })
    },
    requestNodes() {
        connectAPI.send({ command: 'requestNodes' })
    },
    requestRecord() {
        connectAPI.send({ command: 'requestRecord' })
    },
    runNodes(indexes) {
        fg.connectAPI.send({ command: 'runNodes', nodes: fg.nodes, indexes: indexes })
    },
    runChain(index) {
        fg.connectAPI.send({ command: 'runChain', nodes: fg.nodes, targetIndex: index })
    },
    addResult(ctx) {
        let record = fg.record.filter(v => v.rid == ctx.rid)
        if (record.length) {
            Object.assign(record[0], ctx)
            let index = fg.record.indexOf(record[0])
            if (fg.nodes[index].snapshot) {
                contentElement.children[index].querySelector('snapshot').style.background = `rgb(${155 + ctx.snapshot % 100}, ${155 + 2 * ctx.snapshot % 100}, ${155 + 3 * ctx.snapshot % 100})`
            }
        }
        // 提醒放在node侧, web侧只改节点颜色
    },
    showResult(index) {
        let node = fg.nodes[index]
        let toshow = Array.isArray(node.filename) ? node.filename[0] : node.filename
        toshow += '\n'
        if (index in fg.record && fg.record[index]) {
            let ctx = fg.record[index]
            toshow += JSON.stringify(ctx, null, 4)
            if (ctx.output) {
                toshow += '\n\n' + ctx.output
            }
            if (ctx.error) {
                toshow += '\n\n' + ctx.error
            }
        } else {
            toshow += 'null'
        }
        connectAPI.showText(toshow)
    },
    setRecord(record) {
        fg.record = record
        record.forEach((ctx, index) => {
            if (fg.nodes[index].snapshot) {

                contentElement.children[index].querySelector('snapshot').style.background = ctx.snapshot ? `rgb(${155 + ctx.snapshot % 100}, ${155 + 2 * ctx.snapshot % 100}, ${155 + 3 * ctx.snapshot % 100})` : ''
            }
        })
    },
    clearSnapshotChain(index) {
        let nodes = fg.findNodeForward(index, (v, lines) => {
            // 只接受next->previous的线
            if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
                return false
            }
            return true
        })
        let indexes = []
        nodes.forEach(v => {
            let index = fg.nodes.indexOf(v)
            let record = fg.record[index]
            if (record && record.snapshot) {
                indexes.push(index)
            }
        })
        fg.connectAPI.send({ command: 'clearSnapshot', indexes: indexes })
    },
    saveNodes() {
        fg.connectAPI.send({ command: 'saveNodes', nodes: fg.nodes })
    },
    setMultiSelect(multiSelect) {
        fg.moveSetting.multiSelectNodes = fg.nodes.filter((v, i) => {
            if (v._pos.left + 50 < multiSelect.left - LEFTMARGIN) return false
            if (v._pos.left + v._pos.width - 50 > multiSelect.left + multiSelect.width - LEFTMARGIN) return false
            if (v._pos.top + 50 < multiSelect.top) return false
            if (v._pos.top + v._pos.height - 50 > multiSelect.top + multiSelect.height) return false

            let target = contentElement.children[i]
            target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                target.style.transform = '';
            }, 150);

            return true
        })
    },
    autoLayout() {
        import('./levelTopologicalSort.js').then((m) => {
            let levelTopologicalSort = m.levelTopologicalSort || globalThis.levelTopologicalSort
            let indexes = null
            if (fg.moveSetting.down > 0) {
                indexes = fg.findNodeForward(fg.currentCard.index, (vv, lines) => {
                    // 只接受next->previous的线
                    if (lines.filter(l => l.lsname == 'next' && l.lename == 'previous').length == 0) {
                        return false
                    }
                    return true
                }).map(v => fg.nodes.indexOf(v))
            }
            if (fg.moveSetting.multiSelect > 0) {
                indexes = fg.moveSetting.multiSelectNodes.map(v => fg.nodes.indexOf(v))
            }
            const { ring, levels } = levelTopologicalSort(fg.nodes, indexes)
            // console.log(levels, ring, indexes)
            if (ring) {
                fg.connectAPI.info('当前节点图包含环无法自动排布')
                return
            }
            if (levels.length == 0) {
                fg.connectAPI.info('当前无选中的节点')
                return
            }
            let top = fg.nodes[levels[0][0]]._pos.top
            for (const level of levels) {
                let maxHeight = 0
                let left = fg.nodes[levels[0][0]]._pos.left
                level.sort((a, b) => fg.nodes[a]._pos.left + 0.00001 * a - fg.nodes[b]._pos.left + 0.00001 * b)
                for (const index of level) {
                    let node = fg.nodes[index]
                    node._pos.left = left
                    left += node._pos.width
                    node._pos.top = top
                    maxHeight = Math.max(maxHeight, node._pos.height)
                    fg.setCardPos(contentElement.children[index], node._pos)
                }
                top += maxHeight
            }
            fg.buildLines()
        })
    },
    print(obj) {
        let print = fg.connectAPI.isDebug ? console.log : connectAPI.showText
        typeof obj == typeof '' ? print(obj) : print('\n\n\n\n' + JSON.stringify(obj, null, 4) + '\n\n\n\n')
    },
    setConfig(config) {
        Object.assign(fg.config, config)
        fg.addToolbar(config.toolbarData)
        config?.custom?.operate?.forEach(operate => {
            if (operate.type === 'script') {
                let func = new Function('fg', operate.function)
                func(fg)
            }
        })

    },
    setupConnect() {
        fg.connectAPI.recieve.config = 'fg.setConfig(message.content);fg.requestNodes()'
        fg.connectAPI.recieve.nodes = 'fg.addContent(message.content);fg.requestRecord()'
        fg.connectAPI.recieve.result = 'fg.addResult(message.content);'
        fg.connectAPI.recieve.record = 'fg.setRecord(message.content);'
        fg.requestConfig()

    },
};

globalThis.fg = fg;


