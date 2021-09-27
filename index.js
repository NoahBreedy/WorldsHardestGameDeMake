/*
  TODO: Add Client-Side Prediction with Server-Side Reconcilliation [DONE]
  TODO: Add Entity Interpolation [DONE]
*/

require('dotenv').config();
const express = require('express');
const app = express();
const { Client } = require('pg');
const serv = require('http').Server(app);
const socket = require('socket.io');
const io = socket(serv);
const Max_Rooms = 10,ID_LENGTH=5,res=25,playerSpeed = 1.25,dict="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
let AllLevels,Rooms= new Map();
let t = 0;

const con = new Client({
    connectionString: process.env.cString
});
con.connect();

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
  this.playerCount = 0;
  this.password = password;
  this.levels = levels;
  this.id = createId(ID_LENGTH);
  this.balls = [];
  this.players = [];
}


app.use('/client',express.static(__dirname + '/client'));


app.get('/',(req, res) => {
  con.query('SELECT * FROM "Blungus23/worldshardestgame"."levels";',(err,result)=>{
       AllLevels = result.rows;
       res.sendFile(__dirname + '/client/index.html');
  });
});

//send updated rooms list
setInterval(()=>{ 
  io.sockets.in("roomWindow").emit('returnRooms', [...Rooms]);
}, 2000);
//Clean Dead Rooms
setInterval(()=>{ 
  arrayTmp = Array.from(Rooms);
  for(var i =0; i<arrayTmp.length;i++){
    if(arrayTmp[i][1].playerCount<1){
      arrayTmp.splice(i,1);
      break;
    }
  }
  Rooms = new Map(arrayTmp)
}, 2000);

const serverRate = 30;
//send rawplayer data
setInterval(()=>{ 
  Rooms.forEach(room=>{
    io.sockets.in(room.id).emit('getplayers', {players:room.players,time:t});
  })
}, (1000/serverRate));


io.sockets.on('connection', function(socket) {
  //console.log("New Person: " + socket.id);
  socket.on('getLevels', (data) => {
    io.to(socket.id).emit('returnLevels',AllLevels);
  }).on('newRoom',(data)=>{
      if(Rooms.size<Max_Rooms){
      let newRoom = new Room(data.password,data.levels);
      socket.join(newRoom.id);
      socket.leave("roomWindow")
      Rooms.set(newRoom.id,newRoom);
      newRoom.playerCount++;
      let player = createNewPlayer(newRoom.id,0,newRoom.playerCount,socket.id);
      newRoom.players.push(player);
      let return_data = {
        roomId: newRoom.id,
        me: player,
        levels: newRoom.levels
      }
      Rooms.set(newRoom.id,newRoom);
      io.to(socket.id).emit('returnStartData',return_data);
      }else{
        io.to(socket.id).emit('altmsg',"Too Many Rooms (please try again later)");
      }
  }).on('getRooms',()=>{
      if(Rooms.size > 0){
        socket.join("roomWindow");
        io.to(socket.id).emit('returnRooms',[...Rooms]);
      }else{
        io.to(socket.id).emit('altmsg',"There Are No Rooms (try creating one)")
      }
  }).on('joinRoom',data=>{
      let room = Rooms.get(data.id);
      room.playerCount++;
      let player = createNewPlayer(data.id,0,room.playerCount,socket.id);
      room.players.push(player);
      let return_data = {
            roomId: data.id,
            me: player,
            levels: room.levels,
      }
      socket.leave("roomWindow");
      socket.join(data.id);
      Rooms.set(data.id,room);
      io.to(socket.id).emit('returnStartData',return_data);
      io.in(data.id).emit('syncBalls');
  }).on('keySend',key=>{
    let id = fs_GetRoomId(socket.rooms);
    let room = Rooms.get(id);
    try{
      let player  = room.players[key.num-1];
      player = updatePlayer(player,key.code,id,key.req);
      player.time = key.time;
      room.players[key.num-1] = player;
      Rooms.set(id,room);
      io.to(socket.id).emit('processedKey',key.req);
    }catch{

    }
  }).on('disconnecting',()=>{
     try{
      let id = fs_GetRoomId(socket.rooms);
      let room = Rooms.get(id);
      for(var i =0; i<room.players.length;i++){
          if(room.players[i].socketId == socket.id){
            room.playerCount--;
            room.players.splice(i,1);
            break;
          }
      }
      for(var i=0;i<room.players.length;i++){
        if(room.players[i].num > 1){
          room.players[i].num--;
        }
      }
      io.in(id).emit('updatePlayerNumber');
      io.in(id).emit('syncBalls');
     }catch{

     }
     
  }).on('levelComplete',player_num=>{
        let id = fs_GetRoomId(socket.rooms);
        let room = Rooms.get(id);
        let player  = room.players[player_num-1];
        player.level++;
        player.level = player.level%room.levels.length;
        const grid = JSON.parse(Rooms.get(id).levels[player.level].Data).map
        const starts = getStarts(grid);
        let start = starts[parseInt(getRandomInt(0,starts.length))];
        player.x = start.x;
        player.y = start.y;
        room.players[player_num-1] = player;
        io.to(socket.id).emit('callInit',player);
        io.in(id).emit('syncBalls');
  }).on('resetPlayer',data=>{
    let id = fs_GetRoomId(socket.rooms);
    let room = Rooms.get(id);
    let player  = room.players[data.num-1];
    const grid = JSON.parse(Rooms.get(id).levels[data.level].Data).map
    const starts = getStarts(grid);
    let start = starts[parseInt(getRandomInt(0,starts.length))];
    player.x = start.x;
    player.y = start.y;
    room.players[data.num-1] = player;
    io.to(socket.id).emit('changePlayer',player);
    io.in(id).emit('syncBalls');
  })
});


function collidesWorld(id,player,call=null){
    const grid = JSON.parse(Rooms.get(id).levels[player.level].Data).map
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

function updatePlayer(p,key,id,action){
  try{
      if(key == 38 || key == 87){ //Up key
    p.y -= playerSpeed;
    if(collidesWorld(id,p) == 1){
      p.y += playerSpeed;
    }
  }

  if( key == 40 || key  == 83){ //Down key
    p.y += playerSpeed;
    if(collidesWorld(id,p,"nextD") == 1){
      p.y -= playerSpeed;
    }
  }

  if(key == 39 || key == 68){ //Right key
    p.x += playerSpeed;
    if(collidesWorld(id,p,"nextR") == 1){
      p.x -= playerSpeed;
    }
  }

  if(key == 37 || key == 65){ //Left key
    p.x -= playerSpeed;
    if(collidesWorld(id,p) == 1){
      p.x += playerSpeed;
    }
  }

  p.action = action;
  }catch{
  }
  
  return p
}

function fs_GetRoomId(rooms){
  return [...rooms.values()].filter(room => room.length == ID_LENGTH)[0];
}

function createNewPlayer(id,level,num,soc){
   const grid = JSON.parse(Rooms.get(id).levels[level].Data).map
   const starts = getStarts(grid);
   let start = starts[parseInt(getRandomInt(0,starts.length))];
   return {num:num,level:level,x:start.x,y:start.y,action:0,time:0,socketId:soc}
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
