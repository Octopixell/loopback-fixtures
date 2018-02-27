fixtureLoader = require './fixtures-loader'
merge = require 'merge'

module.exports = (app, options) ->
  options = merge
    fixturePath: '/fixtures/data/'
    append: false
    autoLoad: false
  , options

  logError = (err) ->
    console.log('Error:', err)

  loadFixtures = ->
    if not options.append
      fixtureLoader.purgeDatabase app.models
      .then ->
        console.log 'Data purged'
        fixtureLoader.loadFixtures app.models, options.fixturePath
      .catch logError
    else
      fixtureLoader.loadFixtures app.models, options.fixturePath

  if options.autoLoad
    loadFixtures()

  app.loadFixtures = ->
    loadFixtures()
