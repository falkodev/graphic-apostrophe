const fs = require('fs')
const _ = require('lodash')
const pm2 = require('pm2')
const prettier = require('prettier')
const { inspect, promisify } = require('util')

const types = require('./lib/types')
const areaOptions = require('./lib/area-options')
const widgetImagesOptions = require('./lib/widget-images-options')
const minSizeOptions = require('./lib/min-size-options')
const aspectRatioOptions = require('./lib/aspect-ratio-options')
const limitOptions = require('./lib/limit-options')
const sizeOptions = require('./lib/size-options')

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'model',
  label: 'Model',
  addFields: [
    {
      name: 'field',
      label: 'Field',
      type: 'array',
      required: true,
      schema: [
        {
          name: 'name',
          label: 'Name',
          type: 'string',
          required: true,
          help: 'string - accepts spaces',
        },
        {
          name: 'required',
          label: 'Required',
          type: 'boolean',
          required: true,
        },
        types,
        areaOptions,
        widgetImagesOptions,
        minSizeOptions,
        aspectRatioOptions,
        limitOptions,
        sizeOptions,
      ],
    },
  ],
  construct(self, options) {
    self.afterSave = async (req, piece, options, callback) => {
      const { extractOptions } = require('./lib/api')
      const mkdirAsync = promisify(fs.mkdir)
      const readFileAsync = promisify(fs.readFile)
      const writeFileAsync = promisify(fs.writeFile)
      const encoding = 'utf-8'
      const configJson = './config/default.json'

      // define model to create
      const fields = piece.field.map(field => ({
        name: _.camelCase(field.name),
        label: _.startCase(field.name),
        required: field.required,
        type: field.type,
        ...extractOptions(types, field),
      }))

      const model = {
        extend: 'apostrophe-pieces',
        name: piece.slug,
        label: _.startCase(piece.title),
        addFields: fields,
      }

      let module = 'module.exports = ' + inspect(model, { depth: Infinity })

      // create folder of the new module
      try {
        await mkdirAsync(`./lib/modules/${piece.slug}`)
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw new Error(error)
        }
      }

      // write model to file
      try {
        module = prettier.format(module, {
          printWidth: 40,
          semi: false,
          singleQuote: true,
          trailingComma: 'all',
          parser: 'babylon',
        })
        await writeFileAsync(`./lib/modules/${piece.slug}/index.js`, module, encoding)
        const config = await readFileAsync(configJson, encoding)
        const customModules = JSON.parse(config)
        customModules.modules[piece.slug] = {}
        await writeFileAsync(configJson, JSON.stringify(customModules, undefined, 2), encoding)
      } catch (error) {
        throw new Error(error)
      }

      // restart to display new module in Apostrophe admin bar
      pm2.restart('app', err => {
        if (err) {
          console.error(err)
          process.exit(2)
        }
      })

      callback()
    }
  },
}
