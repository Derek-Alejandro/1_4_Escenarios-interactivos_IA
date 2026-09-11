/* =========================================================
   IMPORTACIONES
========================================================= */

import * as THREE from 'three';

import {
    GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import RAPIER from
    'https://cdn.skypack.dev/@dimforge/rapier3d-compat';


await RAPIER.init();


/* =========================================================
   CONTENEDOR
========================================================= */

const container =
    document.getElementById('scene-container');


/* =========================================================
   ESCENA
========================================================= */

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(0x07111f);

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
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

camera.rotation.order = 'YXZ';


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

renderer.shadowMap.enabled = true;

renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

renderer.toneMapping =
    THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.1;

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

sun.castShadow = true;

sun.shadow.mapSize.set(
    2048,
    2048
);

sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;

sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;

sun.shadow.bias = -0.0001;

scene.add(
    sun
);


/* =========================================================
   RELOJ
========================================================= */

const clock =
    new THREE.Clock();


/* =========================================================
   MUNDO FÍSICO
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

physicsWorld
    .integrationParameters
    .maxCcdSubsteps = 4;


/* =========================================================
   JUGADOR
========================================================= */

const PLAYER_RADIUS = 0.35;

const PLAYER_HALF_HEIGHT = 0.325;

const PLAYER_START = {
    x: 0,
    y: 0.675,
    z: 0
};

const PLAYER_EYE_OFFSET = 0.325;


/* =========================================================
   CUERPO DEL JUGADOR
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
    physicsWorld.createRigidBody(
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
        .setFriction(0);

const playerCollider =
    physicsWorld.createCollider(
        playerColliderDesc,
        playerBody
    );


/* =========================================================
   CHARACTER CONTROLLER
========================================================= */

const characterController =
    physicsWorld
        .createCharacterController(
            0.025
        );

characterController.enableAutostep(
    0.25,
    0.15,
    false
);

characterController.enableSnapToGround(
    0.2
);

characterController.setMaxSlopeClimbAngle(
    45 *
    Math.PI /
    180
);

characterController
    .setApplyImpulsesToDynamicBodies(
        true
    );

characterController
    .setCharacterMass(
        55
    );


/* =========================================================
   MOVIMIENTO DEL JUGADOR
========================================================= */

const playerVelocity =
    new THREE.Vector3();

const playerDirection =
    new THREE.Vector3();

let playerOnFloor = false;

const keyStates = {};


/* =========================================================
   OBJETOS DEL ESCENARIO
========================================================= */

const physicalObjects = [];

const lasers = [];

const scenarioMeshes = [];

const spawnPositions = [];

let scenarioBounds = null;

let scenarioReady = false;


/* =========================================================
   TIPOS DE FORMAS

   EXACTAMENTE 5 TIPOS DIFERENTES
========================================================= */

const SHAPE_TYPES = [

    'cube',

    'sphere',

    'cylinder',

    'cone',

    'dodecahedron'

];


/* =========================================================
   CONFIGURACIÓN DE GENERACIÓN
========================================================= */

/*
    Objetos individuales repartidos
    aleatoriamente por el escenario.

    Los primeros cinco garantizan que
    aparezca una figura de cada tipo.
*/

const RANDOM_OBJECT_COUNT = 15;


/*
    Pirámides construidas con cubos.
*/

const PYRAMID_COUNT = 2;

const PYRAMID_BASE = 4;


const SPAWN_MARGIN = 2;

const PLAYER_SAFE_DISTANCE = 4;

const MAX_SPAWN_ATTEMPTS = 250;


/* =========================================================
   CONFIGURACIÓN DEL LÁSER
========================================================= */

let isChargingLaser = false;

let laserChargeStart = 0;


/*
    Tiempo necesario para llegar
    a máxima potencia.
*/

const MAX_LASER_CHARGE_TIME = 1.5;


/*
    Fuerza normal.
*/

const NORMAL_LASER_FORCE = 9;


/*
    Fuerza máxima.

    Bastante superior a la versión anterior.
*/

const MAX_LASER_FORCE = 120;


/*
    Onda expansiva.
*/

const MAX_SHOCKWAVE_RADIUS = 3.8;

const MAX_SHOCKWAVE_FORCE = 38;


/* =========================================================
   RAYCASTERS
========================================================= */

const groundRaycaster =
    new THREE.Raycaster();

const clearanceRaycaster =
    new THREE.Raycaster();


const downDirection =
    new THREE.Vector3(
        0,
        -1,
        0
    );


const upDirection =
    new THREE.Vector3(
        0,
        1,
        0
    );


const rayOrigin =
    new THREE.Vector3();

const clearanceOrigin =
    new THREE.Vector3();

const worldNormal =
    new THREE.Vector3();

const normalMatrix =
    new THREE.Matrix3();


/* =========================================================
   PALETA DE COLORES
========================================================= */

const OBJECT_COLORS = [

    0x22d3ee, // cyan

    0xf97316, // naranja

    0x84cc16, // verde

    0xa855f7, // morado

    0xef4444, // rojo

    0xeab308, // amarillo

    0x3b82f6, // azul

    0xec4899, // rosa

    0x14b8a6, // turquesa

    0xf59e0b, // ámbar

    0x8b5cf6, // violeta

    0x10b981  // esmeralda

];


function randomObjectColor() {

    return OBJECT_COLORS[
        Math.floor(
            Math.random() *
            OBJECT_COLORS.length
        )
    ];

}


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
            vertexCount * 3
        );


    const vertex =
        new THREE.Vector3();


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
        ] = vertex.x;


        vertices[
            i * 3 + 1
        ] = vertex.y;


        vertices[
            i * 3 + 2
        ] = vertex.z;

    }


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
                vertexCount / 3
            ) * 3;


        indices =
            new Uint32Array(
                validCount
            );


        for (
            let i = 0;
            i < validCount;
            i++
        ) {

            indices[i] = i;

        }

    }


    if (
        indices.length < 3
    ) {

        return;

    }


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


    physicsWorld.createCollider(
        colliderDesc
    );

}


