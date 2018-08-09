const fs = require('fs')
const _ = require('lodash')
const pm2 = require('pm2')
const prettier = require('prettier')
const { promisify } = require('util')

const types = require('./lib/types')
const areaOptions = require('./lib/area-options')
const widgetImagesOptions = require('./lib/widget-images-options')

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
        {
          name: 'minSizeOption',
          label: 'minSize Option',
          type: 'object',
          required: true,
          schema: [
            {
              name: 'width',
              label: 'minSize Width',
              type: 'integer',
            },
            {
              name: 'heigth',
              label: 'minSize Height',
              type: 'integer',
            },
          ],
        },
        {
          name: 'aspectRatioOption',
          label: 'aspectRatio Option',
          type: 'object',
          required: true,
          schema: [
            {
              name: 'x',
              label: 'aspectRatio x',
              type: 'integer',
            },
            {
              name: 'y',
              label: 'aspectRatio y',
              type: 'integer',
            },
          ],
        },
        {
          name: 'limitOption',
          label: 'limit Option',
          type: 'integer',
          min: 1,
          required: true,
        },
        {
          name: 'sizeOption',
          label: 'size Option',
          type: 'select',
          required: true,
          choices: [
            {
              label: 'max - no larger than 1600x1600',
              value: 'max',
            },
            {
              label: 'full - no larger than 1140x1140',
              value: 'full',
            },
            {
              label: 'two-thirds - no larger than 760x760',
              value: 'two-thirds',
            },
            {
              label: 'one-half - no larger than 570x700',
              value: 'one-half',
            },
            {
              label: 'one-third: no larger than 380x700.',
              value: 'one-third',
            },
            {
              label: 'one-sixth: no larger than 190x350',
              value: 'one-sixth',
            },
            {
              label: 'original',
              value: 'original',
            },
          ],
        },
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
      }

      // define model to create and remove "id" property
      const fields = piece.field.map(({ id, ...field }) => {
        function extractOptions(schema, field) {
          if (field.type === 'area') {
            const options = schema.choices
              .filter(schemaField => field.type === schemaField.value && schemaField.showFields)
              .reduce(
                (options, schemaField) => {
                  schemaField.showFields.forEach(showField => {
                    schemaOptions[showField].choices.forEach(choice => {
                      options.widgets[choice.value] = {}
                    })
                  })

                  return options
                },
                { widgets: {} },
              )
            return { options }
          }
        }

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

      let module = 'module.exports = ' + require('util').inspect(model, { depth: Infinity })

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
