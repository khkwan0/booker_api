var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;
var fs = require('fs');
var gm = require('gm');
var parser = require('parse-address');
var geocluster = require('geocluster');

/* GET home page. */
router.post('/imageupload', (req, res, next)  => {
  if (req.files.file !== 'undefined') {
    let newFileName = 'public/assets/tmp/'+req.files.file.uuid+'_'+req.files.file.filename;
    fs.rename(req.files.file.file, newFileName, (e) => {
      if (e) {
        res.status(403).send(e);
      }
      newFileName = '/assets/tmp/'+req.files.file.uuid+'_'+req.files.file.filename;
      gm(__dirname+'/../public'+newFileName)
      .resize(800,600)
      .write(__dirname+'/../public'+newFileName+'_resize', (err) => {
        if (err) {
          console.log(err);
          res.status(500).send(JSON.stringify({res: err}));
        }
      });
      gm(__dirname+'/../public'+newFileName)
      .resize(200,200)
      .write(__dirname+'/../public'+newFileName+'_th', (err) => {
        if (!err) {
          let result = {
            status: 'OK',
            filename: newFileName+'_resize',
            th: newFileName+'_th',
            orig: req.files.file.uuid+'_'+req.files.file.filename
          }
          res.status(200).send(JSON.stringify(result));
        } else {
          console.log(err);
          res.status(500).send(JSON.stringify({res: err}));
        }
      });
    });
  } else {
    res.status(403).send(JSON.stringify(req));
  }
});

router.post('/login', (req, res, next) => {
    if (req.body.email && req.body.pw) {
      let Users = req.db.collection('users');
      let rv = {
        user: null
      };
      Users.findOne({email:req.body.email, password: req.body.pw}, '-password')
      .then((result) => {
        if (result) {
          let Venues = req.db.collection('venues');
          Venues.findOne({user_id: result._id.toString()})
          .then((result2) => {
            if (result2) {
              result.hasVenue = true;
            } else {
              result.hasVenue = false;
            }
            let Artists = req.db.collection('artists');
            Artists.findOne({user_id: result._id.toString()})
            .then((result3) => {
              if (result3) {
                result.hasArtist = true;
              } else {
                result.hasArtist = false;
              }
              let Fans = req.db.collection('fans');
              Fans.findOne({user_id: result._id.toString()})
              .then((result4) => {
                if (result4) {
                  result.hasFan = true;
                } else {
                  result.hasFan = false;
                }
                rv.user = result;
                req.session.user = result;
                res.status(200).send(JSON.stringify(rv));
              })
            })
            .catch((err) => {
              console.log(err.stack);
            });
          })
          .catch((err) => {
            console.log(err.stack);
          });
        } else {
          res.status(200).send(JSON.stringify(rv));
        }
      })
      .catch((err) => {
        console.log(err.stack);
        res.status(200).send(JSON.stringify({err: err.stack}));
      });
    } else {
      res.status(403).send();
    }
});

const getWantsByVenue = (db, venues) => {
  return new Promise((resolve, reject) => {
    let i = 0
    let rv = []
    let Wants = db.collection('wants')
    venues.forEach((venue, idx)=> {
      rv.push(venue)
      rv[idx]['wants'] = null 
      Wants.find({'user.fan.location':{$nearSphere: {$geometry: {type:"Point", coordinates: [venue.location.coordinates[0], venue.location.coordinates[1]]}}}})
      .then((result) => {
        i++
        rv[idx]['wants'] = result
        if (i === venues.length) {
          resolve(rv);
        }
      })
      .catch((err) => {
        reject(err)
      })
    })
  })
}

router.post('/fb', (req, res, next) => {
  console.log(req.body);
  let rv = {}
  if (req.body.id) {
    let Users = req.db.collection('users');
    Users.findOneAndUpdate(
      {fbid: req.body.id},
      { $setOnInsert: {
        fbid: req.body.id,
        info: req.body,
        uname: req.body.name,
        email: req.body.email,
        lastLogin: new Date()
                      }
      },
      {
        new: true,
        upsert: true
      }
    )
    .then((result) => {
      if (result) {
        rv.msg = result
        res.status(200).send(JSON.stringify(rv))
      } else {
        res.status(500).send();
      }
    })
    .catch((err) => {
      console.log(err.stack);
      rv.msg = err
      res.status(500).send(JSON.stringify(rv))
    })
  } else {
    res.status(200).send(JSON.stringify(rv))
  }
})