/* =========================================================
   CREAR FÍSICA COMPLETA DEL ESCENARIO
========================================================= */

function createScenarioPhysics(
    model
) {

    model.updateMatrixWorld(
        true
    );


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

        }

    );

}


/* =========================================================
   DESCRIPCIÓN DE LAS CINCO FIGURAS

   Aquí se mantiene una escala semejante
   entre todos los tipos.
========================================================= */

function getShapeConfiguration(
    type,
    scale
) {

    switch (
        type
    ) {

        /* =================================================
           1. CUBO
        ================================================= */

        case 'cube': {

            const size =
                scale;


            return {

                width:
                    size,

                height:
                    size,

                depth:
                    size,

                geometry:
                    new THREE.BoxGeometry(
                        size,
                        size,
                        size
                    ),

                volume:
                    size *
                    size *
                    size,

                colliderFactory:
                    () =>
                        RAPIER.ColliderDesc
                            .cuboid(
                                size / 2,
                                size / 2,
                                size / 2
                            )

            };

        }


        /* =================================================
           2. ESFERA
        ================================================= */

        case 'sphere': {

            const radius =
                scale * 0.52;


            return {

                width:
                    radius * 2,

                height:
                    radius * 2,

                depth:
                    radius * 2,

                geometry:
                    new THREE.SphereGeometry(
                        radius,
                        24,
                        18
                    ),

                volume:
                    (
                        4 /
                        3
                    ) *
                    Math.PI *
                    Math.pow(
                        radius,
                        3
                    ),

                colliderFactory:
                    () =>
                        RAPIER.ColliderDesc
                            .ball(
                                radius
                            )

            };

        }


        /* =================================================
           3. CILINDRO
        ================================================= */

        case 'cylinder': {

            const radius =
                scale * 0.42;


            const height =
                scale * 1.15;


            return {

                width:
                    radius * 2,

                height,

                depth:
                    radius * 2,

                geometry:
                    new THREE.CylinderGeometry(
                        radius,
                        radius,
                        height,
                        24
                    ),

                volume:
                    Math.PI *
                    radius *
                    radius *
                    height,

                colliderFactory:
                    () =>
                        RAPIER.ColliderDesc
                            .cylinder(
                                height / 2,
                                radius
                            )

            };

        }


        /* =================================================
           4. CONO
        ================================================= */

        case 'cone': {

            const radius =
                scale * 0.48;


            const height =
                scale * 1.25;


            return {

                width:
                    radius * 2,

                height,

                depth:
                    radius * 2,

                geometry:
                    new THREE.ConeGeometry(
                        radius,
                        height,
                        24
                    ),

                volume:
                    (
                        Math.PI *
                        radius *
                        radius *
                        height
                    ) /
                    3,

                colliderFactory:
                    () =>
                        RAPIER.ColliderDesc
                            .cone(
                                height / 2,
                                radius
                            )

            };

        }


        /* =================================================
           5. DODECAEDRO
        ================================================= */

        case 'dodecahedron': {

            const radius =
                scale * 0.58;


            const geometry =
                new THREE.DodecahedronGeometry(
                    radius,
                    0
                );


            return {

                width:
                    radius * 2,

                height:
                    radius * 2,

                depth:
                    radius * 2,

                geometry,

                /*
                    Aproximación de volumen suficiente
                    para calcular la densidad.
                */

                volume:
                    (
                        4 /
                        3
                    ) *
                    Math.PI *
                    Math.pow(
                        radius,
                        3
                    ),

                colliderFactory:
                    () => {

                        const position =
                            geometry
                                .attributes
                                .position;


                        const vertices =
                            new Float32Array(
                                position.count * 3
                            );


                        for (
                            let i = 0;
                            i < position.count;
                            i++
                        ) {

                            vertices[
                                i * 3
                            ] =
                                position.getX(i);


                            vertices[
                                i * 3 + 1
                            ] =
                                position.getY(i);


                            vertices[
                                i * 3 + 2
                            ] =
                                position.getZ(i);

                        }


                        /*
                            Collider convexo real
                            del dodecaedro.
                        */

                        const convex =
                            RAPIER.ColliderDesc
                                .convexHull(
                                    vertices
                                );


                        /*
                            En caso de que Rapier no
                            pueda crear el convex hull,
                            usamos una esfera aproximada.
                        */

                        return (
                            convex ||
                            RAPIER.ColliderDesc
                                .ball(
                                    radius * 0.95
                                )
                        );

                    }

            };

        }


        default:

            return getShapeConfiguration(
                'cube',
                scale
            );

    }

}


