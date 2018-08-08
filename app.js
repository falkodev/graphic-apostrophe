const path = require('path')
const config = require('config')

const apos = require('apostrophe')({
  shortName: 'graphic-apostrophe',

  modules: {
    // Apostrophe module configuration
    // If a template is not found somewhere else, serve it from the top-level
    // `views/` folder of the project
    'apostrophe-templates': { viewsFolderFallback: path.join(__dirname, 'views') },
    'apostrophe-pages': { restApi: true },

    // Other modules
    ...config.get('modules'),
  },
})

module.exports = apos
