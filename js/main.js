import * as THREE from 'three';
import Answer from './concepts/answer.js';  // Ensure the path is correct

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

const canvas = renderer.domElement;
canvas.addEventListener('mousedown', onDocumentMouseDown, false);

document.body.appendChild(renderer.domElement);

const light = new THREE.PointLight(0xffffff, 5, 100);
light.position.set(0, 1, 2.5);
scene.add(light);

const answer = new Answer(scene);

function animate() {
    requestAnimationFrame(animate);
    answer.update();
    renderer.render(scene, camera);
}

animate();

function onDocumentMouseDown(event) {
    event.preventDefault();

    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const bounds = renderer.domElement.getBoundingClientRect();

    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children);

    let pos;
    if (intersects.length > 0) {
        // Use the point of the first intersected object
        pos = intersects[0].point;
    } else {
        // Alternatively, use default depth (z = 0) if no object is intersected
        pos = raycaster.ray.at(0, new THREE.Vector3());
        pos.z = 0;  // Set depth to 0 if you need to place it at z = 0
    }

    // Create an Answer instance at the clicked position
    const answer = new Answer(scene, pos);  // Assuming color and type are predefined
    scene.add(answer.mesh);
}
