import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders'; // If using any specific loaders
import Answer from './concepts/answer.js';
import Question from './concepts/question.js';
import ModeController from './mode_controller.js';

// Get the canvas DOM element
const canvas = document.getElementById('renderCanvas');

// Load the 3D engine
const engine = new BABYLON.Engine(canvas, true);

// CreateScene function that creates and return the scene
const createScene = function() {
    // Create a basic BJS Scene object
    const scene = new BABYLON.Scene(engine);

    // Create an orthographic camera
    const camera = new BABYLON.UniversalCamera('UniversalCamera', new BABYLON.Vector3(0, 0, -50), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const aspect = window.innerWidth / window.innerHeight;
    camera.orthoLeft = -20 * aspect;
    camera.orthoRight = 20 * aspect;
    camera.orthoTop = 20;
    camera.orthoBottom = -20;

    // Attach the camera to the canvas
    camera.attachControl(canvas, false);

    // Create a basic light
    const light = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(5, 10, 50), scene);
    light.intensity = 5;

    // Initialize ModeController
    ModeController.init({ scene, camera });

    return scene;
};

// Call the createScene function
const scene = createScene();

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () {
    ModeController.updateObjects(); // Update all objects created by ModeController
    scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener('resize', function() {
    engine.resize();
});
