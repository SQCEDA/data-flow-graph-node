## 一些实现记录

按钮release 右下角弹出三个按钮
push release
pull release (cover)
pull release (merge)
-> 弹出一个输入框默认是当前的githash, 可以改. 也起到一个二次确认的作用
变量约定
x.flowgraph.json: giturl filenames owner projectname 其中filenames约定一些特殊kv对放类似于cache.json用来merge
settings.json: gitexe author release-server-url



_pos记录位置

内部计算使用邻接表
存读时放_linkto.next使用相对index偏移

插件内部需要维护一个state 存运行结果/状态 以及界面状态等等

打开流程:
打开文件xxx.flowgraph.json, 右键菜单或者f1执行命令
插件加载xxx.flowgraph.json, 其中包含xxx.flowgraph.config.json的路径, 也打开加载
flowgraph->carddata
flowgraph.config->config
拉起webview
webview:requestConfig 拿到config
webview:requestNodes 拿到carddata
webview:requestRecord 

用retainContextWhenHidden: true来避免离屏幕销毁了, 多占点内存省事

运行流程
点击运行或运行链
webview:runFiles
await依次执行, 每执行完一个showText加上ext:result
全部完成后ext:record
(暂未添加快照的处理, ?引入目录监测)
(中间如果出现过删除节点?)

runtype 添加jupyter有关的支持  
能用但感觉连接方式不稳定, 后续要fork vscode-jupyter的插件自己魔改一下

通过proto来渲染方块

多选的移动

conditionfile

快捷键绑定

runfiles机制支持反馈:
问题描述:
首先由一些常规的有向的实线边构成有向无环图, 然后其中部分点变成反馈点, 会指一个虚线的边出来指向一个会构成环的点(换句话说,指向其先驱或指向自己), 其含义是概率使得该点以及所有实线后继链失效
一个点被运行后称为有效, 其所有实线先驱必须先有效才能运行
给定一个目标点需要使其有效, 给出一个好的运行策略尽量少运行总次数
解法:
尽量先跑反馈点:
用思想类似Dijkstra的算法, 初始值全部-1, 目标点1,
点与点之间只看常规边,正常的点为起点的边=1,反馈点的为起点的边=总点数
每次取正的节点中最小的点, 指向他的点的值, 值变为max(原值, 该值加边权)
最后一个取的点是第一个要运行的点
分析:
点的源一定比点大,得出的运行顺序一定有效,有多选时反馈点多的路线先被取了
可能有问题的点:
没体现出反馈环的长短, 两个难度不同的反馈链指向同一个起点时没优化到

还是有问题, 如果出现了覆盖, 那覆盖后都需要重算

先对终点是目标点且看有效点的大图做层级拓扑排序(全局只做一次)
对终点是目标点且不看有效点的小图做层级拓扑排序(每跑一个点一次)
看第一层的a_i, 分别计算其后继的反馈指向的大图的点, 且大图中的该点是a_i的先驱, 大图中的点的序构成的组合
取所有a_i中组合最小的, 组合相等时选大图中序靠后的点
例如a1->b3->c5, c5反馈已有效的o1, o1->....->a1, o1在大图层级拓扑排序中是3, 那么a1的组合中加入3
`a1(3,5,6)<a2(3,6,7)`,那么取a1这个点来跑

是个近似算法, 如果以接近0失败率指向最开始, 这种点不太应该优先考虑, 目前算法这种点优先级极高

findNode xx ward 函数添加上线的信息

自动排布

改runfiles机制支持反馈, 其反馈机制结合重置快照链完成

> 提供一个初始化的命令

```
      // https://code.visualstudio.com/api/extension-guides/notebook#:~:text=The%20Notebook%20API%20allows%20Visual%20Studio%20Code%20extensions,allows%20for%20similar%20experiences%20inside%20Visual%20Studio%20Code.

      // vscode.NotebookDocument

      //     private getCellFromActiveEditor(): NotebookCell | undefined {
      //     const editor = window.activeNotebookEditor;
      //     if (editor) {
      //         const range = editor.selections[0];
      //         if (range) {
      //             return editor.notebook.cellAt(range.start);
      //         }
      //     }
      // }

      // notebook.focusBottom
      // notebook.cell.insertCodeCellBelow

      // notebook.cell.edit ?

      // notebook.cell.execute
      
      
      // 奇怪bug导致每一节新的运行, 上一个会被多运行一次...
      // ['ScLYkoK4XBDSH2ra49S59bYzepmVVNUl','ScLYkoK4XBDSH2ra49S59bYzepmVVNUl','aVKSnS6zUy4OSAEtuP8kUq2dPRNZO3x4','aVKSnS6zUy4OSAEtuP8kUq2dPRNZO3x4','vo5LHYIFnRIA2hKqnzFxKpQTlJgCYc5Q']
      // delay 1000 后好了
      vscode.window.showInformationMessage('submit done: ' + JSON.stringify(ret))
      // 一次只能搞两个... 看来还是要扫文件来判定结束
      // 也是只管提交不等结束就执行这里了
      // vscode.window.showInformationMessage(vscode.window.activeTextEditor.document.getText()) // 没用只能拿到当前cell不是整个文件

    // https://stackoverflow.com/questions/72912713/programmatically-execute-cell-jupyter-vscode
    // 用类似这个方案来做, 维护一个ipython, 自己写成ipynb
    // 或者找找没有用脚本和jupyter交互的机制
    // def execute_cell(filepath,cell_number_range=[0]):
    // import io
    // from  nbformat import current
    // with io.open(filepath) as f:
    //     nb = current.read(f, 'json')
    // ip = get_ipython()
    // for cell_number in cell_number_range:
    //     cell=nb.worksheets[0].cells[cell_number]
    //     #print (cell)
    //     if cell.cell_type == 'code' : ip.run_cell(cell.input)

    // 或者换一个思路, jupyter的第一节运行一个特殊的server, 然后node和这个server交互, 这个server自己能后续操作这个jupyter本身
```

> ? removenode后send一个remove, ext移除记录, 再把record发回来. 这里主要是注册事件的机制

> ? 引入数据集: 记录多选的脚本名字的选择, 不同的数据状态

> ? 引入群组的概念

> ? antlr-flow
