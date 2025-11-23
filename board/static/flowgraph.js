
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
        fg.clickCard(index)
    }
});

const LEFTMARGIN = 200;
export const fg = {
    tools: [[], []],
    nodes: [],
    link: [],
    currentCard: { index: -1, card: null, node: null, tick: 0 },
    lastCard: { index: -1, card: null, node: null, tick: 0 },
    moveSetting: { down: 1 },
    mode: { edit: 1, run: -1 },
    // state: {},
    record: {},
    connectAPI:connectAPI,
    config: {
        Runtype: {
            "": {
                type: 'terminal',
                messege: 'echo filename'
            },
        }
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
    addContent(nodes) {

        nodes.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card';

            // card.setAttribute('id', item.id)
            // card.setAttribute('index', index+fg.nodes.length)

            const text = document.createElement('p');
            text.innerText = item.text + '\n' + item.filename + (item.snapshot ? '\nsnap' : '');

            fg.setCardPos(card, item._pos)

            card.appendChild(text);

            contentElement.appendChild(card);

        });
        fg.nodes.push(...nodes)
        fg.buildLines()
        fg.setAsCurrentCard(fg.nodes.length - 1)
        fg.setAsCurrentCard(fg.nodes.length - 1)
        fg.firstAddContent()
    },
    firstAddContent(){
        if(globalThis.__firstAddContent_has_run)return
        globalThis.__firstAddContent_has_run=1
        document.querySelector(".content-container").scrollLeft = 200
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
        if (fg.moveSetting.down < 0) {
            moveNode(node)
            fg.resetCurrentCardPos()
        } else {
            let nodes = []
            function getnodes(v) {
                nodes.push(v)
                let lsindex = fg.nodes.indexOf(v)
                if (v._linkTo) for (let lsname in v._linkTo) {
                    for (let deltai in v._linkTo[lsname]) {
                        // let lename = v._linkTo[lsname][deltai]
                        let leindex = lsindex + ~~deltai
                        if (leindex >= 0 && leindex < fg.nodes.length) {
                            let vv = fg.nodes[leindex]
                            if (vv._pos.left >= node._pos.left && vv._pos.top >= node._pos.top && nodes.indexOf(vv) === -1) {
                                getnodes(vv)
                            }
                        }
                    }
                }
            }
            getnodes(node)
            nodes.forEach(v => {
                moveNode(v)
                fg.setCardPos(contentElement.children[fg.nodes.indexOf(v)], v._pos)
            })
            fg.buildLines() // 理论上只应该重连涉及的图块的线,有需求再优化
        }
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
                    if (leindex >= 0 && leindex < fg.nodes.length) {
                        fg.addLine(lsindex, leindex, lsname, lename)
                    }
                }
            }
        })
    },
    uiAddLine(lsindex, leindex, lsname, lename) {
        // console.log(lsindex, leindex, lsname, lename)
        for (const ll of fg.link[lsindex][leindex]) {
            if (lsname == ll.lsname && lename == ll.lename) {
                return
            }
        }
        fg.nodes[lsindex]._linkTo = Object.assign({}, fg.nodes[lsindex]._linkTo)
        fg.nodes[lsindex]._linkTo[lsname] = Object.assign({}, fg.nodes[lsindex]._linkTo[lsname], { [leindex - lsindex]: lename })
        fg.addLine(lsindex, leindex, lsname, lename)
    },
    uiRemoveLine(lsindex, leindex, lsname, lename) {
        // console.log(lsindex, leindex, lsname, lename)
        for (const ll of fg.link[lsindex][leindex]) {
            if (lsname == ll.lsname && lename == ll.lename) {
                ll.element.remove()
                fg.link[lsindex][leindex].splice(fg.link[lsindex][leindex].indexOf(ll), 1);
                delete fg.nodes[lsindex]._linkTo[lsname]
                return
            }
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
        fg.mode.run *= -1
        fg.mode.edit *= -1
    },
    clickCard(index) {
        // check if send to double click
        let node = fg.nodes[index]
        if (fg.mode.edit > 0) {
            return
        }
        if (fg.mode.run > 0) {
            connectAPI.showFile(Array.isArray(node.filename) ? node.filename[0] : node.filename)
            return
        }
    },
    // saveState(){
    //     connectAPI.send({ command: 'saveState', state: fg.state })
    // },
    // updateFromState(state){
    //     // update from fg.state
    //     fg.state=state
    //     document.querySelector(".content-container").scrollLeft = 200
    // },
    // requestState(){
    //     connectAPI.send({ command: 'requestState' })
    // },
    requestConfig(){
        connectAPI.send({ command: 'requestConfig' })
    },
    requestNodes(){
        connectAPI.send({ command: 'requestNodes' })
    },
    runNodes(indexes) {
        let files=indexes.map(index=>{
            let node = fg.nodes[index]
            let rid = fg.getRandomString()
            let submitTick = new Date().getTime()
            let runtype = node.runtype?node.runtype[0]:''
            let rconfig = fg.config.Runtype[runtype]
            let filename=Array.isArray(node.filename) ? node.filename[0] : node.filename
            let ret={rid,rconfig,filename,submitTick}
            fg.record[index]=ret
            return ret
        })
        fg.connectAPI.send({ command: 'runFiles', files: files })
    },
    addResult(ret){
        let record=fg.record.filter(v=>v.rid==ret.rid)
        if (record.length) {
            Object.assign(record[0],ret)
        }
        // 提醒放在node侧, web侧不做提醒
    },
    showResult(index){
        let node = fg.nodes[index]
        let toshow=Array.isArray(node.filename) ? node.filename[0] : node.filename
        toshow+='\n'
        if (index in fg.record) {
            toshow+=JSON.stringify(fg.record[index],null,4)
        } else {
            toshow+='null'
        }
        connectAPI.showText(toshow)
    },
    print(obj){
        let print=fg.connectAPI.isDebug?console.log:connectAPI.showText
        typeof obj == typeof ''?print(obj):print('\n\n\n\n'+JSON.stringify(obj,null,4)+'\n\n\n\n')
    },
    setConfig(config) {
        Object.assign(fg.config, config)
        fg.addToolbar(config.toolbar)
    },
    setupConnect(){
        fg.connectAPI.recieve.config='fg.setConfig(message.content);fg.requestNodes()'
        fg.connectAPI.recieve.nodes='fg.addContent(message.content);'
        fg.connectAPI.recieve.result='fg.addResult(message.content);'
        fg.requestConfig()
    },
};

globalThis.fg = fg;