router.post('/loginmobile', (req, res, next) => {
  if (req.body.email && req.body.pw) {
    console.log(req.body.email + ' '+ req.body.pwd)
    let rv = {
      user: null
    }
    let found = false
    let Users = req.db.collection('users');
    Users.findOne({email:req.body.email, password: req.body.pw}, '-password')
    .then((result) => {
      if (result) {
        found = true;
        rv.user = result
        let Venues = req.db.collection('venues')
        return Venues.find({user_id: result._id.toString()})
      }
    })
    .then((result2) => {
      if (result2 && result2.length) {
        rv.user.hasVenue = result2.length
        rv.user.venues = result2
        rv.user.vwants = []
        return getWantsByVenue(req.db, result2)
      } else {
        if (found) {
          rv.user.hasVenue = false
        }
      }
    })
    .then((vresult) => {
      if (vresult && vresult.length) {
        rv.user.vwants = vresult
      }
      if (found) {
        let Artists = req.db.collection('artists')
        return Artists.find({user_id: rv.user._id.toString()})
      }
    })
    .then((result3) => {
      if (result3 && result3.length) {
        rv.user.hasArtist = result3.length
        rv.user.artists = result3
      } else {
        if (found) {
          rv.user.hasArtist = false
        }
      }
      console.log(rv);
      req.session.user = rv
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(200).send(JSON.stringify({err: err.stack}));
    })
  } else {
    res.status(403).send();
  }
})

router.get('/logout', (req, res, next) => {
  req.session.destroy();
  res.status(200).send();
});

router.get('/checksession', (req, res, next) => {
    let rv = {
      user: null
    };
    if (typeof req.session !== 'undefined' && typeof req.session.user !== 'undefined' && req.session.user) {
      rv.user = req.session.user;
    }
    res.status(200).send(JSON.stringify(rv));
});

