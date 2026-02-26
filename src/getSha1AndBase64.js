'use strict';
Object.defineProperty(exports, "__esModule", { value: true });

const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * 异步读取二进制文件，计算SHA1和Base64
 * @param {string} filePath - 文件路径
 * @returns {Promise<[string, string]>} [sha1, base64Content]
 */
async function getSha1AndBase64(filePath) {
  // 1. 异步读取文件为Buffer
  const buffer = await fs.readFile(filePath);
  
  // 2. 计算SHA1哈希（不加Git头部，直接对原始内容计算）
  const sha1 = crypto.createHash('sha1')
    .update(buffer)  // 直接使用原始文件内容
    .digest('hex');  // 转换为十六进制字符串
  
  // 3. 转换为Base64字符串
  const b64content = buffer.toString('base64');
  
  // 4. 返回数组 [sha1, base64Content]
  return [sha1, b64content];
}
exports.getSha1AndBase64 = getSha1AndBase64;