var express = require('express');
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var app = express();
var bodyParser = require('body-parser');
var session = require('cookie-session');
var mongourl = 'mongodb://noctis:123456@ds141434.mlab.com:41434/noctisyeung';
var ObjectId = require('mongodb').ObjectID;
var upload = require("express-fileupload");
var loginCookie; //variable for cookie-session
var errFlag = '';
var showReg = 0;

//The below part is setting up the requirement

app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public")); // mkdir for css file
app.use(bodyParser.json());  //Get query from the form
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(session({ //setting up the session
    name: 'session',
    keys: ['This is the key','You can not see this','No one see me'], //This is secret key for cookie
    maxAge: 500 * 1000 //setting up the time limit of cookie (ms)
   }));
app.use(upload({
}));

////The below part is using to handling the get method

app.get('/login',  function(req, res, next) { //For login page use
res.render("login", {flag: errFlag, showReg: showReg});
showReg = 0;
errFlag = '';
});

app.get('/doLogout', function(req,res) {
    req.session = null;  // clear all session data
    res.redirect('/');
  })

app.get('/main',  function(req, res, next) { //For main page use
    loginCookie = req.session;
    var userid = loginCookie.userid;
    var key = null;
    var criteria ={}
    var query = req.query
    var condition = 'main'; //default condition for controling the search restaurants
    //checking and intializing
    if (query.name)
        criteria['name'] = query.name;
    if (query.borough)
        criteria['borough'] = query.borough;
    if (query.cuisine)
        criteria['cuisine'] = query.cuisine;
    if (query.street)
        criteria["address.street"] = query.street;
    if (query.zipcode)
        criteria["address.zipcode"] = query.zipcode;
    if (query.building)
        criteria["address.building"] = query.building;
    if (query.lon)
        criteria["address.coord.0"] = query.lon;
    if (query.lat)
        criteria["address.coord.1"] = query.lat;
    //allow or search
    if (query.or == 'true'){
        console.log(typeof(criteria));
        criteria = JSON.stringify(criteria).replace(',','},{');
        criteria = JSON.parse('['+criteria+']');
        condition = 'mainor'
    }
    if(loginCookie.userid){ //check is it still login
        MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err,null);
            console.log('Connected to MongoDB\n');
            dofindapi(db,"getapi",userid,function(result1){
                console.log('first /api function disconnected to MongoDB\n');
                key = result1.api;
            });
            findRestaurant(db,condition,criteria,function(result2){ //fetching data in DB
            db.close();
            console.log('sec /main disconnected to MongoDB\n');
            if (result2.length == 0){
                res.status(500);
                return res.render("main",{content: 'Welcome ' + loginCookie.userid,restaurants: {},apikey:key});
            }
            else{
                //console.log(result);//testing use 
                res.status(200);
                return res.render("main",{content: 'Welcome ' + loginCookie.userid,restaurants: result2,apikey:key});
            }
        });
        });
    }
    else{
    res.status(403);
    return res.redirect('/login');}
    });

app.get('/', function(req,res,next) { //Redirect the user to login page
    loginCookie = req.session;
    if(loginCookie.userid){ //check is it still login, if logged in and not timeout go to the main page
    res.status(200);
    return res.redirect('/main')}
    else{
    res.status(403);
    return res.redirect('/login');}
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
                    // testing use console.log(doc);
                    res.status(200);
                    return res.render("change",{title: {vaild:"Change New Restaurant"},restaurant: doc});
                }
            });
            });
        }
        else{
        res.status(403);
        return res.redirect('/login');}
        });

//The below part is using to handling the post method

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
            res.status(200);
            return res.redirect('/display?id='+req.body._id);
            });
        });
    }
    else{
        res.status(403);
        return res.redirect('/login');}
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
                    res.status(200);
                    return res.render("display",{restaurant: doc,rated:false});
                }else{
                //console.log(doc);//testing use 
                res.status(200);
                return res.render("display",{restaurant: doc,rated:true});
                }
            }
        });
        });
    }
    else{
    res.status(403);
    return res.redirect('/login');}
    });

app.get('/gmap', function(req,res,next){ // Handling the google map function
    loginCookie = req.session;
    if (loginCookie.userid){
    res.status(200);
    res.render("gmap.ejs", {
        lat:req.query.lat,
        lon:req.query.lon,
        title:req.query.title
    });
    res.end();
    }
    else {//If not logged in or timeout, redirect to login
    res.status(403);
    return res.redirect('/login');}
});


app.get('/api/restaurant/read/*/*',function(req,res, next){ //search api handle
    var type = req.params[0];               //getting the incomeing type form URL
    var value = req.params[1];   //getting the incomeing value form URL
    var condition = {};
    switch(type){
        case 'name':
        condition['name'] = value;
        break;
        case 'borough':
        condition['borough'] = value;
        break;
        case 'cuisine':
        condition['cuisine'] = value;
        break;
        default:
        return res.send({});
    }
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err,null);
        console.log('/api doSearch Connected to MongoDB\n');
        findRestaurant(db,'api',condition,function(result){
            console.log('/api doSearch disConnected to MongoDB\n');
            return res.send(result);
        });
});
});


