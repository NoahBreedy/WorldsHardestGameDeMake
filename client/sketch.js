const socket = io();
const Max_Levels = 5,Max_Players = 5,playerSpeed=1.25;
let AllLevels,AllRooms,HOSTLEVEL,myQueue=[];

let loaded = false;
let rawPlayers = [];
let levels;
let data;
let grid;
let myLevel = 0;
let exitCoins =0;
let origCoins;
const res = 25;
let balls = [];
let coins = [];
let players = [];
let pg;
let player = 0;
let pressing = false;
let myKey;
let p1;
let currPlayerCount = 0;
//Events
socket.on('returnLevels',(data)=>{
     AllLevels = data;
     renderLevels(AllLevels);
}).on('msg',(msg)=>{
  alert(msg);
}).on('joinedRoom',(room)=>{
   loaded = false;
   document.getElementById("join").style.display = "none";
   document.getElementById("create").style.display = "none";
   document.getElementById("createR").style.display = "none";
   document.getElementById('objectContainer').style.display = "none";
   document.getElementById('dcBtn').style.visibility = "visible";
   levels = room.levels;
   rawPlayers = room.players;
   init();
   cnv.show();
}).on('updatePlayers',(data)=>{
  //  if(player != 1){
  //    if(data.balls.length>0){
  //         if(data.balls[0].level == myLevel ){
  //      balls = [];
  //    for(var ball of data.balls){
  //       balls.push(new Ball(ball.x,ball.y,ball.i,ball.pos,ball.speed,ball.level));
  //     }
  //    }
  //    } 
  //  }
   rawPlayers = data.players;
   HOSTLEVEL = rawPlayers[0].level;
   drawLevel();
   handelKeyBoard();
   drawPlayers();
   currPlayerCount = data.playerCount;
}).on('returnRooms',(data)=>{
    AllRooms = data;
    renderRooms(AllRooms)
}).on('activateInit',(data)=>{
   init();
}).on('playerLeftRoom',(data)=>{
    loaded = false;
    if(data.whoLeft < player){
      player -= 1;
      if(player<1){
          player = 1;
      }
    } 
    currPlayerCount = data.playerCount;
    rawPlayers = data.players;
    loaded = true;
}).on('hostLeft',(data)=>{
    window.location.reload();
});


//Graphics
const playerColors = {
  1: "#f01111",
  2: "#0095ff",
  3: "#03ad00",
  4: "#fadd00",
  5: "#d400fa",
}

function resetCoins(){
  coins = [];
  for(var i =0; i<origCoins.length;i++){
    coins.push(new Coin(origCoins[i].x,origCoins[i].y));
  }
}

function init(ok=null){
  loaded = false;
  document.getElementById('currentTitleMsg').innerHTML = `${levels[myLevel].ProjectName} <br> by: ${levels[myLevel].User}`;
  data = JSON.parse(levels[myLevel].Data);
  grid = data.map;
  drawGrid();
  for(var p of rawPlayers){
    let col;
    try{
     col = playerColors[p.num];
    }catch{
      col = "#000000";
    }
    if(ok == null){
      if(p.num == player){
        p1 = new Player(p.x,p.y,col,p.level);
      }
    }else{
      const starts = getStarts(grid);
      let start = starts[int(random(starts.length))];
      p1.x = start.x;
      p1.y = start.y;
    }
    players.push(new Player(p.x,p.y,col,p.level))
  }
  balls = [];
  coins = [];
  if(player != 1){
     socket.emit("getRoomBalls", "needData");    
  }
  for(var ball of data.balls){
    balls.push(new Ball(ball.x,ball.y,ball.i,ball.pos,ball.speed,ball.level));
  }
  origCoins = data.coins;
  for(var i =0; i<data.coins.length;i++){
    coins.push(new Coin(data.coins[i].x,data.coins[i].y));
  }
  exitCoins = data.coins.length;
  loaded = true;
}

function setup() {
  //for Objects
  cnv = createCanvas(600, 400);
  //for Map
  pg = createGraphics(600, 400);
  cnv.parent("Game");
  cnv.hide();
  cols = (width/res);
  rows = (height/res);
  rectMode(CORNER);
}

