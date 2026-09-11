/* =========================================================
   IMPORTACIONES
========================================================= */

import * as THREE from 'three';

import { GLTFLoader }
    from 'three/addons/loaders/GLTFLoader.js';

import { Octree }
    from 'three/addons/math/Octree.js';

import { Capsule }
    from 'three/addons/math/Capsule.js';

import RAPIER
    from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';



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


/*
    Mejor representación de colores.
*/

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


/*
    Luz ambiental tipo cielo.
*/

const hemisphereLight =
    new THREE.HemisphereLight(

        0xbfe3ff,

        0x182030,

        1.8

    );


scene.add(
    hemisphereLight
);



/*
    Luz principal.
*/

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


/*
    Calidad de sombras.
*/

sun.shadow.mapSize.set(

    2048,

    2048

);


sun.shadow.camera.near =
    0.5;


sun.shadow.camera.far =
    80;


sun.shadow.camera.left =
    -25;


sun.shadow.camera.right =
    25;


sun.shadow.camera.top =
    25;


sun.shadow.camera.bottom =
    -25;


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
   OCTREE DEL ESCENARIO
========================================================= */

const worldOctree =
    new Octree();



/* =========================================================
   JUGADOR
========================================================= */

const playerCollider =
    new Capsule(

        new THREE.Vector3(

            0,

            0.35,

            0

        ),

        new THREE.Vector3(

            0,

            1,

            0

        ),

        0.35

    );


const playerVelocity =
    new THREE.Vector3();


const playerDirection =
    new THREE.Vector3();


let playerOnFloor =
    false;



/* =========================================================
   TECLADO
========================================================= */

const keyStates =
    {};



/* =========================================================
   CONFIGURACIÓN DE FÍSICA RAPIER
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



/* =========================================================
   OBJETOS FÍSICOS
========================================================= */

const physicalObjects =
    [];


const lasers =
    [];



/* =========================================================
   PISO FÍSICO PARA RAPIER
========================================================= */

/*
    Este piso evita que las cajas dinámicas
    atraviesen el suelo.
*/

const groundDesc =
    RAPIER.ColliderDesc
        .cuboid(
            30,
            0.1,
            30
        )
        .setTranslation(
            0,
            -0.1,
            0
        )
        .setFriction(
            0.8
        );


physicsWorld.createCollider(
    groundDesc
);



/* =========================================================
   CREAR CAJA DINÁMICA
========================================================= */

