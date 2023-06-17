const express = require("express");
const app = express();
const server = require('http').Server(app);
const session = require('express-session');
const bodyParser = require('body-parser');

const { Server } = require("socket.io");
const { match } = require("assert");

const io = new Server(server);

app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

const ipAdress = "192.168.1.107";
const port = 3000;

var teamId = 0;

var teamsList = {};
var teamsPrev = {};
var sockets = {};

var matches = [];

var teamsCount = 0;

var teamsNames = [];

var matchId = 1;
var tournamentStartTime;
var maxRoundsGame = 0;

var statePanel = "reg";

var isRunningGame = false;

app.get('/', function(req, res) {
    res.render(__dirname + '/client/login.ejs', {error: ""});
});

app.use('/client', express.static(__dirname + '/client'));

server.listen(port, ipAdress);
console.log("Server started.. IP: " + ipAdress + ":" + port);

function generateMatchesList(numTeams) {
    const teamList = Array.from({ length: numTeams }, (_, i) => i + 1);
    const numMatches = (numTeams - 1) * 2;
    const half = Math.floor(numTeams / 2);
  
    const schedule = [];
    for (let match = 0; match < numMatches; match++) {
      const matches = [];
      for (let i = 0; i < half; i++) {
        const homeTeam = teamList[i];
        const awayTeam = teamList[numTeams - 1 - i];
        matches.push([homeTeam, awayTeam]);
      }
      schedule.push(matches);
  
      // Rotace týmů
      teamList.splice(1, 0, teamList.pop());
    }
  
    // Zaměna druhé poloviny týmů pro sudá kola
    for (let round = 1; round < schedule.length; round += 2) {
      for (let match = 0; match < schedule[round].length; match++) {
        const [homeTeam, awayTeam] = schedule[round][match];
        schedule[round][match] = [awayTeam, homeTeam];
      }
    }
  
    return schedule;
  }

var Team = function(id, teamName, playerOneName, playerTwoName){
    
    var teamData = {
        teamId: id,
        teamName: teamName,
        playerOneName: playerOneName,
        playerTwoName: playerTwoName,
        score: 0
    }

     return teamData;
};

function writeMatchesScore(matches){
    io.emit('writeMatchesScore', matches);
}

function regulateScoreMatch(team, regulation){
    if(regulation === '+'){
        matches[matchId].scores[team]++;
        if(matches[matchId].scores[team] == maxRoundsGame){
            endMatch();
        }
    } else if(regulation === '-'){
        if(matches[matchId].scores[team] > 0){
            matches[matchId].scores[team]--;
        }
    }
}

function endMatch(){
    io.emit('changeMatchSec', "lobby"); //game, lobb    
    if(matches[matchId].scores[0] > matches[matchId].scores[1]){
        teamsList[matches[matchId].teams[0]].score++;
    } else {
        teamsList[matches[matchId].teams[1]].score++;
    }
    sendTeamsData();
    matchId++;
    isRunningGame = false;
    writeMatchesScore(matches);
    if(getMatchNowTeams(matchId) != null){
        io.emit('matchNowTeams', getMatchNowTeams(matchId));
    }
    matches[matchId] = Match(matchId, MatchNowTeams(matchId), [0, 0]);
    io.emit('matchNowInfo', getMatchNowInfo(maxRoundsGame));
}

var Match = function(matchId, teams, scores){
    
    var matchData = {
        matchId: matchId,
        teams: teams,
        scores: scores
    }



    return matchData;
}

var MatchNowTeams = function(matchId){
    let matchesTeams = generateMatchesList(teamsCount);
    
    console.log(matchesTeams);
    return matchesTeams[matchId-1];
}

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
        } else if(statePanel == "lobby"){//--------LoginAgain------------------------------
            res.render(__dirname + '/client/adminLobby/adminLobby.ejs');
        }
        
    } else if(usernameUsername == usernameInput && passwordUsername == passwordInput) {
        if(statePanel == "reg"){
            res.render(__dirname + "/client/spectatorReg.ejs");
        }//--------LoginAgain------------------------------
    } else{
        res.render(__dirname + '/client/login.ejs', {error: "Špatné údaje!"});
    }
});

