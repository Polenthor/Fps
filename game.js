import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const socket = io();

// =====================================================
// UI
// =====================================================

const menu = document.getElementById("menu");
const nameInput = document.getElementById("name");

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const confirmJoinButton =
    document.getElementById("confirmJoinButton");

const backButton =
    document.getElementById("backButton");

const roomPanel =
    document.getElementById("roomPanel");

const roomCodeInput =
    document.getElementById("roomCode");

const roomInfo =
    document.getElementById("roomInfo");

const roomStatus =
    document.getElementById("roomStatus");

const healthEl =
    document.getElementById("health");

const ammoEl =
    document.getElementById("ammo");

const statusEl =
    document.getElementById("status");

const board =
    document.getElementById("scoreboard");

const message =
    document.getElementById("message");

// =====================================================
// GAME STATE
// =====================================================

let myId = null;
let started = false;
let currentRoom = null;
let isHost = false;

let hp = 100;

let ammo = 30;
let reserve = 90;

let shooting = false;
let reloading = false;
let lastShot = 0;

const FIRE_RATE = 110;

let yaw = 0;
let pitch = 0;

const keys = {};

const players = new Map();

const obstacles = [];

const clock = new THREE.Clock();

// =====================================================
// PLAYER PHdYSICS
// =====================================================

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.40;

const GRAVITY = 22;
const JUMP_POWER = 33;

const WALK_SPEED = 5;
const SPRINT_SPEED = 8;

let verticalVelocity = 0;
let onGround = true;

// =====================================================
// SOCKET
// =====================================================

socket.on("connect", () => {
    statusEl.textContent = "Connected";
});

socket.on("welcome", data => {
    myId = data.id;
});

// =====================================================
// CREATE ROOM
// =====================================================

if (createRoomButton) {

    createRoomButton.onclick = () => {

        const name =
            nameInput.value.trim() || "Player";

        roomStatus.textContent =
            "Creating room...";

        socket.emit(
            "createRoom",
            name
        );
    };
}

// =====================================================
// JOIN ROOM PANEL
// =====================================================

if (joinRoomButton) {

    joinRoomButton.onclick = () => {

        roomPanel.style.display = "flex";

        joinRoomButton.style.display =
            "none";

        createRoomButton.style.display =
            "none";

        roomStatus.textContent = "";

        roomCodeInput.focus();
    };
}

// =====================================================
// BACK
// =====================================================

if (backButton) {

    backButton.onclick = () => {

        roomPanel.style.display = "none";

        createRoomButton.style.display =
            "block";

        joinRoomButton.style.display =
            "block";

        roomStatus.textContent = "";
    };
}

// =====================================================
// JOIN ROOM
// =====================================================

if (confirmJoinButton) {

    confirmJoinButton.onclick = () => {

        const name =
            nameInput.value.trim() || "Player";

        const room =
            roomCodeInput.value
                .trim()
                .toUpperCase();

        if (!room) {

            roomStatus.textContent =
                "Enter a room code.";

            return;
        }

        roomStatus.textContent =
            "Joining room...";

        socket.emit(
            "joinRoom",
            {
                name: name,
                room: room
            }
        );
    };
}

if (roomCodeInput) {

    roomCodeInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                confirmJoinButton.click();
            }
        }
    );
}

// =====================================================
// ROOM CREATED
// =====================================================

socket.on("roomCreated", data => {

    currentRoom = data.room;
    isHost = data.host;

    if (roomInfo) {

        roomInfo.textContent =
            `ROOM: ${currentRoom}`;
    }

    if (roomStatus) {

        roomStatus.textContent =
            "Room created!";
    }

    setTimeout(
        startGame,
        500
    );
});

// =====================================================
// ROOM JOINED
// =====================================================

socket.on("roomJoined", data => {

    currentRoom = data.room;
    isHost = data.host;

    if (roomInfo) {

        roomInfo.textContent =
            `ROOM: ${currentRoom}`;
    }

    if (roomStatus) {

        roomStatus.textContent =
            "Joined room!";
    }

    setTimeout(
        startGame,
        500
    );
});

