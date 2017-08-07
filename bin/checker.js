var Db = require('mongodb').Db;
var monk = require('monk');
var MongoClient = require('mongodb').MongoClient;
var geocluster = require('geocluster');
var config = require('../config.js');

var db = monk(config.mongo.host+':'+config.mongo.port+'/'+config.mongo.db);

const checkForThreshhold = () => {

  // get all wants, group by artist
  db.collection('wants').aggregate({$group: {_id:"$artist._id", data: {$push: "$$ROOT"}}})
  .then((result) => {
    result.forEach((artist) => {
      // for each artist, find the clusters
      let toCluster = [];
      artist.data.forEach((datum) => {
        toCluster.push([datum.user.fan.location.coordinates[1], datum.user.fan.location.coordinates[0]]);
      });
      let cluster = geocluster(toCluster, 1.5);
      cluster.forEach((cluster) => {
        // if a large enough cluster, then kick off the venue search
        if (cluster.elements.length >= config.threshhold.fans) {
          // but first find the center of the cluster
          let centroid = [];
          centroid[0] = cluster.centroid[1];
          centroid[1] = cluster.centroid[0];
          // find all venues near the centroid
          db.collection('venues').find({cap: {$gt: config.threshhold.minvcap}, location: {$nearSphere: {$geometry: {type: "Point", coordinates: centroid}, $maxDistance: 1610 * 20}}})
          .then((venues) => {
            let venue_avail = []
            let artist_avail = {}
            let  i=0
            db.collection('avail').find({ref_id: artist._id.toString()}, {blackout: 1})
            .then((aresult) => {
              venues.forEach((venue) => {
                db.collection('avail').find({ref_id: venue._id.toString()}, {blackout: 1})
                .then((vresult) => {
                  let toPending = {
                    artist: artist,
                    venue: venue,
                    blackout: vresult.concat(aresult)
                  }
                  db.collection('pending').insert(toPending)
                  .then((res) => {
                  })
                  .catch((err) => {
                    console.log(err);
                  });
                })
                .catch((err) => {
                  console.log(err);
                });
              })
            })
            .catch((err) => {
              console.log(err);
            });

            /*
            venues.forEach((venue) => {
              console.log(venue._id.toString());
              db.collection('avail').find({ref_id: venue._id.toString()},{blackout: 1})
              .then((vresult) => {
                console.log('vresult:'+vresult);
                i++;
                venue['blackout'] = vresult;
                venue_avail.push({venue:venue});
                if (i === venues.length) {
                  console.log(venue_avail);
                  db.collection('avail').find({ref_id: artist._id.toString()}, {blackout: 1})
                  .then((aresult) => {
                    artist['blackout'] = aresult;
                    artist_avail = {
                      artist: artist,
                    }
                    venue_avail.forEach((venue) => {

                    });
                  })
                  .catch((err) => {
                    console.log(err);
                  });
                }
              })
              .catch((err) => {
                console.log(err);
              });
            })
            */
          })
          .catch((err) => {
            console.log(err);
          });
          db.collection('wants').update({'artist._id': artist._id, 'user.fan.location': { $nearSphere: {$geometry: { type: "Point", coordinates: centroid}, $maxDistance: 1610*20}}}, {$set: {status: 'tso'}})
          .then((res) => {
            console.log(res);
          })
          .catch((err) => {
            console.log(err);
          });
        }
      });
    })
  })
  .catch((err) => {
    console.log(err);
  });
}

checkForThreshhold();
