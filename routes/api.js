var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;
var fs = require('fs');
var gm = require('gm');
var parser = require('parse-address');

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
  if (req.body.email && req.body.pw) {
    toSave = {
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
      let rv = {
        ok: 0,
        msg: err.stack
      }
      res.status(403).send(JSON.stringify(rv));
    });
  } else {
    let rv = {
      'ok': 0
    }
    res.status(200).send(JSON.stringify(rv));
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
  if (toSave && req.session.user) {
    toSave.user_id = req.session.user._id.toString();
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
    if (req.body.parsed.number && req.body.parsed.street) {
      let Geo = req.geodb.collection('usa.ca');
      Geo.find({number: req.body.parsed.number, $text: {$search: req.body.parsed.street}, zip: req.body.zip})
      .then((result) => {
        if (result) {
          res.status(200).send(JSON.Stringify(result));
        }
      })
      .catch((err) => {
        console.log(err.stack);
      })
    }

    Venues = req.db.collection('venues');
    Venues.insert(toSave)
    .then((result) => {
      if (result._id) {
        rv.ok = 1;
        req.session.user.hasVenue = true;
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
  if (toSave && req.session.user) {
    toSave.user_id = req.session.user._id.toString();
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
        rv.ok = 1;
        req.session.user.hasArtist = true;
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

router.post('/savefan', (req, res, next) => {
  let toSave = req.body;
  let rv = {
    ok: 0
  };
  if (req.session.user && toSave && toSave.zip) {
    Fans = req.db.collection('fans');
    toSave.ts = new Date;
    toSave.user_id = req.session.user._id.toString();
    getCoordsByZip(req.db,toSave.zip)
    .then((location) => {
      toSave.location = location;
      Fans.update({user_id: req.session.user._id.toString()}, toSave, {upsert: true})
      .then((result) => {
        if (result.n) {
          rv.ok = 1;
          req.session.user.hasFan = true;
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
  if (req.session.user && typeof req.body.blackout !== 'undefined' && typeof req.body.avail !== 'undefined' && req.body.refid) {
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

router.get('/getfan', (req, res, next) => {
  if (req.session.user && req.session.user.hasFan) {
    Fans = req.db.collection('fans');
    Fans.findOne({user_id: req.session.user._id.toString()})
    .then((result) => {
      let toSend = {
        found: 0,
        zip: '00000',
        radius: 0
      }
      if (result._id) {
        toSend.found = 1;
        toSend.zip = result.zip;
        toSend.radius = result.radius
      }
      if (result.location) {
        getNearestVenues(req.db, result.location, result.radius)
        .then((result) => {
          toSend.venues = result;
          res.status(200).send(JSON.stringify(toSend));
        })
        .catch((err) => {
          console.log(err);
          res.status(500).send();
        });
      } else {
        res.status(200).send(JSON.stringify(toSend));
      }
    })
    .catch((err) => {
      res.status(200).send(JSONStringify({msg: err.stack}));
    })
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

module.exports = router;
