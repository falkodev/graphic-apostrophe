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

      // field {
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
        // console.log('schema', require('util').inspect(schema, { colors: true, depth: 1 }))
        // console.log('field', require('util').inspect(field, { colors: true, depth: 1 }))
        if (field.type === 'area') {
          if (schema.choices) {
            const options = schema.choices.reduce(
              (acc, schemaField) => {
                if (schemaField.showFields) {
                  schemaField.showFields.forEach(showField => {
                    const modifiedField = Object.assign({}, field, {
                      type: schemaOptions[showField].type,
                    })
                    const subOptions = extractOptions(schemaOptions[showField], modifiedField)
                    acc.widgets = subOptions
                  })
                }

                return acc
              },
              { widgets: {} },
            )
            return { options }
          }
        } else {
          if (schema.choices || schema.schema) {
            // select, checkboxes, object, array, ...
            const iterator = schema.choices || schema.schema
            const options = iterator.reduce((acc, schemaField) => {
              if (schemaField.showFields) {
                schemaField.showFields.forEach(showField => {
                  const subOptions = extractOptions(schemaOptions[showField], field)
                  acc[schemaField.value] = subOptions
                })
              } else {
                if (schemaField.value) {
                  // select, checkboxes, array
                  if (typeof field[schema.name] === 'object') {
                    acc[schemaField.value] = {} // if value in mapped field is iterable
                  } else {
                    acc = field[schema.name] // if not, just print it
                  }
                } else {
                  // object
                  acc[schemaField.name] = field[schema.name][schemaField.name]
                }
              }

              return acc
            }, {})
            return options
          } else {
            // string, integer, ...
            return field[schema.name]
          }
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
