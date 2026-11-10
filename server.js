const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Đọc các file trong thư mục public
app.use(express.static(path.join(__dirname,)));

const players = {};

io.on('connection', (socket) => {
  // Khi học sinh vào phòng
  socket.on('player_join', (data) => {
    players[socket.id] = { id: socket.id, ...data };
    socket.emit('current_players', players);
    socket.broadcast.emit('new_player_joined', players[socket.id]);
  });

  // Khi học sinh di chuyển
  socket.on('player_move', (moveData) => {
    if (players[socket.id]) {
      Object.assign(players[socket.id], moveData);
      socket.broadcast.emit('player_updated', players[socket.id]);
    }
  });

  // Khi học sinh thoát
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('player_left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server chạy tại cổng ${PORT}`);
});
