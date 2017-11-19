var express = require('express');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var app = express();
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongourl = 'mongodb://noctis:123456@ds141434.mlab.com:41434/noctisyeung';
var ObjectId = require('mongodb').ObjectID;
var upload = require("express-fileupload");
var loginCookie; //variable for cookie-session
var errFlag = '';
var showReg = 0;

app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public")); // mkdir for css file
app.use(bodyParser.json());  //Get query from the form
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(cookieParser('sessiontest')); //setting up the cookie
app.use(session({ //setting up the session
    secret: 'sessiontest',
    resave: true,
    saveUninitialized: false,
    cookie: {
        maxAge: 500 * 1000 //setting up the time limit of cookie (ms)
    }
   }));
app.use(upload());

app.get('/login',  function(req, res, next) { //For login page use
res.render("login", {flag: errFlag, showReg: showReg});
showReg = 0;
errFlag = '';
});

app.get('/main',  function(req, res, next) { //For main page use
    loginCookie = req.session;
    var userid = loginCookie.userid;
    var key = null;
    var criteria ={}
    var query = req.query
    if (query.name||query.borough||query.cuisine){
        for (key in query){
            criteria[key] = query[key];
        }
    }
    console.log(criteria);
    if(loginCookie.userid){ //check is it still login
        MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err,null);
            console.log('Connected to MongoDB\n');
            dofindapi(db,"getapi",userid,function(result1){
                console.log('first /api function disconnected to MongoDB\n');
                key = result1._id;
            });
            findRestaurant(db,criteria,function(result2){ //fetching data in DB
            db.close();
            console.log('sec /main disconnected to MongoDB\n');
            if (result2.length == 0){
                res.status(500);
                return res.render("main",{content: 'Welcome ' + loginCookie.userid,restaurants: {}});
            }
            else{
                //console.log(result);//testing use 
                return res.render("main",{content: 'Welcome ' + loginCookie.userid,restaurants: result2,apikey:key});
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
    return res.redirect('/main')
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
                    console.log(doc);
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
    if(loginCookie.userid){ //check is it still login
        var criteria = {};
        criteria['_id'] = ObjectId(req.body._id);
        var restaurant = {};//store the input
        var address = {};
        //This section is using to check the value in create form and innitial it to restaurant---------
        restaurant['name'] = req.body.name;
        if (req.body.borough)
            restaurant['borough'] = req.body.borough;
        if (req.body.cuisine)
            restaurant['cuisine'] = req.body.cuisine;
        if (req.body.street||req.body.building||req.body.zipcode){
            if (req.body.street)
                address['street'] = req.body.street;
            if (req.body.building)
                address['building'] = req.body.building;
            if (req.body.street)
                address['zipcode'] = req.body.zipcode;
            if (req.body.lon&&req.body.lat){
                var gps = [];
                gps[0] = req.body.lon;
                gps[1] = req.body.lat;
                address['coord'] = gps;}
            restaurant['address'] = address;  
        }
        else
            restaurant['address'] = address; //return if empty
        if (req.files.filetoupload){ // This is checking the photo
            restaurant['photo'] = req.files.filetoupload.data.toString('base64'); //change the photo to base64 and innitial it to photo
            restaurant['photo mimetype'] = req.files.filetoupload.mimetype; //get the mimetype
        }
        MongoClient.connect(mongourl, function(err, db) {//connect with mongo
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        doupdate(db,criteria,restaurant,function(result){//pass the value and call the update function , callback
            db.close();
            console.log('/main disconnected to MongoDB\n');
            console.log("update finish");
            return res.render("change",{title: {vaild:"updated"}});
            });
        });
    }
    else
        return res.redirect('/login');
});

app.post('/rate', function(req,res,next) { //edit button handler in the change page
    loginCookie = req.session;
    if(loginCookie.userid){ //check is it still login
        var criteria = {};
        criteria['_id'] = ObjectId(req.body._id);
        console.log("score:"+req.body.score);
        var score ={user : loginCookie.userid,score:req.body.score};
        //This section is using to check the value in create form and innitial it to restaurant---------
        MongoClient.connect(mongourl, function(err, db) {//connect with mongo
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        dorate(db,criteria,score,function(result){//pass the value and call the update function , callback
            db.close();
            console.log('/rate disconnected to MongoDB\n');
            console.log("rate finish");
            return res.redirect('/display?id='+req.body._id);
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
                var rated = false;
                for(var key in doc.rate){
                    if(doc.rate[key].user == loginCookie.userid)
                        rated = true;
                    }
                if(doc.rate == null  || rated == false){
                    console.log(doc);
                    return res.render("display",{restaurant: doc,rated:false});
                }else{
                //console.log(doc);//testing use 
                return res.render("display",{restaurant: doc,rated:true});
                }
            }
        });
        });
    }
    else
    return res.redirect('/login');
    });

app.get('/gmap', function(req,res,next){ // Handling the google map function
    loginCookie = req.session;
    if (loginCookie.userid){
    res.render("gmap.ejs", {
        lat:req.query.lat,
        lon:req.query.lon,
        title:req.query.title
    });
    res.end();
    }
    else //If not logged in or timeout, redirect to login
    return res.redirect('/login');
});

app.get('/doSearch',function(req,res, next){ //Search function
    var condition = {};
    loginCookie = req.session;
    if(loginCookie.userid){
    if(req.query.keyword){
    req.query.keyword = req.query.keyword.replace(/ /g ,'"\s"');
    console.log(req.query.keyword);
    switch(req.query.option){
        case 'borough':
            condition['borough'] =  new RegExp(req.query.keyword,'i');
            break;
        case 'cuisine':
            condition['cuisine'] = new RegExp(req.query.keyword,'i');
            break;
        default:
            condition['name'] = new RegExp(req.query.keyword,'i');
            console.log('OK2');
            break;
    }
    console.log(condition);
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('/doSearch Connected to MongoDB\n');
        findRestaurant(db,condition,function(result){ //searching the database
        db.close();
        console.log('/doSearch disconnected to MongoDB\n');
        if (result.length == 0||result == undefined){
            console.log(result);
            res.render('searchResult',{message: 'No result',restaurants: {}});
        }
        else{
            console.log(result);
            res.render('searchResult',{message: 'Found '+result.length+' result',restaurants: result});
        }
    });
    });}
    else{
    res.status(500);
    res.render('searchResult',{message: 'Please Enter Something......',restaurants: {}});
    res.end();}
}
    else
    return res.redirect('/login');
});