/* =========================================================
   CREAR OBJETO DINÁMICO
========================================================= */

function createDynamicShape(

    type,

    x,
    y,
    z,

    scale,

    mass = 4,

    color = randomObjectColor()

) {

    const config =
        getShapeConfiguration(
            type,
            scale
        );


    /* =====================================================
       THREE.JS
    ===================================================== */

    const material =
        new THREE.MeshStandardMaterial({

            color,

            roughness:
                0.65,

            metalness:
                0.08

        });


    const mesh =
        new THREE.Mesh(

            config.geometry,

            material

        );


    mesh.position.set(
        x,
        y,
        z
    );


    mesh.castShadow = true;

    mesh.receiveShadow = true;


    scene.add(
        mesh
    );


    /* =====================================================
       RAPIER
    ===================================================== */

    const bodyDesc =
        RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(
                x,
                y,
                z
            )
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


    const density =
        mass /
        Math.max(
            config.volume,
            0.01
        );


    const colliderDesc =
        config
            .colliderFactory()
            .setDensity(
                density
            )
            .setFriction(
                0.85
            )
            .setRestitution(
                0.04
            );


    const collider =
        physicsWorld
            .createCollider(

                colliderDesc,

                body

            );


    const object = {

        type,

        mesh,

        body,

        collider,

        width:
            config.width,

        height:
            config.height,

        depth:
            config.depth

    };


    physicalObjects.push(
        object
    );


    return object;

}


