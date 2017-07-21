var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;
var fs = require('fs');
var gm = require('gm');

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
          rv.user = result;
          req.session.user = result;
          console.log(req.session.user);
        }
        res.status(200).send(JSON.stringify(rv));
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
    let Users = req.db.collection('users');
    Users.insert({email: req.body.email, password: req.body.pw, ts: new Date(), verified: 0})
    .then((result) => {
      if (result._id) {
        let rv = {
          ok: 1,
          user: {
            email: req.body.email,
            _id: result._id,
          }
        }
        req.session.user = {
          email: req.body.email
        }
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
    Venues = req.db.collection('venues');
    toSave.ts = new Date();
    toSave.verified = false;
    Venues.insert(toSave)
    .then((result) => {
      if (result._id) {
        rv.ok = 1;
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

module.exports = router;
