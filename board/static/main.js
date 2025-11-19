import { toolbarData, cardData } from './userdata.js'

import { fg } from './flowgraph.js'

globalThis.fg = fg;

fg.addToolbar(toolbarData)
fg.addContent(cardData)

// Array.from({length:100}).map(v=>{
//     let data = JSON.parse(JSON.stringify(cardData))
//     fg.addContent(data.map(v=>{
//         v._pos.left+=100*~~(20*Math.random())
//         v._pos.top+=100*~~(20*Math.random())
//         return v
//     }))
// })


