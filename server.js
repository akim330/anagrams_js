var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static(__dirname));

var port = process.env.PORT || 3000;

// Game parameters
var flip_delay = 1500;

// Initializing
var currentplayer = 1;
var flip_waiting = false;
var flip_time = 0;
var pending_take = undefined;

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

http.listen(port, function(){
    console.log('listening on *:' + port);
});

require('./game.js');
game = new Game(is_server = true);

io.on('connect', function(socket){
    
    var client_ip = socket.handshake.headers['x-real-ip'];
    
    console.log('Connected to ' + client_ip + '. ID: ' + socket.id)

    // Send the full game state
    socket.emit('game transmission', game); // {current: game.current, player1words_dict: game.player1words_dict, player2words_dict: game.player2words_dict, player1words_list: game.player1words_list, player2words_list: game.player2words_list, is_word: game.is_word});
    console.log(`Sending player id ${currentplayer}`);
    socket.emit('game id', currentplayer);
    var player_id = currentplayer;
    currentplayer += 1;

    check_flip_take = function(){
        if (flip_waiting){
            if (new Date().getTime() > flip_time){
                console.log("Flip!")
                game.flip();
                flip_waiting = false;
                io.emit('flip', game.current)
            }
        }
    }

    // Check for pending flips and takes
    setInterval(check_flip_take, 100);

    socket.on('disconnect', () => {
        console.log(`Player ${player_id} disconnected!`)
    });

    socket.on('flip_request', function(){
        console.log("Received flip request")
        flip_waiting = true;
        flip_time = new Date().getTime() + flip_delay; 
        io.emit('flip_request');
    })

    socket.on('take', function(recv_take){
        console.log("---- Received take ----");
        console.log(`Type of pending_take: ${typeof(pending_take)}`);
        if (pending_take != undefined){
            console.log("Check pending take");
            if (pending_take.taker != player_id){
                console.log("Pending take was other player's, so now will update");
                if (game.both_can_take(pending_take, recv_take)){
                    game.update(pending_take, pending_take.taker);
                    game.update(recv_take, player_id)
                    game.last_take = recv_take;
                    pending_take = undefined;

                    io.emit('take update', {current: game.current, player1words_dict: game.player1words_dict, player2words_dict: game.player2words_dict, player1words_list: game.player1words_list, player2words_list: game.player2words_list});
                }
                else if (recv_take.take_time < pending_take.take_time){
                    game.update(recv_take, player_id);
                    game.last_take = recv_take;
                    pending_take = undefined;

                    io.emit('take update', {current: game.current, player1words_dict: game.player1words_dict, player2words_dict: game.player2words_dict, player1words_list: game.player1words_list, player2words_list: game.player2words_list});

                }
                else{
                    game.update(pending_take, pending_take.taker);
                    game.last_take = pending_take;
                    pending_take = undefined;

                    io.emit('take update', {current: game.current, player1words_dict: game.player1words_dict, player2words_dict: game.player2words_dict, player1words_list: game.player1words_list, player2words_list: game.player2words_list});
                }
            }
            else{
                console.log("Pending take was same player's so will not update");
                // Pending take is the same player's previous take
                if (game.superset(recv_take.candidate, pending_take.candidate, true)){
                    pending_take = recv_take;
                }
            }
        }
        else{
            console.log("No pending take, so make this one the pending take.");
            console.log(`Can I take it? ${game.can_take(recv_take)}`);
            // No pending take, so this received take becomes the pending take if you can still take it
            if (game.can_take(recv_take)){
                pending_take = recv_take;
            }
        }

    })

    socket.on('check take', function(time_since_update){
        if (pending_take != undefined && pending_take.taker != player_id){
            console.log(`Checking take (player ${player_id}): pending_take: ${typeof(pending_take)}, pending_take id${pending_take.taker}, pending taketime: ${pending_take.take_time}, current time since update: ${time_since_update}`);
            if (time_since_update > pending_take.take_time){
                console.log("Too late! Updating!")
                game.update(pending_take, pending_take.taker);
                game.last_take = pending_take;
                pending_take = undefined;

                io.emit('take update', {current: game.current, player1words_dict: game.player1words_dict, player2words_dict: game.player2words_dict, player1words_list: game.player1words_list, player2words_list: game.player2words_list, last_take: game.last_take});
            }
        }
    })
})