function drawPlayers(){
  players = [];
  for(var p of rawPlayers){
    let col;
    try{
     col = playerColors[p.num];
    }catch{
      col = "#000000";
    }
    if(p.num<=currPlayerCount){
      players.push(new Player(p.x,p.y,col,p.level))
    }
  }
}

function drawLevel(){
  if(loaded){
    background(220);
    image(pg, 0, 0);
    for(var ball of balls){
       ball.show();
       ball.update();
       p1.collidesBall(ball);
    }
    for(var k =0;k<coins.length;k++){
      coins[k].show();
      if(p1.collidesCoin(coins[k])){
        p1.coins++;
        coins.splice(k,1);
      }
    }
    for(var p of players){
      if(p.level == myLevel){
        p.show();
      }
    }
  }
  let myArr = [];
  for(var ball of balls){
    myArr.push({x:ball.x,y:ball.y,i:ball.myInd,pos:ball.pos,speed:ball.speed,level:myLevel});
  }
  const data = {
    balls: myArr,
  }
  if(player == 1){
    socket.emit("giveBalls",data)
  }
}

function handelKeys(){
  if(pressing){
    socket.emit('keyPressed',myKey);
  }
}

function handelKeyBoard(){
  if(keyIsDown(38) || keyIsDown(87) ){ //Up
    p1.y -= playerSpeed;
    if(p1.collidesWorld() == 1){
      p1.y += playerSpeed;
    }
  }
  if(keyIsDown(40) || keyIsDown(83)){//Down
    p1.y += playerSpeed;
    if(p1.collidesWorld("nextD") == 1){
      p1.y -= playerSpeed;
    }
  }
  if(keyIsDown(39) || keyIsDown(68)){//Right
    p1.x += playerSpeed;
    if(p1.collidesWorld("nextR") == 1){
      p1.x -= playerSpeed;
    }
  }
  if(keyIsDown(37) || keyIsDown(65)){//Left
    p1.x -= playerSpeed;
    if(p1.collidesWorld() == 1){
      p1.x += playerSpeed;
    }
  }
  if(p1.collidesWorld() == 3 && p1.coins >= exitCoins){
      myLevel++;
      myLevel = myLevel%levels.length;
      init('self');
  }
  const rawP1 = {num:player,level:myLevel,x:p1.x,y:p1.y};
  if(loaded){
    socket.emit('updatePlayer',rawP1);
  }
}


function keyPressed(){
   //Parse keyPressed
   if(isValidKey(keyCode)){
    if(loaded){
       myKey = {
        num: player,
        key: keyCode
      }
      pressing = true;
    } 
   }
   if(keyCode == 32){
     console.log(p1);
   }
}

function keyReleased(){
  pressing = false;
}

function CircleCircle(c1,c2){
   const d = dist(c1.x,c1.y,c2.x,c2.y);
   return d<(c1.r+c2.r)/2;
}

function isValidKey(key){
  const validKeys = [87,38,83,40,65,37,68,39];
  return validKeys.includes(key);
}

const colors = {
  1 : "#1cd1ed",
  2 : "#bffcb6",
  3 : "#ffc1a6",
  6 : "#ff8f70",
  7 : "#80a8ff",
  8 : "#ffffff",
  9 : "#000000",
}


function Coin(x,y){
  this.x = x;
  this.y = y;
  this.r = 5;
  this.show = ()=>{
    push()
    fill("#fff700");
    circle(this.x,this.y,this.r);
    pop()
  }
}


