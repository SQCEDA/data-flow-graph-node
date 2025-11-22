# data-flow-graph-node

用于数据处理和流程管理, 以vscode插件的形式提供, 以便于兼顾文本编辑以及通过web操作的流程图界面

## 界面

预设是左边是vscode的正常文本, 右边是webview的流程图, 流程图包含编辑和运行两个模式. 以当前目录作为工作路径

## 文件

+ 流程图 xxx.flowgraph.json 节点图形式的流程图
+ 配置 xxx.flowgraph.config.json 图上的运行配置
+ 数据流向记录 xxx.record.json 一组运行下的数据派生的记录

## 节点

+ 标题
+ 描述
+ 文件/文本  
  包含两个特殊选项(编辑器的当前文件/当前框选文本)
+ 运行方式  
  命令行/node/webjs/post
+ 依赖数据
+ 派生数据
+ 指向
+ 位置和大小 

## 一些实现记录

_pos记录位置

内部计算使用邻接表
存读时放_linkto.next使用相对index偏移

插件内部需要维护一个state 存运行结果/状态 以及界面状态等等

运行流程:
打开文件xxx.flowgraph.json, 右键菜单或者f1执行命令
插件加载xxx.flowgraph.json, 其中包含xxx.flowgraph.config.json的路径, 也打开加载
flowgraph->carddata
flowgraph.config->config
拉起webview/webview重载
webview:requestConfig 拿到config
webview:requestNodes 拿到carddata
webview:requestState 此时暂时时空白/加载运行数据

用retainContextWhenHidden: true来避免离屏幕销毁了, 多占点内存省事

> 编辑先做到这个程度, 做运行有关的东西

> 引入数据集: 记录多选的脚本名字的选择, 不同的数据状态

> ? 引入群组的概念

> ? antlr-flow
