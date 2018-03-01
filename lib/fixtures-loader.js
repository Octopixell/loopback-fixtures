var Promise, YAML, _, faker, fs, idKey, path;

_ = require('lodash');

faker = require('faker');

fs = require('fs');

path = require('path');

Promise = require('bluebird');

YAML = require('yamljs');

idKey = 'id';

module.exports = {
  savedData: {},
  logError: function(err) {
    return console.log('Error:', err);
  },
  loadFixtures: function(models, fixturesPath) {
    var fixtureFolderContents, fixturePath, fixtures, loadingFixturesPromises;
    // Get all yml files
    fixturePath = path.join(process.cwd(), fixturesPath);
    fixtureFolderContents = fs.readdirSync(fixturePath);
    fixtures = fixtureFolderContents.filter(function(fileName) {
      return fileName.match(/\.yml$/);
    });
    loadingFixturesPromises = [];
    // For each yml file
    _.each(fixtures, (fixture) => {
      var fixtureData;
      fixtureData = YAML.load(fixturePath + fixture);
      return loadingFixturesPromises.push(this.loadYamlFixture(models, fixtureData));
    });
    return Promise.all(loadingFixturesPromises);
  },
  purgeDatabase: function(models) {
    var purgeModelPromises;
    purgeModelPromises = [];
    _.forEach(models, (model) => {
      return purgeModelPromises.push(this.purgeModel(model));
    });
    return Promise.all(purgeModelPromises);
  },
  purgeModel: function(model) {
    return new Promise(function(resolve, reject) {
      if (model.dataSource === null) {
        console.log('No data source defined, skipping...');
        return resolve();
      }
      if (typeof model.dataSource.adapter.settings === 'undefined') {
        console.log('Data source without settings, skipping...');
        return resolve();
      }
      if (model.dataSource.adapter.settings.connector === 'remote-connector') {
        console.log('Remote connected model, skipping...');
        return resolve();
      }
      if (model.destroyAll) {
        return model.destroyAll(function(err) {
          if (err) {
            reject(err);
          }
          return resolve();
        });
      }
    });
  },
  getRandomMatchingObject: function(pattern) {
    var objects, regex;
    regex = new RegExp(pattern);
    objects = _.filter(this.savedData, function(value, key) {
      return !_.isEmpty(key.match(regex));
    });
    return _.sample(objects);
  },
  replaceReferenceInObjects: function(object) {
    return new Promise((resolve, reject) => {
      _.each(object, (value, key) => {
        var error, identifier, matches, pattern, property, ref, referencedObject, regex;
        // Find matches in our format @{object.key}
        regex = /@\{([a-zA-Z0-9_]*)\.*(\S*)\}/g;
        matches = regex.exec(value);
        // Resolve if there's no matches
        if (matches === null || matches.length < 2) {
          return resolve(object);
        }
        // If we find matches, get our reference
        if (matches.length > 2) {
          identifier = matches[1];
          property = matches[2];
          pattern = '^' + identifier;
          // If the property is * grab a random identifier based on
          // the identifier string like /^identifier/ otherwise do
          // /^identifier$/ which would be a perfect match
          if (property !== '*') {
            pattern = pattern + '$';
          }
          // Get the referenced object
          referencedObject = this.getRandomMatchingObject(pattern);
          // Set the default id key if no second match was found
          // like @{object} so no key was defined in the reference
          if (property === '' || property === '*') {
            property = idKey;
          }
          // Check if the referenced object and key exist and if so,
          // replace the match string with the value found in the
          // referenced object
          if (referencedObject != null ? referencedObject[property] : void 0) {
            // If the value begins with @ override the whole key
            // in the object, which allows keeping the type equal
            if (((ref = _.values(value)) != null ? ref[0] : void 0) === '@') {
              return object[key] = referencedObject[property];
            } else {
              // If not, this is composite string so make a string replace
              return object[key] = object[key].replace(matches[0], referencedObject[property]);
            }
          } else {
            // There was no matching values, return an error
            error = 'No value found for ' + identifier + '.' + property;
            return reject(new Error(error));
          }
        }
      });
      // Function done, resolve object
      return resolve(object);
    });
  },
  executeGenerators: function(data) {
    var expandedData;
    expandedData = {};
    _.each(data, function(object, identifier) {
      var i, j, match, max, min, ref, ref1, regex, results;
      // Try to identify "identifer{m..n}" pattern
      regex = /(\w+)\{(\d+)..(\d+)\}$/;
      match = identifier.match(regex);
      // If pattern detected
      if ((match != null ? match.length : void 0) === 4) {
        identifier = match[1];
        min = parseInt(match[2]);
        max = parseInt(match[3]);
// Duplicate object ...
        results = [];
        for (i = j = ref = min, ref1 = max; (ref <= ref1 ? j <= ref1 : j >= ref1); i = ref <= ref1 ? ++j : --j) {
          expandedData[identifier + i] = _.clone(object);
          // ... and replace all {#} occurences
          results.push(_.each(object, function(value, key) {
            var newValue;
            if (typeof value === 'string') {
              newValue = value.replace(/\{#\}/g, i.toString());
            } else {
              newValue = value;
            }
            return expandedData[identifier + i][key] = newValue;
          }));
        }
        return results;
      } else {
        return expandedData[identifier] = object;
      }
    });
    return expandedData;
  },
  executeFaker: function(data) {
    _.each(data, function(object, identifier) {
      return _.each(object, function(value, key) {
        var e;
        try {
          return data[identifier][key] = faker.fake(value);
        } catch (error1) {
          e = error1;
          return data[identifier][key] = value;
        }
      });
    });
    return data;
  },
  executeFunctions: function(data) {
    _.each(data, function(object, identifier) {
      return _.each(object, function(value, key) {
        var e, fn;
        try {
          fn = eval(value);
          return data[identifier][key] = fn;
        } catch (error1) {
          e = error1;
        }
      });
    });
    return data;
  },
  executeJsonParser: function(data) {
    var regex;
    regex = /(\{.*\:.*\})/g;
    _.each(data, function(object, identifier) {
      return _.each(object, function(value, key) {
        var error, matches;
        matches = regex.exec(value);
        if (matches !== null) {
          try {
            return data[identifier][key] = JSON.parse(value);
          } catch (error1) {
            error = error1;
            return console.log('Error parsing JSON:', error);
          }
        }
      });
    });
    return data;
  },
  applyHelpers: function(data) {
    var expandedData;
    // Repeat "identifier{a..b}"
    expandedData = this.executeGenerators(data);
    // Execute faker {{name.lastname}} etc
    expandedData = this.executeFaker(expandedData);
    // Exec function
    expandedData = this.executeFunctions(expandedData);
    // Exec JSON parse
    expandedData = this.executeJsonParser(expandedData);
    return expandedData;
  },
  loadYamlFixture: function(models, fixtureData) {
    fixtureData = _.map(fixtureData, function(data, index) {
      return {
        fixtures: data,
        name: index
      };
    });
    return Promise.each(fixtureData, (modelData) => {
      var modelFixtures;
      modelData.fixtures = this.applyHelpers(modelData.fixtures);
      modelFixtures = _.map(modelData.fixtures, function(data, index) {
        return {
          object: data,
          identifier: index
        };
      });
      return Promise.each(modelFixtures, (fixture) => {
        return this.replaceReferenceInObjects(fixture.object).then(function(object) {
          return models[modelData.name].create(object);
        }).then((savedObject) => {
          this.savedData[fixture.identifier] = savedObject;
          return console.log(`[${modelData.name}] - ${fixture.identifier} ` + `imported (id : ${(savedObject != null ? savedObject[idKey] : void 0)})`);
        }).catch(this.logError);
      });
    });
  }
};