app.post('/doCreateRestaurants', function(req, res, next){ //This function is handling the create restaurant action
    var restaurant = {};
    var address = {};
    //This section is using to check the value in create form and innitial it to restaurant---------
    loginCookie = req.session;
    if (loginCookie.userid){
    restaurant['name'] = req.body.name;
    if (req.body.borough)
        restaurant['borough'] = req.body.borough;
    if (req.body.cuisine)
        restaurant['cuisine'] = req.body.cuisine;
    if (req.body.street||req.body.building||req.body.zipcode){
        if (req.body.street)
            address['street'] = req.body.street;
        if (req.body.building)
            address['building'] = req.body.building;
        if (req.body.street)
            address['zipcode'] = req.body.zipcode;
        if (req.body.coordLon&&req.body.coordLat){
            var gps = [];
            gps[0] = req.body.coordLon;
            gps[1] = req.body.coordLat;
            address['coord'] = gps;}
        restaurant['address'] = address;  
    }
    else
        restaurant['address'] = address; //return if empty
    if (req.files.filetoupload){ // This is checking the photo
        restaurant['photo'] = req.files.filetoupload.data.toString('base64'); //change the photo to base64 and innitial it to photo
        restaurant['photo mimetype'] = req.files.filetoupload.mimetype; //get the mimetype
    }
    restaurant['owner'] = req.body.userid;
    //This section is using to check the value in create form and innitial it to restaurant---------
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('/doCreateRestaurants Connected to MongoDB\n');
        addRestaurant(db,restaurant,function(result){
            console.log('/docreate disConnected to MongoDB add data\n');
                objid = result.ops[0]._id;
                doupdate(db,{_id:objid},{restaurantid:objid},function(result2){//pass the value and call the update function , callback
                db.close();
                console.log('/added restid\n');
                console.log('/doupdate disconnected to MongoDB add restid\n');
                return res.redirect('/display?id='+objid);
            });
        });
    });}
    else{
        res.status('500'); //Define server status
        return res.redirect('/login');
    }
});

app.post('/doRegister', function(req, res, next){ //This function is handling the register action (*Not finsihed the error handling)
    loginCookie = req.session;
    var checkUser = true;
    var new_user = {};
    if (req.body.userid)
        new_user['userid'] = req.body.userid;
    if (req.body.password && (req.body.password==req.body.repassword)) //check the input and initialize it to a json
        new_user['password'] = req.body.password;
    else{
        errFlag = 'notsame';
        showReg = 1;
        return res.redirect('/login');}
    if(new_user['password']&& new_user['userid']&&(req.body.password==req.body.repassword)){
        errFlag = '';
        showReg = 0;
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('Connected to MongoDB\n');
        dofindapi(db,'finduser',{}, function(userresult){ // check existing user ?show message: pass
            for (var i=0;i<userresult.length;i++){
                if (new_user['userid'] == userresult[i].userid){
                    console.log('in');
                    checkUser = false;
                }
            }
        if (checkUser == false){
            console.log('in2');
            db.close();
            errFlag = 'existerr';
            showReg = 1;
            return res.redirect('/login');
        }
        else{
            addUser(db,new_user,function(result){
            db.close();
            errFlag = '';
            showReg = 0;
            loginCookie.userid = new_user['userid']; //if register sucess redirect to main screen
            return res.redirect('/main')
        });
        }
    });
    });
}
});

