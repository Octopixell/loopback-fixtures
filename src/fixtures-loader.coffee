_ = require 'lodash'
faker = require 'faker'
fs = require 'fs'
path = require 'path'
Promise = require 'bluebird'
YAML = require 'yamljs'

idKey = 'id'

module.exports =

  savedData: {}

  loadFixtures: (models, fixturesPath) ->
    # Get all yml files
    fixturePath = path.join process.cwd(), fixturesPath
    fixtureFolderContents = fs.readdirSync fixturePath
    fixtures = fixtureFolderContents.filter (fileName) ->
      fileName.match /\.yml$/

    loadingFixturesPromises = []

    # For each yml file
    _.each fixtures, (fixture) =>
      fixtureData = YAML.load(fixturePath + fixture)
      loadingFixturesPromises.push @loadYamlFixture models, fixtureData

    Promise.all loadingFixturesPromises


  purgeDatabase: (models) ->
    purgeModelPromises = []

    _.forEach models, (model) =>
      purgeModelPromises.push @purgeModel(model)

    Promise.all purgeModelPromises


  purgeModel: (model) ->
    new Promise (resolve, reject) ->
      if model.dataSource == null
        console.log('No data source defined, skipping...')
        return resolve()
      if typeof model.dataSource.adapter.settings == 'undefined'
        console.log('Data source without settings, skipping...')
        return resolve()
      if model.dataSource.adapter.settings.connector == 'remote-connector'
        console.log('Remote connected model, skipping...')
        return resolve()
      if model.destroyAll
        model.destroyAll (err) ->
          reject err if err
          resolve()


  getRandomMatchingObject: (pattern) ->
    regex = new RegExp pattern
    objects = _.filter @savedData, (value, key) ->
      not _.isEmpty(key.match(regex))
    return _.sample objects


  replaceReferenceInObjects: (object) ->
    new Promise (resolve, reject) =>
      _.each object, (value, key) =>
        # Find matches in our format @{object.key}
        regex = /@\{([a-zA-Z0-9_]*)\.*(\S*)\}/g
        matches = regex.exec(value)
        # Resolve if there's no matches
        if matches == null || matches.length < 2
          return resolve object
        # If we find matches, get our reference
        if matches.length > 2
          identifier = matches[1]
          property = matches[2]
          pattern = '^' + identifier
          # If the property is * grab a random identifier based on
          # the identifier string like /^identifier/ otherwise do
          # /^identifier$/ which would be a perfect match
          if property != '*'
            pattern = pattern + '$'
          # Get the referenced object
          referencedObject = @getRandomMatchingObject pattern
          # Set the default id key if no second match was found
          # like @{object} so no key was defined in the reference
          if property == '' || property == '*'
            property = idKey
          # Check if the referenced object and key exist and if so,
          # replace the match string with the value found in the
          # referenced object
          if referencedObject?[property]
            # If the value begins with @ override the whole key
            # in the object, which allows keeping the type equal
            if _.values(value)?[0] == '@'
              object[key] = referencedObject[property]
            # If not, this is composite string so make a string replace
            else
              object[key] = object[key].replace(
                matches[0],
                referencedObject[property]
              )
          # There was no matching values, return an error
          else
            error = 'No value found for '+identifier+'.'+property
            return reject new Error(error)
      # Function done, resolve object
      resolve object


  executeGenerators: (data) ->
    expandedData = {}

    _.each data, (object, identifier) ->
      # Try to identify "identifer{m..n}" pattern
      regex = /(\w+)\{(\d+)..(\d+)\}$/
      match = identifier.match(regex)

      # If pattern detected
      if match?.length is 4
        identifier = match[1]
        min = parseInt match[2]
        max = parseInt match[3]
        # Duplicate object ...
        for i in [min..max]
          expandedData[identifier + i] = _.clone object
          # ... and replace all {#} occurences
          _.each object, (value, key) ->
            if typeof value is 'string'
              newValue = value.replace /\{#\}/g, i.toString()
            else
              newValue = value
            expandedData[identifier + i][key] = newValue
      else
        expandedData[identifier] = object

    return expandedData


  executeFaker: (data) ->
    _.each data, (object, identifier) ->
      _.each object, (value, key) ->
        try
          data[identifier][key] = faker.fake value
        catch e
          data[identifier][key] = value
    return data


  executeFunctions: (data) ->
    _.each data, (object, identifier) ->
      _.each object, (value, key) ->
        try
          fn = eval value
          data[identifier][key] = fn
        catch e
    return data


  applyHelpers: (data) ->
    # Repeat "identifier{a..b}"
    expandedData = @executeGenerators data
    # Execute faker {{name.lastname}} etc
    expandedData = @executeFaker expandedData
    # Exec function
    expandedData = @executeFunctions expandedData
    return expandedData


  loadYamlFixture: (models, fixtureData) ->
    fixtureData = _.map fixtureData, (data, index) ->
      fixtures: data
      name: index

    Promise.each fixtureData, (modelData) =>
      modelData.fixtures = @applyHelpers modelData.fixtures

      modelFixtures = _.map modelData.fixtures, (data, index) ->
        object: data
        identifier: index
      Promise.each modelFixtures, (fixture) =>
        @replaceReferenceInObjects fixture.object
        .then (object) ->
          models[modelData.name].create object
        .then (savedObject) =>
          @savedData[fixture.identifier] = savedObject
          console.log "[#{modelData.name}] - #{fixture.identifier} " +
                      "imported (id : #{savedObject?[idKey]})"
