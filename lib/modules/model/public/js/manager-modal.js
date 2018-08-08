apos.define('model-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',
  source: 'manager-modal',

  construct: function(self, options) {
    var superOnChange = self.onChange;
    self.onChange = function() {
      apos.notify('The server is restarting. Please, wait.', { type: 'success', dismiss: true });
      window.setTimeout(function () { window.location.reload(true); }, 1000);
      superOnChange();
    }
  }
});