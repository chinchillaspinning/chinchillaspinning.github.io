import * as THREE from "./three.mjs";
import { Vector2, Vector3 } from "./three.mjs";
import { OBJLoader } from "./loader/OBJLoader.mjs";
import { MTLLoader } from "./loader/MTLLoader.mjs"
import { lerp, lerpClamped } from "./util.mjs";

const modelBasePath = "models"
const chinchillaModelPath = "chinchilla.obj"
const chinchillaMaterialPath = "chinchilla.mtl"

const defaultChinchillaRotation = 3*Math.PI / 4;
// const defaultChinchillaRotation = 0;
const chinchillaOffset = new Vector3(
	-0.5, -0.5, -0.25
);
const chinchillaModelScale = 0.5;

const canvas = document.getElementById("main-canvas");
const trashCan = document.getElementById("trash-can");

const FOV = 75;
const clock = new THREE.Clock(true);

const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	alpha: true,
});

const objLoader = new OBJLoader();
objLoader.setPath("/models/")

const mtlLoader = new MTLLoader();
mtlLoader.setResourcePath("/models/");
mtlLoader.setPath("/models/");

const scene = new THREE.Scene();
scene.add(new THREE.DirectionalLight(0x404040, 0.5));
scene.add(new THREE.AmbientLight(0x404040, 0.5));

const cameraHalfWidth = 5;
/** @type {THREE.OrthographicCamera} */
let camera
{
	let cameraHalfHeight = canvas.clientHeight / canvas.clientWidth * cameraHalfWidth;
	camera = new THREE.OrthographicCamera(
		-5, 5,
		cameraHalfHeight, -cameraHalfHeight,
		0.1, 1000
	);
}

// objLoader.parse(
// 	await fetch("models/cube.obj").then(res => res.text()),
// 	obj => scene.add(obj),
// );

/** @type {THREE.Group | null} */
let chinchilla = null;
let chinchillaModel = null;
mtlLoader
	.load(
	chinchillaMaterialPath,
	materials => {
		materials.preload();
		objLoader
			.setMaterials(materials)
			.load(chinchillaModelPath,
			/**
			 *
			 * @param {THREE.Group} obj
			 */
			obj => {
				obj.position.add(chinchillaOffset);
				obj.scale.fromArray(new Array(3).fill(chinchillaModelScale))

				chinchilla = new THREE.Group();
				chinchillaModel = new THREE.Group();

				chinchillaModel.add(obj);
				chinchillaModel.rotateOnAxis(new Vector3(0, 1, 0), defaultChinchillaRotation);
				chinchilla.add(chinchillaModel)
				scene.add(chinchilla);
			},
			null,
			err => console.error(err)
		)
	},
	null,
	err => console.error(err)
)

camera.position.z = 5;


/**
 *
 * @param {ResizeObserverEntry} entry
 * @returns {[number, number]}
 */
function getWHFromResizeObserverEntry(entry){
	let /** @type {number} */ w, /** @type {number} */ h;
	if(entry.devicePixelContentBoxSize){
		w = Math.floor(entry.devicePixelContentBoxSize[0].inlineSize);
		h = Math.floor(entry.devicePixelContentBoxSize[0].blockSize);
	}
	else {
		const dpr = window.devicePixelRatio;
		w = Math.round(dpr * entry.contentBoxSize[0].inlineSize);
		h = Math.round(dpr * entry.contentBoxSize[0].blockSize);
	}
	return [w, h]
}

/** @type {ResizeObserverCallback} */
async function onCanvasResize(entries){
	const canvasEntry = entries.find(entry => entry.target === canvas);
	if(canvasEntry){
		const [w, h] = getWHFromResizeObserverEntry(canvasEntry);
		renderer.setSize(w, h, false)
		camera.top = h / w * camera.right;
		camera.bottom = -camera.top;
		camera.updateProjectionMatrix();
	}
}

const resizeObserver = new ResizeObserver(onCanvasResize);
try {
	resizeObserver.observe(canvas, {box: "device-pixel-content-box"});
}
catch {
	resizeObserver.observe(canvas, {box: "content-box"});
}

const defaultRotateSpeed = 0;
let currentRotateSpeed = defaultRotateSpeed;
let targetRotateSpeed = currentRotateSpeed;
const rotateSpeedMap = s => -50*Math.exp(-s/50) + 50;

