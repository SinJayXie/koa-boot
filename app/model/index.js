module.exports = class extends koa.model {
  constructor(ctx) {
    super(ctx)
  }
  async index(limit = 10) {
    return await this.query('select * from c_auth_user limit 0,' + limit)
  }

  UserInfo() {
    return {}
  }
}
