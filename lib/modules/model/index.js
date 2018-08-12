const fs = require('fs')
const _ = require('lodash')
const pm2 = require('pm2')
const prettier = require('prettier')
const { inspect, promisify } = require('util')

const types = require('./lib/types')
const areaOptions = require('./lib/area-options')
const sizeOptions = require('./lib/size-options')
const limitOptions = require('./lib/limit-options')
const minIntegerOptions = require('./lib/min-integer-options')
const maxIntegerOptions = require('./lib/max-integer-options')
const stringOptions = require('./lib/string-options')
const minSizeOptions = require('./lib/min-size-options')
const textareaOptions = require('./lib/textarea-options')
const aspectRatioOptions = require('./lib/aspect-ratio-options')
const widgetImagesOptions = require('./lib/widget-images-options')

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'model',
  label: 'Model',
  beforeConstruct: async (self, options) => {
    self.encoding = 'utf-8'
    self.defaultPath = './lib/modules'
    self.configJson = './config/default.json'
    self.mkdirAsync = promisify(fs.mkdir)
    self.readDirAsync = promisify(fs.readdir)
    self.readFileAsync = promisify(fs.readFile)
    self.writeFileAsync = promisify(fs.writeFile)

    // get custom widgets and them to areaOptions
    try {
      const folders = await self.readDirAsync(self.defaultPath)
      const widgetNames = folders.filter(folder => folder.endsWith('-widgets'))
      for (const widgetName of widgetNames) {
        const file = await self.readFileAsync(`${self.defaultPath}/${widgetName}/index.js`, self.encoding)
        const label = file.match(/[\n\r].*label:\s*([^\n\r\,]*)/m)[1]
        areaOptions.choices.push({
          label: _.trim(label, "'"),
          value: widgetName,
        })
      }
    } catch (error) {
      throw new Error(error)
    }

    self.schemaOptions = {
      areaOptions,
      sizeOptions,
      limitOptions,
      stringOptions,
      minSizeOptions,
      textareaOptions,
      minIntegerOptions,
      maxIntegerOptions,
      aspectRatioOptions,
      widgetImagesOptions,
    }

    options.addFields = [
      {
        name: 'field',
        label: 'Fields',
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
          self.schemaOptions.areaOptions,
          self.schemaOptions.sizeOptions,
          self.schemaOptions.limitOptions,
          self.schemaOptions.stringOptions,
          self.schemaOptions.minSizeOptions,
          self.schemaOptions.textareaOptions,
          self.schemaOptions.minIntegerOptions,
          self.schemaOptions.maxIntegerOptions,
          self.schemaOptions.aspectRatioOptions,
          self.schemaOptions.widgetImagesOptions,
        ],
      },
    ].concat(options.addFields || [])

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: ['title', 'slug', 'published', 'field', 'tags'],
      },
    ].concat(options.arrangeFields || [])
  },
  construct: (self, options) => {
    require('./lib/api')(self, options)

    self.afterSave = async (req, piece, options, callback) => {
      // define model to create
      const fields = piece.field.map(field => {
        const extractedOptions = self.extractOptions(types, field)
        let options = {}

        if (typeof extractedOptions === 'object') {
          if (Object.keys(extractedOptions)[0] === 'options') {
            // sub-object "options" is for areas
            options = extractedOptions
          } else {
            // otherwise output extractedOptions content
            options = Object.values(extractedOptions)[0]
          }
        }

        return {
          name: _.camelCase(field.name),
          label: _.startCase(field.name),
          required: field.required,
          type: field.type,
          ...options,
        }
      })

      const model = {
        extend: 'apostrophe-pieces',
        name: piece.slug,
        label: _.startCase(piece.title),
        addFields: fields,
      }

      let module = 'module.exports = ' + inspect(model, { depth: Infinity })

      // create folder of the new module
      try {
        await self.mkdirAsync(`${self.defaultPath}/${piece.slug}`)
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
        await self.writeFileAsync(`${self.defaultPath}/${piece.slug}/index.js`, module, self.encoding)
        const config = await self.readFileAsync(self.configJson, self.encoding)
        const customModules = JSON.parse(config)
        customModules.modules[piece.slug] = {}
        await self.writeFileAsync(self.configJson, JSON.stringify(customModules, undefined, 2), self.encoding)
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
