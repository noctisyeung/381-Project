var express = require('express');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var app = express();
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongourl = 'mongodb://noctis:123456@ds141434.mlab.com:41434/noctisyeung';
var ObjectId = require('mongodb').ObjectID;
var ExifImage = require('exif').ExifImage;
var formidable = require('formidable');
var loginCookie; //variable for cookie-session

app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public")); // mkdir for css file
app.use(bodyParser.json());  //Get query from the form
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(cookieParser('sessiontest')); //setting up the cookie
app.use(session({ //setting up the session
    secret: 'sessiontest',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 60 * 1000 //setting up the time limit of cookie (ms)
    }
   }));

app.get('/login',  function(req, res, next) { //For login page use
res.render("login");
});

app.get('/main',  function(req, res, next) { //For main page use
    loginCookie = req.session;
    if(loginCookie.userid){ //check is it still login
        MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err,null);
            console.log('Connected to MongoDB\n');
            findRestaurant(db,loginCookie.userid,function(result){ //fetching data in DB
            db.close();
            console.log('/main disconnected to MongoDB\n');
            if (result.length == 0){
                res.status(500);
                return res.render("main",{content: 'Welcome ' + loginCookie.userid,restaurants: {}});
            }
            else{
                //console.log(result);//testing use 
                return res.render("main",{content: 'Welcome ' + loginCookie.userid,restaurants: result});
            }
        });
        });
    }
    else
    return res.redirect('/login');
    });

app.get('/', function(req,res,next) { //Redirect the user to login page
    loginCookie = req.session;
    if(loginCookie.userid) //check is it still login, if logged in and not timeout go to the main page
    return res.redirct('/main')
    else
    return res.redirect('/login');
    });

app.get('/createRestaurant', function(req,res,next) { //Get the createRestaurants Page
    loginCookie = req.session;
    if(loginCookie.userid) //check is it still login
    return res.render('createRestaurant',{userid: loginCookie.userid});
    else
    return res.redirect('/login');
    });

app.get('/change', function(req,res,next) { //edit button handler in the display page
        loginCookie = req.session;
        var id = req.query.id;
        if(loginCookie.userid){ //check is it still login
            MongoClient.connect(mongourl, function(err, db) {
                assert.equal(err,null);
                console.log('Connected to MongoDB\n');
                db.collection('ownerRestaurants').findOne({'_id':  ObjectId(id)},function(err,doc){ //check owner
                db.close();
                console.log('/main disconnected to MongoDB\n');
                if (doc.owner != loginCookie.userid){// if user not own the data
                    res.status(500);
                    return res.render("change",{title: {vaild:"Error"}});
                }
                else{
                    return res.render("change",{title: {vaild:"Change New Restaurant"},restaurant: doc});
                }
            });
            });
        }
        else
        return res.redirect('/login');
        });

app.post('/change', function(req,res,next) { //edit button handler in the change page
    loginCookie = req.session;
    var id = req.query.id;
    if(loginCookie.userid){ //check is it still login
        var criteria = {};
        var perUpdate = {}; //store the input
        criteria['_id'] = ObjectId(req.body._id);
        perUpdate.address = [];
        perUpdate.address.GPS = [];
        for(var key in req.body){
            if (key != "_id" && req.body[key]) {
            if(key == "street"|| key == "building"|| key == "zipcode"){
                perUpdate.address[key] = req.body[key];
            }
            if(key == "lon"|| key == "lat"){
                perUpdate.address.GPS[key]= req.body[key];
            }else
				perUpdate[key] = req.body[key];
        }
    }
        MongoClient.connect(mongourl, function(err, db) {//connect with mongo
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        doupdate(db,criteria,perUpdate,function(result){//pass the value and call the update function , callback
            db.close();
            console.log('/main disconnected to MongoDB\n');
            console.log("update finish");
            return res.render("display",{restaurant: result});
            });
        });
    }
    else
        return res.redirect('/login');
});

