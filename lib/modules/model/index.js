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
      const mkdirAsync = promisify(fs.mkdir)
      const readFileAsync = promisify(fs.readFile)
      const writeFileAsync = promisify(fs.writeFile)
      const encoding = 'utf-8'
      const configJson = './config/default.json'

      const schemaOptions = {
        areaOptions,
        widgetImagesOptions,
        minSizeOptions,
        aspectRatioOptions,
        limitOptions,
        sizeOptions,
      }

      // example of a mapped field
      // {
      //   id: 'w422776936176081711',
      //   name: 'picture',
      //   required: false,
      //   type: 'area',
      //   areaOptions: [ 'apostrophe-rich-text', 'apostrophe-images' ],
      //   widgetImagesOptions: [ 'limit', 'size' ],
      //   minSizeOptions: { width: null, heigth: null },
      //   aspectRatioOptions: { x: null, y: null },
      //   limitOptions: 1,
      //   sizeOptions: 'full'
      // }

      /**
       * Retrieve schema definition of a field from a saved piece
       * @param {Object} schema - field types definition
       * @param {Object} field - mapped field received from the saved piece
       */
      function extractOptions(schema, field) {
        const iterator = schema.choices || schema.schema
        if (iterator) {
          // select, checkboxes, object, array, area, ...
          return iterator.reduce((acc, schemaField) => {
            if (schemaField.showFields) {
              schemaField.showFields.forEach(showField => {
                const modifiedField = Object.assign({}, field, { type: schemaOptions[showField].type })
                const extractedOptions = extractOptions(schemaOptions[showField], modifiedField)
                if (field.type === 'area') {
                  acc = {
                    options: {
                      widgets: extractedOptions,
                    },
                  }
                } else {
                  acc[schemaField.value] = extractedOptions
                }
              })
            } else {
              if (schemaField.value) {
                // select, checkboxes, array
                if (typeof field[schema.name] === 'object') {
                  // if value in the mapped field is iterable
                  acc[schemaField.value] = {}
                } else if (field[schema.name] === schemaField.value) {
                  // if a schema field matches a property in the mapped field, just print it
                  acc = field[schema.name]
                }
              } else {
                // object
                acc[schemaField.name] = field[schema.name][schemaField.name]
              }
            }

            return acc
          }, {})
        } else {
          // string, integer, ...
          return field[schema.name]
        }
      }

      // define model to create
      const fields = piece.field.map(field => {
        const newField = {
          name: _.camelCase(field.name),
          label: _.startCase(field.name),
          required: field.required,
          type: field.type,
          ...extractOptions(types, field),
        }

        return newField
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
        await mkdirAsync(`./lib/modules/${piece.slug}`)
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw new Error(error)
        }
      }

      // write model to file
      try {
        module = prettier.format(module, {
          printWidth: 60,
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
