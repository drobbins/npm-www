var config = require("./config.js")
, worker = require.resolve("./worker.js")
, clusterConf = config.cluster || {}
clusterConf.exec = worker

// set up the server cluster.
var clusterMaster = require("cluster-master")
, callresp = require("cluster-callresp")
, npm = require("npm")
, registry = require("npm/lib/utils/npm-registry-client/index.js")
, LRU = require("lru-cache")
, regData = new LRU(10000)


// This is where the workers make requests to npm.
// It happens here so that multiple parallel requests
// don't result in broken garbage in the cache, since
// requests are not purely atomic across processes.
callresp(function (req, cb) {
  switch (req.cmd) {
    case "registry.get":
      var n = req.name
      , v = req.version
      , k = n + "/" + v
      , data = regData.get(k)

      if (data) return cb(null, data)

      registry.get(n, v, 60000, false, true, function (er, data, raw, res) {
        if (er) {
          er.statusCode = res.statusCode
          return cb(er, data)
        }
        regData.set(k, data)
        return cb(er, data)
      })
      break

    default:
      return cb(new Error("unknown command"))
  }
})

npm.load({ "cache-min": "60000", "node-version": null }, function (er) {
  if (er) throw er

  // Ok, we're ready!  Spin up the cluster.
  clusterMaster(clusterConf)
})