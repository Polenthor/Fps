
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(
    express.static(
        path.join(__dirname, "..", "client")
    )
);

// =====================================================
// ROOMS
// =====================================================

const rooms = new Map();
const players = new Map();

function generateRoomCode() {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    do {
        code = "";

        for (let i = 0; i < 5; i++) {
            code += characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];
        }
    } while (rooms.has(code));

    return code;
}

// =====================================================
// SPAWN
// =====================================================

function spawn() {
    return {
        x: (Math.random() - 0.5) * 24,
        y: 1.2,
        z: (Math.random() - 0.5) * 24,
        ry: Math.random() * Math.PI * 2
    };
}

// =====================================================
// ROOM PLAYERS
// =====================================================

function getRoomPlayers(roomCode) {

    if (!roomCode) {
        return [];
    }

    return [
        ...players.values()
    ].filter(
        player =>
            player.room === roomCode
    );
}

function broadcastRoom(roomCode) {

    if (!roomCode) {
        return;
    }

    io.to(roomCode).emit(
        "players",
        getRoomPlayers(roomCode)
    );
}

// =====================================================
// CONNECTION
// =====================================================

io.on(
    "connection",
    socket => {

        console.log(
            "Connected:",
            socket.id
        );

        players.set(
            socket.id,
            {
                id: socket.id,

                name: "Player",

                room: null,

                ...spawn(),

                hp: 100,

                score: 0,

                deaths: 0
            }
        );

        socket.emit(
            "welcome",
            {
                id: socket.id
            }
        );

        // =================================================
        // CREATE ROOM
        // =================================================

        socket.on(
            "createRoom",
            name => {

                const player =
                    players.get(
                        socket.id
                    );

                if (!player) {
                    return;
                }

                // Leave previous room

                if (player.room) {

                    socket.leave(
                        player.room
                    );

                    rooms.delete(
                        player.room
                    );

                    player.room = null;
                }

                const roomCode =
                    generateRoomCode();

                rooms.set(
                    roomCode,
                    {
                        host:
                            socket.id
                    }
                );

                socket.join(
                    roomCode
                );

                player.room =
                    roomCode;

                player.name =
                    String(
                        name ||
                        "Player"
                    ).slice(
                        0,
                        16
                    );

                player.hp = 100;
                player.score = 0;
                player.deaths = 0;

                socket.emit(
                    "roomCreated",
                    {
                        room:
                            roomCode,

                        host:
                            true
                    }
                );

                broadcastRoom(
                    roomCode
                );

                console.log(
                    `${player.name} created room ${roomCode}`
                );
            }
        );

        // =================================================
        // JOIN ROOM
        // =================================================

        socket.on(
            "joinRoom",
            data => {

                const player =
                    players.get(
                        socket.id
                    );

                if (!player) {
                    return;
                }

                const roomCode =
                    String(
                        data?.room ||
                        ""
                    )
                        .trim()
                        .toUpperCase();

                const name =
                    String(
                        data?.name ||
                        "Player"
                    ).slice(
                        0,
                        16
                    );

                if (!roomCode) {

                    socket.emit(
                        "roomError",
                        "Enter a room code."
                    );

                    return;
                }

                if (!rooms.has(roomCode)) {

                    socket.emit(
                        "roomError",
                        "Room not found."
                    );

                    return;
                }

                // Leave previous room

                if (player.room) {

                    socket.leave(
                        player.room
                    );

                    broadcastRoom(
                        player.room
                    );
                }

                socket.join(
                    roomCode
                );

                player.room =
                    roomCode;

                player.name =
                    name;

                player.hp = 100;

                const s = spawn();

                player.x = s.x;
                player.y = s.y;
                player.z = s.z;
                player.ry = s.ry;

                socket.emit(
                    "roomJoined",
                    {
                        room:
                            roomCode,

                        host:
                            rooms.get(
                                roomCode
                            ).host ===
                            socket.id
                    }
                );

                broadcastRoom(
                    roomCode
                );

                console.log(
                    `${player.name} joined room ${roomCode}`
                );
            }
        );

        // =================================================
        // NAME / JOIN GAME
        // =================================================

        socket.on(
            "join",
            name => {

                const player =
                    players.get(
                        socket.id
                    );

                if (!player) {
                    return;
                }

                player.name =
                    String(
                        name ||
                        "Player"
                    ).slice(
                        0,
                        16
                    );

                if (player.room) {

                    broadcastRoom(
                        player.room
                    );
                }
            }
        );

        // =================================================
        // PLAYER STATE
        // =================================================

        socket.on(
            "state",
            data => {

                const player =
                    players.get(
                        socket.id
                    );

                if (
                    !player ||
                    !player.room ||
                    !data
                ) {
                    return;
                }

                player.x =
                    Number(data.x) || 0;

                player.y =
                    Math.max(
                        0.5,
                        Number(data.y) || 1.2
                    );

                player.z =
                    Number(data.z) || 0;

                player.ry =
                    Number(data.ry) || 0;

                socket
                    .to(player.room)
                    .emit(
                        "playerState",
                        {
                            id:
                                socket.id,

                            x:
                                player.x,

                            y:
                                player.y,

                            z:
                                player.z,

                            ry:
                                player.ry
                        }
                    );
            }
        );

        // =================================================
        // SHOOT
        // =================================================

        socket.on(
            "shoot",
            data => {

                const shooter =
                    players.get(
                        socket.id
                    );

                if (
                    !shooter ||
                    !shooter.room ||
                    !data
                ) {
                    return;
                }

                const target =
                    players.get(
                        data.targetId
                    );

                if (
                    !target ||
                    target.id ===
                        shooter.id
                ) {
                    return;
                }

                // Must be in same room

                if (
                    target.room !==
                    shooter.room
                ) {
                    return;
                }

                const dx =
                    target.x -
                    shooter.x;

                const dy =
                    target.y -
                    shooter.y;

                const dz =
                    target.z -
                    shooter.z;

                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy +
                        dz * dz
                    );

                if (
                    distance > 70
                ) {
                    return;
                }

                target.hp -= 25;

                io.to(
                    shooter.room
                ).emit(
                    "hit",
                    {
                        targetId:
                            target.id,

                        hp:
                            target.hp,

                        shooterId:
                            shooter.id
                    }
                );

                // Death

                if (
                    target.hp <= 0
                ) {

                    shooter.score++;

                    target.deaths++;

                    target.hp = 100;

                    const s =
                        spawn();

                    target.x =
                        s.x;

                    target.y =
                        s.y;

                    target.z =
                        s.z;

                    target.ry =
                        s.ry;

                    io.to(
                        shooter.room
                    ).emit(
                        "respawn",
                        {
                            id:
                                target.id,

                            x:
                                target.x,

                            y:
                                target.y,

                            z:
                                target.z,

                            score:
                                shooter.score,

                            deaths:
                                target.deaths
                        }
                    );

                    broadcastRoom(
                        shooter.room
                    );
                }
            }
        );

        // =================================================
        // LEAVE ROOM
        // =================================================

        socket.on(
            "leaveRoom",
            () => {

                leaveRoom(
                    socket
                );
            }
        );

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Disconnected:",
                    socket.id
                );

                leaveRoom(
                    socket,
                    true
                );

                players.delete(
                    socket.id
                );
            }
        );
    }
);

// =====================================================
// LEAVE ROOM FUNCTION
// =====================================================

function leaveRoom(
    socket,
    disconnect = false
) {

    const player =
        players.get(
            socket.id
        );

    if (!player) {
        return;
    }

    const roomCode =
        player.room;

    if (!roomCode) {
        return;
    }

    const room =
        rooms.get(
            roomCode
        );

    player.room = null;

    if (!disconnect) {
        socket.leave(
            roomCode
        );
    }

    // If host leaves,
    // give room to another player

    if (
        room &&
        room.host === socket.id
    ) {

        const remaining =
            getRoomPlayers(
                roomCode
            ).filter(
                p =>
                    p.id !==
                    socket.id
            );

        if (
            remaining.length > 0
        ) {

            room.host =
                remaining[0].id;

            io.to(
                remaining[0].id
            ).emit(
                "hostChanged",
                {
                    host: true
                }
            );

        } else {

            rooms.delete(
                roomCode
            );
        }
    }

    if (
        rooms.has(roomCode)
    ) {

        broadcastRoom(
            roomCode
        );
    }
}

// =====================================================
// SERVER
// =====================================================

server.listen(
    PORT,
    () => {

        console.log(
            `FPS server running at http://localhost:${PORT}`
        );
    }
);

