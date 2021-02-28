require('dotenv').config();
const express = require('express');
const app = express();
const mysql = require('mysql');
const serv = require('http').Server(app);
const socket = require('socket.io');
const io = socket(serv);
const Max_Rooms = 10,ID_LENGTH=5,res=25,playerSpeed = 1.25,dict="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
let AllLevels,Rooms=[];


const con = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database:process.env.DB_USER
});




//sendDataToGameRooms  run at 22/33/70
setInterval(heartBeat,33);
function heartBeat(){
  for(var i=0;i<Rooms.length;i++){
    const data = {
      players: Rooms[i].players,
      balls: Rooms[i].balls,
      playerCount: Rooms[i].playerCount
    }
    io.to(Rooms[i].id).emit('updateGame',data);
  }
}
//update the list of rooms
setInterval(()=>{
  io.sockets.in("main").emit('returnRooms', Rooms);
},1500);
//Clear Dead ROOMS
setInterval(()=>{
  for(var i =0;i<Rooms.length;i++){
    if(Rooms[i].playerCount == 0){
      Rooms.splice(i,1);
    }
  }
},5500);

function createId(len){
  let id = "";
  for(var i =0; i<len;i++){
     id += dict[parseInt(getRandomInt(0,dict.length))];
  }
  return id;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}


function Room(password,levels){
  this.players = [];
  this.playerCount = 1;
  this.password = password;
  this.balls = [];
  this.levels = levels;
  this.id = createId(ID_LENGTH);
}


app.use('/client',express.static(__dirname + '/client'));


app.get('/',(req, res) => {
  con.query(`SELECT * FROM WorldsHardestGame`,(err,result)=>{
       AllLevels = result;
       res.sendFile(__dirname + '/client/index.html');
  });
});


io.sockets.on('connection', function(socket) {
  //console.log("New Person: " + socket.id);
  socket.on('getLevels', (data) => {
    io.to(socket.id).emit('returnLevels',AllLevels);
  }).on('newRoom',(data)=>{
      if(Rooms.length<Max_Rooms){
      Rooms.push(new Room(data.password,data.levels));
      const p = createNewPlayer(Rooms.length-1,0,1);
      Rooms[Rooms.length-1].players.push(p);
      socket.join(Rooms[Rooms.length-1].id);
      io.to(socket.id).emit('joinedRoom',Rooms[Rooms.length-1]);
      }else{
        io.to(socket.id).emit('msg',"TOO MANY ROOMS SORRY!");
      }
  }).on('getRoomBalls',(data)=>{
     roomName = getRoomId(socket.rooms);
     for(var i=0;i<Rooms.length;i++){
       if(Rooms[i].id == roomName){
         io.to(socket.id).emit('updateBalls',data);
         break;
       }
     }
     
  }).on('giveBalls',(data)=>{
      roomName = getRoomId(socket.rooms);
      for(var i=0;i<Rooms.length;i++){
       if(Rooms[i].id == roomName){
         Rooms[i].balls = data.balls;
         break;
       }
     }
  }).on('getRooms',(data)=>{
    io.to(socket.id).emit('returnRooms',Rooms);
    if(Rooms.length>0){
      socket.join("main");
    }
  }).on('joinRoom',(data)=>{
     socket.leave("main");
     socket.join(data.id);
     for(var i=0;i<Rooms.length;i++){
       if(Rooms[i].id == data.id){
         const myNum = Rooms[i].players.length+1;
         const p = createNewPlayer(i,0,myNum)
         Rooms[i].players.push(p);
         Rooms[i].playerCount++;
         io.to(Rooms[i].id).emit('joinedRoom',Rooms[i]);
       }
     }
  }).on('updatePlayer',(data)=>{
      const currRoomID = getRoomId(socket.rooms);
      const Rind = getRoomIndexByID(currRoomID);
      const Pind = data.num-1;
      Rooms[Rind].players[Pind] = data;
  }).on('reachedEnd',(data)=>{
      const currRoomID = getRoomId(socket.rooms);
      const Rind = getRoomIndexByID(currRoomID);
      const Pind = data.num-1;
      Rooms[Rind].players[Pind] = createNewPlayer(Rind,data.level-1,data);
      io.to(socket.id).emit('activateInit',null);
  }).on('leaveGame',(data)=>{
    // VERY WEIRD AND BUGGY!!! working on it 
    const currRoomID = getRoomId(socket.rooms);
    const Rind = getRoomIndexByID(currRoomID);
    const Pind = data.num-1;
    Rooms[Rind].players.splice(Pind,1);
    Rooms[Rind].playerCount =  Rooms[Rind].playerCount - 1;
    const playerData = {
      players: Rooms[Rind].players,
      whoLeft: data.num,
      playerCount:Rooms[Rind].playerCount

    }
    socket.leave(currRoomID);
    io.to(currRoomID).emit('playerLeftRoom',playerData);
  });
  
});

function getRoomId(rooms){
  for(var item of rooms){
       if(item.length == ID_LENGTH){
         return item;
       }
    }
}

function collidesWorld(id,player,call=null){
    const grid = JSON.parse(Rooms[id].levels[player.level].Data).map
    const x = parseInt(player.x/res);
    const y = parseInt(player.y/res);
    if(call == "nextR"){
      let nX = parseInt((player.x+10)/res);
      return grid[nX][y]
    }
    if(call == "nextD"){
      let nY = parseInt((player.y+10)/res);
      return grid[x][nY]
    }
    return grid[x][y];
}

function getRoomIndexByID(id){
  for(var i=0;i<Rooms.length;i++){
    if(Rooms[i].id = id){
      return i
    }
  }
}

function createNewPlayer(id,level,num){
   const grid = JSON.parse(Rooms[id].levels[level].Data).map
   const starts = getStarts(grid);
   let start = starts[parseInt(getRandomInt(0,starts.length))];
   return {num:num,level:level,x:start.x,y:start.y}
   
  
}

function getStarts(grid){
  let starts = [];
  for(var i =0;i<grid[0].length;i++){
    for(var j =0;j<grid.length;j++){
      if(grid[i][j] == 2){
        starts.push({x:i*res,y:j*res});
      }
    }
  }
  return starts;
}


serv.listen(process.env.PORT);
console.log("Server started");
