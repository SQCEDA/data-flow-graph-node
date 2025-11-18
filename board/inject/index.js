
const drawAPI = {
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
      drawAPI.unstable.content = content;
    },
    setSVGContent(content) {
      globalThis.loadBundleSvg(content)
    },
    setContent(content) {
      drawAPI.unstable.setTextContent(content)
      let match;
      if (content.startsWith('<svg')) {
        drawAPI.unstable.setSVGContent(content)
      }
      else if (match = /!\[.*\]\((.*\.svg)\)/.exec(content)) {
        drawAPI.unstable.readSVGFileContent(match[1])
      }
    },
    custom(content) {
      console.log(content);
      if (content.operate) {
        content.operate.forEach(drawAPI.unstable.customOperate);
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
globalThis.drawAPI = drawAPI

globalThis.addEventListener('message', event => {

  const message = event.data // The JSON data our extension sent
    || event.detail; // for debug in chrome

  switch (message.command) {
    case 'currentLine':
      drawAPI.unstable.setContent(message.content);
      break;
    case 'custom':
      drawAPI.unstable.custom(message.content);
      break;
    case 'readSVGFile':
      drawAPI.unstable.setSVGContent(message.content);
      break;
  }
});

(function () {
  if (typeof acquireVsCodeApi !== 'undefined') {
    const vscode = acquireVsCodeApi();
    drawAPI.unstable.editCurrentLine = ({ text, control, ...rest }) => {
      vscode.postMessage({
        text,
        control,
        file: !!rest.file,
        command: 'editCurrentLine',
      })
    }
    drawAPI.unstable.readSVGFileContent = (file) => {
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