app.post('/registerTeam', (req, res) =>{
   const teamName = req.body.teamName;
   const playerOneName = req.body.playerOneName;
   const playerTwoName = req.body.playerTwoName;

   if(statePanel == "reg"){
   res.render(__dirname + '/client/adminReg.ejs');

   if(!teamsNames.includes(teamName) && teamName != "" && playerOneName != "" && playerTwoName != ""){
        teamId++;
        teamsCount++;

        io.sockets.on('connection', function(socket){
            teamsList[teamId] = Team(teamId, teamName, playerOneName, playerTwoName);

            sockets[teamId] = socket;

            teamsNames[teamId] = teamName;

            sendTeamsData();

            socket.on('removeTeam', function(data){
                delete teamsList[data];
                teamsCount--;

                for(var i = 0; i < teamsCount; i++){
                    teamsPrev[i] = teamsList[i];
                }

                teamsList = teamsPrev;

                sendTeamsData();
            });
        });
    }
    }
});



//-----AdminPanel-------------------------
app.post('/adminPanel', (req, res) =>{
    const maxRoundsGameIn = req.body.maxRoundsGame;
    maxRoundsGame = maxRoundsGameIn;

    res.render(__dirname + '/client/adminPanel.ejs');
    statePanel = "lobby";
    io.sockets.on('connection', function(socket){
        changeScene(socket);
        socket.emit('matchNowTeams', getMatchNowTeams(matchId));
        matches[matchId] = Match(matchId, MatchNowTeams(matchId), [0, 0]);
        socket.emit('matchNowInfo', getMatchNowInfo(maxRoundsGame));
        io.emit('changeSpectOnPanel');

        app.get('/adminPanel/adminLobby', (req, res) =>{
            res.render(__dirname + '/client/adminLobby/adminLobby.ejs');
            sendTeamsData();
            //OnStartMatch    
        });

        socket.on('startMatch', function(){
            socket.emit('changeMatchSec', "game"); //game, lobby
            isRunningGame = true;
            socket.emit('matchNowInfo', getMatchNowInfo(maxRoundsGame));
            socket.emit('matchNowTeams', getMatchNowTeams());
        });

        socket.on('regulateScore', function(data){
            regulateScoreMatch(data[0], data[1]);
            socket.emit('matchNowInfo', getMatchNowInfo(maxRoundsGame));
        });

        socket.on('reloadPage', function(){
            socket.emit('writeMatchesScore', matches);
        });

    });
});
//-----AdminPanel-------------------------

//-----SpecPanel-------------------------

app.get('/specPanel', (req, res) =>{
    res.render(__dirname + '/client/spectatorPanel.ejs');
    statePanel = "lobby";
    io.sockets.on('connection', function(socket){
        changeScene(socket);

        app.get('/specPanel/specLobby', (req, res) =>{
            res.render(__dirname + '/client/spectatorLobby.ejs');
            sendTeamsData();
        });
    });
});
//-----SpecPanel-------------------------
function onLoginAgain(user){
        io.emit('loginAgain', user);
}

function getMatchNowInfo(maxRoundsGame){
    var info = [];

    info[0] = matchId;
    info[1] = maxRoundsGame;
    if(isRunningGame){
        info[2] = matches[matchId].scores;
    }

    return info;
}

function getMatchNowTeams() {
    var teamNames = [];

    var team1 = teamsList[MatchNowTeams(matchId)[0]];
    var team2 = teamsList[MatchNowTeams(matchId)[1]];
  
      teamNames[0] = team1.teamName;
      teamNames[1] = team2.teamName;
  
    return teamNames;
  }


function sendTeamsData(){
    var pack = [];
    
    for(var i in teamsList){
        var teamp = teamsList[i];

            pack.push({
                teamId: teamp.id,
                teamName: teamp.teamName,
                playerOneName: teamp.playerOneName,
                playerTwoName: teamp.playerTwoName,
                score: teamp.score,
                teamsCount: teamsCount
            });

    }        

        io.emit('teamsReg', pack);
    }

function changeScene(socket){
    socket.emit('scene', statePanel);
}    


setInterval(function(){

    io.emit('teamsCount', teamsCount);
    
},1000/25);