// =====================================================
// ROOM ERROR
// =====================================================

socket.on("roomError", text => {

    if (roomStatus) {

        roomStatus.textContent =
            text;
    }
});

// =====================================================
// HOST CHANGE
// =====================================================

socket.on("hostChanged", data => {

    isHost = data.host;

    if (isHost) {

        showMessage(
            "YOU ARE NOW HOST"
        );
    }
});

// =====================================================
// START GAME
// =====================================================

function startGame() {

    if (started)
        return;

    if (!currentRoom)
        return;

    started = true;

    menu.style.display = "none";

    renderer.domElement.requestPointerLock();

    showMessage(
        `ROOM ${currentRoom}`
    );
}

// =====================================================
// PLAYERS
// =====================================================

socket.on("players", list => {

    const seen = new Set();

    for (const p of list) {

        seen.add(p.id);

        if (p.id === myId) {

            hp = p.hp ?? hp;

            healthEl.textContent =
                `HP ${Math.max(0, hp)}`;

            continue;
        }

        let obj =
            players.get(p.id);

        if (!obj) {

            obj = {

                mesh: makePlayer(),

                x: p.x || 0,
                y: p.y || 1.7,
                z: p.z || 0,

                ry: p.ry || 0,

                name:
                    p.name || "Player",

                score:
                    p.score || 0,

                deaths:
                    p.deaths || 0
            };

            players.set(
                p.id,
                obj
            );
        }

        obj.x = p.x || 0;
        obj.y = p.y || 1.7;
        obj.z = p.z || 0;

        obj.ry = p.ry || 0;

        obj.name =
            p.name || "Player";

        obj.score =
            p.score || 0;

        obj.deaths =
            p.deaths || 0;
    }

    for (
        const [id, obj]
        of players
    ) {

        if (!seen.has(id)) {

            scene.remove(
                obj.mesh
            );

            players.delete(id);
        }
    }

    updateBoard(list);
});

// =====================================================
// PLAYER STATE
// =====================================================

socket.on("playerState", p => {

    const obj =
        players.get(p.id);

    if (!obj)
        return;

    obj.x = p.x;
    obj.y = p.y;
    obj.z = p.z;
    obj.ry = p.ry || 0;
});

// =====================================================
// HIT
// =====================================================

socket.on("hit", data => {

    if (data.targetId !== myId)
        return;

    hp = data.hp;

    healthEl.textContent =
        `HP ${Math.max(0, hp)}`;

    document.body.classList.remove(
        "flash"
    );

    void document.body.offsetWidth;

    document.body.classList.add(
        "flash"
    );
});

// =====================================================
// RESPAWN
// =====================================================

socket.on("respawn", data => {

    if (data.id !== myId)
        return;

    hp = 100;

    healthEl.textContent =
        "HP 100";

    camera.position.set(
        data.x,
        PLAYER_HEIGHT,
        data.z
    );

    verticalVelocity = 0;
    onGround = true;

    showMessage("RESPAWNED");
});

// =====================================================
// THREE.JS
// =====================================================

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(
        0x071019
    );

scene.fog =
    new THREE.Fog(
        0x071019,
        20,
        90
    );

// =====================================================
// CAMERA
// =====================================================

const camera =
    new THREE.PerspectiveCamera(
        75,
        innerWidth / innerHeight,
        0.05,
        150
    );

camera.position.set(
    0,
    PLAYER_HEIGHT,
    8
);

// =====================================================
// RENDERER
// =====================================================

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });

renderer.setSize(
    innerWidth,
    innerHeight
);

renderer.setPixelRatio(
    Math.min(
        devicePixelRatio,
        2
    )
);

document.body.appendChild(
    renderer.domElement
);

// =====================================================
// LIGHT
// =====================================================

scene.add(
    new THREE.HemisphereLight(
        0xb9e8ff,
        0x172030,
        2
    )
);

const sun =
    new THREE.DirectionalLight(
        0xffffff,
        2
    );

sun.position.set(
    10,
    20,
    5
);

scene.add(sun);

// =====================================================
// FLOOR
// =====================================================