function createDynamicBox(

    x,
    y,
    z,

    sx,
    sy,
    sz,

    mass = 4

) {

    /* -------------------------
       MESH THREE.JS
    ------------------------- */

    const geometry =
        new THREE.BoxGeometry(

            sx,
            sy,
            sz

        );


    const material =
        new THREE.MeshStandardMaterial({

            color:
                0x94a3b8,

            roughness:
                0.65,

            metalness:
                0.08

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



    /* -------------------------
       RIGID BODY RAPIER
    ------------------------- */

    const bodyDesc =
        RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(

                x,
                y,
                z

            );


    const body =
        physicsWorld
            .createRigidBody(
                bodyDesc
            );



    /* -------------------------
       COLLIDER
    ------------------------- */

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
                0.7
            )
            .setRestitution(
                0.12
            );


    physicsWorld.createCollider(

        colliderDesc,

        body

    );



    /* -------------------------
       GUARDAR REFERENCIA
    ------------------------- */

    physicalObjects.push({

        mesh,

        body

    });

}



/* =========================================================
   TORRE DE OBJETOS
========================================================= */

for (

    let level = 0;

    level < 3;

    level++

) {

    for (

        let i = 0;

        i < 3 - level;

        i++

    ) {

        createDynamicBox(

            -2 +
            i * 1.15 +
            level * 0.55,

            0.5 +
            level,

            -5,

            1,
            1,
            1,

            4

        );

    }

}



/*
    Objetos adicionales.
*/

createDynamicBox(

    3,

    0.75,

    -5,

    1.2,

    1.5,

    1.2,

    8

);


createDynamicBox(

    4.4,

    0.4,

    -5,

    0.8,

    0.8,

    0.8,

    2

);



/* =========================================================
   CARGAR ESCENARIO GLB
========================================================= */

const loader =
    new GLTFLoader();


loader.load(

    './assets/models/collision-world.glb',


    /* ========================
       MODELO CARGADO
    ======================== */

    (gltf) => {

        const model =
            gltf.scene;


        model.traverse(

            (child) => {

                if (
                    child.isMesh
                ) {

                    child.castShadow =
                        true;


                    child.receiveShadow =
                        true;


                    /*
                        Mejorar las texturas.
                    */

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

            }

        );


        scene.add(
            model
        );


        /*
            Crear la estructura de colisiones
            del escenario para el jugador.
        */

        worldOctree
            .fromGraphNode(
                model
            );


        console.log(

            'Escenario collision-world.glb cargado correctamente.'

        );

    },


    /* ========================
       PROGRESO
    ======================== */

    (xhr) => {

        if (
            xhr.total > 0
        ) {

            const progress =

                (
                    xhr.loaded /
                    xhr.total
                )

                * 100;


            console.log(

                `Cargando escenario: ${progress.toFixed(0)}%`

            );

        }

    },


    /* ========================
       ERROR
    ======================== */

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


    return playerDirection
        .normalize();

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


    playerDirection
        .normalize();


    playerDirection
        .cross(
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

    /*
        En el suelo nos movemos más rápido.

        En el aire existe menor control.
    */

    const speed =

        playerOnFloor

            ? 18

            : 7;



    /* -------------------------
       W
    ------------------------- */

    if (
        keyStates.KeyW
    ) {

        playerVelocity.add(

            getForwardVector()

                .multiplyScalar(

                    speed *
                    deltaTime

                )

        );

    }



    /* -------------------------
       S
    ------------------------- */

    if (
        keyStates.KeyS
    ) {

        playerVelocity.add(

            getForwardVector()

                .multiplyScalar(

                    -speed *
                    deltaTime

                )

        );

    }



    /* -------------------------
       A
    ------------------------- */

    if (
        keyStates.KeyA
    ) {

        playerVelocity.add(

            getSideVector()

                .multiplyScalar(

                    -speed *
                    deltaTime

                )

        );

    }



    /* -------------------------
       D
    ------------------------- */

    if (
        keyStates.KeyD
    ) {

        playerVelocity.add(

            getSideVector()

                .multiplyScalar(

                    speed *
                    deltaTime

                )

        );

    }



    /* -------------------------
       SALTO
    ------------------------- */

    if (

        playerOnFloor &&

        keyStates.Space

    ) {

        playerVelocity.y =
            7;

    }

}



/* =========================================================
   COLISIONES DEL JUGADOR
========================================================= */

function playerCollisions() {

    const result =

        worldOctree
            .capsuleIntersect(

                playerCollider

            );


    playerOnFloor =
        false;


    if (
        result
    ) {

        playerOnFloor =

            result.normal.y >
            0;


        /*
            Si la colisión no es contra el suelo,
            eliminamos la velocidad dirigida
            contra la pared.
        */

        if (
            !playerOnFloor
        ) {

            playerVelocity
                .addScaledVector(

                    result.normal,

                    -result.normal.dot(

                        playerVelocity

                    )

                );

        }


        /*
            Sacamos al jugador fuera de
            la geometría contra la que chocó.
        */

        playerCollider
            .translate(

                result.normal
                    .multiplyScalar(

                        result.depth

                    )

            );

    }

}



/* =========================================================
   EMPUJAR OBJETOS AL CAMINAR
========================================================= */

function pushNearbyObjects() {

    const moving =
        new THREE.Vector3(

            playerVelocity.x,

            0,

            playerVelocity.z

        );


    /*
        Si prácticamente no nos movemos,
        no aplicamos fuerza.
    */

    if (
        moving.lengthSq() <
        0.04
    ) {

        return;

    }



    for (
        const item
        of physicalObjects
    ) {

        const position =
            item.body
                .translation();


        const dx =

            position.x -
            camera.position.x;


        const dz =

            position.z -
            camera.position.z;


        const distance =

            Math.hypot(

                dx,

                dz

            );


        /*
            Si estamos cerca,
            empujamos la caja.
        */

        if (
            distance <
            1.15
        ) {

            const force =

                0.7 /

                Math.max(

                    distance,

                    0.25

                );


            item.body
                .applyImpulse(

                    {

                        x:
                            dx *
                            force,

                        y:
                            0.05,

                        z:
                            dz *
                            force

                    },

                    true

                );

        }

    }

}



/* =========================================================
   ACTUALIZAR JUGADOR
========================================================= */

function updatePlayer(

    deltaTime

) {

    let damping =

        Math.exp(

            -4 *
            deltaTime

        )

        - 1;



    /* -------------------------
       GRAVEDAD
    ------------------------- */

    if (
        !playerOnFloor
    ) {

        playerVelocity.y -=

            25 *
            deltaTime;


        /*
            Menor fricción en el aire.
        */

        damping *=
            0.1;

    }



    /* -------------------------
       FRICCIÓN
    ------------------------- */

    playerVelocity
        .addScaledVector(

            playerVelocity,

            damping

        );



    /* -------------------------
       MOVIMIENTO
    ------------------------- */

    const movement =

        playerVelocity
            .clone()
            .multiplyScalar(

                deltaTime

            );


    playerCollider
        .translate(
            movement
        );



    /* -------------------------
       COLISIONES
    ------------------------- */

    playerCollisions();



    /* -------------------------
       CÁMARA
    ------------------------- */

    camera.position
        .copy(

            playerCollider.end

        );



    /* -------------------------
       EMPUJAR OBJETOS
    ------------------------- */

    pushNearbyObjects();



    /* -------------------------
       REAPARECER SI CAEMOS
    ------------------------- */

    if (
        camera.position.y <
        -20
    ) {

        resetPlayer();

    }

}



/* =========================================================
   REINICIAR JUGADOR
========================================================= */

function resetPlayer() {

    playerCollider.start.set(

        0,

        0.35,

        0

    );


    playerCollider.end.set(

        0,

        1,

        0

    );


    playerVelocity.set(

        0,

        0,

        0

    );


    camera.position.copy(

        playerCollider.end

    );

}



/* =========================================================
   DISPARAR LÁSER
========================================================= */

function shootLaser() {

    /*
        Solo podemos disparar mientras
        Pointer Lock está activo.
    */

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



    /* -------------------------
       GEOMETRÍA
    ------------------------- */

    const geometry =
        new THREE.CylinderGeometry(

            0.035,

            0.035,

            0.9,

            10

        );


    /*
        CylinderGeometry se crea vertical.

        Lo giramos para que apunte
        hacia adelante.
    */

    geometry.rotateX(

        Math.PI /
        2

    );



    /* -------------------------
       MATERIAL
    ------------------------- */

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



    /* -------------------------
       MESH
    ------------------------- */

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



    /*
        Hacer que el láser apunte en la
        misma dirección que la cámara.
    */

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



    /* -------------------------
       GUARDAR LÁSER
    ------------------------- */

    lasers.push({

        mesh,

        direction,

        speed:
            32,

        life:
            1.7

    });

}



/* =========================================================
   EFECTO DE IMPACTO
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


    /*
        Desaparece rápidamente
        para simular un destello.
    */

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
   ACTUALIZAR LÁSERES
========================================================= */

function updateLasers(

    deltaTime

) {

    /*
        Objetos contra los que puede
        impactar el láser.
    */

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



        /* -------------------------
           RAYCASTER
        ------------------------- */

        const ray =
            new THREE.Raycaster(

                laser.mesh.position,

                laser.direction,

                0,

                distance +
                0.5

            );


        const hit =

            ray.intersectObjects(

                meshes,

                false

            )[0];



        /* -------------------------
           IMPACTO
        ------------------------- */

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

                item.body
                    .applyImpulse(

                        {

                            x:
                                laser.direction.x *
                                9,

                            y:
                                laser.direction.y *
                                9 +
                                1.2,

                            z:
                                laser.direction.z *
                                9

                        },

                        true

                    );

            }


            createImpact(
                hit.point
            );


            scene.remove(
                laser.mesh
            );


            /*
                Liberar memoria.
            */

            laser.mesh.geometry.dispose();

            laser.mesh.material.dispose();


            lasers.splice(

                i,

                1

            );


            continue;

        }



        /* -------------------------
           MOVIMIENTO DEL LÁSER
        ------------------------- */

        laser.mesh.position
            .addScaledVector(

                laser.direction,

                distance

            );


        laser.life -=
            deltaTime;



        /* -------------------------
           ELIMINAR LÁSER
        ------------------------- */

        if (
            laser.life <= 0
        ) {

            scene.remove(
                laser.mesh
            );


            laser.mesh.geometry.dispose();

            laser.mesh.material.dispose();


            lasers.splice(

                i,

                1

            );

        }

    }

}



/* =========================================================
   SINCRONIZAR RAPIER CON THREE.JS
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
   EVENTOS DE TECLADO
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
   CONTROL DE CÁMARA CON MOUSE
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



        /*
            Evitar que la cámara pueda
            darse completamente la vuelta
            verticalmente.
        */

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
   ANIMACIÓN PRINCIPAL
========================================================= */

function animate() {

    /*
        Limitar delta para evitar problemas
        físicos cuando la pestaña se congela
        o pierde el foco.
    */

    const delta =

        Math.min(

            0.05,

            clock.getDelta()

        );



    /* -------------------------
       JUGADOR
    ------------------------- */

    controls(
        delta
    );


    updatePlayer(
        delta
    );



    /* -------------------------
       RAPIER
    ------------------------- */

    physicsWorld.timestep =
        delta;


    physicsWorld.step();


    syncPhysics();



    /* -------------------------
       LÁSERES
    ------------------------- */

    updateLasers(
        delta
    );



    /* -------------------------
       RENDER
    ------------------------- */

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