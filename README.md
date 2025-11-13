# data-flow-graph-node

用于数据处理和流程管理, 以vscode插件的形式提供, 以便于兼顾文本编辑以及通过web操作的流程图界面

## 界面

预设是左边是vscode的正常文本, 右边是webview的流程图, 流程图包含编辑和运行两个模式. 以当前目录作为工作路径

## 文件

+ 流程图 flowgraph.json 节点图形式的流程图
+ 配置 flowgraph.config.json 图上的运行配置
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

