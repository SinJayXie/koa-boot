require('babel-register')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const koaApp = require('koa')
const koaRouter = require('koa-router')
const webSockify = require('koa-websocket')
const utils = require('./utils')
const serviceConfig = require('../config/server.json')
const mysql = require('./koa/mysql')
const db = new mysql()
const axios = require('axios')
const exports_ = {}
const moduleList = {
  controller: {},
  model: {},
  plugin: {}
}
const koa = {
  controller: require('./koa/controller'),
  model: require('./koa/model'),
  ROOT_PATH: path.join(__dirname, '..'),
  APP_PATH: path.join(__dirname, '../app'),
  env: process.env,
  version: '1.0.0',
  config: serviceConfig,
  moduleList,
  _
}
const serverError = false

const requestMap = new Map()

global.koa = koa
const log = require('./logs')
global._log = new log()

/**
 * 加载系统语言
 * @param lang
 * @returns {function(*=): string}
 */
function loadI18n(lang = 'en') {
  try {
    const json = require('./i18n/' + lang + '.json')
    return (pathName = '') => {
      return _.get(json, pathName, pathName)
    }
  } catch (e) {
    _log.error(`lang "${lang}" is not find.`)
    process.exit(404)
  }
}

/**
 * 设置监听路由
 * @param list
 * @param router
 * @param app
 * @param Opt
 */
function setRouter(list = [], router, app, Opt) {
  app.use(async(ctx, next) => {
    console.log(ctx.path)
    if (serverError) {
      ctx.status = 500
      ctx.body = utils.errorPage(500, serverError)
      return false
    }
    if (authRequest(ctx)) {
      await mounted(ctx, Opt)
      // if (ctx.path.indexOf('/doc.koa') === 0) {
      //     apiStore.render(ctx)
      //     return false
      // }
      if (ctx.path.indexOf('/static') === 0) {
        await staticFile(ctx)
      } else {
        await next()
      }
    }
  })
  router.all(['/', '/:controller', '/:controller/:method'], async(ctx, next) => {
    await render(ctx)
    next()
  })
}

function authRequest(ctx) {
  const key = ctx.request.ip
  if (requestMap.has(key)) {
    const keyValue = requestMap.get(key)
    const nowTime = Date.now()
    if (keyValue.ban) {
      if (keyValue.banTime - nowTime > 0) {
        ctx.status = 403
        ctx.body = $t('BASE.FREQUENT_REQUESTS') + ' at ' + (keyValue.banTime - nowTime) + 'ms'
        return false
      }
      keyValue.ban = false
      keyValue.banTime = 0
      keyValue.request = 0
      keyValue.lastTime = nowTime
    }
    keyValue.request += 1
    if (keyValue.request > 15 && nowTime - keyValue.lastTime < 5 * 1000) {
      keyValue.ban = true
      keyValue.banTime = nowTime + (10 * 1000)
      return false
    }
    if (nowTime - keyValue.lastTime > 400) {
      keyValue.request -= 1
    }
    keyValue.lastTime = nowTime
    requestMap.set(key, keyValue)
    return true
  }
  requestMap.set(key, { request: 1, lastTime: Date.now(), ban: false, banTime: 0 })
  return true
}

/**
 * 静态文件发送 /static
 * @param ctx
 * @returns {Promise<void>}
 */
async function staticFile(ctx) {
  try {
    let staticSpeed = _.get(serviceConfig, 'staticSpeed', 1024)
    if (typeof staticSpeed !== 'number') staticSpeed = 1024
    const requestFilePath = path.join(ctx.__dirname, ctx.path)
    if (fs.existsSync(requestFilePath)) {
      const stat = fs.statSync(requestFilePath)
      if (stat.isFile()) {
        const RS = fs.createReadStream(requestFilePath, { highWaterMark: (staticSpeed / 16) | 0 })
        ctx.type = utils.getMime(utils.getExtName(ctx.path))
        ctx.status = 200
        ctx.body = RS
        ctx.set('Content-Length', stat.size)
      }
    }
  } catch (e) {
    // console.log(e.message)
  }
}

/**
 * 挂载MVC基本功能
 * @param ctx
 * @param Opt
 */
