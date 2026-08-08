const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "multiplayer-game",
        time: new Date().toISOString()
    });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// =====================================================
// GAME STATE
// =====================================================

const rooms = new Map();
const players = new Map();

// =====================================================
// ROOM CODE
// =====================================================

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (let i = 0; i < 5; i++) {

            code +=
                characters[
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

        x:
            (Math.random() - 0.5) * 24,

        y: 1.7,

        z:
            (Math.random() - 0.5) * 24,

        ry:
            Math.random() *
            Math.PI *
            2
    };
}

// =====================================================
// PLAYER DATA
// =====================================================

function createPlayer(id) {

    const position = spawn();

    return {

        id,

        name: "Player",

        room: null,

        x: position.x,
        y: position.y,
        z: position.z,

        ry: position.ry,

        score: 0,

        deaths: 0
    };
}

// =====================================================
// GET ROOM PLAYERS
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

// =====================================================
// SEND ROOM PLAYER LIST
// =====================================================

function broadcastRoom(roomCode) {

    if (!roomCode) {

        return;
    }

    io
        .to(roomCode)
        .emit(
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

        const player =
            createPlayer(
                socket.id
            );

        players.set(
            socket.id,
            player
        );

        socket.emit(
            "welcome",
            {
                id:
                    socket.id
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

                leaveRoom(
                    socket
                );

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

                player.score = 0;

                player.deaths = 0;

                const position =
                    spawn();

                player.x =
                    position.x;

                player.y =
                    position.y;

                player.z =
                    position.z;

                player.ry =
                    position.ry;

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
                    `${player.name} created ${roomCode}`
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

                const room =
                    rooms.get(
                        roomCode
                    );

                if (!room) {

                    socket.emit(
                        "roomError",
                        "Room not found."
                    );

                    return;
                }

                if (player.room) {

                    leaveRoom(
                        socket
                    );
                }

                socket.join(
                    roomCode
                );

                player.room =
                    roomCode;

                player.name =
                    name;

                player.score = 0;

                player.deaths = 0;

                const position =
                    spawn();

                player.x =
                    position.x;

                player.y =
                    position.y;

                player.z =
                    position.z;

                player.ry =
                    position.ry;

                socket.emit(
                    "roomJoined",
                    {
                        room:
                            roomCode,

                        host:
                            room.host ===
                            socket.id
                    }
                );

                broadcastRoom(
                    roomCode
                );

                console.log(
                    `${player.name} joined ${roomCode}`
                );
            }
        );

        // =================================================
        // NAME / JOIN
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

                const x =
                    Number(data.x);

                const y =
                    Number(data.y);

                const z =
                    Number(data.z);

                const ry =
                    Number(data.ry);

                if (
                    !Number.isFinite(x) ||
                    !Number.isFinite(y) ||
                    !Number.isFinite(z) ||
                    !Number.isFinite(ry)
                ) {

                    return;
                }

                // Keep players inside arena

                player.x =
                    Math.max(
                        -18.5,
                        Math.min(
                            18.5,
                            x
                        )
                    );

                player.y =
                    Math.max(
                        0.1,
                        Math.min(
                            30,
                            y
                        )
                    );

                player.z =
                    Math.max(
                        -18.5,
                        Math.min(
                            18.5,
                            z
                        )
                    );

                player.ry =
                    ry;

                socket
                    .to(player.room)
                    .emit(
                        "playerState",
                        {
                            id:
                                player.id,

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
// LEAVE ROOM
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

            io
                .to(
                    remaining[0].id
                )
                .emit(
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
        rooms.has(
            roomCode
        )
    ) {

        broadcastRoom(
            roomCode
        );
    }
}

// =====================================================
// VERCEL EXPORT
// =====================================================
//
// IMPORTANT:
// Do NOT use server.listen() on Vercel.
//
// Vercel owns the HTTP server.
// =====================================================

module.exports = server;