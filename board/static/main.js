import { toolbarData, cardData } from './data.js'

const g = {};
globalThis.g = g;

g.tools = toolbarData
g.nodes = cardData

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
    }
});

{
    [0, 1].forEach(ii => {
        g.tools[ii].forEach(bi => {
            const btn = document.createElement('button');
            btn.innerHTML = bi.text.replaceAll(' ', '&nbsp;')
            btn.className = 'toolbar-btn' + (bi.class ? ' ' + bi.class : '')
            toolbar.children[ii].appendChild(btn);
        })
    });
};

const content = document.querySelector('.content');
content.addEventListener('click', function (e) {
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

const contentContainer = document.querySelector('.content');


g.nodes.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'card';

    card.setAttribute('id', item.id)

    const text = document.createElement('p');
    text.innerText = item.text;

    for (let k in item.pos) {
        if (['height', 'width'].includes(k)) {
            card.style[k] = item.pos[k] - 20 + 'px'
        } else {
            card.style[k] = item.pos[k] + 'px'
        }
    }

    card.appendChild(text);

    contentContainer.appendChild(card);

});