const defaultChinchillaScale = 1;
const trashCanChinchillaScale = 0.5;

let targetChinchillaScale = defaultChinchillaScale;
let currentChinchillaScale = defaultChinchillaScale;
const chinchillaScaleTransitionSpeed = 5;


const cameraDistance = 5;
const phi = Math.PI / 3;
const theta = 0;

const raycaster = new THREE.Raycaster();
const pointer = new Vector2();
const pointerPx = new Vector2();
let hoveringChinchilla = false;
let draggingChinchilla = false;
let hoveringTrashCan = false;

let dragStartPoint = new Vector2();
let dragOrigin = new Vector3();

const drapDistanceEpsilon = 0.001;
const trashCanHoverEpsilon = 1;
const trashCanActiveEpsilon = 0.7;
let trashCanLength = 0;
let trashCanActiveLength = 0;
let trashCanHighlightDistance = 0;
let trashCanMargin = 0;
const returnSpeed = 5;

const chinchillaLengthUpperBound = 4;

const chinchillaConsumeTimeout = 500;
const chinchillaRespawnTimeout = 2000;

let chinchillaDestroyed = false;

camera.position.x = cameraDistance * Math.sin(phi) * Math.cos(theta);
camera.position.z = cameraDistance * Math.sin(phi) * Math.sin(theta);
camera.position.y = cameraDistance * Math.cos(phi);
camera.lookAt(0, 0, 0);

/**
 * @param {number} len
 * @returns {number}
 */
function worldLengthToWidthPx(len){
	return len/(camera.right - camera.left)
		* canvas.clientWidth;
}

function animate() {
	requestAnimationFrame( animate );
	const delta = clock.getDelta();

	currentRotateSpeed = lerpClamped(currentRotateSpeed, targetRotateSpeed, delta);
	currentChinchillaScale = lerpClamped(currentChinchillaScale, targetChinchillaScale, delta * chinchillaScaleTransitionSpeed);

	if(chinchilla){
		chinchilla.scale.fromArray(new Array(3).fill(currentChinchillaScale));
		chinchillaModel.rotateY(delta * rotateSpeedMap(currentRotateSpeed));
		if(draggingChinchilla){
			const d = new Vector2();
			d.subVectors(pointer, dragStartPoint);
			d.multiply(new Vector2(-camera.right, camera.top));
			const translation = new Vector3(d.y, 0, d.x);
			translation.applyAxisAngle(new Vector3(0, 0, 1), Math.PI - phi);
			chinchilla.position.copy(translation).sub(dragOrigin);
		}
		else if(!chinchillaDestroyed){
			chinchilla.position.addScaledVector(
				new Vector3().sub(chinchilla.position),
				delta * returnSpeed
			);
		}
	}

	renderer.render(scene, camera);
}
animate();

canvas.addEventListener("pointermove", event => {
	pointerPx.x = event.offsetX;
	pointerPx.y = event.offsetY;
	pointer.x = event.offsetX / canvas.clientWidth * 2 - 1;
	pointer.y = -(event.offsetY / canvas.clientHeight * 2 - 1);

	if(!chinchilla || chinchillaDestroyed) return;
	raycaster.setFromCamera(pointer, camera);
	const intersections = raycaster.intersectObject(chinchilla);
	if(intersections.length != 0){
		hoveringChinchilla = true;
		canvas.style.cursor = "pointer";
	}
	else{
		hoveringChinchilla = false;
		canvas.style.cursor = "default";
	}

	targetChinchillaScale = defaultChinchillaScale;
	if(draggingChinchilla){
		const trashCanDistance = new Vector2(1, -1).sub(pointer).length();
		const trashCanDisplacementPx = new Vector2(canvas.clientWidth, canvas.clientHeight).sub(pointerPx);
		if(trashCanDisplacementPx.length() < trashCanHighlightDistance){
			trashCan.classList.add("highlighted");
		}
		else{
			trashCan.classList.remove("highlighted");
		}

		const minPx = trashCanMargin;
		const maxPx = trashCanMargin + trashCanActiveLength;

		if(
			trashCanDisplacementPx.x < maxPx && trashCanDisplacementPx.y < maxPx
			&& trashCanDisplacementPx.x > minPx && trashCanDisplacementPx.y > minPx
		){
			trashCan.classList.add("active");
			// scale * worldLengthToWidthPx(chinchillaSizeUpperBound) = trashCanActiveLength / 2
			// scale = trashCanActiveLength / (2 * worldLengthToWidthPx(chinchillaSizeUpperBound))
			targetChinchillaScale = trashCanActiveLength / (2 * worldLengthToWidthPx(chinchillaLengthUpperBound));
			hoveringTrashCan = true;
		}
		else{
			hoveringTrashCan = false;
			trashCan.classList.remove("active");
		}
	}
	else{
		trashCan.classList.remove("highlighted");
		trashCan.classList.remove("active");
	}
})

