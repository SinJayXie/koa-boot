
module.exports = class extends koa.controller {
  constructor(ctx) {
    super(ctx)
    this.captcha = require('../../lib/captcha')
  }

  async indexAction() {
    this.setMethod('GET')
    const data = this.model.UserInfo()
    return this.success(data)
  }

  captchaAction() {
    const captchaData = this.captcha()
    this.setSession('captcha', captchaData.codeStr)
    this.setHeader('Content-Type', 'image/png')
    return captchaData.imgBuffer
  }

  getCaptchaAction() {
    return this.getAllSession('captcha')
  }
}
