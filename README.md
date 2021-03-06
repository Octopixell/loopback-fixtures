# loopback-fixtures

Expressive fixtures generator for Loopback

[![Build Status](https://travis-ci.org/Octopixell/loopback-fixtures.svg?branch=master)](https://travis-ci.org/Octopixell/loopback-fixtures)
[![dependencies Status](https://david-dm.org/octopixell/loopback-fixtures/status.svg)](https://david-dm.org/octopixell/loopback-fixtures)

## Installation

### Basic usage

Add the following entry to your `package.json`:

```
"loopback-fixtures": "git://github.com/Octopixell/loopback-fixtures.git"
```

Then, in your `server/component-config.json`, add :

``` json
{
  "loopback-fixtures": {
    "fixturePath": "/fixtures/data/",
    "append": false,
    "autoLoad": false
  }
}
```

Write your YML fixture file `/fixture/data/data.yml` (adapt according your model) :


``` yaml
Group:
  group{1..10}:
    name: "Groupe {#} depuis les fixtures"

User:
  user{1..10}:
    name: "User {#} : {{name.lastName}}"
    groupId: @{group{#}}
    email: "{{internet.email}}"
    birthDate: "2016-01-01"
    favoriteNumber: "(function() { return Math.round(Math.random()*1000);})()"
```

### How to load fixtures ?

 - If `autoLoad` is set to `true`, fixtures will be loaded when you start your application

 - With the server:

    `app.loadFixtures()` (return a promise)

    e.g:

    ``` js
    app.loadFixtures()
    .then(function() {
      console.log('Done!');
    })
    .catch(function(err) {
      console.log('Errors:', err);
    });
    ```

 - With a node command:

    ```
    node ./node_modules/loopback-fixtures/lib/load-fixtures.js
    ```

### Configuration options

 - `fixturePath` (default value `'/fixtures/data'`)

    The directory to load data fixtures from

 - `append` (default value `true`)

    If set to `true`, data fixtures will be append instead of deleting all data from the database first.
    **WARNING** `false` will erase your database

 - `autoLoad` (default value `false`)


### Features

 - Load data according your model

 - Multiple generators :

    ``` yaml
    User:
      user{1..45}:
        name: "User number {#}"
    ```

    `{#}` represents the current identifier for the generator

 - References :

     ``` yaml
     Group:
       group{1..3}:
         name: "Groupe number {#}"

     User:
       user{1..9}:
         name: "User number {#}"
         group: @{group1}  # Reference to group1
         owner: @{group1.owner} # Reference the owner of group1

       user{10..19}:
         name: "User number {#}"
         group: @{group.*} # Reference to any random matching group
     ```

     `@{group1}` represents the reference for `group1` and can be used in other fixtures
     `@{group1.name}` represents the reference for the property `name` within `group1` and can be used in other fixtures
     `@{group.*}` represents the reference for a **random** matching group and can be used in other fixtures

 - JSON
 
    ``` yaml
    User:
      userWithJson:
        data: '{"key":"value","key2":"value2"}'
     ```

 - Fakers :

    ``` yaml
    User:
      user{1..10}:
        name: "User n°{#} : {{name.lastName}} {{name.firstName}}"
        email: "{{internet.email}}"
    ```

    You can use [Faker.js](https://github.com/marak/faker.js) API to provide fake data

 - Custom function :

    ``` yaml
    User:
      user{1..10}:
        favoriteNumber: "(function() { return Math.round(Math.random()*1000); })()"
    ```

    You can use custom functions too



## Credits
[Samy Ghribi](https://github.com/sghribi) - For creating the initial version of this [LoopBack](https://loopback.io/) [component](https://loopback.io/doc/en/lb3/Creating-components.html). Thanks Samy!

## License

ISC