function Ball(x,y,i,pos,speed,level){
  this.x = x;
  this.y = y;
  this.myInd = i;
  this.r = 20;
  this.level = level;
  this.pos = pos;
  this.speed = speed;
  this.selected = false;
  this.ind = 1;
  this.done = false;
  this.plane = "X";
  
  this.update = () =>{
    try{
      const next = this.pos[this.ind];
    if(this.plane == "X"){
       if(this.x>next.x){
         this.x -= this.speed;
         this.not = true;
       }else if(this.x < next.x){
         this.x += this.speed;
       }
      if(this.x == next.x){
        this.plane = "Y";
      }
    }else if(this.plane == "Y"){
      if(this.y>next.y){
         this.y -= this.speed;
       }else if(this.y < next.y){
         this.y += this.speed;
       }
      if(this.y == next.y){
        this.done = true;
      }
    }
    if(this.done){
      if(this.ind<this.pos.length){
        this.ind++;
        this.done = false;
        this.plane = "X";
      }
      if(this.ind>=this.pos.length){
        this.x = this.pos[0].x
        this.y = this.pos[0].y
        this.ind = 1;
      }
    }
    }catch{
      
    }
    
  }

  this.show = () => {
      push()
      if(this.selected){
        for(var i=0;i<this.pos.length;i++){
          noStroke();
          fill('rgba(253, 255, 112,0.25)')
          rect(this.pos[i].x,this.pos[i].y,res,res);
        } 
      }
      fill("#0013bf")
      circle(this.x+(res/2),this.y+(res/2),this.r);
      pop()
  }
     
}


function Player(x,y,col,level){
  this.x = x;
  this.y = y;
  this.col = col;
  this.level = level;
  this.r = 10;
  this.coins = 0;
  this.collidesBall = (c) =>{
    const c2 = {x:c.x+(res/2),y:c.y+(res/2),r:c.r}
    const c1 = {x:this.x,y:this.y,r:this.r}
    if(CircleCircle(c1,c2)){
      const starts = getStarts(grid);
      let start = starts[int(random(starts.length))];
      this.x = start.x;
      this.y = start.y;
      this.coins = 0;
      resetCoins();
    }
  }
  this.collidesCoin = (c) =>{
    const c2 = {x:c.x,y:c.y,r:c.r}
    const c1 = {x:this.x,y:this.y,r:this.r}
    return CircleCircle(c1,c2);   
  }
  
  this.collidesWorld = (call) =>{
    const x = int(this.x/res);
    const y = int(this.y/res);
    if(call == "nextR"){
      let nX = int((this.x+10)/res);
      return grid[nX][y]
    }
    if(call == "nextD"){
      let nY = int((this.y+10)/res);
      return grid[x][nY]
    }
    return grid[x][y];
  }
    
  this.show = () => {
    push()
    fill(this.col);
    rect(this.x,this.y,10,10); 
    /* hitBox */
    // fill("green");
    // circle(this.x+(this.r/2),this.y+(this.r/2),this.r);
    pop()
  }
}



function getNeighbors(i,j){
    let arr = [];
    try{
        arr.push(grid[i-1][j-1])
        arr.push(grid[i-1][j])
        arr.push(grid[i-1][j+1])
        arr.push(grid[i][j-1])
        arr.push(grid[i][j+1])
        arr.push(grid[i+1][j-1])
        arr.push(grid[i+1][j])
        arr.push(grid[i+1][j+1])
        return arr;
    }
    catch{
       return [];
    }
}

function drawGrid(){
  for(var i =0; i<cols;i++){
    for(var j =0;j<rows;j++){
       const x = i*res;
       const y = j*res;
       pg.push()
      if(grid[i][j] == 0){
        if((i+j) % 2 == 0){
          pg.fill(data.col[0]);
        }else{
          pg.fill(data.col[1]);
        }
      }else{
        try{
          pg.fill(colors[grid[i][j]])
        }catch{
          
        }
        
      }
      pg.noStroke();
      pg.rect(x,y,res,res);
      if(grid[i][j]==1){
      drawWalls(x,y,i,j);
      }
      pg.pop()
    }
  }
}
//Renders the black lines or box edges
function drawWalls(x,y,i,j){
        pg.stroke(0)
        const neigh = getNeighbors(i,j);
        for(var k =0;k<neigh.length;k++){
          if(neigh[1] != 1 && neigh[1] != null){
            pg.push()
            pg.strokeWeight(2);
            pg.line(x,y,x,y+res)
            pg.pop()
          }
          if(neigh[3] != 1 && neigh[3] != null){
            pg.push()
            pg.strokeWeight(2);
            pg.line(x,y,x+res,y);
            pg.pop()
          }
          if(neigh[4] != 1 && neigh[4] != null){
            pg.push()
            pg.strokeWeight(3);
            pg.line(x,y+res,x+res,y+res);
            pg.pop()
          }
          if(neigh[6] != 1 && neigh[6] != null){
            pg.push()
            pg.strokeWeight(3);
            pg.line(x+res,y,x+res,y+res);
            pg.pop()
          }
          
        }
}





