const fs = require('fs')
const _ = require('lodash')
const pm2 = require('pm2')
const prettier = require('prettier')
const { promisify } = require('util')

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'model',
  label: 'Model',
  addFields: [{
    name: 'field',
    type: 'array',
    required: true,
    schema: [{
      name: 'name',
      label: 'Name',
      type: 'string',
      required: true
    }, {
      name: 'required',
      label: 'Required',
      type: 'boolean',
      required: true
    }, {
      name: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      choices: [{
        label: 'string',
        value: 'string'
      }, {
        label: 'area',
        value: 'area'
      }, {
        label: 'singleton',
        value: 'singleton'
      }, {
        label: 'slug',
        value: 'slug'
      }, {
        label: 'tags',
        value: 'tags'
      }, {
        label: 'boolean',
        value: 'boolean'
      }, {
        label: 'checkboxes',
        value: 'checkboxes'
      }, {
        label: 'select',
        value: 'select'
      }, {
        label: 'integer',
        value: 'integer'
      }, {
        label: 'float',
        value: 'float'
      }, {
        label: 'url',
        value: 'url'
      }, {
        label: 'date',
        value: 'date'
      }, {
        label: 'time',
        value: 'time'
      }, {
        label: 'password',
        value: 'password'
      }, {
        label: 'array',
        value: 'array'
      }, {
        label: 'object',
        value: 'object'
      }, {
        label: 'attachment',
        value: 'attachment'
      }, {
        label: 'video',
        value: 'video'
      }, {
        label: 'color',
        value: 'color'
      }, {
        label: 'range',
        value: 'range'
      }, {
        label: 'joinByOne',
        value: 'joinByOne'
      }, {
        label: 'joinByArray',
        value: 'joinByArray'
      }, {
        label: 'joinByOneReverse',
        value: 'joinByOneReverse'
      }, {
        label: 'joinByArrayReverse',
        value: 'joinByArrayReverse'
      }]
    }]
  }],
  construct (self, options) {
    self.afterSave = async (req, piece, options, callback) => {
      const mkdirAsync = promisify(fs.mkdir)
      const readFileAsync = promisify(fs.readFile)
      const writeFileAsync = promisify(fs.writeFile)
      const encoding = 'utf-8'
      const configJson = './config/default.json'
      const noQuotesFields = ['required']

      // define model to create and remove "id" property
      const fields = piece.field.map(({ id, ...field }) => {
        let name
        let formatted = `
            ${Object.entries(field).map(element => {
              let key = element[0]
              let value = element[1]
              if (key === 'name') {
                name = value
                value = _.camelCase(value) // format name (ie: "custom name" => "customName")
              }
              value = key.includes(noQuotesFields) ? `${value}` : `'${value}'`
              return `${key}: ${value}`
            })}
        `
        return `{ label: '${_.startCase(name)}', ${formatted} }` // add beautified label before returning field
      })

      let model = `
        module.exports = {
          extend: 'apostrophe-pieces',
          name: '${piece.slug}',
          label: '${_.startCase(piece.title)}',
          addFields: [${fields}]
        }
      `

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
        model = prettier.format(model, {
          printWidth: 100,
          semi: false,
          singleQuote: true,
          trailingComma: 'all',
          parser: 'babylon'
        })
        await writeFileAsync(`./lib/modules/${piece.slug}/index.js`, model, encoding)
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
  }
}
