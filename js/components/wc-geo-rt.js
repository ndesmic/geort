import { Camera } from "./entity/camera.js";
import { Light } from "./entity/light.js";
import { dotVector, addVector, subtractVector, multiplyVector, normalizeVector, getVectorMagnitude, componentwiseMultiplyVector } from "./lib/vector.js";
import { clamp } from "./lib/math-helpers.js";

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
		element.createMeshes = element.createMeshes.bind(element);
		element.createLights = element.createLights.bind(element);
		element.render = element.render.bind(element);
		element.raytrace = element.raytrace.bind(element);
	}
	async connectedCallback() {
		this.createShadowDom();
		this.cacheDom();
		this.attachEvents();


		this.createCameras();
		this.createMeshes();
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
				position: [0, 0, -2],
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
				position: [0.75,0,-2],
				color: [1,1,1,1]
			}),
		};
	}
	createMeshes(){
		this.meshes = {
			sphere: {
				position: [0,0,0],
				radius: 1,
				color: [0, 1, 0, 1],
				specularity: 1,
				gloss: 100
			},
			sphere1: {
				position: [0.75,0,-1.5],
				radius: 0.1,
				color: [1,0,1,1]
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
				const xDelta = multiplyVector(this.cameras.default.getRightDirection(), (col - halfPixelWidth) * pixelWidthRatio);
				const yDelta = multiplyVector(multiplyVector(this.cameras.default.getUpDirection(), -1), (row - halfPixelHeight) * pixelHeightRatio);

				const ray = {
					origin: this.cameras.default.getPosition(),
					direction: normalizeVector(addVector(addVector(this.cameras.default.getForwardDirection(), xDelta), yDelta))
				};

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
	raytrace(ray){
		const intersection = this.intersectObjects(ray);

		if (intersection.distance === Infinity) {
			return [255, 255, 255];
		}

		const collisionPoint = addVector(ray.origin, multiplyVector(ray.direction, intersection.distance));

		return this.getSurfaceInfo(collisionPoint, intersection.mesh, ray);
	}
	intersectObjects(ray) {
		let closest = { distance: Infinity, mesh: null };
		for (let mesh of Object.values(this.meshes)) {
			const distance = this.intersectSphere(ray, mesh);
			if (distance != undefined && distance < closest.distance) {
				closest = { distance, mesh };
			}
		}
		return closest;
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
	getSurfaceInfo(collisionPosition, mesh, ray){
		let color = [0,0,0];
		for(const light of Object.values(this.lights)){
			if(this.isVisible(collisionPosition, light.position)){
				const normal = normalizeVector(subtractVector(collisionPosition, mesh.position));
				const toLight = subtractVector(light.position, collisionPosition);
				const lightAmount = multiplyVector(light.color, dotVector(toLight, normal));
				color = addVector(color, componentwiseMultiplyVector(mesh.color, lightAmount));

				if(mesh.specularity){
					const toCamera = normalizeVector(subtractVector(ray.origin, collisionPosition));
					const halfVector = normalizeVector(addVector(toLight, toCamera));
					const baseSpecular = clamp(dotVector(halfVector, normal), 0.0, 1.0);
					const specularMagnitude = baseSpecular ** mesh.gloss;
					const specularLight = componentwiseMultiplyVector(light.color, [specularMagnitude, specularMagnitude, specularMagnitude, 1.0]);
					color = addVector(color, specularLight);
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