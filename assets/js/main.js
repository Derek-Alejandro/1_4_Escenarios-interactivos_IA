/* =========================================================
   IMPORTACIONES
========================================================= */

import * as THREE from 'three';

import {
    GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import RAPIER from
    'https://cdn.skypack.dev/@dimforge/rapier3d-compat';



/* =========================================================
   INICIALIZAR RAPIER
========================================================= */

await RAPIER.init();



/* =========================================================
   CONTENEDOR
========================================================= */

const container =
    document.getElementById(
        'scene-container'
    );



/* =========================================================
   ESCENA
========================================================= */

const scene =
    new THREE.Scene();


scene.background =
    new THREE.Color(
        0x07111f
    );


scene.fog =
    new THREE.Fog(
        0x07111f,
        18,
        65
    );



/* =========================================================
   CÁMARA
========================================================= */

const camera =
    new THREE.PerspectiveCamera(

        70,

        window.innerWidth /
        window.innerHeight,

        0.1,

        1000

    );


camera.rotation.order =
    'YXZ';



/* =========================================================
   RENDERER
========================================================= */

const renderer =
    new THREE.WebGLRenderer({

        antialias: true

    });


renderer.setPixelRatio(

    Math.min(
        window.devicePixelRatio,
        2
    )

);


renderer.setSize(

    window.innerWidth,

    window.innerHeight

);


renderer.shadowMap.enabled =
    true;


renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


renderer.outputColorSpace =
    THREE.SRGBColorSpace;


renderer.toneMapping =
    THREE.ACESFilmicToneMapping;


renderer.toneMappingExposure =
    1.1;


container.appendChild(
    renderer.domElement
);



/* =========================================================
   ILUMINACIÓN
========================================================= */

const hemisphereLight =
    new THREE.HemisphereLight(

        0xbfe3ff,

        0x182030,

        1.8

    );


scene.add(
    hemisphereLight
);


const sun =
    new THREE.DirectionalLight(

        0xffffff,

        3

    );


sun.position.set(

    -5,
    18,
    6

);


sun.castShadow =
    true;


sun.shadow.mapSize.set(

    2048,
    2048

);


sun.shadow.camera.near =
    0.5;


sun.shadow.camera.far =
    100;


sun.shadow.camera.left =
    -35;


sun.shadow.camera.right =
    35;


sun.shadow.camera.top =
    35;


sun.shadow.camera.bottom =
    -35;


sun.shadow.bias =
    -0.0001;


scene.add(
    sun
);



/* =========================================================
   RELOJ
========================================================= */

const clock =
    new THREE.Clock();



/* =========================================================
   MUNDO FÍSICO RAPIER
========================================================= */

const gravity = {

    x: 0,

    y: -9.81,

    z: 0

};


const physicsWorld =
    new RAPIER.World(
        gravity
    );


physicsWorld.integrationParameters.maxCcdSubsteps =
    4;



/* =========================================================
   JUGADOR
========================================================= */

/*
    Medidas aproximadas equivalentes
    a la cápsula que utilizábamos antes.
*/

const PLAYER_RADIUS =
    0.35;


const PLAYER_HALF_HEIGHT =
    0.325;


/*
    Centro del jugador.
*/

const PLAYER_START = {

    x: 0,

    y: 0.675,

    z: 0

};


/*
    Cámara situada aproximadamente
    a la altura de los ojos.
*/

const PLAYER_EYE_OFFSET =
    0.325;



/* =========================================================
   CUERPO CINEMÁTICO DEL JUGADOR
========================================================= */

const playerBodyDesc =

    RAPIER.RigidBodyDesc
        .kinematicPositionBased()

        .setTranslation(

            PLAYER_START.x,

            PLAYER_START.y,

            PLAYER_START.z

        );


const playerBody =

    physicsWorld
        .createRigidBody(
            playerBodyDesc
        );



/* =========================================================
   COLLIDER DEL JUGADOR
========================================================= */

const playerColliderDesc =

    RAPIER.ColliderDesc
        .capsule(

            PLAYER_HALF_HEIGHT,

            PLAYER_RADIUS

        )

        .setFriction(
            0
        );


const playerCollider =

    physicsWorld
        .createCollider(

            playerColliderDesc,

            playerBody

        );



/* =========================================================
   CHARACTER CONTROLLER
========================================================= */

/*
    El pequeño offset evita que la cápsula
    quede pegada exactamente a las superficies.
*/

const characterController =

    physicsWorld
        .createCharacterController(
            0.025
        );


/*
    IMPORTANTE:

    false significa que NO intentará subir
    automáticamente encima de los cubos dinámicos.

    Por lo tanto, al caminar contra un cubo,
    chocaremos contra él.
*/

characterController.enableAutostep(

    0.25,

    0.15,

    false

);


/*
    Mantiene al jugador pegado al suelo
    al caminar por pequeñas pendientes.
*/

characterController.enableSnapToGround(
    0.2
);


/*
    Pendiente máxima.
*/

characterController.setMaxSlopeClimbAngle(

    45 *
    Math.PI /
    180

);


/*
    Permitir que el jugador empuje
    objetos dinámicos.

    El jugador no los atraviesa.
*/

characterController
    .setApplyImpulsesToDynamicBodies(
        true
    );


characterController
    .setCharacterMass(
        55
    );



/* =========================================================
   VELOCIDAD DEL JUGADOR
========================================================= */

const playerVelocity =
    new THREE.Vector3();


const playerDirection =
    new THREE.Vector3();


let playerOnFloor =
    false;



/* =========================================================
   TECLADO
========================================================= */

const keyStates = {};



/* =========================================================
   OBJETOS
========================================================= */

const physicalObjects = [];

const lasers = [];

const scenarioMeshes = [];

const spawnPositions = [];


let scenarioBounds =
    null;


let scenarioReady =
    false;



/* =========================================================
   CONFIGURACIÓN DE CUBOS
========================================================= */

/*
    Cubos completamente aleatorios
    repartidos por el escenario.
*/

const RANDOM_BOX_COUNT =
    12;


/*
    Número de pirámides.
*/

const PYRAMID_COUNT =
    2;


/*
    Cada pirámide tendrá:

    nivel 1 = 4 cubos
    nivel 2 = 3 cubos
    nivel 3 = 2 cubos
    nivel 4 = 1 cubo

    Total: 10 cubos.
*/

const PYRAMID_BASE =
    4;


const SPAWN_MARGIN =
    2;


const PLAYER_SAFE_DISTANCE =
    4;


const MAX_SPAWN_ATTEMPTS =
    200;



/* =========================================================
   RAYCASTER PARA DETECTAR SUELO
========================================================= */

const groundRaycaster =
    new THREE.Raycaster();


const downDirection =
    new THREE.Vector3(
        0,
        -1,
        0
    );


const rayOrigin =
    new THREE.Vector3();


const worldNormal =
    new THREE.Vector3();


const normalMatrix =
    new THREE.Matrix3();



/* =========================================================
   FÍSICA DEL ESCENARIO
========================================================= */

function createStaticColliderFromMesh(
    mesh
) {

    const geometry =
        mesh.geometry;


    if (

        !geometry ||

        !geometry.attributes.position

    ) {

        return;

    }


    const position =
        geometry.attributes.position;


    const vertexCount =
        position.count;


    const vertices =

        new Float32Array(

            vertexCount *
            3

        );


    const vertex =
        new THREE.Vector3();



    /* =====================================================
       VÉRTICES
    ===================================================== */

    for (

        let i = 0;

        i < vertexCount;

        i++

    ) {

        vertex
            .fromBufferAttribute(

                position,

                i

            )

            .applyMatrix4(

                mesh.matrixWorld

            );


        vertices[
            i * 3
        ] =
            vertex.x;


        vertices[
            i * 3 + 1
        ] =
            vertex.y;


        vertices[
            i * 3 + 2
        ] =
            vertex.z;

    }



    /* =====================================================
       ÍNDICES
    ===================================================== */

    let indices;


    if (
        geometry.index
    ) {

        const original =
            geometry.index.array;


        indices =
            new Uint32Array(
                original.length
            );


        for (

            let i = 0;

            i < original.length;

            i++

        ) {

            indices[i] =
                original[i];

        }

    } else {

        const validCount =

            Math.floor(

                vertexCount /
                3

            )

            * 3;


        indices =
            new Uint32Array(
                validCount
            );


        for (

            let i = 0;

            i < validCount;

            i++

        ) {

            indices[i] =
                i;

        }

    }



    if (
        indices.length < 3
    ) {

        return;

    }



    /* =====================================================
       TRIMESH RAPIER
    ===================================================== */

    const colliderDesc =

        RAPIER.ColliderDesc
            .trimesh(

                vertices,

                indices

            )

            .setFriction(
                0.9
            )

            .setRestitution(
                0.02
            );


    physicsWorld
        .createCollider(
            colliderDesc
        );

}



/* =========================================================
   CREAR FÍSICA DEL ESCENARIO COMPLETO
========================================================= */

function createScenarioPhysics(
    model
) {

    model.updateMatrixWorld(
        true
    );


    let total =
        0;


    model.traverse(

        (child) => {

            if (
                !child.isMesh
            ) {

                return;

            }


            scenarioMeshes.push(
                child
            );


            createStaticColliderFromMesh(
                child
            );


            total++;

        }

    );


    console.log(

        `Meshes físicas del escenario: ${total}`

    );

}



/* =========================================================
   CREAR CUBO FÍSICO
========================================================= */

function createDynamicBox(

    x,
    y,
    z,

    sx,
    sy,
    sz,

    mass = 4,

    color = 0x94a3b8

) {

    /* =====================================================
       THREE.JS
    ===================================================== */

    const geometry =

        new THREE.BoxGeometry(

            sx,
            sy,
            sz

        );


    const material =

        new THREE.MeshStandardMaterial({

            color,

            roughness:
                0.72,

            metalness:
                0.05

        });


    const mesh =

        new THREE.Mesh(

            geometry,

            material

        );


    mesh.position.set(

        x,
        y,
        z

    );


    mesh.castShadow =
        true;


    mesh.receiveShadow =
        true;


    scene.add(
        mesh
    );



    /* =====================================================
       CUERPO FÍSICO
    ===================================================== */

    const bodyDesc =

        RAPIER.RigidBodyDesc
            .dynamic()

            .setTranslation(

                x,
                y,
                z

            )

            /*
                Evita atravesar superficies
                a altas velocidades.
            */

            .setCcdEnabled(
                true
            )

            .setLinearDamping(
                0.08
            )

            .setAngularDamping(
                0.15
            );


    const body =

        physicsWorld
            .createRigidBody(
                bodyDesc
            );



    /* =====================================================
       COLLIDER
    ===================================================== */

    const volume =

        Math.max(

            sx *
            sy *
            sz,

            0.01

        );


    const density =

        mass /
        volume;


    const colliderDesc =

        RAPIER.ColliderDesc
            .cuboid(

                sx / 2,

                sy / 2,

                sz / 2

            )

            .setDensity(
                density
            )

            .setFriction(
                0.9
            )

            .setRestitution(
                0.03
            );


    const collider =

        physicsWorld
            .createCollider(

                colliderDesc,

                body

            );



    /* =====================================================
       GUARDAR REFERENCIAS
    ===================================================== */

    physicalObjects.push({

        mesh,

        body,

        collider,

        size: {

            x: sx,

            y: sy,

            z: sz

        }

    });


    return {

        mesh,

        body,

        collider

    };

}



/* =========================================================
   ENCONTRAR EL SUELO
========================================================= */

function findGroundPosition(
    x,
    z
) {

    if (

        !scenarioBounds ||

        scenarioMeshes.length === 0

    ) {

        return null;

    }



    rayOrigin.set(

        x,

        scenarioBounds.max.y +
        10,

        z

    );


    groundRaycaster.set(

        rayOrigin,

        downDirection

    );


    groundRaycaster.far =

        (
            scenarioBounds.max.y -
            scenarioBounds.min.y
        )

        + 30;



    const intersections =

        groundRaycaster
            .intersectObjects(

                scenarioMeshes,

                false

            );



    for (
        const hit
        of intersections
    ) {

        if (
            !hit.face
        ) {

            continue;

        }



        normalMatrix
            .getNormalMatrix(

                hit.object.matrixWorld

            );


        worldNormal
            .copy(
                hit.face.normal
            )

            .applyMatrix3(
                normalMatrix
            )

            .normalize();



        /*
            Solo superficies suficientemente
            horizontales.
        */

        if (
            worldNormal.y >= 0.88
        ) {

            return {

                point:
                    hit.point.clone(),

                normal:
                    worldNormal.clone()

            };

        }

    }


    return null;

}



/* =========================================================
   COMPROBAR POSICIÓN LIBRE
========================================================= */

function isSpawnPositionFree(

    x,
    z,
    radius

) {

    /*
        Evitar aparecer encima
        del jugador.
    */

    const distancePlayer =

        Math.hypot(

            x -
            PLAYER_START.x,

            z -
            PLAYER_START.z

        );


    if (
        distancePlayer <
        PLAYER_SAFE_DISTANCE
    ) {

        return false;

    }



    /*
        Evitar generar estructuras
        unas encima de otras.
    */

    for (
        const position
        of spawnPositions
    ) {

        const distance =

            Math.hypot(

                x -
                position.x,

                z -
                position.z

            );


        if (

            distance <

            radius +
            position.radius

        ) {

            return false;

        }

    }


    return true;

}



/* =========================================================
   REGISTRAR ESPACIO OCUPADO
========================================================= */

function registerSpawn(

    x,

    z,

    radius

) {

    spawnPositions.push({

        x,

        z,

        radius

    });

}



/* =========================================================
   BUSCAR ZONA PLANA
========================================================= */

function findFlatArea(

    x,

    z,

    radius

) {

    const samples = [

        [0, 0],

        [radius, 0],

        [-radius, 0],

        [0, radius],

        [0, -radius],

        [radius, radius],

        [-radius, radius],

        [radius, -radius],

        [-radius, -radius]

    ];


    const heights = [];


    for (
        const [dx, dz]
        of samples
    ) {

        const ground =

            findGroundPosition(

                x + dx,

                z + dz

            );


        if (
            !ground
        ) {

            return null;

        }


        heights.push(
            ground.point.y
        );

    }



    const minHeight =
        Math.min(
            ...heights
        );


    const maxHeight =
        Math.max(
            ...heights
        );


    /*
        No generar una pirámide
        sobre una zona inclinada.
    */

    if (

        maxHeight -
        minHeight >

        0.18

    ) {

        return null;

    }


    return {

        y:
            heights[0]

    };

}



/* =========================================================
   COLOR ALEATORIO DE LOS CUBOS
========================================================= */

function randomBoxColor() {

    const colors = [

        0x94a3b8,

        0x64748b,

        0xcbd5e1,

        0x78909c,

        0x9ca3af,

        0x7dd3fc

    ];


    return colors[

        Math.floor(

            Math.random() *
            colors.length

        )

    ];

}



/* =========================================================
   GENERAR CUBOS ALEATORIOS DE DIFERENTES TAMAÑOS
========================================================= */

function generateRandomBoxes() {

    const minX =

        scenarioBounds.min.x +
        SPAWN_MARGIN;


    const maxX =

        scenarioBounds.max.x -
        SPAWN_MARGIN;


    const minZ =

        scenarioBounds.min.z +
        SPAWN_MARGIN;


    const maxZ =

        scenarioBounds.max.z -
        SPAWN_MARGIN;



    let created =
        0;



    for (

        let i = 0;

        i < RANDOM_BOX_COUNT;

        i++

    ) {

        /*
            TAMAÑOS ALEATORIOS.

            Ahora podemos encontrar cubos
            pequeños, medianos y grandes.
        */

        const sx =

            THREE.MathUtils.randFloat(

                0.55,

                1.6

            );


        const sy =

            THREE.MathUtils.randFloat(

                0.55,

                1.8

            );


        const sz =

            THREE.MathUtils.randFloat(

                0.55,

                1.6

            );


        const radius =

            Math.max(
                sx,
                sz
            )

            * 0.75;



        for (

            let attempt = 0;

            attempt < MAX_SPAWN_ATTEMPTS;

            attempt++

        ) {

            const x =

                THREE.MathUtils.randFloat(

                    minX,

                    maxX

                );


            const z =

                THREE.MathUtils.randFloat(

                    minZ,

                    maxZ

                );



            if (

                !isSpawnPositionFree(

                    x,

                    z,

                    radius

                )

            ) {

                continue;

            }



            const ground =

                findGroundPosition(

                    x,

                    z

                );


            if (
                !ground
            ) {

                continue;

            }



            const y =

                ground.point.y +

                sy / 2 +

                0.03;



            createDynamicBox(

                x,

                y,

                z,

                sx,

                sy,

                sz,

                THREE.MathUtils.randFloat(
                    3,
                    10
                ),

                randomBoxColor()

            );



            registerSpawn(

                x,

                z,

                radius

            );


            created++;


            break;

        }

    }



    console.log(

        `Cubos aleatorios creados: ${created}`

    );

}



/* =========================================================
   BUSCAR UBICACIÓN PARA UNA PIRÁMIDE
========================================================= */

function findPyramidSpawn(

    baseCount,

    cubeSize

) {

    const footprint =

        baseCount *
        cubeSize;


    const radius =

        footprint *
        0.65;



    const minX =

        scenarioBounds.min.x +

        radius +

        SPAWN_MARGIN;


    const maxX =

        scenarioBounds.max.x -

        radius -

        SPAWN_MARGIN;


    const minZ =

        scenarioBounds.min.z +

        radius +

        SPAWN_MARGIN;


    const maxZ =

        scenarioBounds.max.z -

        radius -

        SPAWN_MARGIN;



    if (

        minX >= maxX ||

        minZ >= maxZ

    ) {

        return null;

    }



    for (

        let attempt = 0;

        attempt <
        MAX_SPAWN_ATTEMPTS;

        attempt++

    ) {

        const x =

            THREE.MathUtils.randFloat(

                minX,

                maxX

            );


        const z =

            THREE.MathUtils.randFloat(

                minZ,

                maxZ

            );



        if (

            !isSpawnPositionFree(

                x,

                z,

                radius

            )

        ) {

            continue;

        }



        const flatArea =

            findFlatArea(

                x,

                z,

                radius * 0.75

            );


        if (
            !flatArea
        ) {

            continue;

        }



        registerSpawn(

            x,

            z,

            radius +
            1

        );


        return {

            x,

            y:
                flatArea.y,

            z

        };

    }


    return null;

}



/* =========================================================
   CREAR PIRÁMIDE DERRIBABLE
========================================================= */

function createPyramid(

    centerX,

    groundY,

    centerZ,

    cubeSize,

    levels

) {

    /*
        Dejamos una separación muy pequeña.

        Esto evita que los colliders nazcan
        exactamente superpuestos.
    */

    const horizontalSpacing =

        cubeSize *
        1.03;


    const verticalSpacing =

        cubeSize *
        1.015;



    /*
        La pirámide puede mirar hacia
        una dirección distinta en cada partida.
    */

    const yaw =

        THREE.MathUtils.randFloat(

            0,

            Math.PI *
            2

        );


    const cos =

        Math.cos(
            yaw
        );


    const sin =

        Math.sin(
            yaw
        );



    /*
        Ejemplo con 4 niveles:

        [] [] [] []
          [] [] []
            [] []
              []
    */

    for (

        let level = 0;

        level < levels;

        level++

    ) {

        const boxesOnLevel =

            levels -
            level;


        const levelWidth =

            (
                boxesOnLevel -
                1
            )

            *
            horizontalSpacing;



        for (

            let i = 0;

            i < boxesOnLevel;

            i++

        ) {

            /*
                Posición horizontal local.
            */

            const localX =

                -levelWidth /
                2

                +

                i *
                horizontalSpacing;



            /*
                Giramos toda la pirámide
                alrededor del eje Y.
            */

            const rotatedX =

                localX *
                cos;


            const rotatedZ =

                localX *
                sin;



            const x =

                centerX +
                rotatedX;


            const z =

                centerZ +
                rotatedZ;


            const y =

                groundY +

                cubeSize /
                2

                +

                level *
                verticalSpacing;



            /*
                Los bloques de las pirámides
                tienen masas moderadas.

                Son estables al comenzar,
                pero un disparo puede derribarlos.
            */

            createDynamicBox(

                x,

                y,

                z,

                cubeSize,

                cubeSize,

                cubeSize,

                THREE.MathUtils.randFloat(
                    3.5,
                    5
                ),

                randomBoxColor()

            );

        }

    }

}



/* =========================================================
   GENERAR PIRÁMIDES
========================================================= */

function generatePyramids() {

    let created =
        0;



    for (

        let i = 0;

        i < PYRAMID_COUNT;

        i++

    ) {

        /*
            Cada pirámide puede tener
            cubos de un tamaño distinto.

            Una podría tener cubos de 0.75
            y otra de 1.05, por ejemplo.
        */

        const cubeSize =

            THREE.MathUtils.randFloat(

                0.75,

                1.05

            );


        const location =

            findPyramidSpawn(

                PYRAMID_BASE,

                cubeSize

            );


        if (
            !location
        ) {

            console.warn(

                `No se encontró espacio para la pirámide ${i + 1}.`

            );


            continue;

        }



        createPyramid(

            location.x,

            location.y,

            location.z,

            cubeSize,

            PYRAMID_BASE

        );


        created++;

    }



    console.log(

        `Pirámides creadas: ${created}`

    );

}



/* =========================================================
   CARGAR ESCENARIO
========================================================= */

const loader =
    new GLTFLoader();


loader.load(

    './assets/models/collision-world.glb',


    /* =====================================================
       MODELO CARGADO
    ===================================================== */

    (gltf) => {

        const model =
            gltf.scene;



        /* =================================================
           CONFIGURAR MODELO
        ================================================= */

        model.traverse(

            (child) => {

                if (
                    !child.isMesh
                ) {

                    return;

                }


                child.castShadow =
                    true;


                child.receiveShadow =
                    true;



                if (
                    child.material?.map
                ) {

                    child.material
                        .map
                        .anisotropy =

                        Math.min(

                            8,

                            renderer
                                .capabilities
                                .getMaxAnisotropy()

                        );

                }

            }

        );



        scene.add(
            model
        );


        model.updateMatrixWorld(
            true
        );



        /* =================================================
           LÍMITES
        ================================================= */

        scenarioBounds =

            new THREE.Box3()
                .setFromObject(
                    model
                );



        /* =================================================
           FÍSICA DEL MAPA
        ================================================= */

        createScenarioPhysics(
            model
        );



        /* =================================================
           PRIMERO PIRÁMIDES
        ================================================= */

        generatePyramids();



        /* =================================================
           DESPUÉS CUBOS ALEATORIOS
        ================================================= */

        generateRandomBoxes();



        /* =================================================
           ACTIVAR ESCENARIO
        ================================================= */

        scenarioReady =
            true;


        /*
            Sincronizamos inicialmente
            la posición de la cámara.
        */

        updateCameraFromPlayer();


        console.log(

            'Escenario preparado correctamente.'

        );

    },


    /* =====================================================
       PROGRESO
    ===================================================== */

    (xhr) => {

        if (
            xhr.total >
            0
        ) {

            const progress =

                (
                    xhr.loaded /
                    xhr.total
                )

                *
                100;


            console.log(

                `Cargando escenario: ${progress.toFixed(0)}%`

            );

        }

    },


    /* =====================================================
       ERROR
    ===================================================== */

    (error) => {

        console.error(

            'Error al cargar collision-world.glb:',

            error

        );

    }

);



/* =========================================================
   VECTOR HACIA ADELANTE
========================================================= */

function getForwardVector() {

    camera.getWorldDirection(
        playerDirection
    );


    playerDirection.y =
        0;


    if (
        playerDirection.lengthSq() >
        0
    ) {

        playerDirection
            .normalize();

    }


    return playerDirection;

}



/* =========================================================
   VECTOR LATERAL
========================================================= */

function getSideVector() {

    camera.getWorldDirection(
        playerDirection
    );


    playerDirection.y =
        0;


    if (
        playerDirection.lengthSq() >
        0
    ) {

        playerDirection
            .normalize();

    }


    playerDirection
        .cross(
            camera.up
        );


    return playerDirection;

}



/* =========================================================
   CONTROLES DEL JUGADOR
========================================================= */

function controls(
    deltaTime
) {

    const acceleration =

        playerOnFloor

            ? 18

            : 7;



    /* =====================================================
       W
    ===================================================== */

    if (
        keyStates.KeyW
    ) {

        playerVelocity.add(

            getForwardVector()
                .multiplyScalar(

                    acceleration *
                    deltaTime

                )

        );

    }



    /* =====================================================
       S
    ===================================================== */

    if (
        keyStates.KeyS
    ) {

        playerVelocity.add(

            getForwardVector()
                .multiplyScalar(

                    -acceleration *
                    deltaTime

                )

        );

    }



    /* =====================================================
       A
    ===================================================== */

    if (
        keyStates.KeyA
    ) {

        playerVelocity.add(

            getSideVector()
                .multiplyScalar(

                    -acceleration *
                    deltaTime

                )

        );

    }



    /* =====================================================
       D
    ===================================================== */

    if (
        keyStates.KeyD
    ) {

        playerVelocity.add(

            getSideVector()
                .multiplyScalar(

                    acceleration *
                    deltaTime

                )

        );

    }



    /* =====================================================
       SALTO
    ===================================================== */

    if (

        playerOnFloor &&

        keyStates.Space

    ) {

        playerVelocity.y =
            7;


        playerOnFloor =
            false;

    }

}



/* =========================================================
   MOVIMIENTO FÍSICO DEL JUGADOR
========================================================= */

function updatePlayer(
    deltaTime
) {

    /* =====================================================
       FRICCIÓN HORIZONTAL
    ===================================================== */

    const horizontalDamping =

        Math.exp(

            -4 *
            deltaTime

        );


    playerVelocity.x *=
        horizontalDamping;


    playerVelocity.z *=
        horizontalDamping;



    /* =====================================================
       GRAVEDAD
    ===================================================== */

    if (
        playerOnFloor
    ) {

        /*
            Pequeña fuerza hacia abajo para
            mantener contacto con el piso.
        */

        if (
            playerVelocity.y <
            0
        ) {

            playerVelocity.y =
                -0.5;

        }

    } else {

        playerVelocity.y -=

            25 *
            deltaTime;

    }



    /* =====================================================
       MOVIMIENTO DESEADO
    ===================================================== */

    const desiredMovement = {

        x:
            playerVelocity.x *
            deltaTime,

        y:
            playerVelocity.y *
            deltaTime,

        z:
            playerVelocity.z *
            deltaTime

    };



    /*
        Rapier calcula cuánto podemos
        movernos realmente sin atravesar:

        - paredes
        - pisos
        - cubos
        - pirámides
        - otros colliders
    */

    characterController
        .computeColliderMovement(

            playerCollider,

            desiredMovement

        );



    const movement =

        characterController
            .computedMovement();



    /*
        Saber si el jugador está
        tocando suelo.
    */

    playerOnFloor =

        characterController
            .computedGrounded();



    /*
        Si caíamos pero el movimiento vertical
        fue detenido por el suelo, eliminamos
        velocidad descendente.
    */

    if (

        playerOnFloor &&

        playerVelocity.y <
        0

    ) {

        playerVelocity.y =
            0;

    }



    const current =

        playerBody
            .translation();



    /*
        Posición física corregida.
    */

    playerBody
        .setNextKinematicTranslation({

            x:
                current.x +
                movement.x,

            y:
                current.y +
                movement.y,

            z:
                current.z +
                movement.z

        });

}



/* =========================================================
   POSICIÓN DE CÁMARA SEGÚN JUGADOR
========================================================= */

function updateCameraFromPlayer() {

    const position =

        playerBody
            .translation();


    camera.position.set(

        position.x,

        position.y +
        PLAYER_EYE_OFFSET,

        position.z

    );



    /* =====================================================
       SI CAEMOS FUERA DEL MAPA
    ===================================================== */

    if (
        position.y <
        -20
    ) {

        resetPlayer();

    }

}



/* =========================================================
   REINICIAR JUGADOR
========================================================= */

function resetPlayer() {

    playerBody
        .setTranslation(

            {

                x:
                    PLAYER_START.x,

                y:
                    PLAYER_START.y,

                z:
                    PLAYER_START.z

            },

            true

        );


    playerBody
        .setNextKinematicTranslation({

            x:
                PLAYER_START.x,

            y:
                PLAYER_START.y,

            z:
                PLAYER_START.z

        });


    playerVelocity.set(

        0,
        0,
        0

    );


    playerOnFloor =
        false;


    updateCameraFromPlayer();

}



/* =========================================================
   DISPARAR LÁSER
========================================================= */

function shootLaser() {

    if (

        document.pointerLockElement !==
        renderer.domElement

    ) {

        return;

    }



    const direction =
        new THREE.Vector3();


    camera.getWorldDirection(
        direction
    );


    direction.normalize();



    const geometry =

        new THREE.CylinderGeometry(

            0.035,

            0.035,

            0.9,

            10

        );


    geometry.rotateX(

        Math.PI /
        2

    );



    const material =

        new THREE.MeshStandardMaterial({

            color:
                0x67e8f9,

            emissive:
                0x22d3ee,

            emissiveIntensity:
                5,

            roughness:
                0.25

        });



    const mesh =

        new THREE.Mesh(

            geometry,

            material

        );


    mesh.position
        .copy(
            camera.position
        )

        .addScaledVector(

            direction,

            0.8

        );


    mesh.quaternion
        .setFromUnitVectors(

            new THREE.Vector3(
                0,
                0,
                1
            ),

            direction

        );


    scene.add(
        mesh
    );


    lasers.push({

        mesh,

        direction,

        speed:
            35,

        life:
            1.8

    });

}



/* =========================================================
   EFECTO DEL IMPACTO
========================================================= */

function createImpact(
    position
) {

    const flash =

        new THREE.PointLight(

            0x67e8f9,

            8,

            4,

            2

        );


    flash.position
        .copy(
            position
        );


    scene.add(
        flash
    );


    setTimeout(

        () => {

            scene.remove(
                flash
            );

        },

        90

    );

}



/* =========================================================
   ELIMINAR LÁSER
========================================================= */

function removeLaser(
    index
) {

    const laser =
        lasers[index];


    scene.remove(
        laser.mesh
    );


    laser.mesh
        .geometry
        .dispose();


    laser.mesh
        .material
        .dispose();


    lasers.splice(

        index,

        1

    );

}



/* =========================================================
   ACTUALIZAR LÁSERES
========================================================= */

function updateLasers(
    deltaTime
) {

    const meshes =

        physicalObjects
            .map(

                item =>
                    item.mesh

            );



    for (

        let i =
            lasers.length - 1;

        i >= 0;

        i--

    ) {

        const laser =
            lasers[i];


        const distance =

            laser.speed *
            deltaTime;



        const ray =

            new THREE.Raycaster(

                laser.mesh.position,

                laser.direction,

                0,

                distance +
                0.6

            );


        const hit =

            ray.intersectObjects(

                meshes,

                false

            )[0];



        if (
            hit
        ) {

            const item =

                physicalObjects
                    .find(

                        entry =>

                            entry.mesh ===
                            hit.object

                    );



            if (
                item
            ) {

                /*
                    El disparo aplica una fuerza
                    horizontal importante.

                    Tiene muy poca fuerza vertical
                    para evitar que las cajas vuelen.
                */

                const horizontal =

                    new THREE.Vector3(

                        laser.direction.x,

                        0,

                        laser.direction.z

                    );


                if (
                    horizontal.lengthSq() >
                    0
                ) {

                    horizontal.normalize();

                }



                item.body
                    .applyImpulse(

                        {

                            x:
                                horizontal.x *
                                9,

                            y:
                                0.2,

                            z:
                                horizontal.z *
                                9

                        },

                        true

                    );

            }



            createImpact(
                hit.point
            );


            removeLaser(
                i
            );


            continue;

        }



        laser.mesh.position
            .addScaledVector(

                laser.direction,

                distance

            );


        laser.life -=
            deltaTime;



        if (
            laser.life <= 0
        ) {

            removeLaser(
                i
            );

        }

    }

}



/* =========================================================
   SINCRONIZAR FÍSICA DE CUBOS
========================================================= */

function syncPhysics() {

    for (
        const item
        of physicalObjects
    ) {

        const position =

            item.body
                .translation();


        const rotation =

            item.body
                .rotation();



        item.mesh.position.set(

            position.x,

            position.y,

            position.z

        );


        item.mesh.quaternion.set(

            rotation.x,

            rotation.y,

            rotation.z,

            rotation.w

        );

    }

}



/* =========================================================
   TECLADO
========================================================= */

document.addEventListener(

    'keydown',

    (event) => {

        keyStates[
            event.code
        ] = true;

    }

);


document.addEventListener(

    'keyup',

    (event) => {

        keyStates[
            event.code
        ] = false;

    }

);



/* =========================================================
   POINTER LOCK
========================================================= */

renderer.domElement
    .addEventListener(

        'click',

        () => {

            if (

                document.pointerLockElement !==
                renderer.domElement

            ) {

                renderer.domElement
                    .requestPointerLock();

            }

        }

    );



/* =========================================================
   MOUSE
========================================================= */

document.addEventListener(

    'mousemove',

    (event) => {

        if (

            document.pointerLockElement !==
            renderer.domElement

        ) {

            return;

        }



        camera.rotation.y -=

            event.movementX /
            500;



        camera.rotation.x -=

            event.movementY /
            500;



        camera.rotation.x =

            THREE.MathUtils.clamp(

                camera.rotation.x,

                -Math.PI / 2,

                Math.PI / 2

            );

    }

);



/* =========================================================
   DISPARAR
========================================================= */

document.addEventListener(

    'mousedown',

    (event) => {

        if (
            event.button === 0
        ) {

            shootLaser();

        }

    }

);



/* =========================================================
   PASO FIJO DE FÍSICAS
========================================================= */

const FIXED_TIME_STEP =
    1 / 60;


let physicsAccumulator =
    0;



function updatePhysics(
    deltaTime
) {

    physicsAccumulator +=
        deltaTime;



    while (

        physicsAccumulator >=
        FIXED_TIME_STEP

    ) {

        /*
            Controles.
        */

        controls(
            FIXED_TIME_STEP
        );


        /*
            Calculamos el movimiento del jugador
            ANTES de avanzar el mundo físico.
        */

        updatePlayer(
            FIXED_TIME_STEP
        );


        /*
            Avanzamos Rapier.
        */

        physicsWorld.timestep =
            FIXED_TIME_STEP;


        physicsWorld.step();


        physicsAccumulator -=
            FIXED_TIME_STEP;

    }



    /*
        Actualizar posición visual
        de todos los cuerpos.
    */

    syncPhysics();


    /*
        La cámara sigue al jugador.
    */

    updateCameraFromPlayer();

}



/* =========================================================
   ANIMACIÓN
========================================================= */

function animate() {

    const deltaTime =

        Math.min(

            0.05,

            clock.getDelta()

        );



    if (
        scenarioReady
    ) {

        /*
            Jugador + cubos + escenario
            utilizan Rapier.
        */

        updatePhysics(
            deltaTime
        );


        /*
            Láser visual / impactos.
        */

        updateLasers(
            deltaTime
        );

    }



    renderer.render(

        scene,

        camera

    );

}



/* =========================================================
   INICIAR LOOP
========================================================= */

renderer.setAnimationLoop(
    animate
);



/* =========================================================
   RESPONSIVE
========================================================= */

window.addEventListener(

    'resize',

    () => {

        camera.aspect =

            window.innerWidth /
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(

            window.innerWidth,

            window.innerHeight

        );

    }

);