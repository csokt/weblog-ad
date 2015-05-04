/* global require */
/* global module */
/* global process */
/* global console */

var weblogAd = function(setup) {
  setup.host  = setup.host ? setup.host : require('ip').address()
  setup.topic = setup.domain+'.'+setup.host+'.'+setup.service

  var _ = require('lodash')
  var when = require('when')
  var ldap = require('ldapjs')
  var client = ldap.createClient({ url: setup.dbconnection.url })

  client.bind(setup.dbconnection.user, setup.dbconnection.password, function(err) {
    if (err) { console.log('bind err', err); process.exit(8) }
  })

  var autobahn = require('autobahn')

  var connection = new autobahn.Connection({
    url: process.argv[2] || 'ws://127.0.0.1:8080/ws',
    realm: process.argv[3] || 'weblog'
  })

  var main = function(session) {
    session.subscribe('discover', function() {
      session.publish('announce', [_.pick(setup, 'domain', 'host', 'service', 'topic')])
    })

    session.register(setup.topic+'.header', function() {
      return setup.headers
    })

    session.register(setup.topic+'.reload', function(args) {
      var d = when.defer()
      var controls = args[0]
      var table = controls.header
      var opts = {
        filter: table.filter,
        scope: table.scope
      }

      client.search(table.searchdn, opts, function(err, request) {
        if (err) { console.log('search err', err); process.exit(8) }
        var res = []

        request.on('searchEntry', function(entry) {
//          flds = _.object(table.fields, table.fields)
          flds = _.defaults(_.pick(entry.object, table.fields), _.object(table.fields, table.fields))
          console.dir(flds)
          res.push(_.values(flds))
        })
        request.on('error', function(err) {
          console.error('error: ' + err.message)
          d.resolve(res)
        })
        request.on('end', function(result) {
          d.resolve(res)
        })
      })
      return d.promise
    })
  }

  connection.onopen = main

  connection.open()
}

module.exports = weblogAd