function mounted(ctx, Opt) {
  _log.log(`${$t('BASE.REQUEST')} ${ctx.method} - ${ctx.path} - ${ctx.request.ip}`)
  ctx.startTime = new Date().getTime()
  ctx.utils = utils
  ctx.mysql = db
  ctx.plugins = moduleList.plugin
  ctx.axios = axios
  ctx.set('X-Power-By', 'koa boot 1.0.0')
  ctx.set('Server', 'koa')
  ctx.set('Content-Type', 'text/html; charset=utf-8')
  ctx.body = utils.errorPage()
  ctx.status = 404
  ctx.__dirname = _.get(Opt, 'runDir', path.join(__dirname, '..'))
  ctx.setStatus = (status = 200) => {
    if (typeof status !== 'number') status = 200
    ctx.status = status
  }
}

function transBuffer(buffer) {
  switch (typeof buffer) {
    case 'function':
      return buffer()
    case 'number':
      return buffer.toString()
    case 'object':
      return buffer
    case 'string':
      return buffer
    case 'undefined':
      return utils.errorPage(200, 'undefined')
    case 'boolean':
      return buffer ? 'true' : 'false'
    default:
      return buffer
  }
}

/**
 * 渲染控制器
 * @param ctx
 * @returns {Promise<void>}
 */
async function render(ctx) {
  if (!ctx.params.controller) ctx.params.controller = 'index'
  if (!ctx.params.method) ctx.params.method = 'index'
  try {
    let ctlFn = moduleList.controller[ctx.params.controller]
    const modelFn = moduleList.model[ctx.params.controller]
    if (typeof modelFn === 'function') {
      try {
        ctx.model = new modelFn(ctx)
      } catch (e) {
        ctx.model = {}
      }
    }
    if (typeof ctlFn !== 'function') throw 1
    if (ctlFn) {
      ctlFn = new ctlFn(ctx)
      const methodFn = ctlFn[ctx.params.method + 'Action']
      if (typeof methodFn === 'function') {
        ctx.status = 200
        ctx.body = ''
        ctx.body = transBuffer(await ctlFn[ctx.params.method + 'Action']())
      } else {
        if (typeof ctlFn['__call'] === 'function') {
          ctx.body = await ctlFn['__call']()
        } else {
          throw 2
        }
      }
    } else {
      ctx.body = ctx.utils.errorPage()
    }
  } catch (e) {
    let msg = ''
    switch (e) {
      case 0:
        break
      case 1:
        msg = `${$t('BASE.CONTROLLER')} ${ctx.params.controller} ${$t('BASE.NOT_FOUND')}`
        ctx.setStatus(404)
        _log.error(msg)
        ctx.body = ctx.utils.errorPage(404, msg)
        break
      case 2:
        msg = `${$t('BASE.METHOD')} ${ctx.params.method} ${$t('BASE.NOT_FOUND')}`
        ctx.setStatus(404)
        _log.error(msg)
        ctx.body = ctx.utils.errorPage(404, msg)
        break
      case 3:
        // 自定义返回
        break
      default:
        ctx.setStatus(500)
        _log.error(e.stack)
        ctx.body = ctx.utils.errorPage(500, e.stack)
    }
  }
}

/**
 * 加载所有控制器到内存
 * @param Opt
 */
function loadController(Opt) {
  const readPath = _.get(Opt, 'runDir', path.join(__dirname, '..')) + '/app/controller'
  const controllerName = fs.readdirSync(readPath)
  controllerName.forEach(name => {
    try {
      const ctlPath = path.join(readPath, name)
      const fn = require(ctlPath)
      const ctlName = utils.spliceName(name)
      if (new fn() instanceof koa.controller) {
        moduleList.controller[ctlName] = fn
        _log.log('Load controller ' + ctlPath + ' success')
      } else {
        _log.error(`Controller "${name}" is not extends "koa.controller" Load failed Path: ${ctlPath}`)
      }
    } catch (e) {
      _log.error(e.stack)
      process.exit(-1)
    }
  })
}

