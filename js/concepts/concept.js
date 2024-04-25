import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export default class Concept {
    constructor(scene, type, color = 0xffffff) {
        this.scene = scene;
        this.type = type;
        this.color = color;

        this.initMesh();
    }

    initMesh() {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.material.metalness = 0.5;
        this.mesh.material.roughness = 0.6;
        this.scene.add(this.mesh);

        this.addLabel();
    }

    addLabel() {
        const loader = new FontLoader();
        loader.load('./assets/helvetiker_regular.typeface.json', (font) => {
            const textGeometry = new TextGeometry(this.type.charAt(0), {
                font: font,
                size: 0.25,
                depth: 0.05,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.01,
                bevelSize: 0.02,
                bevelSegments: 5
            });
    
            textGeometry.computeBoundingBox();
            textGeometry.computeBoundingSphere();
            
            const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            
            // Create and position the front text mesh
            const frontTextMesh = new THREE.Mesh(textGeometry, textMaterial);
            frontTextMesh.position.set(
                -0.5,
                -0.01,
                0.74 + textGeometry.boundingSphere.radius  // Slightly offset from the sphere surface
            );
            frontTextMesh.rotation.y = Math.PI;  // Ensure it faces outward
    
            // Create and position the rear text mesh
            const rearTextMesh = new THREE.Mesh(textGeometry.clone(), textMaterial);
            rearTextMesh.position.set(
                0.5,
                0.01,
                -(textGeometry.boundingSphere.radius + 0.74)  // Slightly offset from the sphere surface
            );
            rearTextMesh.rotation.y = 0;  // Ensure it faces outward from the sphere
    
            // Add both text meshes to the sphere's mesh
            this.mesh.add(frontTextMesh);
            this.mesh.add(rearTextMesh);
        }, undefined, (error) => {
            console.error('Font could not be loaded.', error);
        });
    }

    update() {
        if (this.mesh) {
            this.mesh.rotation.y += 0.01;
        }
    }
}
