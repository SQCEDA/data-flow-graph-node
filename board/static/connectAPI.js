
export const connectAPI = {
  send(x){
    console.log(x)
  },
  unstable: {
    content: "",
    nonce: () => globalThis.vscodeNonce(),
    /**
     * 
     * @param {String} text text
     * @param {Number} control moving number of the cursor
     */
    editCurrentLine({ text, control, ...rest }) {
      connectAPI.send({
        text,
        control,
        file: !!rest.file,
        command: 'editCurrentLine',
      });
    },
    readSVGFileContent(file) {
      connectAPI.send({
        file,
        command: 'readSVGFile',
      })
    },
    setTextContent(content) {
      console.log(content);
      connectAPI.unstable.content = content;
    },
    setSVGContent(content) {
      globalThis.loadBundleSvg(content)
    },
    setContent(content) {
      connectAPI.unstable.setTextContent(content)
      let match;
      if (content.startsWith('<svg')) {
        connectAPI.unstable.setSVGContent(content)
      }
      else if (match = /!\[.*\]\((.*\.svg)\)/.exec(content)) {
        connectAPI.unstable.readSVGFileContent(match[1])
      }
    },
    custom(content) {
      console.log(content);
      if (content.operate) {
        content.operate.forEach(connectAPI.unstable.customOperate);
      }
    },
    customOperate(operate) {
      console.log(operate);
      if (operate.type === 'script') {
        let func = new Function(operate.function)
        func()
      }
    },
    showFile(filename){
      console.log('showFile(filename)',filename)
    },
    showResult(index,node){
      console.log('showResult(index,node)',index,node)
    },
  },
}
globalThis.connectAPI = connectAPI

globalThis.addEventListener('message', event => {

  const message = event.data // The JSON data our extension sent
    || event.detail; // for debug in chrome

  switch (message.command) {
    case 'currentLine':
      connectAPI.unstable.setContent(message.content);
      break;
    case 'custom':
      connectAPI.unstable.custom(message.content);
      break;
    case 'readSVGFile':
      connectAPI.unstable.setSVGContent(message.content);
      break;
  }
});

(function () {
  if (typeof acquireVsCodeApi !== 'undefined') {
    const vscode = acquireVsCodeApi();
    connectAPI.send = (x) => {
      vscode.postMessage(x)
    }
    vscode.postMessage({ command: 'requestCustom' })
    vscode.postMessage({ command: 'requestCurrentLine' })
    globalThis.editor_mounted = () => {
      vscode.postMessage({ command: 'requestCurrentLine' })
    }
  }
}());