const floor =
    new THREE.Mesh(
        new THREE.PlaneGeometry(
            80,
            80
        ),
        new THREE.MeshStandardMaterial({
            color: 0x17212c,
            roughness: 0.9
        })
    );

floor.rotation.x =
    -Math.PI / 2;

scene.add(floor);

// =====================================================
// GRID
// =====================================================

const grid =
    new THREE.GridHelper(
        80,
        40,
        0x24465c,
        0x16303f
    );

grid.position.y =
    0.01;

scene.add(grid);

// =====================================================
// BOX CREATION
// =====================================================

function box(
    x,
    y,
    z,
    width,
    height,
    depth,
    color = 0x243849
) {

    const mesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),
            new THREE.MeshStandardMaterial({
                color: color
            })
        );

    mesh.position.set(
        x,
        y,
        z
    );

    scene.add(mesh);

    obstacles.push({

        x: x,
        y: y,
        z: z,

        width: width,
        height: height,
        depth: depth,

        top:
            y + height / 2,

        bottom:
            y - height / 2
    });

    return mesh;
}

// =====================================================
// ARENA WALLS
// =====================================================

box(
    0,
    2,
    -20,
    40,
    4,
    1
);

box(
    0,
    2,
    20,
    40,
    4,
    1
);

box(
    -20,
    2,
    0,
    1,
    4,
    40
);

box(
    20,
    2,
    0,
    1,
    4,
    40
);

// =====================================================
// PLATFORMS
// =====================================================

box(
    0,
    1,
    -7,
    8,
    2,
    2
);

box(
    -9,
    1,
    4,
    3,
    2,
    8
);

box(
    10,
    2,
    5,
    5,
    4,
    3
);

box(
    -3,
    3,
    11,
    7,
    6,
    2
);

box(
    7,
    2,
    -12,
    4,
    4,
    5
);

// =====================================================
// WEAPON
// =====================================================

const weapon =
    new THREE.Group();

const gun =
    new THREE.Mesh(
        new THREE.BoxGeometry(
            0.22,
            0.18,
            0.8
        ),
        new THREE.MeshStandardMaterial({
            color: 0x17191d
        })
    );

gun.position.set(
    0.42,
    -0.25,
    -0.7
);

weapon.add(gun);

camera.add(weapon);

scene.add(camera);

// =====================================================
// REMOTE PLAYER
// =====================================================

function makePlayer(
    color = 0xff3344
) {

    const group =
        new THREE.Group();

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.75,
                1.2,
                0.45
            ),
            new THREE.MeshStandardMaterial({
                color: color
            })
        );

    body.position.y =
        0.9;

    group.add(body);

    const head =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.28,
                12,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0xf0c7a0
            })
        );

    head.position.y =
        1.7;

    group.add(head);

    const gun =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.15,
                0.15,
                0.7
            ),
            new THREE.MeshStandardMaterial({
                color: 0x111318
            })
        );

    gun.position.set(
        0.42,
        1.15,
        -0.45
    );

    group.add(gun);

    scene.add(group);

    return group;
}

// =====================================================
// XZ OVERLAP
// =====================================================

function overlapsBoxXZ(
    x,
    z,
    obstacle
) {

    const minX =
        obstacle.x -
        obstacle.width / 2 -
        PLAYER_RADIUS;

    const maxX =
        obstacle.x +
        obstacle.width / 2 +
        PLAYER_RADIUS;

    const minZ =
        obstacle.z -
        obstacle.depth / 2 -
        PLAYER_RADIUS;

    const maxZ =
        obstacle.z +
        obstacle.depth / 2 +
        PLAYER_RADIUS;

    return (
        x > minX &&
        x < maxX &&
        z > minZ &&
        z < maxZ
    );
}

// =====================================================
// VERTICAL OVERLAP
// =====================================================
//
// This is the important fix.
//
// The player's body has a bottom and top.
// A box has a bottom and top.
//
// If those two volumes overlap,
// the player cannot move through the box.
//
// =====================================================

function verticalOverlap(
    playerBottom,
    playerTop,
    obstacle
) {

    return (
        playerTop >
            obstacle.bottom &&
        playerBottom <
            obstacle.top
    );
}

