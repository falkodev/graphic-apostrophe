apos.define('apostrophe-schemas', {
  construct: function(self, options) {
    var superAfterPopulate = self.afterPopulate
    self.afterPopulate = function($el, schema, object, callback) {
      // enable a "slug" field to slugify another field while typing
      var slugFields = _.filter(schema, 'enableSlug')
      slugFields.forEach(function(slugField) {
        var name = _.find(schema, { name: slugField.enableSlug })
        var slug = _.find(schema, { name: slugField.name, type: 'slug' })

        if (name && slug) {
          var $name = self.findField($el, slugField.enableSlug)
          var $slug = self.findField($el, slugField.name)

          if (slug.prefix) {
            $slug.data('prefix', slug.prefix)
          }

          self.enableSlug($name, $slug, name, slug)
        }
      })

      return superAfterPopulate($el, schema, object, callback)
    }
  },
})