app.post('/api/restaurant/create',function(req,res, next){
    var criteria ={};
    criteria['_id'] = ObjectId(req.body.api);
    var restaurant = {};
    var address = {};
    var objid = null;
    MongoClient.connect(mongourl, function(err, db) {//connect with mongo
        assert.equal(err,null);
        console.log('/api/restaurant/create Connected to MongoDB for checking api\n');
        dofindapi(db,"matchapi",criteria,function(result){//pass the value and call the update function , callback
            db.close();
            console.log('/api/restaurant/create checking api disconnected to MongoDB\n');
            if(result == null || req.body.name == null )
            res.send({status: "failed"});
            else{
                restaurant['name'] = req.body.name;
            if (req.body.borough)
                restaurant['borough'] = req.body.borough;
            if (req.body.cuisine)
                restaurant['cuisine'] = req.body.cuisine;
            if (req.body.street||req.body.building||req.body.zipcode){
                if (req.body.street)
                    address['street'] = req.body.street;
                if (req.body.building)
                    address['building'] = req.body.building;
                if (req.body.street)
                    address['zipcode'] = req.body.zipcode;
                if (req.body.coordLon&&req.body.coordLat){
                    var gps = [];
                    gps[0] = req.body.coordLon;
                    gps[1] = req.body.coordLat;
                    address['coord'] = gps;}
                restaurant['address'] = address;  
            }
            else
                restaurant['address'] = address; //return if empty
                restaurant['owner'] = result.userid;
                /*if (req.files.filetoupload){ // This is checking the photo
                    restaurant['photo'] = req.files.filetoupload.data.toString('base64'); //change the photo to base64 and innitial it to photo
                    restaurant['photo mimetype'] = req.files.filetoupload.mimetype; //get the mimetype
                }*/
                MongoClient.connect(mongourl, function(err, db) {
                    assert.equal(err,null);
                    console.log('/api/restaurant/create Connected to MongoDB add data\n');
                    addRestaurant(db,restaurant,function(result){
                    console.log('/api/restaurant/create disConnected to MongoDB add data\n');
                        objid = result.ops[0]._id;
                        console.log("/api/restaurant/create "+ objid);
                        doupdate(db,{_id:objid},{restaurantid:objid},function(result2){//pass the value and call the update function , callback
                        db.close();
                        console.log('/added restid\n');
                        console.log('/doupdate disconnected to MongoDB add restid\n');
                        res.send({status: "ok", _id: objid});  
                    });
                });
            });
        };

    });
    });
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
        //console.log('test2'); //testing use
        errFlag = 'passerr';
        res.status('402');
        return res.redirect('/login'); //flag is not using right now
        }}
        else{
        errFlag = 'usererr';
        res.status('402');
        return res.redirect('/login');}
    });
    });
});

app.use(function(req, res, next) {
    res.status(404);
    res.send('404: Page Not Found');
});

function addUser(db,new_user,callback){ //This function is using with /doRegister doing insert
    db.collection('owner').insert(new_user,function(err,result){
    assert.equal(err,null);
    console.log('User Created');
    callback(result);
    });
};

function addRestaurant(db,restaurant,callback){ //This function is using with /doCreateRestaurant doing insert
    db.collection('ownerRestaurants').insert(restaurant,function(err,result){
    assert.equal(err,null);
    console.log('Restaurant Created!!!');
    callback(result);
    });
}

function dofindapi(db,type,criteria,callback){ //This function is using to findRestaurant
    var result = [];
    if (type == "matchapi"){
        console.log('matching api!!!');
        cursor = db.collection('owner').findOne(criteria,function(err,result){
            assert.equal(err,null);
            callback(result);
        }); 
    }
    if (type == "getapi"){ //find api key
    console.log('finding api!!!');
    cursor = db.collection('owner').findOne({'userid': criteria},function(err,result){
        assert.equal(err,null);
        console.log(result);
        callback(result);
    }); 
    }
    if (type == "finduser"){ //find api key //check user function
        console.log('finding user!!!');
        cursor = db.collection('owner').find(criteria,{'userid': 1});
        cursor.each(function(err,doc){
            if(doc!=null){
                result.push(doc);
            }
            else{
                callback(result);
            }
        }); 
        }
};

function findRestaurant(db,criteria,callback){ //This function is using to findRestaurant
    var result = [];
    cursor = db.collection('ownerRestaurants').find(criteria,{name: 1});
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

function dorate(db,criteria,score,callback){
    db.collection('ownerRestaurants').updateOne(
		criteria,{$push:{rate: score}},function(err,result) {
			assert.equal(err,null);
			console.log("rate was successfully");
			callback(result);
	});
};


app.listen(process.env.PORT || 8099);