canvas.addEventListener("mousedown", event => {
	if(hoveringChinchilla){
		// in case the ray intersects to detect hover
		// but now it doesn't, check before
		// saying we drag chinchilla
		raycaster.setFromCamera(pointer, camera);
		const intersections = raycaster.intersectObject(chinchilla);
		if(intersections.length != 0){
			draggingChinchilla = true;
			dragStartPoint.copy(pointer);

			intersections[0].object.parent.parent.getWorldPosition(dragOrigin)
			dragOrigin.sub(intersections[0].point)
			chinchilla.position.sub(dragOrigin);
			chinchillaModel.position.add(dragOrigin);
		}
	}
})

function respawnChinchilla(){
	chinchillaDestroyed = false;
	chinchilla.position.multiplyScalar(0);
	trashCan.classList.remove("highlighted");
	trashCan.classList.remove("active");

	targetRotateSpeed = defaultRotateSpeed;
	currentRotateSpeed = defaultRotateSpeed;

	currentChinchillaScale = 0;
	targetChinchillaScale = defaultChinchillaScale;

	chinchillaModel.setRotationFromAxisAngle(new Vector3(0, 1, 0), defaultChinchillaRotation);
	chinchilla.position.multiplyScalar(0);
	chinchillaModel.position.multiplyScalar(0);
}

canvas.addEventListener("mouseup", event => {
	if(hoveringChinchilla){
		let d = pointer.clone();
		d.sub(dragStartPoint);
		// if the distance dragged was small, treat as click
		if(d.length() < drapDistanceEpsilon){
			targetRotateSpeed += 1;
		}
	}
	if(draggingChinchilla && hoveringTrashCan){
		chinchillaDestroyed = true;
		targetChinchillaScale = 0;
		canvas.style.cursor = "default";
		setTimeout(() => {
			currentChinchillaScale = 0;
			trashCan.classList.remove("highlighted");
			trashCan.classList.remove("active");
		}, chinchillaConsumeTimeout);
		setTimeout(respawnChinchilla, chinchillaRespawnTimeout);

	} else if (hoveringTrashCan) {
		trashCan.classList.remove("highlighted");
		trashCan.classList.remove("active");
	}
	else if(draggingChinchilla) {
		targetChinchillaScale = defaultChinchillaScale;
		chinchillaModel.position.sub(dragOrigin);
		chinchilla.position.add(dragOrigin);
		dragOrigin.multiplyScalar(0);
	}
	hoveringTrashCan = false;
	draggingChinchilla = false;
})



function onWindowResize(){
	const trashCanStyle = window.getComputedStyle(trashCan);

	const lengthStr = trashCanStyle.getPropertyValue("--length");
	const activeLengthStr = trashCanStyle.getPropertyValue("--active-length");
	const highlightDistanceStr = trashCanStyle.getPropertyValue("--highlight-distance");
	const marginStr = trashCanStyle.getPropertyValue("--spacing");

	const pxRegEx = /^(\d+)px$/;

	const lengthMatch = lengthStr.match(pxRegEx);
	const activeLengthMatch = activeLengthStr.match(pxRegEx);
	const highlightDistanceMatch = highlightDistanceStr.match(pxRegEx);
	const marginMatch = marginStr.match(pxRegEx);

	if(!(lengthMatch && activeLengthMatch && highlightDistanceMatch && marginMatch)){
		throw "Trash can styles must use pixels";
	}

	const length = parseInt(lengthMatch[1]);
	const activeLength = parseInt(activeLengthMatch[1]);
	const highlightDistance = parseInt(highlightDistanceMatch[1]);
	const margin = parseInt(marginMatch[1]);
	trashCanLength = length;
	trashCanActiveLength = activeLength;
	trashCanHighlightDistance = highlightDistance;
	trashCanMargin = margin;
}

window.addEventListener("resize", onWindowResize);
onWindowResize();