// =====================================================
// COLLISION TEST
// =====================================================

function collidesAt(
    x,
    y
) {

    const playerBottom =
        y - PLAYER_HEIGHT;

    const playerTop =
        y;

    // Arena boundaries

    if (
        x < -18.5 ||
        x > 18.5
    ) {

        return true;
    }

    if (
        camera.position.z < -18.5 ||
        camera.position.z > 18.5
    ) {

        // Don't use this directly
        // because we're testing Z
        // separately below.
    }

    for (
        const obstacle
        of obstacles
    ) {

        if (
            !overlapsBoxXZ(
                x,
                camera.position.z,
                obstacle
            )
        ) {

            continue;
        }

        if (
            verticalOverlap(
                playerBottom,
                playerTop,
                obstacle
            )
        ) {

            return true;
        }
    }

    return false;
}

// =====================================================
// TEST X MOVEMENT
// =====================================================

function canMoveToX(
    x
) {

    if (
        x < -18.5 ||
        x > 18.5
    ) {

        return false;
    }

    const bottom =
        camera.position.y -
        PLAYER_HEIGHT;

    const top =
        camera.position.y;

    for (
        const obstacle
        of obstacles
    ) {

        if (
            !overlapsBoxXZ(
                x,
                camera.position.z,
                obstacle
            )
        ) {

            continue;
        }

        if (
            verticalOverlap(
                bottom,
                top,
                obstacle
            )
        ) {

            return false;
        }
    }

    return true;
}

// =====================================================
// TEST Z MOVEMENT
// =====================================================

function canMoveToZ(
    z
) {

    if (
        z < -18.5 ||
        z > 18.5
    ) {

        return false;
    }

    const bottom =
        camera.position.y -
        PLAYER_HEIGHT;

    const top =
        camera.position.y;

    for (
        const obstacle
        of obstacles
    ) {

        if (
            !overlapsBoxXZ(
                camera.position.x,
                z,
                obstacle
            )
        ) {

            continue;
        }

        if (
            verticalOverlap(
                bottom,
                top,
                obstacle
            )
        ) {

            return false;
        }
    }

    return true;
}

// =====================================================
// FIND LANDING PLATFORM
// =====================================================

function findLandingPlatform(
    x,
    z,
    oldFeet,
    newFeet
) {

    let result = null;

    for (
        const obstacle
        of obstacles
    ) {

        // Need to be above the platform

        const insideX =
            x >
                obstacle.x -
                obstacle.width / 2 +
                PLAYER_RADIUS * 0.5 &&
            x <
                obstacle.x +
                obstacle.width / 2 -
                PLAYER_RADIUS * 0.5;

        const insideZ =
            z >
                obstacle.z -
                obstacle.depth / 2 +
                PLAYER_RADIUS * 0.5 &&
            z <
                obstacle.z +
                obstacle.depth / 2 -
                PLAYER_RADIUS * 0.5;

        if (
            !insideX ||
            !insideZ
        ) {

            continue;
        }

        const top =
            obstacle.top;

        // Must be falling

        if (
            verticalVelocity > 0
        ) {

            continue;
        }

        // Feet crossed platform top

        if (
            oldFeet >=
                top - 0.05 &&
            newFeet <=
                top + 0.05
        ) {

            if (
                !result ||
                top > result.top
            ) {

                result = obstacle;
            }
        }
    }

    return result;
}

// =====================================================
// MOVEMENT
// =====================================================

