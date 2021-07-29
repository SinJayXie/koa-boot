const chalk = require('chalk')
const error = chalk.red.bold.bgRed
const success = chalk.bgGreen.bold.green

module.exports = class {
  constructor() {
    this.chalk = chalk
    this.moment = require('moment')
  }

  log(msg) {
    console.log(success(`[${this.moment().format('HH:mm:ss.SSS')}]`) + ' ' + msg)
  }

  error(msg) {
    console.log(error(`[Error]`) + ' ' + msg)
  }
}
