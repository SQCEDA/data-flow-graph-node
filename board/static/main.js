
import { fg } from './flowgraph.js'

if (fg.connectAPI.isDebug) {
    Promise.all([
        import('./debugData.js'),
        // import('./testdata.js'),
        import('./blockPrototype.js'),
        import('./toolbarData.js'),
        import('./Runtype.js'),
    ]).then(m => {
        const cardData = m[0].cardData
        const exports = globalThis.exports
        const config = {
            toolbarData: exports.toolbarData,
            blockPrototype: exports.blockPrototype,
            Runtype: exports.Runtype,
        }
        fg.setConfig(config)
        fg.addContent(cardData)
    })
} else {
    fg.setupConnect()
}



// Array.from({length:100}).map(v=>{
//     let data = JSON.parse(JSON.stringify(cardData))
//     fg.addContent(data.map(v=>{
//         v._pos.left+=100*~~(20*Math.random())
//         v._pos.top+=100*~~(20*Math.random())
//         return v
//     }))
// })


