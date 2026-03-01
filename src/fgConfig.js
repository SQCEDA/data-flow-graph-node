const { toolbarData } = require('../board/static/toolbarData.js');
const { blockPrototype } = require('../board/static/blockPrototype.js');
const { Runtype } = require('../board/static/Runtype.js');
const { keymap } = require('../board/static/keymap.js');
const { BaseConfig } = require('../board/static/BaseConfig.js');

const defaultConfig = Object.assign({}, BaseConfig, {
  toolbarData: toolbarData,
  blockPrototype: blockPrototype,
  Runtype: Runtype,
  keymap: keymap,
})

const templateConfig = Object.assign({}, BaseConfig, {
  Runtype: Runtype,
})

exports.defaultConfig = defaultConfig;
exports.templateConfig = templateConfig;
