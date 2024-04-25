import * as THREE from 'three';
import Answer from './concepts/answer.js';  // Ensure the path is correct

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
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