/* =========================================================
   CREAR CUBO

   Se mantiene esta función para las
   pirámides.
========================================================= */

function createDynamicBox(

    x,
    y,
    z,

    sx,
    sy,
    sz,

    mass = 4,

    color = randomObjectColor()

) {

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
                0.7,

            metalness:
                0.06

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


    mesh.castShadow = true;

    mesh.receiveShadow = true;


    scene.add(
        mesh
    );


    const bodyDesc =
        RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(
                x,
                y,
                z
            )
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
        physicsWorld.createRigidBody(
            bodyDesc
        );


    const volume =
        Math.max(
            sx * sy * sz,
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


    const object = {

        type:
            'cube',

        mesh,

        body,

        collider,

        width:
            sx,

        height:
            sy,

        depth:
            sz

    };


    physicalObjects.push(
        object
    );


    return object;

}


/* =========================================================
   BUSCAR SUELO
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
        ) +
        30;


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
            Solo superficies prácticamente
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
   COMPROBAR SUELO DE TODO EL OBJETO
========================================================= */

function findFlatSurfaceForObject(

    x,
    z,

    width,
    depth

) {

    const offsetX =
        width * 0.42;


    const offsetZ =
        depth * 0.42;


    const samples = [

        [0, 0],

        [offsetX, offsetZ],

        [-offsetX, offsetZ],

        [offsetX, -offsetZ],

        [-offsetX, -offsetZ],

        [offsetX, 0],

        [-offsetX, 0],

        [0, offsetZ],

        [0, -offsetZ]

    ];


    const heights = [];

    let centerGround = null;


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


        if (
            dx === 0 &&
            dz === 0
        ) {

            centerGround =
                ground;

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
        Evitar escalones,
        agujeros y paredes.
    */

    if (
        maxHeight -
        minHeight >
        0.16
    ) {

        return null;

    }


    return centerGround;

}


/* =========================================================
   COMPROBAR RAYO CONTRA ESCENARIO
========================================================= */

function scenarioRayHit(

    origin,

    direction,

    distance

) {

    clearanceRaycaster.set(
        origin,
        direction
    );


    clearanceRaycaster.near = 0;

    clearanceRaycaster.far =
        distance;


    const hits =
        clearanceRaycaster
            .intersectObjects(

                scenarioMeshes,

                false

            );


    return hits.length > 0;

}


/* =========================================================
   COMPROBAR VOLUMEN LIBRE
========================================================= */

function isSpawnVolumeClear(

    x,

    groundY,

    z,

    width,

    height,

    depth,

    extraClearance = 0.18

) {

    const levels = [

        groundY +
        Math.min(
            Math.max(
                height * 0.25,
                0.12
            ),
            0.3
        ),

        groundY +
        height * 0.5,

        groundY +
        Math.max(
            height - 0.12,
            height * 0.7
        )

    ];


    const xDistance =
        width / 2 +
        extraClearance;


    const zDistance =
        depth / 2 +
        extraClearance;


    const diagonalDistance =
        Math.hypot(
            width / 2,
            depth / 2
        ) +
        extraClearance;


    const directions = [

        {
            vector:
                new THREE.Vector3(
                    1, 0, 0
                ),

            distance:
                xDistance
        },

        {
            vector:
                new THREE.Vector3(
                    -1, 0, 0
                ),

            distance:
                xDistance
        },

        {
            vector:
                new THREE.Vector3(
                    0, 0, 1
                ),

            distance:
                zDistance
        },

        {
            vector:
                new THREE.Vector3(
                    0, 0, -1
                ),

            distance:
                zDistance
        },

        {
            vector:
                new THREE.Vector3(
                    1, 0, 1
                ).normalize(),

            distance:
                diagonalDistance
        },

        {
            vector:
                new THREE.Vector3(
                    -1, 0, 1
                ).normalize(),

            distance:
                diagonalDistance
        },

        {
            vector:
                new THREE.Vector3(
                    1, 0, -1
                ).normalize(),

            distance:
                diagonalDistance
        },

        {
            vector:
                new THREE.Vector3(
                    -1, 0, -1
                ).normalize(),

            distance:
                diagonalDistance
        }

    ];


    /*
        Paredes laterales.
    */

    for (
        const y
        of levels
    ) {

        clearanceOrigin.set(
            x,
            y,
            z
        );


        for (
            const check
            of directions
        ) {

            if (
                scenarioRayHit(

                    clearanceOrigin,

                    check.vector,

                    check.distance

                )
            ) {

                return false;

            }

        }

    }


    /*
        Techo o estructura superior.
    */

    clearanceOrigin.set(

        x,

        groundY + 0.08,

        z

    );


    if (
        scenarioRayHit(

            clearanceOrigin,

            upDirection,

            height +
            extraClearance

        )
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   POSICIÓN LIBRE DE OTROS OBJETOS
========================================================= */

function isSpawnPositionFree(

    x,

    z,

    radius

) {

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
   REGISTRAR POSICIÓN UTILIZADA
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
   BUSCAR ZONA PLANA GRANDE
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
   GENERAR UNA FORMA ALEATORIA
========================================================= */

function spawnRandomShape(
    type
) {

    /*
        Escala base de la figura.

        Las cinco figuras utilizan
        aproximadamente la misma escala
        visual general.
    */

    const scale =
        THREE.MathUtils.randFloat(
            0.75,
            1.35
        );


    /*
        Obtenemos primero sus dimensiones
        para validar el espacio.
    */

    const config =
        getShapeConfiguration(
            type,
            scale
        );


    const radius =
        Math.max(
            config.width,
            config.depth
        ) *
        0.65;


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


        const ground =
            findFlatSurfaceForObject(

                x,
                z,

                config.width,
                config.depth

            );


        if (
            !ground
        ) {

            continue;

        }


        if (
            !isSpawnVolumeClear(

                x,

                ground.point.y,

                z,

                config.width,

                config.height,

                config.depth

            )
        ) {

            continue;

        }


        /*
            Centro vertical del objeto.
        */

        const y =
            ground.point.y +
            config.height / 2 +
            0.035;


        createDynamicShape(

            type,

            x,
            y,
            z,

            scale,

            THREE.MathUtils.randFloat(
                3,
                8
            ),

            randomObjectColor()

        );


        registerSpawn(

            x,

            z,

            radius

        );


        return true;

    }


    return false;

}


/* =========================================================
   GENERAR LAS 5 FORMAS
========================================================= */

function generateRandomShapes() {

    let created = 0;


    /*
        Primero creamos obligatoriamente
        una figura de cada tipo.
    */

    for (
        const type
        of SHAPE_TYPES
    ) {

        if (
            spawnRandomShape(
                type
            )
        ) {

            created++;

        }

    }


    /*
        Después generamos más objetos
        utilizando aleatoriamente los
        mismos cinco tipos.
    */

    for (
        let i = SHAPE_TYPES.length;
        i < RANDOM_OBJECT_COUNT;
        i++
    ) {

        const type =
            SHAPE_TYPES[
                Math.floor(
                    Math.random() *
                    SHAPE_TYPES.length
                )
            ];


        if (
            spawnRandomShape(
                type
            )
        ) {

            created++;

        }

    }


    console.log(
        `Figuras geométricas generadas: ${created}`
    );

}


/* =========================================================
   BUSCAR LUGAR PARA PIRÁMIDE
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


        if (
            !isSpawnVolumeClear(

                x,

                flatArea.y,

                z,

                footprint,

                baseCount *
                cubeSize,

                footprint,

                0.35

            )
        ) {

            continue;

        }


        registerSpawn(

            x,

            z,

            radius + 1

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

    const horizontalSpacing =
        cubeSize *
        1.03;


    const verticalSpacing =
        cubeSize *
        1.015;


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
            ) *
            horizontalSpacing;


        for (
            let i = 0;
            i < boxesOnLevel;
            i++
        ) {

            const localX =
                -levelWidth / 2 +
                i *
                horizontalSpacing;


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
                cubeSize / 2 +
                level *
                verticalSpacing;


            createDynamicBox(

                x,

                y,

                z,

                cubeSize,

                cubeSize,

                cubeSize,

                THREE.MathUtils.randFloat(
                    3,
                    5
                ),

                randomObjectColor()

            );

        }

    }

}


/* =========================================================
   GENERAR PIRÁMIDES
========================================================= */

function generatePyramids() {

    let created = 0;


    for (
        let i = 0;
        i < PYRAMID_COUNT;
        i++
    ) {

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


    (gltf) => {

        const model =
            gltf.scene;


        model.traverse(

            (child) => {

                if (
                    !child.isMesh
                ) {

                    return;

                }


                child.castShadow = true;

                child.receiveShadow = true;


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


        scenarioBounds =
            new THREE.Box3()
                .setFromObject(
                    model
                );


        createScenarioPhysics(
            model
        );


        /*
            Primero las pirámides.
        */

        generatePyramids();


        /*
            Después las cinco formas
            geométricas.
        */

        generateRandomShapes();


        scenarioReady = true;


        updateCameraFromPlayer();


        console.log(
            'Escenario preparado correctamente.'
        );

    },


    (xhr) => {

        if (
            xhr.total > 0
        ) {

            const progress =
                (
                    xhr.loaded /
                    xhr.total
                ) *
                100;


            console.log(
                `Cargando escenario: ${progress.toFixed(0)}%`
            );

        }

    },


    (error) => {

        console.error(
            'Error al cargar collision-world.glb:',
            error
        );

    }

);


/* =========================================================
   DIRECCIONES DEL JUGADOR
========================================================= */

function getForwardVector() {

    camera.getWorldDirection(
        playerDirection
    );


    playerDirection.y = 0;


    if (
        playerDirection.lengthSq() > 0
    ) {

        playerDirection.normalize();

    }


    return playerDirection;

}


function getSideVector() {

    camera.getWorldDirection(
        playerDirection
    );


    playerDirection.y = 0;


    if (
        playerDirection.lengthSq() > 0
    ) {

        playerDirection.normalize();

    }


    playerDirection.cross(
        camera.up
    );


    return playerDirection;

}


/* =========================================================
   CONTROLES
========================================================= */

function controls(
    deltaTime
) {

    const acceleration =
        playerOnFloor
            ? 18
            : 7;


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


    if (
        playerOnFloor &&
        keyStates.Space
    ) {

        playerVelocity.y = 7;

        playerOnFloor = false;

    }

}


/* =========================================================
   ACTUALIZAR JUGADOR
========================================================= */

function updatePlayer(
    deltaTime
) {

    const horizontalDamping =
        Math.exp(
            -4 *
            deltaTime
        );


    playerVelocity.x *=
        horizontalDamping;


    playerVelocity.z *=
        horizontalDamping;


    if (
        playerOnFloor
    ) {

        if (
            playerVelocity.y < 0
        ) {

            playerVelocity.y =
                -0.5;

        }

    } else {

        playerVelocity.y -=
            25 *
            deltaTime;

    }


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


    characterController
        .computeColliderMovement(

            playerCollider,

            desiredMovement

        );


    const movement =
        characterController
            .computedMovement();


    playerOnFloor =
        characterController
            .computedGrounded();


    if (
        playerOnFloor &&
        playerVelocity.y < 0
    ) {

        playerVelocity.y = 0;

    }


    const current =
        playerBody
            .translation();


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
   CÁMARA
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


    if (
        position.y < -20
    ) {

        resetPlayer();

    }

}


/* =========================================================
   REINICIAR JUGADOR
========================================================= */

function resetPlayer() {

    playerBody.setTranslation(

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


    playerOnFloor = false;


    updateCameraFromPlayer();

}


/* =========================================================
   INICIAR CARGA DEL LÁSER
========================================================= */

function startLaserCharge() {

    if (
        document.pointerLockElement !==
        renderer.domElement
    ) {

        return;

    }


    if (
        isChargingLaser
    ) {

        return;

    }


    isChargingLaser = true;


    laserChargeStart =
        performance.now();

}


/* =========================================================
   FINALIZAR CARGA
========================================================= */

function releaseLaserCharge() {

    if (
        !isChargingLaser
    ) {

        return;

    }


    const timeHeld =
        (
            performance.now() -
            laserChargeStart
        ) /
        1000;


    isChargingLaser = false;


    shootLaser(
        timeHeld
    );

}


/* =========================================================
   DISPARAR LÁSER
========================================================= */

function shootLaser(
    chargeTime = 0
) {

    if (
        document.pointerLockElement !==
        renderer.domElement
    ) {

        return;

    }


    const charge =
        THREE.MathUtils.clamp(

            chargeTime /
            MAX_LASER_CHARGE_TIME,

            0,

            1

        );


    /*
        Curva cuadrática.

        El disparo corto aumenta poco.

        La carga máxima aumenta muchísimo.
    */

    const powerCurve =
        charge *
        charge;


    const laserForce =
        THREE.MathUtils.lerp(

            NORMAL_LASER_FORCE,

            MAX_LASER_FORCE,

            powerCurve

        );


    const direction =
        new THREE.Vector3();


    camera.getWorldDirection(
        direction
    );


    direction.normalize();


    const radius =
        THREE.MathUtils.lerp(

            0.035,

            0.12,

            charge

        );


    const length =
        THREE.MathUtils.lerp(

            0.9,

            2.2,

            charge

        );


    const geometry =
        new THREE.CylinderGeometry(

            radius,

            radius,

            length,

            14

        );


    geometry.rotateX(
        Math.PI / 2
    );


    const normalColor =
        new THREE.Color(
            0x67e8f9
        );


    const maxColor =
        new THREE.Color(
            0xffffff
        );


    const laserColor =
        normalColor
            .clone()
            .lerp(

                maxColor,

                charge * 0.85

            );


    const material =
        new THREE.MeshStandardMaterial({

            color:
                laserColor,

            emissive:
                laserColor,

            emissiveIntensity:
                THREE.MathUtils.lerp(
                    5,
                    20,
                    charge
                ),

            roughness:
                0.1

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

            0.9

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
            THREE.MathUtils.lerp(
                35,
                60,
                charge
            ),

        life:
            2,

        force:
            laserForce,

        charge

    });


    console.log(

        `Carga: ${(charge * 100).toFixed(0)}% | Fuerza: ${laserForce.toFixed(1)}`

    );

}


/* =========================================================
   ONDA EXPANSIVA
========================================================= */

function applyLaserShockwave(

    impactPoint,

    mainObject,

    charge

) {

    /*
        Solo cargas relativamente fuertes
        producen onda expansiva.
    */

    if (
        charge < 0.4
    ) {

        return;

    }


    const radius =
        THREE.MathUtils.lerp(

            1,

            MAX_SHOCKWAVE_RADIUS,

            charge

        );


    const maxForce =
        THREE.MathUtils.lerp(

            5,

            MAX_SHOCKWAVE_FORCE,

            charge *
            charge

        );


    for (
        const item
        of physicalObjects
    ) {

        if (
            item === mainObject
        ) {

            continue;

        }


        const position =
            item.body
                .translation();


        const dx =
            position.x -
            impactPoint.x;


        const dy =
            position.y -
            impactPoint.y;


        const dz =
            position.z -
            impactPoint.z;


        const distance =
            Math.sqrt(

                dx * dx +

                dy * dy +

                dz * dz

            );


        if (
            distance >
            radius
        ) {

            continue;

        }


        const proximity =
            1 -
            distance /
            radius;


        const force =
            maxForce *
            proximity;


        const horizontalDistance =
            Math.max(

                Math.hypot(
                    dx,
                    dz
                ),

                0.1

            );


        const directionX =
            dx /
            horizontalDistance;


        const directionZ =
            dz /
            horizontalDistance;


        item.body
            .applyImpulse(

                {

                    x:
                        directionX *
                        force,

                    /*
                        Pequeño golpe vertical
                        para perder estabilidad.
                    */

                    y:
                        THREE.MathUtils.lerp(

                            0.15,

                            1.1,

                            charge

                        ) *
                        proximity,

                    z:
                        directionZ *
                        force

                },

                true

            );

    }

}


/* =========================================================
   EFECTO DE IMPACTO
========================================================= */

function createImpact(

    position,

    charge = 0

) {

    const flash =
        new THREE.PointLight(

            0x67e8f9,

            THREE.MathUtils.lerp(
                8,
                22,
                charge
            ),

            THREE.MathUtils.lerp(
                4,
                8,
                charge
            ),

            2

        );


    flash.position.copy(
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

        THREE.MathUtils.lerp(
            90,
            170,
            charge
        )

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

    /*
        El láser puede impactar:

        - cualquiera de las 5 figuras
        - cubos de las pirámides
        - estructuras del escenario
    */

    const targets = [

        ...physicalObjects.map(
            item =>
                item.mesh
        ),

        ...scenarioMeshes

    ];


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

                distance + 0.8

            );


        const hit =
            ray.intersectObjects(

                targets,

                false

            )[0];


        if (
            hit
        ) {

            const item =
                physicalObjects.find(

                    entry =>

                        entry.mesh ===
                        hit.object

                );


            if (
                item
            ) {

                const horizontal =
                    new THREE.Vector3(

                        laser.direction.x,

                        0,

                        laser.direction.z

                    );


                if (
                    horizontal.lengthSq() > 0
                ) {

                    horizontal.normalize();

                }


                /*
                    IMPULSO PRINCIPAL.

                    Hasta 120 unidades de fuerza
                    con carga máxima.
                */

                item.body
                    .applyImpulse(

                        {

                            x:
                                horizontal.x *
                                laser.force,

                            /*
                                Poco impulso vertical
                                para que no salga volando.
                            */

                            y:
                                THREE.MathUtils.lerp(

                                    0.12,

                                    1.15,

                                    laser.charge

                                ),

                            z:
                                horizontal.z *
                                laser.force

                        },

                        true

                    );


                /*
                    Onda de choque para derribar
                    estructuras completas.
                */

                applyLaserShockwave(

                    hit.point,

                    item,

                    laser.charge

                );

            }


            createImpact(

                hit.point,

                laser.charge

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
   SINCRONIZAR FÍSICAS
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
   SALIR DEL POINTER LOCK
========================================================= */

document.addEventListener(

    'pointerlockchange',

    () => {

        if (
            document.pointerLockElement !==
            renderer.domElement
        ) {

            isChargingLaser = false;

        }

    }

);


/* =========================================================
   MOUSE / CÁMARA
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
   COMENZAR CARGA
========================================================= */

document.addEventListener(

    'mousedown',

    (event) => {

        if (
            event.button === 0
        ) {

            startLaserCharge();

        }

    }

);


/* =========================================================
   DISPARAR AL SOLTAR
========================================================= */

document.addEventListener(

    'mouseup',

    (event) => {

        if (
            event.button === 0
        ) {

            releaseLaserCharge();

        }

    }

);


/* =========================================================
   PASO FIJO DE FÍSICAS
========================================================= */

const FIXED_TIME_STEP =
    1 / 60;


let physicsAccumulator = 0;


function updatePhysics(
    deltaTime
) {

    physicsAccumulator +=
        deltaTime;


    while (
        physicsAccumulator >=
        FIXED_TIME_STEP
    ) {

        controls(
            FIXED_TIME_STEP
        );


        updatePlayer(
            FIXED_TIME_STEP
        );


        physicsWorld.timestep =
            FIXED_TIME_STEP;


        physicsWorld.step();


        physicsAccumulator -=
            FIXED_TIME_STEP;

    }


    syncPhysics();


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

        updatePhysics(
            deltaTime
        );


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