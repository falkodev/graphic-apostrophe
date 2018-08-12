apos.define('model-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',
  source: 'manager-modal',

  construct: function(self, options) {
    var superOnChange = self.onChange
    self.onChange = function() {
      window.setTimeout(function() {
        apos.notify('The server is restarting. Please, wait.', { type: 'success' })
        window.setTimeout(function() {
          window.location.reload(true)
          superOnChange()
        }, 2000)
      }, 2000)
    }
  },
})
