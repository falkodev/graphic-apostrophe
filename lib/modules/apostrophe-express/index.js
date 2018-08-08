module.exports = {
  session: {
    // If this still says `undefined`, set a real secret!
    secret: '951b0a7e33a10a17',
  },
  port: 3000 + (parseInt(process.env.pm_id) || 0),
}