function loadSocket(app, router) {
  const socketPath = path.join(__dirname, '../app/socket')
  const socketName = fs.readdirSync(socketPath)
  const route = require('koa-route')
  socketName.forEach(name => {
    try {
      const socketRealPath = path.join(socketPath, name)
      const request = require(socketRealPath)
      const sName = utils.spliceName(name)
      if (typeof request === 'object') {
        _.forEach(request, (fn, key) => {
          if (typeof fn === 'function') {
            const Middleware = (ctx) => {
              ctx.ws = app.ws.server
              fn(ctx.websocket, ctx)
            }
            app.ws.use(route.all(`/${path.join(sName, key)}`, Middleware))
            _log.log(`Listening ws://127.0.0.1:${serviceConfig.port | 3000}/${path.join(sName, key)}`)
          }
        })
      }
    } catch (e) {
      _log.error(e.stack)
      process.exit(-1)
    }
  })
}

/**
 * 加载插件目录
 * @param Opt
 */
function loadPlugins(Opt) {
  const pluginsDir = path.join(Opt.runDir, 'plugins')
  const pluginsNames = fs.readdirSync(pluginsDir)
  pluginsNames.forEach(pluginsName => {
    try {
      const name = utils.spliceName(pluginsName)
      const pluginPath = path.join(pluginsDir, pluginsName)
      const fn = require(pluginPath)
      if (typeof fn === 'function') {
        moduleList.plugin[name] = fn
        _log.log(`Load plugin ${pluginPath} success`)
      }
    } catch (e) {
      _log.error(e.stack)
    }
  })
}

/**
 * 加载模型文件
 * @param Opt
 */
function loadModel(Opt) {
  const readModelPath = _.get(Opt, 'runDir', path.join(__dirname, '..')) + '/app/model'
  const modelNames = fs.readdirSync(readModelPath)
  modelNames.forEach(name => {
    try {
      const modelPath = path.join(readModelPath, name)
      const fn = require(modelPath)
      const modelName = utils.spliceName(name)
      if (new fn() instanceof koa.model) {
        moduleList.model[modelName] = fn
        _log.log('Load model ' + modelPath + ' success')
      } else {
        _log.error(`Model "${name}" is not extends "koa.model" Load failed Path: ${modelPath}`)
      }
    } catch (e) {
      _log.error(e.stack)
      process.exit(-1)
    }
  })
}

/**
 * 启动 koa boot
 * @param Opt
 */
exports_.run = (Opt = {}) => {
  if (typeof Opt !== 'object') Opt = {}
  if (!Opt.runDir) Opt.runDir = path.join(__dirname, '../')
  global.$t = loadI18n(_.get(serviceConfig, 'lang', 'en'))
  const app = webSockify(new koaApp(), { clientTracking: true })
  const router = new koaRouter()
  const bodyParser = require('koa-bodyparser')
  const koaBody = require('koa-body')
  const session = require('koa-session')
  loadController(Opt)
  loadModel(Opt)
  loadPlugins(Opt)
  loadSocket(app, router)
  app.keys = ['koa:sess']
  const sessCONFIG = {
    key: 'koa-boot',
    maxAge: 86400000,
    overwrite: true,
    httpOnly: true,
    signed: true,
    rolling: false,
    renew: false
  }
  app.use(session(sessCONFIG, app))
  setRouter(koa.router, router, app, Opt)
  app.use(router.routes()).listen(serviceConfig.port | 3000, '0.0.0.0')
  app.use(bodyParser())
  app.use(
    koaBody({
      multipart: true,
      formidable: {
        maxFileSize: _.get(serviceConfig, 'uploadMaxSize', 2) * 1024 * 1024 * 100 // 默认2M
      }
    })
  )
  if (typeof serviceConfig.ssl === 'object') {
    const enable = _.get(serviceConfig, 'ssl.enable', false)
    if (enable) {
      const https = require('https')
      const sslIfy = require('koa-sslify').default
      app.use(sslIfy)
      const sslData = {
        cert: fs.readFileSync(serviceConfig.ssl.cert),
        key: fs.readFileSync(serviceConfig.ssl.key)
      }
      https.createServer(sslData, app.callback()).listen(443, '0.0.0.0', 0, err => {
        if (err) {
          _log.error(err.stack)
        } else {
          _log.log('listening https://127.0.0.1')
        }
      })
    }
  }
  _log.log('listening http://127.0.0.1:' + (serviceConfig.port || 3000))
}

module.exports = exports_