app.get('/doSearch',function(req,res, next){ //Additional Search function
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
        findRestaurant(db,'main',condition,function(result){ //searching the database
        db.close();
        console.log('/doSearch disconnected to MongoDB\n');
        if (result.length == 0||result == undefined){
            res.status(500);
            res.render('searchResult',{message: 'No result',restaurants: {}});
        }
        else{
            res.status(200);
            res.render('searchResult',{message: 'Found '+result.length+' result',restaurants: result});
        }
    });
    });}
    else{
    res.status(500);
    res.render('searchResult',{message: 'Please Enter Something......',restaurants: {}});
    res.end();}
}
    else{
    res.status(403);
    return res.redirect('/login');}
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
                res.status(200);
                return res.render("delete",{title: {vaild:"Delete"},restaurant: doc});
            }
        });
        });
    }
    else{
    res.status(403);
    return res.redirect('/login');}
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
            res.status(200);
            return res.render("delete",{title: {vaild:"Deleted"}});
            });
        });
    }
    else{
        res.status(403);
        return res.redirect('/login');}
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
        doupdate(db,'rest',criteria,restaurant,function(result){//pass the value and call the update function , callback
            db.close();
            console.log('/main disconnected to MongoDB\n');
            console.log("update finish");
            res.status(200);
            return res.render("change",{title: {vaild:"updated"}});
            });
        });
    }
    else{
        res.status(403);
        return res.redirect('/login');}
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
                restid = ObjectId(result.ops[0]._id).toString();    //ObjectId to String for adding restaurant id
                objid= result.ops[0]._id;   // get the object id
                doupdate(db,'rest',{_id:objid},{restaurantid:restid},function(result2){//pass the value and call the update function , callback
                db.close();
                console.log('/added restid\n');
                console.log('/doupdate disconnected to MongoDB add restid\n');
                res.status(200);
                return res.redirect('/display?id='+objid);
            });
        });
    });}
    else{
        res.status('403'); //Define server status
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
        res.status(403);
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
                    checkUser = false;
                }
            }
        if (checkUser == false){
            db.close();
            errFlag = 'existerr';
            showReg = 1;
            res.status(403);
            return res.redirect('/login');
        }
        else{
            addUser(db,new_user,function(result){
            errFlag = '';
            showReg = 0;
            console.log('/adding apikey!!\n');
            apikey = ObjectId(result.ops[0]._id).toString();    //ObjectId to String for adding restaurant id
            objid= result.ops[0]._id;   // get the object id
            doupdate(db,'api',{_id:objid},{api:apikey},function(result2){//pass the value and call the update function , callback
            db.close();
            console.log('/added apikey\n');
            console.log('/doupdate disconnected to MongoDB add api\n');
            loginCookie.userid = new_user['userid']; //if register sucess redirect to main screen
            res.status(200);
            return res.redirect('/main');
            });
        });
        }
    });
    });
}
});

app.post('/api/restaurant/create',function(req,res, next){
    var criteria ={};
    criteria['api'] = req.body.api;
    var restaurant = {};
    var address = {};
    var objid = null;
    MongoClient.connect(mongourl, function(err, db) {//connect with mongo
        assert.equal(err,null);
        console.log('/api/restaurant/create Connected to MongoDB for checking api\n');
        dofindapi(db,"matchapi",criteria,function(result){//pass the value and call the update function , callback
            db.close();
            console.log('/api/restaurant/create checking api disconnected to MongoDB\n');
            if(result == null || req.body.name == null ){
                console.log('No matched APIKEY!!');
                res.send({status: "failed"});}

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
                        restid = ObjectId(result.ops[0]._id).toString();    //ObjectId to String for adding restaurant id
                        objid= result.ops[0]._id;   // get the object id
                        console.log("/api/restaurant/create "+ objid);
                        doupdate(db,'rest',{_id:objid},{restaurantid:restid},function(result2){//pass the value and call the update function , callback
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


//The below part is using for handling function to database

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

function findRestaurant(db,type,criteria,callback){ //This function is using to findRestaurant
    var result = [];
    if(type == 'api'){
        cursor = db.collection('ownerRestaurants').find(criteria);
        cursor.each(function(err,doc){
        assert.equal(err,null);
        if(doc!=null){
            result.push(doc);
        }
        else{
            callback(result);
        }
        });
    }
    else if (type == 'main'){
    cursor = db.collection('ownerRestaurants').find(criteria,{name: 1}); //normal search
    cursor.each(function(err,doc){
    assert.equal(err,null);
    if(doc!=null){
        result.push(doc);
    }
    else{
        callback(result);
    }
    });
}
    else if (type == 'mainor'){
        cursor = db.collection('ownerRestaurants').find({$or: criteria},{name: 1}); // search in $or operation
        cursor.each(function(err,doc){
        if(doc!=null){
            result.push(doc);
        }
        else{
            callback(result);
        }
        });
    };
}

function doupdate(db,type,criteria,newdata,callback){
    if(type == 'api'){
    db.collection('owner').updateOne(
		criteria,{$set: newdata},function(err,result) {
			assert.equal(err,null);
            console.log("update was successfully");
            
			callback(result);
    });
    }if(type == 'rest'){
        db.collection('ownerRestaurants').updateOne(
            criteria,{$set: newdata},function(err,result) {
                assert.equal(err,null);
                console.log("update was successfully");
                callback(result);
        });
    }

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

app.use(function(req, res, next) { // This use method need to place at the bottom
    res.status(404);
    res.send('404: Page Not Found');
});

app.listen(process.env.PORT || 8099);