router.get('/checkuname', (req, res, next) => {
  let uname = req.query.uname;
  if (uname) {
    let rv = {ok:1};
    let Users = req.db.collection('users');
    Users.findOne({uname: uname})
    .then((result) => {
      if (result) {
        rv.ok = 0;
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
        console.log(err.stack);
        res.status(500).send(err);
    });
  } else {
    res.status(403).send();
  }
});

router.get('/checkemail', (req, res, next) => {
  let email = req.query.email;
  if (email) {
    let rv = {ok:1};
    let Users = req.db.collection('users');
    Users.findOne({email: email})
    .then((result) => {
      if (result) {
        rv.ok = 0;
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
        console.log(err.stack);
        res.status(500).send(err);
    });
  } else {
    res.status(403).send();
  }
});

router.post('/register', (req, res, next) => {
  if (req.body.email && req.body.pw && req.body.uname) {
    toSave = {
      uname: req.body.uname,
      email: req.body.email,
      password: req.body.pw,
      ts: new Date(),
      verified: false
    };
    let Users = req.db.collection('users');
    Users.insert(toSave)
    .then((result) => {
      if (result._id) {
        toSave.password = null;
        let rv = {
          ok: 1,
          user: toSave
        }
        req.session.user = toSave;
        res.status(200).send(JSON.stringify(rv));
      } else {
        let rv = {
          ok: 0,
          msg: '0 saved. maybe duplicate?'
        }
        res.status(403).send(JSON.stringify(rv));
      }
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send();
    });
  } else {
    res.status(403).send();
  }
});

router.get('/getlonglat', (req, res, next) => {
  if (req.query.st && req.query.nm && req.query.zip) {
    console.log(req.query);
    let GeoDB = req.geodb.collection('usa.ca');
    GeoDB.findOne({
      number: req.query.nm,
      postcode: req.query.zip,
      $text: {
        $search: req.query.st
      }
    })
    .then((result) => {
      if (result) {
        console.log(result);
        let rv = {
          lng: result.location.coordinates[0],
          lat: result.location.coordinates[1]
        }
        res.status(200).send(JSON.stringify(rv));
      } else {
        res.status(403).send();
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send();
    });
  } else {
    res.status(404).send();
  }
});

router.post('/savevenue', (req, res, next) => {
  let toSave = req.body;
  let rv = {
    ok: 0
  };
  if (toSave/* && req.session.user*/) {
    if (typeof req.session.user._id !== 'undefined') {
      console.log('session userid:'+req.session.user._id)
      toSave.user_id = req.session.user._id.toString()
    } else {
      toSave.user_id = req.body.user_id
    }
    if (toSave.orig) {
      let dst_dir = __dirname + '/../public/assets/images/venue/';
      let nameParts = toSave.orig.split('.');
      let baseName = '';
      let ext = '';
      if (nameParts.length === 1) {
        baseName = toSave.orig;
      } else {
        for (i=0; i<nameParts.length-1; i++) {
          baseName += nameParts[i];
        }
        ext = '.' + nameParts[nameParts.length-1];
      }
      if (baseName) {
        fs.rename(__dirname + '/../public' + toSave.image, dst_dir + baseName + '_resize' + ext, (e) => {
          if (e) {
            console.log(e);
          }
        });
        fs.rename(__dirname + '/../public' + toSave.th, dst_dir + baseName + '_th' + ext, (e) => { 
          if (e) {
            console.log(e);
          }
        });
        fs.rename(__dirname + '/../public/assets/tmp/' + toSave.orig, dst_dir + baseName + ext, (e) => { 
          if (e) {
            console.log(e);
          }
        });
        toSave.orig = [];
        toSave.image = [];
        toSave.ts = [];
        toSave.image.push(baseName + '_resize' + ext);
        toSave.th.push(baseName + '_th' + ext)
        toSave.orig.push(baseName + ext);
      }
    }
    toSave.ts = new Date();
    toSave.verified = false;
    toSave.cap = parseInt(toSave.cap);
    if (req.body.parsed.number && req.body.parsed.street) {
      let Geo = req.geodb.collection('usa.ca');
      Geo.find({number: req.body.parsed.number, $text: {$search: req.body.parsed.street}, zip: req.body.zip})
      .then((result) => {
        if (result) {
          console.log(result)
          res.status(200).send(JSON.stringify(result));
        }
      })
      .catch((err) => {
        console.log(err.stack);
        res.status(500).send();
      })
    }

    Venues = req.db.collection('venues');
    Venues.insert(toSave)
    .then((result) => {
      if (result._id) {
        rv.ok = 1
        rv.venue = result
        req.session.user.hasVenue = true
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack)
      res.status(200).send(JSON.stringify(rv));
    });
  } else {
    res.status(403).send(JSON.stringify(rv));
  }
});

router.post('/saveartist', (req, res, next) => {
  let toSave = req.body;
  let rv = {
    ok: 0
  };
  if (toSave/* && req.session.user*/) {
    if (typeof req.session.user._id !== 'undefined') {
      console.log('session userid:'+req.session.user._id)
      toSave.user_id = req.session.user._id.toString()
    } else {
      toSave.user_id = req.body.user_id
    }
    if (toSave.orig) {
      let dst_dir = __dirname + '/../public/assets/images/venue/';
      let nameParts = toSave.orig.split('.');
      let baseName = '';
      let ext = '';
      if (nameParts.length === 1) {
        baseName = toSave.orig;
      } else {
        for (i=0; i<nameParts.length-1; i++) {
          baseName += nameParts[i];
        }
        ext = '.' + nameParts[nameParts.length-1];
      }
      if (baseName) {
        fs.rename(__dirname + '/../public' + toSave.image, dst_dir + baseName + '_resize' + ext, (e) => {
          if (e) {
            console.log(e);
          }
        });
        fs.rename(__dirname + '/../public' + toSave.th, dst_dir + baseName + '_th' + ext, (e) => { 
          if (e) {
            console.log(e);
          }
        });
        fs.rename(__dirname + '/../public/assets/tmp/' + toSave.orig, dst_dir + baseName + ext, (e) => { 
          if (e) {
            console.log(e);
          }
        });
        toSave.orig = [];
        toSave.image = [];
        toSave.ts = [];
        toSave.image.push(baseName + '_resize' + ext);
        toSave.th.push(baseName + '_th' + ext)
        toSave.orig.push(baseName + ext);
      }
    }
    Artists = req.db.collection('artists');
    toSave.ts = new Date();
    toSave.verified = false;
    Artists.insert(toSave)
    .then((result) => {
      if (result._id) {
        rv.ok = 1
        rv.msg = JSON.stringify(result)
        req.session.user.hasArtist = true
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack)
      res.status(200).send(JSON.stringify(rv));
    });
  } else {
    res.status(403).send(JSON.stringify(rv));
  }
});

const getCoordsByZip = (db, zip) => {
  return new Promise((resolve, reject) => {
    let Zips = db.collection('zips');
    Zips.findOne({zip: zip})
    .then((result) => {
      resolve(result.location);
    })
    .catch((err) => {
      reject(err);
    })
  })
}

const getNearestVenues = (db, location, radius) => {
  return new Promise((resolve, reject) => {
    Venues = db.collection('venues');
    Venues.find({
      location: {
        $nearSphere: {
          $geometry: location,
          $maxDistance: 1609.34 * radius
        }
      }
    })
    .then((result) => {
      resolve(result);
    })
    .catch((err) => {
      reject(err);
    });
  })
}

const getAllWantsCoordsByArtist = (db, artist_id) => {
  return new Promise((resolve, reject) => {
    let Wants = db.collection('wants');
    Wants.find({'artist._id': new ObjectId(artist_id)})
    .then((result) => {
      let coords = [];
      result.map((want) => {
        coords.push([want.user.fan.location.coordinates[1], want.user.fan.location.coordinates[0]]);
      })
      resolve(coords);
    })
    .catch((err) => {
      reject(err);
    })
  })
}

const getClusters = (db, artist_id) => {
  return new Promise((resolve, reject) => {
    getAllWantsCoordsByArtist(db, artist_id)
    .then((result) => {
      let coords = result;
      console.log(coords);
      let clusters = geocluster(coords,1.5);
      console.log(clusters);
      resolve(clusters);

    })
    .catch((err) => {
      reject(err);
    });
  })
}

router.post('/savefan', (req, res, next) => {
  let toSave = {
    zip: req.body.zip
  }
  let rv = {
    ok: 0
  };
  if (req.body.user && req.body.zip) {
    Users = req.db.collection('users')
    toSave.ts = new Date;
    getCoordsByZip(req.db,toSave.zip)
    .then((location) => {
      toSave.location = location;
      Users.update({_id: new ObjectId(req.body.user._id)}, {$set: {fan:toSave}}, {upsert: true})
      .then((result) => {
        if (result.n) {
          rv.ok = 1
          req.session.user = req.body.user
          req.session.user.hasFan = true
          req.session.user.fan = toSave
          console.log(req.session.user)
          rv.res = req.session.user
        }
        res.status(200).send(JSON.stringify(rv));
      })
      .catch((err) => {
        console.log(err.stack)
        res.status(200).send(JSON.stringify(rv));
      });
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send();
    });
  } else {
    res.status(403).send();
  }
})

router.get('/getartists', (req, res, next) => {
  if (req.session.user) {
    let Artists = req.db.collection('artists');
    Artists.find({user_id: req.session.user._id.toString()})
    .then((result) => {
      let rv = {
        artists: []
      }
      if (result) {
        rv.artists = result;
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send(JSON.stringify({err: err.stack}));
    });
  } else {
    res.status(404).send();
  }
});

router.get('/getvenues', (req, res, next) => {
  if (req.session.user) {
    let Venues = req.db.collection('venues');
    Venues.find({user_id: req.session.user._id.toString()})
    .then((result) => {
      let rv = {
        venues: []
      }
      if (result) {
        rv.venues = result;
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send(JSON.stringify({err: err.stack}));
    });
  } else {
    res.status(404).send();
  }
});

router.post('/saveavail', (req, res, next) => {
    console.log(req.body);
  if (/*req.session.user && */typeof req.body.blackout !== 'undefined' && typeof req.body.avail !== 'undefined' && req.body.refid) {
    let toSave = {
      ref_id: req.body.refid,
      blackout: req.body.blackout,
      available: req.body.avail
    }
    let Avail = req.db.collection('avail');
    Avail.update({ref_id: req.body.refid}, toSave, { upsert: true})
    .then((result) => {
      let rv = {
        ok: 1,
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send(JSON.stringify({msg: err.stack}));
    });
  } else {
    res.status(403).send();
  }
});

router.get('/getavail', (req, res, next) => {
  if (req.session.user && req.query.refid) {
    let Avail = req.db.collection('avail');
    Avail.findOne({ref_id: req.query.refid})
    .then((result) => {
      let rv = {
        blackout: [],
        available: []
      };
      if (result) {
        rv.blackout = result.blackout,
        rv.available = result.available
      }
      res.status(200).send(JSON.stringify(rv));
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send(JSON.stringify({msg: err.stack}));
    });
  } else {
    res.status(404).send();
  }
});

router.get('/rgl', (req, res, next) => {
  if (req.query.lat && req.query.lon) {
    Zips = req.db.collection('zips');
    let lat = parseFloat(req.query.lat);
    let lon = parseFloat(req.query.lon);
    Zips.findOne({location: {$nearSphere: { $geometry: { type:"Point", coordinates: [lon, lat]}}}})
    .then((result) => {
      if (result) {
        res.status(200).send(JSON.stringify({ok: 1, msg: result}));
      } else {
        res.status(200).send(JSON.stringify({ok: 0, msg: 'nonefound'}));
      }
    })
    .catch((err) => {
      console.log(err.stack);
    });
  } else {
    res.status(404).send();
  }
});

router.get('/getnearestvenues', (req, res, next) => {
  if (req.session.user && req.session.user.hasFan) {
      let toSend = {
        found: 0,
        zip: req.session.user.fan.zip,
        radius: req.session.user.fan.radius
      }
      if (req.session.user.fan.location && req.session.user.fan.radius) {
        getNearestVenues(req.db, req.session.user.fan.location, req.session.user.fan.radius)
        .then((result) => {
          toSend.venues = result;
          res.status(200).send(JSON.stringify(toSend));
        })
        .catch((err) => {
          console.log(err);
          res.status(500).send();
        });
      } else {
        res.status(403).send();
      }
  } else {
    res.status(404).send();
  }
});

router.get('/searchartists', (req, res, next) => {
  if (req.query.artist) {
    let Artists = req.artistsdb.collection('artists');
    let pipeline = [
      {
        "$match": {
          "$text": {
            "$search": '"'+req.query.artist+'"'
          }
        }
      },
      {
        "$sort": { "score" : { "$meta": "textScore" }}
      },
      {
        "$limit": 20
      }
    ];
    Artists.aggregate(pipeline)
    .then((result) => {
      res.status(200).send(JSON.stringify(result));
    })
    .catch((err) => {
    });
  } else {
    res.status(404).send()
  }

})

router.post('/want', (req, res, next) => {
  if (req.body.artist) {
    Wants = req.db.collection('wants');
    delete req.body.artist.images.image['$'];
    let toSave = {
      artist: req.body.artist,
      user: req.session.user,
      active: 1,
      ts: new Date()
    }
    Wants.update({'user._id': new ObjectId(req.session.user._id), 'artist._id': new ObjectId(req.body.artist._id)}, toSave, { upsert: true})
    .then((result) => {
      res.status(200).send(JSON.stringify(result));
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send();
    });
  } else {
    res.status(404).send();
  }
})

const getWants = (db, user_id) => {
  return new Promise((resolve, reject) => {
    let Wants = db.collection('wants');
    Wants.find(
      {
        'user._id': user_id
      }
    )
    .then((result) => {
      resolve(result);
    })
    .catch((err) => {
      reject(err);
    })
  })
}

const getNearbyWants = (db, artist_id, fan, idx) => {
  return new Promise((resolve, reject) => {
    let Wants = db.collection('wants');
    Wants.find(
      {
        'artist._id': new ObjectId(artist_id),
        'user.fan.location': {
          $nearSphere: {
            $geometry: fan.location,
            $maxDistance: fan.radius * 2 * 1609.34
          }
        }
      }
    )
    .then((result) => {
      result.idx = idx;
      resolve(result);
    })
    .catch((err) => {
      reject(err);
    })
  })
}

router.get('/getwants', (req, res, next) => {
  if (typeof req.session.user.fan !== 'undefined') {
    getWants(req.db, req.session.user._id)
    .then((result) => {
      let i=0;
      result.map((want, idx) => {
        getClusters(req.db, want.artist._id)
        .then((clusters) => {
          result[idx].clusters = clusters;
          i++;
          if (i === result.length) {
            res.status(200).send(JSON.stringify(result));
          }
        })
        .catch((err) => {
          console.log(err.stack);
          res.status(500).send();
        })
      })
    })
    .catch((err) => {
      console.log(err.stack);
      res.status(500).send();
    });
  } else {
    res.status(403).send();
  }
})

module.exports = router;
