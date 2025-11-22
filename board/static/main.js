import { config } from './userdata.js'
import { cardData } from './userdata.js'
// import { cardData } from "./testdata.js";

import { fg } from './flowgraph.js'

fg.setConfig(config)
fg.addContent(cardData)

fg.requestState()

document.querySelector(".content-container").scrollLeft = 200


// Array.from({length:100}).map(v=>{
//     let data = JSON.parse(JSON.stringify(cardData))
//     fg.addContent(data.map(v=>{
//         v._pos.left+=100*~~(20*Math.random())
//         v._pos.top+=100*~~(20*Math.random())
//         return v
//     }))
// })