//Utils
function goToPage(num){
  //Show Rooms
  if(num == 1){
      socket.emit('getLevels', "give me Levels"); 
  }else{
    socket.emit('getRooms', "give me rooms");
  }
}

function createRoom(){
  if(myQueue.length>0){
    let pass = window.prompt("Whats the password [leave blank for none]");
    if(pass == "" || pass == null){
      pass = null;
    }
    const data = {
      levels: myQueue,
      password: pass
    }
    socket.emit("newRoom",data);
    player = 1;
  }else{
    alert("Need At Least  1 Room To Make a game");
  }
}

function joinRoom(room){
  if(room.playerCount<Max_Players){
    const data ={
      id: room.id
    }
      if(room.password != null && room.password  != ""){
        const myAns = window.prompt('Whats The Password?');
        if(myAns == room.password){
          player = room.playerCount+1;
          socket.emit('joinRoom',data);
        }else{
          alert("Wrong Password! try again");
        }
      }else{
        player = room.playerCount+1;
        socket.emit('joinRoom',data);
      }
  }else{
    alert("To Many Players in room");
  }
}


function leaveRoom(leftPage=false){
  loaded = false;
  const data = {
    num: player
  }
  socket.emit('leaveGame',data);
  if(!leftPage){
    window.location.reload();
  }
}

function addToQueue(me,level){
    if(isValid(level.Id)){
      if(myQueue.length < Max_Levels){
        myQueue.push(level);
        me.style.backgroundColor  = "#f03c00";
      }else{
        alert(`Cannot have more than ${Max_Levels} levels!`);
      }
      
    }else{
      //Remove From List
      for(var i=0;i<myQueue.length;i++){
        if(myQueue[i].Id == level.Id){
          myQueue.splice(i,1);
          me.style.backgroundColor  = "#00e0f0";
          break;
        }
      }
    } 
    document.getElementById("currentTitleMsg").innerHTML= `Click on a button to Add to your Queue <br> Then click Create Room <br> current queue length: ${myQueue.length}`;  
}

function isValid(find){
  //finds if level is already in queue
  for(var i=0;i<myQueue.length;i++){
        if(myQueue[i].Id == find){
          return false
        }
  }
  return true
}

function renderLevels(levels){
  document.getElementById("currentTitleMsg").innerHTML = "Click on a button to Add to your Queue <br> Then click Create Room <br> current queue length: 0";
  levels.forEach(level =>{
    var button = document.createElement('button');
    button.className = "levelInstance"
    button.innerHTML = level.ProjectName +"<br> by: " + level.User;
    button.onclick = function(){
      addToQueue(button,level);return false;
    };
    document.getElementById('objectContainer').appendChild(button);
  });
  document.getElementById("join").style.display = "none";
  document.getElementById("create").style.display = "none";
  document.getElementById("createR").style.visibility = "visible";
  document.getElementById("objectContainer").style.display = "";
}

function renderRooms(rooms){
  clearRooms();
  if(rooms.length > 0){
    document.getElementById("currentTitleMsg").innerHTML = "Click on a button to join a room";
  for(var i=0;i<rooms.length;i++){
    var button = document.createElement('button');
    button.className = "levelInstance"
    button.innerHTML = "Room #" + (i+1) + ":<br> Players: " + rooms[i].playerCount;
    let myRoom = rooms[i];
    button.onclick = function(){
      joinRoom(myRoom);
    };
    document.getElementById('objectContainer').appendChild(button);
  }
  document.getElementById("join").style.display = "none";
  document.getElementById("create").style.display = "none";
  document.getElementById("createR").style.visibility = "hidden";
  }else{
    alert('There Are No Rooms please make one');
  }
  // document.getElementById("objectContainer").style.display = "";
}

function clearRooms(){
     let roomContainer = document.getElementById("objectContainer");
      while (roomContainer.firstChild) {
          roomContainer.removeChild(roomContainer.lastChild);
      }
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


function getMyPlayer(p){
    for(var i=0;i<p.length;i++){
      if(p[i].num == player){
        return p[i];
      }
    }
}

