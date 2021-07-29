module.exports = {
  'demo': (io) => {
    io.send('hello')
    io.on('message', (data) => {
      io.send('callback(' + data + ')')
    })
    io.on('close', () => {
      console.log('close')
    })
  }
}
