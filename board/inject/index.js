
const connectAPI = {
  unstable: {
    content: "",
    nonce: () => 'ToBeReplacedByRandomToken',
    /**
     * 
     * @param {String} text text
     * @param {Number} control moving number of the cursor
     */
    editCurrentLine({ text, control, ...rest }) {
      console.log({
        text,
        control,
        file: !!rest.file,
        command: 'editCurrentLine',
      });
    },
    readSVGFileContent(file) {
      console.log({
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
    connectAPI.unstable.editCurrentLine = ({ text, control, ...rest }) => {
      vscode.postMessage({
        text,
        control,
        file: !!rest.file,
        command: 'editCurrentLine',
      })
    }
    connectAPI.unstable.readSVGFileContent = (file) => {
      vscode.postMessage({
        file,
        command: 'readSVGFile',
      })
    }
    vscode.postMessage({ command: 'requestCurrentLine' })
    vscode.postMessage({ command: 'requestCustom' })
    globalThis.editor_mounted = () => {
      vscode.postMessage({ command: 'requestCurrentLine' })
    }
  }
}());

