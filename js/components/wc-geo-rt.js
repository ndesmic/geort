import { Camera } from "./entity/camera.js";
import { Light } from "./entity/light.js";
import { 
	dotVector, 
	addVector, 
	subtractVector, 
	scaleVector, 
	normalizeVector, 
	getVectorMagnitude, 
	componentwiseMultiplyVector,
	reflectVector
} from "./lib/vector.js";
import { clamp } from "./lib/math-helpers.js";

const trueReflections = true;
const MAX_BOUNCES = 3;
const BACKGROUND_COLOR = [0.1, 0.1, 0.1, 1]; //cornflower blue
const BACKGROUND_LIGHT = [0.1, 0.1, 0.1, 1];

export class WcGeoRt extends HTMLElement {
	#context;
	#width = 1280;
	#height = 720;

	constructor(){
		super();
		this.bind(this);
	}
	bind(element){
		element.attachEvents = element.attachEvents.bind(element);
		element.cacheDom = element.cacheDom.bind(element);
		element.createShadowDom = element.createShadowDom.bind(element);
		element.createCameras = element.createCameras.bind(element);
		element.createObjects = element.createObjects.bind(element);
		element.createLights = element.createLights.bind(element);
		element.render = element.render.bind(element);
		element.raytrace = element.raytrace.bind(element);
	}
	async connectedCallback() {
		this.createShadowDom();
		this.cacheDom();
		this.attachEvents();


		this.createCameras();
		this.createObjects();
		this.createLights();

		this.#context = this.dom.canvas.getContext("2d");

		this.render();
	}
	createShadowDom() {
		this.shadow = this.attachShadow({ mode: "open" });
		this.shadow.innerHTML = `
				<style>
					:host { display: block; }
				</style>
				<canvas width="${this.#width}" height="${this.#height}" style="border: 1px solid black"></canvas>
			`;
	}
	createCameras(){
		this.cameras = {
			default: new Camera({
				position: [0, 0.75, -2],
				screenHeight: this.#height,
				screenWidth: this.#width,
				near: 0,
				far: 5
			})
		};
	}
	createLights(){
		this.lights = {
			light1: new Light({
				position: [1,3,-1],
				color: [0.3,0.3,0.3,0.3]
			}),
			light2: new Light({
				position: [-0.75, 0.5, -2],
				color: [0.1, 0.1, 0.1, 1]
			})
		};
	}
	createObjects(){
		this.objects = {
			sphere: {
				type: "sphere",
				position: [0,0,0],
				radius: 1,
				color: [0, 1, 0, 1],
				specularity: 0.3,
			},
			sphere2: {
				type: "sphere",
				position: [2, 0, 0],
				radius: 0.25,
				color: [1, 0, 0.5, 1],
				specularity: 0.1,
			},
			plane: {
				type: "plane",
				normal: [0,1,0],
				offset: -1,
				color: [0.3,0.3,0.3,1],
				specularity: 0.9
			}
		};
	}
	cacheDom() {
		this.dom = {
			canvas: this.shadow.querySelector("canvas")
		};
	}
	render(){
		const pixelData = this.#context.getImageData(0, 0, this.#width, this.#height);
		const halfVolumeHeight = 1;
		const halfPixelHeight = this.#height / 2;
		const pixelHeightRatio = halfVolumeHeight / halfPixelHeight;
		const halfVolumeWidth = this.cameras.default.getAspectRatio();
		const halfPixelWidth = this.#width / 2;
		const pixelWidthRatio = halfVolumeWidth / halfPixelWidth;

		for (let row = 0; row < this.#height; row++) {
			for (let col = 0; col < this.#width; col++) {
				const xDelta = scaleVector(this.cameras.default.getRightDirection(), (col - halfPixelWidth) * pixelWidthRatio);
				const yDelta = scaleVector(scaleVector(this.cameras.default.getUpDirection(), -1), (row - halfPixelHeight) * pixelHeightRatio);

				const ray = {
					origin: this.cameras.default.getPosition(),
					direction: normalizeVector(addVector(addVector(this.cameras.default.getForwardDirection(), xDelta), yDelta))
				};

				if(row == this.#height -1 && col == this.#width / 2){
					console.log("bottom");
				}
				if (row == 2 * this.#height / 3 && col == 0) {
					console.log("left");
				}

				let color = this.raytrace(ray);

				const index = (row * this.#width * 4) + (col * 4);
				pixelData.data[index + 0] = Math.floor(color[0] * 255);
				pixelData.data[index + 1] = Math.floor(color[1] * 255);
				pixelData.data[index + 2] = Math.floor(color[2] * 255);
				pixelData.data[index + 3] = Math.floor(color[3] * 255);
			}
		}

		this.#context.putImageData(pixelData, 0, 0);
	}
	raytrace(ray, bounceCounter = MAX_BOUNCES){
		if(bounceCounter <= 0){
			return BACKGROUND_COLOR;
		}

		const intersection = this.intersectObjects(ray);

		if (intersection.distance === Infinity || intersection.distance === -Infinity) {
			return BACKGROUND_COLOR;
		}

		const collisionPoint = addVector(ray.origin, scaleVector(ray.direction, intersection.distance));

		return this.getSurfaceInfo(collisionPoint, intersection.object, ray, bounceCounter);
	}
	intersectObjects(ray) {
		let closest = { distance: Infinity, object: null };
		for (let object of Object.values(this.objects)) {
			let distance;
			switch(object.type){
				case "sphere": {
					distance = this.intersectSphere(ray, object);
					break;
				}
				case "plane": {
					distance = this.intersectPlane(ray, object);
					break;
				}
			}
			if (distance != undefined && distance < closest.distance && distance > 0.001) {
				closest = { distance, object };
			}
		}
		return closest;
	}
	getNormal(collisionPosition, object){
		switch(object.type){
			case "sphere": {
				return normalizeVector(subtractVector(collisionPosition, object.position));
			}
			case "plane": {
				return normalizeVector(object.normal);
			}
		}
	}
	intersectSphere(ray, sphere) {
		const a = dotVector(ray.direction, ray.direction);
		const cameraToCenter = subtractVector(ray.origin, sphere.position);
		const b = 2 * dotVector(ray.direction, cameraToCenter);
		const c = dotVector(cameraToCenter, cameraToCenter) - sphere.radius ** 2;
		const discriminant = (b ** 2) - (4 * a * c);

		if(discriminant < 0) return undefined; //no solution, no hit

		const s1 = (-b + Math.sqrt(discriminant)) / 2*a;
		const s2 = (-b - Math.sqrt(discriminant)) / 2*a;

		if(s1 < 0 || s2 < 0) return undefined; //either facing away or origin is inside sphere, no hit

		return Math.min(s1, s2);
	}
	intersectPlane(ray, plane){
		return (plane.offset - dotVector(ray.origin, plane.normal)) / dotVector(ray.direction, plane.normal);
	}
	getSurfaceInfo(collisionPosition, object, ray, bounceCounter){
		let color = componentwiseMultiplyVector(BACKGROUND_LIGHT, object.color);
		for(const light of Object.values(this.lights)){
			if(this.isVisible(collisionPosition, light.position)){
				const normal = this.getNormal(collisionPosition, object);
				const toLight = normalizeVector(subtractVector(light.position, collisionPosition));
				const lightAmount = scaleVector(light.color, dotVector(toLight, normal));
				color = addVector(color, componentwiseMultiplyVector(object.color, lightAmount));

				if(object.specularity){
					if(trueReflections){
						const reflectionDirection = reflectVector(ray.direction, normal);
						const reflectionColor = this.raytrace({ origin: collisionPosition, direction: reflectionDirection }, bounceCounter - 1);
						const specularLight = clamp(scaleVector(reflectionColor, object.specularity), 0.0, 1.0);
						color = addVector(color, specularLight);
					} else {
						const toCamera = normalizeVector(subtractVector(ray.origin, collisionPosition));
						const halfVector = normalizeVector(addVector(toLight, toCamera));
						const baseSpecular = clamp(dotVector(halfVector, normal), 0.0, 1.0);
						const specularMagnitude = baseSpecular ** object.gloss;
						const specularLight = componentwiseMultiplyVector(light.color, [specularMagnitude, specularMagnitude, specularMagnitude, 1.0]);
						color = addVector(color, specularLight);
					}
				}
			}
		}
		return [...color, 1];
	}
	isVisible(origin, destination) {
		const toDestination = subtractVector(destination, origin);
		const intersection = this.intersectObjects({ origin, direction: normalizeVector(toDestination) });
		const expectedDistance = getVectorMagnitude(toDestination);
		const delta = 0.001;
		return intersection.distance > expectedDistance - delta || intersection.distance < delta;
	}
	attachEvents() {
	}

	//Attrs
	attributeChangedCallback(name, oldValue, newValue) {
		if (newValue !== oldValue) {
			this[name] = newValue;
		}
	}
	set height(value) {
		this.#height = value;
		if (this.dom) {
			this.dom.canvas.height = value;
		}
	}
	set width(value) {
		this.#width = value;
		if (this.dom) {
			this.dom.canvas.height = value;
		}
	}
}

customElements.define("wc-geo-rt", WcGeoRt);