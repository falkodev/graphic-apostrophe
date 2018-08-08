const pm2 = require('pm2')

pm2.connect(err => {
  if (err) {
    console.error(err)
    process.exit(2)
  }
  
  pm2.start({
    script: 'app.js',
    // name: 'application',
    // exec_mode : 'cluster',
    // instances: 1,
    // watch: ['app', 'lib/modules/']
  }, (err, apps) => {
    pm2.disconnect()
    if (err) throw err
  })
})