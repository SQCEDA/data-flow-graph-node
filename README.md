# data-flow-graph-node

数据流图节点工具

用于数据处理和流程管理, 以vscode插件的形式提供, 以便于兼顾文本编辑以及通过web操作的流程图界面

## 使用

F1调出命令面板敲`init`找到`Flow Graph - initProject`初始化一个工程

## 界面

预设是左边是vscode的正常文本, 右边是webview的流程图, 流程图包含编辑和运行两个模式. 以工程文件所在目录作为工作路径

## 文件

`.flowgraph.json`工程文件的后缀是必要的, 用于插件判定加载, 其他命名随意

+ 工程文件 xxx.flowgraph.json `{"config": "flowgraph.config.json","nodes": "a.nodes.json","record": "a.record.json"}`
+ 配置 flowgraph.config.json 图上的运行配置
+ 流程图 xxx.nodes.json 节点图形式的流程图
+ 数据流向记录 xxx.record.json 数据记录

## 节点

+ 标题
+ 描述
+ 文件/反馈
+ 运行方式  
  **jupyter**/命令行/node/webjs/post
+ 依赖数据
+ 派生数据
+ 指向
+ 位置和大小 

## release

把快照缓存报告等从release服务器发布或拉取

需在设置中配置 release-server-url 和 release-server-author  
在工程文件 xxx.flowgraph.json 配置 giturl project owner projectname  

