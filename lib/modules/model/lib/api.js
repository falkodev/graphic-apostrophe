module.exports = (self, options) => {
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
  self.extractOptions = (schema, field) => {
    const iterator = schema.choices || schema.schema
    if (iterator) {
      // select, checkboxes, object, array, area, ...
      return iterator.reduce((acc, schemaField) => {
        if (schemaField.showFields) {
          schemaField.showFields.forEach(showField => {
            if (field[schema.name].includes(schemaField.value)) {
              const modifiedField = { ...field, type: self.schemaOptions[showField].type }
              const extractedOptions = self.extractOptions(self.schemaOptions[showField], modifiedField)
              if (field.type === 'area') {
                acc = {
                  options: {
                    widgets: extractedOptions,
                  },
                }
              } else {
                acc[schemaField.value] = extractedOptions
              }
            }
          })
        } else {
          if (schemaField.value) {
            if (field[schema.name].includes(schemaField.value)) {
              // select, checkboxes, array
              if (typeof field[schema.name] === 'object') {
                // if value in the mapped field is iterable
                acc[schemaField.value] = {}
              } else if (field[schema.name] === schemaField.value) {
                // if a schema field matches a property in the mapped field, just print it
                acc = field[schema.name]
              }
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
}