function move(dt) {

    const speed =
        keys.ShiftLeft ||
        keys.ShiftRight
            ? SPRINT_SPEED
            : WALK_SPEED;

    // =================================================
    // FORWARD
    // =================================================

    const forward =
        new THREE.Vector3();

    camera.getWorldDirection(
        forward
    );

    // Remove vertical look angle

    forward.y = 0;

    forward.normalize();

    // =================================================
    // RIGHT
    // =================================================

    const right =
        new THREE.Vector3();

    right.crossVectors(
        forward,
        new THREE.Vector3(
            0,
            1,
            0
        )
    );

    right.normalize();

    // =================================================
    // INPUT
    // =================================================

    const movement =
        new THREE.Vector3();

    if (keys.KeyW) {

        movement.add(
            forward
        );
    }

    if (keys.KeyS) {

        movement.sub(
            forward
        );
    }

    if (keys.KeyD) {

        movement.add(
            right
        );
    }

    if (keys.KeyA) {

        movement.sub(
            right
        );
    }

    // Normalize

    if (
        movement.lengthSq() > 0
    ) {

        movement
            .normalize()
            .multiplyScalar(
                speed * dt
            );
    }

    // =================================================
    // HORIZONTAL COLLISION
    // =================================================

    const nextX =
        camera.position.x +
        movement.x;

    const nextZ =
        camera.position.z +
        movement.z;

    // Move X independently

    if (
        canMoveToX(
            nextX
        )
    ) {

        camera.position.x =
            nextX;
    }

    // Move Z independently

    if (
        canMoveToZ(
            nextZ
        )
    ) {

        camera.position.z =
            nextZ;
    }

    // =================================================
    // JUMP
    // =================================================

    if (
        keys.Space &&
        onGround
    ) {

        verticalVelocity =
            JUMP_POWER;

        onGround = false;

        keys.Space = false;
    }

    // =================================================
    // GRAVITY
    // =================================================

    const oldY =
        camera.position.y;

    const oldFeet =
        oldY -
        PLAYER_HEIGHT;

    verticalVelocity -=
        GRAVITY * dt;

    let newY =
        camera.position.y +
        verticalVelocity * dt;

    const newFeet =
        newY -
        PLAYER_HEIGHT;

    // =================================================
    // LAND ON PLATFORM
    // =================================================

    const landing =
        findLandingPlatform(
            camera.position.x,
            camera.position.z,
            oldFeet,
            newFeet
        );

    if (landing) {

        newY =
            landing.top +
            PLAYER_HEIGHT;

        verticalVelocity = 0;

        onGround = true;

    } else if (
        newY <= PLAYER_HEIGHT
    ) {

        // Ground

        newY =
            PLAYER_HEIGHT;

        verticalVelocity = 0;

        onGround = true;

    } else {

        onGround = false;
    }

    camera.position.y =
        newY;

    // =================================================
    // CAMERA
    // =================================================

    camera.rotation.order =
        "YXZ";

    camera.rotation.y =
        yaw;

    camera.rotation.x =
        pitch;

    // =================================================
    // SEND STATE
    // =================================================

    if (currentRoom) {

        socket.emit(
            "state",
            {
                x:
                    camera.position.x,

                y:
                    camera.position.y,

                z:
                    camera.position.z,

                ry:
                    yaw
            }
        );
    }
}

// =====================================================
// MOUSE LOOK
// =====================================================

document.addEventListener(
    "mousemove",
    event => {

        if (
            document.pointerLockElement !==
            renderer.domElement
        ) {

            return;
        }

        yaw -=
            event.movementX *
            0.0022;

        pitch -=
            event.movementY *
            0.0022;

        pitch =
            Math.max(
                -1.45,
                Math.min(
                    1.45,
                    pitch
                )
            );
    }
);

// =====================================================
// POINTER LOCK
// =====================================================

renderer.domElement.addEventListener(
    "click",
    () => {

        if (started) {

            renderer
                .domElement
                .requestPointerLock();
        }
    }
);

// =====================================================
// KEY DOWN
// =====================================================

addEventListener(
    "keydown",
    event => {

        keys[event.code] = true;

        if (
            event.code === "Space"
        ) {

            event.preventDefault();
        }

        if (
            event.code === "KeyR"
        ) {

            reload();
        }
    }
);

// =====================================================
// KEY UP
// =====================================================

addEventListener(
    "keyup",
    event => {

        keys[event.code] = false;
    }
);

// =====================================================
// SHOOTING
// =====================================================

renderer.domElement.addEventListener(
    "mousedown",
    event => {

        if (
            event.button === 0 &&
            started
        ) {

            shooting = true;
        }
    }
);

addEventListener(
    "mouseup",
    event => {

        if (
            event.button === 0
        ) {

            shooting = false;
        }
    }
);

