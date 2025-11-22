import { config } from './debugData.js'
import { cardData } from './debugData.js'
// import { cardData } from "./testdata.js";

import { fg } from './flowgraph.js'

if (connectAPI.isDebug) {
    fg.setConfig(config)
    fg.addContent(cardData)
    document.querySelector(".content-container").scrollLeft = 200
}

fg.requestConfig()
fg.requestNodes()




// Array.from({length:100}).map(v=>{
//     let data = JSON.parse(JSON.stringify(cardData))
//     fg.addContent(data.map(v=>{
//         v._pos.left+=100*~~(20*Math.random())
//         v._pos.top+=100*~~(20*Math.random())
//         return v
//     }))
// })


