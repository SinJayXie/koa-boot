
module.exports = class {
  /**
   * 初始化
   * @param ctx
   * @returns {boolean}
   */
  constructor(ctx) {
    if (!ctx) return false
    this.ctx = ctx
    this.fs = require('fs')
    this.path = require('path')
    this._ = require('lodash')
    this.moment = require('moment')
    this.params = {}
    this.model = ctx.model
    this.runDir = ctx.__dirname
    this.axios = ctx.axios
  }

  /**
   * 从名字加载插件
   * @param name
   * @returns {*}
   */
  loadPlugin(name = '') {
    if (name) {
      const fn = this.ctx.plugins[name]
      if (typeof fn === 'function') {
        this['_' + name] = new fn(this.ctx)
        return this[name]
      }
      this.ctx.body = this.ctx.utils.errorPage(500, `"${name}.js" ${$t('BASE.PLUGIN_INJECT')}`)
      throw 0
    }
  }

  /**
     * 渲染模版
     * @param params
     * @returns {string|*|Buffer}
     */
  render(params = {}) {
    try {
      this.ctx.set('Content-Type', 'text/html; charset=utf-8')
      const viewFile = this.path.join(
        this.ctx.__dirname,
        'app/view',
        this.ctx.params.controller,
        this.ctx.params.method + '.html'
      )
      if (this.fs.existsSync(viewFile)) {
        _log.log('Load file ' + viewFile)
        let buffer = this.fs.readFileSync(viewFile).toString()

        this._.forEach(params, async(val, key) => {
          buffer = buffer.replace(new RegExp(`{[\\s]*${key}[\\s]*}`, 'gm'), val)
        })
        return buffer
      } else {
        this.ctx.setStatus(500)
        return this.ctx.utils.errorPage(
          500,
          `<pre style="font-size: 14px">${viewFile}\n ${$t('BASE.TEMPLATE_NOT_FOUND')}</pre>`
        )
      }
    } catch (e) {
      throw e
    }
  }

  /**
   * 设置请求类型 GET POST PUT DELETE 等
   * @param method
   */
  setMethod(method = 'GET') {
    if (typeof method !== 'string') method = 'GET'
    method = method.toUpperCase()
    if (method !== this.ctx.method) {
      this.ctx.body = this.failed(`${$t('BASE.NOT_ARROW_REQUEST_METHOD')} '${this.ctx.method}'`)
      throw 0
    }
  }

  /**
   * 设置请求参数 ['a','b','c']
   * @param params
   * @param checkSql
   */
  setParams(params = [], checkSql = false) {
    let checkParams = {}
    if (typeof params !== 'object') params = []
    switch (this.ctx.method) {
      case 'GET':
        checkParams = this.ctx.request.query
        break
      case 'POST':
        checkParams = this.ctx.request.body
        break
      default:
        checkParams = this.ctx.request.query
        break
    }
    params.forEach(item => {
      if (!checkParams[item]) {
        this.ctx.setStatus(403)
        this.ctx.body = this.failed(`'${item}' ${$t('BASE.PARAM_IS_NULL')}`)
        throw 0
      }
      if (checkSql) {
        const reg = new RegExp("[%--`~!@#$^&*()=|{}':;',\\[\\].<>/?~！@#￥……&*（）――|{}【】‘；：”“'。，、？]")
        if (reg.test(checkParams[item])) {
          this.ctx.setStatus(403)
          this.ctx.body = this.ctx.utils.errorPage(500, `${checkParams[item]} ${$t('BASE.SQL_INJECT')}`)
          throw 0
        }
      }
      this.params[item] = checkParams[item]
    })
  }

  /**
   * 返回成功JSON
   * @param data
   * @returns Object
   */
  success(data) {
    this.ctx.set('Content-Type', 'application/json; charset=utf-8')
    this.ctx.params['Server-Power-Time'] = Date.now() - this.ctx.startTime + 'ms'
    return {
      code: 200,
      data,
      msg: 'ok',
      isSuccess: true,
      isError: false,
      timestamp: Date.now(),
      module: this.ctx.params
    }
  }

  /**
   * 返回失败JSON
   * @param msg
   * @param code
   * @returns Object
   */
  fail(msg, code = -1) {
    this.ctx.set('Content-Type', 'application/json; charset=utf-8')
    this.ctx.params['Server-Power-Time'] = Date.now() - this.ctx.startTime + 'ms'
    return {
      code,
      msg,
      isSuccess: false,
      isError: true,
      timestamp: Date.now(),
      module: this.ctx.params
    }
  }

  /**
   * 获取上存文件列表
   * @returns {formidable.Files | FileList}
   */
  getUploadFile() {
    return this.ctx.request.files
  }

  /**
   * Http请求
   * @param Opt
   * @returns {*}
   */
  httpRequest(Opt = {}) {
    return this.ctx.axios(Opt)
  }

  /**
   * 获取Session
   * @returns {*}
   */
  getAllSession(name) {
    return this.ctx.session[name]
  }

  /**
   * 获取全部Session
   * @return {*}
   */
  getSession() {
    return this.ctx.session
  }

  setSession(name, value) {
    this.ctx.session[name] = value
  }

  setCookie(name, value, time = 60) {
    this.ctx.cookies.set(name, value, {
      maxAge: time * 1000,
      expires: 7,
      httpOnly: false,
      overwrite: false,
      signed: false
    })
  }

  delCookie(name) {
    this.ctx.cookies.set(name, '', { signed: false, maxAge: 0 })
  }

  getCookie(name) {
    const res = this.ctx.cookies.get(name)
    if (res === undefined) return false
    return res
  }

  setHeader(type, value) {
    this.ctx.set(type, value)
  }

  sendFile(path) {
    // this.setHeader('content-type', this.ctx.utils.getMime(this.ctx.utils.getExtName(this.params.path)))
    // this.setHeader('Content-Disposition', 'attachment;filename=' + encodeURIComponent(this.ctx.utils.getFileNamePath(this.params.path)))

    if (this.fs.existsSync(path)) {
      const stat = this.fs.statSync(path)
      if (stat.isFile()) {
        this.ctx.body = this.fs.createReadStream(path, { highWaterMark: 20 })
        this.setHeader('Content-Length', stat.size)
        throw 3
      }
      this.ctx.body = this.failed('这是个目录', 403)
    } else {
      this.ctx.body = this.failed('找不到文件', 404)
    }
    throw 3
  }

  returns(data) {
    this.ctx.body = data
    throw 3
  }
}
