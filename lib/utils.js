
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const mimeJson = require('../config/mine.json')
let template = ''

/**
 * 获取名字 不要后缀
 * @param name
 * @returns {string}
 */
const spliceName = function(name = '') {
  const nameSplit = name.split('.')
  return nameSplit[0]
}

/**
 * 生成错误页
 * @param status
 * @param msg
 * @returns {string|*}
 */
const errorPage = function(status = 404, msg = '404 Not Found') {
  let viewBuffer = ''
  try {
    if (template) {
      viewBuffer = template.replace(new RegExp(`#code#`, 'g'), status.toString())
      viewBuffer = viewBuffer.replace(new RegExp(`#msg#`, 'g'), msg.toString())
      return viewBuffer
    } else {
      const viewPath = path.join(__dirname, './error/template.html')
      _log.log('Load file ' + viewPath)
      if (fs.existsSync(viewPath)) {
        viewBuffer = fs.readFileSync(viewPath).toString('utf-8')
        template = viewBuffer
        viewBuffer = viewBuffer.replace(new RegExp(`#code#`, 'g'), status.toString())
        viewBuffer = viewBuffer.replace(new RegExp(`#msg#`, 'g'), msg.toString())
        return viewBuffer
      } else {
        return msg
      }
    }
  } catch (e) {
    return e.stack
  }
}

/**
 * 获取文件类型
 * @param ext
 * @returns {string|any}
 */
const getMime = function(ext = 'txt') {
  if (typeof ext !== 'string') return 'application/stream'
  return _.get(mimeJson, ext, 'application/stream')
}

/**
 * 获取后缀名
 * @param name
 * @returns {string}
 */
const getExtName = function(name = '') {
  if (typeof name !== 'string') return ''
  const tmp = name.split('.')
  if (tmp.length === 1) return tmp[0]
  return tmp[tmp.length - 1]
}

const getFileNamePath = function(path = '/') {
  const tmp = path.replace('\\', '/').split('/')
  return tmp[tmp.length - 1]
}

module.exports = { spliceName, errorPage, getMime, getExtName, getFileNamePath }
