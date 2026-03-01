const path = require("path");
const fs = require("fs");

function getRandomString() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function loadWebviewFiles(root) {
  const getNonce = getRandomString;
  let main = fs.readFileSync(path.join(root, 'board', 'index.html'), { encoding: 'utf8' })
  main = main.replace(/<[^\n]*"\.\/inject\/[^\n]*>/g, s => {
    let m = /"\.\/inject\/(.*?\.)(.*?)"/.exec(s)
    let content = fs.readFileSync(path.join(root, 'board', 'inject', m[1] + m[2]), { encoding: 'utf8' })
    switch (m[2]) {
      case 'css':
        return '<style>\n' + content + '\n</style>'
      case 'js':
        return '<script type="module" crossorigin nonce="ToBeReplacedByRandomToken">\n' + content + '\n</script>'
      default:
        return s
    }
  })
  main = main.replace(/ToBeReplacedByRandomToken/g, getNonce())
  return main
}

function getWebviewContent(webviewContent, cdnpath) {
  return webviewContent.replace('./static', cdnpath)
}

exports.loadWebviewFiles = loadWebviewFiles;
exports.getWebviewContent = getWebviewContent;