// =====================================================
// RELOAD
// =====================================================

function reload() {

    if (
        reloading ||
        ammo >= 30 ||
        reserve <= 0
    ) {

        return;
    }

    reloading = true;

    showMessage(
        "RELOADING..."
    );

    setTimeout(
        () => {

            const amount =
                Math.min(
                    30 - ammo,
                    reserve
                );

            ammo += amount;

            reserve -= amount;

            reloading = false;

            ammoEl.textContent =
                `${ammo} / ${reserve}`;

        },
        900
    );
}

// =====================================================
// SHOOT
// =====================================================

function shoot() {

    const now =
        performance.now();

    if (
        now - lastShot <
        FIRE_RATE
    ) {

        return;
    }

    if (reloading)
        return;

    if (ammo <= 0) {

        reload();

        return;
    }

    lastShot = now;

    ammo--;

    ammoEl.textContent =
        `${ammo} / ${reserve}`;

    const origin =
        camera.getWorldPosition(
            new THREE.Vector3()
        );

    const direction =
        new THREE.Vector3(
            0,
            0,
            -1
        )
            .applyQuaternion(
                camera.quaternion
            )
            .normalize();

    let best = null;

    let bestDistance =
        Infinity;

    for (
        const [id, p]
        of players
    ) {

        const target =
            new THREE.Vector3(
                p.x,
                p.y + 1,
                p.z
            );

        const to =
            target
                .clone()
                .sub(origin);

        const distance =
            to.dot(direction);

        if (
            distance < 0 ||
            distance > 70
        ) {

            continue;
        }

        const closest =
            origin
                .clone()
                .add(
                    direction
                        .clone()
                        .multiplyScalar(
                            distance
                        )
                );

        const miss =
            target.distanceTo(
                closest
            );

        if (
            miss < 1.2 &&
            distance <
                bestDistance
        ) {

            best = {
                id: id
            };

            bestDistance =
                distance;
        }
    }

    if (best) {

        socket.emit(
            "shoot",
            {
                targetId:
                    best.id
            }
        );
    }
}

// =====================================================
// REMOTE PLAYERS
// =====================================================

function updateRemote(dt) {

    for (
        const p
        of players.values()
    ) {

        p.mesh.position.lerp(
            new THREE.Vector3(
                p.x,
                p.y - 1.2,
                p.z
            ),
            Math.min(
                1,
                dt * 12
            )
        );

        p.mesh.rotation.y =
            p.ry;
    }
}

// =====================================================
// SCOREBOARD
// =====================================================

function updateBoard(list) {

    board.innerHTML =
        [...list]
            .sort(
                (a, b) =>
                    (b.score || 0) -
                    (a.score || 0)
            )
            .map(
                p =>
                    `<div class="row ${
                        p.id === myId
                            ? "me"
                            : ""
                    }">
                        ${escapeHtml(
                            p.name
                        )}
                        — ${
                            p.score || 0
                        }
                    </div>`
            )
            .join("");
}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

    return String(value).replace(
        /[&<>"']/g,
        character => {

            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character];
        }
    );
}

// =====================================================
// MESSAGE
// =====================================================

function showMessage(text) {

    message.textContent =
        text;

    setTimeout(
        () => {

            if (
                message.textContent ===
                text
            ) {

                message.textContent =
                    "";
            }

        },
        1200
    );
}

// =====================================================
// GAME LOOP
// =====================================================

function animate() {

    requestAnimationFrame(
        animate
    );

    const dt =
        Math.min(
            clock.getDelta(),
            0.05
        );

    if (started) {

        move(dt);

        if (shooting) {

            shoot();
        }
    }

    updateRemote(dt);

    renderer.render(
        scene,
        camera
    );
}

animate();

// =====================================================
// RESIZE
// =====================================================

addEventListener(
    "resize",
    () => {

        camera.aspect =
            innerWidth /
            innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            innerWidth,
            innerHeight
        );
    }
);

// =====================================================
// HUD
// =====================================================

ammoEl.textContent =
    `${ammo} / ${reserve}`;

healthEl.textContent =
    "HP 100";