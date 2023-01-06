const express = require("express");
const app = express();
const server = require('http').Server(app);
const session = require('express-session');
const bodyParser = require('body-parser');

const { Server } = require("socket.io");

const io = new Server(server);

app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

const ipAdress = "localhost";
const port = 3000;

var teamId = 0;

var teams = {};
var teamsPrev = {};
var sockets = {};

var teamsCount = 0;

var teamsNames = [];

var statePanel = "reg";

var reloadedFirst = false;


const url = require('url');

app.get('/', function(req, res) {
    res.render(__dirname + '/client/login.ejs', {error: ""});
});

app.use('/client', express.static(__dirname + '/client'));

server.listen(port, ipAdress);
console.log("Server started.. IP: " + ipAdress + ":" + port);

var Team = function(id, teamName, playerOneName, playerTwoName){
    
    var teamData = {
        teamId: id,
        teamName: teamName,
        playerOneName: playerOneName,
        playerTwoName: playerTwoName
    }

     return teamData;
};

app.post('/panel', (req, res) => {
    const usernameInput = req.body.username;
    const passwordInput = req.body.password;

    const usernameAdmin = "admin";
    const passwordAdmin = "admin";

    const usernameUsername = "spectator";
    const passwordUsername = "spectator";

    if(usernameAdmin == usernameInput && passwordAdmin == passwordInput){
        if(statePanel == "reg"){
            res.render(__dirname + '/client/adminReg.ejs');
        }
    } else if(usernameUsername == usernameInput && passwordUsername == passwordInput) {
        if(statePanel == "reg"){
            res.render(__dirname + "/client/spectatorReg.ejs");
        }
    } else{
        res.render(__dirname + '/client/login.ejs', {error: "Špatné údaje!"});
    }

    


});

app.post('/registerTeam', (req, res) =>{
   const teamName = req.body.teamName;
   const playerOneName = req.body.playerOneName;
   const playerTwoName = req.body.playerTwoName;

   res.render(__dirname + '/client/adminReg.ejs');

   if(!teamsNames.includes(teamName)){
        teamId++;
        teamsCount++;
        
        io.sockets.on('connection', function(socket){
            teams[teamId] = Team(teamId, teamName, playerOneName, playerTwoName);

            sockets[teamId] = socket;

            teamsNames[teamId] = teamName;

            sendTeamsData();

            socket.on('removeTeam', function(data){
                delete teams[data];
                teamsCount--;

                for(var i = 0; i < teamsCount; i++){
                    teamsPrev[i] = teams[i];
                }

                teams = teamsPrev;

                sendTeamsData();
            });
        });
    }
});

function sendTeamsData(){
    var pack = [];
    
    for(var i in teams){
        var teamp = teams[i];

            pack.push({
                teamId: teamp.id,
                teamName: teamp.teamName,
                playerOneName: teamp.playerOneName,
                playerTwoName: teamp.playerTwoName
            });

    }        
    
    for(var i in sockets){
        var socketsp = sockets[i];


        socketsp.emit('teamsData', pack);
    }
}


setInterval(function(){

    io.emit('teamsCount', teamsCount);
    
},1000/25);