app.get('/remove',function(req,res,next){ //delete button handler in the display page
    loginCookie = req.session;
    var id = req.query.id;
    if(loginCookie.userid){ //check is it still login
        MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err,null);
            console.log('Connected to MongoDB\n');
            db.collection('ownerRestaurants').findOne({'_id':  ObjectId(id)},function(err,doc){ //check owner
            db.close();
            console.log('/main disconnected to MongoDB\n');
            if (doc.owner != loginCookie.userid){// if user not own the data
                res.status(500);
                return res.render("delete",{title: {vaild:"Error"}});
            }
            else{
                return res.render("delete",{title: {vaild:"Delete"},restaurant: doc});
            }
        });
        });
    }
    else
    return res.redirect('/login');
    });

app.post('/remove', function(req,res,next) { //delete button handler in the delete page
        loginCookie = req.session;
        var id = req.query.id;
        if(loginCookie.userid){ //check is it still login
            var criteria = {};
            criteria['_id'] = ObjectId(req.body._id);
            MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err,null);
            console.log('Connected to MongoDB\n');
            dodelete(db,criteria,function(result){
                db.close();
                console.log('/main disconnected to MongoDB\n');
                console.log("delete finish");
                return res.render("delete",{title: {vaild:"Deleted"}});
                });
            });
        }
        else
            return res.redirect('/login');
    });



app.get('/display', function(req,res,next) { 
    loginCookie = req.session;
    var id = req.query.id;
    if(loginCookie.userid){ //check is it still login
        MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err,null);
            console.log('Connected to MongoDB\n');
            db.collection('ownerRestaurants').findOne({'_id':  ObjectId(id)},function(err,doc){ //fetching data in DB
            db.close();
            console.log('/main disconnected to MongoDB\n');
            if (doc == null){
                res.status(500);
                return res.render("display",{restaurant: {}});
            }
            else{
                //console.log(result);//testing use 
                return res.render("display",{restaurant: doc});
            }
        });
        });
    }
    else
    return res.redirect('/login');
    });


app.post('/doRegister', function(req, res, next){ //This function is handling the register action (*Not finsihed the error handling)
    var new_user = {};
    if (req.body.userid)
        new_user['userid'] = req.body.userid;
    if (req.body.password && (req.body.password==req.body.repassword)) //check the input and initialize it to a json
        new_user['password'] = req.body.password;
    else{
        return res.redirect('/login');}
    if(new_user['password']&& new_user['userid']&&(req.body.password==req.body.repassword)){
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log(new_user);
        console.log('Connected to MongoDB\n');
        addUser(db,new_user,function(result){
        db.close();
    });
    });}
});

app.post('/doLogin',function(req,res, next){ //This function is handling the login action
    var user_info = {};
    loginCookie = req.session;
    if (req.body.userid)
        user_info['userid'] = req.body.userid;
    if (req.body.password) //check the input and initialize it to a json
        user_info['password'] = req.body.password;
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        db.collection('owner').findOne({'userid':  user_info['userid']},function(err,doc){ //searching the database
        assert.equal(err,null);
        db.close();
        console.log('doLogin disconnected to MongoDB\n');
        if(doc != null){ //check is the user exist or not?
        if((user_info['userid'] == doc.userid) && (user_info['password'] == doc.password)){ //check the userid and pw is equal to database
        loginCookie.userid = user_info['userid'];
        return res.redirect('/main');
        next();} 
        else{
        console.log('test2');
        return res.render('login', {flag: 1});
        return next();}}
        else{
        return res.send('userid not exist');
        return res.redirect('/login');}
    });
    });
});

function addUser(db,new_user,callback){ //This function is using with /doRegister doing insert
    db.collection('owner').insert(new_user,function(err,result){
    assert.equal(err,null);
    console.log('User Created');
    callback(result);
    });
};

function findRestaurant(db,userid,callback){ //This function is using with /doRegister doing insert
    var result = [];
    cursor = db.collection('ownerRestaurants').find({'owner': userid});
    cursor.each(function(err,doc){
    assert.equal(err,null);
    if(doc!=null){
        result.push(doc);
    }
    else{
        callback(result);
    }
    });
};

function doupdate(db,criteria,newdata,callback){
    db.collection('ownerRestaurants').updateOne(
		criteria,{$set: newdata},function(err,result) {
			assert.equal(err,null);
			console.log("update was successfully");
			callback(result);
	});
};
function dodelete(db,criteria,callback) {
	db.collection('ownerRestaurants').deleteMany(criteria,function(err,result) {
		assert.equal(err,null);
		console.log("Delete was successfully");
		callback(result);
    });
};

app.listen(process.env.PORT || 8099);