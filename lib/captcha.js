const captchaPng = require('captchapng')

const captcha = function() {
  const codeStr = (Math.random() * 9000 + 1000) | 0
  const p = captchaPng(100, 40, codeStr)
  p.color(0, 0, 0, 0)
  p.color(80, 80, 80, 255)
  const img = p.getBase64()
  const imgBuffer = new Buffer.from(img, 'base64')
  return {
    codeStr,
    imgBuffer,
    imgBases64: img
  }
}

module.exports = captcha
