
export const connectAPI = {
  send(x) {
    console.log(x)
  },
  info(x) {
    console.log(x)
  },
  prompt(show,text,cb){
    let data=prompt(show,text)
    cb(data)
  },
  recieve:{
    currentLine:'connectAPI.setContent(message.content)',
    custom:'connectAPI.custom(message.content)',
    readSVGFile:'connectAPI.setSVGContent(message.content)',
  },
  isDebug: true,
  isVscodeWebview: false,
  isDFGSIframe: false,
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
    connectAPI.content = content;
  },
  setSVGContent(content) {
    globalThis.loadBundleSvg(content)
  },
  setContent(content) {
    connectAPI.setTextContent(content)
    let match;
    if (content.startsWith('<svg')) {
      connectAPI.setSVGContent(content)
    }
    else if (match = /!\[.*\]\((.*\.svg)\)/.exec(content)) {
      connectAPI.readSVGFileContent(match[1])
    }
  },
  custom(content) {
    console.log(content);
    if (content.operate) {
      content.operate.forEach(connectAPI.customOperate);
    }
  },
  customOperate(operate) {
    console.log(operate);
    if (operate.type === 'script') {
      let func = new Function(operate.function)
      func()
    }
  },
  showFile(filename) {
    connectAPI.send({
      filename,
      command: 'showFile',
    })
  },
  showText(text) {
    connectAPI.send({
      text,
      command: 'showText',
    })
  },

}
globalThis.connectAPI = connectAPI

globalThis.addEventListener('message', event => {

  const message = event.data // The JSON data our extension sent
    || event.detail; // for debug in chrome

  if(message.command in connectAPI.recieve){
    let func = new Function('connectAPI', 'message', connectAPI.recieve[message.command])
    func(connectAPI, message)
  }
  
  // switch (message.command) {
  //   case 'currentLine':
  //     connectAPI.setContent(message.content);
  //     break;
  //   case 'custom':
  //     connectAPI.custom(message.content);
  //     break;
  //   case 'readSVGFile':
  //     connectAPI.setSVGContent(message.content);
  //     break;
  // }
});

(function () {
  if (typeof acquireVsCodeApi !== 'undefined') {
    const vscode = acquireVsCodeApi();
    connectAPI.send = (x) => {
      vscode.postMessage(x)
    }
    connectAPI.info = (text) => {
      vscode.postMessage({
        text,
        command: 'showInfo',
      })
    }
    connectAPI.prompt = (show,text,cb)=>{
      connectAPI._prompt_cb=cb
      vscode.postMessage({
        show,text,
        command: 'prompt',
      })
    }
    connectAPI.recieve.prompt='connectAPI._prompt_cb(message.content);'
    // vscode.postMessage({ command: 'requestCustom' })
    connectAPI.isDebug=false
    connectAPI.isVscodeWebview=true
  } else if (window.location.search.includes('fromdfgsiframe')) {
    console.log('Running in DFGS iframe');
    // 从iframe向父网页发送消息
    connectAPI.send = (x) => {
      window.parent.postMessage(x, '*');
    }
    connectAPI.info = (text) => {
      window.parent.postMessage({
        text,
        command: 'showInfo',
      }, '*');
    }
    connectAPI.prompt = (show,text,cb)=>{
      connectAPI._prompt_cb=cb
      window.parent.postMessage({
        show,text,
        command: 'prompt',
      }, '*');
    }
    connectAPI.recieve.prompt='connectAPI._prompt_cb(message.content);'
    connectAPI.isDebug=false
    connectAPI.isDFGSIframe=true
  } else {
    // local test
  }
}());

