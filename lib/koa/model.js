
module.exports = class {
  constructor(ctx) {
    if (!ctx) return this
    this.ctx = ctx
    this.fs = require('fs')
    this.path = require('path')
    this._ = require('lodash')
    this.moment = require('moment')
    this.model = ctx.model
    this.mysql = ctx.mysql
    this.linkSql = ''
    this.table = 'c_auth_user'
  }
  async query(sql = '') {
    try {
      return await this.mysql.query(sql)
    } catch (e) {
      throw e
    }
  }
  async eq(column = '', value = '') {
    if (typeof value === 'string') value = `'${value}'`
    this.linkSql = `SELECT * FROM ${this.table} WHERE ${column} = value`
  }
}
