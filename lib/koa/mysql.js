
const mysql = require('mysql')
const config = require('../../config/database.json')

module.exports = class {
  constructor() {
    this.mysql = this.createConnect()
  }
  createConnect(opt = config) {
    return mysql.createPool(opt)
  }
  query(sql = '') {
    return new Promise((resolve, reject) => {
      this.mysql.query(sql, function(err, result) {
        _log.log('SQL Query: ' + sql)
        if (err) reject(err)
        resolve(result)
      })
    })
  }
}
